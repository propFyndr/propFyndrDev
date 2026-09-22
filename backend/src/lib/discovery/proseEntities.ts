import { prisma } from '../db'
import { projectCatalog } from '../projectCatalog'
import { ChipAction, chip } from './conversationEngine'
import { buildTopicChips } from './topicChips'

/**
 * Find projects that the assistant named in prose.
 * DB-grounded: a name only counts if a Project row actually matches it,
 * so a hallucinated name can never become a chip (CLAUDE.md: never invent data).
 */
export async function findProjectsMentioned(
  text: string,
  _city?: string,
  limit = 4,
): Promise<Array<{ id: string; name: string }>> {
  if (!text || text.length < 10) return []
  try {
    // Cached. This ran an unbounded findMany after every open-lane answer, on a
    // turn that had already scanned the same table twice — and it sits between
    // the model finishing and the buyer seeing any text, so it was pure
    // time-to-first-token.
    const candidates = await projectCatalog()
    const haystack = text.toLowerCase()
    const hits: Array<{ id: string; name: string }> = []
    for (const p of candidates) {
      if (!p.name || p.name.length < 4) continue
      if (haystack.includes(p.name.toLowerCase())) hits.push({ id: p.id, name: p.name })
      if (hits.length >= limit) break
    }
    return hits
  } catch (e) {
    console.warn('[proseEntities] project match failed', e)
    return []
  }
}

/**
 * Which of the extractor's guessed project names correspond to a real row.
 *
 * `intent.projectNames` is an LLM guess, not a verified reference. Any capitalised
 * noun phrase can land there — a brokerage ("Wealth Clinic"), a bank, a person.
 * Treating that guess as a project reference sent those queries into the project
 * detail pipeline, which found nothing and offered inventory in an unrelated
 * sector. Callers should verify before routing on it.
 */
export async function resolveProjectNames(
  names: string[] | undefined,
  _city?: string,
): Promise<string[]> {
  if (!names?.length) return []
  try {
    const rows = await prisma.project.findMany({
      where: {
        OR: names.map((n) => ({ name: { contains: n, mode: 'insensitive' as const } })),
      },
      select: { name: true },
    })
    if (rows.length === 0) return []
    const found = rows.map((r) => r.name.toLowerCase())
    return names.filter((n) =>
      found.some((f) => f.includes(n.toLowerCase()) || n.toLowerCase().includes(f)),
    )
  } catch (e) {
    console.warn('[proseEntities] project name resolution failed', e)
    return []
  }
}

/** Escape a project name before it goes into a RegExp — names carry '&', '(', '.', '-'. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Turn every DB-matched project name in the text into a clickable entity link.
 *
 * Skips names already linked, so it is safe to run over text that went through
 * this once. `alreadyCarded` holds ids rendered as cards on the same turn — those
 * names are left as plain text, since a link next to the card is noise.
 */
export function linkProjectNames(
  text: string,
  mentioned: Array<{ id: string; name: string }>,
  alreadyCarded: Set<string> = new Set(),
): string {
  let out = text
  for (const entity of mentioned) {
    if (alreadyCarded.has(entity.id)) continue
    if (out.includes(`](#entity:${entity.id})`)) continue
    // Explicit boundaries rather than \b: a name ending in a non-word character
    // ("M3M (Phase 1)") has no word boundary after it, so \b never matches and the
    // name silently stays unlinked.
    const pattern = new RegExp(`(?<![A-Za-z0-9\\[])${escapeRegExp(entity.name)}(?:\\s+(?:I{1,3}|IV|V|VI{0,3}|IX|X|Phase\\s+\\d+|Extension))?(?![A-Za-z0-9\\]])`, 'g')
    out = out.replace(pattern, (match) => `[${match}](#entity:${entity.id})`)
  }
  return out
}

/** Sectors the assistant named, in the order they appear. */
export function findSectorsMentioned(text: string, limit = 3): string[] {
  const hits = text.match(/\bSector\s+\d+[A-Za-z]?\b/gi) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of hits) {
    const normalized = raw.replace(/\s+/g, ' ').trim()
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
    if (out.length >= limit) break
  }
  return out
}

/**
 * Every sector a BUYER named, including the ones they did not repeat the word
 * "Sector" in front of.
 *
 * `findSectorsMentioned` reads the assistant's own prose, where each sector is
 * written out in full, so requiring the literal word is right there. A buyer
 * does not write that way: "Which is better for a family: Sector 74, 75, 76 or
 * 78?" names four sectors and the strict pattern finds one. That undercount
 * fed the market table the wrong scope, and the buyer got a city-wide table
 * that did not contain three of the four sectors they had asked about.
 *
 * So a bare number is taken as a sector only when it FOLLOWS an explicit one
 * in the same enumeration — commas, "and", "or", "vs". A number anywhere else
 * ("3 BHK", "under 2 crore", "within 5 years") is left alone.
 */
export function findSectorsAsked(text: string, limit = 8): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (n: string) => {
    const label = `Sector ${n.toUpperCase()}`
    if (seen.has(label.toLowerCase()) || out.length >= limit) return
    seen.add(label.toLowerCase())
    out.push(label)
  }

  // "Sector 74, 75, 76 or 78" / "sector 150 vs 128" — one anchor, then the run.
  const enumeration = /\bsectors?\s+(\d+[A-Za-z]?(?:\s*(?:,|and|or|vs\.?|versus|&)\s*\d+[A-Za-z]?)*)/gi
  for (const m of text.matchAll(enumeration)) {
    for (const n of m[1].split(/\s*(?:,|and|or|vs\.?|versus|&)\s*/i)) {
      const t = n.trim()
      if (t) push(t)
    }
  }
  return out
}

/**
 * Chips for an answer that returned no cards, built from what the answer actually
 * said. A generic "show projects there" is dead weight when the reply named no
 * place; a chip naming the sector the user just read about is one tap from cards.
 */
export function buildOpenAnswerChips(
  projects: Array<{ id: string; name: string }>,
  sectors: string[],
  /**
   * The question, for the topic top-up.
   *
   * Without it this returns `[]` whenever the answer named neither a project nor
   * a sector — which is every entity answer, every "what do you know about me"
   * and every refusal. Those are precisely the shapes that scored 1/5 and 2/5 on
   * chips in the 30 Aug audit. Optional so existing callers keep working; a
   * caller that omits it gets the old behaviour and the old score.
   */
  topUp?: { userMessage: string; city: string; hasBudget?: boolean },
): ChipAction[] {
  const out: ChipAction[] = []
  let priority = 1

  for (const sector of sectors.slice(0, 2)) {
    out.push(chip(
      `TEXT_MESSAGE:open_sector:${sector.replace(/\s+/g, '_')}`,
      'TEXT_MESSAGE', `Projects in ${sector}`,
      { text: `Show me projects in ${sector}` },
      priority++,
    ))
  }

  if (projects.length >= 2) {
    out.push(chip(
      `COMPARE_PROPERTIES:open_compare:${projects.map(p => p.id).join(':')}`,
      'COMPARE_PROPERTIES', `Compare these ${projects.length}`,
      { mode: 'multi', projects },
      priority++,
    ))
  } else if (projects.length === 1) {
    out.push(chip(
      `TEXT_MESSAGE:open_project:${projects[0].id}`,
      'TEXT_MESSAGE', `About ${projects[0].name}`,
      { text: `Tell me about ${projects[0].name}` },
      priority++,
    ))
  }

  if (sectors.length >= 2) {
    out.push(chip(
      `TEXT_MESSAGE:open_sector_compare:${sectors.slice(0, 2).join('_').replace(/\s+/g, '_')}`,
      'TEXT_MESSAGE', `${sectors[0]} vs ${sectors[1]}`,
      { text: `Compare ${sectors[0]} with ${sectors[1]}` },
      priority++,
    ))
  }

  if (topUp && out.length < 2) {
    const seen = new Set(out.map((c) => c.label.toLowerCase()))
    out.push(
      ...buildTopicChips(
        topUp.userMessage,
        { sector: sectors[0] ?? null, hasBudget: Boolean(topUp.hasBudget), city: topUp.city },
        3 - out.length,
        seen,
      ),
    )
  }

  return out
}

/** Zero-typing actions for projects the assistant named but did not return as cards. */
export function buildProseChips(projects: Array<{ id: string; name: string }>): ChipAction[] {
  if (projects.length === 0) return []
  const pIds = projects.map(p => p.id).join(':')
  const out: ChipAction[] = []

  if (projects.length >= 2) {
    out.push(chip(`COMPARE_PROPERTIES:prose_compare:${pIds}`, 'COMPARE_PROPERTIES',
      `Compare these ${projects.length}`, { mode: 'multi', projects }, 1))
  }
  out.push(
    chip(`TEXT_MESSAGE:prose_tradeoffs:${pIds}`, 'TEXT_MESSAGE', 'What are the trade-offs?',
      { actionPrefix: 'What are the main trade-offs, risks and downsides of', projects, actionSuffix: '?' }, 2),
    chip(`CALCULATE_EMI:prose_emi:${pIds}`, 'CALCULATE_EMI', 'Calculate EMI',
      { projects }, 3),
    chip(`TEXT_MESSAGE:prose_rera:${pIds}`, 'TEXT_MESSAGE', 'Check RERA status',
      { actionPrefix: 'Show the RERA registration and legal standing of', projects }, 4),
  )
  return out
}
