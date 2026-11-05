// Price history is append-only: every price change keeps its row (plan of
// 27 Oct, Day 3). The admin editor sends its whole list back; only rows without
// an id are new. A saved row is never rewritten or deleted from here.

export interface PricePointInput {
  id?: unknown
  quarter_label?: unknown
  price_per_sqft?: unknown
  total_price_cr?: unknown
  event_note?: unknown
}

export interface NewPricePoint {
  quarter_label: string
  price_per_sqft: number | null
  total_price_cr: number | null
  event_note: string | null
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The new points to append, or an error naming the first incomplete one. No default quarter, no default price. */
export function newPricePoints(input: unknown): { rows: NewPricePoint[] } | { error: string } {
  if (!Array.isArray(input)) return { rows: [] }
  const rows: NewPricePoint[] = []
  for (const [i, p] of (input as PricePointInput[]).entries()) {
    if (p?.id) continue
    const quarter = typeof p?.quarter_label === 'string' ? p.quarter_label.trim() : ''
    const psf = num(p?.price_per_sqft)
    const total = num(p?.total_price_cr)
    if (!quarter) return { error: `Point ${i + 1}: quarter is required` }
    if (psf == null && total == null) return { error: `Point ${i + 1}: a price per sq ft or a total price is required` }
    const note = typeof p?.event_note === 'string' && p.event_note.trim() ? p.event_note.trim() : null
    rows.push({ quarter_label: quarter, price_per_sqft: psf, total_price_cr: total, event_note: note })
  }
  return { rows }
}
