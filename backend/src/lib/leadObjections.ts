// backend/src/lib/leadObjections.ts
//
// What is stopping this buyer, in their own words, for the Lead Brief.
//
// `LeadObjection` had no writer, so every brief's objections were empty and
// `suggested_opening` was always null (admin audit, 3 Nov 2026). This reads the
// buyer's own messages in the chat that produced the lead and keeps, per
// category the brief already knows (lib/leadBrief.ts suggestOpening), the one
// message that raises it, most concerned first. Deterministic: no model call,
// nothing inferred beyond "the buyer said this". Competitor names are scrubbed
// when the brief is rendered for a builder; phone-like digit runs are removed here.
import { prisma } from './db'

export type ObjectionCategory = 'possession' | 'price' | 'legal' | 'financing' | 'location' | 'product_mix'

const TOPICS: Array<[ObjectionCategory, RegExp]> = [
  ['possession', /\b(possession|handover|hand over|delay(?:ed|s)?|stuck|stalled|on time|completion date|ready by)\b/i],
  ['price', /\b(expensive|overpriced|over budget|out of (?:my )?budget|cheaper|discount|negotiat\w*|mehe?nga|too (?:high|costly|much)|price (?:is )?(?:high|too))\b/i],
  ['legal', /\b(rera|litigation|legal|court|nclt|insolven\w*|title|occupancy certificate|approvals?|land dues|complaints?)\b/i],
  ['financing', /\b(home loan|loan|emi|bank|down ?payment|financ\w*|pre-?approv\w*)\b/i],
  ['location', /\b(metro|commute|traffic|far from|connectivity|water ?logging|flood\w*|noise|pollution|aqi)\b/i],
  ['product_mix', /\b(carpet area|super area|loading|layout|floor plan|too small|smaller|bigger|configuration|balcon\w*)\b/i],
]

/** Words that turn a mention into a concern. */
const CONCERN = /\b(worr\w*|concern\w*|risk\w*|problem|issue|safe|scared|afraid|doubt\w*|not sure|hesitant|catch|go wrong|too|delay\w*|stuck|why so|is it (?:ok|fine|legit)|should i)\b|\?/i

export interface ExtractedObjection {
  category: ObjectionCategory
  text: string
  confidence: number
  messageId: string | null
}

/** Pure: the objections a list of the buyer's messages raises, one per category. */
export function extractObjections(messages: ReadonlyArray<{ id?: string | null; content: string }>): ExtractedObjection[] {
  const best = new Map<ObjectionCategory, ExtractedObjection>()
  for (const m of messages) {
    const text = (m.content ?? '').replace(/\+?\d[\d\s-]{6,}\d/g, '[number]').replace(/\s+/g, ' ').trim()
    if (text.length < 4) continue
    for (const [category, re] of TOPICS) {
      if (!re.test(text)) continue
      const confidence = CONCERN.test(text) ? 0.8 : 0.5
      const prev = best.get(category)
      // The most concerned message wins; on a tie, the later one (closer to the lead).
      if (!prev || confidence >= prev.confidence) {
        best.set(category, { category, text: text.length > 200 ? `${text.slice(0, 197)}...` : text, confidence, messageId: m.id ?? null })
      }
    }
  }
  return [...best.values()].sort((a, b) => b.confidence - a.confidence)
}

/**
 * Records the objections for a new callback from its chat. Never throws: a lead
 * must not fail because its brief could not be enriched.
 */
export async function recordLeadObjections(lead: { id: string; projectSlug?: string | null; projectName?: string | null; sessionId?: string | null }): Promise<number> {
  try {
    if (!lead.sessionId || !lead.projectSlug) return 0
    const messages = await prisma.chatMessage.findMany({
      where: { session_id: lead.sessionId, role: 'user' },
      orderBy: { created_at: 'asc' },
      select: { id: true, content: true },
      take: 60,
    })
    const found = extractObjections(messages)
    if (!found.length) return 0
    await prisma.leadObjection.createMany({
      data: found.map((o) => ({
        callback_request_id: lead.id,
        project_slug: lead.projectSlug as string,
        project_name: lead.projectName ?? null,
        reason_category: o.category,
        reason_text: o.text,
        confidence_score: o.confidence,
        extracted_from_message_id: o.messageId,
      })),
    })
    return found.length
  } catch (err) {
    console.warn('[LEAD_OBJECTIONS] not recorded:', err instanceof Error ? err.message : err)
    return 0
  }
}
