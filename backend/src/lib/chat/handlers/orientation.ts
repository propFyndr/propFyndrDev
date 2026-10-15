import { matchProjectInText } from '../../discovery/matchProjectInText'
import { prisma } from '../../db'
import { readFacing, recordedOrientations } from '../../discovery/facing'
import { renderOrientation } from '../../ai/orientationAnswer'
import { confidenceFor } from '../../factPresentation'
import type { ChatTopicHandler } from '../handlerContext'

/**
 * orientation
 *
 * "Which flats in Ace Parkway face east?" reached the model with unit types that
 * carried no orientation, so there was nothing to answer from. The orientation is
 * stored per configuration; this lists which configurations list the direction asked,
 * says that is the record (not a tower or a floor), and says plainly when we hold none.
 *
 * "Facing sunrise" is east. Declines when no project is named (a search like
 * "east-facing flats in Noida" is discovery's, with the facing as a filter), and when
 * two projects are being compared.
 */
const ASKS_ORIENTATION = /\b(?:facing|faces?|orientation|direction|which\s+side|kis\s+taraf|disha)\b/i
const POINTER = /\b(?:it|this|that|the\s+project|this\s+project|yeh|ye)\b/i

export const orientationHandler: ChatTopicHandler = {
  id: 'orientation',
  description: 'Which configurations of a named project face a direction, as recorded',

  matches: ctx =>
    (readFacing(ctx.message).length > 0 || ASKS_ORIENTATION.test(ctx.message)) &&
    ctx.flags.isCompareRequest !== true &&
    (matchProjectInText(ctx.message, ctx.catalog) !== null ||
      (Boolean(ctx.activeProjectName) && POINTER.test(ctx.message) && ctx.sectorMatches.length === 0)),

  handle: async ctx => {
    const target =
      matchProjectInText(ctx.message, ctx.catalog) ??
      ctx.catalog.find(p => p.name.toLowerCase() === ctx.activeProjectName?.toLowerCase() || p.id === ctx.activeProjectName)
    if (!target) return false

    const project = await prisma.project.findUnique({
      where: { id: target.id },
      select: { name: true, unit_types: { orderBy: { bhk: 'asc' }, select: { name: true, bhk: true, unit_orientations: true } } },
    })
    if (!project) return false

    const wanted = readFacing(ctx.message)
    const answer = renderOrientation(
      project.name,
      project.unit_types.map(u => ({ name: u.name, bhk: u.bhk, orientations: recordedOrientations(u.unit_orientations) })),
      wanted,
      { sunrise: /sun\s?rise|rising\s+sun|morning\s+sun|purab|poorab/i.test(ctx.message) },
    )

    ctx.send('token', { token: answer.text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Orientation on record for ${project.name}:`,
      chips: [
        { id: `chip_or_fp_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Floor plans', icon: 'layers', analyticsId: 'chip_or_fp', priority: 1, payload: { text: `Show floor plans for ${project.name}` } },
        { id: `chip_or_visit_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Schedule site visit', icon: 'calendar', analyticsId: 'chip_or_visit', priority: 2, payload: { text: `Schedule a site visit for ${project.name}` } },
        { id: `chip_or_adv_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Confirm a unit with the builder', icon: 'phone', analyticsId: 'chip_or_adv', priority: 3, payload: { text: `Connect me with an advisor to confirm the facing of a unit in ${project.name}` } },
      ],
      missingFields: answer.withData === 0 ? ['unit_orientations'] : [],
      confidence: confidenceFor(answer.withData > 0 ? ['verified'] : ['missing']),
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: ctx.intentState, intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
    return true
  },
}
