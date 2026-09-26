import { prisma } from '../../db'
import { sectorWhereClause } from '../../discovery/normalize'
import { renderSectorComparisonTable } from '../../ai/marketTable'
import { executeWithFallbackChain } from '../../ai/fallbackChain'
import type { ChatTopicHandler } from '../handlerContext'

/**
 * sector-comparison
 *
 * Lifted verbatim from the inline branch in chat-router.ts; only the router
 * locals were rebound to the handler context. The logic is untouched so the
 * extraction can be verified by comparing output against the previous build.
 */
export const sectorComparisonHandler: ChatTopicHandler = {
  id: 'sector-comparison',
  description: 'Sector versus sector on inventory, price and connectivity',

  /**
   * Two sectors, and only two.
   *
   * This handler takes sectorMatches[0] and [1] — the first two sector numbers
   * that appear anywhere in the message — and compares those. That is right for
   * "Sector 150 vs Sector 128" and badly wrong for a brief:
   *
   *   "I have ₹1.25 crore. I work near Sector 62, my wife works near Sector 135
   *    … Compare Sector 75, Sector 78, Sector 137 and Sector 150"
   *
   * produced a comparison of Sector 62 and Sector 135 — the two WORKPLACES —
   * and reported that Sector 135 has no inventory. The four sectors the buyer
   * actually asked about were never looked at, and the mechanical grader passed
   * it because the answer was long and well-formed.
   *
   * Three or more sectors is a multi-way brief: it belongs on the main advisory
   * path, which sees the whole intent rather than the first two regex hits.
   */
  matches: ctx =>
    ctx.flags.isSectorCompare === true && ctx.sectorMatches.length === 2,

  handle: async ctx => {
    // ─── SECTOR VS SECTOR COMPARISON ──────────────────────────────────────────
    const s1 = ctx.sectorMatches[0]
    const s2 = ctx.sectorMatches[1]

    // Query deep relations for the two sectors specifically
    const [s1DetailedProjs, s2DetailedProjs] = await Promise.all([
      prisma.project.findMany({
        // Blocked builders never reach the prompt as verified top projects.
        where: { OR: sectorWhereClause(s1), builder: { legal_flag: null } },
        include: { unit_types: true, builder: true }
      }),
      prisma.project.findMany({
        where: { OR: sectorWhereClause(s2), builder: { legal_flag: null } },
        include: { unit_types: true, builder: true }
      })
    ])

    const getStats = (projs: typeof s1DetailedProjs, sName: string) => {
      const prices = projs.flatMap(p => p.unit_types.map(u => u.price_min_cr)).filter(Boolean) as number[]
      const minP = prices.length ? Math.min(...prices) : null
      const maxP = prices.length ? Math.max(...prices) : null
      const readyCount = projs.filter(p => p.status === 'ready_to_move').length
      const topNames = projs.slice(0, 4).map(p => p.name).join(', ')
      return {
        sector: sName,
        totalProjects: projs.length,
        // These stats are fed to the model as "verified facts", so an
        // invented band here is laundered into a confident sentence about a
        // sector comparison. Absent means absent.
        priceRange: minP && maxP ? `₹${minP}–${maxP} Cr` : 'Not recorded',
        readyCount,
        topProjects: topNames || 'Not recorded'
      }
    }

    const s1Stats = getStats(s1DetailedProjs, s1)
    const s2Stats = getStats(s2DetailedProjs, s2)
    // Rendered here rather than by the model. The old prompt was a table
    // template with these very values already interpolated into its cells —
    // `${s1Stats.priceRange}`, `${s1Stats.topProjects}` — so the model was paid
    // to copy back bytes we had just paid to send it. The rows it was left to
    // fill on its own (`[Price per sqft range]`, `[Nearest metro station]`) had
    // no data behind them at all, which is where the invented figures came from.
    const comparisonTable = renderSectorComparisonTable(s1Stats, s2Stats)
    if (comparisonTable) {
      ctx.send('token', { token: `### ${s1} vs ${s2}\n\n${comparisonTable}\n\n` })
    }

    const sectorFactsJson = JSON.stringify({ [s1]: s1Stats, [s2]: s2Stats }, null, 2)

    /**
     * Rules first, data last — and the sector names come from the data.
     *
     * This prompt interpolated the facts JSON on line 2 and then `${s1}` and
     * `${s2}` three more times through the instructions, so its stable prefix
     * was 116 of 819 characters. Everything after the first per-turn value is
     * uncacheable, and here that was the whole instruction block.
     *
     * The names are still required in the answer; they are just sourced from
     * the facts below rather than baked into the rules, which is where they
     * were coming from anyway. The one thing that has to be explicit is the ban
     * on "the first"/"the second" — without it a de-parameterised instruction
     * invites the model to echo the placeholder wording back at the buyer.
     */
    const systemPrompt = `You are PropFyndr, a professional real estate advisor for Noida and Greater Noida.

THE TABLE IS ALREADY ON SCREEN.
A comparison of the two sectors named in the verified facts below has just been rendered for the buyer from our own rows — inventory counts, price bands and the landmark societies in each. Do not draw a table and do not restate its figures.

Always write both sectors by their full names exactly as the facts spell them. Never call them "the first" or "the second".

Write three short paragraphs and nothing else:
1. The verdict. Which of the two, and the single distinction that decides it.
2. What the buyer trades away by taking that one. Every choice here costs something; name it.
3. The condition that flips the answer, in the form "Choose X if … choose Y if …", where X and Y are the two sector names.

Rows reading "Not recorded" are gaps in our data, not zeros. You may say so; never fill one. No headings, no emoji, around 140 words.

Verified Sector Database Facts: ${sectorFactsJson}`

    const systemMsgHistory = [{ role: 'user' as const, content: ctx.message }]
    const fallbackResult = await executeWithFallbackChain({
      systemPrompt,
      messages: systemMsgHistory,
      send: ctx.send,
      onToolCall: async () => ({}),
      // No tools: this prompt already carries the facts it needs. Offering a
      // catalogue alongside a stub handler made the model loop through every
      // tool cycle and return nothing at all.
      config: { maxTokens: 1500, tools: false },
      // We rendered the table above; drop any the model draws anyway.
      suppressTables: Boolean(comparisonTable),
      groqFallbackSuffix: '',
      userMessage: ctx.message,
    })

    const sectorChips = [
      { id: `chip_s1_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Flats in ${s1}`, icon: 'building', analyticsId: 'chip_s1_search', priority: 1, payload: { text: `Show me 2 BHK and 3 BHK flats in ${s1}` } },
      { id: `chip_s2_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Flats in ${s2}`, icon: 'building', analyticsId: 'chip_s2_search', priority: 2, payload: { text: `Show me 2 BHK and 3 BHK flats in ${s2}` } },
      { id: `chip_emi_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Calculate Monthly EMI', icon: 'calculator', analyticsId: 'chip_emi', priority: 3, payload: { text: 'Calculate EMI' } },
    ]

    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Comparing ${s1} vs ${s2}:`,
      chips: sectorChips,
      missingFields: [],
      confidence: 'HIGH'
    })

    ctx.send('done', {
      sessionId: ctx.sessionId,
      intentState: 'SHORTLISTED',
      intent: ctx.intent,
      responseMode: 'sector_comparison',
    })
    ctx.res.end()
    return true
  },
}
