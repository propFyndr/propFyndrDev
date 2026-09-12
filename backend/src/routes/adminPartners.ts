// backend/src/routes/adminPartners.ts
//
// PropFyndr-side management of channel partners.
//
// A channel partner belongs to a builder; PropFyndr approves, verifies and can
// switch one off. Three separate facts, kept separate on purpose:
//   status      — our review decision on the application (new/approved/rejected/…)
//   is_active   — whether the partner may sign into the portal at all
//   is_verified — the buyer-facing trust badge
// Approving sets status + is_active together because that is what approval
// means operationally; verification stays a second, deliberate action.
//
// Mounted at /api/v1/admin/channel-partners BEFORE the catch-all admin router,
// so the bare `GET /` here replaces the older read-only list in admin.ts. It
// returns the same `{ partners, channel_partners }` shape that the project
// detail page's partner picker already reads.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireIdentity, requireRole, recordAudit } from '../lib/adminIdentity'
import { normalisePortalSubdomain } from '../lib/portalSubdomain'
import type { AdminIdentitySession } from '../lib/adminIdentity'

const router = Router()

function identityOf(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

const PARTNER_TYPES = ['broker', 'agency', 'agent', 'referral', 'corporate'] as const
const STATUSES = ['new', 'reviewing', 'approved', 'rejected', 'clarification_requested'] as const

const PARTNER_SELECT = {
  id: true, name: true, slug: true, type: true, description: true, website: true,
  phone: true, email: true, primary_contact: true, contact_phone: true, contact_email: true,
  operating_cities: true, specializations: true,
  is_verified: true, verification_date: true, is_active: true,
  status: true, review_notes: true, reviewed_by: true, submitted_at: true,
  rera_compliant: true, credai_member: true,
  commission_rate_pct: true, payment_terms: true,
  total_leads: true, total_conversions: true, conversion_rate_pct: true,
  portal_subdomain: true,
  builder_id: true,
  builder: { select: { id: true, name: true, slug: true } },
  created_at: true, updated_at: true,
} as const

/**
 * Live counts from the leads actually routed to each partner. `total_leads` on
 * the row is a stored counter nothing currently increments — reading the join
 * table is the honest number, so the UI shows this and not that column.
 */
async function assignmentCounts(partnerIds: string[]): Promise<Map<string, { assigned: number; converted: number }>> {
  const out = new Map<string, { assigned: number; converted: number }>()
  if (partnerIds.length === 0) return out
  const rows = await prisma.callbackRequest.groupBy({
    by: ['assigned_partner_id', 'status'],
    where: { assigned_partner_id: { in: partnerIds } },
    _count: { _all: true },
  })
  for (const r of rows) {
    const id = r.assigned_partner_id
    if (!id) continue
    const entry = out.get(id) ?? { assigned: 0, converted: 0 }
    entry.assigned += r._count._all
    if (r.status === 'converted') entry.converted += r._count._all
    out.set(id, entry)
  }
  return out
}

// GET / — every channel partner, newest first, with its builder and live counts.
router.get('/', requireIdentity, requireRole('SUPER_ADMIN', 'ANALYST', 'SALES'), async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status !== 'ALL' ? req.query.status : undefined
    const builderId = typeof req.query.builder_id === 'string' ? req.query.builder_id : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

    const partners = await prisma.channelPartner.findMany({
      where: {
        ...(status ? { status: status as (typeof STATUSES)[number] } : {}),
        ...(builderId ? { builder_id: builderId } : {}),
        ...(q ? { OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { primary_contact: { contains: q, mode: 'insensitive' as const } },
        ] } : {}),
      },
      select: PARTNER_SELECT,
      orderBy: [{ created_at: 'desc' }],
      take: 500,
    })

    const counts = await assignmentCounts(partners.map((p) => p.id))
    const withCounts = partners.map((p) => ({
      ...p,
      leads_assigned: counts.get(p.id)?.assigned ?? 0,
      leads_converted: counts.get(p.id)?.converted ?? 0,
    }))

    // `channel_partners` kept alongside `partners` — the project detail page's
    // partner picker reads that key.
    res.json({ partners: withCounts, channel_partners: withCounts })
  } catch (err) {
    console.error('[adminPartners] list failed:', err)
    res.status(500).json({ error: 'Failed to fetch channel partners' })
  }
})

// GET /:id — one partner plus the leads currently routed to it.
router.get('/:id', requireIdentity, requireRole('SUPER_ADMIN', 'ANALYST', 'SALES'), async (req: Request, res: Response) => {
  try {
    const partner = await prisma.channelPartner.findUnique({ where: { id: req.params.id }, select: PARTNER_SELECT })
    if (!partner) { res.status(404).json({ error: 'Partner not found' }); return }

    const leads = await prisma.callbackRequest.findMany({
      where: { assigned_partner_id: partner.id },
      select: {
        id: true, name: true, phone: true, project_name: true, project_slug: true,
        status: true, lead_tier: true, assigned_at: true, partner_notes: true, created_at: true,
      },
      orderBy: { assigned_at: 'desc' },
      take: 200,
    })
    const accounts = await prisma.adminUser.findMany({
      where: { partner_id: partner.id },
      select: { id: true, email: true, is_active: true, last_login_at: true, invite_token: true },
    })

    res.json({
      partner,
      leads,
      // `invite_token` itself never leaves the server — only whether one is still pending.
      accounts: accounts.map(({ invite_token, ...a }) => ({ ...a, invite_pending: Boolean(invite_token) })),
    })
  } catch (err) {
    console.error('[adminPartners] detail failed:', err)
    res.status(500).json({ error: 'Failed to fetch partner' })
  }
})

const CreateSchema = z.object({
  name: z.string().min(2).max(160),
  type: z.enum(PARTNER_TYPES),
  builder_id: z.string().uuid(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  primary_contact: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  website: z.string().max(300).optional(),
  operating_cities: z.array(z.string().min(1).max(60)).max(20).optional(),
  specializations: z.array(z.string().min(1).max(40)).max(20).optional(),
  commission_rate_pct: z.number().min(0).max(100).optional(),
  payment_terms: z.string().max(60).optional(),
}).strict()

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

// POST / — a super admin onboards a partner directly, already approved.
router.post('/', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.issues }); return }
  const d = parsed.data
  const identity = identityOf(req)

  const builder = await prisma.builder.findUnique({ where: { id: d.builder_id }, select: { id: true, name: true } })
  if (!builder) { res.status(400).json({ error: 'Builder not found' }); return }

  try {
    const partner = await prisma.channelPartner.create({
      data: {
        name: d.name,
        slug: slugify(d.name),
        type: d.type,
        builder_id: builder.id,
        email: d.email || null,
        phone: d.phone || null,
        primary_contact: d.primary_contact || null,
        description: d.description || null,
        website: d.website || null,
        operating_cities: d.operating_cities ?? [],
        specializations: d.specializations ?? [],
        commission_rate_pct: d.commission_rate_pct ?? null,
        payment_terms: d.payment_terms || null,
        status: 'approved',
        is_active: true,
        reviewed_by: identity.email,
      },
      select: PARTNER_SELECT,
    })
    await recordAudit({
      entityType: 'channel_partner', entityId: partner.id, entityName: partner.name,
      action: 'create', actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
      actorLabel: identity.email, ipAddress: req.ip,
      summary: `Created channel partner ${partner.name} under ${builder.name}`,
    })
    res.status(201).json({ partner })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      res.status(409).json({ error: 'A partner with that name already exists.' })
      return
    }
    console.error('[adminPartners] create failed:', err)
    res.status(500).json({ error: 'Failed to create partner' })
  }
})

const UpdateSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  type: z.enum(PARTNER_TYPES).optional(),
  builder_id: z.string().uuid().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  primary_contact: z.string().max(120).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  operating_cities: z.array(z.string().min(1).max(60)).max(20).optional(),
  specializations: z.array(z.string().min(1).max(40)).max(20).optional(),
  commission_rate_pct: z.number().min(0).max(100).nullable().optional(),
  payment_terms: z.string().max(60).nullable().optional(),
  status: z.enum(STATUSES).optional(),
  review_notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
  is_verified: z.boolean().optional(),
  rera_compliant: z.boolean().optional(),
  credai_member: z.boolean().optional(),
  // Validated below rather than by Zod: the reserved-word list and the DNS
  // label rules live in one place, shared with the builder write path.
  portal_subdomain: z.string().nullable().optional(),
}).strict()

// PATCH /:id — edit, approve, reject, verify, activate. One endpoint because
// the admin UI edits these on one row and every one of them is an audited write.
router.patch('/:id', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.issues }); return }
  const d = parsed.data
  const identity = identityOf(req)

  const existing = await prisma.channelPartner.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, status: true, is_active: true, is_verified: true },
  })
  if (!existing) { res.status(404).json({ error: 'Partner not found' }); return }

  if (d.builder_id) {
    const builder = await prisma.builder.findUnique({ where: { id: d.builder_id }, select: { id: true } })
    if (!builder) { res.status(400).json({ error: 'Builder not found' }); return }
  }

  const data: Record<string, unknown> = { ...d }
  if (d.name) data.slug = slugify(d.name)
  if ('portal_subdomain' in d) {
    const checked = normalisePortalSubdomain(d.portal_subdomain)
    if (!checked.ok) { res.status(400).json({ error: checked.error }); return }
    data.portal_subdomain = checked.value
  }
  if (d.status) {
    data.reviewed_by = identity.email
    // Approval is what lets a partner in; rejection is what keeps them out.
    // Stated here rather than relied on from the caller, so the two flags can
    // never drift apart through a partial UI update.
    if (d.status === 'approved' && d.is_active === undefined) data.is_active = true
    if (d.status === 'rejected') data.is_active = false
  }
  if (d.is_verified === true) data.verification_date = new Date()
  if (d.is_verified === false) data.verification_date = null

  try {
    const partner = await prisma.channelPartner.update({
      where: { id: existing.id },
      data,
      select: PARTNER_SELECT,
    })
    await recordAudit({
      entityType: 'channel_partner', entityId: partner.id, entityName: partner.name,
      action: d.status ? `status:${d.status}` : 'update',
      actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
      actorLabel: identity.email, ipAddress: req.ip,
      summary: `Updated channel partner ${partner.name}`,
      changes: { before: existing, after: d },
    })
    res.json({ partner })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      const target = String((err as { meta?: { target?: unknown } }).meta?.target ?? '')
      res.status(409).json({
        error: target.includes('portal_subdomain')
          ? 'That subdomain is already taken.'
          : 'A partner with that name already exists.',
      })
      return
    }
    console.error('[adminPartners] update failed:', err)
    res.status(500).json({ error: 'Failed to update partner' })
  }
})

export default router
