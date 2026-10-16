import { prisma } from '../db'

/**
 * "Can I trust Supertech?" / "Supertech pe bharosa kar sakte hain?"
 *
 * Neither phrasing reached the builder's record. The English one landed in the
 * main lane only because it also said "delayed projects"; the Hinglish one and
 * "How reliable is Antriksh?" fell into the open lane and were answered with
 * no builder row at all (Day 2 benchmark, H7). A trust word plus a builder we
 * hold, or the word builder/developer, is a question about that builder's
 * track record, in either language.
 */
const TRUST =
  /\b(can\s+i\s+trust|should\s+i\s+trust|trust(?:worthy|ed)?|reliable|reliability|bharos[ae]|bharosemand|vishwas)\b/i
const BUILDER_WORD = /\b(builder|developer|promoter)s?\b/i

// Words that name the kind of company, not which one. "Supertech Limited" is
// called "Supertech" by every buyer.
const GENERIC = /\b(group|limited|ltd|pvt|private|developers?|buildtech|buildteck|buildwell|buildcon|builders?|projects?|infrastructure|infratech|infracon|realty|realtech|realtors|homes|homz|housing|india|properties|estates|associates|corp|company|construction|building|the)\b/gi

// Cores too common in ordinary sentences to read as a builder name.
const AMBIGUOUS = new Set(['ncr', 'rise', 'spring', 'golden', 'express', 'royal', 'patel', 'max', 'test'])

/** The name a buyer would type: "Supertech Limited" -> "supertech". */
export function builderCore(name: string): string {
  return name.replace(/\(.*?\)/g, ' ').replace(GENERIC, ' ').replace(/[^a-z0-9&\s]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** The builder this text names, longest match first; null when none. */
export function builderNamedIn<T extends { name: string }>(text: string, builders: readonly T[]): T | null {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9&\s]/g, ' ')} `
  let best: T | null = null
  let bestLen = 0
  for (const b of builders) {
    const core = builderCore(b.name)
    if (core.length < 3 || AMBIGUOUS.has(core)) continue
    if (lower.includes(` ${core} `) && core.length > bestLen) {
      best = b
      bestLen = core.length
    }
  }
  return best
}

let names: { name: string }[] = []
let loadedAt = 0
const TTL_MS = 10 * 60 * 1000

async function builderNames(): Promise<{ name: string }[]> {
  if (Date.now() - loadedAt > TTL_MS) {
    try {
      names = await prisma.builder.findMany({ select: { name: true } })
      loadedAt = Date.now()
    } catch (e) {
      // A missing list only costs the named-builder branch; the trust word
      // with "builder"/"developer" still routes.
      console.warn('[BUILDER_TRUST] builder list unavailable:', (e as Error).message)
    }
  }
  return names
}

/** Pure: does this text ask whether a builder can be trusted? */
export function asksBuilderTrust(text: string, builders: readonly { name: string }[]): boolean {
  if (!TRUST.test(text)) return false
  return BUILDER_WORD.test(text) || builderNamedIn(text, builders) !== null
}

export async function isBuilderTrustQuestion(text: string): Promise<boolean> {
  if (!TRUST.test(text)) return false
  return asksBuilderTrust(text, await builderNames())
}
