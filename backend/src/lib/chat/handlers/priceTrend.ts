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
export const priceTrendHandler: ChatTopicHandler = {
  id: 'price_trend',
  description: "How a named project's price moved: recorded points, each labelled observed or benchmark",

  matches: ctx =>
    asksPriceMovement(ctx.message) &&
    ctx.flags.isCompareRequest !== true &&
    (matchProjectInText(ctx.message, ctx.catalog) !== null || Boolean(ctx.activeProjectName)),

  handle: async ctx => {
    const target =
      matchProjectInText(ctx.message, ctx.catalog) ??
      ctx.catalog.find(p => p.name.toLowerCase() === ctx.activeProjectName?.toLowerCase() || p.id === ctx.activeProjectName)
    if (!target) return false

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
