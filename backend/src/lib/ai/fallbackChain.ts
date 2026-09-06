// backend/src/lib/ai/fallbackChain.ts
import { FALLBACK_CHAIN, FallbackKeyConfig, isFreeTierKey, vendorOf } from '../config'
import { checkAnswerIntegrity, rewriteFraming } from './answerIntegrity'
import { streamWithGemini } from './gemini'
import { streamWithOpenAI } from './openai'
import { streamWithGroq } from './groq'
import { streamWithMistral } from './mistral'
import { beautifyResponse, isResponseComplete } from './responseBeautifier'
import type { ScoredProject } from '../discovery'

type Message = { role: 'user' | 'assistant'; content: string }
type SendFn = (event: string, data: Record<string, unknown>) => void
type ToolCallFn = (name: string, args: Record<string, unknown>) => Promise<unknown>

import type { InferenceConfig } from './openai'

export interface FallbackChainOptions {
  systemPrompt: string
  messages: Message[]
  send: SendFn
  onToolCall: ToolCallFn
  groqFallbackSuffix: string
  /** Builds the system prompt for a provider given whether it can call tools. */
  buildSystemPrompt?: (supportsTools: boolean) => string
  projects?: ScoredProject[]
  userMessage?: string
  userId?: string | null
  sessionId?: string | null
  chainConfig?: FallbackKeyConfig[] // Allows custom chain override for unit testing
  config?: InferenceConfig
  /** Drop any markdown table the model emits. */
  suppressTables?: boolean
}

/**
 * A question whose answer IS a list of named projects, builders or societies.
 *
 * Both halves are required. "best society in sector 137" asks for a thing we
 * store rows about; "which sector has the best connectivity" and "what is the
 * average price per sqft" do not, and are answered well from the rendered
 * market tables with no project row in sight.
 */
const NAMED_INVENTORY_NOUN = /\b(societ(y|ies)|projects?|builders?|developers?|flats?|apartments?|towers?|properties)\b/i
const ASKING_FOR_A_LIST = /\b(best|top|which|show|list|find|recommend|suggest|options?|good)\b/i

/**
 * True when this leg cannot answer the question honestly and should not try.
 *
 * "best society in sector 137 noida" needs rows. A leg with supportsTools:
 * false and an empty facts block has none, so it has exactly two options —
 * invent, or refuse. Measured on the demo corpus it invented, then the guard
 * discarded the answer, then the next leg did the same: 40 to 100 seconds and
 * two generations billed to arrive at the refusal it could have given at once.
 * Four turns ran over a minute this way.
 *
 * Skipping is not a loss of capability. The answer at the end of that path was
 * already the refusal; this only stops paying for the detour.
 */
function turnNeedsALookup(userMessage: string, retrievedRows: number): boolean {
  if (retrievedRows > 0) return false
  return NAMED_INVENTORY_NOUN.test(userMessage) && ASKING_FOR_A_LIST.test(userMessage)
}

export interface FallbackChainResult {
  text: string
  provider: string // Provider that succeeded (e.g. 'cerebras', 'mistral', 'groq', 'openai', 'gemini', 'database')
  model: string
  envKey: string
  is_verified: boolean // true if from verified database, false if from AI provider
  /**
   * Every leg failed and this is the outage notice, not an answer.
   *
   * Callers must not decorate it — no property card, no "review the card" chip,
   * nothing implying we looked something up. The text names no project for the
   * same reason.
   */
  degraded?: boolean
}

import { validateAgainstFactsSync } from './guardrails-v2'
import { trackEvent } from '../monitoring/posthog'
import { getLangfuse } from '../monitoring/langfuse'
import { isCoolingDown, cooldownReason, recordFailure, recordSuccess } from './providerCooldown'
import { env } from '../env'
import { adaptiveCapMessages, CONTEXT_TOKEN_CEILING } from './adaptiveMessaging'
import { STATIC_PREFIX_MARKER } from './systemPromptCache'
import { estimateTokensReal } from './tokenizer'
import { createTableStripper, stripTables } from './stripTables'
import { checkToolBlindAnswer } from './toolBlindGuard'
import { endCleanly } from './endCleanly'
import { wouldExceed, recordAttempt, recordRateLimited, limitFor } from './rateBudget'
import { sanitizeOutput } from './sanitizeOutput'
import { oneQuestion } from './oneQuestion'

/** Remove the prefix sentinel — it must never reach a provider. */
function stripMarker(prompt: string): string {
  return prompt.replace(`\n${STATIC_PREFIX_MARKER}\n`, '\n')
}

/** Splice the no-tools block into the stable prefix rather than appending it */
function applyNoToolsBlock(prompt: string, block: string): string {
  if (!block) return stripMarker(prompt)
  const token = `\n${STATIC_PREFIX_MARKER}\n`
  if (!prompt.includes(token)) return prompt + block
  return prompt.replace(token, `\n${block}\n`)
}

/** How much of the answer is held back before the first token reaches the buyer. */
const STREAM_BUFFER_CHARS = Number(process.env.STREAM_BUFFER_CHARS ?? 250)

/**
 * Reply ceiling on a free-tier leg.
 *
 * Raised from 900 on 31 Aug 2026. 900 was set to stop a free key spending its
 * per-minute token allowance on one answer, and it did — by cutting the answer
 * off. The free keys LEAD the chain, so in practice every long reply was
 * clamped: "which is better for a family: Sector 74, 75, 76 or 78" asks for a
 * comparison, `inferenceProfile` allots it 2,600 tokens, and it was cut at 900,
 * mid-bullet, halfway through the decision guide.
 *
 * The tail buffer added the same week removes the ragged edge, which made the
 * cut look tidier without making the answer complete. This is the other half:
 * the ceiling has to be large enough for the shape of answer being asked for.
 *
 * 2,200 covers every shape in `inferenceProfile` except the largest comparison,
 * and output is billed only on what is actually generated — a short answer
 * costs the same as it did at 900. What changes is that a long one finishes.
 */
const FREE_TIER_MAX_TOKENS = Number(process.env.FREE_TIER_MAX_TOKENS ?? 2200)

/**
 * Characters held back at the TAIL of a streaming answer.
 *
 * STREAM_BUFFER_CHARS above is a PREFIX buffer: it holds the opening of the
 * answer so a leg that fails early can be swapped out before the buyer sees
 * anything. Once it flushes, every later token goes straight to the client —
 * which means the one part of the answer we could never repair was its ending,
 * and the ending is exactly where a reply ceiling cuts.
 *
 * That is why roughly two answers per corpus run ended mid-sentence on every
 * leg measured, Gemini included, however the ceilings were set: `endCleanly`
 * only ever ran on the buffered path, and the buffered path is the opening.
 *
 * Holding the last ~180 characters keeps the ending editable until the stream
 * is genuinely over. The buyer sees the final sentence appear in one piece
 * instead of word by word, which is invisible next to a sentence that stops
 * halfway. Set to 0 to disable.
 */
const STREAM_TAIL_HOLD_CHARS = Number(process.env.STREAM_TAIL_HOLD_CHARS ?? 180)

function createBufferedSend(
  originalSend: SendFn,
  systemPrompt: string,
  bufferLimit = STREAM_BUFFER_CHARS,
  suppressTables = false,
) {
  // Sits between the buffer and the client, so it sees whole chunks and can
  // reassemble the lines a table is made of.
  const stripper = suppressTables
    ? createTableStripper((text) => originalSend('token', { token: text }))
    : null
  const forwardToken = (token: string) => {
    if (stripper) stripper.write(token)
    else originalSend('token', { token })
  }
  let buffer = ''
  let flushed = false
  let tokensSent = false
  // Post-flush tail. Everything after the prefix buffer lands here first and
  // only the excess beyond STREAM_TAIL_HOLD_CHARS is forwarded, so the answer's
  // last ~180 characters are still ours to edit when the stream ends.
  let tail = ''

  const validateAndFlush = (forceFlush = false) => {
    if (!buffer.length) return
    const check = validateAgainstFactsSync(buffer, systemPrompt)
    if (check.blocked) {
      console.warn('[GUARDRAIL:PRE_FLUSH_PREVENTED_LEAK]', check.violations)
    }
    flushed = true
    tokensSent = true
    forwardToken(buffer)
  }

  const bufferedSend: SendFn = (event: string, data: Record<string, unknown>) => {
    if (event !== 'token' || typeof data.token !== 'string') {
      originalSend(event, data)
      return
    }

    if (flushed) {
      tokensSent = true
      if (STREAM_TAIL_HOLD_CHARS <= 0) {
        forwardToken(data.token)
        return
      }
      tail += data.token
      if (tail.length > STREAM_TAIL_HOLD_CHARS) {
        const release = tail.slice(0, tail.length - STREAM_TAIL_HOLD_CHARS)
        tail = tail.slice(tail.length - STREAM_TAIL_HOLD_CHARS)
        forwardToken(release)
      }
      return
    }

    buffer += data.token

    // Length only. The newline trigger that used to sit here closed the
    // failover window on the first line of every markdown answer.
    if (buffer.length >= bufferLimit) {
      validateAndFlush()
    }
  }

  /**
   * Ends the stream and returns how many characters were dropped from the end.
   *
   * The count matters: the buyer's screen, the transcript and the cache have to
   * agree about what was said, so whatever is trimmed here is trimmed from the
   * returned text too. Returning the number rather than re-running endCleanly
   * on the caller's copy is deliberate — re-running it on a different string
   * can reach a different cut, and then the three disagree.
   */
  const flushRemaining = (): { trimmedChars: number } => {
    if (!flushed && buffer.length > 0) {
      // Nothing has left for the client yet, so the whole answer is still
      // editable — the prefix buffer held it all, which happens on short
      // answers and on every buffered tool-blind leg.
      const before = buffer.length
      buffer = endCleanly(buffer)
      const trimmed = before - buffer.length
      validateAndFlush()
      endStripper()
      return { trimmedChars: trimmed }
    }

    // The ordinary streaming path: the opening is long gone, but the last
    // STREAM_TAIL_HOLD_CHARS are still here and are where a ceiling cuts.
    let trimmedChars = 0
    if (tail.length > 0) {
      const cleaned = endCleanly(tail, { maxTrimChars: tail.length })
      trimmedChars = tail.length - cleaned.length
      if (trimmedChars > 0) {
        console.log(`[CHAT:TRUNCATED_TAIL] dropped ${trimmedChars} dangling chars before they reached the buyer`)
      }
      if (cleaned.length > 0) forwardToken(cleaned)
      tail = ''
    }
    endStripper()
    return { trimmedChars }
  }

  // The stripper holds a partial line, and possibly a heading it has not yet
  // decided about. Without this they never reach the buyer at all.
  function endStripper() {
    if (!stripper) return
    stripper.end()
    if (stripper.droppedAnything()) {
      console.log('[CHAT:TABLE_SUPPRESSED] model drew a table we had already rendered')
    }
  }

  /**
   * Swap the held answer for an edited copy, before anything is forwarded.
   *
   * Only legal while the buffer is unflushed, which is now the state every leg
   * is in when the integrity gate runs. A no-op once tokens have left, so a
   * caller can never put the buyer's screen and the returned text out of step.
   */
  const replaceBufferedText = (next: string): boolean => {
    if (flushed || tokensSent) return false
    buffer = next
    return true
  }

  return { bufferedSend, getTokensSent: () => tokensSent, flushRemaining, replaceBufferedText }
}

export async function executeWithFallbackChain(options: FallbackChainOptions): Promise<FallbackChainResult> {
  const {
    systemPrompt,
    messages,
    send,
    onToolCall,
    groqFallbackSuffix,
    projects = [],
    userMessage = '',
    userId,
    sessionId,
    chainConfig = FALLBACK_CHAIN,
  } = options

  // Feature flag: disable Gemini fallback if disabled (defaults to enabled)
  const enableGeminiFallback = env.ENABLE_GEMINI_FALLBACK === 'true'
  const effectiveChainConfig = enableGeminiFallback
    ? chainConfig
    : chainConfig.filter(item => item.provider !== 'gemini')

  // Adaptive message capping: keep as many messages as fit within the INPUT
  const systemPromptTokens = estimateTokensReal(systemPrompt)
  const responseReserve = options.config?.maxTokens ?? 3000
  const adaptiveResult = adaptiveCapMessages(
    messages,
    systemPromptTokens,
    CONTEXT_TOKEN_CEILING,
    responseReserve,
  )
  const cappedMessages = adaptiveResult.messages

  // Log chain initiation at info level
  if (process.env.DEBUG_FALLBACK) {
    console.log(`[FALLBACK:INIT] Starting fallback chain with ${effectiveChainConfig.length} providers`)
    console.log(`[FALLBACK:CONTEXT] Messages: ${adaptiveResult.messageCount}/${messages.length} (adaptive, ${adaptiveResult.estimatedTokens} tokens), SystemPrompt: ${systemPrompt.slice(0, 50)}...`)
    if (!enableGeminiFallback) console.log(`[FALLBACK:FEATURE_FLAG] Gemini fallback disabled`)
  }

  // Computed once: it depends on the turn, not on the leg.
  const needsALookup = turnNeedsALookup(userMessage, projects.length)

  for (const item of effectiveChainConfig) {
    // Checked before the key and the cooldown, because it is a property of the
    // question rather than of this leg's configuration.
    if (needsALookup && !item.supportsTools) {
      console.log(
        `[FALLBACK:NO_LOOKUP] ${item.label} — skipping: the answer is a list of named projects, retrieval found none, and this leg cannot fetch any`,
      )
      continue
    }

    const apiKey = process.env[item.envKey]
    if (!apiKey) {
      console.log(`[FALLBACK:SKIP] ${item.label} (${item.envKey}) — no API key configured`)
      continue
    }

    // Skip a leg that recently failed for a reason retrying cannot fix — an
    const cooldownKey = `${item.envKey}:${item.model}`
    if (isCoolingDown(cooldownKey)) {
      console.log(`[FALLBACK:COOLDOWN] ${item.label} — skipping: ${cooldownReason(cooldownKey)}`)
      continue
    }

    // Skip a leg that is about to be refused, rather than finding out by being
    // refused. The cooldown above is reactive — it costs one failed round-trip
    // to learn what a counter already knew — and a 429 that lands mid-stream
    // cannot be rolled over at all, because tokens are already on screen. The
    // only way not to truncate is not to start on a leg that will be refused.
    //
    // Budget is per KEY, not per leg: the two NVIDIA legs share one key and
    // therefore one allowance, and counting them separately would authorise
    // twice the requests the key actually has.
    const vendor = vendorOf(item)
    if (wouldExceed(item.envKey, vendor)) {
      console.log(
        `[FALLBACK:RATE_BUDGET] ${item.label} — skipping: ${limitFor(vendor)} req/min already used on ${item.envKey}`,
      )
      continue
    }
    recordAttempt(item.envKey)

    const effectivePrompt = options.buildSystemPrompt
      ? stripMarker(options.buildSystemPrompt(item.supportsTools))
      : item.supportsTools
        ? stripMarker(systemPrompt)
        : applyNoToolsBlock(systemPrompt, groqFallbackSuffix)
    // Validate against the prompt this provider actually received, not the
    // pre-variant one — otherwise the fact-check reads a different tool section.
    /**
     * Every leg is held back now, not only the tool-blind ones.
     *
     * The old split gave tool-capable legs a 250-char failover window and let
     * the rest of the answer stream straight through, on the reasoning that a
     * leg which CAN look something up will. Measured: the tool-capable Gemini
     * leg answered a question about a project that does not exist with "a
     * prominent high-rise residential development in Noida, crafted by
     * **Supertech Limited**", and no guard ran, because the leg had tools.
     * Having a tool is not the same as using it.
     *
     * So the whole answer is held until `checkAnswerIntegrity` has read it. The
     * cost is time-to-first-token on every leg; the buyer sees a thinking
     * indicator for a second or two longer and then the complete answer. Two
     * things come free with it: `endCleanly` now runs on the full text rather
     * than only on a prefix that happened to fit the buffer, which is the
     * mid-sentence ending that showed up in every corpus run measured; and the
     * screen, the transcript and the cache are built from one identical string.
     */
    const bufferLimit = Number.MAX_SAFE_INTEGER
    const { bufferedSend, getTokensSent, flushRemaining, replaceBufferedText } = createBufferedSend(send, effectivePrompt, bufferLimit, options.suppressTables === true)

    const effectiveConfig = options.config || { maxTokens: 3000 }
    // Gemini ignores its FALLBACK_CHAIN item.model unless we thread it through here — without
    const legMaxTokens =
      isFreeTierKey(item.envKey)
        ? Math.min(effectiveConfig.maxTokens ?? 1500, FREE_TIER_MAX_TOKENS)
        : effectiveConfig.maxTokens

    // The profile's model only applies to the provider it was chosen for.
    // `effectiveConfig` is shared by every leg, so a name from one vendor's
    // catalogue reaching another's is a 404 — see the note on the OpenAI leg.
    const profileModel =
      effectiveConfig.model && /^gemini/i.test(effectiveConfig.model) ? effectiveConfig.model : undefined
    const geminiConfig = {
      ...effectiveConfig,
      model: profileModel ?? item.model,
      ...(item.apiVersion ? { apiVersion: item.apiVersion } : {}),
    }

    // A free-tier key is limited by tokens per minute and requests per day, not
    if (isFreeTierKey(item.envKey)) {
      geminiConfig.thinkingBudget = 0
      geminiConfig.maxTokens = Math.min(geminiConfig.maxTokens ?? 1500, FREE_TIER_MAX_TOKENS)
    }

    try {
      if (process.env.DEBUG_FALLBACK) {
        const effectiveModel = item.provider === 'gemini' ? geminiConfig.model : item.model
        console.log(`[FALLBACK:TRY] → ${item.label} | Model: ${effectiveModel} | Tools: ${item.supportsTools}`)
      }

      let text = ''
      if (item.provider === 'mistral') {
        text = await streamWithMistral(effectivePrompt, cappedMessages, bufferedSend, apiKey, userId, sessionId, legMaxTokens)
      } else if (item.provider === 'gemini') {
        text = await streamWithGemini(effectivePrompt, cappedMessages, bufferedSend, onToolCall, geminiConfig, apiKey, userId, sessionId)
      } else if (item.provider === 'openai') {
        text = await streamWithOpenAI(
          effectivePrompt,
          cappedMessages,
          bufferedSend,
          onToolCall,
          // `item.model`, never `effectiveConfig.model`.
          //
          // The profile picks a GEMINI model name for the turn — measured live,
          // `[CHAT:PROFILE] model=gemini-3.5-flash-lite` — and `effectiveConfig`
          // is one object shared by every leg. Preferring it here asked Cohere,
          // NVIDIA and Cloudflare for a Gemini model: `404 status code (no
          // body)`, `404 404 page not found`, `400 status code (no body)`. All
          // three tool-capable non-Gemini legs failed on every turn, so when the
          // Gemini prepay balance ran out the chain had no leg that could read a
          // project row at all — which is the exact condition that produces
          // invented projects. Both keys and both hosts probe fine by hand; only
          // the model name was wrong.
          //
          // Without item.model the leg falls back to MODELS.MAIN, which is a
          // gpt-4o name that neither Cohere nor NVIDIA has. Two legs share the
          // NVIDIA key and differ only by model, so this is also what keeps
          // them from being the same leg twice.
          { ...effectiveConfig, model: item.model },
          userId,
          sessionId,
          apiKey,
          item.baseUrl,
        )
      } else if (item.provider === 'groq') {
        text = await streamWithGroq(effectivePrompt, cappedMessages, bufferedSend, userId, sessionId, apiKey, legMaxTokens)
      }

      /**
       * The integrity gate, before `flushRemaining` and therefore before the
       * buyer has read a word.
       *
       * Throwing here rolls the turn to the next leg with nothing delivered,
       * exactly as a pre-token provider failure does — which is why the whole
       * answer has to still be in the buffer at this point, and why every leg
       * is now buffered rather than only the tool-blind ones.
       *
       * Three classes, all measured in production, all discarded: a project or
       * registration number that came from nowhere; the prompt's own
       * scaffolding read aloud ("the provided verified facts block only
       * contains information for a single project"); and a count of what we
       * hold ("280 projects across 61 sectors"), which is ours and not the
       * buyer's.
       */
      if (text.trim()) {
        // Scanned in the model's own words, before any rewriting. The raw text
        // is what it meant to say, and a rewrite could file the edge off the
        // very phrase the scan exists to catch.
        const violations = await checkAnswerIntegrity(text, effectivePrompt)
        if (violations.length > 0) {
          console.warn(
            `[FALLBACK:INTEGRITY] ${item.label} — discarding: ` +
            violations.map(v => `${v.kind}(${v.detail})`).join(', '),
          )
          throw new Error(`${item.label} failed integrity: ${violations[0].kind} — ${violations[0].detail}`)
        }
        const framed = rewriteFraming(text)
        if (framed.rewrites > 0) {
          console.log(`[FALLBACK:REFRAMED] ${item.label} — ${framed.rewrites} house-style phrase(s) rewritten`)
          replaceBufferedText(framed.text)
          text = framed.text
        }
      }

      const { trimmedChars } = flushRemaining()

      // An empty string is a failed turn, not a successful one.
      if (!text.trim() && !getTokensSent()) {
        throw new Error(`${item.label} returned no text`)
      }

      // flushRemaining trimmed a dangling fragment off the stream, so the
      // transcript and the cache have to carry the same edit or the three
      // disagree about what was said. This now applies to EVERY leg, not only
      // the tool-blind ones: the tail buffer means a Gemini answer cut by its
      // reply ceiling is repaired the same way a Mistral one is, which is the
      // half of the truncation problem that was never covered.
      if (trimmedChars > 0) text = text.trimEnd().slice(0, -trimmedChars)
      // The buyer saw the stripped stream, so the returned copy has to match:
      if (options.suppressTables) text = stripTables(text)
      // The buyer read the sanitised stream; the transcript and cache must match.
      text = sanitizeOutput(text).text

      const beautified = isResponseComplete(text) ? beautifyResponse(text) : text
      if (process.env.DEBUG_FALLBACK) {
        console.log(`[FALLBACK:SUCCESS] ✓ ${item.label} generated ${text.length} chars`)
      }

      // Track fallback response
      if (userId && sessionId) {
        try {
          trackEvent(userId, 'fallback_response_generated', {
            provider: item.provider,
            model: item.model,
            text_length: text.length,
            session_id: sessionId,
          })
        } catch (e) {
          console.warn('[FALLBACK:TRACKING_ERROR]', e)
        }

        try {
          const lf = getLangfuse()
          if (lf) {
            const trace = lf.trace({
              id: `chat-${sessionId}-${Date.now()}`,
              sessionId,
              userId: userId || undefined,
              name: 'chat_turn',
              input: { userMessage, historyLength: messages.length },
              output: { text },
              tags: [item.provider, item.model],
            })
            trace.generation({
              name: item.label,
              model: item.model,
              input: userMessage,
              output: text,
              metadata: { provider: item.provider, envKey: item.envKey },
            })
            lf.flushAsync().catch(() => {})
          }
        } catch (e) {
          // never block execution on tracing
        }
      }

            // Answered — trust this leg again immediately, in case an earlier
      // durable failure was resolved (billing topped up, quota window reset).
      recordSuccess(cooldownKey)
      return { text: beautified, provider: item.provider, model: item.model, envKey: item.envKey, is_verified: false }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      const tokensSent = getTokensSent() || (err as any)?.tokensSent === true
      const errMsg = error.message || String(err)

      // Start a cooldown only when retrying cannot help. A timeout, a stall or a
      // 500 is exactly the case where the next turn should try this leg again —
      // cooling it down would remove capacity during the outage it should survive.
      const failureKind = recordFailure(cooldownKey, error)
      // The provider knows its own limits better than our constants do. A 429
      // means the window we allowed was too generous for this key, so fill it
      // and let it roll over on its own clock.
      if (failureKind === 'rate_limited') recordRateLimited(item.envKey, vendorOf(item))
      if (failureKind === 'durable') {
        console.warn(`[FALLBACK:DURABLE] ${item.label} — cooling down: ${errMsg.slice(0, 120)}`)
      }

      // Always logged, not gated on DEBUG_FALLBACK.
      console.warn(`[FALLBACK:FAIL] ✗ ${item.label} failed: ${errMsg.slice(0, 300)}`)

      // Mid-stream stall: partial tokens were already sent to the SSE client.
      // Cannot switch providers mid-stream without duplicating output/headers.
      // Close cleanly with truncation notice.
      if (tokensSent) {
        console.error(`[FALLBACK:MID_STREAM_STALL] ${item.label} stalled mid-stream after tokens sent`)
        console.error(`[FALLBACK:MID_STREAM_STALL] Cannot switch providers — context ${messages.length} msgs + prompt already streamed`)
        const truncationNotice = '\n\n[Response truncated due to high traffic. Please ask me to continue.]'
        send('token', { token: truncationNotice })
        return { text: truncationNotice, provider: 'database', model: 'fallback', envKey: 'FALLBACK_MODE', is_verified: true }
      }

      // Pre-first-token failure: seamless rollover to next provider with same context.
      // All data (messages, systemPrompt, userMessage) flows unchanged.
      console.log(`[FALLBACK:ROLLOVER] ${item.label} pre-token failure → transferring context to next provider`)
      console.log(`[FALLBACK:ROLLOVER] Context preserved: ${messages.length} msgs, ${userMessage.length} char user input`)
    }
  }

  // All providers failed or unconfigured — fallback to database response
  console.error('[FALLBACK:EXHAUSTED] All fallback chain providers exhausted or misconfigured')
  console.error(`[FALLBACK:EXHAUSTED] Total providers tried: ${chainConfig.length}, context: ${messages.length} messages`)

  /**
   * A failed turn names nothing.
   *
   * This used to reach for `projects[0]` — whatever retrieval happened to
   * return — and write "Here are the verified details for **X** in Y: Price
   * range is Z. Please review the property card." Nothing about that was
   * verified: every leg had just failed, so no model had read the question, and
   * `projects[0]` is only related to the buyer's message if retrieval happened
   * to be about it. Reported from live use as an unrelated card appearing
   * during an outage, and that is exactly the mechanism — the outage notice
   * promoted an arbitrary row into the answer and pointed at its card.
   *
   * There is also a payment-plan variant that invented a whole paragraph about
   * "flexible payment structures including CLP and Down Payment" for a project
   * whose payment plans nobody had looked up. On the one path where we know we
   * have no answer, asserting a fact is the worst available option.
   *
   * So: say we could not answer, offer the humans, name nothing.
   */
  const fallbackMessage =
    "I couldn't get you a reliable answer just now — our AI service is briefly unavailable, " +
    "and I'd rather say so than guess.\n\n" +
    'Ask me again in a moment, or use **Book Site Visit** or **Callback** and our advisory team ' +
    'will pick it up directly.'

  send('token', { token: fallbackMessage })
  // `is_verified: false`. Every leg failed; nothing about this reply was verified
  // against anything, and the flag travels — it is what made the answer cache log
  // an outage notice as a "verified advisory response" when it stored one.
  return { text: fallbackMessage, provider: 'database', model: 'fallback', envKey: 'FALLBACK_MODE', is_verified: false, degraded: true }
}
