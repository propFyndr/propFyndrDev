import type { ChatTopicHandler, ChatHandlerContext } from '../handlerContext'
import { lookupPublicRecord, publicRecordAnswer } from '../../publicRecord'

/**
 * A registration, completion-date or legal question about a project we do not hold.
 *
 * Before this the buyer got "missing". Now we read the official public record, and
 * the answer carries its source and the date we read it. A project we do hold never
 * comes here: its own rows answer it, and a public record never overrides them.
 */

const ASKS_RECORD =
  /\b(?:rera|registration|registered|completion\s+date|possession\s+date|litigation|court\s+case|legal\s+(?:status|issues?|cases?)|genuine|legit)\b/i

const NOT_A_NAME = new Set(['noida', 'greater', 'sector', 'up', 'rera', 'india', 'check', 'tell', 'what', 'is', 'the', 'i', 'does', 'do', 'can', 'please'])

/** The capitalised project name after "for / of / about / in / is", e.g. "Elite X". */
export function candidateProjectName(message: string): string | null {
  for (const m of message.matchAll(/\b(?:for|of|about|in|is|on)\s+((?:[A-Z][\w&'.-]*)(?:\s+(?:[A-Z][\w&'.-]*|\d+)){0,3})/g)) {
    const words = m[1].split(/\s+/).filter(w => !NOT_A_NAME.has(w.toLowerCase()))
    if (words.length) return words.join(' ')
  }
  return null
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function isInCatalog(name: string, catalog: ReadonlyArray<{ name: string }>): boolean {
  const n = norm(name)
  return catalog.some(c => {
    const cn = norm(c.name)
    return cn.length > 0 && (cn.includes(n) || n.includes(cn))
  })
}

export function matchesPublicRecordQuestion(ctx: Pick<ChatHandlerContext, 'message' | 'activeProjectName' | 'catalog'>): boolean {
  if (ctx.activeProjectName || !ASKS_RECORD.test(ctx.message)) return false
  const name = candidateProjectName(ctx.message)
  return name !== null && !isInCatalog(name, ctx.catalog)
}

export const publicRecordLookupHandler: ChatTopicHandler = {
  id: 'public_record_lookup',
  description: 'Registration or legal question about a project not in our records, answered from official public sources with a source and date',

  matches: ctx => matchesPublicRecordQuestion(ctx),

  handle: async ctx => {
    const name = candidateProjectName(ctx.message) as string
    const result = await lookupPublicRecord(name, ctx.guestToken ?? ctx.userId ?? ctx.sessionId)
    ctx.send('token', { token: publicRecordAnswer(name, result) })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'Reading official public records for a project outside our catalogue:',
      chips: [{ id: `chip_public_record_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Have an advisor pull the filing', icon: 'shield-check', analyticsId: 'chip_public_record_advisor', priority: 1, payload: { text: `I want an advisor to pull the official RERA filing for ${name}` } }],
      missingFields: [],
      confidence: 'LOW',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
