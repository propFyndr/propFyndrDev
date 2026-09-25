import { checkAnswerIntegrity } from '../ai/answerIntegrity'
// backend/src/lib/chat/dossierNarrativeExtractor.ts
import Groq from 'groq-sdk'
import { meteredClient } from '../ai/geminiMeter'
import { isCoolingDown, recordFailure } from '../ai/providerCooldown'
import { MODELS } from '../config'

export type ConsultationBadge =
  | 'SECTOR_PIVOT'
  | 'LEGAL_CHECK'
  | 'BUDGET_TEST'
  | 'WATER_AUDIT'
  | 'VERTICAL_TRANSIT'
  | 'PROJECT_DEEP_DIVE'

export interface ConsultationStep {
  step: number
  sectorOrTopic: string
  userQuestion: string          // Max 15 words: plain, simple buyer inquiry
  groundRealityVerdict: string  // Max 25 words: unvarnished factual finding
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
 * Trims words to a hard ceiling for ultra-clean plain-English presentation
 */
function limitWords(str: string, maxWords: number): string {
  const words = str.trim().split(/\s+/)
  if (words.length <= maxWords) return str.trim()
  return words.slice(0, maxWords).join(' ') + '...'
}

/**
 * Deterministic rule-based fallback extractor running in <5ms with 0 tokens.
 * Scans question turns, extracts sector shifts, and pairs key verdicts.
 */
export function extractDeterministicNarrative(
  messages: MessageItem[],
  targetProjects: Array<{ name: string; sector?: string | null }> = []
): DossierNarrative {
  const steps: ConsultationStep[] = []
  const userTurns = messages.filter(m => m.role === 'user' && m.content && m.content.trim().length > 3)

  let previousSector: string | null = null
  let stepIndex = 1

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role !== 'user') continue

    const q = msg.content.trim()
    const qLower = q.toLowerCase()

    // Ignore trivial final commands asking for the dossier itself
    if (
      /\b(?:memo|dossier|summarize|summary|recap|share with family)\b/i.test(qLower) &&
      qLower.split(/\s+/).length <= 8
    ) {
      continue
    }

    // Find the immediate assistant reply
    let reply = ''
    for (let j = i + 1; j < messages.length; j++) {
      if (messages[j].role === 'assistant') {
        reply = messages[j].content
        break
      }
    }

    // Extract first meaningful sentence of the answer
    const cleanReplySentence = reply
      .replace(/###?\s+[^\n]+/g, '')
      .replace(/\*\*[^*]+\*\*/g, match => match.replace(/\*/g, ''))
      .split(/[.?!]\s+/)[0]
      ?.trim() || 'No answer recorded for this question.'

    // Identify sector mentions in this question
    const sectorMatch = q.match(/\bsector\s*([0-9]+[a-z]?)\b/i)
    const currentSector = sectorMatch ? `Sector ${sectorMatch[1]}` : null

    // Determine category badge and topic
    let badge: ConsultationBadge = 'PROJECT_DEEP_DIVE'
    let topicName = currentSector || 'Property Research'

    if (currentSector && previousSector && currentSector.toLowerCase() !== previousSector.toLowerCase()) {
      badge = 'SECTOR_PIVOT'
      topicName = `Pivot to ${currentSector}`
    } else if (/\b(?:registry|court|receiver|dues|nclt|litigation|clearance|legal)\b/i.test(qLower)) {
      badge = 'LEGAL_CHECK'
      topicName = currentSector ? `${currentSector} Legal Standing` : 'Legal & Registry Standing'
    } else if (/\b(?:water|tds|ganga|borewell)\b/i.test(qLower)) {
      badge = 'WATER_AUDIT'
      topicName = currentSector ? `${currentSector} Water Quality` : 'Water Supply & TDS Audit'
    } else if (/\b(?:lift|elevator|lift act|transit)\b/i.test(qLower)) {
      badge = 'VERTICAL_TRANSIT'
      topicName = currentSector ? `${currentSector} Elevator Safety` : 'UP Lifts Act Safety'
    } else if (/\b(?:budget|price|cost|emi|salary|crore|cr|lakh)\b/i.test(qLower)) {
      badge = 'BUDGET_TEST'
      topicName = currentSector ? `${currentSector} Pricing` : 'Budget & Financial Outflow'
    } else {
      // Check if matches any target project name
      const proj = targetProjects.find(p => qLower.includes(p.name.toLowerCase()))
      if (proj) {
        topicName = proj.name
      }
    }

    if (currentSector) {
      previousSector = currentSector
    }

    steps.push({
      step: stepIndex++,
      sectorOrTopic: topicName,
      userQuestion: limitWords(q, 15),
      groundRealityVerdict: limitWords(cleanReplySentence, 25),
      badge,
    })

    if (steps.length >= 5) break
  }

  // Collect unique sectors mentioned in chronological order
  const sectorTrail: string[] = []
  for (const s of steps) {
    const m = s.sectorOrTopic.match(/Sector\s*[0-9]+[a-z]?/i) || s.userQuestion.match(/Sector\s*[0-9]+[a-z]?/i)
    if (m && !sectorTrail.includes(m[0])) {
      sectorTrail.push(m[0])
    }
  }

  // Synthesize executive search evolution summary
  let searchEvolutionSummary =
    'Explored property options across Noida and Greater Noida West, evaluating construction progress, price bands, and regulatory compliance.'
  if (sectorTrail.length >= 2) {
    searchEvolutionSummary = `Inquiry originated around ${sectorTrail[0]}, evaluating core connectivity, before expanding into ${sectorTrail[sectorTrail.length - 1]}.`
  } else if (sectorTrail.length === 1) {
    searchEvolutionSummary = `Inquiry focused around ${sectorTrail[0]}.`
  } else if (steps.length >= 2) {
    const firstTopic = steps[0].sectorOrTopic
    const lastTopic = steps[steps.length - 1].sectorOrTopic
    if (firstTopic !== lastTopic) {
      searchEvolutionSummary = `Inquiry originated around ${firstTopic}, evaluating core connectivity, before expanding into ${lastTopic}.`
    }
  }

  // No deterministic trade-off: with only names and sectors in hand, any
  // advantage/drawback written here would be invented, and this document is
  // shared with the buyer's family. Only the LLM path, grounded in the
  // transcript, may produce one.
  const tradeOffDilemma: TradeOffDilemma | null = null

  return {
    searchEvolutionSummary,
    consultationTrail: steps.length > 0 ? steps : [
      {
        step: 1,
        sectorOrTopic: targetProjects[0]?.sector ? `Sector ${targetProjects[0].sector}` : 'Noida Region',
        userQuestion: 'Requested institutional consultation and deal dossier for shortlisted homes.',
        groundRealityVerdict: 'Shortlist compiled from PropFyndr project records.',
        badge: 'PROJECT_DEEP_DIVE',
      }
    ],
    tradeOffDilemma,
  }
}

/** LLM JSON is untrusted: a partial dilemma would crash the dossier page. */
function validDilemma(d: any): TradeOffDilemma | null {
  const side = (o: any) => o && typeof o.name === 'string' && typeof o.advantage === 'string' && typeof o.drawback === 'string'
  return d && side(d.optionA) && side(d.optionB) && typeof d.verdictRecommendation === 'string' ? d : null
}

/**
 * The dossier is a public, 30-day document forwarded to the buyer's family, so
 * the model's prose goes through the same integrity scan as a chat answer,
 * against the transcript it was written from. Any violation falls back to the
 * deterministic narrative, which only restates what was said.
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
 * Dual-Engine Narrative Extractor:
 * 1. Tries structured LLM call (Groq Llama 3.3 70B or Gemini Flash Lite) under a strict 2,500ms deadline.
 * 2. Falls back to deterministic extractor instantly if LLM times out or is cooling down.
 */
export async function extractDossierNarrative(
  messages: MessageItem[],
  targetProjects: Array<{ name: string; sector?: string | null }> = []
): Promise<DossierNarrative> {
  if (!messages || messages.length === 0) {
    return extractDeterministicNarrative([], targetProjects)
  }

  // Filter messages to conversation turns
  const cleanMessages = messages
    .filter(m => m.content && m.content.trim().length > 0)
    .slice(-12) // Keep up to last 12 messages for concise context

  // One 2.5s budget across both providers, not 2.5s each.
  const deadline = Date.now() + 2500
  const contextText = cleanMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')

  const systemPrompt = `You are an institutional real estate consultation recorder for PropFyndr.
Analyze the buyer's conversation history and return a pure JSON object summarizing their consultation journey.

Output JSON Format:
{
  "searchEvolutionSummary": "2 clear sentences explaining the buyer's search progression, sector pivot, and key criteria.",
  "consultationTrail": [
    {
      "step": 1,
      "sectorOrTopic": "Sector or Project Name (e.g., Sector 76 Noida)",
      "userQuestion": "What the buyer asked in plain simple terms (MAX 15 WORDS)",
      "groundRealityVerdict": "Unvarnished ground reality found in chat (MAX 25 WORDS)",
      "badge": "SECTOR_PIVOT" | "LEGAL_CHECK" | "BUDGET_TEST" | "WATER_AUDIT" | "VERTICAL_TRANSIT" | "PROJECT_DEEP_DIVE"
    }
  ],
  "tradeOffDilemma": {
    "optionA": { "name": "Project or Sector A", "advantage": "Max 12 words", "drawback": "Max 12 words" },
    "optionB": { "name": "Project or Sector B", "advantage": "Max 12 words", "drawback": "Max 12 words" },
    "verdictRecommendation": "1 sentence summarizing the core dilemma decision"
  }
}

Rules:
- Keep all text extremely crisp, plain English, and zero marketing fluff.
- If the buyer changed sectors (e.g. from Sector 76 to Sector 10), mark badge "SECTOR_PIVOT".
- If no trade-off dilemma exists, set "tradeOffDilemma" to null.
- Output ONLY valid JSON.`

  // 1. Try Groq (Ultra-fast inference ~400-800ms)
  if (process.env.GROQ_API_KEY && !isCoolingDown(`GROQ_API_KEY:${MODELS.GROQ_SMART}`)) {
    try {
      const groqPromise = (async () => {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
        const res = await groq.chat.completions.create({
          model: MODELS.GROQ_SMART,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contextText },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 600,
          temperature: 0.1,
        })
        const text = res.choices[0]?.message?.content?.trim()
        if (text) return JSON.parse(text) as DossierNarrative
        return null
      })()

      // 2,500ms hard deadline
      const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), Math.max(0, deadline - Date.now())))
      const result = await Promise.race([groqPromise, timeoutPromise])

      if (result && Array.isArray(result.consultationTrail) && result.consultationTrail.length > 0) {
        const narrative: DossierNarrative = {
          searchEvolutionSummary: result.searchEvolutionSummary || 'Explored property options and forensic findings.',
          consultationTrail: result.consultationTrail.map((s, idx) => ({
            step: idx + 1,
            sectorOrTopic: s.sectorOrTopic || 'Consultation Step',
            userQuestion: limitWords(s.userQuestion || '', 15),
            groundRealityVerdict: limitWords(s.groundRealityVerdict || '', 25),
            badge: s.badge || 'PROJECT_DEEP_DIVE',
          })),
          tradeOffDilemma: validDilemma(result.tradeOffDilemma),
        }
        if (await isGrounded(narrative, contextText)) return narrative
      }
    } catch (err) {
      console.warn('[dossierNarrativeExtractor] Groq inference failed, falling back:', (err as Error).message)
    }
  }

  // 2. Try Gemini Flash Lite if Groq is unavailable
  if (process.env.GEMINI_API_KEY && !isCoolingDown(`GEMINI_API_KEY:${MODELS.GEMINI_LITE}`)) {
    try {
      const geminiPromise = (async () => {
        const client = meteredClient({ apiKey: process.env.GEMINI_API_KEY, endpoint: 'dossier-narrative' })
        const res = await client.models.generateContent({
          model: MODELS.GEMINI_LITE,
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nCONVERSATION TRANSCRIPT:\n${contextText}` }] }],
          config: {
            maxOutputTokens: 600,
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        })
        const text = res.text?.trim()
        if (text) return JSON.parse(text) as DossierNarrative
        return null
      })()

      const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), Math.max(0, deadline - Date.now())))
      const result = await Promise.race([geminiPromise, timeoutPromise])

      if (result && Array.isArray(result.consultationTrail) && result.consultationTrail.length > 0) {
        const narrative: DossierNarrative = {
          searchEvolutionSummary: result.searchEvolutionSummary || 'Explored property options and forensic findings.',
          consultationTrail: result.consultationTrail.map((s, idx) => ({
            step: idx + 1,
            sectorOrTopic: s.sectorOrTopic || 'Consultation Step',
            userQuestion: limitWords(s.userQuestion || '', 15),
            groundRealityVerdict: limitWords(s.groundRealityVerdict || '', 25),
            badge: s.badge || 'PROJECT_DEEP_DIVE',
          })),
          tradeOffDilemma: validDilemma(result.tradeOffDilemma),
        }
        if (await isGrounded(narrative, contextText)) return narrative
      }
    } catch (err) {
      console.warn('[dossierNarrativeExtractor] Gemini inference failed, falling back:', (err as Error).message)
    }
  }

  // 3. Fallback to deterministic NLP extraction (<5ms, zero token cost)
  return extractDeterministicNarrative(cleanMessages, targetProjects)
}
