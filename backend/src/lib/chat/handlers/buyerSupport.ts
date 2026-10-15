import type { ChatTopicHandler, ChatHandlerContext } from '../handlerContext'

/**
 * Three decision-support questions a buyer asks near the end of a search, none of
 * which needs a database row:
 *
 *   pressure     "the salesperson says prices will rise, book today"
 *   site visit   "what should I inspect before deciding"
 *   compromise   "what should I give up at this budget"
 *
 * The answers are checks and an order of trade-offs. They contain no price, date or
 * percentage, so there is nothing here to invent. Each ends with the next question.
 */

const PRESSURE =
  /\b(?:book(?:ing)?\s+(?:it\s+)?(?:today|now)|prices?\s+(?:will|are\s+going\s+to|going\s+to)\s+(?:rise|go\s+up|increase|hike)|price\s+(?:hike|rise|increase)\s+(?:soon|tomorrow|next)|last\s+few\s+units|offer\s+(?:ends|expires)|limited\s+units|only\s+\w+\s+units?\s+(?:left|remaining)|walk\s+away)\b/i

const SITE_VISIT =
  /\b(?:site\s+visit|visit(?:ing)?\s+the\s+(?:site|project|society)|before\s+(?:i\s+)?visit)\b[^.?!]*\b(?:inspect|check|look\s+for|checklist|what\s+should|things\s+to|verify)\b|\b(?:inspect|checklist)\b[^.?!]*\bsite\s+visit\b/i

const COMPROMISE =
  /\bwhat\s+(?:should|can|do)\s+i\s+(?:compromise|give\s+up|sacrifice|trade\s*off)|\bcompromise\s+on\b|\btrade[- ]?offs?\s+(?:at|for)\s+(?:this|my)\s+budget\b/i

export const matchesPressureQuestion = (m: string) => PRESSURE.test(m)
export const matchesSiteVisitQuestion = (m: string) => SITE_VISIT.test(m)
export const matchesCompromiseQuestion = (m: string) => COMPROMISE.test(m)

export const PRESSURE_ANSWER = `### A deadline from the seller is not evidence

A price rise only matters if the flat is worth buying at today's price and the paperwork holds. I can't tell you whether a rise is coming: we hold the price on record and the date it was confirmed, not the builder's future revisions.

**Ask for these, in writing, before you pay anything**
1. The current price list with its effective date, and the date and size of the previous revision.
2. A unit-wise cost sheet for the exact flat: base price, PLC, parking, club, IFMS and every other charge.
3. The RERA registration number, so you can check it matches the project and tower.
4. The draft agreement for sale and the construction-linked payment schedule, before the booking amount.
5. The refund terms for the booking amount, in writing.

**What RERA gives you:** a builder can't take more than 10% of the cost as an advance before a registered agreement for sale (Section 13). A "book today" demand that skips the agreement is asking you to give up that protection.

**Reasons to walk away**
- No written cost sheet, or a total that differs from the one quoted.
- The booking amount is asked in cash or paid to an individual or any account that is not the project's.
- The RERA number is missing or does not match the project.
- The agreement is withheld until after you pay.
- You are discouraged from having a lawyer read it.

If all five documents arrive and the numbers fit your budget, the deadline has told you nothing about the flat. If you tell me the project, I can check the RERA record we hold.

Which project is the salesperson pushing?`

export const SITE_VISIT_ANSWER = `### What to inspect on the site visit

**Before you go**
- Ask which tower and floor your unit is in, and visit that tower, not only the sample flat.
- Go at the time you would commute or come home. Light, noise, traffic and parking pressure change by hour.

**At the project**
- **RERA board:** the registration number should be displayed and match the one you were given.
- **Construction (if not complete):** compare the stage you see with the progress the builder has reported to RERA. A tower far behind its report is a possession risk.
- **Sample flat versus your unit:** the sample is fitted out and staged. Ask for the real layout and the real carpet area.
- **Structure:** cracks, damp patches, uneven finishing and exposed reinforcement in common areas.
- **Basics:** lift count against tower height, water source and pressure, drainage, power backup, fire exits, parking you are actually allotted.
- **Surroundings:** the real walk to the school, the road at peak hour, the nearest hospital, and what sits next to the plot.

**If the project is ready to move**
- A copy of the occupancy certificate for your tower.
- A recent maintenance bill, and how many flats are occupied.
- Talk to two residents away from the sales office.

Take photos and write down every promise made verbally, then ask for it in the agreement.

Is this a ready-to-move or an under-construction project?`

export const COMPROMISE_ANSWER = `### What to compromise on, in order

Give up the things that change your daily comfort a little before the things that change your risk.

**Compromise first**
1. **Floor, tower and facing.** The same project often has a cheaper stack.
2. **Club and amenity depth.** A smaller clubhouse costs you less than a smaller bedroom.
3. **Builder brand,** as long as the track record on delivery is clean.

**Compromise second, with care**
4. **Carpet area.** Compare carpet, not super area; a smaller flat with a better layout can beat a bigger one.
5. **Possession date,** by a few months, if you can carry rent and EMI together.
6. **Distance,** if the commute you can live with is measured at your actual hour.

**Do not compromise on**
- RERA registration and clear title.
- A written, all-in cost within your ceiling.
- A builder with delivery you can check.

The right order depends on what you can't live without. Which is hardest for you to bend: the budget ceiling, the size, the location or the possession date?`

function respond(stage: string, thinking: string, text: string, chipLabel: string, chipText: string) {
  return async (ctx: ChatHandlerContext) => {
    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage,
      thinking,
      chips: [{ id: `chip_support_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: chipLabel, icon: 'message-circle', analyticsId: 'chip_buyer_support', priority: 1, payload: { text: chipText } }],
      missingFields: [],
      confidence: 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: stage, intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  }
}

export const pressureTacticsHandler: ChatTopicHandler = {
  id: 'pressure_tactics',
  description: '"Book today, prices will rise": what evidence to ask for and when to walk away',
  matches: ctx => matchesPressureQuestion(ctx.message),
  handle: respond('DECISION', 'Checking what a booking deadline should be backed by:', PRESSURE_ANSWER, 'Check a project\'s RERA record', 'Check the RERA registration of the project I am looking at'),
}

export const siteVisitChecklistHandler: ChatTopicHandler = {
  id: 'site_visit_checklist',
  description: 'What to inspect on a site visit',
  matches: ctx => matchesSiteVisitQuestion(ctx.message),
  handle: respond('DECISION', 'Building a site-visit checklist:', SITE_VISIT_ANSWER, 'Request a site visit', 'I want to schedule a site visit'),
}

export const compromiseOrderHandler: ChatTopicHandler = {
  id: 'compromise_order',
  description: 'What to give up first at a budget',
  matches: ctx => matchesCompromiseQuestion(ctx.message),
  handle: respond('DECISION', 'Ordering the trade-offs:', COMPROMISE_ANSWER, 'Show options within my budget', 'Show me what fits my budget'),
}
