import { matchProjectInText } from '../../discovery/matchProjectInText'
import { prisma } from '../../db'
import { renderPaymentPlanTable, type PaymentPlanRow } from '../../ai/marketTable'
import { executeWithFallbackChain } from '../../ai/fallbackChain'
import { getCachedResponse } from '../../ai/semanticCache'
import { unverified, confidenceFor } from '../../factPresentation'
import { recordTableRendered } from '../../monitoring/langfuse'
import type { ChatTopicHandler } from '../handlerContext'

/**
 * payment-plans
 *
 * Lifted verbatim from the inline branch in chat-router.ts; only the router
 * locals were rebound to the handler context. The logic is untouched so the
 * extraction can be verified by comparing output against the previous build.
 */
export const paymentPlansHandler: ChatTopicHandler = {
  id: 'payment-plans',
  description: 'Payment plans and construction-linked schedules',

  matches: ctx => ctx.flags.isPaymentPlanRequest === true,

  handle: async ctx => {
    const matchedTarget = ctx.catalog.find(p => p.name.toLowerCase() === ctx.activeProjectName?.toLowerCase() || p.id === ctx.activeProjectName) ||
      matchProjectInText(ctx.message, ctx.catalog)

    let planProject = null
    if (matchedTarget) {
      planProject = await prisma.project.findUnique({
        where: { id: matchedTarget.id },
        include: { builder: true, payment_plans: true }
      })
    }

    if (!planProject) {
      const clarifyText = `### Payment Plans in Noida & Greater Noida\n\nThese are the common structures in the Noida market (typical for Noida — not verified for any specific project):\n\n1. **Construction Linked Plan (CLP)**: ~10% booking, 80% across milestone slabs, 10% on handover (lowest upfront risk).\n2. **Down Payment Plan**: ~10% booking, 85% in 45 days, 5% on handover (often priced with a discount on the base selling price).\n3. **Flexi / Milestone Plan (30:70 / 20:80)**: 20–30% in first 90 days, balance upon superstructure or possession.\n\n*Which specific project would you like to view the detailed payment schedule for?*`
      ctx.send('token', { token: clarifyText })
      ctx.emitUiState({
        stage: 'RESEARCH',
        thinking: 'Select a project to view exact builder payment plans:',
        chips: [
          { id: `chip_sec76_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Projects in Sector 76', icon: 'building', analyticsId: 'chip_p_s76', priority: 1, payload: { text: 'Show projects in Sector 76' } },
          { id: `chip_tax_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View Stamp Duty & Taxes', icon: 'file-text', analyticsId: 'chip_p_tax', priority: 2, payload: { text: 'How much stamp duty and GST do I pay in UP?' } }
        ],
        missingFields: [],
        confidence: 'HIGH'
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return true
    }

    // Project-scoped cache read — the global read at the top of the handler
    // runs before intent extraction, so it cannot see (and must not see)
    // project-specific entries.
    const planScope = `project:${planProject.id}`
    const cachedPlan = await getCachedResponse(ctx.message, planScope)
    if (cachedPlan) {
      ctx.send('token', { token: cachedPlan.token })
      if (cachedPlan.chips?.length) {
        ctx.emitUiState({
          stage: 'RESEARCH',
          thinking: `Verified payment schedules for ${planProject.name} (cached):`,
          chips: cachedPlan.chips,
          missingFields: [],
          confidence: 'HIGH',
        })
      }
      ctx.send('done', { sessionId: ctx.sessionId, intentState: ctx.intentState, intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return true
    }

    const paymentPlans = planProject?.payment_plans || []

    // When the developer's schedule is not in our records we say so rather
    // than substituting three invented plans under a "Verified …" header,
    // which is what this branch used to do. Payment terms are the basis of
    // a buyer's cash-flow planning; a plausible-looking wrong schedule is
    // worse here than no answer.
    if (paymentPlans.length === 0) {
      ctx.send('token', {
        token: `### Payment Plans: ${planProject.name}\n\n${unverified('developer payment schedule', planProject.name)}\n\nWhat I can tell you now: most Noida developers offer some combination of a construction-linked plan, a down-payment plan (usually carrying an upfront discount on base price), and a flexi/milestone split — but which of those ${planProject.name} actually offers, and on what percentages, is exactly the part we would be guessing at.`,
      })
      ctx.emitUiState({
        stage: 'RESEARCH',
        thinking: `Payment schedule not yet verified for ${planProject.name}:`,
        chips: [
          { id: `chip_advisory_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Get the official schedule', icon: 'phone', analyticsId: 'chip_plan_advisory', priority: 1, payload: { text: `Connect me with an advisor about payment plans for ${planProject.name}` } },
          { id: `chip_emi_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Calculate Monthly EMI', icon: 'calculator', analyticsId: 'chip_plan_emi', priority: 2, payload: { text: `Calculate EMI for ${planProject.name}` } },
          { id: `chip_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View Cost Sheet & Taxes', icon: 'file-text', analyticsId: 'chip_plan_cost', priority: 3, payload: { text: `Show cost sheet and price breakdown for ${planProject.name}` } },
        ],
        missingFields: ['payment_plans'],
        confidence: confidenceFor(['missing']),
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: ctx.intentState, intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return true
    }

    // Rendered here, not by the model. Payment tables were among the most
    // expensive answers we produced — a full grid composed from numbers we had
    // just injected — and the one column that argues against a plan
    // (`watch_out`) was the easiest for the model to quietly drop.
    const planTable = renderPaymentPlanTable(paymentPlans as PaymentPlanRow[])
    const tableBlock = planTable ? `### Payment Plans & Milestones — ${planProject.name}\n\n${planTable}\n\n` : ''
    if (tableBlock) {
      ctx.send('token', { token: tableBlock })
      recordTableRendered(ctx.trace, {
        tableType: 'payment_plan',
        projectName: planProject.name,
        rowCount: paymentPlans.length,
        characterLength: tableBlock.length,
      })
    }

    const planFactsJson = JSON.stringify({
      projectName: planProject?.name,
      developer: planProject?.builder?.name,
      payment_plans: paymentPlans,
    }, null, 2)

    // Rules first, data last — the facts JSON used to sit on line 2, which made
    // everything after it uncacheable. See `promptPrefixStability.test.ts`.
    const systemPrompt = `You are RealtyPal, a professional real estate advisor for Noida and Greater Noida.

THE TABLE IS ALREADY ON SCREEN.
The plans have just been rendered for the buyer from our own rows — the instalment schedule of each, stage by stage, with the share and rupee amount due at every stage, plus any watch-out. Do not draw a table and do not restate its numbers.

Write two short paragraphs and nothing else:
1. The cash-flow trade-off across these schedules. Which one costs less in total, which one keeps more cash free, and why that difference matters for someone buying at this price.
2. Which to choose, and the condition that changes the answer — "take the down-payment plan if you have the cash idle; take construction-linked if you are still saving."

No headings. No emoji. Around 120 words. If a cell said "Not recorded", you may say we do not hold that figure; never supply one.

Verified Payment Plan Database Facts: ${planFactsJson}`

    const systemMsgHistory = [{ role: 'user' as const, content: ctx.message }]
    let proseText = ''
    try {
      const fallbackResult = await executeWithFallbackChain({
        systemPrompt,
        messages: systemMsgHistory,
        send: ctx.send,
        onToolCall: async () => ({}),
        config: { maxTokens: 1500, tools: false },
        suppressTables: Boolean(planTable),
        groqFallbackSuffix: '',
        userMessage: ctx.message,
      })
      proseText = fallbackResult.text || ''
    } catch {
      proseText = ''
    }

    if (!proseText.trim()) {
      proseText = `**What to check before choosing a plan:**\n- **Construction-Linked Plans (CLP)** tie each payment to a construction milestone, so money moves only as the building does.\n- **Down Payment Plans** ask for most of the price up front; weigh any discount offered against the risk of paying before delivery.\n- Ask for the bank APF (Advance Processing Facility) tie-ups and the RERA escrow account details before signing.`
      ctx.send('token', { token: '\n\n' + proseText })
    }

    const planChips = [
      {
        id: `chip_emi_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `Calculate EMI for ${planProject?.name}`,
        icon: 'calculator',
        analyticsId: 'chip_plan_emi',
        priority: 1,
        payload: { text: `Calculate monthly EMI for ${planProject?.name} for 20 years at current interest rates` },
      },
      {
        id: `chip_cost_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `${planProject?.name} Cost Sheet Breakdown`,
        icon: 'file-text',
        analyticsId: 'chip_plan_cost',
        priority: 2,
        payload: { text: `Show full cost sheet breakdown and taxes for ${planProject?.name}` },
      },
      {
        id: `chip_compare_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `Compare ${planProject?.name} vs Competitors`,
        icon: 'scales',
        analyticsId: 'chip_plan_compare',
        priority: 3,
        payload: { text: `What other projects compete with ${planProject?.name}, and how do their prices and plans differ?` },
      },
    ]

    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Analyzing payment plan schedules for ${planProject?.name}:`,
      chips: planChips,
      missingFields: [],
      confidence: 'HIGH'
    })

    const fullResponseText = (tableBlock + '\n\n' + proseText).trim()
    ctx.setCachedResponse(ctx.message, { token: fullResponseText, chips: planChips }, undefined, planScope)
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
