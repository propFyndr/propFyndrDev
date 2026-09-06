// backend/src/lib/chat/summaryCompression.ts
// Topic-separated compression: location, financial, timeline summaries

import Groq from 'groq-sdk'
import { meteredClient } from '../ai/geminiMeter'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { MODELS } from '../config'

const COMPRESSION_THRESHOLD = 12 // Lazy-load: only compress after 12 messages (was 8)
const KEEP_RECENT = 6
const MAX_SUMMARY_CHARS = 250
const COMPRESSION_ONLY_ON_REQUEST = process.env.COMPRESS_ON_REQUEST === 'true' // Feature flag for lazy compression

type Message = { role: 'user' | 'assistant'; content: string }

export interface TopicSummaries {
  location: string | null // sectors, geography, commute concerns
  financial: string | null // budget, price sensitivity, investment vs. personal
  timeline: string | null // possession urgency, construction tolerance, decision deadline
}

// Split compression into three topic-focused summaries
const COMPRESSION_PROMPTS = {
  location: `Summarize in 2-3 sentences focusing ONLY on:
- Sector preferences (Noida, Sector 10, etc.)
- Geography concerns (location, commute, proximity)
- Commute and connectivity needs
Ignore budget, timeline, and property characteristics.`,

  financial: `Summarize in 2-3 sentences focusing ONLY on:
- Budget range (minimum/maximum in crores)
- Price sensitivity and investment appetite
- Whether for personal use or investment
Ignore location, commute, and timeline.`,

  timeline: `Summarize in 2-3 sentences focusing ONLY on:
- Possession timeline and urgency (immediate, 6 months, 2+ years)
- Tolerance for construction delays
- Decision deadline
Ignore budget, location, and specific properties.`,
}

function sanitizeSummary(text: string): string {
  const cleaned = text.replace(/^#{1,6}\s+.*/gm, '').trim()
  return cleaned.length > MAX_SUMMARY_CHARS
    ? cleaned.slice(cleaned.length - MAX_SUMMARY_CHARS)
    : cleaned
}

/**
 * How long every topic together may take before the turn goes on without them.
 *
 * Three parallel calls to a lite model is normally under a second. The ceiling
 * exists for the failure case, which is the one that was measured.
 */
const COMPRESSION_DEADLINE_MS = Number(process.env.COMPRESSION_DEADLINE_MS ?? 4_000)

async function compressTopic(
  messages: Message[],
  topic: 'location' | 'financial' | 'timeline'
): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
    return null
  }

  const context = messages.map((m) => `${m.role}: ${m.content}`).join('\n')
  const prompt = COMPRESSION_PROMPTS[topic]

  try {
    if (process.env.GEMINI_API_KEY) {
      const client = meteredClient({ apiKey: process.env.GEMINI_API_KEY, endpoint: 'summary-compression' })
      const res = await client.models.generateContent({
        model: MODELS.GEMINI_LITE,
        contents: [{ role: 'user', parts: [{ text: context }] }],
        config: {
          systemInstruction: prompt,
          maxOutputTokens: 120,
          temperature: 0.1,
        },
      })
      return sanitizeSummary(res.text?.trim() ?? '')
    }
  } catch (err) {
    console.warn(`[compression] Gemini failed for ${topic}:`, (err as Error).message)
  }

  /**
   * The OpenAI fallback that stood here pointed at
   * `models.inference.ai.azure.com` — the GitHub Models host that closed to new
   * customers on 16 Jun 2026 and shut down on 30 Jul 2026. CLAUDE.md records
   * that the redirect to it was removed from the main chain months ago; this
   * copy was missed, so compression's "fallback" was a guaranteed failure
   * sitting between a depleted Gemini key and the Groq leg below, costing a
   * round-trip to learn nothing. Groq is the real fallback and it is next.
   */

  try {
    if (process.env.GROQ_API_KEY) {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
      const res = await groq.chat.completions.create({
        model: MODELS.GROQ_SMART,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: context },
        ],
        max_tokens: 120,
        temperature: 0.1,
      })
      return sanitizeSummary(res.choices[0]?.message?.content?.trim() ?? '')
    }
  } catch (err) {
    console.warn(`[compression] Groq failed for ${topic}:`, (err as Error).message)
  }

  return null
}

export async function maybeCompressTopical(
  messages: Message[],
  existingSummaries?: TopicSummaries | null,
  forceCompress = false
): Promise<{ messages: Message[]; newSummaries: TopicSummaries | null }> {
  // Lazy-load: only compress if explicitly requested OR threshold exceeded
  if (!forceCompress && messages.length <= COMPRESSION_THRESHOLD) {
    return { messages, newSummaries: null }
  }

  const toCompress = messages.slice(0, messages.length - KEEP_RECENT)

  // Compress all three topics in parallel
  const [locSummary, finSummary, timeSummary] = await Promise.all([
    compressTopic(toCompress, 'location'),
    compressTopic(toCompress, 'financial'),
    compressTopic(toCompress, 'timeline'),
  ])

  const newSummaries: TopicSummaries = {
    location: locSummary || existingSummaries?.location || null,
    financial: finSummary || existingSummaries?.financial || null,
    timeline: timeSummary || existingSummaries?.timeline || null,
  }

  const recent = messages.slice(messages.length - KEEP_RECENT)
  return { messages: recent, newSummaries }
}

// On-demand summary with property weightage: used for "summarize my chat" feature
export interface PropertySummaryItem {
  projectId: string
  projectName: string
  mentionCount: number
  sentiment: 'interested' | 'concerned' | 'rejected' | 'neutral'
  aiSummary: string
}

export interface WeightedChatSummary {
  overallSummary: string
  properties: PropertySummaryItem[]
}

export async function generatePropertySummary(
  messages: Message[],
  projectName: string
): Promise<string> {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
    return `${projectName}: User discussed this property in the chat.`
  }

  const context = messages.map((m) => `${m.role}: ${m.content}`).join('\n')
  const prompt = `Summarize user's sentiment and concerns about "${projectName}" in 1-2 sentences. Focus on: interest level, key concerns, specific questions asked, mentioned trade-offs.`

  try {
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai')
      const client = meteredClient({ apiKey: process.env.GEMINI_API_KEY, endpoint: 'summary-compression' })
      const res = await client.models.generateContent({
        model: MODELS.GEMINI_LITE,
        contents: [{ role: 'user', parts: [{ text: context }] }],
        config: {
          systemInstruction: prompt,
          maxOutputTokens: 100,
          temperature: 0.1,
        },
      })
      return res.text?.trim() ?? `${projectName}: Discussed in chat.`
    }
  } catch (err) {
    console.warn(`[compression] Gemini summary failed for ${projectName}:`, (err as Error).message)
  }

  try {
    if (process.env.GROQ_API_KEY) {
      const Groq = (await import('groq-sdk')).default
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
      const res = await groq.chat.completions.create({
        model: MODELS.GROQ_FAST,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: context },
        ],
        max_tokens: 100,
        temperature: 0.1,
      })
      return res.choices[0]?.message?.content?.trim() ?? `${projectName}: Discussed in chat.`
    }
  } catch (err) {
    console.warn(`[compression] Groq summary failed for ${projectName}:`, (err as Error).message)
  }

  return `${projectName}: User discussed this property and shared thoughts.`
}
