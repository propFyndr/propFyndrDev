// backend/src/lib/chat/budgetCheck.ts
//
// "Is 2 crore too much for a 3 BHK in Noida?", "What is a reasonable budget for a 3 BHK?"
// Answered from our own unit prices: how many projects we hold start at or under the budget,
// and the middle starting price. Live, 30 days to 27 Oct 2026: these went to the open model
// lane and took 23–64 s for a generic answer, four of them ending in the outage notice.

import { computedQualifier } from '../factPresentation'
import { isRentalQuestion } from './rentalAnswer'
import type { ProjectQuery, ProjectQueryResult } from './aggregateQuery'

export interface BudgetCheck {
  bhk?: number
  budgetCr?: number
  city?: string
  sector?: string
}

const ASKS_ABOUT_BUDGET = /\b(?:too\s+(?:much|high|expensive|low|little)|enough|sufficient|reasonable|realistic|affordable\s+budget|minimum\s+budget|what\s+budget|how\s+much\s+budget|budget\s+should\s+i|good\s+budget|right\s+budget)\b/i
const BUYER_FINANCES = /\b(?:income|salary|earn\w*|emi|loan|down\s*payment)\b/i

/** A budget question about a BHK or an area, or null. Questions about one project or money in/out are not this. */
export function parseBudgetCheck(message: string): BudgetCheck | null {
  const m = message.toLowerCase()
  if (!ASKS_ABOUT_BUDGET.test(m) || BUYER_FINANCES.test(m) || isRentalQuestion(m)) return null

  const out: BudgetCheck = {}
  const bhk = m.match(/\b(\d)\s?bhk\b/)
  if (bhk) out.bhk = Number(bhk[1])
  // A list of figures ("40, 50, 60 lakhs") is not one budget: answered as the price spread.
  const figures = [...m.matchAll(/(\d+(?:\.\d+)?)\s*(cr|crores?|lakhs?|lacs?|l)\b/g)]
  const isList = /\d+\s*,\s*\d+(?:\s*,\s*\d+)*\s*(?:cr|crores?|lakhs?|lacs?|l)\b/.test(m)
  if (figures.length === 1 && !isList) {
    const [, n, unit] = figures[0]
    out.budgetCr = /^l/.test(unit) ? Number(n) / 100 : Number(n)
  }
  const sector = m.match(/\bsector\s*(\d+[a-z]?)\b/)
  if (sector) out.sector = `Sector ${sector[1].toUpperCase()}`
  else if (/\b(?:greater\s+noida\s+west|noida\s+extension|gnw)\b/.test(m)) out.city = 'Greater Noida West'
  else if (/\bgreater\s+noida\b/.test(m)) out.city = 'Greater Noida'
  else if (/\byamuna\b/.test(m)) out.city = 'Yamuna Expressway'
  else if (/\bnoida\b/.test(m)) out.city = 'Noida'

  return out.bhk || out.budgetCr ? out : null
}

/** The aggregate query that answers it: each project's starting price for that BHK. */
export function budgetQuery(b: BudgetCheck): ProjectQuery {
  return { metric: 'median', field: 'price', bhk: b.bhk, city: b.city, sector: b.sector }
}

const cr = (n: number) => (n >= 1 ? `₹${n.toFixed(2).replace(/\.?0+$/, '')} Cr` : `₹${Math.round(n * 100)} L`)

/** The answer, or null when too few projects carry a price to say anything. */
export function renderBudgetCheck(b: BudgetCheck, r: ProjectQueryResult): string | null {
  const prices = r.rows.map((x) => x.value).filter((v): v is number => typeof v === 'number' && v > 0)
  if (prices.length < 3 || !r.stats) return null
  const what = `${b.bhk ? `${b.bhk} BHK` : 'home'}${b.sector ? ` in ${b.sector}` : b.city ? ` in ${b.city}` : ''}`
  const lines: string[] = []

  if (b.budgetCr) {
    const within = prices.filter((p) => p <= b.budgetCr!).length
    const pct = Math.round((within / prices.length) * 100)
    // Not a question: sanitizeOutput keeps one question per answer and cuts after the first,
    // so a question heading took the whole body with it.
    lines.push(`### ${cr(b.budgetCr)} for a ${what}`)
    // Worded as a filtered count. "Of the 186 projects we hold…" reads as a statement of our
    // inventory size, which answerIntegrity strips, and the rest of the answer went with it.
    lines.push(
      within === 0
        ? `No project with a ${what} on record starts at or under ${cr(b.budgetCr)}.`
        : `**${within} of ${prices.length}** projects with a ${what} on record start at or under ${cr(b.budgetCr)} (${pct}%).`,
    )
  } else {
    lines.push(`### What a ${what} costs`)
  }
  lines.push(
    `The middle starting price is **${cr(r.stats.median)}**. The lowest is ${cr(r.stats.min.value)} at ${r.stats.min.name} (${r.stats.min.sector}), ` +
      `the highest ${cr(r.stats.max.value)} at ${r.stats.max.name} (${r.stats.max.sector}).`,
  )
  lines.push(`*Starting prices, ${computedQualifier(prices.length)}. Stamp duty, registration and GST come on top.*`)
  lines.push(
    b.budgetCr
      ? `Want me to show the ${what} options within ${cr(b.budgetCr)}?`
      : `Want me to show ${what} options in a budget you have in mind?`,
  )
  return lines.join('\n\n')
}
