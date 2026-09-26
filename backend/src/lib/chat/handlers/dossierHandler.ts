import type { ChatTopicHandler } from '../handlerContext'
import { buildDossier } from '../../dossier'

/**
 * Matches a request for a shareable summary of THIS conversation.
 *
 * The feature is named "dossier" internally; buyers say "memo", "chat
 * summary", "summarise this chat", or ask for something to share — with a
 * spouse, a parent, a CA, a friend. Who they share it with is theirs to
 * decide, so no recipient is required.
 *
 * What is deliberately NOT matched is a bare `summary`. "summary of this
 * project" is a question about a project and belongs to the handler that
 * holds its rows — so the conversation words (chat, conversation,
 * consultation, discussion, research) are required alongside it.
 */
export function asksForDossier(message: string): boolean {
  const q = message.toLowerCase()

  /** Anything naming a dossier, however it was asked for. */
  if (/\bdossiers?\b/.test(q)) return true

  /** "memo" is unambiguous here — nothing else in a property chat uses it. */
  if (/\bmemos?\b/.test(q)) return true

  /** A summary OF THE CONVERSATION, not of a project. */
  const convo = '(?:chat|conversation|consultation|discussion|research|findings)'
  if (new RegExp(`\\b${convo}\\s+(?:summary|recap|memo|report)\\b`).test(q)) return true
  if (new RegExp(`\\b(?:summar(?:y|ise|ize)|recap)\\b[^.?!]{0,30}\\b(?:this|our|the|my)\\s+${convo}\\b`).test(q)) return true

  /** Asking for something to share — with anyone. */
  if (/\b(?:summary|recap|report|something|a link)\s+(?:i\s+can\s+|to\s+)share\b/.test(q)) return true
  if (/\bshare\s+(?:this|our|my|the)\s+(?:chat|conversation|research|shortlist|findings|discussion)\b/.test(q)) return true
  if (/\bshare\s+(?:this|it|these|everything)\s+with\b/.test(q)) return true
  if (/\bshareable\s+(?:summary|recap|report|version|link|dossier)\b/.test(q)) return true
  if (/\b(?:family|spouse)\s*(?:summary|memo)\b/.test(q)) return true

  return false
}

export const dossierHandler: ChatTopicHandler = {
  id: 'dossier_generator',
  description: 'Builds a shareable dossier of this conversation: questions asked, answers given, and the projects researched',

  matches: ctx => asksForDossier(ctx.message),

  handle: async ctx => {
    const end = () => {
      if (ctx.res && typeof ctx.res.end === 'function') ctx.res.end()
    }

    const result = await buildDossier({
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      guestToken: ctx.guestToken,
      intentProjectNames: [...(ctx.intent.projectNames ?? []), ...(ctx.activeProjectName ? [ctx.activeProjectName] : [])],
      criteria: { budgetMinCr: ctx.intent.budgetMin, budgetMaxCr: ctx.intent.budgetMax, bhk: ctx.intent.bhk },
    })

    // No shortlist, no dossier. The newest catalogue rows are not the
    // buyer's shortlist, and this document is forwarded to other people.
    if (!result.ok) {
      const text = "I can put a shareable dossier together once we've looked at a project or two. Tell me which projects you're considering, or ask me for options first."
      ctx.send('token', { token: text })
      ctx.send('done', { sessionId: ctx.sessionId, intent: ctx.intent, responseMode: 'chat' })
      end()
      return true
    }

    const { dossier, questionCount, previousReactions } = result
    const url = `/dossier/${dossier.token}`
    const names = dossier.projects.map(p => p.name)
    const projectNames = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
    const priced = dossier.projects.filter(p => p.financials)
    const assumed = priced.filter(p => p.financials?.landedCostAssumed).map(p => p.name)
    const expires = new Date(dossier.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

    // Every line below describes what this dossier actually contains — no
    // section is promised that the data did not produce.
    const lines: string[] = [
      `Here's a dossier of this conversation you can share with anyone:`,
      '',
      `[Dossier of this conversation](${url})`,
      '',
      `It covers ${questionCount > 0 ? `the ${questionCount} question${questionCount === 1 ? '' : 's'} you asked and ` : ''}${names.length === 1 ? 'one project' : `${names.length} projects`}: ${projectNames}.`,
      `- For each project: price, possession, RERA number where we hold it, what's on record for and against it, and questions to ask on a site visit.`,
    ]
    if (priced.length > 0) {
      lines.push(
        `- Landed cost and EMI estimates for ${priced.length === dossier.projects.length ? (priced.length === 1 ? 'it' : 'all of them') : priced.map(p => p.name).join(', ')}.` +
          (assumed.length ? ` For ${assumed.join(', ')} we hold no all-in cost, so the landed cost uses a Noida-typical 30% and is labelled as an assumption.` : ''),
      )
    }
    if (priced.length < dossier.projects.length) {
      lines.push(`- No price on record for ${dossier.projects.filter(p => !p.financials).map(p => p.name).join(', ')}, so no cost estimate for ${priced.length < dossier.projects.length - 1 ? 'those' : 'it'}.`)
    }
    if (dossier.tradeOffDilemma) lines.push(`- The main trade-off you weighed: ${dossier.tradeOffDilemma.optionA.name} vs ${dossier.tradeOffDilemma.optionB.name}.`)
    lines.push('', `Anyone with the link can open it without logging in, like a project or flag a concern, and print it as a PDF. The link works until ${expires}.`)

    // Feedback on dossiers shared earlier from this chat. Written by whoever
    // held the link, so it is quoted, never interpreted.
    if (previousReactions.length > 0) {
      lines.push('', 'Feedback on the dossier you shared earlier:')
      for (const r of previousReactions.slice(0, 5)) {
        const parts: string[] = []
        if (r.likes) parts.push(`${r.likes} like${r.likes === 1 ? '' : 's'}`)
        if (r.concerns.length) parts.push(`concerns: ${r.concerns.slice(-3).map(c => `"${c}"`).join(', ')}`)
        lines.push(`- **${r.name}**: ${parts.join('; ')}`)
      }
    }

    ctx.send('token', { token: lines.join('\n') })
    ctx.emitUiState({
      stage: 'FINANCE',
      thinking: `Dossier created for ${projectNames}`,
      chips: [
        {
          id: `chip_dossier_open_${Date.now()}`,
          actionType: 'NAVIGATE',
          label: 'Open dossier',
          icon: 'external-link',
          analyticsId: 'chip_open_dossier',
          priority: 1,
          payload: { url },
        },
        {
          id: `chip_checklist_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Site-visit questions',
          icon: 'check-square',
          analyticsId: 'chip_print_checklist',
          priority: 2,
          payload: { text: `What specific due-diligence questions should I ask during my site visit to ${projectNames}?` },
        },
      ],
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'FINANCED', intent: ctx.intent, responseMode: 'chat' })
    end()
  },
}
