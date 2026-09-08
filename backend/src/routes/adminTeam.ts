// backend/src/routes/adminTeam.ts
//
// Super-admin-only: manage who has admin access, at what role, scoped to
// what builder or channel partner. Two ways to add someone, both here:
//  - Invite by email — creates an AdminUser with an invite token; the invitee
//    sets their own password via POST /accept-invite.
//  - Promote an existing buyer by their Supabase user id — no separate
//    password; they log into the admin panel with the Supabase session their
//    buyer account already has (see verifyUser in lib/auth.ts).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireIdentity, requireRole, hashPassword, generateInviteToken, recordAudit } from '../lib/adminIdentity'
import type { AdminIdentitySession } from '../lib/adminIdentity'

const router = Router()

function identityOf(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

/**
 * `FRONTEND_URL` is a comma-separated list (CORS reads it the same way in
 * index.ts) that carries the Vercel preview URL alongside the real domain.
 * Found live: taking the first entry handed back an invite link on
 * *-vercel.app instead of propfyndr.in. Prefer whichever entry is the real
 * domain; fall back to the first entry only if none match.
 */
export function preferredInviteOrigin(frontendUrlEnv: string | undefined): string {
  const origins = (frontendUrlEnv || '').split(',').map((s) => s.trim()).filter(Boolean)
  return origins.find((o) => o.includes('propfyndr.in')) || origins[0] || 'https://propfyndr.in'
}

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
}

const ROLE_ENUM = z.enum(['SUPER_ADMIN', 'ANALYST', 'SALES', 'BUILDER', 'PARTNER'])

const inviteSchema = z.object({
  email: z.string().email(),
  role: ROLE_ENUM,
  builder_id: z.string().uuid().optional(),
  partner_id: z.string().uuid().optional(),
})

// GET /api/v1/admin/team — list every admin account.
router.get('/', requireIdentity, requireRole('SUPER_ADMIN'), async (_req: Request, res: Response) => {
  const admins = await prisma.adminUser.findMany({
    select: {
      id: true, email: true, role: true, builder_id: true, partner_id: true,
      linked_supabase_user_id: true, is_active: true, last_login_at: true,
      created_at: true, invite_token: true, invite_expires_at: true,
      builder: { select: { name: true } },
      partner: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
  })
  res.json({
    admins: admins.map(a => ({
      ...a,
      // A live invite_token is a bearer credential — the list only ever says
      // whether one is pending, never the token itself.
      invite_token: undefined,
      invite_pending: Boolean(a.invite_token),
    })),
  })
})

// POST /api/v1/admin/team/invite — create a pending admin, email TBD by you.
router.post('/invite', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const parsed = inviteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const { email, role, builder_id, partner_id } = parsed.data

  if (role === 'BUILDER' && !builder_id) {
    res.status(400).json({ error: 'builder_id is required for role BUILDER' })
    return
  }
  if (role === 'PARTNER' && !partner_id) {
    res.status(400).json({ error: 'partner_id is required for role PARTNER' })
    return
  }

  const existing = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    res.status(409).json({ error: 'An admin with this email already exists' })
    return
  }

  const inviteToken = generateInviteToken()
  const identity = identityOf(req)
  const admin = await prisma.adminUser.create({
    data: {
      email: email.toLowerCase(),
      role,
      builder_id: role === 'BUILDER' ? builder_id : null,
      partner_id: role === 'PARTNER' ? partner_id : null,
      invited_by_admin_id: identity.adminUserId === 'root' ? null : identity.adminUserId,
      invite_token: inviteToken,
      invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      is_active: true,
    },
  })

  await recordAudit({
    entityType: 'admin_user', entityId: admin.id, entityName: admin.email,
    action: 'CREATE', actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
    actorLabel: identity.email, ipAddress: clientIp(req),
    summary: `Invited ${admin.email} as ${role}`,
  })

  // No email service is wired to a verified sender here — hand back the link
  // for you to send however you currently reach people (WhatsApp, direct
  // message). Wiring RESEND_API_KEY through this is a follow-up, not guessed
  // at blind.
  const inviteUrl = `${preferredInviteOrigin(process.env.FRONTEND_URL)}/admin/accept-invite?token=${inviteToken}`
  res.json({ admin: { id: admin.id, email: admin.email, role: admin.role }, inviteUrl })
})

const promoteSchema = z.object({
  supabase_user_id: z.string().min(1),
  email: z.string().email(),
  role: ROLE_ENUM,
  builder_id: z.string().uuid().optional(),
  partner_id: z.string().uuid().optional(),
})

// POST /api/v1/admin/team/promote — grant admin access to an existing buyer
// account by their Supabase user id. No invite flow: they already have
// credentials, just not admin-panel access.
router.post('/promote', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const parsed = promoteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const { supabase_user_id, email, role, builder_id, partner_id } = parsed.data

  if (role === 'BUILDER' && !builder_id) {
    res.status(400).json({ error: 'builder_id is required for role BUILDER' })
    return
  }
  if (role === 'PARTNER' && !partner_id) {
    res.status(400).json({ error: 'partner_id is required for role PARTNER' })
    return
  }

  const existingByUser = await prisma.adminUser.findUnique({ where: { linked_supabase_user_id: supabase_user_id } })
  if (existingByUser) {
    res.status(409).json({ error: 'This user already has an admin account' })
    return
  }
  const existingByEmail = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } })
  if (existingByEmail) {
    res.status(409).json({ error: 'An admin with this email already exists' })
    return
  }

  const identity = identityOf(req)
  const admin = await prisma.adminUser.create({
    data: {
      email: email.toLowerCase(),
      role,
      builder_id: role === 'BUILDER' ? builder_id : null,
      partner_id: role === 'PARTNER' ? partner_id : null,
      linked_supabase_user_id: supabase_user_id,
      invited_by_admin_id: identity.adminUserId === 'root' ? null : identity.adminUserId,
      is_active: true,
    },
  })

  await recordAudit({
    entityType: 'admin_user', entityId: admin.id, entityName: admin.email,
    action: 'CREATE', actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
    actorLabel: identity.email, ipAddress: clientIp(req),
    summary: `Promoted existing user ${supabase_user_id} (${admin.email}) to ${role}`,
  })

  res.json({ admin: { id: admin.id, email: admin.email, role: admin.role } })
})

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

// POST /api/v1/admin/team/accept-invite — set a password on an invited
// account. Deliberately unauthenticated: the invite token itself is the
// credential at this step, same pattern as any email-invite flow.
router.post('/accept-invite', async (req: Request, res: Response) => {
  const parsed = acceptInviteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const { token, password } = parsed.data

  const admin = await prisma.adminUser.findUnique({ where: { invite_token: token } })
  if (!admin || !admin.invite_expires_at || admin.invite_expires_at < new Date()) {
    res.status(400).json({ error: 'Invite is invalid or has expired' })
    return
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      password_hash: hashPassword(password),
      invite_token: null,
      invite_expires_at: null,
    },
  })

  res.json({ success: true })
})

const updateSchema = z.object({
  role: ROLE_ENUM.optional(),
  builder_id: z.string().uuid().nullable().optional(),
  partner_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
})

// PATCH /api/v1/admin/team/:id — change role, scope, or active status.
router.patch('/:id', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } })
  if (!target) {
    res.status(404).json({ error: 'Admin not found' })
    return
  }

  const identity = identityOf(req)
  if (target.id === identity.adminUserId && parsed.data.is_active === false) {
    res.status(400).json({ error: 'Cannot deactivate your own account' })
    return
  }

  const updated = await prisma.adminUser.update({
    where: { id: target.id },
    data: parsed.data,
  })

  await recordAudit({
    entityType: 'admin_user', entityId: updated.id, entityName: updated.email,
    action: 'UPDATE', actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
    actorLabel: identity.email, ipAddress: clientIp(req),
    summary: `Updated admin ${updated.email}`,
    changes: parsed.data,
  })

  res.json({
    admin: {
      id: updated.id, email: updated.email, role: updated.role,
      builder_id: updated.builder_id, partner_id: updated.partner_id,
      is_active: updated.is_active,
    },
  })
})

export default router
