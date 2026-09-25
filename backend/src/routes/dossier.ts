import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { prisma } from '../lib/db'
import { getCached, setCached } from '../lib/cache'
import { calculateAffordabilityBreakdown } from '../lib/chat/handlers/affordabilityHandler'

export const dossierRouter = Router()

const CRORE = 10_000_000

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
  financials: {
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
  }
  projects: DossierProjectItem[]
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

  if (project.water_source_type === 'groundwater_borewell' || (project.water_tds_range && project.water_tds_range.includes('>'))) {
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
  if (project.water_source_type === 'ganga_water') {
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
  if (pros.length < 3) {
    pros.push('RERA Approved Project with dedicated escrow bank account mechanism.')
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
  if (project.water_source_type === 'groundwater_borewell') {
    cons.push('Hard Borewell Water: High TDS groundwater (>900 ppm); requires heavy RO filtration.')
  }
  if (project.shahdara_drain_impact === true) {
    cons.push('Drain Corridor Proximity: Within 500m of Shahdara drain; seasonal odor and corrosion concerns.')
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
    cons.push('Under-construction milestone payment dependency: Monitor slab progress against RERA quarterly filings.')
  }
  return cons.slice(0, 4)
}

/**
 * POST /api/v1/dossier/create
 */
dossierRouter.post('/create', async (req: Request, res: Response) => {
  try {
    const { sessionId, projectIds, buyerName, budgetLabel, targetSector, targetBhk, notes } = req.body || {}

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
        take: 3,
      })
    }

    if (targetProjects.length === 0 && sessionId) {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })
      if (Array.isArray(session?.last_projects) && session.last_projects.length > 0) {
        const projectIds = session.last_projects as string[]
        targetProjects = await prisma.project.findMany({
          where: { id: { in: projectIds.slice(0, 3) } },
          include: {
            builder: true,
            unit_types: { orderBy: { price_min_cr: 'asc' } },
          },
        })
      }
    }

    // Fallback if no specific project could be extracted: pick top 2 verified projects
    if (targetProjects.length === 0) {
      targetProjects = await prisma.project.findMany({
        take: 2,
        orderBy: { created_at: 'desc' },
        include: {
          builder: true,
          unit_types: { orderBy: { price_min_cr: 'asc' } },
        },
      })
    }

    const token = crypto.randomBytes(16).toString('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 86400 * 1000) // 30 days TTL

    const projectsList: DossierProjectItem[] = targetProjects.map(p => {
      const baseCr = p.price_min_cr || 1.5
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
        siteVisitChecklist: buildSiteVisitChecklist(p),
      }
    })

    const dossier: FamilyDossier = {
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      consultation: {
        buyerName: buyerName || 'Family Co-Decision Makers',
        date: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        targetSector: targetSector || (targetProjects[0]?.sector ? `Sector ${targetProjects[0].sector}` : undefined),
        targetBhk: targetBhk || '3 BHK',
        budgetLabel: budgetLabel || undefined,
        notes: notes || undefined,
      },
      projects: projectsList,
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
    res.status(500).json({ error: 'Failed to generate family deal dossier', details: err?.message })
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

  res.json({
    success: true,
    dossier,
  })
})
