import { prisma } from '../../db'
import { matchProjectInText } from '../../discovery/matchProjectInText'
import { SECTOR_ADJACENCY } from '../../discovery/constants'
import type { ChatTopicHandler } from '../handlerContext'
import { ALL_IN_BUDGET, statutoryMultiplier } from './commuteShortlist'

/**
 * "Sales guy quoted 1.9cr all inclusive for 3bhk in Gulshan Botnia. Fair or
 * overpriced? How much can I negotiate?"
 *
 * Answered from our own unit rows: the project's recorded price for that BHK,
 * the quote converted to a base-price equivalent when it is all-in, and two or
 * three same/adjacent-sector projects at the same BHK. Negotiation room is only
 * ever the gap between the quote and our recorded range — never a "builders
 * usually give 5–8%" figure, which is a guess. With no recorded price for the
 * BHK we say so and stop.
 */
export const ASKS_FAIRNESS =
  /\b(?:fair|overpriced|over\s*priced|over\s*charg\w*|negotiat\w*|good\s+(?:deal|price)|too\s+(?:high|expensive|much)|zyada|mehenga|sahi\s+(?:price|rate|daam))\b/i

/** The amount someone else quoted, in crore: "quoted 1.9cr", "asking 95 lakh". */
export function quotedAmountCr(message: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\b/i.exec(message)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return /^c/i.test(m[2]) ? n : n / 100
}

function bhkIn(message: string): number | null {
  const m = /(\d)\s*(?:bhk|bed\s?rooms?)\b/i.exec(message)
  return m ? Number(m[1]) : null
}

const cr = (n: number) => `₹${n.toFixed(2)} Cr`

interface Unit { bhk: number; price_min_cr: number | null; price_max_cr: number | null; price_per_sqft: number | null; super_area_sqft: number | null }

function range(units: Unit[]): { lo: number; hi: number; perSqft: number | null } | null {
  const priced = units.filter((u) => typeof u.price_min_cr === 'number' && u.price_min_cr > 0)
  if (!priced.length) return null
  const lo = Math.min(...priced.map((u) => u.price_min_cr as number))
  const hi = Math.max(...priced.map((u) => (u.price_max_cr ?? u.price_min_cr) as number))
  const rates = priced.map((u) => u.price_per_sqft).filter((r): r is number => typeof r === 'number' && r > 0)
  return { lo, hi, perSqft: rates.length ? Math.min(...rates) : null }
}

export function fairnessVerdict(baseEquivalent: number, lo: number, hi: number): string {
  if (baseEquivalent < lo * 0.97) {
    return `That is **below** our recorded range. Before you treat it as a bargain, confirm which unit it is (size, floor, facing), whether parking, club and PLC are inside it, and how old our record is.`
  }
  if (baseEquivalent > hi * 1.03) {
    const gapPct = Math.round(((baseEquivalent - hi) / hi) * 100)
    return `That is **about ${gapPct}% above** the top of our recorded range. Ask for an itemised cost sheet: the gap between ${cr(baseEquivalent)} and ${cr(hi)} is where your negotiation sits, unless the extra is a premium unit (higher floor, corner, park facing) you actually want.`
  }
  return `That is **within** our recorded range. Where it sits in the range is your lever: the top of the range should buy a better unit, so ask what this one has that a cheaper unit of the same size does not.`
}

export const priceFairnessHandler: ChatTopicHandler = {
  id: 'price_fairness',
  description: 'Is a quoted price fair: compared with our recorded unit prices and same-sector comparables',

  matches: ctx => ASKS_FAIRNESS.test(ctx.message) && matchProjectInText(ctx.message, ctx.catalog) !== null,

  handle: async ctx => {
    const hit = matchProjectInText(ctx.message, ctx.catalog)
    if (!hit) return false
    const bhk = bhkIn(ctx.message) ?? ctx.intent.bhk?.[0] ?? null
    const unitSelect = { bhk: true, price_min_cr: true, price_max_cr: true, price_per_sqft: true, super_area_sqft: true } as const

    const project = await prisma.project.findUnique({
      where: { id: hit.id },
      select: { name: true, sector: true, status: true, updated_at: true, unit_types: { where: bhk ? { bhk } : {}, select: unitSelect } },
    })
    if (!project) return false

    const own = range(project.unit_types as Unit[])
    const bhkLabel = bhk ? `${bhk} BHK` : 'unit'
    const lines: string[] = [`### Is the quote fair? ${project.name}${bhk ? `, ${bhk} BHK` : ''}`, '']

    if (!own) {
      lines.push(`We hold no recorded price for a ${bhkLabel} in ${project.name}, so we can't judge this quote against it. Ask the sales team for an itemised cost sheet, and I can compare it with nearby projects once you have it.`)
    } else {
      const quote = quotedAmountCr(ctx.message)
      lines.push(`**Our record** for a ${bhkLabel} here: ${cr(own.lo)}${own.hi > own.lo ? ` to ${cr(own.hi)}` : ''} base price${own.perSqft ? `, from ₹${Math.round(own.perSqft).toLocaleString('en-IN')}/sq.ft of super area` : ''}. Last updated in our records ${project.updated_at.toISOString().slice(0, 10)}.`)
      if (quote) {
        const allIn = ALL_IN_BUDGET.test(ctx.message)
        const base = allIn ? quote / statutoryMultiplier(project.status) : quote
        lines.push('', allIn
          ? `**Your quote:** ${cr(quote)} all-in. Taking out stamp duty${project.status === 'ready_to_move' ? ' and registration' : ', registration and GST'}, that is about **${cr(base)} as a base price** (developer charges inside it would lower that further).`
          : `**Your quote:** ${cr(quote)}, taken as a base price. If it includes taxes, tell me and I'll redo this.`)
        lines.push('', fairnessVerdict(base, own.lo, own.hi))
      }
    }

    // Comparables: same sector first, then adjacent sectors, same BHK, priced.
    if (bhk) {
      const sectors = [project.sector, ...(SECTOR_ADJACENCY[project.sector] ?? [])]
      const peers = await prisma.project.findMany({
        where: { id: { not: hit.id }, sector: { in: sectors }, unit_types: { some: { bhk, price_min_cr: { not: null } } } },
        select: { name: true, sector: true, status: true, unit_types: { where: { bhk }, select: unitSelect } },
        take: 12,
      })
      const ranked = peers
        .map((p) => ({ p, r: range(p.unit_types as Unit[]) }))
        .filter((x): x is { p: typeof peers[number]; r: NonNullable<ReturnType<typeof range>> } => x.r !== null)
        .sort((a, b) => sectors.indexOf(a.p.sector) - sectors.indexOf(b.p.sector) || a.r.lo - b.r.lo)
        .slice(0, 3)
      if (ranked.length) {
        lines.push('', `**Comparable ${bhk} BHKs we hold nearby** (our recorded base prices):`)
        for (const { p, r } of ranked) {
          lines.push(`- ${p.name}, ${p.sector}: ${cr(r.lo)}${r.hi > r.lo ? `–${cr(r.hi)}` : ''}${r.perSqft ? ` (from ₹${Math.round(r.perSqft).toLocaleString('en-IN')}/sq.ft)` : ''}, ${p.status === 'ready_to_move' ? 'ready to move' : 'under construction'}`)
        }
      } else {
        lines.push('', `We hold no priced ${bhk} BHK comparables in ${project.sector} or next to it.`)
      }
    }

    lines.push('', 'These are recorded asking prices, not registered sale prices. Compare per sq.ft of the same area type (super with super, carpet with carpet).')

    ctx.send('token', { token: lines.join('\n') })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Comparing the quote with our recorded prices for ${project.name}:`,
      chips: [
        { id: `chip_fair_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Full cost sheet', icon: 'receipt', analyticsId: 'chip_fair_cost', priority: 1, payload: { text: `Show the full cost sheet for ${project.name}` } },
        { id: `chip_fair_catch_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: "What's the catch?", icon: 'shield-check', analyticsId: 'chip_fair_catch', priority: 2, payload: { text: `What's the catch with ${project.name}?` } },
      ],
      missingFields: [],
      confidence: 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
