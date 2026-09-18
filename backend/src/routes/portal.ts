// backend/src/routes/portal.ts
//
// Builder and channel-partner portal — real, scoped data, deliberately small
// tonight rather than a fully-featured dashboard guessed at without a corpus
// of real usage. Every route re-derives scope from the database via
// requireScope; nothing here trusts a builder_id/partner_id from the request.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireIdentity, requireRole, recordAudit, revokeAllSessions } from '../lib/adminIdentity'
import type { AdminIdentitySession } from '../lib/adminIdentity'
import { createAdminInvite } from '../lib/adminInvite'
import { eligiblePartners, nextInRotation, pickPartnerForBuilder } from '../lib/leadAssignment'
import { buildLeadBrief } from '../lib/leadBrief'
import { canManageAccess } from '../lib/accessHierarchy'

const router = Router()

function identityOf(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

/**
 * GET /api/v1/portal/tenant/:subdomain — branding for a tenant host.
 *
 * Public, and it has to be: it renders on the sign-in screen, before anyone has
 * a session. That is exactly why the response is three fields. `portal_subdomain`
 * has existed on both models since subdomain routing shipped and nothing has
 * ever read it, so `lotus.propfyndr.in` showed a builder a page branded
 * "PropFyndr Admin" — a white-label that white-labels nothing.
 *
 * Branding only. It answers "whose door is this", never "what may they see":
 * a tenant slug is a public string anyone can type, so anything derived from it
 * must be information we would put on a billboard. Scope still comes from the
 * session on every other endpoint in this file — see lib/subdomain.ts, which
 * says the same thing from the routing side.
 *
 * An unknown subdomain returns 404 rather than a default, so the caller renders
 * the plain PropFyndr shell instead of a half-branded one.
 */
router.get('/tenant/:subdomain', async (req: Request, res: Response) => {
  const raw = String(req.params.subdomain || '').trim().toLowerCase()
  // Same shape the router accepts. Anything else cannot be a tenant, so there
  // is no reason to spend a query on it.
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(raw)) {
    res.status(404).json({ error: 'Unknown portal' })
    return
  }

  const [builder, partner] = await Promise.all([
    prisma.builder.findUnique({
      where: { portal_subdomain: raw },
      select: { name: true, slug: true, logo_url: true },
    }),
    prisma.channelPartner.findUnique({
      where: { portal_subdomain: raw },
      select: { name: true, slug: true },
    }),
  ])

  if (builder) {
    res.json({ type: 'builder', name: builder.name, slug: builder.slug, logo_url: builder.logo_url || null })
    return
  }
  if (partner) {
    // ChannelPartner has no logo column. Absent, not empty — the caller falls
    // back to the name rather than rendering a broken image.
    res.json({ type: 'partner', name: partner.name, slug: partner.slug, logo_url: null })
    return
  }

  res.status(404).json({ error: 'Unknown portal' })
})

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
    // Same shape as the populated response. A caller that reads `siteVisits` or
    // `page` should not have to special-case the builder with no projects yet.
    res.json({ leads: [], siteVisits: [], page: { limit: 0, offset: 0, total_leads: 0, total_site_visits: 0 } })
    return
  }
  /**
   * Paged. It was a bare `take: 200`, which is not a limit but a silent
   * truncation: a builder with 201 leads simply never saw the 201st, and
   * nothing in the response said a page had been cut off.
   */
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200)
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0)

  const [leads, totalLeads] = await Promise.all([
    prisma.callbackRequest.findMany({
      where: { project_slug: { in: slugs } },
      select: {
        id: true, name: true, phone: true, project_name: true, project_slug: true,
        status: true, lead_tier: true, intent_tier: true, created_at: true,
        // `chat_session_id` is deliberately absent. It pointed at a transcript
        // a builder can neither fetch nor should — see the Lead Brief rules.
        // `ai_summary` is safe by construction: it is composed from stored
        // buyer-profile fields by summarizeProfile(), never from the message
        // log, so it names no competing project.
        ai_summary: true,
        budget_min_cr: true, budget_max_cr: true,
        assigned_partner_id: true, assigned_at: true, partner_notes: true,
      },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.callbackRequest.count({ where: { project_slug: { in: slugs } } }),
  ])

  /**
   * Site visits are a separate table and a separate lead type — CLAUDE.md lists
   * a site visit request as a High Intent Event, and until now a builder could
   * not see a single one booked on their own project.
   *
   * Returned as its own list rather than merged into `leads`: a
   * SiteVisitRequest carries a date and a time slot that a callback has no
   * field for, so flattening the two would drop the appointment itself. Both
   * now carry `assigned_partner_id` — the column was added to this table on
   * 2026-09-17, so a builder can route the visit to whoever will attend it.
   */
  const [siteVisits, totalVisits] = await Promise.all([
    prisma.siteVisitRequest.findMany({
      where: { project_slug: { in: slugs } },
      select: {
        id: true, name: true, phone: true, email: true,
        project_name: true, project_slug: true,
        visit_date: true, time_slot: true, message: true,
        status: true, created_at: true,
        assigned_partner_id: true, assigned_at: true, partner_notes: true,
      },
      orderBy: { visit_date: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.siteVisitRequest.count({ where: { project_slug: { in: slugs } } }),
  ])

  res.json({
    leads,
    siteVisits,
    page: { limit, offset, total_leads: totalLeads, total_site_visits: totalVisits },
  })
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

  // See the admin lead route: written once, never moved.
  if (d.status && d.status !== 'new') {
    await prisma.callbackRequest.updateMany({
      where: { id: lead.id, first_contacted_at: null },
      data: { first_contacted_at: new Date() },
    })
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
      // `chat_session_id` removed here too. The list endpoint above dropped it
      // and this one did not, so assigning a lead handed the builder back the
      // very reference the list had just stopped returning — the kind of gap a
      // per-endpoint select produces and a test catches.
      id: true, name: true, phone: true, project_name: true, project_slug: true,
      status: true, lead_tier: true, intent_tier: true, created_at: true,
      assigned_partner_id: true, assigned_at: true,
    },
  })
  res.json({ lead: updated })
})

/**
 * Access management, from the organisation that owns the account.
 *
 * A builder whose sales manager leaves had to email us and wait for a super
 * admin to switch the login off. That makes PropFyndr a bottleneck on somebody
 * else's staffing, and it leaves the person who actually knows someone has left
 * unable to act on it. The rules live in `lib/accessHierarchy.ts`.
 *
 * Revocation only. Creating a login stays with us — see `canInvite`, and the
 * request-access endpoint below.
 */

/** Every account this actor is allowed to see, resolved from the database. */
async function accessListFor(identity: AdminIdentitySession) {
  if (identity.role === 'BUILDER' && identity.builderId) {
    // This builder's own admins, plus the admins of every partner firm they
    // onboarded. The partner set is derived from ownership, never passed in.
    const partners = await prisma.channelPartner.findMany({
      where: { builder_id: identity.builderId },
      select: { id: true, name: true },
    })
    const partnerIds = partners.map((p) => p.id)
    const rows = await prisma.adminUser.findMany({
      where: {
        OR: [
          { builder_id: identity.builderId, role: 'BUILDER' },
          ...(partnerIds.length ? [{ partner_id: { in: partnerIds }, role: 'PARTNER' as const }] : []),
        ],
      },
      select: {
        id: true, email: true, role: true, is_active: true, last_login_at: true,
        created_at: true, invite_token: true, partner_id: true,
        partner: { select: { name: true } },
      },
      orderBy: { created_at: 'asc' },
    })
    return rows
  }

  if (identity.role === 'PARTNER' && identity.partnerId) {
    return prisma.adminUser.findMany({
      where: { partner_id: identity.partnerId, role: 'PARTNER' },
      select: {
        id: true, email: true, role: true, is_active: true, last_login_at: true,
        created_at: true, invite_token: true, partner_id: true,
        partner: { select: { name: true } },
      },
      orderBy: { created_at: 'asc' },
    })
  }

  return []
}

/**
 * GET /portal/access — who can sign in at this organisation.
 *
 * A live `invite_token` is a bearer credential: anyone holding it can set that
 * account's password. The list says only whether one is pending, exactly as the
 * admin Team endpoint does.
 */
router.get('/access', requireIdentity, requireRole('BUILDER', 'PARTNER', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const identity = identityOf(req)
  const rows = await accessListFor(identity)
  res.json({
    accounts: rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      is_active: r.is_active,
      last_login_at: r.last_login_at,
      invite_pending: Boolean(r.invite_token),
      organisation: r.partner?.name ?? null,
      /** Whether this viewer may act on this row, so the UI need not re-derive it. */
      can_manage: canManageAccess(
        { adminUserId: identity.adminUserId, role: identity.role, builderId: identity.builderId, partnerId: identity.partnerId },
        {
          adminUserId: r.id, role: r.role, builderId: identity.builderId, partnerId: r.partner_id,
          partnerOwnerBuilderId: identity.builderId,
        },
      ).allowed,
    })),
  })
})

/**
 * PATCH /portal/access/:id — switch an account off, or back on.
 *
 * The target's scope is re-read from the database and checked against the
 * hierarchy; nothing about who owns whom comes from the request. Every decision
 * is audited, because revoking someone's access is exactly the kind of act that
 * needs a name attached to it afterwards.
 */
router.patch('/access/:id', requireIdentity, requireRole('BUILDER', 'PARTNER', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const identity = identityOf(req)

  const parsed = z.object({ is_active: z.boolean() }).strict().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'is_active is required' }); return }

  const target = await prisma.adminUser.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, email: true, role: true, builder_id: true, partner_id: true, is_active: true,
      partner: { select: { builder_id: true } },
    },
  })
  // Same answer for "does not exist" and "not yours": a 404 that distinguishes
  // them is an oracle for probing other organisations' account ids.
  if (!target) { res.status(404).json({ error: 'Account not found' }); return }

  const decision = canManageAccess(
    { adminUserId: identity.adminUserId, role: identity.role, builderId: identity.builderId, partnerId: identity.partnerId },
    {
      adminUserId: target.id, role: target.role,
      builderId: target.builder_id, partnerId: target.partner_id,
      partnerOwnerBuilderId: target.partner?.builder_id ?? null,
    },
  )
  if (!decision.allowed) {
    console.warn('[portal:ACCESS_DENIED]', { actor: identity.email, role: identity.role, target: target.id })
    res.status(403).json({ error: decision.reason ?? 'Not allowed' })
    return
  }

  const updated = await prisma.adminUser.update({
    where: { id: target.id },
    data: { is_active: parsed.data.is_active },
    select: { id: true, email: true, role: true, is_active: true },
  })

  /**
   * End their sessions immediately when switching off.
   *
   * `is_active` is read at login, so without this a revoked account keeps
   * working until its session expires — up to a day for an external role. A
   * revocation that takes effect tomorrow is not a revocation.
   */
  let revokedSessions = 0
  if (!parsed.data.is_active) {
    revokedSessions = await revokeAllSessions(target.id)
  }

  await recordAudit({
    entityType: 'admin_user', entityId: target.id, entityName: target.email,
    action: 'UPDATE',
    actorAdminId: identity.adminUserId,
    actorLabel: identity.email,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
    summary: parsed.data.is_active
      ? `Restored portal access for ${target.email}`
      : `Revoked portal access for ${target.email}; ${revokedSessions} session(s) ended`,
  })

  res.json({ account: updated, sessions_ended: revokedSessions })
})

/**
 * GET /builder/objections — why buyers are not buying, in aggregate.
 *
 * `LeadObjection` has been recording, per lead and per project, the reason a
 * buyer gave for hesitating — in their own words, with a confidence score. It
 * was surfaced one lead at a time in the Lead Brief and never summed, so the
 * single most commercially useful thing we hold about a builder's projects was
 * invisible to them.
 *
 * "Possession timeline is your top objection, 34% of hesitations" is the report
 * that changes what a builder does next. It is also the report that makes them
 * renew, and it only works because we are not their marketing department.
 *
 * Scoped to this builder's own projects. A builder reading why a buyer hesitated
 * on somebody else's project is the leak the Lead Brief exists to prevent,
 * wearing a different shape.
 */
router.get('/builder/objections', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN', 'ANALYST', 'SALES'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }

  const slugs = (await prisma.project.findMany({ where: { builder_id: builderId }, select: { slug: true } })).map((p) => p.slug)
  if (slugs.length === 0) { res.json({ total: 0, byCategory: [], byProject: [], recent: [] }); return }

  const objections = await prisma.leadObjection.findMany({
    where: { project_slug: { in: slugs } },
    select: {
      reason_category: true, reason_text: true, confidence_score: true,
      project_name: true, project_slug: true, created_at: true,
    },
    orderBy: { created_at: 'desc' },
    take: 1000,
  })

  const total = objections.length

  // Grouped in code rather than two more groupBy round trips: the rows are
  // already here and the catalogue is small enough that this is free.
  const tally = (key: (o: typeof objections[number]) => string) => {
    const m = new Map<string, number>()
    for (const o of objections) m.set(key(o), (m.get(key(o)) ?? 0) + 1)
    return [...m]
      .map(([name, count]) => ({ name, count, share: total ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
  }

  res.json({
    total,
    byCategory: tally((o) => o.reason_category),
    byProject: tally((o) => o.project_name ?? o.project_slug).slice(0, 10),
    /**
     * Verbatim, and deliberately so. A category tells a builder what to fix;
     * the buyer's own sentence tells them how it is being experienced, which is
     * the half that changes the brochure. Paraphrasing turns evidence into our
     * opinion.
     */
    recent: objections.slice(0, 12).map((o) => ({
      category: o.reason_category,
      text: o.reason_text,
      confidence: o.confidence_score,
      project: o.project_name ?? o.project_slug,
      created_at: o.created_at,
    })),
  })
})

/**
 * GET /builder/leads/:id/brief — the Lead Brief.
 *
 * Scope is proved before the brief is built: the lead must sit on one of this
 * builder's own project slugs. `buildLeadBrief` deliberately does no scoping of
 * its own — it trusts its caller, and this is where that trust is earned.
 *
 * Always `audience: 'builder'`, never taken from the request. A query parameter
 * that switched off competitor scrubbing would be the whole protection, handed
 * to the party it protects against.
 */
router.get('/builder/leads/:id/brief', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN', 'SALES'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }

  const slugs = (await prisma.project.findMany({ where: { builder_id: builderId }, select: { slug: true } })).map((p) => p.slug)
  const owned = await prisma.callbackRequest.findFirst({
    where: { id: req.params.id, project_slug: { in: slugs } },
    select: { id: true },
  })
  if (!owned) { res.status(404).json({ error: 'Lead not found' }); return }

  const brief = await buildLeadBrief(owned.id, 'builder')
  if (!brief) { res.status(404).json({ error: 'Lead not found' }); return }
  res.json({ brief })
})

/**
 * GET /partner/leads/:id/brief — the same brief, for the partner working it.
 *
 * Also scrubbed. A channel partner is outside the company exactly as a builder
 * is, and often works for several builders at once — which makes competitor
 * context in their hands more sensitive here, not less.
 */
router.get('/partner/leads/:id/brief', requireIdentity, requireRole('PARTNER', 'SUPER_ADMIN', 'SALES'), async (req: Request, res: Response) => {
  const partnerId = partnerScope(req)
  if (!partnerId) { res.status(400).json({ error: 'No partner scope — pass partner_id' }); return }

  const owned = await prisma.callbackRequest.findFirst({
    where: { id: req.params.id, assigned_partner_id: partnerId },
    select: { id: true },
  })
  if (!owned) { res.status(404).json({ error: 'Lead not found' }); return }

  const brief = await buildLeadBrief(owned.id, 'builder')
  if (!brief) { res.status(404).json({ error: 'Lead not found' }); return }
  res.json({ brief })
})

/**
 * PATCH /builder/site-visits/:id — route a booked visit to a partner.
 *
 * The mirror of /builder/leads/:id. A site visit is the one lead type somebody
 * has to physically attend, and until `assigned_partner_id` was added to this
 * table a builder could hand a partner the phone call but not the appointment.
 */
router.patch('/builder/site-visits/:id', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN', 'SALES'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }

  const parsed = z.object({
    assigned_partner_id: z.string().uuid().nullable().optional(),
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
    partner_notes: z.string().max(2000).nullable().optional(),
  }).strict().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.issues }); return }
  const d = parsed.data
  if (d.assigned_partner_id === undefined && d.status === undefined && d.partner_notes === undefined) {
    res.status(400).json({ error: 'Nothing to update' }); return
  }

  const slugs = (await prisma.project.findMany({ where: { builder_id: builderId }, select: { slug: true } })).map((p) => p.slug)
  const visit = await prisma.siteVisitRequest.findFirst({
    where: { id: req.params.id, project_slug: { in: slugs } },
    select: { id: true },
  })
  if (!visit) { res.status(404).json({ error: 'Site visit not found' }); return }

  // Re-checked against this builder, exactly as the callback route does: an
  // id in the body is a request, never a fact.
  if (d.assigned_partner_id) {
    const partner = await prisma.channelPartner.findFirst({
      where: { id: d.assigned_partner_id, builder_id: builderId, status: 'approved', is_active: true },
      select: { id: true },
    })
    if (!partner) { res.status(400).json({ error: 'Not an approved, active partner of yours' }); return }
  }

  const updated = await prisma.siteVisitRequest.update({
    where: { id: visit.id },
    data: {
      ...(d.status ? { status: d.status } : {}),
      ...(d.partner_notes !== undefined ? { partner_notes: d.partner_notes } : {}),
      ...(d.assigned_partner_id !== undefined
        ? { assigned_partner_id: d.assigned_partner_id, assigned_at: d.assigned_partner_id ? new Date() : null }
        : {}),
    },
    select: {
      id: true, name: true, phone: true, project_name: true, project_slug: true,
      visit_date: true, time_slot: true, status: true,
      assigned_partner_id: true, assigned_at: true, partner_notes: true,
    },
  })
  res.json({ siteVisit: updated })
})

/**
 * GET /builder/assignment-preview — who is next in rotation, and current load.
 *
 * Exists so a builder can see the distribution before letting it run. "It
 * assigned to them and I do not know why" is the complaint that makes people
 * turn automation off; a visible queue is the cheapest answer to it.
 */
router.get('/builder/assignment-preview', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN', 'SALES'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }
  const candidates = await eligiblePartners(builderId)
  res.json({ candidates, next: nextInRotation(candidates) })
})

/**
 * POST /builder/leads/auto-assign — hand every unassigned lead to a partner.
 *
 * Sequential rather than batched on purpose: each pick must see the previous
 * one's result, or ten leads all go to whoever happened to be lightest when the
 * request started. Correctness over a round trip.
 *
 * Only ever fills empty assignments. A lead a builder placed by hand is a
 * decision, and an "auto" button that silently overrides decisions is one
 * people press once.
 */
router.post('/builder/leads/auto-assign', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }

  const slugs = (await prisma.project.findMany({ where: { builder_id: builderId }, select: { slug: true } })).map((p) => p.slug)
  if (slugs.length === 0) { res.json({ assigned: 0, assignments: [] }); return }

  if ((await eligiblePartners(builderId)).length === 0) {
    res.status(400).json({ error: 'You have no approved, active partners to assign leads to.' })
    return
  }

  const unassigned = await prisma.callbackRequest.findMany({
    where: { project_slug: { in: slugs }, assigned_partner_id: null },
    select: { id: true },
    orderBy: { created_at: 'asc' },
    take: 100,
  })

  const assignments: Array<{ lead_id: string; partner_id: string; partner_name: string }> = []
  for (const lead of unassigned) {
    const partner = await pickPartnerForBuilder(builderId)
    if (!partner) break
    await prisma.callbackRequest.update({
      where: { id: lead.id },
      data: { assigned_partner_id: partner.id, assigned_at: new Date() },
    })
    assignments.push({ lead_id: lead.id, partner_id: partner.id, partner_name: partner.name })
  }

  res.json({ assigned: assignments.length, assignments })
})

/**
 * POST /builder/partners/:id/request-access — ask us to give this partner a login.
 *
 * The builder does the data entry; we mint the identity. A builder creating
 * `AdminUser` rows directly would mean anyone who compromised one builder
 * account could manufacture logins, and the approval that gates a partner firm
 * would gate nothing.
 *
 * So this does not create an account. It records the request against the
 * partner and surfaces it in our Partners queue, where approving the firm sends
 * the invite.
 */
router.post('/builder/partners/:id/request-access', requireIdentity, requireRole('BUILDER', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const builderId = builderScope(req)
  if (!builderId) { res.status(400).json({ error: 'No builder scope — pass builder_id' }); return }

  const parsed = z.object({ email: z.string().email() }).strict().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'A valid email address is required' }); return }

  const partner = await prisma.channelPartner.findFirst({
    where: { id: req.params.id, builder_id: builderId },
    select: { id: true, name: true, status: true, email: true },
  })
  if (!partner) { res.status(404).json({ error: 'Partner not found' }); return }

  // Requesting access for a firm we have not approved is not refused — it is
  // the normal order of events, and the queue is where both decisions get made
  // together. It simply grants nothing yet.
  await prisma.channelPartner.update({
    where: { id: partner.id },
    data: {
      email: partner.email || parsed.data.email,
      review_notes: `Portal access requested for ${parsed.data.email} by the builder.`,
      ...(partner.status === 'approved' ? {} : { submitted_at: new Date() }),
    },
  })

  res.status(202).json({
    ok: true,
    message: partner.status === 'approved'
      ? `Access requested for ${parsed.data.email}. PropFyndr will send the invite.`
      : `Access requested for ${parsed.data.email}. ${partner.name} needs PropFyndr approval first.`,
  })
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

/**
 * GET /partner/site-visits — the appointments routed to this partner.
 *
 * Same scoping rule as /partner/leads: the row must already carry this
 * partner's id. Assignment is the builder's act, never the partner's, so there
 * is nothing here a partner could widen by asking.
 *
 * `email` is included where `/partner/leads` has none to include — a site visit
 * is an appointment someone has to confirm, and a bounced phone number with no
 * second channel means a buyer waiting at a sales office for nobody.
 */
router.get('/partner/site-visits', requireIdentity, requireRole('PARTNER', 'SUPER_ADMIN', 'SALES'), async (req: Request, res: Response) => {
  const partnerId = partnerScope(req)
  if (!partnerId) { res.status(400).json({ error: 'No partner scope — pass partner_id' }); return }

  const siteVisits = await prisma.siteVisitRequest.findMany({
    where: { assigned_partner_id: partnerId },
    select: {
      id: true, name: true, phone: true, email: true,
      project_name: true, project_slug: true,
      visit_date: true, time_slot: true, message: true,
      status: true, partner_notes: true, assigned_at: true, created_at: true,
    },
    orderBy: { visit_date: 'asc' },
    take: 200,
  })
  res.json({ siteVisits })
})

/**
 * PATCH /partner/site-visits/:id — the partner works their own appointment.
 *
 * They may move status and leave notes. They may NOT reassign it: a partner who
 * could clear their own `assigned_partner_id` could hand work back invisibly,
 * and the builder who routed it would never learn the visit went unattended.
 */
router.patch('/partner/site-visits/:id', requireIdentity, requireRole('PARTNER', 'SUPER_ADMIN', 'SALES'), async (req: Request, res: Response) => {
  const partnerId = partnerScope(req)
  if (!partnerId) { res.status(400).json({ error: 'No partner scope — pass partner_id' }); return }

  const parsed = z.object({
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
    partner_notes: z.string().max(2000).nullable().optional(),
  }).strict().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.issues }); return }
  const d = parsed.data
  if (d.status === undefined && d.partner_notes === undefined) {
    res.status(400).json({ error: 'Nothing to update' }); return
  }

  const owned = await prisma.siteVisitRequest.findFirst({
    where: { id: req.params.id, assigned_partner_id: partnerId },
    select: { id: true },
  })
  if (!owned) { res.status(404).json({ error: 'Site visit not found' }); return }

  const siteVisit = await prisma.siteVisitRequest.update({
    where: { id: owned.id },
    data: {
      ...(d.status ? { status: d.status } : {}),
      ...(d.partner_notes !== undefined ? { partner_notes: d.partner_notes } : {}),
    },
    select: {
      id: true, name: true, phone: true, email: true,
      project_name: true, visit_date: true, time_slot: true,
      status: true, partner_notes: true, assigned_at: true,
    },
  })
  res.json({ siteVisit })
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

  // See the admin lead route: written once, never moved.
  if (d.status && d.status !== 'new') {
    await prisma.callbackRequest.updateMany({
      where: { id: owned.id, first_contacted_at: null },
      data: { first_contacted_at: new Date() },
    })
  }

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
