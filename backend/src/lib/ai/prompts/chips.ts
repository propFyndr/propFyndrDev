import { GoogleGenAI } from '@google/genai'
import { meteredClient } from '../geminiMeter'
import OpenAI from 'openai'
import Groq from 'groq-sdk'
import { getGroq } from '../groq'
import { MODELS, FALLBACK_CHAIN, type FallbackKeyConfig } from '../../config'
import type { ChipAction } from '../../discovery/conversationEngine'
import { chip } from '../../discovery/conversationEngine'

const CHIP_SYSTEM_PROMPT = `You predict the buyer's next question for PropFyndr (Noida & Greater Noida real estate).
Generate exactly 3 follow-up action chips.

You receive: KNOWN CONSTRAINTS (what the buyer already told us), PROJECTS ON SCREEN,
USER ASKED (their recent questions), and WE JUST ANSWERED (the reply they are reading now).

RULES:
1. Chips must follow on from WE JUST ANSWERED — pick up a thread that answer opened
   or a gap it left. Do not suggest something the answer already covered in full.
2. Respect KNOWN CONSTRAINTS. Never ask for a detail the buyer already gave, and never
   suggest a sector, budget, or BHK that contradicts one.
3. At least 1 chip must lead to property cards (e.g. "Show projects in Sector 150",
   "Ready-to-move 3 BHK in Sector 75").
4. Prefer PROJECTS ON SCREEN by name when suggesting a detail action. Never invent a
   project name that was not given to you.
5. Under 7 words each. No emojis.
6. Output ONLY valid JSON: {"questions": ["...", "...", "..."]}. No markdown, no prose.

Example output:
{
  "questions": [
    "Show projects in Sector 150",
    "View 3 BHK in Central Noida",
    "Compare Sector 150 vs Sector 79"
  ]
}
`

function parseChipQuestions(content: string): string[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed
    if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions
  } catch (e) {
    console.error('[CHIPS:LLM] failed to parse JSON', content)
  }
  return []
}

import { completeWithMistral } from '../mistral'
import { beautifyResponse } from '../responseBeautifier'

async function tryProvider(item: FallbackKeyConfig, systemPrompt: string, historyText: string): Promise<string[]> {
  // Never make real external LLM network calls during automated unit tests
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_TEST_LLM) {
    return []
  }

  const apiKey = process.env[item.envKey]
  if (!apiKey) return []

  try {
    let raw = ''

    if (item.provider === 'groq') {
      const groq = new Groq({ apiKey, timeout: 6000 })
      const res = await groq.chat.completions.create({
        model: MODELS.GROQ_FAST,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: historyText },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      })
      raw = res.choices[0]?.message?.content?.trim() ?? ''
    } else if (item.provider === 'mistral') {
      raw = await completeWithMistral(systemPrompt, historyText, apiKey)
    } else if (item.provider === 'openai') {
      // `item.baseUrl` names the real host for every 'openai'-provider leg in
      // FALLBACK_CHAIN today — Cohere, NVIDIA, Cloudflare and (since 7 Sep
      // 2026) Groq all share this adapter and none of them is api.openai.com
      // or the dead Azure host this branch used to hardcode regardless of
      // which leg was calling. Respecting item.model alongside it matters for
      // the same reason: MODELS.OPENAI_FALLBACK ('gpt-4o-mini') is a 404 on
      // every one of them.
      const client = new OpenAI({ apiKey, baseURL: item.baseUrl ?? 'https://models.inference.ai.azure.com', maxRetries: 0 })
      const res = await client.chat.completions.create({
        model: item.baseUrl ? item.model : MODELS.OPENAI_FALLBACK,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: historyText },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      })
      raw = res.choices[0]?.message?.content?.trim() ?? ''
    } else if (item.provider === 'gemini') {
      const client = meteredClient({ apiKey, endpoint: 'chips' })
      const res = await client.models.generateContent({
        model: MODELS.GEMINI_LITE,
        contents: [{ role: 'user', parts: [{ text: historyText }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.5,
          responseMimeType: 'application/json',
        },
      })
      raw = res.text?.trim() ?? ''
    }

    return parseChipQuestions(raw)
  } catch (error: unknown) {
    console.warn(`[CHIPS:LLM] Provider ${item.label} (${item.envKey}) failed:`, error instanceof Error ? error.message : String(error))
    return []
  }
}

/** Compact facts the chip model needs. Cheaper and more on-target than raw history. */
export interface ChipContext {
  /** Current merged intent — lets chips respect constraints the user already gave. */
  intent?: Record<string, unknown>
  /** Names of projects actually on screen — keeps suggestions grounded in real inventory. */
  projectNames?: string[]
}

const MAX_ANSWER_CHARS = 600
const MAX_TURN_CHARS = 300

/**
 * Build the chip model's input.
 *
 * Previously this sent the last 10 messages verbatim — assistant answers include
 * markdown comparison tables, so a single turn could run several thousand tokens
 * for a 3-string output. What the model actually needs is: what the user is
 * constrained to, what they just asked, and what we just told them.
 */
function buildChipContext(
  chatHistory: { role: string; content: string }[],
  context?: ChipContext,
): string {
  const parts: string[] = []

  if (context?.intent) {
    const known = Object.entries(context.intent)
      .filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : String(v)}`)
    if (known.length) parts.push(`KNOWN CONSTRAINTS: ${known.join(', ')}`)
  }

  if (context?.projectNames?.length) {
    parts.push(`PROJECTS ON SCREEN: ${context.projectNames.slice(0, 5).join(', ')}`)
  }

  // Last two user turns give the thread of what they're pursuing.
  const userTurns = chatHistory.filter(m => m.role === 'user').slice(-2)
  for (const t of userTurns) {
    parts.push(`USER ASKED: ${String(t.content ?? '').slice(0, MAX_TURN_CHARS)}`)
  }

  // The answer we just gave — this is what makes chips follow the response
  // rather than only the question.
  const lastAssistant = [...chatHistory].reverse().find(m => m.role === 'assistant')
  if (lastAssistant?.content) {
    parts.push(`WE JUST ANSWERED: ${String(lastAssistant.content).slice(0, MAX_ANSWER_CHARS)}`)
  }

  return parts.join('\n')
}

export async function generateContextualLLMChips(
  chatHistory: { role: string; content: string }[] | null | undefined,
  priorityStart: number,
  preferredProvider?: { provider: string; envKey: string }, // Provider that succeeded for main response
  context?: ChipContext,
): Promise<ChipAction[]> {
  if (!chatHistory?.length) return []
  const historyText = buildChipContext(chatHistory, context)
  if (!historyText) return []

  let questions: string[] = []

  // Build chain with preferred provider first if specified
  let chainToUse = FALLBACK_CHAIN
  if (preferredProvider && preferredProvider.provider !== 'database') {
    const preferred = FALLBACK_CHAIN.find(c => c.provider === preferredProvider.provider && c.envKey === preferredProvider.envKey)
    if (preferred) {
      chainToUse = [preferred, ...FALLBACK_CHAIN.filter(c => c !== preferred)]
      console.log(`[CHIPS] Prioritizing provider affinity: ${preferred.label}`)
    }
  }

  for (const item of chainToUse) {
    const result = await tryProvider(item, CHIP_SYSTEM_PROMPT, historyText)
    if (result.length > 0) {
      questions = result
      break
    }
  }

  return questions.slice(0, 3).map((q, idx) => {
    const cleanQuestion = q.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() // strip emojis
    const beautified = beautifyResponse(cleanQuestion).replace(/\.$/, '') // beautify, remove trailing period (chips don't need it)
    return chip(
      `llm_chip_${idx}`,
      'TEXT_MESSAGE',
      beautified,
      { text: beautified },
      priorityStart + idx
    )
  })
}
