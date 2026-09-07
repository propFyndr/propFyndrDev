// backend/src/lib/ai/gemini.ts
import { createHash } from 'crypto'
import { getCachedPrefix } from './geminiCache'
import { assertWithinGeminiBudget } from './geminiMeter'
import { splitSystemPrompt } from './prompts/base'
import { GoogleGenAI } from '@google/genai'
import { MODELS, GEMINI_TOOLS_ENABLED } from '../config'
import { toGeminiTools, validateToolArgs, capToolResult } from './tools'
import { INFERENCE_DEFAULTS, type InferenceConfig } from './openai'
import { recordUsage, CACHED_INPUT_RATIO } from './cost'

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
const MAX_TOKEN_CONTINUATIONS = Number(process.env.GEMINI_MAX_CONTINUATIONS ?? 2)
const CONTINUE_INSTRUCTION =
  'Continue your answer exactly where you left off. Do not repeat anything you already said, do not restate the question, and do not mention that you were interrupted.'

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
   * The cacheable head, fingerprinted — because it turned out not to be one.
   *
   * CLAUDE.md records that "78% of it [is] served from Gemini's implicit cache
   * at a tenth of rate". Measured on 5 Sep 2026 over one four-turn
   * conversation, the figure is 0%, and the reason is structural: each lane
   * assembles its own system prompt, so the three heads produced were 25,193,
   * 10,534 and 9,342 characters with a longest common prefix of SEVENTEEN
   * characters — "You are RealtyPal". Implicit caching matches a prefix. There
   * is nothing here for it to match.
   *
   * Left in behind an env flag rather than removed: the fix is to give every
   * lane one byte-identical opening block, and this is how you tell whether it
   * worked. `DEBUG_PROMPT_STABILITY=1` and compare hashes across turns — one
   * repeated hash means caching can engage, three distinct ones means it cannot.
   */
  if (process.env.DEBUG_PROMPT_STABILITY) {
    const h = createHash('sha1').update(systemHead).digest('hex').slice(0, 12)
    console.log('[PROMPT_HEAD_HASH]', h, 'headChars=' + systemHead.length, 'tailChars=' + systemTail.length, '|', JSON.stringify(systemHead.slice(0, 46)))
  }
  // Gemini refuses CachedContent in a request that also sets system_instruction
  const cacheIsUsable = !GEMINI_TOOLS_ENABLED && !systemTail
  const cachedName = cacheIsUsable
    ? await getCachedPrefix(client, config.model || MODELS.GEMINI_MAIN, apiKey, systemHead)
    : null
  // With a cache in play the head lives server-side and must NOT be resent:
  // Gemini rejects systemInstruction alongside cachedContent. The tail still
  // travels every turn, because it is different every turn.
  const effectiveSystem = cachedName ? systemTail : system
  let fullText = ''
  /** Persists across the recursive runCycle calls a continuation makes. */
  let continuationsUsed = 0
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

      // Reads the same constant FALLBACK_CHAIN uses for supportsTools, so the tool
      /**
       * The declarations stay on the last cycle; only the permission to call
       * is withdrawn.
       *
       * Dropping `tools` entirely on the final cycle left a conversation whose
       * history contains `functionCall` and `functionResponse` parts being sent
       * to a request that declares no functions. Gemini answers that with
       * nothing at all. Reproduced against the free-tier key with the real
       * catalogue: two `sector_projects` calls, then cycle 2 returns an empty
       * string, which `fallbackChain` reports as "returned no text" and rolls
       * over — so both free Gemini legs failed on every tool-using turn, and
       * with the billed legs out of credit the whole chain fell to the
       * tool-blind tail. That is the condition CLAUDE.md warns produces
       * invented projects.
       *
       * `mode: 'NONE'` is the documented way to say "answer in text now": the
       * declarations remain valid for the history, and no further call is
       * possible. Which matters, because a call made on the last cycle has no
       * later cycle to be read in and would be silently dropped.
       */
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
      if (GEMINI_TOOLS_ENABLED && config.tools !== false) {
        genConfig.tools = toGeminiTools()
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

        const textParts = chunk.candidates?.[0]?.content?.parts
          ?.filter((p: any) => typeof p?.text === 'string')
          ?.map((p: any) => p.text)
          ?.join('') || ''

        if (textParts) {
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

    // The budget ran out before the model reached STOP. Feed back what it wrote
    // this cycle as its own turn and ask it to keep going, same recursion the
    // tool-call path below uses — just not consuming that path's cycle budget,
    // since a continuation is not a tool round-trip.
    if (!functionCall && finishReason === 'MAX_TOKENS' && continuationsUsed < MAX_TOKEN_CONTINUATIONS) {
      continuationsUsed++
      console.warn(`[gemini] MAX_TOKENS — auto-continuing (${continuationsUsed}/${MAX_TOKEN_CONTINUATIONS}) cycle=${cycle}`)
      contents.push({ role: 'model', parts: [{ text: cycleText }] })
      contents.push({ role: 'user', parts: [{ text: CONTINUE_INSTRUCTION }] })
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
      const uncachedPromptTokens = Math.max(0, usage.promptTokens - usage.cachedTokens)
      if (usage.cachedTokens > 0) {
        const pct = ((usage.cachedTokens / usage.promptTokens) * 100).toFixed(1)
        console.log(`[gemini:cache] ${usage.cachedTokens}/${usage.promptTokens} prompt tokens served from cache (${pct}%)`)
      } else {
        console.log(`[gemini:cache] no cache hit — ${usage.promptTokens} prompt tokens billed at full rate`)
      }
      void recordUsage({
        provider: 'gemini',
        model: billedModel,
        // Cached input bills at 10% of the standard input rate across every
        promptTokens: uncachedPromptTokens + Math.round(usage.cachedTokens * CACHED_INPUT_RATIO),
        completionTokens: usage.completionTokens,
        endpoint: 'chat',
        userId,
        sessionId,
      })
    }
  }
}
