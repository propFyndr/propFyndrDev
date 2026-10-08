import type { ChatTopicHandler } from '../handlerContext'
import { sectorWhereClause } from '../../discovery/normalize'
import { prisma } from '../../db'
import { UP_STATUTORY, unverified } from '../../factPresentation'
import { matchProjectInText } from '../../discovery/matchProjectInText'

/**
 * "Which of these are ready to move?" / "ready vs under construction"
 *
 * Three things were corrected while extracting this branch:
 *
 *  - It defaulted to Sector 76 when the buyer named no sector and none was in
 *    the intent, so a general question silently became an answer about one
 *    arbitrary sector. It now answers from the carried-over projects, or asks.
 *  - The empty-result path emitted a literal table row reading
 *    "Consult verified listings | Available on request | Verified RERA | Active"
 *    — a fabricated row asserting RERA status for projects that did not exist.
 *  - A project with no rera_number was labelled "Registered". Absent is absent.
 *
 * The GST figures are statutory and now come from UP_STATUTORY rather than being
 * typed into the table.
 */
export const possessionStatusHandler: ChatTopicHandler = {
  id: 'possession_status',
  description: 'Ready-to-move vs under-construction status across projects',

  // Declines a multi-topic message so the generic grounded answer can

  // cover every part of it — see singleTopic in chat-router.ts.

  matches: ctx => ctx.flags.singleTopic === true && (ctx.flags.isReadyToMoveQuery === true),

  handle: async ctx => {
    /**
     * "Is Elite X ready to move?" is a yes or no about one building. It got a
     * six-project table of its sector, with the answer in row one.
     */
    // Named in this message only — a focus carried from an earlier turn must
    // not turn "ready to move flats in Sector 150" into one project's answer.
    const named = matchProjectInText(ctx.message, ctx.catalog)
    const one = named
      ? await prisma.project.findUnique({
          where: { id: named.id },
          select: { name: true, status: true, possession_label: true, rera_number: true },
        })
      : null
    if (one) {
      const ready = one.status === 'ready_to_move' || !!one.possession_label?.toLowerCase().includes('delivered')
      const when = one.possession_label ? `; possession is committed for ${one.possession_label}` : '; we do not hold a committed possession date'
      const rera = one.rera_number ? ` (UP-RERA ${one.rera_number})` : ''
      const text = ready
        ? `**Yes — ${one.name} is ready to move**${rera}. Ask for the Occupancy Certificate for your tower before paying: GST is ${UP_STATUTORY.gstReadyToMovePct}% only once OC is granted.`
        : `**No — ${one.name} is under construction**${when}${rera}. An under-construction purchase carries ${UP_STATUTORY.gstUnderConstructionPct}% GST, and the RERA date is the one the builder is legally held to.`
      ctx.send('token', { token: text })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: `Move-in status for ${one.name}:`, chips: [], missingFields: [], confidence: 'HIGH' })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    const sectorMatch = ctx.message.match(/Sector\s*(\d+[A-Za-z]?)/i)
    const sector = sectorMatch
      ? `Sector ${sectorMatch[1]}`
      : (typeof ctx.intent.sector === 'string' ? ctx.intent.sector : null)
    const cachedIds = ctx.cachedProjects.map(p => p.id)

    // No sector and nothing carried over — there is nothing to answer about, and
    // picking a sector for the buyer would be inventing the question.
    if (!sector && cachedIds.length === 0) {
      ctx.send('token', {
        token: `### Ready to move, or under construction?\n\nBoth are available across Noida and Greater Noida. Tell me a sector or a budget and I'll show you what is ready now versus what is still building.\n\nThe practical difference: a ready-to-move home with an Occupancy Certificate carries **${UP_STATUTORY.gstReadyToMovePct}% GST**, while an under-construction purchase carries **${UP_STATUTORY.gstUnderConstructionPct}%**. On a ₹2 Cr purchase that alone is a material difference.`,
      })
      ctx.emitUiState({
        stage: 'CLARIFYING',
        thinking: 'Which area should I check?',
        chips: [
          { id: `chip_rtm_all_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Ready to move in Noida', icon: 'check-circle', analyticsId: 'chip_rtm_all', priority: 1, payload: { text: 'Show ready to move flats in Noida' } },
          { id: `chip_tax_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Stamp duty & GST', icon: 'receipt', analyticsId: 'chip_tax_rtm', priority: 2, payload: { text: 'How much stamp duty and GST do I pay in UP?' } },
        ],
        missingFields: ['sector'],
        confidence: 'LOW',
      }, { skipDedup: true })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'CLARIFYING', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    const sectorNumber = sector?.replace(/Sector\s*/i, '').trim()
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          ...sectorWhereClause(sector ?? ''),
          ...(cachedIds.length ? [{ id: { in: cachedIds } }] : []),
        ],
      },
      include: { builder: true },
      take: 6,
    })

    const scope = sector ? ` (${sector})` : ''

    if (projects.length === 0) {
      ctx.send('token', {
        token: `### Ready to move${scope}\n\n${unverified(`project list${scope ? ` for ${sector}` : ''}`)}`,
      })
      ctx.emitUiState({
        stage: 'RESEARCH',
        thinking: 'No matching projects on record:',
        chips: [
          { id: `chip_other_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Try another sector', icon: 'map-pin', analyticsId: 'chip_rtm_other', priority: 1, payload: { text: 'Show ready to move flats in Noida' } },
        ],
        missingFields: ['projects'],
        confidence: 'LOW',
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    const rows = projects.map(p => {
      const isReady = p.status === 'ready_to_move' || !!p.possession_label?.toLowerCase().includes('delivered')
      const moveStatus = isReady ? 'Ready to move' : (p.possession_label || 'Under construction')
      const stage = isReady ? 'Delivered' : 'Under construction'
      // Absent means absent — this used to read "Registered" for a project with
      // no RERA number on file, which asserts a compliance status we do not hold.
      const rera = p.rera_number ? `RERA ${p.rera_number}` : 'Not on record'
      const gst = isReady
        ? `${UP_STATUTORY.gstReadyToMovePct}% (with OC)`
        : `${UP_STATUTORY.gstUnderConstructionPct}%`
      return `| **${p.name}** | ${moveStatus} | ${stage} | ${rera} | ${gst} |`
    }).join('\n')

    const text = `### Move-in status${scope}

| Project | Move-in status | Stage | RERA | GST |
| :--- | :--- | :--- | :--- | :--- |
${rows}

**On a ready-to-move purchase:** GST is ${UP_STATUTORY.gstReadyToMovePct}% only once the Occupancy Certificate has been granted — check the Verification panel on the project page before assuming it. For a resale unit, ask for the executed sub-lease deed or the builder's transfer NOC confirming no pending authority dues.`

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'Move-in status from our records:',
      projects,
      chips: [
        { id: `chip_tax_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Stamp duty & taxes', icon: 'receipt', analyticsId: 'chip_tax_rtm', priority: 1, payload: { text: 'How much stamp duty and GST do I pay in UP?' } },
        { id: `chip_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View cost sheet', icon: 'file-text', analyticsId: 'chip_cost_rtm', priority: 2, payload: { text: 'Show cost sheet and price breakdown' } },
        { id: `chip_visit_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Schedule site visit', icon: 'calendar', analyticsId: 'chip_visit_rtm', priority: 3, payload: { text: 'Schedule a site visit' } },
      ],
      missingFields: [],
      confidence: 'HIGH',
    })
    ctx.send('done', {
      sessionId: ctx.sessionId,
      intentState: 'SHORTLISTED',
      intent: ctx.intent,
      projects,
      responseMode: 'chat',
    })
    ctx.res.end()
  },
}
