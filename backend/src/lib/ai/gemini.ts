// backend/src/lib/ai/gemini.ts
import { createHash } from 'crypto'
import { getCachedPrefix } from './geminiCache'
import { assertWithinGeminiBudget } from './geminiMeter'
import { splitSystemPrompt } from './prompts/base'
import { GoogleGenAI } from '@google/genai'
import { MODELS, GEMINI_TOOLS_ENABLED } from '../config'
import { toGeminiTools, validateToolArgs, capToolResult } from './tools'
import { INFERENCE_DEFAULTS, type InferenceConfig } from './openai'
import { recordUsage } from './cost'
import { endsRagged } from './endsRagged'

type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null }
type SendFn = (event: string, data: Record<string, unknown>) => void
type ToolCallFn = (name: string, args: Record<string, unknown>) => Promise<unknown>

const MAX_TOOL_CYCLES = 3

/**
 * A reply ceiling ends generation mid-thought as often as mid-word, and until
 * now nothing here noticed: `finishReason` was never read, so a MAX_TOKENS cut
 * looked identical to a clean STOP. `endCleanly` downstream only tidies the
 * ragged edge of whatever came back — it cannot tell "stopped because the
 * sentence ended" from "stopped because the budget ran out mid-list" and was
 * never meant to.
 *
 * On MAX_TOKENS, feed the partial answer back as the model's own turn and ask
 * it to continue — the same mechanism already used for a tool-call round-trip,
 * just keyed on a different reason to keep going. Bounded so a model that
 * never reaches STOP cannot loop forever.
 */
const MAX_TOKEN_CONTINUATIONS = Number(process.env.GEMINI_MAX_CONTINUATIONS ?? 5)
const CONTINUE_INSTRUCTION =
  'Your previous message was cut off by a length limit, possibly mid-word. First finish the exact word or sentence it ended on if it was incomplete, then continue the rest of your answer. Do not repeat anything you already said, do not restate the question, and do not mention that you were interrupted.'

// How long to wait for the FIRST chunk before giving up on this leg, and how
const INITIAL_TOKEN_TIMEOUT_MS = Number(process.env.GEMINI_INITIAL_TOKEN_TIMEOUT_MS ?? 25_000)
const STREAM_INACTIVITY_MS = Number(process.env.GEMINI_STREAM_INACTIVITY_MS ?? 20_000)

/** Ceiling on tokens the model may spend thinking before it must start writing. */
const THINKING_BUDGET_TOKENS = Number(process.env.GEMINI_THINKING_BUDGET ?? 1024)
// Smallest budget gemini-3.5-flash-lite accepts; 0 is a 400 INVALID_ARGUMENT.
const MIN_THINKING_BUDGET_TOKENS = Number(process.env.GEMINI_MIN_THINKING_BUDGET ?? 128)

// Thrown when the stream stalls (no chunk within timeout) or produces nothing.
export class GeminiStreamStallError extends Error {
  tokensSent: boolean
  constructor(message: string, tokensSent: boolean) {
    super(message)
    this.name = 'GeminiStreamStallError'
    this.tokensSent = tokensSent
  }
}

// Accumulated token usage across all tool cycles of one streamWithGemini call.
interface GeminiUsage {
  promptTokens: number
  completionTokens: number
  cachedTokens: number
}

// Gemini's `contents` shape only knows 'user' and 'model' roles — system prompt
// goes in systemInstruction separately, and our 'tool' role turns are injected
// directly as functionResponse parts by the tool-call cycle below, not via this map.
interface GeminiContent {
  role: 'user' | 'model'
  parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }>
}

export function toGeminiContents(messages: Message[]): GeminiContent[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content ?? '' }],
    }))
}

export async function streamWithGemini(
  system: string,
  messages: Message[],
  send: SendFn,
  onToolCall: ToolCallFn,
  config: InferenceConfig = INFERENCE_DEFAULTS,
  apiKeyOverride?: string,
  userId?: string | null,
  sessionId?: string | null,
): Promise<string> {
  const apiKey = apiKeyOverride ?? process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('No GEMINI_API_KEY configured')
  // The day-budget gate. Throwing here rolls the turn onto the next provider in
  // the chain exactly as any other Gemini failure would, so an exhausted budget
  // degrades to Mistral rather than to an error page.
  await assertWithinGeminiBudget()
  const client = new GoogleGenAI({
    apiKey,
    // Unset on the paid legs so the SDK picks v1beta, where thinking budgets
    // and tool calling live. Pinned only where a leg has deliberately traded
    // those away for the stable surface — see FallbackKeyConfig.apiVersion.
    ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
    httpOptions: { timeout: STREAM_INACTIVITY_MS },
  })
  const contents: GeminiContent[] = toGeminiContents(messages)

  // The prompt splits into a byte-identical head and a per-turn tail. Only the
  // head is worth caching; caching the whole thing would mint an entry per
  // tool-filter variant and hit almost none of them.
  const { head: systemHead, tail: systemTail } = splitSystemPrompt(system)
  /**
   * The cacheable head, fingerprinted.
   *
   * This once measured 0% cacheable: three lanes produced heads of 25,193,
   * 10,534 and 9,342 characters whose longest common prefix was SEVENTEEN
   * characters — "You are RealtyPal". That is fixed; the head is now
   * byte-identical across turns and `promptPrefixStability.test.ts` fails the
   * build if a per-turn value is spliced back into it.
   *
   * The flag stays as the way to confirm it in a live process:
   * `DEBUG_PROMPT_STABILITY=1` and compare hashes across turns — one repeated
   * hash means caching can engage.
   */
  if (process.env.DEBUG_PROMPT_STABILITY) {
    const h = createHash('sha1').update(systemHead).digest('hex').slice(0, 12)
    console.log('[PROMPT_HEAD_HASH]', h, 'headChars=' + systemHead.length, 'tailChars=' + systemTail.length, '|', JSON.stringify(systemHead.slice(0, 46)))
  }
  /**
   * Gemini refuses `systemInstruction` AND `tools` in a request that carries
   * `cachedContent` — the cached resource owns both. The old condition read
   * `!GEMINI_TOOLS_ENABLED && !systemTail`, which meant caching was impossible
   * in the configuration we actually run: tools are on, and the tail is
   * non-empty by design on every turn. So the ~25k-character head was re-billed
   * at full input rate on all four Gemini legs, every turn.
   *
   * Both restrictions are addressable rather than fatal:
   *   - tools move INTO the cached resource (CreateCachedContentConfig.tools)
   *   - the per-turn tail moves out of systemInstruction and into `contents`
   *     as a leading user turn, which is billed as ordinary input either way
   *
   * Gated on GEMINI_EXPLICIT_CACHE because the second point changes where the
   * model reads its per-turn instructions from, and that is a behaviour change
   * to a chat with a long routing-regression history. Off = byte-for-byte the
   * previous path.
   */
  const toolsDeclared = GEMINI_TOOLS_ENABLED && config.tools !== false
  const cachedName = await getCachedPrefix(
    client,
    config.model || MODELS.GEMINI_MAIN,
    apiKey,
    systemHead,
    toolsDeclared ? (toGeminiTools() as unknown[]) : undefined,
  )
  // With a cache in play the head lives server-side and must NOT be resent.
  const effectiveSystem = cachedName ? '' : system
  if (cachedName && systemTail) {
    // Prepended, not appended: the tail is instruction, and it has to be read
    // before the conversation it applies to.
    contents.unshift({ role: 'user', parts: [{ text: systemTail }] })
  }
  let fullText = ''
  /** Persists across the recursive runCycle calls a continuation makes. */
  let continuationsUsed = 0
  /** Set right before a continuation's recursive call, read at its first token. */
  let justContinued = false
  const usage: GeminiUsage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0 }
  let billedModel = config.model || MODELS.GEMINI_MAIN
  // Per-turn where the caller has chosen one, module default otherwise.
  /**
   * Per-turn where the caller has chosen one, module default otherwise —
   * floored at what the model will actually accept.
   *
   * `thinkingBudget: 0` is rejected by gemini-3.5-flash-lite with a bare
   * `400 INVALID_ARGUMENT`; 128 is the smallest value it takes. The free-tier
   * clamp in `fallbackChain` asks for 0, and that was survivable only because
   * this value was computed and then never used — both fields below read the
   * module constant instead. Plumbing it through without this floor turns a
   * silently-ignored setting into a 400 on every free-tier call.
   */
  const requestedThinking = config.thinkingBudget ?? THINKING_BUDGET_TOKENS
  const thinkingBudget = requestedThinking <= 0 ? MIN_THINKING_BUDGET_TOKENS : requestedThinking

  async function runCycle(cycle: number): Promise<string> {
    if (cycle >= MAX_TOOL_CYCLES) return fullText

    let tokensSentThisCycle = false
    let sawAnyChunk = false
    let stalled = false
    let inactivityTimer: NodeJS.Timeout | null = null
    const cycleUsage: GeminiUsage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0 }
    /** Just this cycle's text, so a continuation feeds back only its own turn. */
    let cycleText = ''
    let finishReason: string | undefined

    // The timer must abort the request, not just flip a flag: the flag was only
    const abortController = new AbortController()

    const resetInactivity = (isStreaming = false) => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      const timeoutMs = isStreaming ? STREAM_INACTIVITY_MS : INITIAL_TOKEN_TIMEOUT_MS
      inactivityTimer = setTimeout(() => {
        stalled = true
        console.warn(`[gemini] inactivity timeout cycle=${cycle} tokensSent=${tokensSentThisCycle} (after ${timeoutMs}ms)`)
        abortController.abort()
      }, timeoutMs)
    }
    resetInactivity(false)

    let functionCall: { name: string; args: Record<string, unknown> } | null = null
    /** The verbatim part Gemini emitted, carrying its thoughtSignature. */
    let functionCallPart: { functionCall?: any; thoughtSignature?: string } | null = null

    try {
      const genConfig: any = {
        ...(cachedName ? { cachedContent: cachedName } : {}),
        ...(effectiveSystem ? { systemInstruction: effectiveSystem } : {}),
        // maxOutputTokens is the budget for thinking AND text together, and
        // `thinkingBudget`, not the module constant.
        //
        // The local was computed from `config.thinkingBudget` on the line above
        // and then never read — both fields here used THINKING_BUDGET_TOKENS
        // directly. So `fallbackChain`'s free-tier clamp (`thinkingBudget = 0`,
        // the thing CLAUDE.md says stops thinking eating the whole output
        // budget) never reached the request, and neither did any per-turn
        // budget `inferenceProfile` picked. Every Gemini call thought for the
        // module default, and thinking bills at the output rate.
        maxOutputTokens: config.maxTokens + thinkingBudget,
        thinkingConfig: { thinkingBudget },
        abortSignal: abortController.signal,
      }

      /**
       * The declarations stay on the last cycle; only the permission to call
       * is withdrawn.
       *
       * Dropping `tools` entirely on the final cycle left a conversation whose
       * history carries `functionCall` and `functionResponse` parts being sent
       * to a request that declares no functions, and Gemini answers that with
       * nothing at all. Reproduced against the free-tier key with the real
       * catalogue: two `sector_projects` calls, then an empty string, which
       * `fallbackChain` reports as "returned no text" and rolls over — so both
       * free Gemini legs failed every tool-using turn, and with the billed legs
       * out of credit the chain fell to its tool-blind tail. That is the exact
       * condition CLAUDE.md warns produces invented projects.
       *
       * `mode: 'NONE'` keeps the declarations valid for the history while
       * making a further call impossible — which is what we want anyway, since
       * a call made on the last cycle has no later cycle to be read in.
       */
      if (toolsDeclared) {
        // When a cache is in play the declarations are already inside it and
        // resending them is rejected. `toolConfig` is a separate field and is
        // still set below — that matters, because the last-cycle mode:'NONE' is
        // what stops a tool-using conversation ending in an empty response.
        if (!cachedName) genConfig.tools = toGeminiTools()
        if (cycle >= MAX_TOOL_CYCLES - 1) {
          genConfig.toolConfig = { functionCallingConfig: { mode: 'NONE' } }
        }
      }

      const targetModel = config.model || MODELS.GEMINI_MAIN
      if (process.env.DEBUG_FALLBACK) {
        console.log(`[gemini] requesting model=${targetModel}`)
      }
      let stream: any
      try {
        stream = await client.models.generateContentStream({
          model: targetModel,
          contents,
          config: genConfig,
        })
      } catch (err: any) {
        if (stalled) throw err
        const errMsg = err?.message || String(err)
        if (errMsg.includes('404') || errMsg.includes('not found') || errMsg.includes('no longer available')) {
          const fallbackModel = targetModel === 'gemini-3.5-flash-lite' ? 'gemini-3.6-flash' : 'gemini-3.5-flash-lite'
          console.warn(`[gemini] Model '${targetModel}' failed (${errMsg.slice(0, 120)}...). Retrying with '${fallbackModel}'...`)
          // Restart the first-token clock: the retry is a fresh request, and the
          // dead model's latency should not be charged against its deadline.
          resetInactivity(false)
          stream = await client.models.generateContentStream({
            model: fallbackModel,
            contents,
            config: genConfig,
          })
          billedModel = fallbackModel
        } else {
          throw err
        }
      }

      for await (const chunk of stream) {
        sawAnyChunk = true
        resetInactivity(true)
        if (stalled) break

        // usageMetadata is populated on the final chunk; later chunks supersede
        // earlier ones for the same cycle, so overwrite-then-accumulate per cycle.
        const um = chunk.usageMetadata
        if (um) {
          cycleUsage.promptTokens = um.promptTokenCount ?? 0
          // Thoughts are billed at the output rate but are reported separately
          // from candidatesTokenCount, so leaving them out under-reported the
          // real cost of every turn.
          cycleUsage.completionTokens = (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0)
          cycleUsage.cachedTokens = um.cachedContentTokenCount ?? 0
        }

        let textParts = chunk.candidates?.[0]?.content?.parts
          ?.filter((p: any) => typeof p?.text === 'string')
          ?.map((p: any) => p.text)
          ?.join('') || ''

        if (textParts) {
          // A continuation resumes on a fresh request, so its first token can
          // land directly against whatever the cut-off cycle ended on — a
          // budget cut mid-word plus a continuation that (despite being asked
          // to finish the fragment) starts a new clause instead reads as one
          // glued-together non-word ("...in t" + "In established" = "tIn").
          // Cannot be trimmed after the fact — the cut-off half is already on
          // the buyer's screen — so the only fixable side is the join.
          if (justContinued) {
            justContinued = false
            if (/\w$/.test(fullText) && /^\w/.test(textParts)) textParts = ' ' + textParts
          }
          fullText += textParts
          cycleText += textParts
          tokensSentThisCycle = true
          send('token', { token: textParts })
        }

        const fr = chunk.candidates?.[0]?.finishReason
        if (fr) finishReason = fr

        const calls = chunk.functionCalls
        if (calls && calls.length > 0 && !functionCall) {
          functionCall = { name: calls[0].name!, args: (calls[0].args as Record<string, unknown>) ?? {} }
          // Keep the model's own part, not a reconstruction of it.
          functionCallPart =
            chunk.candidates?.[0]?.content?.parts?.find((p: any) => p?.functionCall) ?? null
        }
      }
    } catch (err) {
      // Our own timeout aborted the request — report it as a stall so callers
      // roll over to the next provider instead of treating it as a hard error.
      if (!stalled) throw err
    } finally {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      // Each tool cycle is a separate billed request — sum them.
      usage.promptTokens += cycleUsage.promptTokens
      usage.completionTokens += cycleUsage.completionTokens
      usage.cachedTokens += cycleUsage.cachedTokens
    }

    if (stalled) {
      throw new GeminiStreamStallError(`Gemini stream stalled — no chunk within timeout (${tokensSentThisCycle ? STREAM_INACTIVITY_MS : INITIAL_TOKEN_TIMEOUT_MS}ms)`, tokensSentThisCycle)
    }
    if (!sawAnyChunk) {
      throw new GeminiStreamStallError('Gemini stream produced no chunks', false)
    }

    /**
     * The budget ran out before the model reached STOP — OR it reports having
     * reached STOP and the text is obviously not finished anyway. Measured
     * live, 8 Sep: a free-tier answer stopped after 95 completion tokens,
     * trailing off on a bare "Would", with `finishReason` something other
     * than MAX_TOKENS — so this guard, gated on MAX_TOKENS alone, never saw
     * it. `endsRagged` is the same mid-word/mid-sentence check the corpus
     * grader uses; whatever reason a provider reports, an answer trailing off
     * on a bare word or an unterminated clause is not finished.
     */
    const looksUnfinished = finishReason === 'MAX_TOKENS' || endsRagged(fullText)
    if (!functionCall && looksUnfinished && continuationsUsed < MAX_TOKEN_CONTINUATIONS) {
      continuationsUsed++
      console.warn(`[gemini] ${finishReason === 'MAX_TOKENS' ? 'MAX_TOKENS' : `ragged (finishReason=${finishReason})`} — auto-continuing (${continuationsUsed}/${MAX_TOKEN_CONTINUATIONS}) cycle=${cycle}`)
      contents.push({ role: 'model', parts: [{ text: cycleText }] })
      contents.push({ role: 'user', parts: [{ text: CONTINUE_INSTRUCTION }] })
      justContinued = true
      return runCycle(cycle)
    }

    // Mirrors the attach condition above: a call can only arrive on a cycle that
    // was given tools, and its result must have a later cycle to be read in.
    if (functionCall && cycle < MAX_TOOL_CYCLES - 1) {
      const validatedArgs = validateToolArgs(functionCall.name, functionCall.args)
      const result = await onToolCall(functionCall.name, validatedArgs)
      const capped = capToolResult(result, functionCall.name)

      contents.push({
        role: 'model',
        parts: [functionCallPart ?? { functionCall: { name: functionCall.name, args: functionCall.args } }],
      })
      contents.push({ role: 'user', parts: [{ functionResponse: { name: functionCall.name, response: { result: capped } } }] })

      return runCycle(cycle + 1)
    }

    return fullText
  }

  try {
    return await runCycle(0)
  } finally {
    // Gemini is the paid primary — without this, recordUsage only ever saw
    // Groq/OpenAI traffic and isOverDailyBudget read $0 for every Gemini user.
    // Recorded in `finally` so a mid-stream stall still bills what was consumed.
    if (usage.promptTokens > 0 || usage.completionTokens > 0) {
      if (usage.cachedTokens > 0) {
        const pct = ((usage.cachedTokens / usage.promptTokens) * 100).toFixed(1)
        console.log(`[gemini:cache] ${usage.cachedTokens}/${usage.promptTokens} prompt tokens served from cache (${pct}%)`)
      } else {
        console.log(`[gemini:cache] no cache hit — ${usage.promptTokens} prompt tokens billed at full rate`)
      }
      void recordUsage({
        provider: 'gemini',
        model: billedModel,
        // Raw, as the provider reported them. priceFor applies the cached-input
        // discount; storing a pre-discounted count made these rows impossible
        // to reconcile against a bill and impossible to re-price.
        promptTokens: usage.promptTokens,
        cachedTokens: usage.cachedTokens,
        completionTokens: usage.completionTokens,
        endpoint: 'chat',
        userId,
        sessionId,
      })
    }
  }
}
