// backend/src/lib/ai/fallbackChain.ts
import { FALLBACK_CHAIN, FallbackKeyConfig, isFreeTierKey, vendorOf, groqReplyCeiling } from '../config'
import { checkAnswerIntegrity, checkAnswerIntegritySync, rewriteFraming, qualifyMarketFigures } from './answerIntegrity'
import { warmKnownNames } from './toolBlindGuard'
import { OUTAGE_NOTICE, outageTokenEvent } from './outageNotice'
import { EventEmitter } from 'events'

/**
 * Release each gated paragraph as it finishes instead of the whole answer at
 * the end. Env-gated so a corpus run can measure both without a rebuild;
 * default on, because the blank screen it removes is on the turns that matter
 * most.
 */
const PARAGRAPH_STREAMING = process.env.PARAGRAPH_STREAMING !== 'false'
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
  groqFallbackSuffix?: string
  /** Builds the system prompt for a provider given whether it can call tools. */
  buildSystemPrompt?: (supportsTools: boolean) => string
  projects?: ScoredProject[]
  userMessage?: string
  /**
   * Everything the buyer typed this session. Integrity checks accept a figure the
   * buyer stated themselves: live session ed1ac3ff (17 Oct 2026) lost five turns
   * to the outage notice because their own "₹1.2 Cr" budget and "₹20 lakh" down
   * payment, typed earlier, were rejected as invented.
   */
  buyerStated?: string
  userId?: string | null
  sessionId?: string | null
  guestToken?: string | null
  focusProjectId?: string | null
  chainConfig?: FallbackKeyConfig[] // Allows custom chain override for unit testing
  config?: InferenceConfig
  /** Drop any markdown table the model emits. */
  suppressTables?: boolean
  /**
   * The router's own trace id for this turn (`chat-${turnId}`), so the model
   * legs land as children of the SAME Langfuse trace `recordChatTurn` writes
   * the final answer to, instead of an orphaned `llm_chain` trace nothing
   * links back to. Falls back to the old per-call id when absent, so a
   * caller outside the router (tests, scripts) is unaffected.
   */
  traceId?: string
  /**
   * Called when every leg has failed, before the outage notice. Text is sent in
   * the notice's place (a stored-rows answer); '' means the answer already on
   * screen is complete; null keeps the notice. See lib/chat/rowsAnswer.ts.
   */
  answerFromRows?: () => Promise<string | null> | string | null
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
export function turnNeedsALookup(userMessage: string, retrievedRows: number): boolean {
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
import { turnTrace } from '../monitoring/langfuse'
import { isCoolingDown, cooldownReason, recordFailure, recordSuccess } from './providerCooldown'
import { env } from '../env'
import { adaptiveCapMessages, CONTEXT_TOKEN_CEILING } from './adaptiveMessaging'
import { STATIC_PREFIX_MARKER } from './systemPromptCache'
import { estimateTokensReal } from './tokenizer'
import { priceFor } from './cost'
import { createTableStripper, stripTables } from './stripTables'
import { checkToolBlindAnswer } from './toolBlindGuard'
import { dropUnsourcedMeasurements, dropUnsourcedJudgements, dropGarbled } from './projectFactChecks'
import { dropMisattributedPrices, warmProjectPrices } from './projectPriceGuard'
import { endCleanly } from './endCleanly'
import { wouldExceed, recordAttempt, recordRateLimited, limitFor } from './rateBudget'
import { sanitizeOutput } from './sanitizeOutput'
import { oneQuestion } from './oneQuestion'
import { isLlmStubbed, LLM_STUB_ANSWER, emitStubbedModelCall } from './llmStub'

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
 * Raised again to 3,200 on 8 Sep 2026 — measured live: a full comparison
 * table plus verdict/recommendation prose still ran past 2,200 even with 3
 * auto-continuations available (see gemini.ts). Output is billed only on
 * what is actually generated — a short answer costs the same as it did at
 * 900. What changes is that a long one finishes.
 */
const FREE_TIER_MAX_TOKENS = Number(process.env.FREE_TIER_MAX_TOKENS ?? 3200)

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

/**
 * How long the chain may keep STARTING new providers on one turn.
 *
 * Nine legs is the right depth for surviving an outage and the wrong thing to
 * walk end to end while a buyer waits. Measured across demo replays: when the
 * two free Gemini legs return no text — which they do intermittently on a
 * 34k-token prompt — the turn goes on to two billed Gemini legs (429,
 * "prepayment credits are depleted"), Cohere, and two NVIDIA models before
 * anything answers. 82.9s and 95.0s on two runs, 88s of it LLM time.
 *
 * A leg already streaming is never interrupted. This governs how many attempts
 * a turn makes, not how long a working answer may take.
 */
const TURN_BUDGET_MS = Number(process.env.FALLBACK_TURN_BUDGET_MS ?? 30_000)

/** One event per leg attempt, success or failure. Read by scripts/bench-providers.ts. */
export interface LegEvent {
  label: string
  ok: boolean
  /** Ms from the leg's start to the provider's first text chunk; null when none arrived. */
  firstChunkMs: number | null
  totalMs: number
  error?: string
}
export const legEvents = new EventEmitter()

/**
 * Benchmark only (scripts/bench-providers.ts): run a single leg, by label, with
 * no cooldown or rate-budget skips, so a failing leg is measured, not skipped.
 * Ignored outside NODE_ENV=test.
 */
const BENCH_ONLY_LEG = process.env.NODE_ENV === 'test' ? process.env.BENCH_ONLY_LEG : undefined

/**
 * The race (Day 0 item 2). When a leg has not produced its first chunk after
 * this long, the next eligible leg from a DIFFERENT vendor starts alongside it;
 * whichever speaks first is shown and the other is aborted. A different vendor,
 * because the outage this answers (Gemini's first token at 17-20 s) hits every
 * Gemini leg at once, so racing two Gemini keys buys nothing.
 * 0 turns it off.
 */
const HEDGE_MS = Number(process.env.FALLBACK_HEDGE_MS ?? 5_000)

/**
 * Fault injection for the Day 0 race check: every leg of this vendor accepts the
 * request and never speaks, as Gemini did in the 26 Oct outage, until its first-
 * token timeout. Needs ALLOW_FAULT_INJECTION=1 as well, so a stray variable on a
 * server does nothing.
 */
const FAULT_BLOCK_VENDOR = process.env.ALLOW_FAULT_INJECTION === '1' ? process.env.FALLBACK_BLOCK_VENDOR : undefined

/**
 * How the answer reaches the buyer while still being gated.
 *
 * Full buffering was the price of the integrity gate: the whole answer has to
 * be in hand and unsent for a fabrication to be discarded and the turn rolled
 * to the next leg. Measured, that gate fires on about 4% of turns - and the
 * other 96% paid a blank screen for a recovery they never used. On advisory
 * and comparison turns, which carry their reasoning in prose and have no cards
 * or table to stream first, that blank screen is five to twenty seconds.
 *
 * A paragraph is the unit because every violation class measured in production
 * is contained in one: an invented project name, a registration number, the
 * prompt's scaffolding read aloud, a count of what we hold, an opaque score.
 * None of them span a blank line.
 *
 * What this trades is recovery, not detection. Before the first paragraph
 * leaves, the whole answer is still ours and a violation rolls legs exactly as
 * before. After it leaves, a violation in a later paragraph stops the answer
 * where it stands rather than silently replacing it - the buyer sees a short
 * answer instead of a wrong one, which is the stated preference.
 *
 * The check must actually have run. `checkAnswerIntegritySync` returns null
 * when the known-name cache is cold, and null holds the paragraph back; a
 * guard that could not read the database must not wave text through.
 */
/** A real pipe-delimited table row — at least 3 cells, no line breaks inside it. */
const PIPE_ROW_ANYWHERE = /\|[^\n|]+\|[^\n|]+\|/

/**
 * True when `paragraph` structurally repeats something `priorText` already
 * has — a second markdown table, a redrawn header separator, or a heading
 * this codebase uses to mark a section (`### Verdict`, `### Recommendation`).
 * A genuine continuation never needs to redraw any of them; a model that
 * restarted does.
 *
 * The dominant real-world case, found only by live reproduction, is the
 * first check: a genuine comparison answer draws exactly ONE table, ever —
 * so a table appearing in the prior text AND another one appearing in the
 * current paragraph is a restart regardless of headings or exact wording.
 * This is deliberately not gated on `### Recommendation` appearing in
 * `priorText` specifically: three earlier attempts gated on that and still
 * missed live failures where the heading and the restart both land in the
 * SAME unreleased chunk — `priorText` genuinely does not contain the heading
 * yet in that case, because it has not been released as a separate
 * paragraph. Whether the heading was already released is irrelevant to
 * whether a second table is a restart; only the count of tables is.
 */
export function looksLikeRestart(paragraph: string, priorText: string): boolean {
  const trimmed = paragraph.trim()
  if (PIPE_ROW_ANYWHERE.test(priorText) && PIPE_ROW_ANYWHERE.test(trimmed)) return true

  const HEADING = /^#{2,3}\s+\S/m
  const TABLE_SEPARATOR_ROW = /^\s*\|?\s*:?-{2,}:?\s*\|/m
  for (const pattern of [HEADING, TABLE_SEPARATOR_ROW]) {
    const match = paragraph.match(pattern)
    if (match && priorText.includes(match[0].trim())) return true
  }
  // Prose restarts too: live transcript rerun 5 (17 Oct 2026) showed
  // "Prateek Laurel in Sector 120… convenience stores." twice in a row after a
  // hand-off, glued together, then the outage notice. A paragraph opening with a
  // sentence the buyer has already read is a restart, not a continuation.
  const first = trimmed.split(/(?<=[.!?])\s/)[0].replace(/\s+/g, ' ').trim()
  if (first.length >= 40 && priorText.replace(/\s+/g, ' ').includes(first)) return true
  return false
}

function createBufferedSend(
  originalSend: SendFn,
  systemPrompt: string,
  bufferLimit = STREAM_BUFFER_CHARS,
  suppressTables = false,
  releaseByParagraph = false,
  /**
   * Set only on a leg that is continuing after a mid-stream handoff (see
   * `carryText` at the call site). A model asked to "continue" sometimes
   * ignores that and restarts instead — observed live, reproducibly, on the
   * comparison lane: cut mid-sentence, then a fresh "| Core Metric |" table
   * header a paragraph later. Wording alone did not reliably prevent it, so
   * this is the code-level backstop: a paragraph that structurally repeats
   * something `priorCarryText` already has is a restart, not a continuation,
   * and is poisoned exactly like an integrity violation — stopping the
   * answer where it stands is the lesser harm next to showing the buyer a
   * duplicated, confusing table.
   */
  priorCarryText = '',
  userMessage = '',
) {
  // Sits between the buffer and the client, so it sees whole chunks and can
  // reassemble the lines a table is made of.
  const stripper = suppressTables
    ? createTableStripper((text) => originalSend('token', { token: text }))
    : null
  /** Everything actually sent to the client this leg, for handing a mid-stream
   *  failure to the next leg without repeating what the buyer already saw. */
  let totalForwarded = ''
  const forwardToken = (token: string) => {
    totalForwarded += token
    if (stripper) stripper.write(token)
    else originalSend('token', { token })
  }
  let buffer = ''
  let flushed = false
  let tokensSent = false
  /** Everything already forwarded, so each gate call sees the whole answer. */
  let releasedText = ''
  /** A violation was found after text had already left. Send no more. */
  let poisoned = false
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

    // `releaseByParagraph` excluded deliberately. This branch is the OTHER
    // mode's path — prefix buffer, then a held tail — and letting paragraph
    // mode fall into it once `flushed` was set broke two things at once,
    // reproduced live on "why is flat registry delayed even after physical
    // possession?":
    //
    //   - Whatever sat in `buffer` after the first `\n\n` cut was stranded.
    //     Every later token went to `tail` instead, so that remainder — the
    //     word "While", which opened the second paragraph — was emitted by
    //     `flushRemaining` at the very END. The buyer read a paragraph
    //     starting " a Society NDC only clears…" and a bare "While" after it.
    //   - `flushRemaining`'s paragraph branch only ever empties `buffer`, so
    //     the ~180 characters held in `tail` were never sent at all. The
    //     answer stopped mid-word, on "stalling the executi".
    //
    // In paragraph mode every token belongs in `buffer`, and
    // `releaseCompleteParagraphs` is what releases it, in order. Its own
    // restart check plus the one in `flushRemaining` cover the later
    // paragraphs this branch was reaching for.
    if (flushed && !releaseByParagraph) {
      if (poisoned) return
      tokensSent = true
      if (STREAM_TAIL_HOLD_CHARS <= 0) {
        if (looksLikeRestart(data.token, totalForwarded)) {
          poisoned = true
          console.warn('[FALLBACK:MID_STREAM_RESTART] restart detected in the unbuffered tail — stopping the answer where it stands')
          return
        }
        forwardToken(data.token)
        return
      }
      tail += data.token
      if (tail.length > STREAM_TAIL_HOLD_CHARS) {
        const release = tail.slice(0, tail.length - STREAM_TAIL_HOLD_CHARS)
        tail = tail.slice(tail.length - STREAM_TAIL_HOLD_CHARS)
        if (looksLikeRestart(release, totalForwarded)) {
          poisoned = true
          tail = ''
          console.warn('[FALLBACK:MID_STREAM_RESTART] restart detected in the streaming tail — stopping the answer where it stands')
          return
        }
        forwardToken(release)
      }
      return
    }

    buffer += data.token

    if (releaseByParagraph) {
      releaseCompleteParagraphs()
      return
    }

    // Length only. The newline trigger that used to sit here closed the
    // failover window on the first line of every markdown answer.
    if (buffer.length >= bufferLimit) {
      validateAndFlush()
    }
  }

  /**
   * Forward every paragraph that is finished and clean, keeping the last.
   *
   * The final partial paragraph is never released here, so `endCleanly` still
   * has something to trim at the end - which is what repairs an answer cut off
   * by its reply ceiling, the truncation half of this file's job.
   */
  function releaseCompleteParagraphs() {
    if (poisoned) return
    let cut = buffer.lastIndexOf('\n\n')
    if (cut < 0) return

    const complete = buffer.slice(0, cut + 2)
    const verdict = checkAnswerIntegritySync(releasedText + complete, systemPrompt, userMessage)
    // null is "cannot judge", not "clean" - hold, and the end-of-stream gate
    // will make the call with the database available.
    if (verdict === null) return
    if (verdict.length > 0) {
      // Nothing has left yet, so the turn can still roll to another leg. Say
      // nothing and let the end-of-stream gate throw with the full answer.
      if (!tokensSent) return
      poisoned = true
      console.warn(
        '[FALLBACK:INTEGRITY_MIDSTREAM] stopping the answer where it stands: ' +
        verdict.map(v => `${v.kind}(${v.detail})`).join(', '),
      )
      return
    }

    // Covers two different mechanisms with one check: `priorCarryText` is
    // what an EARLIER LEG released before failing over to this one;
    // `releasedText` is what THIS leg has already released across its own
    // internal auto-continuation cycles (gemini.ts/openai.ts/mistral.ts all
    // recurse on MAX_TOKENS within one leg, never touching fallbackChain's
    // carryText at all). A restart can come from either — observed live from
    // the intra-leg case specifically: no cross-leg handoff occurred, one
    // leg's own second cycle redrew the table its first cycle already wrote.
    const priorAnywhere = priorCarryText + releasedText
    if (priorAnywhere && looksLikeRestart(complete, priorAnywhere)) {
      poisoned = true
      console.warn('[FALLBACK:MID_STREAM_RESTART] a continuation (same leg or a handoff) ignored the instruction and restarted — stopping the answer where it stands')
      return
    }

    buffer = buffer.slice(cut + 2)
    releasedText += complete
    flushed = true
    tokensSent = true
    /**
     * Gated on the raw words, forwarded in house style.
     *
     * The scan above reads what the model actually wrote, so a rewrite can
     * never file the edge off the phrase the scan exists to catch - the same
     * ordering the end-of-stream path uses, and there is a test pinning it.
     * The rewrite has to happen HERE rather than at the end, because by then
     * this paragraph has already been read: `replaceBufferedText` is a no-op
     * once anything has left. Per-paragraph rewriting reaches the same result
     * as rewriting the whole answer, so the screen, the transcript and the
     * cache still agree.
     */
    // House style first, then the market-tier qualifier — the scan above read
    // the raw words, and both of these only ever add or reword a clause.
    const framedParagraph = rewriteFraming(complete).text
    const ungarbled = dropGarbled(framedParagraph)
    const measuredOnly = dropUnsourcedMeasurements(ungarbled.text, `${systemPrompt}\n${userMessage}`)
    const judged = dropUnsourcedJudgements(measuredOnly.text, systemPrompt)
    const priced = dropMisattributedPrices(judged.text, userMessage)
    const measured = { text: priced.text, dropped: [...ungarbled.dropped, ...measuredOnly.dropped, ...judged.dropped, ...priced.dropped] }
    if (measured.dropped.length) console.warn('[FALLBACK:MEASURE_DROPPED]', measured.dropped.map((d) => d.slice(0, 80)))
    forwardToken(qualifyMarketFigures(measured.text, systemPrompt).text)
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
    // A mid-stream violation ends the answer where it stands. Whatever is
    // still held — in `buffer` (the paragraph path) or `tail` (the
    // post-flush path a restart is usually caught in) — is dropped rather
    // than repaired: it is the part the gate objected to. This underestimates
    // by however much the adapter kept generating after poisoning without
    // bufferedSend ever seeing it tracked anywhere (the `if (poisoned) return`
    // above drops those tokens outright) — the caller corrects for that using
    // `getReleasedText()` against the adapter's own full return value, which
    // is exact where this count is only approximate.
    if (poisoned) {
      const dropped = buffer.length + tail.length
      buffer = ''
      tail = ''
      endStripper()
      return { trimmedChars: dropped }
    }

    if (releaseByParagraph && flushed) {
      // The held partial paragraph is the only thing left, and it is where a
      // reply ceiling cuts, so it gets the same end repair the tail used to.
      //
      // It is also where a restart lands almost every time: the model's
      // fresh table header arrives as the FINAL, never-newline-terminated
      // paragraph, because the stream simply ends (naturally or on failure)
      // before a second `\n\n` ever completes it — so `releaseCompleteParagraphs`
      // above, which only inspects completed paragraphs, never sees it.
      // Checked here first, before any attempt to repair a ragged edge that
      // was never a ragged edge — it was a whole second answer starting over.
      const priorAnywhere = priorCarryText + releasedText
      if (priorAnywhere && buffer.length > 0 && looksLikeRestart(buffer, priorAnywhere)) {
        const dropped = buffer.length
        console.warn('[FALLBACK:MID_STREAM_RESTART] final held-back paragraph was a restart, not a continuation — dropped')
        buffer = ''
        endStripper()
        return { trimmedChars: dropped }
      }

      let trimmed = 0
      if (buffer.length > 0) {
        const cleaned = endCleanly(buffer, { maxTrimChars: buffer.length })
        trimmed = buffer.length - cleaned.length
        if (trimmed > 0) {
          console.log(`[CHAT:TRUNCATED_TAIL] dropped ${trimmed} dangling chars before they reached the buyer`)
        }
        if (cleaned.length > 0) forwardToken(cleaned)
        buffer = ''
      }
      endStripper()
      return { trimmedChars: trimmed }
    }

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
  let stripperEnded = false
  function endStripper() {
    if (!stripper || stripperEnded) return
    stripperEnded = true
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

  return {
    bufferedSend,
    getTokensSent: () => tokensSent,
    getReleasedText: () => totalForwarded,
    getPoisoned: () => poisoned,
    flushRemaining,
    replaceBufferedText,
    /**
     * Sends what the table stripper still holds. `totalForwarded` counts text
     * from the moment it enters the stripper, so a leg that failed before its
     * stream ended left that text unsent while the next leg continued from it:
     * the buyer read an answer starting mid-sentence ("bottlenecks.", transcript
     * rerun 5, 17 Oct 2026).
     */
    drainPending: endStripper,
  }
}

export async function executeWithFallbackChain(options: FallbackChainOptions): Promise<FallbackChainResult> {
  if (isLlmStubbed()) {
    emitStubbedModelCall({ systemPrompt: options.systemPrompt, messages: options.messages })
    // Replay only: every provider down, so the turn takes the real no-model path.
    if (process.env.LLM_STUB_MODE === 'outage') return endWithoutModel(options, '')
    options.send('token', { token: LLM_STUB_ANSWER })
    return { text: LLM_STUB_ANSWER, provider: 'stub', model: 'stub', envKey: 'LLM_STUB', is_verified: false }
  }
  const {
    systemPrompt,
    messages,
    send,
    onToolCall,
    groqFallbackSuffix = '',
    projects = [],
    userMessage = '',
    userId,
    sessionId,
    guestToken,
    focusProjectId,
    chainConfig = FALLBACK_CHAIN,
    traceId,
  } = options

  // Feature flag: disable Gemini fallback if disabled (defaults to enabled)
  const enableGeminiFallback = env.ENABLE_GEMINI_FALLBACK === 'true'
  const effectiveChainConfig = BENCH_ONLY_LEG
    ? chainConfig.filter(item => item.label === BENCH_ONLY_LEG)
    : enableGeminiFallback
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

  const turnStartedAt = Date.now()
  /** Vendors that produced an empty answer for THIS prompt. */
  const emptyVendors = new Set<string>()
  /**
   * Text already streamed to the buyer this turn by a leg that then failed
   * mid-stream. Handed to the next leg as its own prior turn, so the buyer
   * sees one continuous answer instead of a truncation notice — see the
   * `tokensSent` catch branch below.
   */
  let carryText = ''
  let continuations = 0
  /** Mutated when a mid-stream failure hands off to the next leg. */
  let turnMessages = cappedMessages
  const MID_STREAM_CONTINUE_INSTRUCTION =
    'The message above is YOUR OWN answer, cut off mid-way through by a length limit — not something to react to or start over. ' +
    'Continue writing the rest of it, picking up from the exact word or sentence it ended on. ' +
    'Do NOT restart from the beginning, do NOT redraw any table you already started (a partial row is still your table — extend it, never rebuild it), ' +
    'do not repeat anything already written, do not restate the question, and do not mention that you were interrupted.'

  const rootTrace = sessionId
    ? turnTrace(
        // Same id as `recordChatTurn` closes when `traceId` is supplied —
        // the router always supplies it. This attaches the model legs and tool
        // spans to the turn as it runs; `recordChatTurn` lands the final answer
        // on the same trace afterwards.
        traceId ?? `chat-${sessionId}-${turnStartedAt}`,
        {
          sessionId,
          userId: userId || undefined,
          // No input here: recordChatTurn puts the buyer's message on this same
          // trace once. Sending it from every layer stored it four times a turn.
          tags: ['fallback_chain'],
          metadata: {
            messagesCount: messages.length,
            chat_session_id: sessionId,
            guest_token: guestToken || undefined,
            focus_project_id: focusProjectId || undefined,
          },
        },
      )
    : null

  const wrappedOnToolCall: ToolCallFn = async (name: string, args: Record<string, unknown>) => {
    let toolSpan: any = null
    const toolStart = Date.now()
    if (rootTrace) {
      try {
        toolSpan = rootTrace.span({
          name: `tool:${name}`,
          input: args,
        })
      } catch {
              // Telemetry only. A Langfuse span that fails to open must never
              // interrupt the answer the buyer is waiting on.
            }
    }
    try {
      const res = await onToolCall(name, args)
      if (toolSpan) {
        try {
          toolSpan.end({
            output: res,
            metadata: { latency_ms: Date.now() - toolStart },
          })
        } catch {
                // Telemetry only. A Langfuse span that fails to open must never
                // interrupt the answer the buyer is waiting on.
              }
      }
      return res
    } catch (err: any) {
      if (toolSpan) {
        try {
          toolSpan.end({
            level: 'ERROR',
            statusMessage: err?.message || String(err),
            metadata: { latency_ms: Date.now() - toolStart },
          })
        } catch {
                // Telemetry only. A Langfuse span that fails to open must never
                // interrupt the answer the buyer is waiting on.
              }
      }
      throw err
    }
  }

  /** Leg indexes already started by a race, so the loop does not start them again. */
  const usedLegs = new Set<number>()

  /**
   * Everything one provider attempt needs, self-contained so two can run at
   * once. Output goes through `gate`, which a race narrows to its winner.
   */
  const openLeg = (leg: FallbackKeyConfig, legIdx: number) => {
    const legApiKey = process.env[leg.envKey] as string
    const prompt = options.buildSystemPrompt
      ? stripMarker(options.buildSystemPrompt(leg.supportsTools))
      : leg.supportsTools
        ? stripMarker(systemPrompt)
        : applyNoToolsBlock(systemPrompt, groqFallbackSuffix)
    warmKnownNames()
    warmProjectPrices()
    let gate: SendFn = send
    const buffered = createBufferedSend(
      (event, data) => gate(event, data),
      prompt,
      Number.MAX_SAFE_INTEGER,
      options.suppressTables === true,
      PARAGRAPH_STREAMING,
      carryText,
      [options.userMessage, options.buyerStated].filter(Boolean).join('\n'),
    )

    const effectiveConfig = options.config || { maxTokens: 3000 }
    // Gemini ignores its FALLBACK_CHAIN item.model unless we thread it through here.
    const legMaxTokens =
      isFreeTierKey(leg.envKey)
        ? Math.min(effectiveConfig.maxTokens ?? 1500, FREE_TIER_MAX_TOKENS)
        : effectiveConfig.maxTokens
    // The profile's model only applies to the provider it was chosen for.
    const profileModel =
      effectiveConfig.model && /^gemini/i.test(effectiveConfig.model) ? effectiveConfig.model : undefined
    /** Filled by streamWithGemini with the counts the provider reported. */
    const legUsage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0 }
    const geminiConfig = {
      ...effectiveConfig,
      model: profileModel ?? leg.model,
      ...(leg.apiVersion ? { apiVersion: leg.apiVersion } : {}),
      usageOut: legUsage,
    }
    // A free-tier key is limited by tokens per minute and requests per day.
    if (isFreeTierKey(leg.envKey)) {
      geminiConfig.thinkingBudget = 0
      geminiConfig.maxTokens = Math.min(geminiConfig.maxTokens ?? 1500, FREE_TIER_MAX_TOKENS)
    }
    const effectiveModel = leg.provider === 'gemini' ? geminiConfig.model : leg.model
    const legStart = Date.now()
    let legSpan: any = null
    if (rootTrace) {
      try {
        legSpan = rootTrace.generation({
          name: `llm_call:${leg.provider}:${effectiveModel}`,
          model: effectiveModel,
          // The buyer's message is on the trace; the leg records only its shape.
          input: { messagesCount: turnMessages.length },
          metadata: { provider: leg.provider, envKey: leg.envKey, supportsTools: leg.supportsTools, turnIndex: legIdx },
        })
      } catch {
        // Telemetry only. A Langfuse span that fails to open must never
        // interrupt the answer the buyer is waiting on.
      }
    }

    /** The provider's first text chunk: Langfuse's time to first token, the bench's, and the race's winner. */
    let firstChunkAt: number | null = null
    const onFirstChunk: Array<() => void> = []
    const legSend: SendFn = (event, data) => {
      if (firstChunkAt == null && event === 'token') {
        firstChunkAt = Date.now()
        try { legSpan?.update({ completionStartTime: new Date(firstChunkAt) }) } catch { /* telemetry only */ }
        for (const f of onFirstChunk) f()
      }
      return buffered.bufferedSend(event, data)
    }
    const emitLeg = (ok: boolean, error?: string) => legEvents.emit('leg', {
      label: leg.label, ok, firstChunkMs: firstChunkAt == null ? null : firstChunkAt - legStart, totalMs: Date.now() - legStart, error,
    } satisfies LegEvent)

    const call = async (abortSignal?: AbortSignal): Promise<string> => {
      if (FAULT_BLOCK_VENDOR && vendorOf(leg) === FAULT_BLOCK_VENDOR) {
        return new Promise<string>((_, reject) => {
          const stop = () => reject(new Error(`${leg.label} blocked by fault injection`))
          if (abortSignal?.aborted) return stop()
          abortSignal?.addEventListener('abort', stop, { once: true })
          setTimeout(stop, Number(process.env.OPENAI_INITIAL_TOKEN_TIMEOUT_MS ?? 8_000))
        })
      }
      if (process.env.DEBUG_FALLBACK) {
        console.log(`[FALLBACK:TRY] → ${leg.label} | Model: ${effectiveModel} | Tools: ${leg.supportsTools}`)
      }
      let text = ''
      if (leg.provider === 'mistral') {
        text = await streamWithMistral(prompt, turnMessages, legSend, legApiKey, userId, sessionId, legMaxTokens)
      } else if (leg.provider === 'gemini') {
        text = await streamWithGemini(prompt, turnMessages, legSend, wrappedOnToolCall, { ...geminiConfig, abortSignal }, legApiKey, userId, sessionId)
        if (!text.trim() && !buffered.getTokensSent() && geminiConfig.tools !== false && !abortSignal?.aborted) {
          console.warn(`[FALLBACK:RETRY_NO_TOOLS] ${leg.label} returned no text with tools — retrying the same key without them`)
          text = await streamWithGemini(prompt, turnMessages, legSend, wrappedOnToolCall, { ...geminiConfig, tools: false, abortSignal }, legApiKey, userId, sessionId)
        }
      } else if (leg.provider === 'openai') {
        text = await streamWithOpenAI(
          prompt,
          turnMessages,
          legSend,
          wrappedOnToolCall,
          {
            ...effectiveConfig,
            model: leg.model,
            abortSignal,
            ...(vendorOf(leg) === 'groq' ? { maxTokens: groqReplyCeiling(effectiveConfig.maxTokens) } : {}),
          },
          userId,
          sessionId,
          legApiKey,
          leg.baseUrl,
        )
      } else if (leg.provider === 'groq') {
        text = await streamWithGroq(prompt, turnMessages, legSend, userId, sessionId, legApiKey, legMaxTokens)
      }
      return text
    }

    return {
      item: leg, idx: legIdx, effectivePrompt: prompt, legUsage, effectiveModel, legStart,
      get legSpan() { return legSpan },
      ...buffered, emitLeg, call, onFirstChunk,
      hasSpoken: () => firstChunkAt != null,
      setGate: (g: SendFn) => { gate = g },
    }
  }
  type Leg = ReturnType<typeof openLeg>

  /** The next leg a race may start: another vendor, a key, not cooling, within budget. */
  const pickHedge = (fromIdx: number, primary: FallbackKeyConfig): number | null => {
    if (!(HEDGE_MS > 0) || BENCH_ONLY_LEG) return null
    for (let j = fromIdx + 1; j < effectiveChainConfig.length; j++) {
      const leg = effectiveChainConfig[j]
      if (usedLegs.has(j) || vendorOf(leg) === vendorOf(primary)) continue
      if (needsALookup && !leg.supportsTools) continue
      if (emptyVendors.has(vendorOf(leg)) || !process.env[leg.envKey]) continue
      if (isCoolingDown(`${leg.envKey}:${leg.model}`) || wouldExceed(leg.envKey, vendorOf(leg))) continue
      return j
    }
    return null
  }

  /**
   * Runs the primary leg; if it has not spoken after HEDGE_MS, starts the hedge
   * leg too. The first to speak wins: its output reaches the buyer, the other is
   * aborted and its output dropped. Nothing is forwarded before a first chunk,
   * so the loser has shown nothing. Resolves with the winning leg and its text;
   * rejects with the primary's error when it fails before the hedge starts (the
   * loop then rolls over as before), or when both fail.
   */
  const raceLegs = (primary: Leg, hedgeIdx: number) => new Promise<{ leg: Leg; text: string }>((resolve, reject) => {
    let winner: Leg | null = null
    let hedge: Leg | null = null
    let primaryErr: unknown = null
    let hedgeErr: unknown = null
    let settled = false
    const primaryAbort = new AbortController()
    const hedgeAbort = new AbortController()
    const finish = (fn: () => void) => { if (!settled) { settled = true; fn() } }
    const lose = (leg: Leg, abort: AbortController) => {
      abort.abort()
      leg.emitLeg(false, 'lost the race')
      try { leg.legSpan?.end({ statusMessage: 'lost the race', metadata: { latency_ms: Date.now() - leg.legStart } }) } catch { /* telemetry only */ }
    }
    const win = (leg: Leg) => {
      if (winner) return
      winner = leg
      if (leg === primary && hedge) lose(hedge, hedgeAbort)
      if (leg !== primary) {
        console.warn(`[FALLBACK:RACE] ${leg.item.label} spoke first; aborting ${primary.item.label}`)
        lose(primary, primaryAbort)
      }
    }
    // Before a winner the primary's non-text events (status) still pass; the hedge's never do.
    primary.setGate((e, d) => (winner === primary || (winner === null && e !== 'token') ? send(e, d) : undefined))
    primary.onFirstChunk.push(() => win(primary))

    const startHedge = () => {
      if (hedge || winner || settled) return
      const leg = effectiveChainConfig[hedgeIdx]
      usedLegs.add(hedgeIdx)
      recordAttempt(leg.envKey)
      const h = openLeg(leg, hedgeIdx)
      hedge = h
      console.warn(`[FALLBACK:RACE] ${primary.item.label} silent after ${HEDGE_MS}ms; starting ${leg.label} alongside`)
      h.setGate((e, d) => (winner === h ? send(e, d) : undefined))
      h.onFirstChunk.push(() => win(h))
      h.call(hedgeAbort.signal).then(
        (text) => {
          if (winner === h || (winner === null && primaryErr)) { win(h); finish(() => resolve({ leg: h, text })) }
          else if (winner === null && !text.trim()) hedgeErr = new Error(`${leg.label} returned no text`)
        },
        (err) => {
          hedgeErr = err
          if (winner === h) finish(() => reject(err))
          else if (winner === null && primaryErr) finish(() => reject(primaryErr))
        },
      )
    }
    const timer = setTimeout(startHedge, HEDGE_MS)

    primary.call(primaryAbort.signal).then(
      (text) => {
        clearTimeout(timer)
        if (winner && winner !== primary) return
        // Silent and empty while the hedge is still going: let the hedge answer.
        if (!winner && !text.trim() && hedge && !hedgeErr) { primaryErr = new Error(`${primary.item.label} returned no text`); return }
        win(primary)
        finish(() => resolve({ leg: primary, text }))
      },
      (err) => {
        clearTimeout(timer)
        primaryErr = err
        if (winner === primary || !hedge) return finish(() => reject(err))
        if (hedgeErr) finish(() => reject(err))
        // else: the hedge is still running; it settles the race.
      },
    )
  })

  for (let chainIdx = 0; chainIdx < effectiveChainConfig.length; chainIdx++) {
    if (usedLegs.has(chainIdx)) continue
    let item = effectiveChainConfig[chainIdx]
    // Checked before the key and the cooldown, because it is a property of the
    // question rather than of this leg's configuration.
    if (needsALookup && !item.supportsTools) {
      console.log(
        `[FALLBACK:NO_LOOKUP] ${item.label} — skipping: the answer is a list of named projects, retrieval found none, and this leg cannot fetch any`,
      )
      continue
    }

    /**
     * Two guards on how far one turn may walk.
     *
     * The deadline bounds the worst case; the empty-vendor set bounds the
     * pointless one. When a vendor's leg returns NOTHING for this prompt, its
     * sibling legs are the same family answering the same prompt and return
     * nothing too — measured, both free Gemini legs, every time. Trying the
     * second spends two round-trips to learn what the first already said.
     */
    if (Date.now() - turnStartedAt > TURN_BUDGET_MS) {
      console.warn(`[FALLBACK:BUDGET] ${item.label} — not starting: ${Math.round((Date.now() - turnStartedAt) / 1000)}s already spent on this turn`)
      continue
    }
    if (emptyVendors.has(vendorOf(item))) {
      console.log(`[FALLBACK:SAME_VENDOR_EMPTY] ${item.label} — skipping: ${vendorOf(item)} already returned no text for this prompt`)
      continue
    }

    const apiKey = process.env[item.envKey]
    if (!apiKey) {
      console.log(`[FALLBACK:SKIP] ${item.label} (${item.envKey}) — no API key configured`)
      continue
    }

    // Skip a leg that recently failed for a reason retrying cannot fix — an
    const skipKey = `${item.envKey}:${item.model}`
    if (!BENCH_ONLY_LEG && isCoolingDown(skipKey)) {
      console.log(`[FALLBACK:COOLDOWN] ${item.label} — skipping: ${cooldownReason(skipKey)}`)
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
    if (!BENCH_ONLY_LEG && wouldExceed(item.envKey, vendor)) {
      console.log(
        `[FALLBACK:RATE_BUDGET] ${item.label} — skipping: ${limitFor(vendor)} req/min already used on ${item.envKey}`,
      )
      continue
    }
    recordAttempt(item.envKey)

    // Every leg is held back until checkAnswerIntegrity has read each paragraph
    // (see createBufferedSend); openLeg builds that buffer for one attempt.
    let leg = openLeg(item, chainIdx)
    let { effectivePrompt, getTokensSent, getReleasedText, getPoisoned, flushRemaining, replaceBufferedText, drainPending, legUsage, effectiveModel, legStart, emitLeg } = leg
    let legSpan = leg.legSpan
    let cooldownKey = `${item.envKey}:${item.model}`

    try {
      let text = ''
      const hedgeIdx = pickHedge(chainIdx, item)
      if (hedgeIdx == null) {
        text = await leg.call()
      } else {
        const won = await raceLegs(leg, hedgeIdx)
        text = won.text
        if (won.leg !== leg) {
          // The rest of this leg's handling (integrity gate, flush, success
          // bookkeeping, a mid-stream hand-off) now belongs to the winner.
          leg = won.leg
          item = leg.item
          ;({ effectivePrompt, getTokensSent, getReleasedText, getPoisoned, flushRemaining, replaceBufferedText, drainPending, legUsage, effectiveModel, legStart, emitLeg } = leg)
          legSpan = leg.legSpan
          cooldownKey = `${item.envKey}:${item.model}`
        }
      }

      // The generation is closed once: on success below (with the provider's
      // own usage), or in the catch on failure. Closing it here as well sent
      // every leg twice.

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
        const violations = await checkAnswerIntegrity(text, effectivePrompt, [options.userMessage, options.buyerStated].filter(Boolean).join('\n'))
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
        const ungarbled = dropGarbled(text)
        const measuredOnly = dropUnsourcedMeasurements(ungarbled.text, [systemPrompt, options.userMessage, options.buyerStated].filter(Boolean).join('\n'))
        const judged = dropUnsourcedJudgements(measuredOnly.text, systemPrompt)
        const priced = dropMisattributedPrices(judged.text, [options.userMessage, options.buyerStated].filter(Boolean).join(' '))
        const measured = { text: priced.text, dropped: [...ungarbled.dropped, ...measuredOnly.dropped, ...judged.dropped, ...priced.dropped] }
        if (measured.dropped.length) {
          console.warn(`[FALLBACK:MEASURE_DROPPED] ${item.label}`, measured.dropped.map((d) => d.slice(0, 80)))
          replaceBufferedText(measured.text)
          text = measured.text
        }
        const qualified = qualifyMarketFigures(text, systemPrompt)
        if (qualified.qualified > 0) {
          console.log(`[FALLBACK:MARKET_QUALIFIED] ${item.label} — ${qualified.qualified} unverified rate claim(s) labelled`)
          replaceBufferedText(qualified.text)
          text = qualified.text
        }
      }

      let { trimmedChars } = flushRemaining()
      // A restart poisoning that fires from the post-flush tail path (the
      // common case — see createBufferedSend) can only count what bufferedSend
      // still held at that moment; the adapter itself keeps generating past
      // it, and none of those extra tokens were ever tracked in `buffer` or
      // `tail`. The adapter's own returned `text` has all of it, so once
      // poisoned, prefer the exact gap between that and what actually reached
      // the client over the approximate count `flushRemaining` returned.
      if (getPoisoned()) {
        const exact = text.length - getReleasedText().length
        if (exact > trimmedChars) trimmedChars = exact
      }

      // An empty string is a failed turn, not a successful one.
      if (!text.trim() && !getTokensSent()) {
        // Its siblings will do the same on this prompt — see the guard at the
        // top of the loop.
        emptyVendors.add(vendorOf(item))
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

      // Close Langfuse generation span on success
      if (legSpan) {
        try {
          legSpan.end({
            output: text,
            usage: {
              // Reported by the provider where we have it; estimated only when
              // the leg gives us nothing to read.
              promptTokens: legUsage.promptTokens || undefined,
              completionTokens: legUsage.completionTokens || Math.ceil(text.length / 4),
            },
            // Same price table as AiUsageEvent, and only from provider-reported
            // usage: an estimated cost would read as a measured one.
            ...(legUsage.promptTokens > 0 && legUsage.completionTokens > 0
              ? {
                  costDetails: {
                    total: priceFor(effectiveModel, legUsage.promptTokens, legUsage.completionTokens, legUsage.cachedTokens),
                  },
                }
              : {}),
            metadata: {
              latency_ms: Date.now() - legStart,
              tokens_sent: getTokensSent(),
              // Measured, not inferred from the feature flag. This read
              // `GEMINI_EXPLICIT_CACHE === 'true'` — a constant — so the
              // dashboard showed a 100% hit rate on a free-tier key that
              // reports `cachedContentTokenCount: 0` on every single call.
              cached_prompt_tokens: legUsage.cachedTokens,
              cache_hit: legUsage.cachedTokens > 0,
              explicit_cache_enabled: process.env.GEMINI_EXPLICIT_CACHE === 'true',
              provider: item.provider,
              model: effectiveModel,
              envKey: item.envKey,
              turn_index: chainIdx,
              session_id: sessionId || null,
              guest_token: options.guestToken || null,
              focus_project_id: options.focusProjectId || null,
            },
          })
        } catch {
                // Telemetry only. A Langfuse span that fails to open must never
                // interrupt the answer the buyer is waiting on.
              }
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
      }

            // Answered — trust this leg again immediately, in case an earlier
      // durable failure was resolved (billing topped up, quota window reset).
      recordSuccess(cooldownKey)
      // Still open, and smaller than it was: if the join between what
      // carryText ended on and this leg's first token glues two words
      // together, it is not repaired here — fixing it needs injecting a
      // space into the live stream independently of the space the RETURNED
      // `text` needs, two different accumulations of the same generation in
      // two different call frames. The bigger half of this — a continuation
      // ignoring the handoff and restarting the whole answer instead — WAS
      // observed live (comparison lane, reproduced twice) and is now caught
      // by `looksLikeRestart` inside `createBufferedSend`: a restart is
      // poisoned the same way an integrity violation is, so the buyer sees
      // the answer stop cleanly rather than a duplicated, confusing table.
      emitLeg(true)
      return {
        text: carryText ? carryText + beautified : beautified,
        provider: item.provider,
        model: item.model,
        envKey: item.envKey,
        is_verified: false,
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      const tokensSent = getTokensSent() || (err as any)?.tokensSent === true
      const errMsg = error.message || String(err)
      emitLeg(false, errMsg.slice(0, 200))

      if (legSpan) {
        try {
          legSpan.end({
            level: 'ERROR',
            statusMessage: errMsg,
            metadata: {
              latency_ms: Date.now() - legStart,
              provider: item.provider,
              model: effectiveModel,
            },
          })
        } catch {
                // Telemetry only. A Langfuse span that fails to open must never
                // interrupt the answer the buyer is waiting on.
              }
      }

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
      //
      // The old fix here gave up — "cannot switch providers mid-stream" — but
      // that conflated two different things. The HTTP response and its headers
      // are already committed, yes; but the client is just reading a stream of
      // `token` events on that one open connection, with no idea which
      // provider produced any of them. So the next leg can simply keep
      // appending to the same message: hand it what was already shown as its
      // own prior turn, plus an instruction to continue, and let it pick up
      // where the dead leg left off. The buyer sees one answer keep typing,
      // not a stall followed by an apology.
      if (tokensSent) {
        // What this leg released must be on screen before anyone continues it.
        drainPending()
        const releasedSoFar = getReleasedText()
        const hasMoreLegs = chainIdx < effectiveChainConfig.length - 1
        // Two hand-offs at most: each passes a half-answer to a weaker leg, and after
        // five in transcript rerun 7 (17 Oct 2026) the last legs emitted digit-
        // scrambled prices and our own prompt labels. Stop on the clean text.
        if (hasMoreLegs && releasedSoFar.trim() && continuations < 2) {
          continuations++
          console.warn(
            `[FALLBACK:MID_STREAM_CONTINUE] ${item.label} failed after ${releasedSoFar.length} chars sent — ` +
            `handing off to the next leg to finish this answer`,
          )
          carryText += releasedSoFar
          turnMessages = [
            ...turnMessages,
            { role: 'assistant', content: releasedSoFar },
            { role: 'user', content: MID_STREAM_CONTINUE_INSTRUCTION },
          ]
          continue
        }
        // No leg left to try, or nothing usable was shown yet — same behavior
        // as before: say so plainly rather than leave the answer hanging.
        console.error(`[FALLBACK:MID_STREAM_STALL] ${item.label} stalled mid-stream with no leg left to continue on`)
        const truncationNotice = '\n\n[Response truncated due to high traffic. Please ask me to continue.]'
        send('token', { token: truncationNotice })
        return {
          text: carryText + truncationNotice,
          provider: 'database',
          model: 'fallback',
          envKey: 'FALLBACK_MODE',
          is_verified: true,
        }
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
  // Shared with chipPolicy, which has to recognise this text to suppress
  // shortcuts on an outage turn. See lib/ai/outageNotice.ts.
  return endWithoutModel(options, carryText)
}

/** Every leg failed (or the stub says so): the stored-rows answer when there is one, else the notice. */
async function endWithoutModel(options: FallbackChainOptions, carryText: string): Promise<FallbackChainResult> {
  const { send } = options
  const fromRows = options.answerFromRows ? await Promise.resolve(options.answerFromRows()).catch(() => null) : null
  if (fromRows != null) {
    console.warn(`[FALLBACK:ROWS_ANSWER] every leg failed; answered from stored rows (${fromRows.length} chars)`)
    // A half-written model reply is replaced, exactly as the notice would replace it.
    if (fromRows) send('token', carryText ? { token: fromRows, replace: true } : { token: fromRows })
    // Degraded all the same: no model read the question, so it is never cached as an advisory answer.
    return { text: fromRows, provider: 'database', model: 'rows', envKey: 'ROWS_FALLBACK', is_verified: false, degraded: true }
  }
  const fallbackMessage = OUTAGE_NOTICE

  // A leg that died mid-reply left part of an answer on screen ("The EMI would
  // be ₹1,02,108 per month." then the notice). Nothing finished it, so retract it.
  send('token', outageTokenEvent(Boolean(carryText)))
  // `is_verified: false`. Every leg failed; nothing about this reply was verified
  // against anything, and the flag travels — it is what made the answer cache log
  // an outage notice as a "verified advisory response" when it stored one.
  return { text: fallbackMessage, provider: 'database', model: 'fallback', envKey: 'FALLBACK_MODE', is_verified: false, degraded: true }
}
