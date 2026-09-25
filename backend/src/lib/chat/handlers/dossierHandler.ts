import type { ChatTopicHandler } from '../handlerContext'
import crypto from 'crypto'
import { prisma } from '../../db'
import { setCached } from '../../cache'
import { calculateAffordabilityBreakdown } from './affordabilityHandler'
import { extractDossierNarrative } from '../dossierNarrativeExtractor'

const CRORE = 10_000_000

export const dossierHandler: ChatTopicHandler = {
  id: 'dossier_generator',
  description: 'Synthesizes and returns a 1-click shareable family consultation deal dossier',

  /**
   * Buyers do not call this a dossier.
   *
   * The feature is named "Deal Dossier" internally and the matcher was built
   * from that name, so it wanted `family memo`, `spouse summary` or a phrase
   * ending in `dossier`. What people actually type is "memo", "chat summary"
   * or "summarise this chat", and every one of those fell through to the
   * general lane.
   *
   * What is deliberately NOT matched is a bare `summary`. "summary of this
   * project" is a question about a project and belongs to the handler that
   * holds its rows — so the conversation words (chat, conversation,
   * consultation, discussion) are required alongside it.
   */
  matches: ctx => {
    const q = ctx.message.toLowerCase()

    /** Anything ending in "dossier", however it was asked for. */
    const asksForDossier =
      /\b(?:generate|create|share|make|get|view|download|send|prepare)\s*(?:a\s*|the\s*|me\s*(?:a\s*)?)?(?:family\s*)?(?:deal\s*)?dossier\b/i.test(q) ||
      /\bdossier\b/i.test(q)

    /** "memo" is unambiguous here — nothing else in a property chat uses it. */
    const asksForMemo = /\bmemos?\b/i.test(q)

    /** A summary OF THE CONVERSATION, not of a project. */
    const asksForChatSummary =
      /\b(?:chat|conversation|consultation|discussion)\s+(?:summary|recap|memo)\b/i.test(q) ||
      /\b(?:summar(?:y|ise|ize)|recap)\b[^.?!]{0,30}\b(?:this|our|the)\s+(?:chat|conversation|consultation|discussion)\b/i.test(q) ||
      /\b(?:family|spouse)\s*(?:summary|memo|dossier)\b/i.test(q)

    return (
      asksForDossier ||
      asksForMemo ||
      asksForChatSummary ||
      q.includes('share with my family') ||
      q.includes('summary to share')
    )
  },

  handle: async ctx => {
    // 1. Gather all project candidates across the entire session history
    let targetProjects: any[] = []
    const gatheredProjectIds = new Set<string>()
    const gatheredProjectNames = new Set<string>()

    // (a) Intent project names from current turn
    if (Array.isArray(ctx.intent.projectNames)) {
      for (const name of ctx.intent.projectNames) {
        if (name && typeof name === 'string' && name.trim()) {
          gatheredProjectNames.add(name.toLowerCase().trim())
        }
      }
    }

    // (b) Active project from current turn
    if (ctx.activeProjectName && typeof ctx.activeProjectName === 'string') {
      gatheredProjectNames.add(ctx.activeProjectName.toLowerCase().trim())
    }

    // (c) Cached projects from previous turn
    if (Array.isArray(ctx.cachedProjects)) {
      for (const cp of ctx.cachedProjects) {
        if (cp?.id) gatheredProjectIds.add(cp.id)
      }
    }

    // (d) Query the session history to discover ALL projects discussed across earlier turns
    let detectedBhk: string | undefined = undefined
    let detectedBudget: string | undefined = undefined
    let buyerName: string | undefined = undefined

    let rawSessionMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (ctx.sessionId) {
      try {
        const [sessionRecord, sessionMessages] = await Promise.all([
          prisma.chatSession.findUnique({
            where: { id: ctx.sessionId },
          }),
          prisma.chatMessage.findMany({
            where: { session_id: ctx.sessionId },
            orderBy: { created_at: 'asc' },
            select: { role: true, content: true },
          }),
        ])

        rawSessionMessages = sessionMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content || '',
        }))

        if (sessionRecord?.title && !sessionRecord.title.toLowerCase().startsWith('new') && !sessionRecord.title.toLowerCase().startsWith('test')) {
          // If a custom session title exists, use it as family consultation context
        }

        if (Array.isArray(sessionRecord?.last_projects)) {
          for (const pid of sessionRecord.last_projects as string[]) {
            if (pid) gatheredProjectIds.add(pid)
          }
        }

        // Scan all messages in chronological order for project mentions & buyer criteria
        const combinedText = sessionMessages.map(m => m.content || '').join('\n').toLowerCase()

        // Match against all catalog/DB projects across the entire conversation history
        const allProjects = await prisma.project.findMany({
          select: { id: true, name: true, slug: true },
        })

        const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

        // Sort projects by descending name length so specific longer names match first
        const sortedDbProjects = [...allProjects].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))
        const matchedSpans: { start: number; end: number; id: string }[] = []

        for (const proj of sortedDbProjects) {
          if (!proj.name || proj.name.length < 3) continue
          const regex = new RegExp(`\\b${escapeRegex(proj.name)}\\b`, 'gi')
          let match: RegExpExecArray | null
          while ((match = regex.exec(combinedText)) !== null) {
            const start = match.index
            const end = start + match[0].length
            // Discard if this span is already subsumed by a longer project name match
            const overlaps = matchedSpans.some(s => Math.max(s.start, start) < Math.min(s.end, end))
            if (!overlaps) {
              matchedSpans.push({ start, end, id: proj.id })
            }
          }
        }

        // Sort matched projects by their first appearance position in the conversation
        matchedSpans.sort((a, b) => a.start - b.start)
        for (const m of matchedSpans) {
          gatheredProjectIds.add(m.id)
        }

        // Detect BHK preferences in conversation
        const bhkMatches = combinedText.match(/\b([1-5])\s*bhk\b/gi)
        if (bhkMatches && bhkMatches.length > 0) {
          const uniqueBhks = Array.from(new Set(bhkMatches.map(b => b.toUpperCase().replace(/\s+/g, ' '))))
          detectedBhk = uniqueBhks.length > 1 ? uniqueBhks.slice(0, 2).join(' / ') : uniqueBhks[0]
        }

        // Detect budget preferences in conversation
        const budgetMatch = combinedText.match(/\b(?:under|below|around|within|budget(?:\s+of)?)\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?\s*(?:cr|crore|l|lakh|lac)?)\b/i)
        if (budgetMatch && budgetMatch[1]) {
          detectedBudget = `Up to ₹${budgetMatch[1].trim()}`
        }
      } catch (err) {
        console.warn('[DOSSIER:SESSION_SCAN_FAILED]', err)
      }
    }

    // Now resolve full project records from database
    const orConditions: any[] = []
    if (gatheredProjectIds.size > 0) {
      orConditions.push({ id: { in: Array.from(gatheredProjectIds) } })
    }
    if (gatheredProjectNames.size > 0) {
      for (const name of gatheredProjectNames) {
        orConditions.push({ name: { contains: name, mode: 'insensitive' } })
        orConditions.push({ slug: { contains: name, mode: 'insensitive' } })
      }
    }

    if (orConditions.length > 0) {
      const fetchedProjects = await prisma.project.findMany({
        where: { OR: orConditions },
        include: { builder: true, unit_types: { orderBy: { price_min_cr: 'asc' } } },
      })

      // Preserve chronological order of projects as discussed in the conversation
      const idOrder = Array.from(gatheredProjectIds)
      fetchedProjects.sort((a, b) => {
        const idxA = idOrder.indexOf(a.id)
        const idxB = idOrder.indexOf(b.id)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return 0
      })

      targetProjects = fetchedProjects.slice(0, 5) // Support up to 5 projects!
    }

    // No shortlist, no dossier. The newest catalogue rows are not the
    // buyer's shortlist, and this document is forwarded to their family.
    if (targetProjects.length === 0) {
      const text = "I can put a family dossier together once we have a project or two on your shortlist. Tell me which projects you're considering, or ask me for options first."
      ctx.send('token', { token: text })
      ctx.send('done', { sessionId: ctx.sessionId, intent: ctx.intent, responseMode: 'chat' })
      if (ctx.res && typeof ctx.res.end === 'function') ctx.res.end()
      return true
    }

    // 2. Synthesize payload
    const token = crypto.randomBytes(16).toString('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 86400 * 1000)

    const projectsList = targetProjects.map(p => {
      // No price on record, no financials: never price a building we do not hold a figure for.
      const baseCr = p.price_min_cr || 0
      const fin = calculateAffordabilityBreakdown({
        basePrice: baseCr * CRORE,
        multiplier: p.all_in_cost_multiplier ?? 1.30,
      })

      const strengths: string[] = []
      if (p.water_source_type === 'GANGA_JAL') strengths.push('Municipal Ganga Jal: Low TDS drinking supply.')
      if (p.amitabh_kant_clearance === true || p.oc_status === 'FULL_OC') strengths.push('Clean Registry Standing: Authority land dues cleared.')
      if (p.lift_act_compliant === true) strengths.push('UP Lifts Act 2024: Certified & registered.')

      const redFlags: string[] = []
      if (p.amitabh_kant_clearance === false) redFlags.push('Land Dues Unsettled: 25% Authority dues pending under Amitabh Kant formula.')
      if (p.water_source_type === 'BOREWELL') redFlags.push(`Hard Borewell Water: groundwater supply${p.water_tds_range ? ` (TDS ${p.water_tds_range})` : ''}.`)
      if (p.shahdara_drain_impact === true) redFlags.push('Drain Proximity: Near the Shahdara drain corridor.')
      if (p.lift_act_compliant === false) redFlags.push('UP Lifts Act Audit Pending: Registration in progress.')
      if (redFlags.length === 0) redFlags.push('Monitor construction milestones against RERA quarterly filings.')

      const siteVisitChecklist = [
        p.amitabh_kant_clearance === false
          ? 'Ask sales desk for Authority 25% dues deposit challan receipt.'
          : 'Ask for latest Authority sub-lease registry schedule and token list.',
        p.lift_act_compliant === false
          ? 'Request UP Lifts Act 2024 registration certificate copy.'
          : 'Inspect annual elevator safety inspection certificate on-site.',
        'Request building water treatment plant test certificate with TDS readings.',
        'Ask for approved RERA sanction architectural blueprints to verify carpet area.',
      ]

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        sector: p.sector,
        // null, not a label. A dossier is the artefact a buyer forwards to
        // their spouse and their lawyer; calling an unknown developer
        // "Verified Developer" asserts a check we never ran, about a third
        // party, in writing. The renderer omits the line when this is null.
        builderName: p.builder?.name ?? null,
        status: p.status,
        possessionLabel: p.possession_label,
        priceRangeLabel: p.price_range_label,
        priceMinCr: p.price_min_cr,
        heroImageUrl: p.hero_image_url || null,
        strengths,
        redFlags,
        financials: !baseCr ? null : {
          basePriceCr: baseCr,
          landedCostCr: parseFloat((fin.totalLandedCost / CRORE).toFixed(2)),
          downpaymentCr: parseFloat((fin.downpaymentAmount / CRORE).toFixed(2)),
          loanCr: parseFloat((fin.loanPrincipal / CRORE).toFixed(2)),
          standardEmi: fin.standardEmi,
          taxShieldMonthly: fin.monthlyTaxShieldSec24b,
          netMonthlyEmi: fin.netMonthlyOutflow,
          safeMonthlyIncome: fin.safeMonthlyTakeHome,
        },
        siteVisitChecklist,
      }
    })

    // Compute dynamic sectors and budget bracket from actual selected projects
    const uniqueSectors = Array.from(new Set(targetProjects.map(p => p.sector).filter(Boolean)))
    const targetSectorDisplay = uniqueSectors.length > 0
      ? uniqueSectors.map(s => s.toLowerCase().startsWith('sector') ? s : `Sector ${s}`).join(' & ')
      : 'Noida'

    const validPrices = targetProjects.map(p => p.price_min_cr).filter(Boolean) as number[]
    let dynamicBudget = detectedBudget
    if (!dynamicBudget && validPrices.length > 0) {
      const minP = Math.min(...validPrices)
      const maxP = Math.max(...validPrices)
      dynamicBudget = minP === maxP ? `₹${minP.toFixed(2)} Cr` : `₹${minP.toFixed(2)} - ${maxP.toFixed(2)} Cr`
    }

    // Extract multi-turn consultation narrative & trade-off dilemma
    const narrative = await extractDossierNarrative(rawSessionMessages, targetProjects)

    const dossier = {
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      consultation: {
        buyerName: buyerName || 'Your Family',
        date: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        targetSector: targetSectorDisplay,
        targetBhk: detectedBhk ? `${detectedBhk} Layout` : undefined,
        budgetLabel: dynamicBudget || undefined,
        searchEvolutionSummary: narrative.searchEvolutionSummary,
      },
      consultationTrail: narrative.consultationTrail,
      tradeOffDilemma: narrative.tradeOffDilemma,
      projects: projectsList,
      familyReactions: {},
    }

    // 3. Cache for 30 days
    await setCached(`dossier:${token}`, dossier, 30 * 86400)

    const projectNames = targetProjects.map(p => p.name).join(' & ')

    const text = `### 📄 Family Deal Dossier Generated — Ready to Share

I have compiled your consultation findings for **${projectNames}** into a clean, unvarnished briefing memo formatted for your family and spouse:

👉 **[View & Share Family Deal Dossier](/dossier/${token})**

#### What is included in this dossier for your family:
- **The Unvarnished Truth ("The Good" vs "The Bad"):** Side-by-side verified pros vs forensic cautions (land dues, borewell TDS, drain odor corridor, elevator congestion).
- **Institutional Cash Outflow:** Advertised base price vs landed cost (stamp duty, registration and charges) and net monthly EMI after Section 24(b) income tax relief.
- **Family Site-Visit Checklist:** 4 tailored questions to ask the builder's sales office before paying any token amount.

_The link is publicly accessible without login, supports 1-click WhatsApp sharing, and formats into a crisp 1-page report when printed or saved as PDF._`

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'FINANCE',
      thinking: `Deal dossier created for ${projectNames}:`,
      chips: [
        {
          id: `chip_dossier_open_${Date.now()}`,
          actionType: 'NAVIGATE',
          label: 'Open Family Dossier',
          icon: 'external-link',
          analyticsId: 'chip_open_dossier',
          priority: 1,
          payload: { url: `/dossier/${token}` },
        },
        {
          id: `chip_checklist_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Print Site-Visit Checklist',
          icon: 'check-square',
          analyticsId: 'chip_print_checklist',
          priority: 2,
          payload: { text: `What specific due-diligence questions should I ask during my site visit to ${projectNames}?` },
        },
      ],
      confidence: 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'FINANCED', intent: ctx.intent, responseMode: 'chat' })
    if (ctx.res && typeof ctx.res.end === 'function') {
      ctx.res.end()
    }
  },
}
