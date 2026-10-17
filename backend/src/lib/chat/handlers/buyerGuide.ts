import type { ChatTopicHandler, ChatHandlerContext } from '../handlerContext'
import { UP_STATUTORY } from '../../factPresentation'

/**
 * Three questions the model answered by inventing (live chat, 17 Oct 2026):
 *
 *   roadmap        "create a roadmap for a new buyer…" then "next", "step 4?", "how many steps?"
 *                  The model repeated Step 3, jumped back, invented steps up to 15 and
 *                  figures (tariffs, CAGR, yields, rents, IFMS rates).
 *   capabilities   "what can you do for me" claimed price trends and appreciation rates.
 *   trust          "why should I trust you" claimed we verify land dues and OC status.
 *
 * All three are fixed text. The only figures are UP_STATUTORY values and the RERA
 * Section 13 advance limit, which buyerSupport.ts already states.
 */

const S = UP_STATUTORY
const tdsLakh = S.tdsThresholdInr / 100_000

export const ROADMAP_STEPS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Fix your all-in budget and get a loan sanction',
    body: `- Your ceiling is the all-in cost, not the flat price. Add stamp duty (${S.stampDutyPct}%, or ${S.stampDutyFemalePct}% with a woman as primary owner) and registration (${S.registrationPct}%) to every price.
- Add GST of ${S.gstUnderConstructionPct}% if the flat is under construction; a ready flat with its OC carries ${S.gstReadyToMovePct}%.
- Parking, club, maintenance deposit and other charges come on top. Their amounts vary by project, so ask each builder for the figure.
- Get an in-principle loan sanction from your bank. Its figure, not a rule of thumb, sets what you can borrow.`,
  },
  {
    title: 'Shortlist by commute, possession date and size',
    body: `- Decide ready to move or under construction. Ready means no wait and no GST once the OC is granted; under construction means a lower entry price and delivery risk.
- Measure the commute at the hour you actually travel.
- Compare carpet area, not super area.
- Keep the shortlist to three or four projects you can check properly.`,
  },
  {
    title: 'Check the RERA registration and the builder record',
    body: `- Get the UP-RERA registration number for the exact tower or phase, and check it matches the project. Ask me and I'll show the RERA record we hold.
- Compare the possession date registered with RERA against the date the salesperson gives you.
- Look at the builder's delivered projects: were they handed over on time, and do residents live there now?
- Ask about litigation or complaints against the project; I'll tell you what our record shows, or that it is not on record.`,
  },
  {
    title: 'Visit the site',
    body: `- Visit your tower, not only the sample flat, at the hour you would commute.
- Compare construction on the ground with the progress reported to RERA.
- Check water source, lifts, power backup, drainage and the parking you would actually be allotted.
- For a ready project, ask for the occupancy certificate and talk to residents away from the sales office.`,
  },
  {
    title: 'Get the written cost sheet and payment plan',
    body: `- Ask for a unit-wise cost sheet for the exact flat: base price, PLC, parking, club, IFMS and every other charge, in writing.
- The statutory parts are fixed: stamp duty ${S.stampDutyPct}% (${S.stampDutyFemalePct}% for a woman primary owner), registration ${S.registrationPct}%, GST ${S.gstUnderConstructionPct}% under construction. Every other charge is the builder's figure, so get it on paper.
- Ask for the payment plan: construction-linked, down payment or possession-linked, with the stage each instalment is due.
- Check that the total on the sheet matches the one you were quoted.`,
  },
  {
    title: 'Book and sign the agreement for sale',
    body: `- Under RERA (Section 13) a builder can't take more than 10% of the cost as an advance before a registered agreement for sale.
- Read the draft agreement before you pay the booking amount: possession date, delay compensation, carpet area, cancellation and refund terms.
- Pay only by cheque or bank transfer to the project's account, never in cash or to an individual.
- Have a lawyer read the agreement if you can.`,
  },
  {
    title: 'Loan disbursal and paying by stage',
    body: `- Your bank disburses against the builder's demand letters; for under-construction flats it usually checks the construction stage first.
- Before each payment, check that the demand matches the payment plan and the stage on the ground.
- If the price is ₹${tdsLakh} lakh or more, you deduct TDS of ${S.tdsPct}% on each payment and deposit it yourself.
- Keep every receipt and demand letter; you will need them at registry.`,
  },
  {
    title: 'Possession: OC, snagging and registry',
    body: `- Take possession only after the occupancy certificate for your tower is granted. Ask for a copy.
- Do a snag inspection before you sign the possession letter: walls, plumbing, electricals, doors, windows, and the carpet area against the agreement.
- Get the registry done. In Noida and Greater Noida the land is leased from the authority, so this is usually a sub-lease deed; stamp duty and registration are paid here.
- Collect the final statement of account, maintenance terms and the society handover details.`,
  },
]

const N = ROADMAP_STEPS.length

const ROADMAP_ASK =
  /\broad\s*-?\s*map\b[^.?!]*\b(?:buy\w*|purchas\w*|propert(?:y|ies)|flat|home|house|apartment|confirm\w*|book\w*)\b|\b(?:buy\w*|purchas\w*|propert(?:y|ies)|flat|home|house)\b[^.?!]*\broad\s*-?\s*map\b|\bstep[- ]by[- ]step\s+(?:process|guide|plan)\b[^.?!]*\b(?:buy\w*|purchas\w*)\b|\bsteps\s+(?:to|for|of)\s+(?:buy\w*|purchas\w*)\b|\bprocess\s+(?:of|for|to)\s+(?:buy\w*|purchas\w*)\b/i
const NOT_ROADMAP = /\b(?:stamp|gst|tax|tds|emi|loan\s+eligib\w*)\b/i

export const matchesRoadmapQuestion = (m: string) => ROADMAP_ASK.test(m) && !NOT_ROADMAP.test(m)

const COUNT = /\bhow\s+many\s+steps\b/i
const NEXT = /^\s*(?:ok(?:ay)?|and|then|so)?[\s,]*(?:next(?:\s+(?:step|one))?|go\s+on|continue|carry\s+on)\s*(?:please|pls)?\s*[?.!]*\s*$/i
const STEP_N = /^\s*(?:(?:and|ok(?:ay)?|now|what(?:'s|\s+is)|tell\s+me|show\s+me|go\s+to)\s+)*(?:the\s+)?step\s*(?:no\.?\s*|number\s*|#\s*)?(\d{1,2})\s*(?:please|pls)?\s*[?.!]*\s*$/i

type Ref = number | 'next' | 'count' | null
function stepRef(m: string): Ref {
  if (COUNT.test(m)) return 'count'
  const n = STEP_N.exec(m)
  if (n) return Number(n[1])
  return NEXT.test(m) ? 'next' : null
}

/**
 * Which step a follow-up asks for, from the buyer's own messages only.
 *
 * Walks forward from the latest roadmap ask in the last 20 messages: the ask is
 * step 1, "step k" sets k, each "next" adds one. A message that is not part of the
 * roadmap breaks the chain for "next" (it may mean the next page of a search);
 * an explicit "step k" or "how many steps" still resolves while the ask is in range.
 */
export function roadmapStepFor(message: string, priorUserMessages: readonly string[]): number | 'count' | null {
  const ref = stepRef(message)
  if (ref === null) return null
  const window = priorUserMessages.slice(-20)
  let open = -1
  for (let i = window.length - 1; i >= 0; i--) if (matchesRoadmapQuestion(window[i])) { open = i; break }
  if (open < 0) return null
  if (ref !== 'next') return ref
  let cur = 1
  for (const m of window.slice(open + 1)) {
    const r = stepRef(m)
    if (r === null) return null
    if (r === 'next') cur = Math.min(cur + 1, N + 1)
    else if (typeof r === 'number') cur = r
  }
  return cur + 1
}

const outline = () => ROADMAP_STEPS.map((s, i) => `${i + 1}. ${s.title}`).join('\n')

export function stepAnswer(k: number): string {
  if (k < 1 || k > N) {
    return `That's all ${N} steps; there is no step ${k}. In order:

${outline()}

Once your budget is fixed, the next useful thing is the shortlist. Tell me your budget, the BHK you need and where you work, and I'll show you what fits.`
  }
  const s = ROADMAP_STEPS[k - 1]
  const after = k < N
    ? `Next is Step ${k + 1}: ${ROADMAP_STEPS[k].title}. Say "next" when you're ready.`
    : `That's the last step. Do you want to start the shortlist now? Tell me your budget, BHK and where you work.`
  return `### Step ${k} of ${N}: ${s.title}

${s.body}

${after}`
}

export const ROADMAP_OPENING = `### Buying a flat in Noida or Greater Noida West: ${N} steps

This is the order that protects your money, for a new-launch, under-construction or ready flat. I'll go one step at a time.

${outline()}

${stepAnswer(1)}`

export const ROADMAP_COUNT = `There are ${N} steps:

${outline()}

Ask for any step by number, or say "next".`

export const CAPABILITIES_ANSWER = `### What I can do for you

- **Search** projects in Noida and Greater Noida West by budget, sector, BHK, possession date and metro access.
- **Project facts from the records we hold:** RERA registration, possession date, builder delivery record, payment plans, amenities and unit sizes where we have them. If we don't hold something, I'll say "not on record".
- **Compare** two to four projects side by side, with the trade-off in each.
- **True cost:** stamp duty, registration and GST at the UP statutory rates, and EMI and affordability arithmetic on the numbers you give me.
- **A human when you need one:** a callback or a site visit with our team.

**What I don't do**
- Forecast prices or predict appreciation.
- Rental listings, resale listings, or opinions on whether a resale price is fair.
- Investment advice.
- Inspect sites. What I tell you comes from records, not a visit.

What are you looking for: budget, BHK and where you work?`

export const TRUST_ANSWER = `### Where my answers come from, and their limits

**Sources**
- Project records we hold: RERA numbers, possession dates, builder history, payment plans, amenities, unit sizes.
- UP-RERA registration numbers, where we hold them, shown with the project so you can match them to the project and tower.
- Stamp duty, registration and GST from UP and central law, which are the same for every project.

**Every figure is labelled** as one of: from our record for that project, statutory, computed from our records (with how many projects it rests on), or not on record. If we don't hold something, I say so instead of filling in a typical value.

**What we have not done**
- We have not inspected the sites.
- We do not independently verify title, land dues or authority approvals. Ask the builder for the documents and have a lawyer check them.

**Resident reviews:** we do not hold feedback from existing buyers or residents. For any project I'll say "not on record" rather than guess. Talking to residents on a site visit is the better source.

**Neutrality:** a builder or partner paying us never changes how projects are ranked.

The two checks worth doing: ask me for the RERA record we hold for the project, and visit the site. Which project do you want to check?`

export const matchesCapabilitiesQuestion = (m: string) =>
  /\bwhat\s+(?:all\s+)?you\s+(?:can|could)\s+do\b|\bwhat\s+(?:all\s+)?(?:can|could|do)\s+you\s+(?:do|help\s+(?:me\s+)?with|offer)\b|\bwhat\s+are\s+(?:your\s+)?(?:capabilities|features)\b|\bhow\s+can\s+you\s+help\s+me\b/i.test(m)

export const matchesTrustQuestion = (m: string) =>
  /\bwhy\s+should\s+i\s+(?:trust|believe|rely\s+on)\b|\bcan\s+i\s+trust\s+(?:you|this|your)\b|\bhow\s+(?:reliable|accurate)\s+(?:is|are)\s+(?:you|your|this)\b|\bwhere\s+(?:does|do)\s+(?:your|this)\s+(?:data|information|info)\s+come\s+from\b|\b(?:user|customer|resident|buyer|owner)s?\s+(?:feedbacks?|reviews?|testimonials?)\b|\b(?:feedbacks?|reviews?)\s+(?:from|by)\s+(?:existing\s+)?(?:customers?|residents?|buyers?|owners?|users?)\b/i.test(m)

function emit(ctx: ChatHandlerContext, stage: string, thinking: string, text: string, chip: { label: string; text: string }) {
  ctx.send('token', { token: text })
  ctx.emitUiState({
    stage,
    thinking,
    chips: [{ id: `chip_guide_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: chip.label, icon: 'message-circle', analyticsId: 'chip_buyer_guide', priority: 1, payload: { text: chip.text } }],
    missingFields: [],
    confidence: 'MEDIUM',
  })
  ctx.send('done', { sessionId: ctx.sessionId, intentState: stage, intent: ctx.intent, responseMode: 'chat' })
  ctx.res.end()
}

const SEARCH_CHIP = { label: 'Start my search', text: 'Help me shortlist projects for my budget' }

export const roadmapHandler: ChatTopicHandler = {
  id: 'buyer_roadmap',
  description: 'A fixed step-by-step roadmap for buying a flat, one step per follow-up',
  matches: ctx => matchesRoadmapQuestion(ctx.message) || roadmapStepFor(ctx.message, ctx.priorUserMessages ?? []) !== null,
  handle: async ctx => {
    const opening = matchesRoadmapQuestion(ctx.message)
    const step = opening ? 1 : roadmapStepFor(ctx.message, ctx.priorUserMessages ?? [])
    if (step === null) return false
    const text = opening ? ROADMAP_OPENING : step === 'count' ? ROADMAP_COUNT : stepAnswer(step)
    const more = typeof step === 'number' && step < N
    emit(ctx, 'DISCOVERY', 'Following the buying roadmap:', text, more ? { label: 'Next step', text: 'next step' } : SEARCH_CHIP)
  },
}

export const capabilitiesHandler: ChatTopicHandler = {
  id: 'capabilities',
  description: 'What the advisor can and cannot do',
  matches: ctx => matchesCapabilitiesQuestion(ctx.message),
  handle: async ctx => emit(ctx, 'DISCOVERY', 'Listing what I can help with:', CAPABILITIES_ANSWER, SEARCH_CHIP),
}

export const trustHandler: ChatTopicHandler = {
  id: 'trust',
  description: 'Where the data comes from, its limits, and resident reviews',
  matches: ctx => matchesTrustQuestion(ctx.message),
  handle: async ctx => emit(ctx, 'DISCOVERY', 'Explaining where the data comes from:', TRUST_ANSWER, { label: 'Check a project\'s RERA record', text: 'Check the RERA registration of the project I am looking at' }),
}
