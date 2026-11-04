import { prisma } from '../../db'
import { matchProjectInText } from '../../discovery/matchProjectInText'
import type { ChatTopicHandler } from '../handlerContext'
import { focusedProject } from '../handlerContext'

/**
 * "What's the catch with X? What will the sales team not tell me?"
 *
 * One of the team's top beta questions. Left to the model it got the project's
 * facts block and a prompt rule, and a small free-tier model answered with
 * generic Noida caveats. The honest answer is mechanical: the negatives our
 * own rows show, each labelled as ours, and the gaps — what we do not hold —
 * as the questions to put to the sales team in writing. Nothing is inferred.
 */
export const ASKS_FOR_THE_CATCH =
  /\b(?:catch|downsides?|negatives?|cons\b|red\s*flags?|what(?:'s| is)\s+wrong|what\s+(?:could|can|might)\s+go\s+wrong|what\s+(?:are|is)\s+the\s+risks?\s+(?:of|in|with)\b|risks?\s+of\s+(?:buying|booking|investing)\b|safe(?:r)?\s+(?:to\s+buy|buy|bet)|hidden\s+(?:issues?|problems?)|(?:sales|builder)[^?]{0,30}\b(?:not|never|won'?t|wont)\s+tell|kya\s+(?:dikkat|problem|kami)|(?:how\s+many|any|number\s+of)\s+(?:up-?rera\s+|rera\s+)?complaints?(?!\s+about\b)|complaints?\s+(?:against|on|filed\s+against)|court\s+cases?|litigation|legal\s+(?:cases?|issues?|disputes?|trouble|problems?)|abeyance|\bnclt|insolvenc[ey])\b/i

const select = {
  name: true, status: true, possession_date: true, possession_label: true,
  oc_status: true, rera_number: true, rera_valid_until: true, project_risk_flag: true, litigation_count: true,
  ongoing_litigation_count: true, nclt_moratorium_active: true, location_concerns: true,
  flood_waterlogging_risk: true, amitabh_kant_clearance: true,
  registry_status: true, maintenance_per_sqft_monthly: true, water_source_type: true,
  builder: { select: { name: true, insolvency_history: true, legal_flag: true, delayed_projects_count: true } },
  unit_types: { select: { bhk: true, price_min_cr: true, price_per_sqft: true } },
} as const

type Row = NonNullable<Awaited<ReturnType<typeof loadProject>>>

function loadProject(id: string) {
  return prisma.project.findUnique({ where: { id }, select })
}

/** `legal_flag` stores the string 'none' for a clean record; that is not a flag. */
const isFlag = (f: string | null | undefined): f is string => Boolean(f) && !/^none$/i.test(f!.trim())
const humanFlag = (f: string) => f.replace(/_/g, ' ').toLowerCase()

/** Same BHK listed at per-sqft rates more than 15% apart: which one is current? */
function priceInconsistency(row: Row): string | null {
  const byBhk = new Map<number, number[]>()
  for (const u of row.unit_types) {
    if (typeof u.price_per_sqft !== 'number' || u.price_per_sqft <= 0) continue
    byBhk.set(u.bhk, [...(byBhk.get(u.bhk) ?? []), u.price_per_sqft])
  }
  for (const [bhk, rates] of byBhk) {
    const lo = Math.min(...rates)
    const hi = Math.max(...rates)
    if (rates.length > 1 && hi / lo > 1.15) {
      return `Our ${bhk} BHK rows for this project disagree on price: ₹${Math.round(lo).toLocaleString('en-IN')} to ₹${Math.round(hi).toLocaleString('en-IN')} per sq.ft. Ask which rate is current and get it on the cost sheet.`
    }
  }
  return null
}

/**
 * UP-RERA's own complaint counts for a project, as read from its summary page and APPROVED by a
 * person. Drafts are never read here (project_field_drafts is withheld, see projectExposure.ts):
 * only the row a reviewer marked approved, one field, one fixed sentence. Nothing is inferred.
 */
export interface ComplaintsRecord {
  project: number | null
  promoter: number | null
  readAt: Date
}

export async function loadComplaints(projectId: string): Promise<ComplaintsRecord | null> {
  const draft = await prisma.projectFieldDraft.findFirst({
    where: { project_id: projectId, field_name: 'rera_complaints', status: 'approved' },
    orderBy: { fetched_at: 'desc' },
    select: { proposed_value: true, fetched_at: true },
  })
  const v = draft?.proposed_value as { project_complaints?: unknown; promoter_complaints_total?: unknown } | undefined
  if (!draft || !v) return null
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
  const project = num(v.project_complaints)
  if (project === null) return null
  return { project, promoter: num(v.promoter_complaints_total), readAt: draft.fetched_at }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
const month = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`

/** An order UP-RERA published (JudgementView), staged by data-integrity stage 30 and APPROVED by a person. */
export interface OrderRecord {
  complaint_no: string
  bench: string
  order_date: string // dd-mm-yyyy as UP-RERA publishes it
  readAt: Date
}

export async function loadOrders(projectId: string): Promise<OrderRecord[]> {
  const drafts = await prisma.projectFieldDraft.findMany({
    where: { project_id: projectId, field_name: 'rera_orders', status: 'approved' },
    orderBy: { fetched_at: 'desc' },
    select: { proposed_value: true, fetched_at: true },
  })
  return drafts.flatMap((d) => {
    const v = d.proposed_value as Partial<OrderRecord> | null
    return v?.complaint_no && v.order_date ? [{ complaint_no: v.complaint_no, bench: v.bench ?? '', order_date: v.order_date, readAt: d.fetched_at }] : []
  })
}

/** "06-06-2025" -> "6 Jun 2025"; anything else is shown as published. */
const orderDay = (s: string) => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim())
  return m ? `${Number(m[1])} ${MONTHS[Number(m[2]) - 1]} ${m[3]}` : s
}

export interface RiskLine {
  key: 'registration' | 'complaints' | 'delay' | 'occupancy' | 'court' | 'abeyance'
  label: string
  text: string
  /** True when the line is a negative a buyer should act on. */
  flagged: boolean
  /** 'UP-RERA' for a public record we read; 'RealtyAsk record' for this project's own row. */
  source: 'UP-RERA' | 'RealtyAsk record' | null
  /** ISO date we read a public record. A public-record line without one is not shown. */
  readAt: string | null
}

const NOT_ON_RECORD = 'Not on record.'

/** The project page's box: the same six lines the chat shows. Null when the project does not exist. */
export async function loadRiskRecord(projectId: string, now: Date = new Date()): Promise<RiskLine[] | null> {
  const [row, complaints, orders] = await Promise.all([loadProject(projectId), loadComplaints(projectId), loadOrders(projectId)])
  return row ? riskRecord(row, complaints, orders, now) : null
}

/**
 * The "what could go wrong" record: six fixed lines, the same in chat and on the project page.
 * Each line comes from a stored row or an approved public record, or says "Not on record".
 * Nothing here reassures: an absent row is "Not on record", never "none" or "clean".
 */
export function riskRecord(row: Row, complaints: ComplaintsRecord | null, orders: OrderRecord[], now: Date = new Date()): RiskLine[] {
  const own = (key: RiskLine['key'], label: string, text: string, flagged: boolean): RiskLine =>
    ({ key, label, text, flagged, source: text === NOT_ON_RECORD ? null : 'RealtyAsk record', readAt: null })
  const out: RiskLine[] = []

  // Registration
  if (!row.rera_number) out.push(own('registration', 'Registration', 'We hold no UP-RERA registration number for it. Do not pay any amount until you have seen one.', true))
  else if (row.rera_valid_until && row.rera_valid_until.getTime() < now.getTime()) out.push(own('registration', 'Registration', `UP-RERA validity on record: ${day(row.rera_valid_until)}, which has passed. The registry may hold an extension we have not read; ask the builder for the current registration or the extension order.`, true))
  else if (row.rera_valid_until) out.push(own('registration', 'Registration', `${row.rera_number}, valid until ${day(row.rera_valid_until)} on our record.`, false))
  else out.push(own('registration', 'Registration', `${row.rera_number} on our record; its validity is not on record.`, false))

  // Complaints (public record, owner wording 4 Nov 2026)
  if (complaints && complaints.project !== null) {
    const n = complaints.project
    const promoter = complaints.promoter !== null ? ` and ${complaints.promoter} against the promoter` : ''
    out.push({ key: 'complaints', label: 'Complaints', text: `UP-RERA lists ${n} complaint${n === 1 ? '' : 's'} against this project${promoter}, read on ${day(complaints.readAt)}. A complaint is not a ruling.`, flagged: n > 0, source: 'UP-RERA', readAt: complaints.readAt.toISOString() })
  } else out.push(own('complaints', 'Complaints', NOT_ON_RECORD, false))

  // Delays
  const delayed = row.builder?.delayed_projects_count
  const builderDelay = typeof delayed === 'number' && delayed > 0 ? ` ${row.builder.name} has ${delayed} delayed project${delayed === 1 ? '' : 's'} on record.` : ''
  if (row.status !== 'ready_to_move' && row.possession_date && row.possession_date.getTime() < now.getTime()) {
    out.push(own('delay', 'Delays', `Possession date on record, ${month(row.possession_date)}, has passed and the project is not listed as ready.${builderDelay}`, true))
  } else if (builderDelay) out.push(own('delay', 'Delays', builderDelay.trim(), true))
  else if (row.status !== 'ready_to_move' && row.possession_date) out.push(own('delay', 'Delays', `Possession date on record: ${month(row.possession_date)}.`, false))
  else out.push(own('delay', 'Delays', NOT_ON_RECORD, false))

  // Occupancy certificate
  if (row.oc_status === 'FULL_OC') out.push(own('occupancy', 'Occupancy certificate', 'Full occupancy certificate on record.', false))
  else if (row.oc_status === 'PHASED_OC') out.push(own('occupancy', 'Occupancy certificate', 'Granted only for some towers on our record. Check that yours is one of them.', true))
  else if (row.oc_status === 'APPLIED') out.push(own('occupancy', 'Occupancy certificate', 'Applied for, not granted, on our record.', true))
  else if (row.status === 'ready_to_move') out.push(own('occupancy', 'Occupancy certificate', 'Listed as ready to move, but we hold no occupancy certificate for it. Registry cannot complete without one.', true))
  else out.push(own('occupancy', 'Occupancy certificate', NOT_ON_RECORD, false))

  // Court cases: stored counts, NCLT, and approved UP-RERA orders
  const court: string[] = []
  const litigation = row.ongoing_litigation_count ?? row.litigation_count
  if (typeof litigation === 'number' && litigation > 0) court.push(`${litigation} litigation case${litigation === 1 ? '' : 's'} on record against the project.`)
  if (row.nclt_moratorium_active) court.push('An NCLT moratorium is active on the project.')
  const latestRead = orders.reduce<Date | null>((a, o) => (!a || o.readAt > a ? o.readAt : a), null)
  for (const o of orders) court.push(`UP-RERA published an order on complaint ${o.complaint_no}${o.bench ? ` before ${o.bench.replace(/\s+/g, ' ')}` : ''}, dated ${orderDay(o.order_date)}, read on ${day(o.readAt)}.`)
  if (court.length) out.push({ key: 'court', label: 'Court cases', text: court.join(' '), flagged: true, source: orders.length ? 'UP-RERA' : 'RealtyAsk record', readAt: latestRead?.toISOString() ?? null })
  else if (litigation === 0) out.push(own('court', 'Court cases', 'None on record: our stored count is 0. A count we hold is not a court search.', false))
  else out.push(own('court', 'Court cases', NOT_ON_RECORD, false))

  // Abeyance: UP-RERA's list could not be read (it errored for every input on 4 Nov 2026), so we hold nothing.
  out.push(own('abeyance', 'Abeyance', NOT_ON_RECORD, false))
  return out
}

export function catchAnswer(row: Row, complaints: ComplaintsRecord | null = null, now: Date = new Date(), orders: OrderRecord[] = []): string {
  const found: string[] = []
  const gaps: string[] = []
  const underConstruction = row.status !== 'ready_to_move'

  if (underConstruction) {
    // A label like "Under Construction" is a status, not a date.
    const when = row.possession_date?.toISOString().slice(0, 7) ?? (/\d/.test(row.possession_label ?? '') ? row.possession_label : null)
    if (when) {
      found.push(`Still under construction. Possession on record: ${when}. Ask what the builder-buyer agreement says if that date slips.`)
    } else {
      found.push('Still under construction, and we hold no possession date for it.')
    }
  }
  if ((!row.oc_status || row.oc_status === 'NONE') && row.status !== 'ready_to_move') gaps.push('Which towers have an occupancy certificate, and when the rest are expected')
  found.push(...alsoOnRecord(row))

  if (!complaints) gaps.push('The number of complaints against the project on the UP-RERA portal, and what they were about')
  if (row.maintenance_per_sqft_monthly == null) gaps.push('The monthly maintenance (CAM) rate, and whether it is charged on super or carpet area')
  if (!row.water_source_type) gaps.push('The water source, and a recent TDS test report')
  if (row.amitabh_kant_clearance == null) gaps.push('Whether the developer has cleared the authority land dues (Amitabh Kant 25% clearance)')
  gaps.push('The carpet area of your exact unit, in writing, next to the super area')
  gaps.push('Every charge beyond the base price: PLC, parking, club, IFMS, power backup')

  return `### The catch with ${row.name}

**What could go wrong, from our records and UP-RERA:**
${recordBlock(row, complaints, orders, now, found)}

**What we do not hold — ask the sales team for these in writing:**
${gaps.map((g) => `- ${g}`).join('\n')}

Get every answer on paper before you pay a booking amount. A verbal assurance from a sales team is not enforceable.`
}

function recordBlock(row: Row, complaints: ComplaintsRecord | null, orders: OrderRecord[], now: Date, also: string[]): string {
  const record = riskRecord(row, complaints, orders, now).map((l) => `- **${l.label}:** ${l.text}`).join('\n')
  return also.length ? `${record}\n\n**Also on record:**\n${also.map((f) => `- ${f}`).join('\n')}` : record
}

/** "A vs B, which is safer?": the second project named by its exact name, or null. */
export function secondProjectInText<T extends { id: string; name: string }>(text: string, catalog: readonly T[], first: T): T | null {
  const rest = (text ?? '').toLowerCase().split(first.name.toLowerCase()).join(' ')
  const hit = matchProjectInText(rest, catalog)
  return hit && hit.id !== first.id && rest.includes(hit.name.toLowerCase()) ? hit : null
}

export interface LoadedRecord { row: Row; complaints: ComplaintsRecord | null; orders: OrderRecord[] }

/** Two records side by side. A comparison names no winner (CLAUDE.md, Recommendation Framework). */
export function catchAnswerPair(a: LoadedRecord, b: LoadedRecord, now: Date = new Date()): string {
  const section = (x: LoadedRecord) => {
    const also = alsoOnRecord(x.row)
    if (x.row.status !== 'ready_to_move') also.unshift(x.row.possession_date ? `Still under construction. Possession on record: ${month(x.row.possession_date)}.` : 'Still under construction, and we hold no possession date for it.')
    return `#### ${x.row.name}\n${recordBlock(x.row, x.complaints, x.orders, now, also)}`
  }
  return `### What could go wrong: ${a.row.name} and ${b.row.name}

We do not rank them. Each line comes from a record or says "Not on record"; weigh the lines that matter to you.

${section(a)}

${section(b)}

**Ask both sales teams for these in writing:** the UP-RERA complaints against the project and what they were about, which towers have an occupancy certificate, the carpet area of your exact unit, and every charge beyond the base price.

Get every answer on paper before you pay a booking amount. A verbal assurance from a sales team is not enforceable.`
}

/** Negatives on record beyond the six-line record. */
function alsoOnRecord(row: Row): string[] {
  const found: string[] = []
  // Registration, complaints, delays, occupancy certificate, court cases and abeyance are the
  // six-line record (riskRecord). Source and date sit in the sentence, not in a parenthetical
  // (sanitizeOutput collapses citation-shaped parentheticals), and no sentence carries the
  // portal's address (OFFPLATFORM_REFERRAL deletes it, figures included).
  if (isFlag(row.project_risk_flag)) found.push(`Risk flag on record: ${humanFlag(row.project_risk_flag)}.`)
  if (row.builder?.insolvency_history) found.push(`${row.builder.name} has insolvency history on record.`)
  if (isFlag(row.builder?.legal_flag)) found.push(`Legal flag on the developer, ${row.builder.name}: ${humanFlag(row.builder.legal_flag)}.`)
  if (row.amitabh_kant_clearance === false) found.push('No Amitabh Kant 25% dues clearance on record, so registry may stay blocked until the developer pays.')
  if (row.registry_status && /block|hold|restrict|embargo/i.test(row.registry_status)) found.push(`Registry status on record: ${row.registry_status.replace(/_/g, ' ')}.`)
  for (const c of row.location_concerns ?? []) found.push(`Location concern on record: ${c.trim().replace(/\.+$/, '')}.`)
  if (row.flood_waterlogging_risk && /high|moderate/i.test(row.flood_waterlogging_risk)) found.push(`Waterlogging risk on record: ${row.flood_waterlogging_risk.toLowerCase()}.`)
  const price = priceInconsistency(row)
  if (price) found.push(price)
  return found
}

export const projectCatchHandler: ChatTopicHandler = {
  id: 'project_catch',
  description: 'The negatives and gaps on record for one named project',

  matches: ctx => ASKS_FOR_THE_CATCH.test(ctx.message) && (matchProjectInText(ctx.message, ctx.catalog) ?? (ctx.flags.isCompareRequest === true ? null : focusedProject(ctx))) !== null,

  handle: async ctx => {
    const hit = matchProjectInText(ctx.message, ctx.catalog) ?? focusedProject(ctx)
    if (!hit) return false
    const row = await loadProject(hit.id)
    if (!row) return false

    const [complaints, orders] = await Promise.all([loadComplaints(hit.id), loadOrders(hit.id)])
    const other = secondProjectInText(ctx.message, ctx.catalog, hit)
    const otherRow = other ? await loadProject(other.id) : null
    if (other && otherRow) {
      const [c2, o2] = await Promise.all([loadComplaints(other.id), loadOrders(other.id)])
      ctx.send('token', { token: catchAnswerPair({ row, complaints, orders }, { row: otherRow, complaints: c2, orders: o2 }) })
    } else {
      ctx.send('token', { token: catchAnswer(row, complaints, new Date(), orders) })
    }
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Checking ${row.name}'s records for negatives and gaps:`,
      chips: [
        { id: `chip_catch_dd_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Full due diligence', icon: 'shield-check', analyticsId: 'chip_catch_dd', priority: 1, payload: { text: `Give me the complete due diligence check for ${row.name}` } },
        { id: `chip_catch_alt_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Compare alternatives', icon: 'arrows-left-right', analyticsId: 'chip_catch_alt', priority: 2, payload: { text: `What are good alternatives to ${row.name}?` } },
      ],
      missingFields: [],
      confidence: 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
