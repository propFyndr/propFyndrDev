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
  /\b(can\s+i\s+trust|should\s+i\s+trust|trust(?:worthy|ed)?|reliable|reliability|safe|bharos[ae]|bharosemand|vishwas)\b/i
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

/** Every builder this text names, by core name, without one inside another. */
export function buildersNamedIn<T extends { name: string }>(text: string, builders: readonly T[]): T[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9&\s]/g, ' ')} `
  const hits = builders
    .map((b) => ({ b, core: builderCore(b.name) }))
    .filter(({ core }) => core.length >= 3 && !AMBIGUOUS.has(core) && lower.includes(` ${core} `))
    .sort((x, y) => y.core.length - x.core.length)
  const kept: { b: T; core: string }[] = []
  for (const h of hits) if (!kept.some((k) => k.core.includes(h.core))) kept.push(h)
  return kept.map((k) => k.b)
}

/**
 * Questions about a builder's record rather than a home search: "Supertech ke
 * projects ka kya scene hai", "what has Gaursons delivered", "compare Mahagun
 * and Gaursons". The full-name match ("Mahagun Group") missed every one of
 * them, and the answer said we hold no data on builders we do.
 */
const RECORD =
  /\b(scene|status|track\s*record|record|delivered|delivery|deliver|possession|delays?|delayed|history|reputation|kaisa|kaise|kaisi|projects?\s+(?:ka|ki|ke)|compare|vs|versus|better|behtar|accha)\b/i

/** Pure: does this text ask about a builder's record (trust, delivery, comparison)? */
export function asksBuilderTrust(text: string, builders: readonly { name: string }[], projectNamed = false): boolean {
  if (TRUST.test(text)) return BUILDER_WORD.test(text) || builderNamedIn(text, builders) !== null
  // A builder we hold, named with record words and no home-search shape.
  // "Godrej Palm Retreat possession" names a project: that is the project's question.
  if (projectNamed) return false
  return RECORD.test(text) && builderNamedIn(text, builders) !== null && !/\b\d\s*bhk\b|\bsector\s*\d|\bunder\s+\d/i.test(text)
}

export async function isBuilderTrustQuestion(text: string, projectNamed = false): Promise<boolean> {
  if (!TRUST.test(text) && !RECORD.test(text)) return false
  return asksBuilderTrust(text, await builderNames(), projectNamed)
}

/** Does this text name a builder we hold, by core name ("Godrej", not "Godrej Properties")? */
export async function namesHeldBuilder(text: string): Promise<boolean> {
  return builderNamedIn(text, await builderNames()) !== null
}
