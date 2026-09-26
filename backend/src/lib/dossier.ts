// backend/src/lib/dossier.ts
//
// The dossier: a snapshot of one chat — every question the buyer asked, what
// they were told, and what we hold on the projects they looked at — behind a
// public link they can send to anyone.
//
// One builder for both entry points (the chat handler and POST
// /api/v1/dossier/create). They used to be two copies of this logic, and the
// copies had drifted: different strengths, different checklists.
//
// Everything on it is from this project's own rows, stated plainly, or marked
// as an assumption. It is the document a buyer forwards to their spouse, their
// CA, their lawyer — so it says "not on record" rather than filling a gap.

import crypto from 'crypto'
import { prisma } from './db'
import { calculateAffordabilityBreakdown } from './chat/handlers/affordabilityHandler'
import {
  extractDossierNarrative,
  type ConsultationStep,
  type TradeOffDilemma,
} from './chat/dossierNarrativeExtractor'
import { MARKET_QUALIFIER } from './factPresentation'

const CRORE = 10_000_000
export const DOSSIER_TTL_DAYS = 30
export const MAX_DOSSIER_PROJECTS = 5

/**
 * Used only when a project holds no all-in cost multiplier, and always shown
 * with MARKET_QUALIFIER beside it. Same figure calculateAffordabilityBreakdown
 * defaults to.
 */
export const ASSUMED_LANDED_MULTIPLIER = 1.30

export type Reactions = Record<string, { likes: number; concerns: string[] }>

export interface DossierProjectItem {
  id: string
  name: string
  slug: string
  sector: string
  city: string
  builderName: string | null
  status: string
  possessionLabel: string | null
  priceRangeLabel: string | null
  priceMinCr: number | null
  reraNumber: string | null
  heroImageUrl: string | null
  strengths: string[]
  redFlags: string[]
  financials: null | {
    basePriceCr: number
    landedCostCr: number
    /** The multiplier used. */
    landedMultiplier: number
    /** True when the project holds no multiplier and ASSUMED_LANDED_MULTIPLIER was used. */
    landedCostAssumed: boolean
    /** Set when landedCostAssumed — the words to show beside the figure. */
    landedCostQualifier: string | null
    downpaymentCr: number
    loanCr: number
    standardEmi: number
    taxShieldMonthly: number
    netMonthlyEmi: number
    safeMonthlyIncome: number
  }
  siteVisitChecklist: string[]
}

export interface Dossier {
  token: string
  createdAt: string
  expiresAt: string
  consultation: {
    /** Only ever what the buyer typed. Absent means absent. */
    preparedFor?: string
    date: string
    /** Derived from the projects on this dossier, not from a stated preference. */
    areasCovered?: string
    targetBhk?: string
    /** The buyer's stated budget. Never a project's price range. */
    budgetLabel?: string
    notes?: string
    searchEvolutionSummary?: string
  }
  consultationTrail: ConsultationStep[]
  tradeOffDilemma?: TradeOffDilemma | null
  projects: DossierProjectItem[]
  reactions: Reactions
}

/** What the buyer has told us, from the turn's intent or from UserMemory. */
export interface BuyerCriteria {
  budgetMinCr?: number | null
  budgetMaxCr?: number | null
  bhk?: number[] | null
}

const PROJECT_SELECT = {
  id: true,
  name: true,
  slug: true,
  sector: true,
  city: true,
  status: true,
  possession_label: true,
  price_range_label: true,
  price_min_cr: true,
  rera_number: true,
  hero_image_url: true,
  amitabh_kant_clearance: true,
  lift_act_compliant: true,
  water_source_type: true,
  water_tds_range: true,
  shahdara_drain_impact: true,
  oc_status: true,
  all_in_cost_multiplier: true,
  builder: { select: { name: true, average_delay_months: true } },
} as const

type ProjectRow = {
  id: string
  name: string
  slug: string
  sector: string
  city: string
  status: string
  possession_label: string | null
  price_range_label: string | null
  price_min_cr: number | null
  rera_number: string | null
  hero_image_url: string | null
  amitabh_kant_clearance: boolean | null
  lift_act_compliant: boolean | null
  water_source_type: string | null
  water_tds_range: string | null
  shahdara_drain_impact: boolean | null
  oc_status: string | null
  all_in_cost_multiplier: number | null
  builder: { name: string; average_delay_months: number | null } | null
}

export const sectorLabel = (s: string) => (/^sector\b/i.test(s.trim()) ? s.trim() : `Sector ${s.trim()}`)

const crore = (n: number) => (n >= 1 ? `₹${+n.toFixed(2)} Cr` : `₹${Math.round(n * 100)} L`)

// ── Per-project content ─────────────────────────────────────────────────────

export function extractStrengths(p: ProjectRow): string[] {
  const pros: string[] = []
  if (p.water_source_type === 'GANGA_JAL') pros.push('Municipal Ganga Jal water supply on record.')
  if (p.amitabh_kant_clearance === true) pros.push('Authority land dues recorded as cleared under the Amitabh Kant package.')
  if (p.oc_status === 'FULL_OC') pros.push('Full occupancy certificate on record.')
  if (p.lift_act_compliant === true) pros.push('Lifts recorded as registered under the UP Lifts and Escalators Act 2024.')
  if (p.shahdara_drain_impact === false) pros.push('Recorded as outside the Shahdara drain corridor.')
  const delay = p.builder?.average_delay_months
  if (delay != null && delay <= 3) {
    pros.push(delay === 0 ? "Builder's recorded average delivery delay: none." : `Builder's recorded average delivery delay: ${delay} months.`)
  }
  return pros.slice(0, 4)
}

export function extractRedFlags(p: ProjectRow): string[] {
  const cons: string[] = []
  if (p.amitabh_kant_clearance === false) {
    cons.push('Authority land dues recorded as not cleared under the Amitabh Kant package — registry can be delayed.')
  }
  if (p.water_source_type === 'BOREWELL') {
    cons.push(`Borewell water${p.water_tds_range ? ` (TDS ${p.water_tds_range})` : ''} — plan for RO filtration.`)
  }
  if (p.shahdara_drain_impact === true) cons.push('Recorded as near the Shahdara drain corridor — odour and corrosion are known concerns.')
  if (p.lift_act_compliant === false) cons.push('Lifts not yet recorded as registered under the UP Lifts Act 2024.')
  if (p.all_in_cost_multiplier != null && p.all_in_cost_multiplier >= 1.30) {
    cons.push(`Recorded all-in cost is +${Math.round((p.all_in_cost_multiplier - 1) * 100)}% over the base price.`)
  }
  const delay = p.builder?.average_delay_months
  if (delay != null && delay > 6) cons.push(`Builder's recorded average delivery delay: about ${delay} months.`)
  if (cons.length === 0) {
    // Absence of a caution record is not a clean bill: most of these columns
    // are null because nobody has researched them yet.
    cons.push('We hold no caution records for this project. That means not researched, not cleared — check on site before paying a token.')
  }
  return cons.slice(0, 4)
}

export function buildSiteVisitChecklist(p: ProjectRow): string[] {
  const checklist: string[] = []
  checklist.push(
    p.amitabh_kant_clearance === false
      ? 'Ask for the challan showing the 25% Authority dues deposit.'
      : 'Ask for the latest Authority sub-lease registry schedule.',
  )
  checklist.push(
    p.lift_act_compliant === false
      ? 'Ask for the UP Lifts and Escalators Act 2024 registration certificate or filing reference.'
      : 'Ask to see the lift AMC and the latest annual safety inspection certificate.',
  )
  if (p.water_source_type === 'BOREWELL' || p.water_tds_range?.includes('>')) {
    checklist.push('Ask for the STP and RO plant test certificate with current TDS readings.')
  } else if (p.water_source_type === 'GANGA_JAL') {
    checklist.push('Ask to see the Ganga Jal connection and meter, and check water pressure on an upper floor.')
  } else {
    checklist.push('Ask which source supplies the tower (municipal or borewell) and for a recent TDS test report.')
  }
  checklist.push('Ask for the RERA-approved plans to check the carpet area you are quoted.')
  return checklist
}

function buildFinancials(p: ProjectRow): DossierProjectItem['financials'] {
  // No price on record, no financials: never price a building we do not hold a figure for.
  if (!p.price_min_cr) return null
  const assumed = p.all_in_cost_multiplier == null
  const multiplier = p.all_in_cost_multiplier ?? ASSUMED_LANDED_MULTIPLIER
  const fin = calculateAffordabilityBreakdown({ basePrice: p.price_min_cr * CRORE, multiplier })
  return {
    basePriceCr: p.price_min_cr,
    landedCostCr: parseFloat((fin.totalLandedCost / CRORE).toFixed(2)),
    landedMultiplier: multiplier,
    landedCostAssumed: assumed,
    landedCostQualifier: assumed ? `assumes ${Math.round((multiplier - 1) * 100)}% over base price, ${MARKET_QUALIFIER}` : null,
    downpaymentCr: parseFloat((fin.downpaymentAmount / CRORE).toFixed(2)),
    loanCr: parseFloat((fin.loanPrincipal / CRORE).toFixed(2)),
    standardEmi: fin.standardEmi,
    taxShieldMonthly: fin.monthlyTaxShieldSec24b,
    netMonthlyEmi: fin.netMonthlyOutflow,
    safeMonthlyIncome: fin.safeMonthlyTakeHome,
  }
}

export function toDossierProject(p: ProjectRow): DossierProjectItem {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sector: p.sector,
    city: p.city,
    // null, not a label. Calling an unknown developer "Verified Developer"
    // asserts a check we never ran, about a third party, in writing.
    builderName: p.builder?.name ?? null,
    status: p.status,
    possessionLabel: p.possession_label,
    priceRangeLabel: p.price_range_label,
    priceMinCr: p.price_min_cr,
    reraNumber: p.rera_number,
    heroImageUrl: p.hero_image_url || null,
    strengths: extractStrengths(p),
    redFlags: extractRedFlags(p),
    financials: buildFinancials(p),
    siteVisitChecklist: buildSiteVisitChecklist(p),
  }
}

// ── Which projects ──────────────────────────────────────────────────────────

type Msg = { role: 'user' | 'assistant'; content: string }

/**
 * Projects named in the given text, earliest first. Longest names claim their
 * span first, so "Gaur City 2" does not also count as "Gaur City".
 */
export function findProjectMentions(
  text: string,
  catalog: ReadonlyArray<{ id: string; name: string }>,
): Array<{ id: string; at: number }> {
  const escape = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const spans: Array<{ start: number; end: number; id: string }> = []
  const sorted = [...catalog].sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))
  for (const proj of sorted) {
    // Short names ("Ace", "One") collide with ordinary words.
    if (!proj.name || proj.name.trim().length < 4) continue
    const re = new RegExp(`\\b${escape(proj.name.trim())}\\b`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const start = m.index
      const end = start + m[0].length
      if (!spans.some(s => Math.max(s.start, start) < Math.min(s.end, end))) spans.push({ start, end, id: proj.id })
    }
  }
  return spans.sort((a, b) => a.start - b.start).map(s => ({ id: s.id, at: s.start }))
}

/**
 * The projects the buyer actually engaged with, not every project the
 * assistant happened to list. Signals, strongest first:
 *   focus project (the chat was anchored on it) · saved · named by the buyer ·
 *   named in this turn's intent · reacted to with interest or concern.
 * The last cards shown are used only when none of those exist.
 */
export function rankProjects(signals: {
  focusId?: string | null
  savedIds?: string[]
  buyerMentions?: Array<{ id: string; at: number }>
  intentIds?: string[]
  reactedIds?: string[]
  shownIds?: string[]
}): string[] {
  const score = new Map<string, { pts: number; first: number }>()
  let order = 0
  const bump = (id: string, pts: number, first = order++) => {
    const cur = score.get(id)
    if (cur) cur.pts += pts
    else score.set(id, { pts, first })
  }
  if (signals.focusId) bump(signals.focusId, 5)
  for (const id of signals.savedIds ?? []) bump(id, 4)
  for (const m of signals.buyerMentions ?? []) bump(m.id, 3)
  for (const id of signals.intentIds ?? []) bump(id, 3)
  for (const id of signals.reactedIds ?? []) bump(id, 2)
  if (score.size === 0) for (const id of signals.shownIds ?? []) bump(id, 1)

  return [...score.entries()]
    .sort((a, b) => b[1].pts - a[1].pts || a[1].first - b[1].first)
    .slice(0, MAX_DOSSIER_PROJECTS)
    .sort((a, b) => a[1].first - b[1].first)
    .map(([id]) => id)
}

async function collectSessionSignals(
  sessionId: string,
  userId: string | null | undefined,
  guestToken: string | null | undefined,
  messages: Msg[],
) {
  const [session, catalog, saved] = await Promise.all([
    prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { focus_project_id: true, last_projects: true, property_reactions: true },
    }),
    prisma.project.findMany({ select: { id: true, name: true } }),
    // SavedProperty keys guests as `guest_<token>` in user_id — see memoryKeyFor.
    userId || guestToken
      ? prisma.savedProperty.findMany({
          where: { user_id: { in: [userId, guestToken ? `guest_${guestToken}` : null].filter(Boolean) as string[] } },
          select: { project_id: true },
        })
      : Promise.resolve([]),
  ])

  const buyerText = messages.filter(m => m.role === 'user').map(m => m.content).join('\n')
  const reactions = Array.isArray(session?.property_reactions) ? (session!.property_reactions as any[]) : []
  return {
    catalog,
    focusId: session?.focus_project_id ?? null,
    savedIds: saved.map(s => s.project_id),
    buyerMentions: findProjectMentions(buyerText, catalog),
    reactedIds: reactions
      .filter(r => r && typeof r.projectId === 'string' && (r.sentiment === 'interested' || r.sentiment === 'concerned'))
      .map(r => r.projectId as string),
    shownIds: Array.isArray(session?.last_projects) ? (session!.last_projects as string[]).filter(Boolean) : [],
  }
}

// ── Buyer criteria ──────────────────────────────────────────────────────────

function budgetLabel(c: BuyerCriteria): string | undefined {
  if (c.budgetMinCr != null && c.budgetMaxCr != null) return `${crore(c.budgetMinCr)} – ${crore(c.budgetMaxCr)}`
  if (c.budgetMaxCr != null) return `Up to ${crore(c.budgetMaxCr)}`
  if (c.budgetMinCr != null) return `From ${crore(c.budgetMinCr)}`
  return undefined
}

async function criteriaFromMemory(userId?: string | null, guestToken?: string | null): Promise<BuyerCriteria> {
  if (!userId && !guestToken) return {}
  const mem = await prisma.userMemory
    .findFirst({
      where: userId ? { user_id: userId } : { guest_token: guestToken! },
      select: { budget_min_cr: true, budget_max_cr: true, bhk_preference: true },
    })
    .catch(() => null)
  if (!mem) return {}
  return {
    budgetMinCr: mem.budget_min_cr,
    budgetMaxCr: mem.budget_max_cr,
    bhk: mem.bhk_preference ? [mem.bhk_preference] : null,
  }
}

// ── Build and store ─────────────────────────────────────────────────────────

export interface BuildDossierInput {
  sessionId?: string | null
  userId?: string | null
  guestToken?: string | null
  /** Explicit shortlist (ids or slugs). When given, session signals are not used to pick projects. */
  projectIds?: string[]
  /** Project names from this turn's intent. */
  intentProjectNames?: string[]
  /** The turn's intent, which already carries memory. Falls back to UserMemory when absent. */
  criteria?: BuyerCriteria
  preparedFor?: string
  notes?: string
  /** Explicit overrides from an API caller. */
  budgetLabel?: string
  targetBhk?: string
}

export type BuildDossierResult =
  | { ok: true; dossier: Dossier; questionCount: number; previousReactions: Array<{ name: string; likes: number; concerns: string[] }> }
  | { ok: false; reason: 'NO_PROJECTS' }

export async function buildDossier(input: BuildDossierInput): Promise<BuildDossierResult> {
  const messages: Msg[] = input.sessionId
    ? (
        await prisma.chatMessage.findMany({
          where: { session_id: input.sessionId },
          orderBy: { created_at: 'asc' },
          select: { role: true, content: true },
        })
      ).map(m => ({ role: m.role as Msg['role'], content: m.content || '' }))
    : []

  let orderedIds: string[] = []
  if (input.projectIds?.length) {
    const rows = await prisma.project.findMany({
      where: { OR: [{ id: { in: input.projectIds } }, { slug: { in: input.projectIds } }] },
      select: { id: true },
      take: MAX_DOSSIER_PROJECTS,
    })
    orderedIds = rows.map(r => r.id)
  } else if (input.sessionId) {
    const s = await collectSessionSignals(input.sessionId, input.userId, input.guestToken, messages)
    // An intent name may be the full name or a fragment ("godrej woods" vs
    // "Godrej Woods Phase 2"); a fragment counts only when it names one project.
    const intentIds = (input.intentProjectNames ?? []).flatMap(n => {
      const exact = findProjectMentions(n, s.catalog).map(m => m.id)
      if (exact.length) return exact
      const q = n.trim().toLowerCase()
      const partial = q.length >= 4 ? s.catalog.filter(c => c.name?.toLowerCase().includes(q)) : []
      return partial.length === 1 ? [partial[0].id] : []
    })
    orderedIds = rankProjects({ ...s, intentIds })
  }

  const rows = orderedIds.length
    ? ((await prisma.project.findMany({ where: { id: { in: orderedIds } }, select: PROJECT_SELECT })) as unknown as ProjectRow[])
    : []
  rows.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id))

  // No shortlist, no dossier. The newest catalogue rows are not the buyer's
  // shortlist, and this document is forwarded to other people.
  if (rows.length === 0) return { ok: false, reason: 'NO_PROJECTS' }

  const criteria = input.criteria ?? (await criteriaFromMemory(input.userId, input.guestToken))
  const narrative = await extractDossierNarrative(messages, rows)

  const areas = Array.from(new Set(rows.map(p => `${sectorLabel(p.sector)}, ${p.city}`)))

  const token = crypto.randomBytes(16).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DOSSIER_TTL_DAYS * 86400 * 1000)

  const dossier: Dossier = {
    token,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    consultation: {
      preparedFor: input.preparedFor?.trim().slice(0, 80) || undefined,
      date: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      areasCovered: areas.join(' · '),
      targetBhk: input.targetBhk || (criteria.bhk?.length ? criteria.bhk.map(b => `${b} BHK`).join(' / ') : undefined),
      budgetLabel: input.budgetLabel || budgetLabel(criteria),
      notes: input.notes?.trim().slice(0, 500) || undefined,
      searchEvolutionSummary: narrative.searchEvolutionSummary,
    },
    consultationTrail: narrative.consultationTrail,
    tradeOffDilemma: narrative.tradeOffDilemma,
    projects: rows.map(toDossierProject),
    reactions: {},
  }

  // What people said on this chat's earlier dossiers, for the buyer to hear.
  const previous = input.sessionId ? await sessionReactions(input.sessionId) : []

  await prisma.dossier.create({
    data: {
      token,
      session_id: input.sessionId || null,
      user_id: input.userId || null,
      guest_token: input.guestToken || null,
      payload: dossier as any,
      expires_at: expiresAt,
    },
  })

  return { ok: true, dossier, questionCount: narrative.consultationTrail.length, previousReactions: previous }
}

/** A live dossier with its current reactions, or null when unknown or expired. */
export async function loadDossier(token: string): Promise<Dossier | null> {
  const row = await prisma.dossier.findUnique({ where: { token } })
  if (!row || row.expires_at.getTime() <= Date.now()) return null
  return { ...(row.payload as unknown as Dossier), reactions: (row.reactions as Reactions) ?? {} }
}

export async function addReaction(
  token: string,
  projectId: string,
  type: 'LIKE' | 'CONCERN',
  note?: string,
): Promise<Reactions | null> {
  const dossier = await loadDossier(token)
  if (!dossier || !dossier.projects.some(p => p.id === projectId)) return null

  // ponytail: read-modify-write, so two reactions in the same instant can lose
  // one. Move to a jsonb_set UPDATE if reaction volume ever makes that real.
  const current: Reactions = { ...dossier.reactions }
  const entry = current[projectId] ?? { likes: 0, concerns: [] }
  if (type === 'LIKE') entry.likes += 1
  else if (entry.concerns.length < 20) {
    entry.concerns.push(typeof note === 'string' && note.trim() ? note.trim().slice(0, 100) : 'Flagged a concern')
  }
  current[projectId] = entry
  await prisma.dossier.update({ where: { token }, data: { reactions: current as any } })
  return current
}

/**
 * Reactions left on this chat's live dossiers, summed per project. Written by
 * anyone holding a link, so callers must treat the concern text as untrusted.
 */
export async function sessionReactions(sessionId: string): Promise<Array<{ name: string; likes: number; concerns: string[] }>> {
  const rows = await prisma.dossier
    .findMany({
      where: { session_id: sessionId, expires_at: { gt: new Date() } },
      select: { payload: true, reactions: true },
      orderBy: { created_at: 'desc' },
      take: 10,
    })
    .catch(() => [])
  const byProject = new Map<string, { name: string; likes: number; concerns: string[] }>()
  for (const row of rows) {
    const projects = (row.payload as unknown as Dossier)?.projects ?? []
    for (const [pid, r] of Object.entries((row.reactions as Reactions) ?? {})) {
      const name = projects.find(p => p.id === pid)?.name
      if (!name || !r) continue
      const cur = byProject.get(pid) ?? { name, likes: 0, concerns: [] }
      cur.likes += r.likes ?? 0
      cur.concerns.push(...(r.concerns ?? []))
      byProject.set(pid, cur)
    }
  }
  return [...byProject.values()].filter(r => r.likes > 0 || r.concerns.length > 0)
}
