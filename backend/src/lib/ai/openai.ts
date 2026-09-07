import OpenAI from 'openai';
import { MODELS, AI_CONFIG, OPENAI_BASE_URL as CONFIGURED_OPENAI_BASE_URL } from '../config'
import { recordUsage } from './cost'
import { toOpenAITools, validateToolArgs, capToolResult } from './tools'

interface ToolCall {
  id: string
  type: string
  function?: { name: string; arguments: string }
}

type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; name?: string; tool_calls?: ToolCall[]; tool_call_id?: string };
type SendFn = (event: string, data: Record<string, unknown>) => void;

const MAX_TOOL_CYCLES = 3;

/**
 * `finish_reason: 'length'` was never read here — a reply-ceiling cut looked
 * identical to a natural stop. On 'length', feed the partial answer back as
 * the model's own turn and ask it to continue, same recursion the tool-call
 * path already uses. Bounded independently of MAX_TOOL_CYCLES: a continuation
 * is not a tool round-trip and should not spend that budget.
 */
const MAX_TOKEN_CONTINUATIONS = Number(process.env.OPENAI_MAX_CONTINUATIONS ?? 3);
const CONTINUE_INSTRUCTION =
  'Your previous message was cut off by a length limit, possibly mid-word. First finish the exact word or sentence it ended on if it was incomplete, then continue the rest of your answer. Do not repeat anything you already said, do not restate the question, and do not mention that you were interrupted.';

export interface OpenAIProvider {
  apiKey: string;
  baseURL?: string;
  name: string; // 'azure' | 'openai'
}

// Detect the OpenAI-compatible host and key for this call.
//
// apiKeyOverride: the chain rotating through its own keys.
// baseUrlOverride: the chain naming the host for THIS leg. Cohere and NVIDIA
//   both speak this protocol, so they arrive here rather than through adapters
//   of their own; the override is what keeps them from being sent to whatever
//   OPENAI_BASE_URL happens to say. It wins over every ambient source, because
//   a leg that names its host is more specific than a process-wide default.
function getOpenAIProvider(apiKeyOverride?: string, baseUrlOverride?: string): OpenAIProvider {
  const key = apiKeyOverride || process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ''
  // CONFIGURED_OPENAI_BASE_URL comes from config, not raw env: config drops the
  // retired GitHub Models / dead Azure hosts rather than passing them through.
  const baseURL =
    baseUrlOverride
    || process.env.AZURE_OPENAI_ENDPOINT
    || CONFIGURED_OPENAI_BASE_URL
    || 'https://api.openai.com/v1'

  // Name is for logging only. A leg with its own host is named after that host,
  // so "[openai] using provider: azure" can no longer appear over a Cohere call.
  let name = 'openai'
  if (baseUrlOverride) {
    name = /cohere/.test(baseUrlOverride) ? 'cohere'
      : /cloudflare/.test(baseUrlOverride) ? 'cloudflare'
      : /nvidia/.test(baseUrlOverride) ? 'nvidia'
        : 'openai-compatible'
  } else if (process.env.AZURE_OPENAI_API_KEY && !apiKeyOverride) {
    name = 'azure'
  }

  return {
    apiKey: key,
    baseURL,
    name,
  }
}

// ── Inference configuration ───────────────────────────────────────────────────
// Centralise token limits so they can vary per request type without touching
// inference logic. All response types PropFyndr generates fit within 1500 tokens;
// the cap prevents runaway generation and unexpected billing surprises.
export interface InferenceConfig {
  maxTokens: number
  model?: string
  /**
   * Whether this call may be offered the tool catalogue. Defaults to on.
   *
   * Set false by callers that pass a no-op `onToolCall`. Those exist: several
   * topic handlers build a self-contained prompt with the facts already in it
   * and stub the handler with `async () => ({})`. Offering tools anyway let the
   * model call one, receive nothing, call again, and exhaust every tool cycle
   * without ever emitting text — the turn ended with an empty reply and a full
   * bill for the thinking behind it.
   */
  tools?: boolean
  /**
   * Tokens the model may spend thinking before it must start writing.
   *
   * Thinking bills at the OUTPUT rate and counts against maxOutputTokens, which
   * makes it the largest single cost lever on a turn: 1,024 tokens is $0.0038
   * on gemini-3.6-flash, more than the entire input side once the implicit
   * cache is accounted for. 0 disables it. Absent keeps the module default.
   * Chosen per query shape — see inferenceProfile.ts.
   */
  thinkingBudget?: number
  /**
   * Gemini API version for this call. Absent lets the SDK choose (v1beta).
   *
   * Only meaningful on a Gemini leg; ignored elsewhere. Pinning 'v1' trades the
   * beta-only fields — thinking budgets, tool calling — for the stable surface,
   * so a leg that pins it must also disable both.
   */
  apiVersion?: 'v1' | 'v1beta'
}

export const INFERENCE_DEFAULTS: InferenceConfig = {
  maxTokens: 1500,
}

// Thrown when the stream stalls (no chunk for INACTIVITY_MS) or headers never arrive.
// tokensSent indicates whether partial content was already sent to the SSE client.
// Callers use this to decide: clean Groq fallback (false) vs error-and-close (true).
export class StreamStallError extends Error {
  readonly tokensSent: boolean
  constructor(tokensSent: boolean) {
    super('OpenAI stream stalled')
    this.name = 'StreamStallError'
    this.tokensSent = tokensSent
  }
}

// Tight initial timeout for fast rollover if provider is stalled/rate-limited,
// and reasonable stream inactivity timeout between chunks.
const INITIAL_TOKEN_TIMEOUT_MS = 8_000;
const STREAM_INACTIVITY_MS = 15_000;

/**
 * The header window after a tool call is not the header window before one.
 *
 * 8 seconds is right for cycle 0: a dead or rate-limited host should cost the
 * turn one round-trip, not eight. It is wrong for cycle 1, where the model has
 * already answered once, has just been handed a tool result, and is composing
 * an answer over a prompt several thousand tokens longer. Measured live:
 * Cohere emitted a clean `sector_projects` call, took the result, and was then
 * aborted at exactly 8,000ms with `anyTokenSent=false` — logged as "returned
 * no text" and rolled over, discarding a leg that was working.
 *
 * A leg that has already produced a tool call has proven it is alive, so the
 * only thing left to guard against is a genuine hang.
 */
const TOOL_CYCLE_TOKEN_TIMEOUT_MS = 30_000;

export async function streamWithOpenAI(
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  send: SendFn,
  onToolCall: (name: string, args: any) => Promise<any>,
  config: InferenceConfig = INFERENCE_DEFAULTS,
  userId?: string | null,
  sessionId?: string | null,
  apiKeyOverride?: string,
  baseUrlOverride?: string,
): Promise<string> {
  const provider = getOpenAIProvider(apiKeyOverride, baseUrlOverride);

  if (!provider.apiKey) {
    throw new Error('No OpenAI API key configured (AZURE_OPENAI_API_KEY, OPENAI_API_KEY, or github_pat)');
  }

  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    // No SDK-level timeout — inactivity timer owns all phases including body reads.
    // No retries — a retry on a stalled stream extends the hang; inactivity timer handles it.
    maxRetries: 0,
  });

  console.log('[openai] using provider:', provider.name, provider.baseURL ? `(${provider.baseURL})` : '');

  const msgs: Message[] = [
    { role: 'system', content: system },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = toOpenAITools();

  let fullText = '';
  // Tracks whether any token has been sent to the SSE client in this call.
  // Used by StreamStallError so the caller knows whether a clean Groq fallback
  // is possible (false) or whether partial content was already sent (true).
  let anyTokenSent = false;
  /** Persists across the recursive runCompletion calls a continuation makes. */
  let continuationsUsed = 0;
  /** Set right before a continuation's recursive call, read at its first token. */
  let justContinued = false;

  async function runCompletion(currentMsgs: Message[], cycle: number): Promise<string> {
    const allowTools = cycle < MAX_TOOL_CYCLES;

    // Per-cycle inactivity controller. Covers both the header phase (create() await)
    // and the body/chunk phase (for-await loop). A single timer reset on each chunk
    // ensures a stall at any point — pre-first-chunk or mid-stream — is caught.
    const inactivityController = new AbortController();
    let inactivityFired = false;
    let inactivityTimer: NodeJS.Timeout | null = null;

    const resetInactivity = (isStreaming = false) => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      const timeoutMs = isStreaming
        ? STREAM_INACTIVITY_MS
        : cycle > 0 ? TOOL_CYCLE_TOKEN_TIMEOUT_MS : INITIAL_TOKEN_TIMEOUT_MS;
      inactivityTimer = setTimeout(() => {
        inactivityFired = true;
        console.warn(`[openai] inactivity timeout cycle=${cycle} anyTokenSent=${anyTokenSent} (after ${timeoutMs}ms)`);
        inactivityController.abort();
      }, timeoutMs);
    };

    const clearInactivity = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };

    // Start the timer before create() — covers header stall on GitHub Models.
    resetInactivity(false);

    console.log('[OPENAI] START create() cycle=' + cycle, Date.now(), { allowTools, msgCount: currentMsgs.length });

    // config.model wins, and it has to: this adapter now serves Cohere and
    // NVIDIA legs as well as OpenAI ones, and neither of them has a model
    // called gpt-4o. Ignoring the caller's model sent every one of those legs
    // to a 404 — the same shape of bug the Gemini path already carries a note
    // about. Only when no model is named does the old rule apply: MAIN when
    // tools are on, because gpt-4o-mini's context is too small to hold the
    // catalogue alongside the facts block.
    const model = config.model ?? (allowTools ? MODELS.MAIN : MODELS.FALLBACK);

    // Absolute wall-clock deadline for the entire turn (120s max)
    const turnDeadline = Date.now() + 120_000;
    let deadlineExceeded = false;

    let stream: Awaited<ReturnType<typeof client.chat.completions.create>>;
    try {
      stream = await client.chat.completions.create(
        {
          model,
          messages: currentMsgs as any,
          ...(allowTools ? { tools } : {}),
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: config.maxTokens,
        },
        // Signal threads through fetchWithTimeout AND the response body/stream.
        // Aborting it terminates both connection phase and in-progress chunk reads.
        { signal: inactivityController.signal },
      );
    } catch (err) {
      clearInactivity();
      if (inactivityFired || inactivityController.signal.aborted) {
        throw new StreamStallError(anyTokenSent);
      }
      throw err;
    }

    console.log('[OPENAI] END create() — stream object received cycle=' + cycle, Date.now());

    // Reset after headers arrive — now tracking body/chunk phase.
    resetInactivity();

    let toolCallName = '';
    let toolCallArgs = '';
    let toolCallId = '';
    let chunkCount = 0;
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    /** Just this cycle's text, so a continuation feeds back only its own turn. */
    let cycleText = '';
    let finishReason: string | undefined;

    try {
      for await (const chunk of stream) {
        // Each chunk resets the inactivity timer — only a genuine silence triggers abort.
        resetInactivity(true);

        // Absolute deadline check — abort if turn exceeds 120s wall-clock
        if (Date.now() > turnDeadline) {
          console.warn('[OPENAI] Turn deadline exceeded (>120s). Aborting.');
          deadlineExceeded = true;
          inactivityController.abort();
          break;
        }

        chunkCount++;

        if (chunkCount === 1) {
          console.log('[OPENAI] FIRST chunk received cycle=' + cycle, Date.now());
        }
        if (chunkCount % 10 === 0) {
          console.log('[OPENAI] chunk #' + chunkCount + ' cycle=' + cycle, Date.now(), { fullTextLen: fullText.length });
        }

        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          // A continuation resumes on a fresh request, so its first token can
          // land directly against whatever the cut-off cycle ended on. Cannot
          // be trimmed after the fact — the cut-off half is already on the
          // buyer's screen — so the only fixable side is the join.
          let content = delta.content;
          if (justContinued) {
            justContinued = false;
            if (/\w$/.test(fullText) && /^\w/.test(content)) content = ' ' + content;
          }
          fullText += content;
          cycleText += content;
          anyTokenSent = true;
          
          if (
            /propfyndr (ai |data |behavior |communication )/i.test(fullText) ||
            /hard rule|strong rule/i.test(fullText) ||
            /fallback mode/i.test(fullText) ||
            /prohibited|never invent|never share/i.test(fullText)
          ) {
            console.warn('[OPENAI] Active Stream Filter: RAG Leak detected. Aborting.');
            send('token', { token: '\n\n[Response blocked by security policy]' });
            break;
          }

          send('token', { token: content });
        }

        if (delta?.tool_calls) {
          const tc = delta.tool_calls[0];
          if (tc.id) toolCallId = tc.id;
          if (tc.function?.name) toolCallName = tc.function.name;
          if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
        }

        if (chunk.usage) {
          usage = { prompt_tokens: chunk.usage.prompt_tokens, completion_tokens: chunk.usage.completion_tokens };
        }

        if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
      }
    } catch (err) {
      clearInactivity();
      // Distinguish our abort from external errors (API errors, network failures).
      // If the inactivity timer fired — or the signal was already aborted — this
      // is a stall, not a transient error.
      if (inactivityFired || inactivityController.signal.aborted) {
        throw new StreamStallError(anyTokenSent);
      }
      throw err;
    }

    clearInactivity();
    console.log('[OPENAI] stream complete cycle=' + cycle, Date.now(), { chunkCount, fullTextLen: fullText.length, toolCallName: toolCallName || null });

    if (usage) {
      console.log('[OPENAI] tokens', { model, prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens });
      await recordUsage({
        provider: 'openai',
        model,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        endpoint: 'chat.stream',
        userId,
        sessionId,
      })
    }

    if (deadlineExceeded) {
      send('token', { token: '\n\n[Response truncated: 120-second turn limit reached]' });
    }

    // The budget ran out before the model reached a natural stop. Feed back
    // what it wrote this cycle as its own turn and ask it to keep going — the
    // same recursion the tool-call path below uses, on a separate counter so
    // a continuation never eats into the tool-call cycle budget.
    if (!toolCallName && finishReason === 'length' && continuationsUsed < MAX_TOKEN_CONTINUATIONS) {
      continuationsUsed++;
      console.warn(`[openai] finish_reason=length — auto-continuing (${continuationsUsed}/${MAX_TOKEN_CONTINUATIONS}) cycle=${cycle}`);
      currentMsgs.push({ role: 'assistant', content: cycleText });
      currentMsgs.push({ role: 'user', content: CONTINUE_INSTRUCTION });
      justContinued = true;
      return runCompletion(currentMsgs, cycle);
    }

    if (toolCallName && allowTools) {
      send('searching', { tool: toolCallName });

      let argsObj: Record<string, unknown> = {};
      try { argsObj = JSON.parse(toolCallArgs); } catch { /* tolerate partial/empty args */ }

      const validatedArgs = validateToolArgs(toolCallName, argsObj);
      console.log('[OPENAI] START onToolCall', Date.now(), { toolCallName, args: validatedArgs });
      const result = await onToolCall(toolCallName, validatedArgs);
      console.log('[OPENAI] END onToolCall', Date.now(), { toolCallName });

      currentMsgs.push({
        role: 'assistant',
        content: null,
        tool_calls: [{ id: toolCallId, type: 'function', function: { name: toolCallName, arguments: toolCallArgs } }],
      });
      currentMsgs.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: capToolResult(result, toolCallName),
      });

      return runCompletion(currentMsgs, cycle + 1);
    }

    return fullText;
  }

  return runCompletion(msgs, 0);
}
