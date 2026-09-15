import { prisma } from './db'

export interface LeadProfile {
  budget_cr?: { min: number | null; max: number | null }
  bhk?: number | null
  purpose?: string | null
  possession_pref?: string | null
  timeline?: string | null
  loan_pre_approved?: boolean | null
  preferred_sector?: string | null
  work_location?: string | null
  engagement?: { projects_viewed: number; projects_saved: number }
  ai_summary?: string | null
}

export async function loadLeadProfile(
  userId?: string | null,
  guestToken?: string | null,
): Promise<LeadProfile> {
  if (!userId && !guestToken) return {}
  const mem = await prisma.userMemory.findFirst({
    where: userId ? { user_id: userId } : { guest_token: guestToken! },
  }).catch(() => null)
  if (!mem) return {}
  return {
    budget_cr: { min: mem.budget_min_cr ?? null, max: mem.budget_max_cr ?? null },
    bhk: mem.bhk_preference ?? null,
    purpose: mem.purpose ?? null,
    possession_pref: mem.possession_pref ?? null,
    timeline: mem.timeline_months ? `${mem.timeline_months}m` : null,
    loan_pre_approved: mem.home_loan_pre_approved ?? null,
    preferred_sector: mem.sector_preference ?? null,
    work_location: mem.work_location ?? null,
    engagement: {
      projects_viewed: mem.viewed_slugs?.length ?? 0,
      projects_saved: mem.saved_slugs?.length ?? 0,
    },
    ai_summary: mem.summary_text ?? null,
  }
}

export function scoreLead(args: {
  loanPreApproved?: boolean | null
  intentTier?: string | null
  projectFitsBudget?: boolean
  savedCount?: number
  viewedCount?: number
  sectorMatches?: boolean
}): { score: number; tier: 'HOT' | 'WARM' | 'COLD' } {
  let s = 0
  if (args.loanPreApproved) s += 30
  if (args.intentTier === 'immediate') s += 25
  else if (args.intentTier === '1-3-months') s += 15
  if (args.projectFitsBudget) s += 20
  if ((args.savedCount ?? 0) >= 2 && (args.viewedCount ?? 0) >= 3) s += 15
  else s += Math.min(15, (args.savedCount ?? 0) * 5)
  if (args.sectorMatches) s += 10
  const tier = s >= 70 ? 'HOT' : s >= 40 ? 'WARM' : 'COLD'
  return { score: s, tier }
}

/**
 * A one-line digest of what we actually know about a buyer.
 *
 * `UserMemory.summary_text` — the column `ai_summary` reads — has no writer
 * anywhere in this codebase and is null on all 1,110 rows, so every lead alert
 * has carried an empty summary. Rather than add an LLM call to the revenue
 * path to generate prose, this composes the fields we already hold. Every
 * clause is a stored value; an absent field is omitted, never guessed.
 *
 * Returns null when we hold nothing, so the caller can leave the field empty
 * rather than send a line that says nothing.
 */
export function summarizeProfile(p: LeadProfile): string | null {
  const parts: string[] = []

  if (p.bhk) parts.push(`${p.bhk}BHK`)

  const { min, max } = p.budget_cr ?? {}
  if (min && max) parts.push(`₹${min}–${max} cr`)
  else if (max) parts.push(`up to ₹${max} cr`)
  else if (min) parts.push(`from ₹${min} cr`)

  if (p.preferred_sector) parts.push(p.preferred_sector)
  if (p.work_location) parts.push(`works near ${p.work_location}`)
  if (p.purpose) parts.push(p.purpose === 'investment' ? 'investment' : 'end use')
  if (p.possession_pref) parts.push(`possession: ${p.possession_pref}`)
  if (p.timeline) parts.push(`timeline ${p.timeline}`)
  if (p.loan_pre_approved) parts.push('loan pre-approved')

  const viewed = p.engagement?.projects_viewed ?? 0
  const saved = p.engagement?.projects_saved ?? 0
  if (viewed || saved) parts.push(`viewed ${viewed}, saved ${saved}`)

  return parts.length ? parts.join(' · ') : null
}

/**
 * The buyer's own last few questions, verbatim.
 *
 * This is the thing a salesperson actually wants before dialling and the one
 * thing no derived field can stand in for. Read straight from the transcript —
 * no model, no paraphrase, nothing invented.
 */
export async function loadRecentQuestions(sessionId?: string | null, limit = 3): Promise<string[]> {
  if (!sessionId) return []
  const messages = await prisma.chatMessage.findMany({
    where: { session_id: sessionId, role: 'user' },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: { content: true },
  }).catch(() => [])

  return messages
    .map((m) => m.content.trim().replace(/\s+/g, ' '))
    .filter((c) => c.length > 0)
    .map((c) => (c.length > 200 ? `${c.slice(0, 197)}...` : c))
    .reverse() // oldest first: reads as the conversation ran
}
