import type { ChatTopicHandler } from '../handlerContext'
import { BARE_YES } from '../followUp'

/**
 * A "yes" with nothing to say yes to.
 *
 * The router appends the offer or question a "yes" answers (expandAffirmation),
 * so a message that is still a bare "yes" here followed an answer that asked
 * nothing. Live transcript rerun 4 (17 Oct 2026): "yes" after the code-written
 * airport ranking reached the model, which invented "about 44 km, roughly 44
 * minutes" for ATS Dolce. Ask what next instead of guessing.
 */
export function matchesBareYes(message: string): boolean {
  return BARE_YES.test(message ?? '')
}

export const bareYesHandler: ChatTopicHandler = {
  id: 'bare_yes',
  description: 'A yes that answers no question: ask what next, offer the shortlist',
  matches: (ctx) => matchesBareYes(ctx.message),
  handle: async (ctx) => {
    const names = ctx.cachedProjects
      .map((c) => ctx.catalog.find((p) => p.id === c.id)?.name)
      .filter((n): n is string => Boolean(n))
      .slice(0, 2)
    const text = names.length
      ? `What should I do next? I can open the cost sheet for ${names[0]}, compare ${names.length > 1 ? `${names[0]} and ${names[1]}` : 'it with another project'}, check the builder's record, or book a site visit.`
      : 'What should I do next? Tell me a budget, sector or BHK and I will search, or name a project and I will open it.'
    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'What next?',
      chips: names.length
        ? [
            { id: `chip_yes_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Cost sheet: ${names[0]}`, icon: 'file-text', analyticsId: 'chip_bare_yes', priority: 1, payload: { text: `Show cost sheet and price breakdown for ${names[0]}` } },
            ...(names[1] ? [{ id: `chip_yes_cmp_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Compare ${names[0]} and ${names[1]}`, icon: 'columns', analyticsId: 'chip_bare_yes', priority: 2, payload: { text: `Compare ${names[0]} and ${names[1]}` } }] : []),
            { id: `chip_yes_visit_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Book a site visit', icon: 'calendar', analyticsId: 'chip_bare_yes', priority: 3, payload: { text: `Book a site visit to ${names[0]}` } },
          ]
        : [],
      missingFields: [],
      confidence: 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
