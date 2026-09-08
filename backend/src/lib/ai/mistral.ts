// backend/src/lib/ai/mistral.ts
import OpenAI from 'openai'
import { recordUsage } from './cost'
import { createInactivityGuard, type InactivityGuard } from './streamTimeout'

type Message = { role: 'user' | 'assistant'; content: string }
type SendFn = (event: string, data: Record<string, unknown>) => void

/**
 * Hard reply ceiling for this leg, below whatever the turn's profile asks for.
 *
 * This bounds a runaway generation; it is NOT the fix for slow turns, and the
 * numbers say so. Measured over one demo run, Mistral's throughput varied
 * eighteen-fold — 310 chars/sec on one call, 17 on another — and the 39.4s
 * call that set the p99 emitted 2,144 chars, about 536 tokens, already far
 * under the 1,800 its profile allowed. Length was never what made it slow.
 *
 * 900 was tried first, on the arithmetic that ~4 chars per token put it above
 * every reply in the corpus. It truncated two answers mid-sentence, one of them
 * mid-table-row: markdown tables tokenize far denser than prose — pipes,
 * separators and digits — so 900 tokens came out around 2,400 characters, not
 * 3,600. A cut-off table row is worse than a slow answer.
 *
 * 1,400 sits above the longest complete reply observed (3,658 chars) with
 * headroom, and still bounds a generation that runs away. Move it only with a
 * corpus run showing what the new value cuts.
 */
export const MISTRAL_MAX_TOKENS = Number(process.env.MISTRAL_MAX_TOKENS ?? 1400)

/** The reply ceiling actually sent, after clamping the turn profile. */
export const mistralReplyCeiling = (profileMaxTokens?: number): number =>
  Math.min(profileMaxTokens ?? 1024, MISTRAL_MAX_TOKENS)

/**
 * `finish_reason: 'length'` was never read here — this leg carries the
 * lowest ceiling in the chain (see above), so it is the leg most likely to hit
 * it, and every hit looked identical to a clean stop. On 'length', feed the
 * partial answer back as the model's own turn and ask it to continue.
 */
const MAX_TOKEN_CONTINUATIONS = Number(process.env.MISTRAL_MAX_CONTINUATIONS ?? 5)
const CONTINUE_INSTRUCTION =
  'Your previous message was cut off by a length limit, possibly mid-word. First finish the exact word or sentence it ended on if it was incomplete, then continue the rest of your answer. Do not repeat anything you already said, do not restate the question, and do not mention that you were interrupted.'

export async function streamWithMistral(
  systemPrompt: string,
  messages: Message[],
  send: SendFn,
  apiKeyOverride?: string,
  userId?: string | null,
  sessionId?: string | null,
  /** Reply ceiling for this turn, from the caller's inference profile. */
  maxTokens?: number
): Promise<string> {
  const apiKey = apiKeyOverride || process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error('MISTRAL_API_KEY is not configured')

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.mistral.ai/v1',
  })

  const startedAt = Date.now()
  console.log('[MISTRAL] START stream completion...')
  let msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  let fullText = ''
  let continuationsUsed = 0
  /** Set right before a continuation's next loop iteration, read at its first token. */
  let justContinued = false

  for (;;) {
    // Armed before create(), so a header stall and a mid-body stall share one
    // window. Aborting tears down the fetch and the SDK throws where it stands.
    // Explicitly typed: TypeScript only narrows on a never-returning call when the
    // reference carries a declared type, and guard.rethrow() never returns.
    const guard: InactivityGuard = createInactivityGuard('mistral')

    let stream
    try {
      stream = await client.chat.completions.create(
        {
          model: 'mistral-small-latest',
          messages: msgs,
          stream: true,
          // Without this the stream carries no usage at all, so a turn answered here
          stream_options: { include_usage: true },
          // From the turn's cost profile, then clamped: this leg is the one most
          // turns land on while Gemini is depleted, and it is the slowest.
          max_tokens: mistralReplyCeiling(maxTokens),
          temperature: 0.7,
        },
        { signal: guard.signal },
      )
    } catch (err) {
      guard.rethrow(err)
    }

    // Headers arrived — re-arm for the body phase.
    guard.reset()

    let cycleText = ''
    let promptTokens = 0
    let completionTokens = 0
    let finishReason: string | undefined
    try {
      for await (const chunk of stream) {
        // Each chunk resets the timer — only genuine silence aborts, so a slow
        // but progressing generation is never cut off mid-sentence.
        guard.reset()
        // The usage chunk arrives last and carries no choices.
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? 0
          completionTokens = chunk.usage.completion_tokens ?? 0
        }
        let token = chunk.choices[0]?.delta?.content || ''
        if (token) {
          // A continuation resumes on a fresh request, so its first token can
          // land directly against whatever the cut-off cycle ended on. Cannot
          // be trimmed after the fact — the cut-off half is already on the
          // buyer's screen — so the only fixable side is the join.
          if (justContinued) {
            justContinued = false
            if (/\w$/.test(fullText) && /^\w/.test(token)) token = ' ' + token
          }
          cycleText += token
          guard.markTokenSent()
          send('token', { token })
        }
        if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason
      }
    } catch (err) {
      guard.rethrow(err)
    }
    guard.clear()

    fullText += cycleText

    if (promptTokens > 0 || completionTokens > 0) {
      void recordUsage({
        provider: 'mistral',
        model: 'mistral-small-latest',
        promptTokens,
        completionTokens,
        endpoint: 'chat',
        userId,
        sessionId,
      })
    }

    // The budget ran out before the model reached a natural stop. Feed back
    // what it wrote this cycle as its own turn and ask it to keep going.
    if (finishReason === 'length' && continuationsUsed < MAX_TOKEN_CONTINUATIONS) {
      continuationsUsed++
      console.warn(`[mistral] finish_reason=length — auto-continuing (${continuationsUsed}/${MAX_TOKEN_CONTINUATIONS})`)
      msgs = [
        ...msgs,
        { role: 'assistant', content: cycleText },
        { role: 'user', content: CONTINUE_INSTRUCTION },
      ]
      justContinued = true
      continue
    }

    break
  }

  console.log(`[MISTRAL:SUCCESS] Stream complete (${fullText.length} chars in ${Date.now() - startedAt}ms)`)
  return fullText
}

export async function completeWithMistral(
  systemPrompt: string,
  userMessage: string,
  apiKeyOverride?: string,
): Promise<string> {
  const apiKey = apiKeyOverride || process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error('MISTRAL_API_KEY is not configured')

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.mistral.ai/v1',
  })

  const res = await client.chat.completions.create({
    model: 'mistral-small-latest',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 512,
    temperature: 0.2,
  })

  return res.choices[0]?.message?.content?.trim() || ''
}
