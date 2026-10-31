import { prisma } from '../../db'
import { sectorWhereClause } from '../../discovery/normalize'
import { matchProjectInText } from '../../discovery/matchProjectInText'
import { computedQualifier } from '../../factPresentation'
import { projectPriceNotes } from '../../projectPriceNote'
import { summarisePriceNotes, UNDATED_NOTE } from '../../priceVerification'
import type { ChatTopicHandler } from '../handlerContext'

/**
 * "Is 8,500 per sq ft a fair price in Sector 150?"
 *
 * The buyer's rate against the per-sq-ft rates on our own unit rows in that
 * sector: how many projects, the lowest, median and highest, and where the
 * quote sits. We hold no resale prices and no market survey, so this never
 * says "fair" or "overpriced" and never calls the buyer's figure "typical";
 * a verdict here was the 31 Oct 2026 benchmark's worst answer (a "Yes, fair"
 * beside a recorded sector average of ₹14,500). A named project goes to
 * priceFairness instead.
 */
const RATE_ASK =
  /\b(?:fair|reasonable|overpriced|over\s*priced|expensive|cheap|mehenga|mahenga|sasta|theek|thik|sahi|zyada|good\s+(?:deal|price|rate)|worth|too\s+(?:high|much))\b/i

/** A per-sq-ft rate in rupees: "8,500 per sq ft", "₹9500/sqft". */
export function ratePerSqftIn(message: string): number | null {
  const m = /(?:₹|rs\.?\s*)?(\d{1,3}(?:,\d{2,3})+|\d{4,6})\s*(?:\/|per|pr)\s*(?:sq\.?\s*ft|sqft|sq\.?\s*feet|square\s*f\w+)/i.exec(message)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return n >= 1000 && n <= 200000 ? n : null
}

export function medianOf(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export const sectorRateCheckHandler: ChatTopicHandler = {
  id: 'sector_rate_check',
  description: "A buyer's per-sq-ft rate against the rates on our rows in the sector it names",

  matches: ctx =>
    ratePerSqftIn(ctx.message) !== null &&
    RATE_ASK.test(ctx.message) &&
    ctx.sectorMatches.length === 1 &&
    matchProjectInText(ctx.message, ctx.catalog) === null,

  handle: async ctx => {
    const rate = ratePerSqftIn(ctx.message) as number
    const sector = ctx.sectorMatches[0]
    const projects = await prisma.project.findMany({
      where: { archived_duplicate_of: null, OR: sectorWhereClause(sector) },
      select: { id: true, unit_types: { select: { price_per_sqft: true } } },
    })
    const perProject = projects
      .map(p => ({ id: p.id, rates: p.unit_types.map(u => u.price_per_sqft).filter((r): r is number => typeof r === 'number' && r > 0) }))
      .filter(p => p.rates.length > 0)
    const all = perProject.flatMap(p => p.rates)

    const lines: string[] = [`### ${inr(rate)} per sq ft in ${sector}`, '']
    if (all.length === 0) {
      lines.push(`We hold no per-sq-ft rate for any project in ${sector}, so I can't place ${inr(rate)} against our records. Tell me the project and I'll compare its recorded price, or I can ask our advisory team for the current rate.`)
    } else {
      const lo = Math.min(...all)
      const hi = Math.max(...all)
      const med = medianOf(all)
      const note = summarisePriceNotes([...(await projectPriceNotes(perProject.map(p => p.id))).values()]) ?? UNDATED_NOTE
      const where =
        rate < lo ? `**below** the lowest rate we hold (${inr(lo)})`
        : rate > hi ? `**above** the highest rate we hold (${inr(hi)})`
        : `**inside** the range we hold, ${Math.round((Math.abs(rate - med) / med) * 100)}% ${rate < med ? 'below' : 'above'} the median`
      lines.push(
        `Our rows for ${sector} carry ${inr(lo)} to ${inr(hi)} per sq ft, median ${inr(med)}. ${inr(rate)} sits ${where}.`,
        '',
        `*Recorded rates, ${computedQualifier(perProject.length)}. Price: ${note}.*`,
        '',
        `That places your figure against our records. It is not a verdict on whether it is fair: I hold no resale or registered-sale prices, and a rate means different things as a base rate, an all-inclusive rate, on super or on carpet area. Ask for the cost sheet of the project you are looking at, and compare like with like.`,
      )
    }
    lines.push('', `Which project in ${sector} is this quote for?`)

    ctx.send('token', { token: lines.join('\n') })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Placing ${inr(rate)} per sq ft against our ${sector} rows:`,
      chips: [
        { id: `chip_rate_proj_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Projects in ${sector}`, icon: 'building', analyticsId: 'chip_rate_projects', priority: 1, payload: { text: `Show me projects in ${sector}` } },
      ],
      missingFields: [],
      confidence: 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
