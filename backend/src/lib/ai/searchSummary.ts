/**
 * The answer to a plain property search, written from our rows.
 *
 * A search ("3 bhk in greater noida under 1.5 cr") is retrieval plus a paragraph:
 * the cards are the answer, and the model only wrote prose over them. That prose
 * is where this product failed in the 17 Oct transcript: "we hold no 3 BHK under
 * ₹1.5 Cr" over a list of them, invented prices the integrity check then blocked
 * (outage notice), "CREDAI member" credentials, the same reply four times. Every
 * figure here comes from the retrieved rows; nothing is generated.
 *
 * Only for a search with nothing else asked. A question riding on the search
 * ("…which has the best metro access?", compare, "what's the catch") still goes
 * to the model.
 */
import type { ScoredProject } from '../discovery/types'

type SearchIntent = {
  bhk?: number[] | null
  budgetMin?: number | null
  budgetMax?: number | null
  sector?: string | null
  city?: string | null
  possession?: string | null
}

const cr = (n: number) => (n >= 1 ? `₹${n.toFixed(2).replace(/\.?0+$/, '')} Cr` : `₹${Math.round(n * 100)} L`)

/** Low and high in crore from a label like "₹0.99–1.07Cr" or "₹85 L–1.1 Cr". */
export function priceBounds(label: string | null | undefined, fallbackMin?: number | null): [number, number] | null {
  const nums = [...(label ?? '').matchAll(/(\d+(?:\.\d+)?)\s*(cr|crore|l|lakh|lac)?/gi)]
    .map((m) => ({ v: Number(m[1]), unit: (m[2] ?? '').toLowerCase() }))
    .filter((x) => Number.isFinite(x.v) && x.v > 0)
  if (nums.length) {
    // A unit after the last number applies to the bare numbers before it ("₹0.99–1.07Cr").
    const tailUnit = [...nums].reverse().find((x) => x.unit)?.unit ?? 'cr'
    const inCr = nums.map((x) => (/^l/.test(x.unit || tailUnit) ? x.v / 100 : x.v))
    return [Math.min(...inCr), Math.max(...inCr)]
  }
  return fallbackMin && fallbackMin > 0 ? [fallbackMin, fallbackMin] : null
}

export function describeSearch(i: SearchIntent): string {
  const bhk = i.bhk?.length ? `${[...i.bhk].sort().join(' or ')} BHK` : 'homes'
  const where = i.sector ? ` in ${i.sector.split(',')[0]}` : i.city ? ` in ${i.city}` : ''
  const budget = i.budgetMin && i.budgetMax ? ` between ${cr(i.budgetMin)} and ${cr(i.budgetMax)}`
    : i.budgetMax ? ` up to ${cr(i.budgetMax)}`
    : i.budgetMin ? ` from ${cr(i.budgetMin)}` : ''
  const ready = i.possession === 'immediate' ? ', ready to move' : ''
  return `${bhk}${where}${budget}${ready}`
}

function line(p: ScoredProject): string {
  const bounds = priceBounds(p.price_range_label, p.price_min_cr)
  const price = bounds ? (bounds[0] === bounds[1] ? cr(bounds[0]) : `${cr(bounds[0])}–${cr(bounds[1])}`) : 'price not on record'
  const forBhk = p.price_for_bhk ? ` for ${p.price_for_bhk}` : ''
  // "Ready to move" alone: some ready rows still carry an old possession label.
  const status = p.status === 'ready_to_move' ? 'ready to move' : p.possession_label ? `possession ${p.possession_label}` : 'under construction, no committed date on record'
  const flag = p.project_risk_flag && !/low/i.test(String(p.project_risk_flag)) ? ' · legal flag on record, ask me about it' : ''
  return `- **${p.name}**, ${p.sector}: ${price}${forBhk}, ${status}${flag}`
}

const isOver = (p: ScoredProject) => p.budgetStatus === 'over' || p.budgetStatus === 'slightly_over'

export function searchSummary(opts: {
  intent: SearchIntent
  exact: ScoredProject[]
  nearby: ScoredProject[]
  shown: number
}): string {
  const { intent, exact, nearby } = opts
  const shown = Math.max(1, Math.min(opts.shown || 6, 6))
  const asked = describeSearch(intent)
  const matches = exact.filter((p) => !isOver(p))
  const above = exact.filter(isOver)

  if (matches.length) {
    const bounds = matches.map((p) => priceBounds(p.price_range_label, p.price_min_cr)).filter((b): b is [number, number] => Boolean(b))
    const low = bounds.length ? Math.min(...bounds.map((b) => b[0])) : null
    const high = bounds.length ? Math.max(...bounds.map((b) => b[1])) : null
    const ready = matches.filter((p) => p.status === 'ready_to_move').length
    const count = `${matches.length}${matches.length >= 20 ? '+' : ''}`
    const range = low != null && high != null ? ` Prices run ${cr(low)} to ${cr(high)}.` : ''
    const mix = ready === matches.length ? ' All are ready to move.' : ready ? ` ${ready} ready to move, the rest under construction.` : ' All are under construction.'
    const aboveBlock = above.length
      ? `\n\n**Above your budget (not matches):** ${above.slice(0, 3).map((p) => `${p.name} (${p.price_range_label ?? 'price not on record'})`).join(', ')}.`
      : ''
    return `**${count} project${matches.length === 1 ? '' : 's'} match** ${asked}.${range}${mix}

${matches.slice(0, shown).map(line).join('\n')}${aboveBlock}

Open a card for the cost sheet and RERA record, or tell me what matters most (possession, metro, builder record) and I'll narrow these down.`
  }

  if (nearby.length) {
    return `None of the projects we hold match ${asked} exactly. These are the closest:

${nearby.slice(0, shown).map(line).join('\n')}

Tell me which constraint to relax, or open a card for its details.`
  }

  const relax = [
    intent.budgetMax ? `raise the budget above ${cr(intent.budgetMax)}` : null,
    intent.sector ? `search all of ${intent.city ?? 'Noida'} instead of ${intent.sector.split(',')[0]}` : null,
    intent.bhk?.length && Math.min(...intent.bhk) > 1 ? `look at ${Math.min(...intent.bhk) - 1} BHK` : null,
    intent.possession === 'immediate' ? 'include under-construction projects' : null,
  ].filter(Boolean)
  if (above.length) {
    return `None of the projects we hold match ${asked}. Above your budget (not matches): ${above.slice(0, 3).map((p) => `${p.name} (${p.price_range_label ?? 'price not on record'})`).join(', ')}.${relax.length ? `\n\nI can ${relax.join(', or ')}.` : ''}`
  }
  return `None of the projects we hold match ${asked}.${relax.length ? ` I can ${relax.join(', or ')}: which would you like?` : ' Tell me what to change and I will search again.'}`
}
