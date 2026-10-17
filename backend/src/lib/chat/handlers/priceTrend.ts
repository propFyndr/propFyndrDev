import { matchProjectInText } from '../../discovery/matchProjectInText'
import { prisma } from '../../db'
import { asksPriceMovement } from '../../priceMovement'
import { renderPriceTrend, yearAsked } from '../../ai/priceTrendAnswer'
import { confidenceFor } from '../../factPresentation'
import { recordTableRendered } from '../../monitoring/langfuse'
import type { ChatTopicHandler } from '../handlerContext'

/**
 * price_trend
 *
 * "Has the price of Ace Parkway changed over the last 12 months?" used to reach
 * the model with no price history in its prompt, because the relation was only
 * fetched for the words "price trend". The model then said the history was not
 * available while six rows sat in the database. Answered here instead, in code:
 * the recorded points, each labelled observed or benchmark, a rate of change only
 * between two observed points, and what would settle it when we cannot say.
 *
 * Declines (and the generic path carries on) when no project is named or in
 * focus, when two projects are being compared, or when the message asks several
 * things at once: a sector-level question ("appreciation in Sector 150") is not
 * this handler's to answer.
 */
/**
 * "3 bhk + servant royale price trend in the last 12 months" named no project and
 * none was in focus, so it fell to the main lane, which drew a forward what-if
 * appreciation ladder on the buyer's budget and then hit the outage notice (live
 * transcript, 17 Oct 2026). A backward-looking price question with a shortlist on
 * screen is about those projects: answer for the one in focus, or ask which.
 */
const BACKWARD = /\b(?:last|past|previous|ago|history|since|over\s+the\s+(?:year|years|months))\b/i
const AREA_WIDE = /\b(?:noida|greater\s+noida|market|city|sector\s*\d|area|corridor)\b/i

export function asksProjectPriceHistory(message: string): boolean {
  return asksPriceMovement(message) && BACKWARD.test(message) && !AREA_WIDE.test(message)
}

export const priceTrendHandler: ChatTopicHandler = {
  id: 'price_trend',
  description: "How a named project's price moved: recorded points, each labelled observed or benchmark",

  matches: ctx =>
    asksPriceMovement(ctx.message) &&
    ctx.flags.isCompareRequest !== true &&
    (matchProjectInText(ctx.message, ctx.catalog) !== null || Boolean(ctx.activeProjectName) ||
      (asksProjectPriceHistory(ctx.message) && ctx.cachedProjects.length > 0)),

  handle: async ctx => {
    const target =
      matchProjectInText(ctx.message, ctx.catalog) ??
      ctx.catalog.find(p => p.name.toLowerCase() === ctx.activeProjectName?.toLowerCase() || p.id === ctx.activeProjectName)
    if (!target) {
      const names = ctx.cachedProjects.map(c => ctx.catalog.find(p => p.id === c.id)?.name).filter(Boolean).slice(0, 6) as string[]
      if (!names.length) return false
      ctx.send('token', { token: `Price history is recorded per project, not per unit type. Which one should I check?

${names.map(n => `- ${n}`).join('\n')}

I'll show the recorded price points and say which are observed and which are benchmarks.` })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Which project?', chips: names.slice(0, 3).map((n, i) => ({ id: `chip_pt_pick_${i}_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: n, icon: 'trending-up', analyticsId: 'chip_pt_pick', priority: i + 1, payload: { text: `Price trend of ${n} in the last 12 months` } })), missingFields: ['project'], confidence: 'HIGH' })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    const project = await prisma.project.findUnique({
      where: { id: target.id },
      select: {
        name: true,
        price_history: {
          where: { price_per_sqft: { not: null } },
          orderBy: { recorded_at: 'asc' },
          select: { quarter_label: true, recorded_at: true, price_per_sqft: true, source: true },
        },
      },
    })
    if (!project) return false

    const answer = renderPriceTrend(
      project.name,
      project.price_history.map(h => ({
        quarterLabel: h.quarter_label,
        recordedAt: h.recorded_at,
        pricePerSqft: h.price_per_sqft as number,
        source: h.source,
      })),
      { year: yearAsked(ctx.message) },
    )

    ctx.send('token', { token: answer.text })
    if (answer.pointCount > 0) {
      recordTableRendered(ctx.trace, {
        tableType: 'price_trend',
        projectName: project.name,
        rowCount: answer.pointCount,
        characterLength: answer.text.length,
      })
    }
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Recorded price points for ${project.name}:`,
      chips: [
        { id: `chip_pt_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Cost sheet & taxes', icon: 'file-text', analyticsId: 'chip_pt_cost', priority: 1, payload: { text: `Show cost sheet and price breakdown for ${project.name}` } },
        { id: `chip_pt_advisor_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Get the official price list', icon: 'phone', analyticsId: 'chip_pt_advisor', priority: 2, payload: { text: `Connect me with an advisor about the price list for ${project.name}` } },
        { id: `chip_pt_plan_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Payment plans', icon: 'calendar', analyticsId: 'chip_pt_plan', priority: 3, payload: { text: `Show payment plans for ${project.name}` } },
      ],
      missingFields: answer.observedCount >= 2 ? [] : ['observed_price_history'],
      // Two observed points are our own market observations; anything less is benchmark.
      confidence: confidenceFor(answer.observedCount >= 2 ? ['verified'] : ['market']),
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: ctx.intentState, intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
    return true
  },
}
