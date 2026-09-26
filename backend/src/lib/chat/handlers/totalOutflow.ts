import type { ChatTopicHandler } from '../handlerContext'
import { prisma } from '../../db'
import { UP_STATUTORY, NOIDA_MARKET_RANGES, MARKET_QUALIFIER, unverified } from '../../factPresentation'

/**
 * "What will this actually cost me all-in?"
 *
 * The branch this replaces produced a complete, confident money breakdown for a
 * project that did not exist. With no project matched it fell back to:
 *
 *     let basePriceCr = targetProject?.price_min_cr || 1.35
 *     let projName    = targetProject?.name || 'Standard Luxury Apartment'
 *     let sectorName  = targetProject?.sector || 'Sector 75, Noida'
 *
 * and then computed stamp duty, registration, GST and a grand total from that
 * invented ₹1.35 Cr, printed under a heading naming "Standard Luxury Apartment
 * (Sector 75, Noida)" with confidence: 'HIGH'. It also added a flat ₹2,50,000
 * for "IFMS, Electricity Meter & Club" described as a "Fixed One-Time Possession
 * Outflow" — a number that varies by developer and is recorded per project in
 * cost_sheet, which the branch never read.
 *
 * A buyer plans their financing around this figure. It now refuses to compute
 * without a real base price, takes every statutory rate from UP_STATUTORY, reads
 * the developer charges from the project's own cost sheet, and labels anything
 * it cannot source.
 */

const CRORE = 10_000_000

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const lakh = (n: number) => `₹${(n / 100_000).toFixed(2)} L`

/**
 * What a female primary owner actually saves. The concession is 1 point of
 * stamp duty but capped — this line used to print the uncapped 1% (₹1.2 L on a
 * ₹1.2 Cr flat) while the cap is ₹10,000, overstating the saving ~12×.
 */
export function femaleStampDutySaving(base: number): number {
  const s = UP_STATUTORY
  return Math.min(s.stampDutyFemaleConcessionCapInr, Math.round(base * ((s.stampDutyPct - s.stampDutyFemalePct) / 100)))
}

/**
 * A base price the buyer stated themselves: "bsp 1.2 cr", "base price 95 lakh".
 *
 * This is the buyer's own number, not one we invented, so computing on it is
 * arithmetic rather than a guess. Only an explicit bsp/base-price mention
 * counts — a bare budget ("under 1.2 cr") is a ceiling, not a price.
 */
export function statedBasePriceInr(message: string): number | null {
  const m = message.match(/\b(?:bsp|base\s*(?:sale\s*)?price|basic\s*(?:sale\s*)?price)\b\D{0,12}?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\b/i)
    ?? message.match(/(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|acs|akhs)?)\s*(?:ka\s*)?(?:bsp|base\s*(?:sale\s*)?price)\b/i)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return /^c/i.test(m[2]) ? n * CRORE : n * 100_000
}

/** "₹3.5–5 Lakh" -> [350000, 500000]. Keeps the numbers single-sourced. */
function lakhRange(label: string): [number, number] {
  const m = label.match(/([\d.]+)\s*[–-]\s*([\d.]+)\s*Lakh/i)
  return m ? [Number(m[1]) * 100_000, Number(m[2]) * 100_000] : [0, 0]
}

function statedBasePriceBreakdown(base: number, message: string): string {
  const s = UP_STATUTORY
  const r = NOIDA_MARKET_RANGES
  const ready = /\b(ready\s*to\s*move|rtm|with\s*oc|oc\s*(?:mil|received|issued))\b/i.test(message)
  const gstPct = ready ? s.gstReadyToMovePct : s.gstUnderConstructionPct
  const stamp = Math.round(base * (s.stampDutyPct / 100))
  const stampFemale = stamp - femaleStampDutySaving(base)
  const registration = Math.min(s.registrationCapInr, Math.round(base * (s.registrationPct / 100)))
  const gst = Math.round(base * (gstPct / 100))
  const statutory = stamp + registration + gst

  const dev = [r.coveredParkingInr, r.clubMembershipInr, r.powerBackupInr].map(lakhRange)
  const devLo = dev.reduce((a, [lo]) => a + lo, 0)
  const devHi = dev.reduce((a, [, hi]) => a + hi, 0)
  const cr = (n: number) => `₹${(n / CRORE).toFixed(2)} Cr`

  // Where monthly CAM crosses the GST threshold at the top of the band.
  const camBand = r.maintenancePerSqftMonthly.match(/([\d.]+)\s*[–-]\s*([\d.]+)/)
  const lowRate = Number(camBand?.[1] ?? 0)
  const topRate = Number(camBand?.[2] ?? 0)
  const gstCrossSqft = topRate ? Math.ceil(s.maintenanceGstThresholdInr / topRate) : null

  return `### All-in estimate on your quoted BSP of ${cr(base)}

${ready ? 'Ready to move with OC, so GST is nil.' : 'Under construction, so 5% GST applies. Check whether your quote is inclusive or exclusive of it.'}

**Fixed by law. These apply to every project:**

| Component | Basis | Amount |
| :--- | :--- | ---: |
| Base sale price | Your quote | ${cr(base)} |
| Stamp duty | ${s.stampDutyPct}% | ${lakh(stamp)} |
| Stamp duty, female primary owner | ${s.stampDutyFemalePct}%, concession capped at ${inr(s.stampDutyFemaleConcessionCapInr)} | ${lakh(stampFemale)} |
| Registration | ${s.registrationPct}%, capped at ${inr(s.registrationCapInr)} | ${inr(registration)} |
| GST | ${gstPct}%${ready ? ' (OC issued)' : ' (under construction)'} | ${gst ? lakh(gst) : '₹0'} |
| **Base + statutory** | | **${cr(base + statutory)}** |

**Developer charges** (${MARKET_QUALIFIER}; the builder's cost sheet decides these):

- Covered parking: ${r.coveredParkingInr}
- Club membership: ${r.clubMembershipInr}
- Power backup: ${r.powerBackupInr}
- IFMS: ${r.ifmsPerSqft} of super area (refundable deposit)
- PLC / floor rise: only if you pick a preferred unit. Ask for it to be shown as a separate line.

**Likely all-in: ${cr(base + statutory + devLo)} to ${cr(base + statutory + devHi)}**, plus IFMS and any PLC. The range comes from the developer charges; everything above them is fixed.

**Monthly maintenance (CAM):** ${r.maintenancePerSqftMonthly} (${MARKET_QUALIFIER}). Multiply by the super area on your cost sheet. Example: 1,600 sq.ft works out to about ${inr(1600 * lowRate)}–${inr(1600 * topRate)} a month. If your monthly bill goes above ${inr(s.maintenanceGstThresholdInr)}, **${s.maintenanceGstPct}% GST applies to the whole bill**, not just the part above ${inr(s.maintenanceGstThresholdInr)}${gstCrossSqft ? `. At the top rate that happens above roughly ${gstCrossSqft.toLocaleString('en-IN')} sq.ft` : ''}. Power backup and DG usage are usually billed separately, per unit consumed.

Name the project and I'll replace the typical ranges with its recorded cost sheet.`
}

export const totalOutflowHandler: ChatTopicHandler = {
  id: 'total_outflow',
  description: 'All-inclusive purchase cost including statutory charges',

  matches: ctx => ctx.flags.isTotalOutflowQuery === true,

  handle: async ctx => {
    // The buyer gave their own base price and named no project: compute on
    // their number. Checked first so a card carried over from an earlier turn
    // does not hijack "bsp 1.2 cr … total kitna padega".
    const statedBase = statedBasePriceInr(ctx.message)
    if (statedBase && !(ctx.intent.projectNames?.length)) {
      ctx.send('token', { token: statedBasePriceBreakdown(statedBase, ctx.message) })
      ctx.emitUiState({
        stage: 'RESEARCH',
        thinking: 'All-in cost on your quoted base price:',
        chips: [
          { id: `chip_emi_bsp_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'EMI on this', icon: 'calculator', analyticsId: 'chip_emi_bsp', priority: 1, payload: { text: `Calculate EMI for a loan of ₹${((statedBase * 0.8) / CRORE).toFixed(2)} Cr` } },
          { id: `chip_uc_under_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Projects at this price', icon: 'buildings', analyticsId: 'chip_projects_bsp', priority: 2, payload: { text: `Show 3 BHK projects around ₹${(statedBase / CRORE).toFixed(2)} Cr base price in Noida` } },
        ],
        missingFields: [],
        confidence: 'MEDIUM',
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    const named = (Array.isArray(ctx.intent.projectNames) && ctx.intent.projectNames[0])
      || ctx.activeProjectName
      || (ctx.cachedProjects && ctx.cachedProjects.length > 0 ? ctx.catalog.find(p => p.id === ctx.cachedProjects[0].id)?.name : null)
      || null

    const project = named
      ? await prisma.project.findFirst({
          where: {
            OR: [
              { name: { contains: String(named), mode: 'insensitive' } },
              { slug: { contains: String(named), mode: 'insensitive' } },
            ],
          },
          include: { unit_types: { orderBy: { bhk: 'asc' } }, cost_sheet: true },
        })
      : null

    if (!project) {
      // This branch had regrown the bug the file header describes.
      //
      // Where the original invented one base price (₹1.35 Cr for "Standard
      // Luxury Apartment"), this invented three — ₹85 Lakh for a "2 BHK
      // Standard", ₹1.50 Crore for a "3 BHK Premium", ₹2.50 Crore for a "4 BHK
      // Luxury" — then computed down payments, loan amounts and two EMI columns
      // off them at an unsourced 8.75%, headed it "a realistic planning
      // breakdown", quoted a "₹4.0 – ₹6.5 Lakh" possession-charge band that
      // matches no entry in NOIDA_MARKET_RANGES, and reported confidence HIGH.
      // A buyer arranges their financing around these numbers.
      //
      // What survives is what we can actually source: the statutory rates,
      // which UP fixes and are identical for every project, and the market
      // ranges — each carrying MARKET_QUALIFIER, because a Noida typical is not
      // an answer about the project the buyer is asking about. The all-in
      // figure itself needs a project, so it asks for one.
      const s = UP_STATUTORY
      const clarifyText = `### All-in purchase cost

For the actual number I need a specific project — the all-in figure turns on that developer's own cost sheet, and the charges below vary several lakh between builders.

**What UP fixes, and applies to every project:**

| Levy | Rate |
| :--- | ---: |
| Stamp duty | ${s.stampDutyPct}% (${s.stampDutyFemalePct}% for a female buyer) |
| Registration | ${s.registrationPct}% |
| GST, under construction | ${s.gstUnderConstructionPct}% |
| GST, ready to move with OC | ${s.gstReadyToMovePct}% |

**Typical developer charges in Noida** — ${MARKET_QUALIFIER}:

- Covered car parking: ${NOIDA_MARKET_RANGES.coveredParkingInr}
- Club membership: ${NOIDA_MARKET_RANGES.clubMembershipInr}
- IFMS: ${NOIDA_MARKET_RANGES.ifmsPerSqft}
- Power backup: ${NOIDA_MARKET_RANGES.powerBackupInr}
- All-in load over base price: ${NOIDA_MARKET_RANGES.allInclusiveLoadUnderConstructionPct} under construction, ${NOIDA_MARKET_RANGES.allInclusiveLoadReadyToMovePct} ready to move

Name the project, or give me a budget and configuration, and I'll compute the full outflow and the monthly EMI against real figures. Which is it?`

      ctx.send('token', { token: clarifyText })
      ctx.emitUiState({
        stage: 'CLARIFYING',
        thinking: 'Work out custom budget and EMI breakdown:',
        chips: [
          { id: `chip_emi_3bhk_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: '3 BHK EMI for ₹1.5 Cr', icon: 'calculator', analyticsId: 'chip_emi_3bhk', priority: 1, payload: { text: 'Calculate monthly EMI and total outflow for a 3 BHK flat of ₹1.5 Crore on a 20-year loan at 8.75%' } },
          { id: `chip_tenure_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: '20-Year vs 25-Year Loan Impact', icon: 'scales', analyticsId: 'chip_tenure_impact', priority: 2, payload: { text: 'What is the total interest difference between a 20-year and 25-year home loan for ₹1.2 Cr?' } },
          { id: `chip_tax_guide_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'UP Stamp Duty & GST Guide', icon: 'file-text', analyticsId: 'chip_tax_guide', priority: 3, payload: { text: 'How much total stamp duty, registry, and GST will I pay on a ₹1.5 Cr flat in UP?' } },
          { id: `chip_top_projects_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Top Projects Under ₹1.5 Cr', icon: 'buildings', analyticsId: 'chip_top_under_1_5', priority: 4, payload: { text: 'Show top verified residential projects under ₹1.5 Crore in Noida and Greater Noida' } },
        ],
        missingFields: [],
        // We hold no project-specific figure here, and confidence follows the
        // weakest tier used. HIGH on a market range is the fake confidence
        // score CLAUDE.md forbids.
        confidence: 'LOW',
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'CLARIFYING', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    const bhkMatch = ctx.message.match(/(\d)\s*bhk/i)
    const bhk = bhkMatch ? Number(bhkMatch[1]) : null
    const unit = bhk ? project.unit_types.find(u => u.bhk === bhk) : project.unit_types[0]
    const basePriceCr = unit?.price_min_cr ?? project.price_min_cr

    if (basePriceCr == null) {
      ctx.send('token', {
        token: `### All-in cost — ${project.name}\n\n${unverified('base price', project.name)}\n\nWithout it every figure below would be arithmetic on a guess.`,
      })
      ctx.emitUiState({
        stage: 'RESEARCH',
        thinking: 'Base price not on record:',
        chips: [],
        missingFields: ['price'],
        confidence: 'LOW',
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    const base = basePriceCr * CRORE
    const isReady = project.status === 'ready_to_move' || !!project.possession_label?.toLowerCase().includes('delivered')

    const stampDuty = Math.round(base * (UP_STATUTORY.stampDutyPct / 100))
    const registration = Math.min(UP_STATUTORY.registrationCapInr, Math.round(base * (UP_STATUTORY.registrationPct / 100)))
    const gstPct = isReady ? UP_STATUTORY.gstReadyToMovePct : UP_STATUTORY.gstUnderConstructionPct
    const gst = Math.round(base * (gstPct / 100))

    // Developer charges come from this project's own cost sheet. The flat
    // ₹2,50,000 the previous version added has no basis for any given project.
    const sheet = project.cost_sheet
    const developerLines: Array<{ label: string; amount: number }> = []
    if (sheet?.parking_cost) developerLines.push({ label: 'Covered parking', amount: sheet.parking_cost })
    if (sheet?.club_membership) developerLines.push({ label: 'Club membership', amount: sheet.club_membership })
    if (sheet?.electricity_connection) developerLines.push({ label: 'Electricity connection', amount: sheet.electricity_connection })
    if (sheet?.water_sewer_connection) developerLines.push({ label: 'Water & sewer connection', amount: sheet.water_sewer_connection })
    if (sheet?.ifms && unit?.super_area_sqft) {
      developerLines.push({ label: `IFMS (${inr(sheet.ifms)}/sq.ft, refundable)`, amount: sheet.ifms * unit.super_area_sqft })
    }

    const developerTotal = developerLines.reduce((sum, l) => sum + l.amount, 0)
    const total = base + stampDuty + registration + gst + developerTotal
    const config = bhk ? `${bhk} BHK` : (unit?.bhk ? `${unit.bhk} BHK` : 'unit')

    const rows = [
      `| **Base price (${config})** | Recorded | **₹${basePriceCr.toFixed(2)} Cr** |`,
      `| Stamp duty | ${UP_STATUTORY.stampDutyPct}% statutory | ${lakh(stampDuty)} |`,
      `| Registration | ${UP_STATUTORY.registrationPct}%, capped | ${inr(registration)} |`,
      `| GST | ${gstPct}%${isReady ? ' — exempt with OC' : ' under construction'} | ${gstPct === 0 ? '₹0' : lakh(gst)} |`,
      ...developerLines.map(l => `| ${l.label} | Developer, on record | ${lakh(l.amount)} |`),
    ].join('\n')

    const missingDeveloperCharges = developerLines.length === 0

    const text = `### All-in cost — ${project.name} (${project.sector})

| Component | Basis | Amount |
| :--- | :--- | :--- |
${rows}
| **Total** | | **₹${(total / CRORE).toFixed(2)} Cr** |

${missingDeveloperCharges
  ? `This total covers the base price and statutory charges only. Parking, club membership and IFMS are not in our records for ${project.name} and vary by developer, so they are **not** included above — expect the final figure to be higher. Our advisory team can pull the official booking cost sheet.`
  : `Developer charges above are from ${project.name}'s recorded cost sheet. Confirm against the official booking document before transferring anything.`}

A female primary owner pays ${UP_STATUTORY.stampDutyFemalePct}% stamp duty instead of ${UP_STATUTORY.stampDutyPct}%, concession capped at ${inr(UP_STATUTORY.stampDutyFemaleConcessionCapInr)}, so about ${inr(femaleStampDutySaving(base))} saved here.`

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `All-in cost for ${project.name}:`,
      chips: [
        { id: `chip_emi_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Calculate EMI on this', icon: 'calculator', analyticsId: 'chip_emi_outflow', priority: 1, payload: { text: `Calculate EMI for a loan of ₹${((total * 0.8) / CRORE).toFixed(2)} Cr` } },
        { id: `chip_plan_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View payment plan', icon: 'file-text', analyticsId: 'chip_plan_outflow', priority: 2, payload: { text: `Show payment plans for ${project.name}` } },
        { id: `chip_visit_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Schedule site visit', icon: 'calendar', analyticsId: 'chip_visit_outflow', priority: 3, payload: { text: `Schedule a site visit for ${project.name}` } },
      ],
      missingFields: missingDeveloperCharges ? ['cost_sheet'] : [],
      // A total missing its developer charges is not a total.
      confidence: missingDeveloperCharges ? 'MEDIUM' : 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
