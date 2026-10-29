// backend/src/lib/chat/rowsAnswer.ts
//
// What a buyer gets about a named project when every AI provider has failed
// (Day 0 item 3). Price, possession, RERA and payment plan are stored rows, so
// the question still has a correct answer: the rows as stored, labelled as such,
// with the price's confirmation date. The outage notice stays for questions a
// row cannot answer (returns null).
//
// Only the topics the buyer asked about are shown, and only from this
// project's own rows (fact tier `verified`); a field we do not hold is said to
// be not on record, never filled in.

export interface RowsProject {
  name: string
  status?: string | null
  possession_label?: string | null
  possession_date?: Date | string | null
  rera_number?: string | null
  price_range_label?: string | null
  unit_types?: Array<{ name?: string | null; bhk: number; super_area_sqft?: number | null; price_min_cr?: number | null; price_max_cr?: number | null }>
  payment_plans?: Array<{ plan_name?: string | null; description?: string | null }>
}

const TOPICS = {
  price: /\b(price|prices|cost|costs|rate|kitna|kitne|kitni|how\s+much|budget|lakh|crore|cr)\b|₹/i,
  possession: /\b(possession|handover|hand\s*over|ready\s*to\s*move|ready|completion|complete|delivery|deliver|kab)\b/i,
  rera: /\brera\b/i,
  payment: /\b(payment|clp|plp|installments?|instalments?|subvention|down\s*payment)\b/i,
}

const cr = (n: number) => (n >= 1 ? `₹${Number(n.toFixed(2))} Cr` : `₹${Math.round(n * 100)} L`)
const STATUS: Record<string, string> = { ready_to_move: 'ready to move', under_construction: 'under construction', new_launch: 'new launch' }

function priceBlock(p: RowsProject, priceNote: string | null): string {
  const units = (p.unit_types ?? []).filter((u) => u.price_min_cr != null).sort((a, b) => a.bhk - b.bhk || a.price_min_cr! - b.price_min_cr!)
  if (!units.length) return p.price_range_label ? `**Price:** ${p.price_range_label} (project range on record).` : `**Price:** not on record for ${p.name}.`
  const rows = units.map((u) => {
    const price = u.price_max_cr != null && u.price_max_cr > u.price_min_cr! ? `${cr(u.price_min_cr!)} – ${cr(u.price_max_cr)}` : cr(u.price_min_cr!)
    return `| ${u.bhk} BHK${u.name ? ` (${u.name})` : ''} | ${u.super_area_sqft ? `${u.super_area_sqft} sq ft` : 'Not on record'} | ${price} |`
  })
  return `| Flat type | Super area | Price |\n| :--- | :--- | :--- |\n${rows.join('\n')}${priceNote ? `\n\n*Prices: ${priceNote}.*` : ''}`
}

function possessionBlock(p: RowsProject): string {
  const date = p.possession_date ? new Date(p.possession_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : null
  const parts = [
    p.status ? `status ${STATUS[p.status] ?? p.status.replace(/_/g, ' ')}` : null,
    p.possession_label ? `possession "${p.possession_label}"` : null,
    date ? `possession date ${date}` : null,
  ].filter(Boolean)
  return parts.length ? `**Possession:** ${parts.join(', ')} (as recorded; not a site inspection).` : `**Possession:** not on record for ${p.name}.`
}

function paymentBlock(p: RowsProject): string {
  const plans = (p.payment_plans ?? []).filter((x) => x.plan_name)
  if (!plans.length) return `**Payment plans:** not on record for ${p.name}.`
  return `**Payment plans on record:**\n\n${plans.map((x) => `- **${x.plan_name}**${x.description ? `: ${x.description}` : ''}`).join('\n')}`
}

/** The stored answer for this question, or null when no row answers it. */
export function answerFromRows(p: RowsProject, message: string, priceNote: string | null = null): string | null {
  const text = message ?? ''
  const asked = (Object.keys(TOPICS) as Array<keyof typeof TOPICS>).filter((k) => TOPICS[k].test(text))
  if (!asked.length) return null
  const blocks = asked.map((k) =>
    k === 'price' ? priceBlock(p, priceNote)
      : k === 'possession' ? possessionBlock(p)
        : k === 'rera' ? `**RERA:** ${p.rera_number ?? `not on record for ${p.name}`}.`
          : paymentBlock(p))
  return `### ${p.name}: from our records\n\n${blocks.join('\n\n')}\n\n_Our advisor's written view is unavailable for a moment, so this is the record as stored. Ask again shortly for the full answer._`
}
