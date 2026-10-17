/**
 * What buyers are asking about, for the admin Conversations "Entity Intelligence"
 * panel, counted from real chat turns.
 *
 * The first version looked hardcoded because it barely moved (17 Oct 2026): it
 * scanned only the first 120 of 381 projects, the last 4,000 messages ever with
 * no time window, counted a project only on its exact full name, matched
 * "Sector 1" inside "Sector 150", counted messages rather than conversations, and
 * ranked whole messages verbatim, so chip texts and "test" runs filled the list.
 *
 * Counts are distinct conversations. Sectors and requirements come from the
 * intent stored on each user turn (what the router understood), not from text
 * matching; project mentions are word-bounded name matches plus the project a
 * conversation focused on.
 */

export interface IntelMessage {
  session_id: string
  content: string
  intent_snapshot: unknown
}

export interface IntelProject { id: string; name: string; slug: string; sector: string }

type Count = { count: number; sessions: Set<string> }

const GREETING_OR_FOLLOW_UP = /^\s*(?:hi+|hello|hey|yes|yeah|yep|no|ok(?:ay)?|sure|nice|thanks?|thank you|next|go on|continue|step\s*\d+|test(?:ing)?)\b(?:[\s,?.!]+(?:please|sure|thanks|show me|go ahead|do it|go on))*[\s?.!]*$/i
const SECTOR_IN_TEXT = /\bsector[\s-]*(\d{1,3}[a-z]?)\b/gi
const AREAS: Array<[RegExp, string]> = [
  [/\b(?:greater\s+noida\s+west|noida\s+extension|gnw)\b/i, 'Greater Noida West'],
  [/\bgreater\s+noida\b(?!\s+west)/i, 'Greater Noida'],
  [/\byamuna\s+expressway|yeida|jewar\b/i, 'Yamuna Expressway / Jewar'],
  [/\b(?:noida\s+expressway|noida[-\s]greater\s+noida\s+expressway)\b/i, 'Noida Expressway'],
  [/\bcentral\s+noida\b/i, 'Central Noida'],
]

function bump(map: Map<string, Count>, key: string, session: string) {
  const c = map.get(key) ?? { count: 0, sessions: new Set<string>() }
  c.sessions.add(session)
  c.count = c.sessions.size
  map.set(key, c)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "Panchsheel Greens 1 & 2" is also asked for as "Panchsheel Greens". */
function namePatterns(name: string): RegExp[] {
  const full = name.trim()
  const base = full.replace(/\s+(?:phase\s+)?(?:\d+|i{1,3}|iv|v)(?:\s*(?:&|and)\s*(?:\d+|i{1,3}))?$/i, '').trim()
  return [...new Set([full, base])]
    .filter((n) => n.length >= 5)
    .map((n) => new RegExp(`\\b${escape(n.toLowerCase())}\\b`, 'i'))
}

function normaliseSector(raw: string): string {
  const m = /sector[\s-]*(\d{1,3}[a-z]?)/i.exec(raw)
  return m ? `Sector ${m[1].toUpperCase()}` : raw.split(',')[0].trim()
}

/** Budget bands a buyer would recognise, from the stored ceiling in crore. */
function budgetBand(max: number): string {
  if (max < 0.5) return 'Under ₹50 L'
  if (max <= 0.8) return '₹50–80 L'
  if (max <= 1.2) return '₹80 L–1.2 Cr'
  if (max <= 1.8) return '₹1.2–1.8 Cr'
  if (max <= 2.5) return '₹1.8–2.5 Cr'
  return 'Above ₹2.5 Cr'
}

/** "Show me 3BHK in Sector 150 under 1.5 cr" and "show me 2bhk in sector 76 under 90 lakh" are one kind of question. */
export function normaliseQuestion(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 9 || t.length > 160 || GREETING_OR_FOLLOW_UP.test(t)) return null
  return t
    .toLowerCase()
    .replace(/[?!.,]+/g, '')
    .replace(/₹|rs\.?\s*/g, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:cr|crore|crores|l|lakh|lakhs|lac|lacs)\b/g, '<amount>')
    .replace(/\bsector[\s-]*\d+[a-z]?\b/g, 'sector <n>')
    .replace(/\b\d\s*bhk\b/g, '<n> bhk')
    .trim()
}

export function computeEntityIntelligence(
  messages: IntelMessage[],
  projects: IntelProject[],
  focusBySession: Map<string, string>,
) {
  const projectHits = new Map<string, Count>()
  const sectorHits = new Map<string, Count>()
  const questionHits = new Map<string, Count & { example: string }>()
  const bhkHits = new Map<string, Count>()
  const budgetHits = new Map<string, Count>()
  const possessionHits = new Map<string, Count>()

  const patterns = projects.map((p) => ({ p, res: namePatterns(p.name) }))
  const byId = new Map(projects.map((p) => [p.id, p]))

  for (const [session, projectId] of focusBySession) {
    const p = byId.get(projectId)
    if (p) bump(projectHits, p.id, session)
  }

  for (const m of messages) {
    const text = m.content ?? ''
    const lower = text.toLowerCase()
    for (const { p, res } of patterns) if (res.some((r) => r.test(lower))) bump(projectHits, p.id, m.session_id)

    const intent = (m.intent_snapshot ?? {}) as { sector?: string; bhk?: number[]; budgetMax?: number; possession?: string }
    const sectors = new Set<string>()
    if (typeof intent.sector === 'string' && intent.sector.trim()) sectors.add(normaliseSector(intent.sector))
    for (const s of text.matchAll(SECTOR_IN_TEXT)) sectors.add(`Sector ${s[1].toUpperCase()}`)
    for (const [re, label] of AREAS) if (re.test(text)) sectors.add(label)
    for (const s of sectors) bump(sectorHits, s, m.session_id)

    if (Array.isArray(intent.bhk)) for (const b of intent.bhk) if (Number.isFinite(b)) bump(bhkHits, `${b} BHK`, m.session_id)
    if (typeof intent.budgetMax === 'number' && intent.budgetMax > 0) bump(budgetHits, budgetBand(intent.budgetMax), m.session_id)
    if (typeof intent.possession === 'string') bump(possessionHits, intent.possession === 'immediate' ? 'Ready to move' : 'Under construction OK', m.session_id)

    const q = normaliseQuestion(text)
    if (q) {
      const c = questionHits.get(q) ?? { count: 0, sessions: new Set<string>(), example: text.trim() }
      c.sessions.add(m.session_id)
      c.count = c.sessions.size
      questionHits.set(q, c)
    }
  }

  const top = <T>(map: Map<string, Count & T>, n: number) =>
    [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, n)

  return {
    topProjects: top(projectHits, 20).map(([id, c]) => {
      const p = byId.get(id)!
      return { id, name: p.name, slug: p.slug, sector: p.sector, count: c.count }
    }),
    topSectors: top(sectorHits, 20).map(([sector, c]) => ({ sector, count: c.count })),
    // Asked in more than one conversation; one-off questions are noise in a "frequent" list.
    topQueries: top(questionHits, 40).filter(([, c]) => c.count > 1).slice(0, 15).map(([, c]) => ({ query: c.example, count: c.count })),
    topRequirements: {
      bhk: top(bhkHits, 6).map(([label, c]) => ({ label, count: c.count })),
      budget: top(budgetHits, 6).map(([label, c]) => ({ label, count: c.count })),
      possession: top(possessionHits, 2).map(([label, c]) => ({ label, count: c.count })),
    },
  }
}
