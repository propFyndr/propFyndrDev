import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { timingSafeEqual } from 'crypto'
import { prisma } from '../lib/db'
import { verifyUser } from '../lib/auth'
import { requireAdmin } from '../lib/adminAuth'
import { trackConversion } from '../lib/analytics/tracking'
import { env } from '../lib/env'
import { notifyLead } from '../lib/notify'
import { checkRateLimit } from '../lib/cache'
import { loadLeadProfile, scoreLead } from '../lib/leadProfile'
import { buildLeadDossier } from '../lib/leadDossier'
import { analyzeGhostPoolByProject } from '../lib/ghostPool'
import { analyzeProjectDemand, getDemandSnapshot } from '../lib/demandIntelligence'

const router = Router()

// GET /count — must be registered BEFORE any /:id route to avoid param collision.
router.get('/count', async (req: Request, res: Response) => {
  const userId = await verifyUser(req)
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const count = await prisma.siteVisitRequest.count({
    where: { created_at: { gte: startOfDay } },
  })
  res.json({ count })
})

const CallbackSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  projectName: z.string().optional(),
  project_name: z.string().optional(), // frontend sends snake_case
  projectSlug: z.string().optional(),
  project_slug: z.string().optional(), // frontend sends snake_case
  session_id: z.string().optional(),
  guestToken: z.string().optional(),
  intent_tier: z.enum(['immediate', '1-3-months', 'exploring']).optional(),
  loan_status: z.enum(['pre_approved', 'need_help', 'cash']).optional(),
  consent_given: z.boolean().default(false),
})

const SiteVisitSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  projectSlug: z.string().min(1),
  projectName: z.string(),
  visitDate: z.string(),
  timeSlot: z.string(),
  guestToken: z.string().optional(),
})

router.post('/callback', async (req: Request, res: Response) => {
  // Callbacks work for anonymous users (guestToken) OR authenticated users
  const userId = (await verifyUser(req)) ?? undefined
  // The header is the fallback the chat client already sets on every request.
  //
  // Taking this from the body alone meant a client that omitted it produced a
  // lead with no user_id and no guest_token — 138 of 278 stored callbacks, half
  // of them, unattributable to any conversation, user or session by
  // construction. A name and a phone number with nothing behind them is a lead
  // the sales team cannot prepare for.
  const guestToken =
    (req.body as { guestToken?: string }).guestToken ||
    (req.headers['x-guest-token'] as string | undefined) ||
    undefined

  // Rate limit by userId if authenticated, otherwise by guestToken or IP
  const rateLimitKey = userId ? `callback:${userId}` : guestToken ? `callback:guest:${guestToken}` : `callback:ip:${req.ip}`
  const rl = await checkRateLimit(rateLimitKey, 30, 3600)
  if (rl.remaining <= 0) { res.status(429).json({ error: 'Too many requests' }); return }

  const parsed = CallbackSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.errors }); return }

  // Idempotency: check for duplicate request in last 5 seconds
  const projectSlug = parsed.data.projectSlug || parsed.data.project_slug
  const phone = parsed.data.phone
  const fiveSecsAgo = new Date(Date.now() - 5000)
  const recentDuplicate = await prisma.callbackRequest.findFirst({
    where: {
      phone,
      ...(projectSlug ? { project_slug: projectSlug } : {}),
      created_at: { gte: fiveSecsAgo }
    }
  })
  if (recentDuplicate) { res.status(200).json({ success: true, duplicate: true }); return }

  const { name, projectName, project_name, session_id, intent_tier, loan_status, consent_given } = parsed.data

  // Support both camelCase and snake_case from frontend
  const finalProjectName = projectName || project_name
  const finalProjectSlug = projectSlug

  // Get project and builder info for analytics.
  // unit_types is needed to derive the project's price range — Project itself only
  // stores price_min_cr, so the max has to come from its units.
  const project: any = finalProjectSlug ? await prisma.project.findUnique({
    where: { slug: finalProjectSlug },
    include: { unit_types: { select: { price_min_cr: true, price_max_cr: true } } },
  }) : null

  // Load buyer profile once, reuse for the persisted lead and the webhook payload
  const profile = await loadLeadProfile(userId, guestToken)

  // Resolve the conversation this lead came out of, server-side.
  //
  // session_id is optional on the request and nothing was sending it: 278 of
  // 278 stored callbacks had chat_session_id null, so the transcript link the
  // sales handoff is built on did not exist for a single lead. Depending on the
  // client to pass an id it already implicitly has is not a guarantee, so it is
  // resolved here from the identity we already trust.
  let resolvedSessionId = session_id
  if (!resolvedSessionId && (userId || guestToken)) {
    const recent = await prisma.chatSession.findFirst({
      where: userId ? { user_id: userId } : { guest_token: guestToken },
      orderBy: { last_active: 'desc' },
      select: { id: true },
    })
    resolvedSessionId = recent?.id
  }

  // ─── ANALYTICS: Track conversion
  if (session_id && project) {
    await Promise.all([
      trackConversion(session_id, 'callback_requested', project.id, project.builder_id),
      // Also create BuilderLead record
      prisma.builderLead.create({
        data: {
          builder_id: project.builder_id,
          project_id: project.id,
          lead_type: 'callback_requested',
          name,
          phone,
          email: undefined,
          source_session: session_id,
          source_intent: profile as any,
          status: 'new',
        }
      })
    ]).catch(err => console.error('[leads] Analytics tracking failed:', err))
  }

  // Enrich lead with the buyer profile we already have, so builders get a qualified lead.
  const loanPreApproved = loan_status === 'pre_approved' || profile.loan_pre_approved === true

  // Check if project price fits buyer budget.
  // Project has no price_range_min/price_range_max columns — the range is derived
  // from its unit_types, falling back to Project.price_min_cr for the lower bound.
  let projectFitsBudget = false
  if (project && profile.budget_cr) {
    const unitMins = (project.unit_types ?? []).map((u: any) => u.price_min_cr).filter((v: unknown): v is number => typeof v === 'number')
    const unitMaxes = (project.unit_types ?? []).map((u: any) => u.price_max_cr).filter((v: unknown): v is number => typeof v === 'number')
    const priceRangeMin = unitMins.length ? Math.min(...unitMins) : project.price_min_cr ?? null
    const priceRangeMax = unitMaxes.length ? Math.max(...unitMaxes) : null

    if (priceRangeMin !== null && priceRangeMax !== null && profile.budget_cr.min && profile.budget_cr.max) {
      // Overlap: buyer budget intersects project price range
      projectFitsBudget = profile.budget_cr.max >= priceRangeMin && profile.budget_cr.min <= priceRangeMax
    }
  }

  // Check if project sector matches buyer preference
  const projectSector = typeof project?.sector === 'string' ? project.sector : project?.sector?.name ?? null
  const sectorMatches = project && profile.preferred_sector ? projectSector === profile.preferred_sector : false

  const { score, tier } = scoreLead({
    loanPreApproved,
    intentTier: intent_tier ?? null,
    projectFitsBudget,
    savedCount: profile.engagement?.projects_saved,
    viewedCount: profile.engagement?.projects_viewed,
    sectorMatches,
  })

  // Persist the qualified lead. Previously the score was computed and forwarded to
  // the webhook only, so the admin lead views and /admin/stats had nothing to read.
  const cb = await prisma.callbackRequest.create({
    data: {
      name,
      phone,
      project_name: finalProjectName,
      project_slug: finalProjectSlug,
      user_id: userId,
      guest_token: guestToken,
      source_session: resolvedSessionId || undefined,
      chat_session_id: resolvedSessionId || undefined, // Phase 5: link to full chat session for enrichment
      intent_tier: intent_tier ?? null,
      loan_pre_approved: loanPreApproved,
      consent_given: consent_given ?? false,
      projects_saved: profile.engagement?.projects_saved ?? 0,
      projects_viewed: profile.engagement?.projects_viewed ?? 0,
      budget_min_cr: profile.budget_cr?.min ?? null,
      budget_max_cr: profile.budget_cr?.max ?? null,
      lead_score: score,
      lead_tier: tier,
      ai_summary: profile.ai_summary ?? null,
    },
  })

  // Send to Webhook (Make.com -> Google Sheets / CRM)
  fireWebhook('callback_requested', {
    // User-provided form data
    name,
    phone,
    project_name: finalProjectName,
    project_slug: finalProjectSlug,
    intent_tier: intent_tier ?? null,
    loan_status: loan_status ?? null,

    // Project data
    bhk: project?.bhk ?? null,
    sector: projectSector,
    price_range: project?.price_range_label ?? null,

    // Engagement metrics
    projects_saved: profile.engagement?.projects_saved ?? 0,
    projects_viewed: profile.engagement?.projects_viewed ?? 0,

    // Qualified lead metadata
    budget_min_cr: profile.budget_cr?.min ?? null,
    budget_max_cr: profile.budget_cr?.max ?? null,
    loan_pre_approved: loanPreApproved,
    lead_score: score,
    lead_tier: tier,
    ai_summary: profile.ai_summary ?? null,
    created_at: cb.created_at.toISOString(),
  }).catch((e) => console.error('[leads] webhook failed:', e))

  res.status(201).json({ callback: cb })
})

router.post('/site-visit', async (req: Request, res: Response) => {
  // Verify user is authenticated (signup required per CLAUDE.md)
  const userId = await verifyUser(req)
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }

  // Rate limit: 30 site-visit requests per hour per user
  const rateLimit = await checkRateLimit(`site-visit:${userId}`, 30, 3600)
  if (rateLimit.remaining <= 0) { res.status(429).json({ error: 'Too many requests' }); return }

  const parsed = SiteVisitSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.format() }); return
  }

  const { name, phone, projectSlug, projectName, visitDate, timeSlot } = parsed.data

  // Idempotency: check for duplicate request in last 5 seconds
  const fiveSecsAgo = new Date(Date.now() - 5000)
  const recentDuplicate = await prisma.siteVisitRequest.findFirst({
    where: {
      phone,
      ...(projectSlug ? { project_slug: projectSlug } : {}),
      created_at: { gte: fiveSecsAgo }
    }
  })
  if (recentDuplicate) { res.status(200).json({ success: true, duplicate: true }); return }

  if (visitDate) {
    const visitMs = new Date(visitDate).getTime()
    if (isNaN(visitMs) || visitMs <= Date.now()) {
      res.status(400).json({ error: 'Visit date must be in the future' }); return
    }
  }

  const project = await prisma.project.findUnique({ where: { slug: projectSlug }, select: { id: true, builder_id: true } })
  if (!project) { res.status(404).json({ error: 'Project not found' }); return }

  const sv = await prisma.siteVisitRequest.create({
    data: {
      project_id: project.id,
      project_slug: projectSlug,
      project_name: projectName,
      name, phone,
      visit_date: new Date(visitDate),
      time_slot: timeSlot,
    },
  })

  // ─── ANALYTICS: Track conversion
  const { session_id } = req.body
  if (session_id) {
    await Promise.all([
      trackConversion(session_id, 'site_visit_requested', project.id, project.builder_id),
      prisma.builderLead.create({
        data: {
          builder_id: project.builder_id,
          project_id: project.id,
          lead_type: 'site_visit_requested',
          name,
          phone,
          email: undefined,
          source_session: session_id,
          status: 'new',
        }
      })
    ]).catch(err => console.error('[leads] Analytics tracking failed:', err))
  }

  fireWebhook('site_visit_requested', { name, phone, projectName, visitDate, timeSlot }).catch((e) => console.error('[leads] webhook failed:', e))

  res.status(201).json({ siteVisit: sv })
})

async function fireWebhook(event: string, data: Record<string, unknown>) {
  const url = process.env.WEBHOOK_URL
  if (!url) {
    console.error('[leads] ⚠️ WEBHOOK_URL not configured — lead webhook was not sent. Configure WEBHOOK_URL in environment.')
    return
  }
  // Flatten data at root for Make.com / Google Sheets direct field mapping compatibility
  const body = JSON.stringify({ event, data, ...data, ts: Date.now() })

  // Sign the payload so the receiver can verify it actually came from us.
  const secret = process.env.WEBHOOK_SECRET
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) {
    const { createHmac } = await import('crypto')
    headers['X-Signature'] = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  }

  // One retry on failure — leads are the revenue event; don't drop them silently.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) })
      if (res.ok) return
    } catch (e) {
      if (attempt === 1) throw e
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

const WebhookLeadSchema = z.object({
  type: z.enum(['callback', 'site_visit']),
  name: z.string().min(1).max(100),
  phone: z.string().min(8).max(20),
  project_name: z.string().optional(),
  project_slug: z.string().optional(),
  visit_date: z.string().optional(),
  time_slot: z.string().optional(),
  message: z.string().max(500).optional(),
  timestamp: z.string(),
})

function verifySecret(req: Request): boolean {
  const secret = env.WEBHOOK_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'  // closed in prod
  const header = String(req.headers['x-webhook-secret'] ?? '')
  const a = Buffer.from(header)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

router.post('/webhook', async (req: Request, res: Response) => {
  if (!verifySecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const parsed = WebhookLeadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
  }

  // Respond immediately — don't block the frontend
  res.status(202).json({ accepted: true })

  // Process async
  try {
    const result = await notifyLead(parsed.data)
    console.log(`[leads] ✅ ${parsed.data.type} | ${parsed.data.name} | wa:${result.whatsapp} email:${result.email}`)
  } catch (err) {
    console.error('[leads] ❌ notification failed:', err instanceof Error ? err.message : err)
  }
})

// GET /metrics — lead funnel analytics for dashboard
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    // Scores live on CallbackRequest, not BuilderLead (which has no score columns —
    // querying it returned 0 for every metric via the swallowed .catch()).
    const [callbackCount, visitCount, scoreAgg, hotCount] = await Promise.all([
      prisma.callbackRequest.count(),
      prisma.siteVisitRequest.count(),
      prisma.callbackRequest.aggregate({ _avg: { lead_score: true } }),
      prisma.callbackRequest.count({ where: { lead_tier: 'HOT' } }),
    ])
    const conversionRate = callbackCount > 0 ? (visitCount / callbackCount) * 100 : 0

    res.json({
      callbacksRequested: callbackCount,
      siteVisitsScheduled: visitCount,
      visitConversionRate: conversionRate,
      avgLeadScore: scoreAgg?._avg?.lead_score ?? 0,
      hotLeadsCount: hotCount,
    })
  } catch (err) {
    console.error('[leads:metrics] error:', err)
    res.status(500).json({ error: 'Failed to fetch metrics' })
  }
})

// Get rich lead dossier for a specific lead
//
// Found unauthenticated during tonight's admin/CRM work: this returns a
// buyer's name, phone, full chat-derived summaries, objections and
// engagement profile to anyone who knows or guesses a lead id — no session,
// no role check, nothing. requireAdmin needs no new schema, so it ships
// immediately rather than waiting on the identity migration.
router.get('/callback/:leadId/dossier', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params

    // Verify the requesting user has access to this lead's builder
    const lead = await prisma.callbackRequest.findUnique({
      where: { id: leadId },
    })

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    // If project_id is set, verify builder access (optional — depends on auth model)
    // For now, just return the dossier

    const dossier = await buildLeadDossier(leadId, 'system')

    if (!dossier) {
      return res.status(404).json({ error: 'Could not build dossier' })
    }

    res.json(dossier)
  } catch (err) {
    console.error('[leads:dossier] error:', err)
    res.status(500).json({ error: 'Failed to fetch lead dossier' })
  }
})

// Get ghost pool analysis for a project
router.get('/projects/:projectId/ghost-pool', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    const analysis = await analyzeGhostPoolByProject(projectId)

    res.json(analysis)
  } catch (err) {
    console.error('[leads:ghostPool] error:', err)
    res.status(500).json({ error: 'Failed to fetch ghost pool analysis' })
  }
})

// Get demand intelligence for a project
router.get('/projects/:projectId/demand', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    const demand = await analyzeProjectDemand(projectId)

    if (!demand) {
      return res.status(404).json({ error: 'Project not found' })
    }

    res.json(demand)
  } catch (err) {
    console.error('[leads:demand] error:', err)
    res.status(500).json({ error: 'Failed to fetch demand analysis' })
  }
})

// Get market demand snapshot
router.get('/market/snapshot', async (req: Request, res: Response) => {
  try {
    const snapshot = await getDemandSnapshot()
    res.json(snapshot)
  } catch (err) {
    console.error('[leads:snapshot] error:', err)
    res.status(500).json({ error: 'Failed to fetch market snapshot' })
  }
})

export default router
