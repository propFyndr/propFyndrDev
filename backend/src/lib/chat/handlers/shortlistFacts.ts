import type { ChatTopicHandler, ChatHandlerContext } from '../handlerContext'
import { prisma } from '../../db'
import { findProjectsMentioned } from '../../discovery/proseEntities'
import { statesFinancing } from '../../ai/affordability'

/**
 * Two questions about the projects on screen, answered from their rows.
 *
 * Live session ed1ac3ff (17 Oct 2026):
 *  - "tell me the banks readily available to provide home loan for these
 *    properties" got "SBI, HDFC, ICICI, Axis, PNB have established pre-approved
 *    funding tie-ups with the developer". We hold no lender approvals (APF) for
 *    any project; the model wrote a plausible list, and a bank name is not a
 *    figure, so no integrity check could see it.
 *  - "who is the developer of each?" answered for one project of six, then added
 *    "founded 2006", "25+ year track record", "ISO 9001", "CREDAI member".
 */

// Asks WHICH banks lend; "take an 80 lakh loan from the bank" is a financing plan.
const BANKS = /\b(?:which|what|list|tell|name|any)\b[^?.]{0,40}\b(?:banks|lenders)\b|\bbanks?\b[^?.]{0,30}\b(?:available|approv\w*|offer\w*|giv\w*|provid\w*)\b[^?.]{0,30}\bloans?\b|\bapf\b|\b(?:bank|lender)\s+(?:tie[- ]?ups?|approvals?)\b/i
const DEVELOPER_OF_EACH = /\bwho\s+(?:is|are)\s+(?:the\s+)?(?:developers?|builders?|promoters?)\b|\b(?:developers?|builders?)\s+(?:of|for|behind)\s+(?:each|these|them|all|those|the(?:se)?\s+(?:projects|properties|options))\b/i

export function matchesLoanBanks(message: string): boolean {
  return BANKS.test(message) && !/\binterest rate|emi\b/i.test(message) && !statesFinancing(message)
}

export function matchesDeveloperOfEach(message: string): boolean {
  return DEVELOPER_OF_EACH.test(message)
}

/** A value written on more than this many projects is a script's, not a filing's. */
const TEMPLATE_SHARE = 20

async function projectsInScope(ctx: ChatHandlerContext): Promise<string[]> {
  const named = await findProjectsMentioned(ctx.message, undefined, 12)
  if (named.length) return named.map((p) => p.id)
  return ctx.cachedProjects.map((p) => p.id).slice(0, 12)
}

function finish(ctx: ChatHandlerContext, token: string, thinking: string) {
  ctx.send('token', { token })
  ctx.emitUiState({ stage: 'RESEARCH', thinking, chips: [], missingFields: [], confidence: 'HIGH' })
  ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
  ctx.res.end()
}

const NO_SCOPE = 'Which projects do you mean? Name them, or run a search first and I will answer for the ones on screen.'

export function loanBanksAnswer(rows: Array<{ name: string; escrow_bank_name: string | null }>, templated: Set<string>): string {
  const lines = rows.map((r) => {
    const escrow = r.escrow_bank_name && !templated.has(r.escrow_bank_name) ? r.escrow_bank_name.trim() : 'Not on record'
    return `| ${r.name} | ${escrow} |`
  })
  return `### Home loans for these projects

We don't hold which banks have approved these projects for home loans (the approved project finance list, or APF), so I won't name lenders for them.

| Project | Escrow bank on the RERA record |
| :--- | :--- |
${lines.join('\n')}

The escrow bank is where the builder must deposit buyers' payments under RERA. It is not a lending approval, and you can take your loan from another bank.

To find out who lends on a project: ask the builder for its bank approval letters, and ask your own bank whether the project is on its approved list. Your bank checks the project's title and approvals itself before it sanctions the loan.`
}

export function developersAnswer(rows: Array<{ name: string; sector: string | null; builder: { name: string } | null }>): string {
  return `### Developer of each project

| Project | Sector | Developer |
| :--- | :--- | :--- |
${rows.map((r) => `| ${r.name} | ${r.sector ?? '—'} | ${r.builder?.name ?? 'Not on record'} |`).join('\n')}

Ask me about any one developer's delivery record and I'll show what we hold for it.`
}

export const loanBanksHandler: ChatTopicHandler = {
  id: 'loan_banks',
  description: 'Which banks lend on the shortlisted projects: escrow bank on record, no invented tie-ups',
  matches: (ctx) => matchesLoanBanks(ctx.message),
  handle: async (ctx) => {
    const ids = await projectsInScope(ctx)
    if (!ids.length) return finish(ctx, NO_SCOPE, 'Which projects?')
    const rows = await prisma.project.findMany({ where: { id: { in: ids } }, select: { name: true, escrow_bank_name: true } })
    // "HDFC Bank Escrow Account" sits on 60 projects on dev: a seeded value, not a filing.
    const shared = await prisma.project.groupBy({ by: ['escrow_bank_name'], _count: { escrow_bank_name: true }, where: { escrow_bank_name: { not: null } } })
    const templated = new Set(shared.filter((g) => g._count.escrow_bank_name > TEMPLATE_SHARE).map((g) => g.escrow_bank_name as string))
    finish(ctx, loanBanksAnswer(rows, templated), 'What we hold on lenders for these projects:')
  },
}

export const developerOfEachHandler: ChatTopicHandler = {
  id: 'developer_of_each',
  description: 'The developer of every project on screen, from our rows',
  matches: (ctx) => matchesDeveloperOfEach(ctx.message),
  handle: async (ctx) => {
    const ids = await projectsInScope(ctx)
    if (!ids.length) return false
    const rows = await prisma.project.findMany({ where: { id: { in: ids } }, select: { name: true, sector: true, builder: { select: { name: true } } } })
    finish(ctx, developersAnswer(rows), 'Developers on record:')
  },
}
