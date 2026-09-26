import { matchProjectInText } from '../../discovery/matchProjectInText'
import { prisma } from '../../db'
import { renderCostSheetTable, type CostSheetRow } from '../../ai/marketTable'
import { executeWithFallbackChain } from '../../ai/fallbackChain'
import { confidenceFor, MARKET_QUALIFIER, NOIDA_MARKET_RANGES, UP_STATUTORY } from '../../factPresentation'
import { recordTableRendered } from '../../monitoring/langfuse'
import type { ChatTopicHandler } from '../handlerContext'
import { statedBasePriceInr } from './totalOutflow'

/**
 * cost-sheet
 *
 * Lifted verbatim from the inline branch in chat-router.ts; only the router
 * locals were rebound to the handler context. The logic is untouched so the
 * extraction can be verified by comparing output against the previous build.
 */
export const costSheetHandler: ChatTopicHandler = {
  id: 'cost-sheet',
  description: 'All-in cost sheet: base price, charges, statutory dues',

  // A buyer who quoted their own BSP and named no project wants that number
  // worked through — totalOutflow does it; this handler would print a generic
  // cost sheet and ignore the figure they gave.
  matches: ctx => ctx.flags.isCostSheetRequest === true &&
    !(statedBasePriceInr(ctx.message) && !(ctx.intent.projectNames?.length)),

  handle: async ctx => {
    const matchedTarget = ctx.catalog.find(p => p.name.toLowerCase() === ctx.activeProjectName?.toLowerCase() || p.id === ctx.activeProjectName) ||
      matchProjectInText(ctx.message, ctx.catalog) ||
      (ctx.cachedProjects && ctx.cachedProjects.length > 0 ? ctx.catalog.find(p => p.id === ctx.cachedProjects[0].id) : null)

    let costProject = null
    if (matchedTarget) {
      costProject = await prisma.project.findUnique({
        where: { id: matchedTarget.id },
        include: { builder: true, cost_sheet: true, unit_types: true }
      })
    }

    if (!costProject) {
      // No specific project was identified, so this is the general "what does
      // buying in Noida cost" question and market-wide ranges are the right
      // answer. The two halves are separated and labelled: statutory rates are
      // fixed by law, developer charges vary and are NOT verified for any
      // particular project. Previously both sat under "Standard Rate" together.
      const clarifyText = `### What buying in Noida costs

**Statutory — fixed by UP law, identical for every project:**

| Component | Rate | Stage | Note |
| :--- | :--- | :--- | :--- |
| **UP Stamp Duty** | ${UP_STATUTORY.stampDutyPct}% of agreement value | At registration | ${UP_STATUTORY.stampDutyFemalePct}% for single/joint women owners |
| **Registration Fee** | ${UP_STATUTORY.registrationPct}% (capped ₹${UP_STATUTORY.registrationCapInr.toLocaleString('en-IN')}) | At registration | Sub-registrar fee |
| **GST** | ${UP_STATUTORY.gstUnderConstructionPct}% (without ITC) | With construction milestones | ${UP_STATUTORY.gstReadyToMovePct}% on ready-to-move with OC |

**Developer charges — ${MARKET_QUALIFIER}.** These vary by developer, so treat them as a planning band, not a quote:

| Component | Typical range | Stage |
| :--- | :--- | :--- |
| **Covered car parking** | ${NOIDA_MARKET_RANGES.coveredParkingInr} | Initial installments |
| **Club membership** | ${NOIDA_MARKET_RANGES.clubMembershipInr} | On possession |
| **IFMS (refundable)** | ${NOIDA_MARKET_RANGES.ifmsPerSqft} | On possession |
| **Power backup & metering** | ${NOIDA_MARKET_RANGES.powerBackupInr} | On possession |

> **Budgeting:** under-construction, allow ${NOIDA_MARKET_RANGES.allInclusiveLoadUnderConstructionPct}; ready-to-move with OC, ${NOIDA_MARKET_RANGES.allInclusiveLoadReadyToMovePct} (no GST).

Name a project and I'll pull whichever of these we hold verified for it.`

      ctx.send('token', { token: clarifyText })
      ctx.emitUiState({
        stage: 'RESEARCH',
        thinking: 'Statutory rates verified; developer charges are market-typical:',
        chips: [
          { id: `chip_tax_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View UP Stamp Duty & Tax Rates', icon: 'file-text', analyticsId: 'chip_tax_cs', priority: 1, payload: { text: 'How much stamp duty and GST do I pay in UP?' } },
          { id: `chip_rtm_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Show Ready-to-Move (0% GST)', icon: 'check-circle', analyticsId: 'chip_rtm_cs', priority: 2, payload: { text: 'Show ready to move flats in Noida' } },
          { id: `chip_emi_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Calculate Monthly EMI', icon: 'calculator', analyticsId: 'chip_emi_cs', priority: 3, payload: { text: 'Calculate EMI' } }
        ],
        missingFields: [],
        // Statutory half is verified; the developer-charge half is market-tier.
        confidence: confidenceFor(['statutory', 'market'])
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return true
    }

    // Rendered here. Complete breakdown table including BSP, developer charges & UP taxes
    const costTable = renderCostSheetTable(costProject?.cost_sheet as CostSheetRow | null, {
      name: costProject?.name,
      price_range_label: costProject?.price_range_label,
      status: costProject?.status
    })
    if (costTable) {
      const msg = `### Cost breakdown — ${costProject?.name}\n\n${costTable}\n\n`
      ctx.send('token', { token: msg })
      recordTableRendered(ctx.trace, {
        tableType: 'cost_sheet',
        projectName: costProject?.name,
        rowCount: 6,
        characterLength: msg.length,
      })
    }

    const costFactsJson = JSON.stringify({
      projectName: costProject?.name,
      developer: costProject?.builder?.name,
      bsp_range: costProject?.price_range_label,
      cost_sheet: costProject?.cost_sheet,
      unit_types: costProject?.unit_types.map(u => `${u.bhk} BHK (${u.super_area_sqft} sq ft): ₹${u.price_min_cr}–${u.price_max_cr} Cr`)
    }, null, 2)

    // Rules first, data last — the facts JSON used to sit on line 2, which made
    // everything after it uncacheable. See `promptPrefixStability.test.ts`.
    const systemPrompt = `You are PropFyndr, a professional real estate advisor for Noida and Greater Noida.

THE TABLE IS ALREADY ON SCREEN.
The cost breakdown has just been rendered for the buyer from this project's own cost sheet. Do not draw a table and do not restate its rows.

Write two short paragraphs and nothing else:
1. What the all-inclusive figure means against the headline base rate — the gap between the price they will see advertised and the cheque they will actually write.
2. Which line in that gap is the one to check with the developer before booking, and why.

Charges we do not hold are absent from the table on purpose. You may say they sit in the developer's booking cost sheet; never supply a typical figure for one. Statutory rates are the only numbers you may state without support in the data, because UP law fixes them.

No headings. No emoji. Around 120 words.

Verified Pricing & Cost Sheet Facts: ${costFactsJson}`

    const systemMsgHistory = [{ role: 'user' as const, content: ctx.message }]
    const fallbackResult = await executeWithFallbackChain({
      systemPrompt,
      messages: systemMsgHistory,
      send: ctx.send,
      onToolCall: async () => ({}),
      config: { maxTokens: 1500, tools: false },
      suppressTables: Boolean(costTable),
      groqFallbackSuffix: '',
      userMessage: ctx.message,
    })

    const costChips = [
      {
        id: `chip_plans_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `${costProject?.name} Payment Plans & Offers`,
        icon: 'file-text',
        analyticsId: 'chip_plans',
        priority: 1,
        payload: { text: `What are the official payment plans and current builder offers for ${costProject?.name}?` },
      },
      {
        id: `chip_emi_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `Calculate EMI for ${costProject?.name}`,
        icon: 'calculator',
        analyticsId: 'chip_emi',
        priority: 2,
        payload: { text: `Calculate monthly EMI for ${costProject?.name} on a 20-year loan at current rates` },
      },
      {
        id: `chip_amenities_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `${costProject?.name} Amenities & Clubhouse`,
        icon: 'buildings',
        analyticsId: 'chip_amenities',
        priority: 3,
        payload: { text: `What amenities and clubhouse facilities are available in ${costProject?.name}?` },
      },
      {
        id: `chip_compare_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `Compare ${costProject?.name} vs Competitors`,
        icon: 'scales',
        analyticsId: 'chip_compare',
        priority: 4,
        payload: { text: `What other projects compete with ${costProject?.name}, and how do their prices differ?` },
      },
    ]

    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Calculating all-inclusive cost breakdown for ${costProject?.name}:`,
      chips: costChips,
      missingFields: [],
      confidence: 'HIGH'
    })

    ctx.send('done', {
      sessionId: ctx.sessionId,
      intentState: 'SHORTLISTED',
      intent: ctx.intent,
      responseMode: 'chat',
    })
    ctx.res.end()
    return true
  },
}
