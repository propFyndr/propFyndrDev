// backend/src/lib/ai/memory.ts
import { prisma } from '../db'
import type { Intent } from '../discovery'

export interface MemoryContext {
  bhk_preference?: number | null
  budget_max_cr?: number | null
  sector_preference?: string | null
  purpose?: string | null
  work_location?: string | null
  possession_pref?: string | null
  viewed_slugs: string[]
}

const POSSESSION_WORDS: Record<string, string> = {
  immediate: 'ready to move',
  '1year': 'possession within a year',
  '2year': 'possession within two years',
  '3year+': 'possession in three years or more',
}

/**
 * What we hold about a buyer, one line per stored field. Only stored fields appear,
 * so "what do you remember about me" can never say more than the row does.
 */
export function describeProfile(mem: MemoryContext): string[] {
  const out: string[] = []
  if (mem.bhk_preference) out.push(`${mem.bhk_preference} BHK`)
  if (mem.budget_max_cr) out.push(`budget up to ₹${mem.budget_max_cr} Cr`)
  if (mem.sector_preference) out.push(`interested in ${mem.sector_preference}`)
  if (mem.work_location) out.push(`works near ${mem.work_location}`)
  if (mem.possession_pref) out.push(POSSESSION_WORDS[mem.possession_pref] ?? mem.possession_pref)
  if (mem.purpose) out.push(mem.purpose === 'investment' ? 'buying as an investment' : 'buying to live in')
  return out
}

/** The same profile as a sentence the buyer can send back as their own requirements. */
export function profileAsRequest(mem: MemoryContext): string | null {
  const parts: string[] = []
  parts.push(mem.bhk_preference ? `${mem.bhk_preference} BHK` : 'flats')
  if (mem.budget_max_cr) parts.push(`under ₹${mem.budget_max_cr} Cr`)
  if (mem.work_location) parts.push(`near my office in ${mem.work_location}`)
  else if (mem.sector_preference) parts.push(`in ${mem.sector_preference}`)
  if (mem.possession_pref) parts.push(POSSESSION_WORDS[mem.possession_pref] ?? '')
  return parts.length > 1 ? `Show me ${parts.filter(Boolean).join(', ')}` : null
}

export async function getMemory(userId?: string, guestToken?: string): Promise<MemoryContext | null> {
  if (!userId && !guestToken) return null
  try {
    const mem = await prisma.userMemory.findFirst({
      where: userId ? { user_id: userId } : { guest_token: guestToken },
    })
    if (!mem) return null
    return {
      bhk_preference: mem.bhk_preference,
      budget_max_cr: mem.budget_max_cr,
      sector_preference: mem.sector_preference,
      purpose: mem.purpose,
      work_location: mem.work_location,
      possession_pref: mem.possession_pref,
      viewed_slugs: (mem.viewed_slugs as string[]) ?? [],
    }
  } catch {
    return null
  }
}

export async function upsertMemory(
  userId: string | undefined,
  guestToken: string | undefined,
  intent: Intent,
  viewedSlugs: string[]
): Promise<void> {
  if (!userId && !guestToken) return

  const where = userId ? { user_id: userId } : { guest_token: guestToken }
  const existing = await prisma.userMemory.findFirst({ where })
  const merged = [...new Set([...(existing?.viewed_slugs as string[] ?? []), ...viewedSlugs])]

  const data: Record<string, unknown> = { viewed_slugs: merged }
  if (intent.bhk?.length) data.bhk_preference = intent.bhk[0]
  if (intent.budgetMin !== undefined) data.budget_min_cr = intent.budgetMin
  if (intent.budgetMax !== undefined) data.budget_max_cr = intent.budgetMax
  if (intent.sector && /^Sector \d{1,3}$/i.test(intent.sector) && intent.sector.length <= 15) {
    data.sector_preference = intent.sector
  }
  if (intent.purpose) data.purpose = intent.purpose
  if (typeof intent.workplace === 'string' && intent.workplace.trim() && intent.workplace.length <= 60) {
    data.work_location = intent.workplace.trim()
  }
  if (intent.possession) data.possession_pref = intent.possession

  try {
    if (existing) {
      await prisma.userMemory.update({ where: { id: existing.id }, data })
    } else {
      const createData = {
        ...data,
        ...(userId ? { user_id: userId } : { guest_token: guestToken }),
      }
      await prisma.userMemory.create({ data: createData as Parameters<typeof prisma.userMemory.create>[0]['data'] })
    }
  } catch (err) {
    console.warn('[memory] upsert failed:', (err as Error).message)
  }
}
