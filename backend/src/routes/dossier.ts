import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { prisma } from '../lib/db'
import { verifyUser } from '../lib/auth'
import { getCached, setCached, checkRateLimit } from '../lib/cache'
import { calculateAffordabilityBreakdown } from '../lib/chat/handlers/affordabilityHandler'

export const dossierRouter = Router()

const CRORE = 10_000_000

import {
  extractDossierNarrative,
  ConsultationStep,
  TradeOffDilemma,
  DossierNarrative,
} from '../lib/chat/dossierNarrativeExtractor'

export interface DossierProjectItem {
  id: string
  name: string
  slug: string
  sector: string
  builderName: string | null
  status: string
  possessionLabel: string | null
  priceRangeLabel: string | null
  priceMinCr: number | null
  heroImageUrl: string | null
  strengths: string[]
  redFlags: string[]
  financials: null | {
    basePriceCr: number
    landedCostCr: number
    downpaymentCr: number
    loanCr: number
    standardEmi: number
    taxShieldMonthly: number
    netMonthlyEmi: number
    safeMonthlyIncome: number
  }
  siteVisitChecklist: string[]
}

export interface FamilyDossier {
  token: string
  createdAt: string
  expiresAt: string
  consultation: {
    buyerName: string
    date: string
    targetSector?: string
    targetBhk?: string | number
    budgetLabel?: string
    notes?: string
    searchEvolutionSummary?: string
  }
  consultationTrail: ConsultationStep[]
  tradeOffDilemma?: TradeOffDilemma | null
  projects: DossierProjectItem[]
  familyReactions?: Record<string, { likes: number; concerns: string[] }>
}

/**
 * Synthesizes 4-point forensic site-visit checklist for a project.
 */
function buildSiteVisitChecklist(project: any): string[] {
  const checklist: string[] = []

  if (project.amitabh_kant_clearance === false) {
    checklist.push('Ask sales desk for Noida/Greater Noida Authority 25% dues deposit challan receipt.')
  } else {
    checklist.push('Ask for latest Authority sub-lease registry schedule and token issuance list.')
  }

  if (project.lift_act_compliant === false) {
    checklist.push('Request UP Lifts & Escalators Act 2024 registration certificate copy or directorate filing reference.')
  } else {
    checklist.push('Inspect AMC maintenance agreement and annual safety inspection certificate on-site.')
  }

  if (project.water_source_type === 'BOREWELL' || (project.water_tds_range && project.water_tds_range.includes('>'))) {
    checklist.push('Request building STP and RO water treatment plant test certificate with active TDS ppm readings.')
  } else {
    checklist.push('Verify Ganga Jal municipal pipeline connection meter and operational water pressure.')
  }

  checklist.push('Ask for approved RERA sanction architectural blueprints to verify carpet area dimensions.')
  return checklist.slice(0, 4)
}

/**
 * Evaluates verified strengths ("The Good") for a project.
 */
function extractStrengths(project: any): string[] {
  const pros: string[] = []
  if (project.water_source_type === 'GANGA_JAL') {
    pros.push('Municipal Ganga Jal Water: Low TDS drinking supply directly connected.')
  }
  if (project.amitabh_kant_clearance === true || project.oc_status === 'FULL_OC') {
    pros.push('Clean Registry Standing: Authority land dues cleared / Active sub-lease registration.')
  }
  if (project.lift_act_compliant === true) {
    pros.push('UP Lifts Act 2024 Certified: Registered and compliant vertical transit safety.')
  }
  if (project.shahdara_drain_impact === false) {
    pros.push('Optimal Environmental Buffer: Located safely outside the Shahdara drain corridor.')
  }
  if (project.builder?.average_delay_months != null && project.builder.average_delay_months <= 3) {
    pros.push(`Exemplary Delivery Track Record: Builder averages under ${project.builder.average_delay_months || 0} months delay.`)
  }
  return pros.slice(0, 4)
}

/**
 * Evaluates forensic cautions and red flags ("The Bad") for a project.
 */
function extractRedFlags(project: any): string[] {
  const cons: string[] = []
  if (project.amitabh_kant_clearance === false) {
    cons.push('Land Dues Unsettled: Builder has not cleared 25% Authority dues under Amitabh Kant formula; registry delayed.')
  }
  if (project.water_source_type === 'BOREWELL') {
    cons.push(`Hard Borewell Water: groundwater${project.water_tds_range ? ` (TDS ${project.water_tds_range})` : ''}; plan for RO filtration.`)
  }
  if (project.shahdara_drain_impact === true) {
    cons.push('Drain Corridor Proximity: Near the Shahdara drain corridor; seasonal odor and corrosion concerns.')
  }
  if (project.lift_act_compliant === false) {
    cons.push('UP Lifts Act Audit Pending: Lifts not yet registered on UP Directorate portal.')
  }
  if (project.all_in_cost_multiplier && project.all_in_cost_multiplier >= 1.30) {
    const bump = Math.round((project.all_in_cost_multiplier - 1) * 100)
    cons.push(`Heavy Statutory & Club Loading: Real landed outflow is +${bump}% over base selling price.`)
  }
  if (project.builder?.average_delay_months != null && project.builder.average_delay_months > 6) {
    cons.push(`Builder Delivery Delay Risk: Developer historical delivery averages ~${project.builder.average_delay_months} months delay.`)
  }
  if (cons.length === 0) {
    cons.push('No specific cautions on record for this project. Verify on site before paying a token.')
  }
  return cons.slice(0, 4)
}

/**
 * POST /api/v1/dossier/create
 */
dossierRouter.post('/create', async (req: Request, res: Response) => {
  try {
    const { sessionId, projectIds, buyerName, budgetLabel, targetSector, targetBhk, notes } = req.body || {}

    // A session id turns that chat's transcript into a public 30-day link, so
    // only the session's owner (signed-in user or guest token) may use it.
    if (sessionId) {
      const userId = await verifyUser(req)
      const guestToken = (req.body?.guestToken as string | undefined) || (req.headers['x-guest-token'] as string | undefined) || null
      const owner = await prisma.chatSession.findUnique({ where: { id: String(sessionId) }, select: { user_id: true, guest_token: true } })
      const owns = owner && ((userId && owner.user_id === userId) || (guestToken && owner.guest_token === guestToken))
      if (!owns) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
    }

    let targetProjects: any[] = []

    if (Array.isArray(projectIds) && projectIds.length > 0) {
      targetProjects = await prisma.project.findMany({
        where: {
          OR: [
            { id: { in: projectIds } },
            { slug: { in: projectIds } },
          ],
        },
        include: {
          builder: true,
          unit_types: { orderBy: { price_min_cr: 'asc' } },
        },
        take: 5,
      })
    }

    if (targetProjects.length === 0 && sessionId) {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })
      if (Array.isArray(session?.last_projects) && session.last_projects.length > 0) {
        const projectIds = session.last_projects as string[]
        targetProjects = await prisma.project.findMany({
          where: { id: { in: projectIds.slice(0, 5) } },
          include: {
            builder: true,
            unit_types: { orderBy: { price_min_cr: 'asc' } },
          },
        })
      }
    }

    // No shortlist, no dossier. Substituting the newest catalogue rows would
    // present projects the buyer never discussed as their shortlist.
    if (targetProjects.length === 0) {
      res.status(400).json({ error: 'No projects to include in the dossier' })
      return
    }

    const token = crypto.randomBytes(16).toString('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 86400 * 1000) // 30 days TTL

    const projectsList: DossierProjectItem[] = targetProjects.map(p => {
      // No price on record, no financials: never price a building we do not hold a figure for.
      const baseCr = p.price_min_cr || 0
      const fin = calculateAffordabilityBreakdown({
        basePrice: baseCr * CRORE,
        multiplier: p.all_in_cost_multiplier ?? 1.30,
      })

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
        strengths: extractStrengths(p),
        redFlags: extractRedFlags(p),
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
        siteVisitChecklist: buildSiteVisitChecklist(p),
      }
    })

    // Narrative extraction
    let narrative: DossierNarrative = {
      searchEvolutionSummary: 'Explored property options, evaluating construction status and statutory standings.',
      consultationTrail: [
        {
          step: 1,
          sectorOrTopic: targetProjects[0]?.sector ? `Sector ${targetProjects[0].sector}` : 'Noida Region',
          userQuestion: 'Inquired about verified family homes and financial outflow.',
          groundRealityVerdict: 'Shortlist compiled from PropFyndr project records.',
          badge: 'PROJECT_DEEP_DIVE',
        },
      ],
      tradeOffDilemma: null,
    }

    if (sessionId) {
      try {
        const sessionMessages = await prisma.chatMessage.findMany({
          where: { session_id: sessionId },
          orderBy: { created_at: 'asc' },
          select: { role: true, content: true },
        })
        if (sessionMessages.length > 0) {
          narrative = await extractDossierNarrative(sessionMessages, targetProjects)
        }
      } catch (err) {
        console.warn('[DOSSIER:NARRATIVE_EXTRACTION_FAILED]', err)
      }
    }

    const dossier: FamilyDossier = {
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      consultation: {
        buyerName: buyerName || 'Family Co-Decision Makers',
        date: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        targetSector: targetSector || (targetProjects[0]?.sector
          ? (targetProjects[0].sector.toLowerCase().startsWith('sector')
              ? targetProjects[0].sector
              : `Sector ${targetProjects[0].sector}`)
          : undefined),
        targetBhk: targetBhk || undefined,
        budgetLabel: budgetLabel || undefined,
        notes: notes || undefined,
        searchEvolutionSummary: narrative.searchEvolutionSummary,
      },
      consultationTrail: narrative.consultationTrail,
      tradeOffDilemma: narrative.tradeOffDilemma,
      projects: projectsList,
      familyReactions: {},
    }

    // Persist snapshot to Redis/in-memory cache for 30 days
    await setCached(`dossier:${token}`, dossier, 30 * 86400)

    res.json({
      success: true,
      token,
      shareUrl: `/dossier/${token}`,
      expiresAt: expiresAt.toISOString(),
      dossier,
    })
  } catch (err: any) {
    console.error('[DOSSIER:CREATE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to generate family deal dossier' })
  }
})

/**
 * GET /api/v1/dossier/:token
 * Public endpoint for family members to view without credentials.
 */
dossierRouter.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params
  if (!token || token.length < 16) {
    res.status(400).json({ error: 'Invalid dossier token' })
    return
  }

  const dossier = await getCached<FamilyDossier>(`dossier:${token}`)
  if (!dossier) {
    res.status(404).json({ error: 'Deal dossier not found or link expired' })
    return
  }

  // Load family reactions
  const reactions = await getCached<Record<string, { likes: number; concerns: string[] }>>(
    `dossier_reactions:${token}`
  )
  if (reactions) {
    dossier.familyReactions = reactions
  }

  res.json({
    success: true,
    dossier,
  })
})

/**
 * POST /api/v1/dossier/:token/react
 * Allows family members/spouses to register likes or flag concerns on shortlisted projects.
 */
dossierRouter.post('/:token/react', async (req: Request, res: Response) => {
  const { token } = req.params
  const { projectId, reactionType, note } = req.body || {}

  if (!token || !projectId || (reactionType !== 'LIKE' && reactionType !== 'CONCERN')) {
    res.status(400).json({ error: 'Missing token, projectId, or reactionType' })
    return
  }

  try {
    // The link is public, so this is an open write: the dossier must exist,
    // the project must be one it lists, and one visitor gets a bounded number
    // of reactions per link.
    const dossier = await getCached<FamilyDossier>(`dossier:${token}`)
    if (!dossier || !dossier.projects?.some(p => p.id === projectId)) {
      res.status(404).json({ error: 'Dossier or project not found' })
      return
    }
    const limit = await checkRateLimit(`dossier_react:${token}:${req.ip}`, 30, 600)
    if (limit.remaining <= 0) {
      res.status(429).json({ error: 'Too many reactions, try again later' })
      return
    }

    const key = `dossier_reactions:${token}`
    const current = (await getCached<Record<string, { likes: number; concerns: string[] }>>(key)) || {}

    if (!current[projectId]) {
      current[projectId] = { likes: 0, concerns: [] }
    }

    if (reactionType === 'LIKE') {
      current[projectId].likes += 1
    } else if (reactionType === 'CONCERN') {
      const concernText = typeof note === 'string' && note.trim().length > 0 ? note.trim().slice(0, 100) : 'Family flagged caution'
      if (current[projectId].concerns.length < 20) current[projectId].concerns.push(concernText)
    }

    await setCached(key, current, 30 * 86400)
    res.json({ success: true, familyReactions: current })
  } catch (err: any) {
    console.error('[DOSSIER:REACT_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to record family reaction' })
  }
})
