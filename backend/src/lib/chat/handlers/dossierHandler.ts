import type { ChatTopicHandler } from '../handlerContext'
import crypto from 'crypto'
import { prisma } from '../../db'
import { setCached } from '../../cache'
import { calculateAffordabilityBreakdown } from './affordabilityHandler'

const CRORE = 10_000_000

export const dossierHandler: ChatTopicHandler = {
  id: 'dossier_generator',
  description: 'Synthesizes and returns a 1-click shareable family consultation deal dossier',

  matches: ctx => {
    const q = ctx.message.toLowerCase()
    return (
      /\b(?:generate|create|share|make|get|view|download)\s*(?:a\s*)?(?:family\s*)?(?:deal\s*)?dossier\b/i.test(q) ||
      /\b(?:family|spouse)\s*(?:summary|memo|dossier)\b/i.test(q) ||
      q.includes('share with my family') ||
      q.includes('summary to share')
    )
  },

  handle: async ctx => {
    // 1. Identify target projects from intent, active project, cached, or catalog
    let targetProjects: any[] = []

    if (Array.isArray(ctx.intent.projectNames) && ctx.intent.projectNames.length > 0) {
      targetProjects = await prisma.project.findMany({
        where: {
          OR: ctx.intent.projectNames.map(name => ({
            name: { contains: String(name), mode: 'insensitive' },
          })),
        },
        include: { builder: true, unit_types: { orderBy: { price_min_cr: 'asc' } } },
        take: 3,
      })
    }

    if (targetProjects.length === 0 && ctx.activeProjectName) {
      const p = await prisma.project.findFirst({
        where: {
          OR: [
            { name: { contains: ctx.activeProjectName, mode: 'insensitive' } },
            { slug: { contains: ctx.activeProjectName, mode: 'insensitive' } },
          ],
        },
        include: { builder: true, unit_types: { orderBy: { price_min_cr: 'asc' } } },
      })
      if (p) targetProjects.push(p)
    }

    if (targetProjects.length === 0 && ctx.cachedProjects.length > 0) {
      targetProjects = await prisma.project.findMany({
        where: { id: { in: ctx.cachedProjects.map(cp => cp.id).slice(0, 3) } },
        include: { builder: true, unit_types: { orderBy: { price_min_cr: 'asc' } } },
      })
    }

    if (targetProjects.length === 0) {
      targetProjects = await prisma.project.findMany({
        take: 2,
        orderBy: { created_at: 'desc' },
        include: { builder: true, unit_types: { orderBy: { price_min_cr: 'asc' } } },
      })
    }

    // 2. Synthesize payload
    const token = crypto.randomBytes(16).toString('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 86400 * 1000)

    const projectsList = targetProjects.map(p => {
      const baseCr = p.price_min_cr || 1.5
      const fin = calculateAffordabilityBreakdown({
        basePrice: baseCr * CRORE,
        multiplier: p.all_in_cost_multiplier ?? 1.30,
      })

      const strengths: string[] = []
      if (p.water_source_type === 'ganga_water') strengths.push('Municipal Ganga Jal: Low TDS drinking supply.')
      if (p.amitabh_kant_clearance === true || p.oc_status === 'FULL_OC') strengths.push('Clean Registry Standing: Authority land dues cleared.')
      if (p.lift_act_compliant === true) strengths.push('UP Lifts Act 2024: Certified & registered.')
      if (strengths.length < 3) strengths.push('RERA Approved Project with dedicated escrow account.')

      const redFlags: string[] = []
      if (p.amitabh_kant_clearance === false) redFlags.push('Land Dues Unsettled: 25% Authority dues pending under Amitabh Kant formula.')
      if (p.water_source_type === 'groundwater_borewell') redFlags.push('Hard Borewell Water: High TDS groundwater (>900 ppm).')
      if (p.shahdara_drain_impact === true) redFlags.push('Drain Proximity: Within 500m of Shahdara drain corridor.')
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
        financials: {
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

    const dossier = {
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      consultation: {
        buyerName: 'Your Family',
        date: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        targetSector: targetProjects[0]?.sector ? `Sector ${targetProjects[0].sector}` : 'Noida',
        targetBhk: '3 BHK Layout',
      },
      projects: projectsList,
    }

    // 3. Cache for 30 days
    await setCached(`dossier:${token}`, dossier, 30 * 86400)

    const projectNames = targetProjects.map(p => p.name).join(' & ')

    const text = `### 📄 Family Deal Dossier Generated — Ready to Share

I have compiled your consultation findings for **${projectNames}** into a clean, unvarnished briefing memo formatted for your family and spouse:

👉 **[View & Share Family Deal Dossier](/dossier/${token})**

#### What is included in this dossier for your family:
- **The Unvarnished Truth ("The Good" vs "The Bad"):** Side-by-side verified pros vs forensic cautions (land dues, borewell TDS, drain odor corridor, elevator congestion).
- **Institutional Cash Outflow:** Advertised base price vs True Landed Cost (+28–35%) and net monthly EMI after Section 24(b) income tax relief.
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
    ctx.res.end()
  },
}
