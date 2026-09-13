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
import { requireIdentity, requireRole, hashPassword, generateInviteToken, recordAudit, revokeAllSessions } from '../lib/adminIdentity'
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

/** The sample token the admin email-preview link carries. Never valid in production. */
export const DEMO_INVITE_TOKEN = 'prp_demo_invite_token'

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: ROLE_ENUM,
  builder_id: z.string().uuid('Invalid builder organization ID').optional().or(z.literal('').transform(() => undefined)),
  partner_id: z.string().uuid('Invalid channel partner ID').optional().or(z.literal('').transform(() => undefined)),
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
    const flattened = parsed.error.flatten()
    const firstFieldErr = Object.values(flattened.fieldErrors)[0]?.[0]
    res.status(400).json({ error: firstFieldErr || 'Invalid input', details: flattened })
    return
  }
  const { email, role, builder_id, partner_id } = parsed.data

  if (role === 'BUILDER' && !builder_id) {
    res.status(400).json({ error: 'Please choose a target builder organization for the Builder role.' })
    return
  }
  if (role === 'PARTNER' && !partner_id) {
    res.status(400).json({ error: 'Please choose an approved channel partner firm for the Partner role.' })
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
  supabase_user_id: z.string().min(1, 'Supabase User ID is required'),
  email: z.string().email('Please enter a valid email address'),
  role: ROLE_ENUM,
  builder_id: z.string().uuid('Invalid builder organization ID').optional().or(z.literal('').transform(() => undefined)),
  partner_id: z.string().uuid('Invalid channel partner ID').optional().or(z.literal('').transform(() => undefined)),
})

// POST /api/v1/admin/team/promote — grant admin access to an existing buyer
// account by their Supabase user id. No invite flow: they already have
// credentials, just not admin-panel access.
router.post('/promote', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const parsed = promoteSchema.safeParse(req.body)
  if (!parsed.success) {
    const flattened = parsed.error.flatten()
    const firstFieldErr = Object.values(flattened.fieldErrors)[0]?.[0]
    res.status(400).json({ error: firstFieldErr || 'Invalid input', details: flattened })
    return
  }
  const { supabase_user_id, email, role, builder_id, partner_id } = parsed.data

  if (role === 'BUILDER' && !builder_id) {
    res.status(400).json({ error: 'Please choose a target builder organization for the Builder role.' })
    return
  }
  if (role === 'PARTNER' && !partner_id) {
    res.status(400).json({ error: 'Please choose an approved channel partner firm for the Partner role.' })
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

  // The email-preview modal renders a sample invite link carrying this token so
  // the flow can be clicked through without burning a real invite. It sets no
  // password and issues no session — but a production auth endpoint that
  // answers `success: true` to a hardcoded string is not a thing to ship, so
  // it only exists outside production.
  if (token === DEMO_INVITE_TOKEN && process.env.NODE_ENV !== 'production') {
    res.json({ success: true, isDemo: true, message: 'Demonstration invite verified successfully' })
    return
  }

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

/**
 * POST /api/v1/admin/team/:id/resend-invite — hand back this admin's invite link.
 *
 * Returns the *existing* token while it is still live, and mints a new one only
 * when there is none or it has expired. It reads as a rotation endpoint, and it
 * was one, but every caller on the team page is a read: "Copy Link" and the
 * email preview both go through here. Rotating on those silently killed the
 * link the super-admin had already pasted into an email minutes earlier — the
 * invite stopped working and nothing said why.
 *
 * It also refuses an account that has already set a password. `invite_token` is
 * the credential `accept-invite` accepts, so minting one for an active admin is
 * a password reset wearing an invite's name — which is exactly the collision
 * the schema keeps `reset_token` separate to avoid.
 */
router.post('/:id/resend-invite', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } })
  if (!target) {
    res.status(404).json({ error: 'Admin user not found' })
    return
  }
  if (target.password_hash) {
    res.status(400).json({ error: 'This admin has already activated their account. Use password reset instead of an invite link.' })
    return
  }

  const liveInvite = target.invite_token && target.invite_expires_at && target.invite_expires_at > new Date()
  const inviteToken = liveInvite ? target.invite_token! : generateInviteToken()

  if (!liveInvite) {
    await prisma.adminUser.update({
      where: { id: target.id },
      data: {
        invite_token: inviteToken,
        invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  }

  const identity = identityOf(req)
  await recordAudit({
    entityType: 'admin_user', entityId: target.id, entityName: target.email,
    action: 'UPDATE', actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
    actorLabel: identity.email, ipAddress: clientIp(req),
    summary: liveInvite
      ? `Retrieved the live invite link for ${target.email}`
      : `Issued a new invite link for ${target.email}`,
  })

  const inviteUrl = `${preferredInviteOrigin(process.env.FRONTEND_URL)}/admin/accept-invite?token=${inviteToken}`
  res.json({ success: true, inviteUrl, email: target.email, rotated: !liveInvite })
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

// DELETE /api/v1/admin/team/:id — remove an admin account or revoke an invitation completely.
router.delete('/:id', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } })
  if (!target) {
    res.status(404).json({ error: 'Admin user not found' })
    return
  }

  const identity = identityOf(req)
  if (target.id === identity.adminUserId) {
    res.status(400).json({ error: 'Cannot delete your own admin account.' })
    return
  }

  // Safety check: Don't delete the last active Super Admin
  if (target.role === 'SUPER_ADMIN' && target.is_active) {
    const activeSuperAdmins = await prisma.adminUser.count({
      where: { role: 'SUPER_ADMIN', is_active: true, id: { not: target.id } },
    })
    if (activeSuperAdmins === 0 && identity.adminUserId !== 'root') {
      res.status(400).json({ error: 'Cannot delete the only remaining active Super Admin.' })
      return
    }
  }

  // Revoke any active sessions first
  await revokeAllSessions(target.id)

  // Delete from database
  await prisma.adminUser.delete({
    where: { id: target.id },
  })

  await recordAudit({
    entityType: 'admin_user',
    entityId: target.id,
    entityName: target.email,
    action: 'DELETE',
    actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
    actorLabel: identity.email,
    ipAddress: clientIp(req),
    summary: `Deleted admin user ${target.email} (${target.role})`,
  })

  res.json({ success: true, message: `Admin ${target.email} was removed successfully.` })
})

export default router
