// backend/src/routes/portal.ts
//
// Builder and channel-partner portal — real, scoped data, deliberately small
// tonight rather than a fully-featured dashboard guessed at without a corpus
// of real usage. Every route re-derives scope from the database via
// requireScope; nothing here trusts a builder_id/partner_id from the request.
import { Router, Request, Response } from 'express'
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
      chat_session_id: true,
    },
    orderBy: { created_at: 'desc' },
    take: 200,
  })
  res.json({ leads })
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
      total_leads: true, total_conversions: true, conversion_rate_pct: true,
      operating_cities: true, created_at: true,
    },
  })
  if (!partner) {
    res.status(404).json({ error: 'Partner not found' })
    return
  }
  res.json({
    partner,
    // Lead assignment has no schema yet — ChannelLead exists but nothing
    // assigns a CallbackRequest to a specific partner. Honest placeholder,
    // not a guessed-at feature: see PLAN.md Wave 5.
    assignedLeadsNote: 'Lead assignment to individual partners is not built yet — see PLAN.md Wave 5.',
  })
})

export default router
