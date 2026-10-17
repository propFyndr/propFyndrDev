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

/**
 * "Will prices in Noida double in 5 years? Give me a number."
 *
 * Every provider answered with an invented growth rate, the integrity check
 * blocked each one, and the buyer got the outage message (stress run G7,
 * 17 Oct 2026). The honest answer is arithmetic: the yearly rate a doubling
 * needs, and that we hold no verified Noida-wide growth series to compare it to.
 */
const MULTIPLE = /\b(double|doubled|doubles|doubling|triple|tripled|triples|tripling|twice|[23]\s*x)\b/i
const MARKET_SUBJECT = /\b(prices?|propert(?:y|ies)|values?|investment|flats?|homes?|real\s+estate|rates?)\b/i

export function matchesPriceMultiple(message: string): boolean {
  return MULTIPLE.test(message) && MARKET_SUBJECT.test(message) && !/\d\s*%/.test(message) && yearsIn(message) !== null
}

export function priceMultipleAnswer(message: string): string {
  const multiple = /tripl|3\s*x/i.test(message.match(MULTIPLE)![0]) ? 3 : 2
  const word = multiple === 3 ? 'triple' : 'double'
  const years = yearsIn(message) as number
  const needed = (Math.pow(multiple, 1 / years) - 1) * 100
  return `### What it takes for prices to ${word} in ${years} years

To ${word} in ${years} years, prices have to rise about **${needed.toFixed(1)}% every year**, compounded, for all ${years} years.

That is the only number I can give you honestly. Whether Noida reaches it is a forecast, and I don't make one: we hold no verified Noida-wide price series to measure past growth against, and any growth rate I quoted would be a guess presented as data. Growth also differs by sector and project, so a city-wide figure would not tell you much about one flat.

If you give me a purchase price and the yearly rates you want to test, I will work out the value after ${years} years at each, after stamp duty and registration.`
}

export const priceMultipleHandler: ChatTopicHandler = {
  id: 'price_multiple',
  description: 'The yearly growth a doubling or tripling needs, with no forecast',

  matches: ctx => matchesPriceMultiple(ctx.message),

  handle: async ctx => {
    ctx.send('token', { token: priceMultipleAnswer(ctx.message) })
    ctx.emitUiState({
      stage: 'FINANCE',
      thinking: 'Working out the growth that would take:',
      chips: [],
      missingFields: [],
      confidence: 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'FINANCE', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
