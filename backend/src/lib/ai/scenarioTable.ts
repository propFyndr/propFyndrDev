// backend/src/lib/ai/scenarioTable.ts
//
// "What could it be worth in 10 years?" — answered as arithmetic, not a forecast.
//
// yieldTable.ts draws the line this file keeps: FUTURE RETURN IS NOT OURS TO
// STATE. No rate here is a claim about Noida, a sector or a project. The rows
// are a fixed ladder of hypothetical rates — flat (0%) up to 10% a year — so the
// buyer sees the stakes of the assumption without us choosing one. The only
// facts in the table are the buyer's own amount (their stated budget, or the
// price we hold for the project in focus) and the UP statutory costs of buying,
// which are law, not market. Nothing reads a market rate; nothing is rendered
// as "N% appreciation" or "N% returns" (guardrails.ts blocks that phrasing).
//
// The break-even line is the honest half ChatGPT's version of this table left
// out: stamp duty and registration are paid on day one and recovered only by
// the price rising, so they set the floor every scenario has to clear.

import { UP_STATUTORY } from '../factPresentation'

/** The hypothetical ladder. Chosen to bracket outcomes, not to predict one. */
export const SCENARIO_RATES_PCT = [0, 4, 6, 8, 10] as const
const DEFAULT_YEARS = [5, 10]

export type ScenarioAmountSource = 'budget' | 'project' | 'unit'

export interface ScenarioInput {
  /** The amount the arithmetic runs on, in crore. */
  amountCr: number
  /** Where the amount came from — shown to the buyer. */
  source: ScenarioAmountSource
  /** For `source: 'project'`. */
  projectName?: string
  /** Horizons in years; defaults to 5 and 10. */
  years?: number[]
}

/** "10 years", "10 yrs", "a decade" → [10]; otherwise the default horizons. */
export function horizonsFrom(message: string): number[] {
  const m = (message || '').toLowerCase()
  if (/\ba\s+decade\b/.test(m)) return [5, 10]
  const hit = m.match(/\b(\d{1,2})\s*(?:-\s*)?(?:years?|yrs?)\b/)
  const n = hit ? parseInt(hit[1], 10) : NaN
  if (Number.isFinite(n) && n >= 1 && n <= 30) return n === 5 ? [5] : n < 5 ? [n] : [5, n]
  return DEFAULT_YEARS
}

/** ₹ in lakh below a crore, crore above — how Indian buyers read prices. */
export function inrCr(cr: number): string {
  if (cr < 1) return `₹${(cr * 100).toFixed(cr * 100 < 10 ? 1 : 0)} lakh`
  return `₹${cr.toFixed(2).replace(/\.?0+$/, '')} crore`
}

/** Years for a price to rise by `fraction` at `ratePct` a year, or null when it never does. */
export function yearsToRecover(fraction: number, ratePct: number): number | null {
  if (ratePct <= 0) return null
  return Math.log(1 + fraction) / Math.log(1 + ratePct / 100)
}

export function renderAppreciationScenarios(input: ScenarioInput): string {
  const { amountCr, source } = input
  if (!(amountCr > 0)) return ''
  const years = (input.years?.length ? input.years : DEFAULT_YEARS).slice(0, 2)

  const basis =
    source === 'budget'
      ? `your stated budget of ${inrCr(amountCr)}`
      : source === 'project'
        ? `the price we hold for ${input.projectName ?? 'this project'}, ${inrCr(amountCr)}`
        : `every ₹1 crore you put in`

  const header =
    `| If prices rise by… | ${years.map((y) => `Value after ${y} years`).join(' | ')} |\n` +
    `| :--- | ${years.map(() => ':---').join(' | ')} |`
  const rows = SCENARIO_RATES_PCT.map((r) => {
    const label = r === 0 ? '0% a year (flat)' : `${r}% a year`
    const cells = years.map((y) => inrCr(amountCr * Math.pow(1 + r / 100, y)))
    return `| ${label} | ${cells.join(' | ')} |`
  })

  const buyPct = UP_STATUTORY.stampDutyPct + UP_STATUTORY.registrationPct
  const buyPctFemale = UP_STATUTORY.stampDutyFemalePct + UP_STATUTORY.registrationPct
  const buyCostCr = (amountCr * buyPct) / 100
  const at4 = yearsToRecover(buyPct / 100, 4)
  const at6 = yearsToRecover(buyPct / 100, 6)

  const breakEven =
    `**Break-even first:** stamp duty (${UP_STATUTORY.stampDutyPct}%) and registration ` +
    `(${UP_STATUTORY.registrationPct}%) cost ${inrCr(buyCostCr)} on ${inrCr(amountCr)} the day you buy ` +
    `(${buyPctFemale}% in total if a woman is the primary owner). The price has to rise ${buyPct}% just to ` +
    `get that back — about ${at4!.toFixed(1)} years at 4% a year, ${at6!.toFixed(1)} at 6%, and never if prices stay flat.`

  const note =
    `This table runs on ${basis}. It is arithmetic, not a forecast: the rates are a ladder of ` +
    `what-ifs, and none of them is our view of Noida or of any project — we do not publish one. ` +
    `It leaves out GST on under-construction property, loan interest, maintenance, tax on the gain, ` +
    `selling costs, rent and inflation. A fairly priced flat in a settled sector can beat an ` +
    `overpriced one in a "high-growth" sector, so compare actual resale transactions before you decide.`

  return `${header}\n${rows.join('\n')}\n\n${breakEven}\n\n${note}`
}
