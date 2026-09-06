// backend/src/lib/ai/compression.ts
import Groq from 'groq-sdk'
import { isCoolingDown } from './providerCooldown'
import { meteredClient } from './geminiMeter'
import { GoogleGenAI } from '@google/genai'
import { MODELS } from '../config'

const COMPRESSION_THRESHOLD = 14
const KEEP_RECENT = 8
const MAX_SUMMARY_CHARS = 500

const COMPRESSION_PROMPT = `Summarize this conversation in 3-4 sentences. Focus on:
1. What property criteria the user mentioned (BHK, budget, sector, timeline)
2. Any properties they reacted to positively or negatively
3. Any decisions or preferences expressed
Be factual, no filler. This summary replaces the full history for context efficiency.`

type Message = { role: 'user' | 'assistant'; content: string }

// Cap and sanitize LLM-generated summaries before DB storage.
// Strips markdown section headers that could confuse the system prompt structure.
// Keeps the most recent content when truncation is required.
function sanitizeSummary(text: string): string {
  const cleaned = text.replace(/^#{1,6}\s+.*/gm, '').trim()
  return cleaned.length > MAX_SUMMARY_CHARS
    ? cleaned.slice(cleaned.length - MAX_SUMMARY_CHARS) // keep most recent
    : cleaned
}


/**
 * Skip the billed key when the chain has already found it dead.
 *
 * Compression reaches for `GEMINI_API_KEY` directly rather than walking the
 * fallback chain, so it never learns what the chain learned on turn one: the
 * key answers `429 "Your prepayment credits are depleted"` and has been cooled
 * down for an hour. Measured, it re-discovered that on every long turn — three
 * sequential failures, 29.9 seconds, inside a 47-second turn whose LLM phase
 * was 13 seconds.
 *
 * Reading the same cooldown the chain writes turns that into an instant skip.
 * The deadline below is still the backstop for a key that is merely slow.
 */
function billedGeminiIsDead(): boolean {
  const model = MODELS.GEMINI_LITE
  return isCoolingDown(`GEMINI_API_KEY:${model}`) || isCoolingDown(`GEMINI_API_KEY:${MODELS.GEMINI_MAIN}`)
}

export async function maybeCompress(
  messages: Message[],
  existingSummary?: string | null
): Promise<{ messages: Message[]; newSummary: string | null }> {
  if (messages.length <= COMPRESSION_THRESHOLD) {
    return { messages, newSummary: null }
  }

  const toCompress = messages.slice(0, messages.length - KEEP_RECENT)
  const recent = messages.slice(messages.length - KEEP_RECENT)

  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return { messages: recent, newSummary: existingSummary ?? null }
  }

  const context = toCompress.map((m) => `${m.role}: ${m.content}`).join('\n')

  try {
    if (process.env.GEMINI_API_KEY && !billedGeminiIsDead()) {
      const client = meteredClient({ apiKey: process.env.GEMINI_API_KEY, endpoint: 'compression' })
      const res = await client.models.generateContent({
        model: MODELS.GEMINI_LITE,
        contents: [{ role: 'user', parts: [{ text: context }] }],
        config: {
          systemInstruction: COMPRESSION_PROMPT,
          maxOutputTokens: 256,
          temperature: 0.1,
        },
      })
      const rawSummary = res.text?.trim() ?? ''
      const combined = existingSummary ? `${existingSummary}\n\n${rawSummary}` : rawSummary
      return { messages: recent, newSummary: sanitizeSummary(combined) }
    }
  } catch (err) {
    console.warn('[compression] Gemini failed, trying Groq:', (err as Error).message)
  }

  // The OpenAI branch that used to sit here is gone. It pointed at
  // `models.inference.ai.azure.com`, a host that stopped resolving in DNS, and
  // authenticated with a GitHub PAT for GitHub Models, which retired on
  // 30 Jul 2026. It could only ever fail — and it failed BETWEEN Gemini and
  // Groq, so every compression that got past Gemini paid a DNS timeout before
  // reaching a provider that works.

  try {
    if (process.env.GROQ_API_KEY) {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
      const res = await groq.chat.completions.create({
        model: MODELS.GROQ_SMART,
        messages: [
          { role: 'system', content: COMPRESSION_PROMPT },
          { role: 'user', content: context },
        ],
        max_tokens: 256,
        temperature: 0.1,
      })
      const rawSummary = res.choices[0]?.message?.content?.trim() ?? ''
      const combined = existingSummary ? `${existingSummary}\n\n${rawSummary}` : rawSummary
      return { messages: recent, newSummary: sanitizeSummary(combined) }
    }
  } catch (err) {
    console.warn('[compression] Groq failed:', (err as Error).message)
  }

  return { messages: recent, newSummary: existingSummary ?? null }
}
