import { prisma } from '../../db'
import { matchProjectInText } from '../../discovery/matchProjectInText'
import { isSchemaDefault } from '../../projectExposure'
import type { ChatTopicHandler } from '../handlerContext'

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
  /\b(?:catch|downsides?|negatives?|cons\b|red\s*flags?|what(?:'s| is)\s+wrong|hidden\s+(?:issues?|problems?)|(?:sales|builder)[^?]{0,30}\b(?:not|never|won'?t|wont)\s+tell|kya\s+(?:dikkat|problem|kami))\b/i

const select = {
  name: true, status: true, possession_date: true, possession_label: true,
  oc_status: true, rera_number: true, legal_flag: true, litigation_count: true,
  ongoing_litigation_count: true, nclt_moratorium_active: true, location_concerns: true,
  flood_waterlogging_risk: true, amitabh_kant_clearance: true, authority_dues_cleared: true,
  registry_status: true, maintenance_per_sqft_monthly: true, water_source_type: true,
  builder: { select: { name: true, insolvency_history: true, legal_flag: true, delayed_projects_count: true } },
  unit_types: { select: { bhk: true, price_min_cr: true, price_per_sqft: true } },
} as const

type Row = NonNullable<Awaited<ReturnType<typeof loadProject>>>

function loadProject(id: string) {
  return prisma.project.findUnique({ where: { id }, select })
}

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

export function catchAnswer(row: Row): string {
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
  if (!row.oc_status || row.oc_status === 'NONE') {
    if (row.status === 'ready_to_move') found.push('Listed as ready to move, but we hold no occupancy certificate for it. Registry cannot complete without one.')
    else gaps.push('Which towers have an occupancy certificate, and when the rest are expected')
  } else if (row.oc_status === 'APPLIED') {
    found.push('OC has been applied for, not granted.')
  } else if (row.oc_status === 'PHASED_OC') {
    found.push('OC is granted only for some towers. Check that yours is one of them.')
  }

  if (!row.rera_number) found.push('We hold no UP-RERA registration number for it. Do not pay any amount until you have seen one.')
  if (row.legal_flag) found.push(`Legal flag on record: ${row.legal_flag}.`)
  const litigation = row.ongoing_litigation_count ?? row.litigation_count
  if (typeof litigation === 'number' && litigation > 0) found.push(`${litigation} litigation case${litigation === 1 ? '' : 's'} on record against the project.`)
  if (row.nclt_moratorium_active) found.push('An NCLT moratorium is active on the project.')
  if (row.builder?.insolvency_history) found.push(`${row.builder.name} has insolvency history on record.`)
  if (row.builder?.legal_flag) found.push(`Legal flag on the developer: ${row.builder.legal_flag}.`)
  if (typeof row.builder?.delayed_projects_count === 'number' && row.builder.delayed_projects_count > 0) {
    found.push(`${row.builder.name} has ${row.builder.delayed_projects_count} delayed project${row.builder.delayed_projects_count === 1 ? '' : 's'} on record.`)
  }
  if (row.amitabh_kant_clearance === false) found.push('No Amitabh Kant 25% dues clearance on record, so registry may stay blocked until the developer pays.')
  if (row.authority_dues_cleared === false && !isSchemaDefault('authority_dues_cleared', row.authority_dues_cleared)) found.push('Outstanding authority dues on record.')
  if (row.registry_status && /block|hold|restrict|embargo/i.test(row.registry_status)) found.push(`Registry status on record: ${row.registry_status.replace(/_/g, ' ')}.`)
  for (const c of row.location_concerns ?? []) found.push(`Location concern on record: ${c.trim().replace(/\.+$/, '')}.`)
  if (row.flood_waterlogging_risk && /high|moderate/i.test(row.flood_waterlogging_risk)) found.push(`Waterlogging risk on record: ${row.flood_waterlogging_risk.toLowerCase()}.`)
  const price = priceInconsistency(row)
  if (price) found.push(price)

  if (row.maintenance_per_sqft_monthly == null) gaps.push('The monthly maintenance (CAM) rate, and whether it is charged on super or carpet area')
  if (!row.water_source_type) gaps.push('The water source, and a recent TDS test report')
  if (row.amitabh_kant_clearance == null) gaps.push('Whether the developer has cleared the authority land dues (Amitabh Kant 25% clearance)')
  gaps.push('The carpet area of your exact unit, in writing, next to the super area')
  gaps.push('Every charge beyond the base price: PLC, parking, club, IFMS, power backup')

  const foundBlock = found.length
    ? found.map((f) => `- ${f}`).join('\n')
    : '- Nothing adverse in our records. That is not the same as nothing adverse — our records do not cover everything below.'

  return `### The catch with ${row.name}

**What our records show** (from this project's own rows):
${foundBlock}

**What we do not hold — ask the sales team for these in writing:**
${gaps.map((g) => `- ${g}`).join('\n')}

Get every answer on paper before you pay a booking amount. A verbal assurance from a sales team is not enforceable.`
}

export const projectCatchHandler: ChatTopicHandler = {
  id: 'project_catch',
  description: 'The negatives and gaps on record for one named project',

  matches: ctx => ASKS_FOR_THE_CATCH.test(ctx.message) && matchProjectInText(ctx.message, ctx.catalog) !== null,

  handle: async ctx => {
    const hit = matchProjectInText(ctx.message, ctx.catalog)
    if (!hit) return false
    const row = await loadProject(hit.id)
    if (!row) return false

    ctx.send('token', { token: catchAnswer(row) })
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
