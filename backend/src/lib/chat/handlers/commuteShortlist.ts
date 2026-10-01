// backend/src/lib/chat/handlers/commuteShortlist.ts
//
// The buyer named where they work. Answer with where to live.
//
// This is the turn the funnel used to die on. Measured on a 15-turn production
// run, "central noida, sector 63 noida in particular for office" produced:
//
//   "It is a business district, not a residential sector. I can't pull the cost
//    sheet or availability right now — connect with our advisory team..."
//
// A workplace is the strongest signal a buyer gives, because it converts an
// open-ended search into a ranked one. `commuteAnchor` has already moved it out
// of the search filters and handed back the residential belt; this renders the
// belt against inventory we actually hold, with cards, and asks them to pick a
// sector — which is the rung between "I want to buy" and a project card.

import { prisma } from '../../db'
import type { ChatTopicHandler } from '../handlerContext'
import { renderProjectTable } from '../../ai/marketTable'
import { loadMentionedProjectCards } from '../mentionedProjectCards'
import { UP_STATUTORY } from '../../factPresentation'

/**
 * "1.5 cr all inclusive" is a ceiling on what leaves the buyer's account, not
 * on the base price. Read as base, a ₹1.45 Cr under-construction flat passed
 * the filter and cost ~₹1.64 Cr once stamp duty, registration and GST landed.
 */
export const ALL_IN_BUDGET = /\b(?:all[- ]?in(?:clusive)?|inclusive of (?:all|taxes|stamp)|including (?:stamp|registration|gst|taxes|all)|sab\s+mila\s*ke|sab\s+milake)\b/i

/** Statutory multiplier on a base price: stamp duty + registration, plus GST if under construction. */
export function statutoryMultiplier(status: string | null | undefined): number {
  const s = UP_STATUTORY
  const gst = status === 'ready_to_move' ? s.gstReadyToMovePct : s.gstUnderConstructionPct
  return 1 + (s.stampDutyPct + s.registrationPct + gst) / 100
}

/** Projects per sector in the belt summary, and sectors in the belt. */
const PER_SECTOR = 3
const MAX_SECTORS = 4

export const commuteShortlistHandler: ChatTopicHandler = {
  id: 'commute-shortlist',
  description: 'Buyer named their workplace — rank residential sectors by commute and shortlist inventory',

  /**
   * Fires on the turn the workplace is STATED, or when the belt is asked for.
   *
   * The first version matched on `workplace && belt && !sector`, and since the
   * workplace is sticky for the rest of the session that was true on every
   * later turn. Measured: it then answered "what is the payment plan for it",
   * "tell me about the first one" and "compare it with the second option" with
   * the identical belt shortlist, three turns running.
   *
   * That is the same failure as `ctx.intent.purpose === 'investment'` in
   * citywideQuery — a sticky intent field letting a handler claim turns about
   * something else entirely. A handler must match on what was ASKED.
   */
  matches: ctx => {
    const workplace = (ctx.intent as { workplace?: string }).workplace
    const belt = (ctx.intent as { workplace_belt?: string[] }).workplace_belt
    if (!workplace || !Array.isArray(belt) || belt.length === 0) return false
    if (ctx.intent.sector) return false

    // A turn about one project is never this handler's, however the buyer got
    // there — by name, by ordinal, or by the session's focus.
    if ((ctx.intent.projectNames?.length ?? 0) > 0) return false

    // Newly stated this turn: the router sets this when `applyCommuteAnchor`
    // fired on this message.
    if (ctx.flags.commuteAnchorJustStated) return true

    // Or asked for outright: "build me that shortlist", "where should I live",
    // "which areas", "yes" straight after the anchor turn.
    return /\b(shortlist|short list|which (?:areas?|sectors?|belts?)|where should i (?:live|buy|look)|options? near|near my (?:office|work)|commute|build (?:me )?that|go ahead|yes\b)/i
      .test(ctx.message)
  },

  handle: async ctx => {
    const workplace = String((ctx.intent as { workplace?: string }).workplace)
    const belt = ((ctx.intent as { workplace_belt?: string[] }).workplace_belt ?? []).slice(0, MAX_SECTORS)
    const bhk = ctx.intent.bhk?.[0]
    const budgetMax = ctx.intent.budgetMax
    const allIn = budgetMax != null && ALL_IN_BUDGET.test(ctx.message)
    // Loosest base ceiling first (ready-to-move pays no GST); each row is then
    // checked against its own status below.
    const baseCeiling = budgetMax == null ? null : allIn ? budgetMax / statutoryMultiplier('ready_to_move') : budgetMax

    // Inventory in the belt, filtered by whatever the buyer has already told us.
    // The price test sits on the unit of the asked BHK — the project's cheapest
    // unit of any size let a 2 BHK's price admit a 3 BHK search.
    // Belt order is commute order, so the grouping below preserves it.
    const unitWhere = {
      ...(bhk != null ? { bhk } : {}),
      ...(baseCeiling != null ? { price_min_cr: { lte: baseCeiling } } : {}),
    }
    const fetched = await prisma.project.findMany({
      where: {
        sector: { in: belt, mode: 'insensitive' },
        ...(Object.keys(unitWhere).length ? { unit_types: { some: unitWhere } } : {}),
      },
      select: {
        id: true, name: true, sector: true, status: true,
        price_min_cr: true, price_range_label: true,
        builder: { select: { name: true } },
        unit_types: { where: unitWhere, select: { price_min_cr: true }, orderBy: { price_min_cr: 'asc' }, take: 1 },
      },
    })
    const rows = fetched
      .map(r => {
        const base = r.unit_types[0]?.price_min_cr ?? null
        // The table's price column shows the asked BHK's price, not the project's cheapest unit.
        return { ...r, price_min_cr: base ?? r.price_min_cr, matchedBase: base, allInFrom: base != null ? base * statutoryMultiplier(r.status) : null }
      })
      .filter(r => !allIn || r.allInFrom == null || r.allInFrom <= (budgetMax as number))
      .sort((a, b) => (a.matchedBase ?? Infinity) - (b.matchedBase ?? Infinity))

    // Nothing in the belt within their constraints. Decline rather than
    // widening silently — the generic path can ask about budget, and inventing
    // a commute answer over an empty result is what this handler exists to
    // stop.
    if (rows.length === 0) {
      console.log('[CHAT:COMMUTE_SHORTLIST] no inventory in belt', { workplace, belt, bhk, budgetMax })
      return false
    }

    const bySector = new Map<string, typeof rows>()
    for (const sector of belt) {
      const inSector = rows.filter(r => (r.sector ?? '').toLowerCase() === sector.toLowerCase())
      if (inSector.length) bySector.set(sector, inSector.slice(0, PER_SECTOR))
    }

    const constraint = [
      bhk != null ? `${bhk} BHK` : null,
      budgetMax != null ? `under ₹${budgetMax} Cr${allIn ? ' all-in' : ''}` : null,
    ].filter(Boolean).join(' ')

    const lines: string[] = [
      `### Living near ${workplace}`,
      '',
      `${workplace} is a commercial sector, so the question is which residential belt gives you the shortest daily run into it. ` +
      `Ranked by commute convenience, with ${constraint || 'inventory'} we hold in each:`,
      '',
    ]

    let rank = 1
    for (const [sector, projects] of bySector) {
      const names = projects.map(p => p.name).join(', ')
      lines.push(`**${rank}. ${sector}** — ${projects.length} option${projects.length === 1 ? '' : 's'} on record: ${names}`)
      rank += 1
    }

    const absent = belt.filter(s => !bySector.has(s))
    if (absent.length) {
      lines.push('', `_We hold nothing matching in ${absent.join(', ')} — that is a gap in our records, not a statement that nothing is being built there._`)
    }

    // One table across the belt, cheapest first, so the buyer can compare
    // before committing to a sector.
    const shortlist = rows.slice(0, 6)
    const table = renderProjectTable(shortlist as never)
    if (table) lines.push('', table)

    if (allIn) {
      const priced = shortlist.filter(p => p.allInFrom != null)
      if (priced.length) {
        lines.push('', `**All-in from** (base + ${UP_STATUTORY.stampDutyPct}% stamp duty + ${UP_STATUTORY.registrationPct}% registration, + ${UP_STATUTORY.gstUnderConstructionPct}% GST if under construction):`)
        for (const p of priced) {
          lines.push(`- ${p.name}: ₹${(p.allInFrom as number).toFixed(2)} Cr${p.status === 'ready_to_move' ? ' (ready to move, no GST)' : ''}`)
        }
        lines.push('', '_Developer charges (parking, club, power backup, IFMS) come on top and vary by project — ask for the cost sheet before you count on these totals._')
      }
    }

    lines.push('', `Which belt suits you — or shall I pull the full comparison for the closest one?`)

    const cards = await loadMentionedProjectCards(shortlist.map(p => ({ id: p.id, name: p.name })))
    if (cards.length > 0) {
      ctx.send('properties', {
        exactResults: cards,
        nearbyResults: [],
        expansion: null,
        renderTarget: 'both',
      })
    }

    /**
     * The list the buyer just read becomes the list "the first one" points at.
     *
     * Without this, `last_projects` still held whatever the discovery lane had
     * cached, so on the measured run "tell me about the first one" resolved to
     * ATS Nobility in Sector 4, Greater Noida West — a project from a different
     * result set, in a sector the buyer had not been shown and nowhere near
     * their Sector 63 office. An ordinal has to index the answer that was
     * actually displayed.
     */
    await prisma.chatSession.update({
      where: { id: ctx.sessionId },
      data: { last_projects: shortlist.map(p => ({ id: p.id, name: p.name })) },
    }).catch((e: unknown) => console.warn('[CHAT:COMMUTE_SHORTLIST:PERSIST]', (e as Error).message))

    ctx.send('token', { token: lines.join('\n') })
    ctx.emitUiState({
      stage: 'SHORTLISTED',
      thinking: `Ranked residential sectors by commute to ${workplace}`,
      chips: [...bySector.keys()].slice(0, 3).map((sector, i) => ({
        id: `chip_belt_${sector.replace(/\s+/g, '_')}_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `Show ${sector}`,
        icon: 'building',
        analyticsId: 'chip_commute_belt',
        priority: i + 1,
        payload: { text: `Show me ${ctx.intent.bhk?.[0] ?? 3} BHK projects in ${sector}` },
      })),
      missingFields: [],
      confidence: 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
    return true
  },
}
