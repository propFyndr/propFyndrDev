// backend/src/lib/chat/rentalAnswer.ts

import { webSearch } from '../web'

const RENT_RANGE = /₹\s?([\d,]{4,})\s*(?:-|–|—|to)\s*₹?\s?([\d,]{4,})/

export interface RentalAnswer {
  text: string
  sourced: boolean
}

const BRIDGE =
  'If you are weighing renting against buying, I can show you what the monthly outgo looks like on a purchase in the same area.'

/** A one-line indicative rent range, or an honest gap. */
export async function rentalAnswer(message: string, city = 'Noida'): Promise<RentalAnswer> {
  const bhk = message.match(/(\d)\s*bhk/i)?.[1]
  const config = bhk ? `${bhk} BHK` : '2-3 BHK'

  let context = ''
  try {
    context = await webSearch(`average monthly rent ${config} ${city} 2026`, 3)
  } catch {
    context = ''
  }

  const found = context.match(RENT_RANGE)
  if (!found) {
    return {
      sourced: false,
      text:
        `We track new-construction sales rather than rentals, so I do not hold a verified rent ` +
        `figure for a ${config} in ${city}. ${BRIDGE}`,
    }
  }

  /**
   * The captured strings are scraped text, so they are validated before they
   * are printed rather than interpolated raw.
   *
   * `[\d,]{4,}` matches a comma as a character, so a truncated figure in the
   * source came through as its own "number". Measured: "I want to rent a 2BHK
   * in Noida for 25k a month" was answered "runs roughly ₹10000 to ₹70,0" —
   * a malformed upper bound, and an unformatted lower one, both printed as
   * though they were figures we stood behind.
   *
   * A monthly rent outside ₹3,000 to ₹10,00,000 is a mis-parse, not a rent.
   */
  const parse = (raw: string): number | null => {
    const n = Number(raw.replace(/,/g, ''))
    return Number.isFinite(n) && n >= 3_000 && n <= 1_000_000 ? n : null
  }
  const lowN = parse(found[1])
  const highN = parse(found[2])
  if (lowN === null || highN === null || highN < lowN) {
    return {
      sourced: false,
      text:
        `We track new-construction sales rather than rentals, so I do not hold a verified rent ` +
        `figure for a ${config} in ${city}. ${BRIDGE}`,
    }
  }

  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`
  return {
    sourced: true,
    text:
      `Indicative monthly rent for a ${config} in ${city} runs roughly ${inr(lowN)} to ${inr(highN)}. ` +
      `That is a market range from public listings data, not a RealtyAsk figure — we track ` +
      `new-construction sales, not rentals, so treat it as a ballpark rather than a quote. ${BRIDGE}`,
  }
}

/**
 * Rent mentioned as context, not asked about: yield/ROI maths, letting out a
 * flat the buyer would own, rent-vs-buy, or the buyer's own current tenancy
 * ("we currently rent in Indirapuram, want to buy a 3bhk"). This lane runs
 * before every other lane in chat-router, so each of these must fall through.
 */
const RENT_AS_CONTEXT = new RegExp(
  [
    String.raw`\b(?:yield|roi|returns?|income|potential|appreciation)\b`,
    String.raw`\b(?:buy|buying|purchase|purchasing|invest|investing|investment)\b`,
    String.raw`\brent(?:ing)?\s+(?:it|this|that|them)\b`,
    String.raw`\b(?:rent|let)\s+out\b`,
    String.raw`\brents?\s+(?:for|at)\s+(?:₹|rs\.?\s*|inr\s*)?\d`,
    // "can I rent a 2bhk" is a real ask, so a bare "i rent" is not excluded.
    String.raw`\b(?:i|we)\s+(?:now|already)\s+rent\b`,
    String.raw`\b(?:i\s+am|i'm|we\s+are|we're)\s+(?:currently\s+)?renting\b`,
    String.raw`\b(?:living|staying)\s+(?:on|in)\s+(?:a\s+)?rent`,
    String.raw`\b(?:currently|keep|still)\s+rent(?:ing)?\b`,
  ].join('|'),
)

/** True only when the buyer is asking what it costs to rent a flat. */
export function isRentalQuestion(message: string): boolean {
  const m = (message || '').toLowerCase()
  if (RENT_AS_CONTEXT.test(m)) return false
  return /\brent(?:s|al|als|ing)?\b|\bto[ -]let\b|\bkira(?:a)?y[ae]\b/.test(m) || hasMonthlyBudget(m)
}

/**
 * "2 BHK in Noida under 30k": a flat with a budget only a month's rent could be.
 *
 * Live, 27 Oct 2026: two buyers asked this. One was shown flats from ₹93 L; the other was told
 * none of our 17 Sector 10 projects matched, because ₹30,000 was read as a purchase ceiling.
 * A figure of ₹3,000–₹1,00,000 with no lakh/crore/sq ft unit, beside a flat, is a monthly rent.
 * Income, salary and EMI talk is excluded: those are a buyer's own monthly numbers.
 */
function hasMonthlyBudget(m: string): boolean {
  if (!/\b(?:\d\s?bhk|bhk|flat|apartment|house|room|studio)\b/.test(m)) return false
  if (/\b(?:income|salary|earn\w*|emi|loan|lakh|lac|crore|cr|sq\.?\s?ft|sqft|per\s+sq)\b/.test(m)) return false
  const figures = [
    ...[...m.matchAll(/(?:₹|rs\.?|inr)?\s?(\d{1,3})\s?k\b/g)].map((x) => Number(x[1]) * 1000),
    ...[...m.matchAll(/(?:under|below|within|upto|up to|around|budget|max|for)\s*(?:₹|rs\.?|inr)?\s?(\d{1,2},?\d{3})\b/g)].map((x) => Number(x[1].replace(',', ''))),
  ]
  return figures.some((n) => n >= 3000 && n <= 100000)
}
