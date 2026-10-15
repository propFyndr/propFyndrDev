import type { ChatTopicHandler } from '../handlerContext'
import { UP_STATUTORY } from '../../factPresentation'

/**
 * "If prices grow 5%, 8% or 12% a year, what is my ₹1.5 Cr worth after ten years?"
 *
 * Compound arithmetic on the rates and horizon the buyer chose. We supply no growth
 * rate and make no forecast: with no rate in the message the handler asks for one
 * instead of picking a typical figure. The only figures that are not the buyer's are
 * the statutory stamp duty and registration paid on entry, from UP_STATUTORY.
 */

const GROWTH = /\b(?:grow\w*|appreciat\w*|rise|rises|worth|value|price\s+(?:goes|go)\s+up)\b/i
const OTHER_MATH = /\b(?:emi|loan|interest|tds|stamp|gst|rent(?:al)?|yield)\b/i
const WORD_YEARS: Record<string, number> = { three: 3, five: 5, seven: 7, ten: 10, twelve: 12, fifteen: 15, twenty: 20 }

export function matchesInvestmentScenario(message: string): boolean {
  if (OTHER_MATH.test(message)) return false
  if (!GROWTH.test(message)) return false
  return /\d(?:\.\d+)?\s*%/.test(message) && yearsIn(message) !== null
}

export function ratesIn(message: string): number[] {
  const rates = [...message.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m => Number(m[1])).filter(r => r > 0 && r <= 30)
  return [...new Set(rates)].slice(0, 5)
}

export function yearsIn(message: string): number | null {
  const digits = /\b(\d{1,2})\s*(?:-|to)?\s*(?:\d{1,2}\s*)?(?:years?|yrs?)\b/i.exec(message)
  const word = /\b(three|five|seven|ten|twelve|fifteen|twenty)\s+(?:years?|yrs?)\b/i.exec(message)
  const n = digits ? Number(digits[1]) : word ? WORD_YEARS[word[1].toLowerCase()] : null
  return n !== null && n >= 1 && n <= 40 ? n : null
}

/** The price in rupees from the first amount of at least ₹10 lakh in the text. */
export function priceIn(text: string): number | null {
  for (const m of text.matchAll(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\b/gi)) {
    const inr = Number(m[1]) * (/^c/i.test(m[2]) ? 10_000_000 : 100_000)
    if (inr >= 1_000_000) return inr
  }
  return null
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const cr = (n: number) => `₹${(n / 10_000_000).toFixed(2)} Cr`

export function scenarioAnswer(price: number, rates: number[], years: number, fromEarlier: boolean): string {
  const s = UP_STATUTORY
  const entry = Math.round(price * ((s.stampDutyPct + s.registrationPct) / 100))
  const basis = price + entry
  const rows = rates.map(r => {
    const value = price * Math.pow(1 + r / 100, years)
    const yearly = (Math.pow(value / basis, 1 / years) - 1) * 100
    return `| ${r}% | ${cr(value)} | ${inr(value - basis)} | ${yearly.toFixed(1)}% |`
  })
  return `### ${cr(price)} after ${years} years, at the rates you chose

${fromEarlier ? `Using the ${cr(price)} you mentioned earlier.\n\n` : ''}| Yearly growth | Value after ${years} years | Gain over what you paid in | Yearly return on what you paid in |
| :--- | :--- | :--- | :--- |
${rows.join('\n')}

- **What you paid in:** ${inr(basis)}, which is the price plus ${s.stampDutyPct}% stamp duty and ${s.registrationPct}% registration (${inr(entry)}).
- **Not included:** selling costs, maintenance, vacancy or rent, loan interest, tax on the gain, and inflation. Each one lowers the result, and I have not guessed any of them. Give me yours and I will add them.
- **This is arithmetic, not a forecast.** The growth rates are yours. We don't predict Noida prices, and past growth in one sector does not set a rate for another.`
}

export const investmentScenarioHandler: ChatTopicHandler = {
  id: 'investment_scenario',
  description: 'Compound-growth scenarios on a price and rates the buyer supplies',

  matches: ctx => matchesInvestmentScenario(ctx.message),

  handle: async ctx => {
    const rates = ratesIn(ctx.message)
    const years = yearsIn(ctx.message) as number
    let price = priceIn(ctx.message)
    let fromEarlier = false
    if (price === null) {
      for (const prior of [...(ctx.priorUserMessages ?? [])].reverse()) {
        price = priceIn(prior)
        if (price !== null) { fromEarlier = true; break }
      }
    }

    const text = price === null || rates.length === 0
      ? 'Tell me the purchase price and the yearly growth rates you want to test, and I will work out the values. I don\'t assume a growth rate, because any one I picked would be a guess about the market.'
      : scenarioAnswer(price, rates, years, fromEarlier)

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'FINANCE',
      thinking: 'Compounding the rates you gave:',
      chips: [],
      missingFields: [],
      confidence: 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'FINANCE', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
