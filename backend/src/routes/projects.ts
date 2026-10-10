// backend/src/routes/projects.ts
// Trigger restart
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { computeRecommendationScore } from '../lib/recommendation/score'
import { gatePublished } from '../lib/intelligenceGate'
import { routeCache } from '../lib/routeCache'
import { computeLiveActivity } from '../lib/liveActivity'
import { computeOnTimeDeliveryPct } from '../lib/builderDelivery'
import { REAL_DOCUMENT_WHERE } from '../lib/realDocuments'

const router = Router()

const QuerySchema = z.object({
  sector: z.string().optional(),
  city: z.string().optional(),
  bhk: z.string().regex(/^\d+$/, 'bhk must be an integer').optional(),
  budget_max_cr: z.string().regex(/^\d+(\.\d+)?$/, 'budget_max_cr must be a number').optional(),
  status: z.enum(['under_construction', 'ready_to_move', 'new_launch']).optional(),
})

router.get('/', routeCache(300), async (req: Request, res: Response) => {
  const parsed = QuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query params' })
    return
  }

  const { sector, bhk, budget_max_cr, status, city } = parsed.data

  const projects = await prisma.project.findMany({
    where: {
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
      ...(sector && { sector: { contains: sector, mode: 'insensitive' } }),
      ...(status && { status }),
      ...(bhk && { unit_types: { some: { bhk: parseInt(bhk) } } }),
      ...(budget_max_cr && { unit_types: { some: { price_min_cr: { lte: parseFloat(budget_max_cr) } } } }),
    },
    include: {
      builder: { select: { name: true, slug: true } },
      unit_types: { select: { bhk: true, price_min_cr: true, price_max_cr: true, carpet_area_sqft: true } },
      images: { where: { type: 'hero' }, take: 1, select: { url: true } },
    },
    take: 20,
  })

  res.json({ projects })
})

router.get('/:slug', routeCache(900), async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { slug: req.params.slug },
    include: {
      builder: true,
      unit_types: true,
      images: { orderBy: { sort_order: 'asc' } },
      amenities: true,
      connectivity: { orderBy: { distance_km: 'asc' } },
      decision_profile: {
        select: {
          status:             true,
          decision_thesis:    true,
          why_buy:            true,
          why_avoid:          true,
          best_for:           true,
          not_ideal_for:      true,
          confidence_sources: true,
          financial_intelligence: true,
          market_intelligence: true,
          builder_intelligence: true,
          property_intelligence: true,
          comparative_analysis: true,
          resources_documents: true,
          last_verified_at:   true,
        },
      },
      competitors: {
        select: {
          id:                     true,
          competitor_name:        true,
          competitor_slug:        true,
          this_project_advantage: true,
          competitor_advantage:   true,
          verdict:                true,
          price_delta_note:       true,
          sort_order:             true,
        },
        orderBy: { sort_order: 'asc' },
      },
      payment_plans: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
      cost_sheet: true,
      construction_milestones: { orderBy: { sort_order: 'asc' } },
      channel_partners: { include: { channel_partner: true }, orderBy: { created_at: 'asc' } },
      spec_items: { orderBy: [{ sort_order: 'asc' }, { category: 'asc' }] },
      price_history: { orderBy: { recorded_at: 'asc' } },
    },
  })

  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  // Fetch active promotions for this project or sector
  const activePromotions = await prisma.promotional.findMany({
    where: {
      is_active: true,
      OR: [
        { link_type: 'project', link_target: project.id },
        { target_sectors: { has: project.sector || '' } }
      ]
    },
    take: 5,
    orderBy: { created_at: 'desc' }
  })

  // Gate unverified intelligence. Any DRAFT analysis is nulled so it does not
  // reach a buyer. The `status` field itself is stripped.
  const gated = {
    ...project,
    decision_profile: gatePublished(project.decision_profile),
    payment_plan: project.payment_plans?.[0] ?? null,
    payment_plans: project.payment_plans ?? [],
    cost_sheet: project.cost_sheet ?? null,
    construction_milestones: project.construction_milestones ?? [],
    channel_partners: project.channel_partners ?? [],
    spec_items: project.spec_items ?? [],
    price_history: project.price_history ?? [],
    promotions: activePromotions ?? [],
  }

  // ProjectDna is dropped (lean-schema migration, 2026-10) — no DNA scores
  // exist to compute a recommendation score from. basis_count: 0 means every
  // downstream reader that gates on basis_count >= 3 correctly hides this.
  const recommendation_score = computeRecommendationScore({
    dna: null,
    status: gated.status as 'under_construction' | 'ready_to_move' | 'new_launch',
    possession_date: gated.possession_date ?? null,
    project_risk_flag: gated.project_risk_flag ?? null,
    builder: { legal_flag: gated.builder?.legal_flag ?? null },
  })

  const reportUrl = `/api/projects/${gated.slug}/report`;

  // The include above has no `select`, so the row carries every column and the
  // spread below ships all of them. ai_search_keywords is the internal retrieval
  // vocabulary — publishing it hands anyone reading the network tab a map of how
  // matching and ranking work. builder_theme stays: the page uses it to theme.
  const { ai_search_keywords: _internalKeywords, ...publicProject } = gated

  res.json({ project: { ...publicProject, builder_detail: gated.builder, recommendation_score, reportUrl, all_amenities: gated.amenities, all_connectivity: gated.connectivity } })
})

router.get('/:slug/documents', async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({ where: { slug: req.params.slug }, select: { id: true } })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }
  const documents = await prisma.projectDocument.findMany({
    where: { project_id: project.id, ...REAL_DOCUMENT_WHERE },
    select: { id: true, doc_type: true, name: true, storage_url: true, created_at: true },
    orderBy: { created_at: 'desc' },
  })
  res.json({ documents })
})

router.get('/:slug/payment-plan', async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { slug: req.params.slug },
    select: { id: true },
  })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  const plans = await (prisma as any).paymentPlan.findMany({
    where: { project_id: project.id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })

  if (!plans.length) {
    res.json({
      available: false,
      message: 'Payment schedule not yet verified. Contact our advisors for the latest payment plan.',
    })
    return
  }

  // `plan` is the primary plan, kept for existing clients that render one plan.
  res.json({ available: true, plan: plans[0], plans })
})

router.get('/:slug/cost-sheet', async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      name: true,
      unit_types: { select: { bhk: true, super_area_sqft: true, price_min_cr: true } },
    },
  })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  const sheet = await (prisma as any).costSheet.findUnique({
    where: { project_id: project.id },
  })

  if (!sheet) {
    res.json({
      available: false,
      message: 'Detailed cost sheet not yet verified. Typical costs: GST 5%, Stamp Duty 6%, Registration 1% on agreement value.',
    })
    return
  }

  // Compute illustrative totals for a representative unit
  const refUnit = project.unit_types.find((u: any) => u.price_min_cr != null) ?? null
  const baseCr = refUnit?.price_min_cr ?? null
  const sqft   = refUnit?.super_area_sqft ?? null

  let totalCostBreakdown: Record<string, number | null> | null = null
  if (baseCr != null) {
    const gst          = baseCr * (sheet.gst_rate_pct / 100)
    const stampDuty    = baseCr * (sheet.stamp_duty_pct / 100)
    const registration = baseCr * (sheet.registration_pct / 100)
    const parking      = sheet.parking_cost ? sheet.parking_cost / 1e7 : 0  // stored in ₹, convert to Cr
    const ifms         = sheet.ifms         ? sheet.ifms / 1e7 : 0
    const club         = sheet.club_membership ? sheet.club_membership / 1e7 : 0
    const total        = baseCr + gst + stampDuty + registration + parking + ifms + club
    totalCostBreakdown = {
      base_price_cr:    baseCr,
      gst_cr:           Math.round(gst * 100) / 100,
      stamp_duty_cr:    Math.round(stampDuty * 100) / 100,
      registration_cr:  Math.round(registration * 100) / 100,
      parking_cr:       Math.round(parking * 100) / 100,
      ifms_cr:          Math.round(ifms * 100) / 100,
      club_cr:          Math.round(club * 100) / 100,
      total_cost_cr:    Math.round(total * 100) / 100,
    }
  }

  res.json({
    available: true,
    sheet,
    illustration: totalCostBreakdown,
    illustration_note: sqft
      ? `Based on a ${refUnit?.bhk}BHK unit (${sqft} sqft) at ₹${baseCr}Cr base price`
      : 'Illustrative — select a unit type for exact figures',
  })
})

// ProjectDna and RecommendationProfile are dropped (lean-schema migration,
// 2026-10) — their re-sourcing with real data is sub-project C, not this one.
// Render nothing rather than invent an appreciation estimate (CLAUDE.md:
// no invented, defaulted, or unlabelled figure may reach a buyer).
router.get('/:slug/investment', async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { slug: req.params.slug },
    select: { id: true },
  })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  res.json({ available: false })
})

router.get('/:slug/overview', async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      status: true,
      possession_date: true,
      project_risk_flag: true,
      builder: { select: { id: true, legal_flag: true } },
    },
  })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

  const [liveActivity, priceHistory, milestones, deliveryRecords] = await Promise.all([
    computeLiveActivity(project.id),
    prisma.priceHistory.findMany({
      where: { project_id: project.id, recorded_at: { gte: fiveYearsAgo } },
      select: { recorded_at: true, price_per_sqft: true, total_price_cr: true },
      orderBy: { recorded_at: 'asc' },
    }),
    prisma.constructionMilestone.findMany({
      where: { project_id: project.id },
      select: { name: true, status: true, date_label: true, completed_at: true, photo_urls: true, sort_order: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.builderDeliveryRecord.findMany({
      where: { builder_id: project.builder!.id },
      select: { promised_date: true, actual_date: true },
    }),
  ])

  // ProjectDna is dropped (lean-schema migration, 2026-10) — no DNA scores
  // exist to compute a verdict badge from, so this never had a basis to show.
  res.json({
    available: true,
    verdict: null,
    live_activity: liveActivity,
    price_history: priceHistory.length > 0 ? priceHistory : null,
    construction_milestones: milestones.length > 0 ? milestones : null,
    on_time_delivery_pct: computeOnTimeDeliveryPct(deliveryRecords),
  })
})

export default router