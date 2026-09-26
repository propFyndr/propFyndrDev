// backend/src/lib/chat/dossierNarrativeExtractor.ts
import Groq from 'groq-sdk'
import { checkAnswerIntegrity } from '../ai/answerIntegrity'
import { meteredClient } from '../ai/geminiMeter'
import { isCoolingDown, recordFailure, recordSuccess } from '../ai/providerCooldown'
import { MODELS } from '../config'

export type ConsultationBadge =
  | 'SECTOR_PIVOT'
  | 'LEGAL_CHECK'
  | 'BUDGET_TEST'
  | 'WATER_AUDIT'
  | 'VERTICAL_TRANSIT'
  | 'PROJECT_DEEP_DIVE'

const BADGES: ReadonlySet<string> = new Set([
  'SECTOR_PIVOT', 'LEGAL_CHECK', 'BUDGET_TEST', 'WATER_AUDIT', 'VERTICAL_TRANSIT', 'PROJECT_DEEP_DIVE',
])

export interface ConsultationStep {
  step: number
  sectorOrTopic: string
  userQuestion: string          // Max 15 words: plain, simple buyer inquiry
  groundRealityVerdict: string  // Max 25 words: what the answer actually said
  badge?: ConsultationBadge
}

export interface TradeOffDilemma {
  optionA: {
    name: string
    advantage: string
    drawback: string
  }
  optionB: {
    name: string
    advantage: string
    drawback: string
  }
  verdictRecommendation: string
}

export interface DossierNarrative {
  searchEvolutionSummary: string
  consultationTrail: ConsultationStep[]
  tradeOffDilemma: TradeOffDilemma | null
}

interface MessageItem {
  role: 'user' | 'assistant'
  content: string
}

/**
 * The trail is "what they asked", so it covers the whole conversation, not
 * the last few turns. The ceiling only stops a 200-turn session producing a
 * document nobody reads.
 */
export const MAX_TRAIL_STEPS = 25

/** Characters of transcript sent to the model. Buyer turns are kept whole first. */
const TRANSCRIPT_BUDGET = 14_000

/** Total time for both providers together, not per provider. */
const NARRATIVE_DEADLINE_MS = 5_000

const NO_SUMMARY = 'The questions asked in this conversation, in order.'

/**
 * Trims words to a hard ceiling for ultra-clean plain-English presentation
 */
function limitWords(str: string, maxWords: number): string {
  const words = str.trim().split(/\s+/)
  if (words.length <= maxWords) return str.trim()
  return words.slice(0, maxWords).join(' ') + '...'
}

/** A request for the summary itself is not a research question. */
function isSummaryRequest(q: string): boolean {
  return /\b(?:memo|dossier|summari[sz]e|summary|recap|share)\b/i.test(q) && q.split(/\s+/).length <= 12
}

/** "hi", "thanks", "ok" — nothing to record. */
function isSmallTalk(q: string): boolean {
  return /^(?:hi|hello|hey|thanks?|thank you|ok(?:ay)?|cool|great|yes|no|sure)\b[\s!.?]*$/i.test(q.trim())
}

/** Markdown and link syntax out, so a sentence reads as a sentence. */
function plain(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')          // table rows
    .replace(/^#{1,6}\s+.*$/gm, ' ')            // headings
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')  // links and images
    .replace(/[*_`>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The first sentence of the answer that carries content. Openers like "Here's
 * what I found" say nothing, and on a shared document they read as padding.
 */
function firstSubstantiveSentence(reply: string): string | null {
  const sentences = plain(reply).split(/(?<=[.?!])\s+/)
  for (const s of sentences) {
    const t = s.trim()
    if (t.length < 25) continue
    if (/^(?:sure|great|good question|here(?:'s| is| are)|let me|absolutely|of course|certainly)\b/i.test(t)) continue
    return t
  }
  return null
}

/**
 * Deterministic rule-based fallback, zero tokens. One step per buyer question,
 * each paired with the first substantive sentence of the reply to it.
 */
export function extractDeterministicNarrative(
  messages: MessageItem[],
  targetProjects: Array<{ name: string; sector?: string | null }> = []
): DossierNarrative {
  const steps: ConsultationStep[] = []

  let previousSector: string | null = null
  let stepIndex = 1

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role !== 'user' || !msg.content) continue

    const q = msg.content.trim()
    const qLower = q.toLowerCase()
    if (q.length <= 3 || isSmallTalk(q) || isSummaryRequest(q)) continue

    // Find the immediate assistant reply
    let reply = ''
    for (let j = i + 1; j < messages.length; j++) {
      if (messages[j].role === 'user') break
      if (messages[j].role === 'assistant') {
        reply = messages[j].content
        break
      }
    }

    const verdict = firstSubstantiveSentence(reply) ?? 'No answer recorded for this question.'

    // Identify sector mentions in this question
    const sectorMatch = q.match(/\bsector\s*([0-9]+[a-z]?)\b/i)
    const currentSector = sectorMatch ? `Sector ${sectorMatch[1]}` : null

    // Determine category badge and topic
    let badge: ConsultationBadge = 'PROJECT_DEEP_DIVE'
    let topicName = currentSector || 'Property research'

    if (currentSector && previousSector && currentSector.toLowerCase() !== previousSector.toLowerCase()) {
      badge = 'SECTOR_PIVOT'
      topicName = `Moved to ${currentSector}`
    } else if (/\b(?:registry|court|receiver|dues|nclt|litigation|clearance|legal)\b/i.test(qLower)) {
      badge = 'LEGAL_CHECK'
      topicName = currentSector ? `${currentSector} legal standing` : 'Legal and registry'
    } else if (/\b(?:water|tds|ganga|borewell)\b/i.test(qLower)) {
      badge = 'WATER_AUDIT'
      topicName = currentSector ? `${currentSector} water` : 'Water supply'
    } else if (/\b(?:lift|elevator|lift act|transit)\b/i.test(qLower)) {
      badge = 'VERTICAL_TRANSIT'
      topicName = currentSector ? `${currentSector} lifts` : 'Lifts'
    } else if (/\b(?:budget|price|cost|emi|salary|crore|cr|lakh)\b/i.test(qLower)) {
      badge = 'BUDGET_TEST'
      topicName = currentSector ? `${currentSector} pricing` : 'Budget and costs'
    } else {
      const proj = targetProjects.find(p => qLower.includes(p.name.toLowerCase()))
      if (proj) topicName = proj.name
    }

    if (currentSector) previousSector = currentSector

    steps.push({
      step: stepIndex++,
      sectorOrTopic: topicName,
      userQuestion: limitWords(q, 15),
      groundRealityVerdict: limitWords(verdict, 25),
      badge,
    })

    if (steps.length >= MAX_TRAIL_STEPS) break
  }

  // Collect unique sectors mentioned in chronological order
  const sectorTrail: string[] = []
  for (const s of steps) {
    const m = s.sectorOrTopic.match(/Sector\s*[0-9]+[a-z]?/i) || s.userQuestion.match(/Sector\s*[0-9]+[a-z]?/i)
    if (m) {
      const label = m[0].replace(/^sector/i, 'Sector')
      if (!sectorTrail.includes(label)) sectorTrail.push(label)
    }
  }

  // Only what the questions themselves show: where the search started and
  // where it went. No claims about what was "evaluated".
  let searchEvolutionSummary = NO_SUMMARY
  if (sectorTrail.length >= 2) {
    searchEvolutionSummary = `Started around ${sectorTrail[0]}, later moved to ${sectorTrail[sectorTrail.length - 1]}. ${steps.length} questions asked.`
  } else if (sectorTrail.length === 1) {
    searchEvolutionSummary = `Focused on ${sectorTrail[0]}. ${steps.length} question${steps.length === 1 ? '' : 's'} asked.`
  } else if (steps.length > 0) {
    searchEvolutionSummary = `${steps.length} question${steps.length === 1 ? '' : 's'} asked in this conversation, in order.`
  }

  // No deterministic trade-off: with only names and sectors in hand, any
  // advantage/drawback written here would be invented, and this document is
  // shared with whoever the buyer chooses. Only the LLM path, grounded in the
  // transcript, may produce one.
  return { searchEvolutionSummary, consultationTrail: steps, tradeOffDilemma: null }
}

/** LLM JSON is untrusted: a partial dilemma would crash the dossier page. */
function validDilemma(d: any): TradeOffDilemma | null {
  const side = (o: any) => o && typeof o.name === 'string' && typeof o.advantage === 'string' && typeof o.drawback === 'string'
  return d && side(d.optionA) && side(d.optionB) && typeof d.verdictRecommendation === 'string' ? d : null
}

/**
 * The dossier is a public, 30-day document, so the model's prose goes through
 * the same integrity scan as a chat answer, against the transcript it was
 * written from. Any violation falls back to the deterministic narrative, which
 * only restates what was said.
 */
async function isGrounded(n: DossierNarrative, contextText: string): Promise<boolean> {
  const prose = [
    n.searchEvolutionSummary,
    ...n.consultationTrail.map(s => `${s.sectorOrTopic}: ${s.groundRealityVerdict}`),
    n.tradeOffDilemma ? `${n.tradeOffDilemma.optionA.advantage} ${n.tradeOffDilemma.optionA.drawback} ${n.tradeOffDilemma.optionB.advantage} ${n.tradeOffDilemma.optionB.drawback} ${n.tradeOffDilemma.verdictRecommendation}` : '',
  ].join(' ')
  try {
    const violations = await checkAnswerIntegrity(prose, contextText)
    if (violations.length > 0) console.warn('[dossierNarrativeExtractor] integrity rejected:', violations.map(v => v.kind).join(','))
    return violations.length === 0
  } catch {
    return false
  }
}

/**
 * The whole conversation in a bounded size. Buyer turns are what the trail
 * records, so they are kept; the assistant replies are cut shorter and
 * shorter until it fits.
 */
export function compactTranscript(messages: MessageItem[]): string {
  const turns = messages.filter(m => m.content && m.content.trim().length > 0)
  for (const [userCap, replyCap] of [[500, 400], [300, 180], [200, 90], [120, 40]] as const) {
    const text = turns
      .map(m => `${m.role.toUpperCase()}: ${plain(m.content).slice(0, m.role === 'user' ? userCap : replyCap)}`)
      .join('\n')
    if (text.length <= TRANSCRIPT_BUDGET) return text
  }
  // Still too long: keep the most recent part that fits.
  const text = turns.map(m => `${m.role.toUpperCase()}: ${plain(m.content).slice(0, m.role === 'user' ? 120 : 40)}`).join('\n')
  return text.slice(-TRANSCRIPT_BUDGET)
}

function normalise(result: any): DossierNarrative | null {
  if (!result || !Array.isArray(result.consultationTrail) || result.consultationTrail.length === 0) return null
  return {
    searchEvolutionSummary: typeof result.searchEvolutionSummary === 'string' && result.searchEvolutionSummary.trim()
      ? result.searchEvolutionSummary.trim()
      : NO_SUMMARY,
    consultationTrail: result.consultationTrail.slice(0, MAX_TRAIL_STEPS).map((s: any, idx: number) => ({
      step: idx + 1,
      sectorOrTopic: typeof s?.sectorOrTopic === 'string' && s.sectorOrTopic.trim() ? s.sectorOrTopic.trim() : 'Question',
      userQuestion: limitWords(String(s?.userQuestion ?? ''), 15),
      groundRealityVerdict: limitWords(String(s?.groundRealityVerdict ?? ''), 25),
      badge: BADGES.has(s?.badge) ? s.badge : 'PROJECT_DEEP_DIVE',
    })),
    tradeOffDilemma: validDilemma(result.tradeOffDilemma),
  }
}

const SYSTEM_PROMPT = `You record a property-research conversation for PropFyndr so the buyer can share it with anyone they choose.
Return one JSON object:
{
  "searchEvolutionSummary": "1-2 plain sentences: where the search started, how it changed, and the buyer's stated criteria.",
  "consultationTrail": [
    {
      "step": 1,
      "sectorOrTopic": "Sector or project name the question was about",
      "userQuestion": "What the buyer asked, plain words, MAX 15 WORDS",
      "groundRealityVerdict": "What the assistant answered, MAX 25 WORDS",
      "badge": "SECTOR_PIVOT" | "LEGAL_CHECK" | "BUDGET_TEST" | "WATER_AUDIT" | "VERTICAL_TRANSIT" | "PROJECT_DEEP_DIVE"
    }
  ],
  "tradeOffDilemma": {
    "optionA": { "name": "Project or sector A", "advantage": "Max 12 words", "drawback": "Max 12 words" },
    "optionB": { "name": "Project or sector B", "advantage": "Max 12 words", "drawback": "Max 12 words" },
    "verdictRecommendation": "1 sentence naming the core choice"
  }
}

Rules:
- One step per distinct buyer question, in the order asked, covering the WHOLE conversation (up to ${MAX_TRAIL_STEPS} steps). Merge repeats. Skip greetings and the request for this summary.
- Every verdict restates what the assistant said in the transcript. Never add a figure, date, name or claim that is not in it. If the assistant said it did not have the information, say that.
- Mark "SECTOR_PIVOT" when the buyer moved to a different sector.
- Only fill "tradeOffDilemma" when the transcript itself weighs two options against each other; otherwise null.
- Plain English, no marketing words. Output ONLY valid JSON.`

/**
 * Dual-engine narrative extractor:
 * 1. Structured LLM call (Groq, then Gemini) under one shared deadline.
 * 2. Deterministic extractor if both fail, time out, cool down, or the output
 *    fails the integrity check.
 */
export async function extractDossierNarrative(
  messages: MessageItem[],
  targetProjects: Array<{ name: string; sector?: string | null }> = []
): Promise<DossierNarrative> {
  const cleanMessages = (messages ?? []).filter(m => m.content && m.content.trim().length > 0)
  if (cleanMessages.length === 0) return extractDeterministicNarrative([], targetProjects)

  const deadline = Date.now() + NARRATIVE_DEADLINE_MS
  const contextText = compactTranscript(cleanMessages)
  const beforeDeadline = <T>(p: Promise<T>) =>
    Promise.race([p, new Promise<null>(resolve => setTimeout(() => resolve(null), Math.max(0, deadline - Date.now())))])

  const providers: Array<{ key: string; enabled: boolean; call: () => Promise<string | undefined> }> = [
    {
      key: `GROQ_API_KEY:${MODELS.GROQ_SMART}`,
      enabled: !!process.env.GROQ_API_KEY,
      call: async () => {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
        const res = await groq.chat.completions.create({
          model: MODELS.GROQ_SMART,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: contextText },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1800,
          temperature: 0.1,
        })
        return res.choices[0]?.message?.content?.trim()
      },
    },
    {
      key: `GEMINI_API_KEY:${MODELS.GEMINI_LITE}`,
      enabled: !!process.env.GEMINI_API_KEY,
      call: async () => {
        const client = meteredClient({ apiKey: process.env.GEMINI_API_KEY, endpoint: 'dossier-narrative' })
        const res = await client.models.generateContent({
          model: MODELS.GEMINI_LITE,
          contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nCONVERSATION TRANSCRIPT:\n${contextText}` }] }],
          config: { maxOutputTokens: 1800, temperature: 0.1, responseMimeType: 'application/json' },
        })
        return res.text?.trim()
      },
    },
  ]

  for (const provider of providers) {
    if (!provider.enabled || isCoolingDown(provider.key) || Date.now() >= deadline) continue
    try {
      const text = await beforeDeadline(provider.call())
      if (!text) continue
      recordSuccess(provider.key)
      const narrative = normalise(JSON.parse(text))
      if (narrative && (await isGrounded(narrative, contextText))) return narrative
    } catch (err) {
      recordFailure(provider.key, err)
      console.warn(`[dossierNarrativeExtractor] ${provider.key} failed, falling back:`, (err as Error).message)
    }
  }

  return extractDeterministicNarrative(cleanMessages, targetProjects)
}
