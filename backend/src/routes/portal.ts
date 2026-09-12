// backend/src/routes/portal.ts
//
// Builder and channel-partner portal — real, scoped data, deliberately small
// tonight rather than a fully-featured dashboard guessed at without a corpus
// of real usage. Every route re-derives scope from the database via
// requireScope; nothing here trusts a builder_id/partner_id from the request.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireIdentity, requireRole } from '../lib/adminIdentity'
import type { AdminIdentitySession } from '../lib/adminIdentity'

const router = Router()

function identityOf(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

// GET /api/v1/portal/me — who am I, what can I see. Every role may call this;
// it is how the frontend decides which portal shell to render.
router.get('/me', requireIdentity, async (req: Request, res: Response) => {
  const identity = identityOf(req)
  const builder = identity.builderId
    ? await prisma.builder.findUnique({ where: { id: identity.builderId }, select: { id: true, name: true, slug: true } })
    : null
  const partner = identity.partnerId
    ? await prisma.channelPartner.findUnique({ where: { id: identity.partnerId }, select: { id: true, name: true, slug: true } })
    : null
  res.json({ email: identity.email, role: identity.role, builder, partner })
})

// GET /api/v1/portal/builder/projects — a builder's own projects only.
router.get('/builder/projects', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN', 'ANALYST'), async (req: Request, res: Response) => {
  const identity = identityOf(req)
  const builderId = identity.role === 'BUILDER' ? identity.builderId : (req.query.builder_id as string | undefined)
  if (!builderId) {
    res.status(400).json({ error: 'No builder scope — pass builder_id' })
    return
  }
  const projects = await prisma.project.findMany({
    where: { builder_id: builderId },
    select: {
      id: true, name: true, slug: true, sector: true, status: true,
      price_range_label: true, created_at: true,
    },
    orderBy: { created_at: 'desc' },
  })
  res.json({ projects })
})

// GET /api/v1/portal/builder/leads — leads on THIS builder's own projects.
//
// CallbackRequest has no direct builder_id — it carries `project_slug`. Scope
// is enforced by first fetching this builder's own project slugs from the
// database, then filtering leads to that set; a slug never comes from the
// request.
router.get('/builder/leads', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN', 'ANALYST', 'SALES'), async (req: Request, res: Response) => {
  const identity = identityOf(req)
  const builderId = identity.role === 'BUILDER' ? identity.builderId : (req.query.builder_id as string | undefined)
  if (!builderId) {
    res.status(400).json({ error: 'No builder scope — pass builder_id' })
    return
  }
  const projects = await prisma.project.findMany({ where: { builder_id: builderId }, select: { slug: true } })
  const slugs = projects.map(p => p.slug)
  if (slugs.length === 0) {
    res.json({ leads: [] })
    return
  }
  const leads = await prisma.callbackRequest.findMany({
    where: { project_slug: { in: slugs } },
    select: {
      id: true, name: true, phone: true, project_name: true, project_slug: true,
      status: true, lead_tier: true, intent_tier: true, created_at: true,
      chat_session_id: true, ai_summary: true,
      budget_min_cr: true, budget_max_cr: true,
      assigned_partner_id: true, assigned_at: true, partner_notes: true,
    },
    orderBy: { created_at: 'desc' },
    take: 200,
  })

  /**
   * Site visits are a separate table and a separate lead type — CLAUDE.md lists
   * a site visit request as a High Intent Event, and until now a builder could
   * not see a single one booked on their own project.
   *
   * Returned as its own list rather than merged into `leads`: a
   * SiteVisitRequest carries a date and a time slot and has no
   * `assigned_partner_id`, so flattening the two would either invent an
   * assignment control that writes nowhere, or drop the appointment itself.
   */
  const siteVisits = await prisma.siteVisitRequest.findMany({
    where: { project_slug: { in: slugs } },
    select: {
      id: true, name: true, phone: true, email: true,
      project_name: true, project_slug: true,
      visit_date: true, time_slot: true, message: true,
      status: true, created_at: true,
    },
    orderBy: { visit_date: 'desc' },
    take: 200,
  })

  res.json({ leads, siteVisits })
})

// GET /api/v1/portal/partner/profile — a channel partner's own record.
router.get('/partner/profile', requireIdentity, requireRole('PARTNER', 'SUPER_ADMIN', 'ANALYST'), async (req: Request, res: Response) => {
  const identity = identityOf(req)
  const partnerId = identity.role === 'PARTNER' ? identity.partnerId : (req.query.partner_id as string | undefined)
  if (!partnerId) {
    res.status(400).json({ error: 'No partner scope — pass partner_id' })
    return
  }
  const partner = await prisma.channelPartner.findUnique({
    where: { id: partnerId },
    select: {
      id: true, name: true, type: true, is_verified: true, is_active: true,
      status: true, review_notes: true,
      total_leads: true, total_conversions: true, conversion_rate_pct: true,
      operating_cities: true, specializations: true, created_at: true,
      builder: { select: { id: true, name: true, slug: true } },
    },
  })
  if (!partner) {
    res.status(404).json({ error: 'Partner not found' })
    return
  }
  res.json({ partner })
})

// ──────────────────────────────────────────────────────────────
// BUILDER -> their own channel partners
//
// A channel partner belongs to a builder. The builder onboards and manages
// theirs; PropFyndr approves. So a builder may create and deactivate, but
// never approve or verify — those two writes are super-admin-only and live in
// adminPartners.ts.
// ──────────────────────────────────────────────────────────────

const PARTNER_TYPES = ['broker', 'agency', 'agent', 'referral', 'corporate'] as const

const BUILDER_PARTNER_SELECT = {
  id: true, name: true, slug: true, type: true, email: true, phone: true,
  primary_contact: true, operating_cities: true, specializations: true,
  status: true, is_active: true, is_verified: true, review_notes: true,
  created_at: true,
} as const

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

/**
 * Resolves the builder this request is scoped to. A BUILDER session carries
 * its own id and may not name another; a PropFyndr role must name one.
 * Returns null when the caller has no usable scope — the caller 400s.
 */
function builderScope(req: Request): string | null {
  const identity = identityOf(req)
  if (identity.role === 'BUILDER') return identity.builderId
  return (req.query.builder_id as string | undefined) ?? null
}

router.get('/builder/partners', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN', 'ANALYST', 'SALES'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }

  const partners = await prisma.channelPartner.findMany({
    where: { builder_id: builderId },
    select: BUILDER_PARTNER_SELECT,
    orderBy: { created_at: 'desc' },
  })

  // Live per-partner lead counts, from the leads this builder actually routed.
  const counts = await prisma.callbackRequest.groupBy({
    by: ['assigned_partner_id'],
    where: { assigned_partner_id: { in: partners.map((p) => p.id) } },
    _count: { _all: true },
  })
  const byPartner = new Map(counts.map((c) => [c.assigned_partner_id, c._count._all]))

  res.json({ partners: partners.map((p) => ({ ...p, leads_assigned: byPartner.get(p.id) ?? 0 })) })
})

const BuilderPartnerCreateSchema = z.object({
  name: z.string().min(2).max(160),
  type: z.enum(PARTNER_TYPES),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  primary_contact: z.string().max(120).optional(),
  operating_cities: z.array(z.string().min(1).max(60)).max(20).optional(),
  specializations: z.array(z.string().min(1).max(40)).max(20).optional(),
}).strict()

router.post('/builder/partners', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }

  const parsed = BuilderPartnerCreateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.issues }); return }
  const d = parsed.data

  try {
    const partner = await prisma.channelPartner.create({
      data: {
        name: d.name,
        slug: slugify(d.name),
        type: d.type,
        builder_id: builderId,
        email: d.email || null,
        phone: d.phone || null,
        primary_contact: d.primary_contact || null,
        operating_cities: d.operating_cities ?? [],
        specializations: d.specializations ?? [],
        // Pending PropFyndr approval. A builder adding a partner does not grant
        // that partner access — only approval does.
        status: 'new',
        is_active: false,
        is_verified: false,
        submitted_at: new Date(),
      },
      select: BUILDER_PARTNER_SELECT,
    })
    res.status(201).json({ partner })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      res.status(409).json({ error: 'A partner with that name already exists.' }); return
    }
    console.error('[portal] builder partner create failed:', err)
    res.status(500).json({ error: 'Failed to add partner' })
  }
})

// PATCH /builder/partners/:id — a builder switching their own partner off or
// back on. Approval and verification are not editable here by design.
router.patch('/builder/partners/:id', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }

  const parsed = z.object({ is_active: z.boolean() }).strict().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.issues }); return }

  // Ownership re-derived from the database, never from the request body.
  const owned = await prisma.channelPartner.findFirst({
    where: { id: req.params.id, builder_id: builderId },
    select: { id: true, status: true },
  })
  if (!owned) { res.status(404).json({ error: 'Partner not found' }); return }
  if (parsed.data.is_active && owned.status !== 'approved') {
    res.status(409).json({ error: 'PropFyndr has not approved this partner yet.' }); return
  }

  const partner = await prisma.channelPartner.update({
    where: { id: owned.id },
    data: { is_active: parsed.data.is_active },
    select: BUILDER_PARTNER_SELECT,
  })
  res.json({ partner })
})

// PATCH /builder/leads/:id — route a lead to one of this builder's own
// partners, and/or move its status. Both the lead and the partner are
// re-checked against this builder before anything is written.
router.patch('/builder/leads/:id', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN', 'SALES'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }

  const parsed = z.object({
    assigned_partner_id: z.string().uuid().nullable().optional(),
    status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  }).strict().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.issues }); return }
  const d = parsed.data
  if (d.assigned_partner_id === undefined && d.status === undefined) {
    res.status(400).json({ error: 'Nothing to update' }); return
  }

  const slugs = (await prisma.project.findMany({ where: { builder_id: builderId }, select: { slug: true } })).map((p) => p.slug)
  const lead = await prisma.callbackRequest.findFirst({
    where: { id: req.params.id, project_slug: { in: slugs } },
    select: { id: true },
  })
  if (!lead) { res.status(404).json({ error: 'Lead not found' }); return }

  if (d.assigned_partner_id) {
    const partner = await prisma.channelPartner.findFirst({
      where: { id: d.assigned_partner_id, builder_id: builderId, status: 'approved', is_active: true },
      select: { id: true },
    })
    if (!partner) { res.status(400).json({ error: 'Not an approved, active partner of yours' }); return }
  }

  const updated = await prisma.callbackRequest.update({
    where: { id: lead.id },
    data: {
      ...(d.status ? { status: d.status } : {}),
      ...(d.assigned_partner_id !== undefined
        ? { assigned_partner_id: d.assigned_partner_id, assigned_at: d.assigned_partner_id ? new Date() : null }
        : {}),
    },
    select: {
      id: true, name: true, phone: true, project_name: true, project_slug: true,
      status: true, lead_tier: true, intent_tier: true, created_at: true,
      chat_session_id: true, assigned_partner_id: true, assigned_at: true,
    },
  })
  res.json({ lead: updated })
})

// ──────────────────────────────────────────────────────────────
// PARTNER -> the leads routed to them
// ──────────────────────────────────────────────────────────────

function partnerScope(req: Request): string | null {
  const identity = identityOf(req)
  if (identity.role === 'PARTNER') return identity.partnerId
  return (req.query.partner_id as string | undefined) ?? null
}

const PARTNER_LEAD_SELECT = {
  id: true, name: true, phone: true, project_name: true, project_slug: true,
  status: true, lead_tier: true, intent_tier: true, ai_summary: true,
  budget_min_cr: true, budget_max_cr: true,
  partner_notes: true, assigned_at: true, created_at: true,
} as const

router.get('/partner/leads', requireIdentity, requireRole('PARTNER', 'SUPER_ADMIN', 'ANALYST', 'SALES'), async (req: Request, res: Response) => {
  const partnerId = partnerScope(req)
  if (!partnerId) { res.status(400).json({ error: 'No partner scope — pass partner_id' }); return }

  const leads = await prisma.callbackRequest.findMany({
    where: { assigned_partner_id: partnerId },
    select: PARTNER_LEAD_SELECT,
    orderBy: { assigned_at: 'desc' },
    take: 200,
  })
  res.json({ leads })
})

// PATCH /partner/leads/:id — the partner works their own lead. Scope is
// re-derived: the row must already carry this partner's id.
router.patch('/partner/leads/:id', requireIdentity, requireRole('PARTNER', 'SUPER_ADMIN', 'SALES'), async (req: Request, res: Response) => {
  const partnerId = partnerScope(req)
  if (!partnerId) { res.status(400).json({ error: 'No partner scope — pass partner_id' }); return }

  const parsed = z.object({
    status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
    partner_notes: z.string().max(2000).nullable().optional(),
  }).strict().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.issues }); return }
  const d = parsed.data
  if (d.status === undefined && d.partner_notes === undefined) {
    res.status(400).json({ error: 'Nothing to update' }); return
  }

  const owned = await prisma.callbackRequest.findFirst({
    where: { id: req.params.id, assigned_partner_id: partnerId },
    select: { id: true },
  })
  if (!owned) { res.status(404).json({ error: 'Lead not found' }); return }

  const lead = await prisma.callbackRequest.update({
    where: { id: owned.id },
    data: {
      ...(d.status ? { status: d.status } : {}),
      ...(d.partner_notes !== undefined ? { partner_notes: d.partner_notes } : {}),
    },
    select: PARTNER_LEAD_SELECT,
  })
  res.json({ lead })
})

export default router
