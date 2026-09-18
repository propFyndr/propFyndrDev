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
import { preferredInviteOrigin, sendInviteEmail, INVITE_TTL_MS } from '../lib/adminInvite'

const router = Router()

function identityOf(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

// Re-exported: `preferredInviteOrigin` moved to lib/adminInvite.ts when builder
// application approval became a second caller. Kept exported here so the
// existing test import path stays valid.
export { preferredInviteOrigin }

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

/**
 * GET /api/v1/admin/team — admin accounts.
 *
 * `?builder_id=` / `?partner_id=` narrow it to one organisation, which is what
 * the Access panel on a builder or partner detail page reads. Managing access
 * from the organisation is the way people actually think about it — "who at
 * Lotus can sign in" — where the global Team page makes you invite someone and
 * then pick their builder out of a dropdown, which is the question backwards.
 *
 * A filter rather than two new endpoints: the shape, the guard and the
 * invite-token redaction below are identical, and a second copy of this handler
 * would be a second place to forget that `invite_token` is a bearer credential.
 *
 * `AdminUser.builder_id` is not unique, so an organisation can have as many
 * admins as it needs. No seat concept is implied by this.
 */
router.get('/', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const builderId = typeof req.query.builder_id === 'string' ? req.query.builder_id : undefined
  const partnerId = typeof req.query.partner_id === 'string' ? req.query.partner_id : undefined

  const where = builderId ? { builder_id: builderId } : partnerId ? { partner_id: partnerId } : {}

  const admins = await prisma.adminUser.findMany({
    where,
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

// POST /api/v1/admin/team/invite — create a pending admin and email them a link.
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
      invite_expires_at: new Date(Date.now() + INVITE_TTL_MS),
      is_active: true,
    },
  })

  await recordAudit({
    entityType: 'admin_user', entityId: admin.id, entityName: admin.email,
    action: 'CREATE', actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
    actorLabel: identity.email, ipAddress: clientIp(req),
    summary: `Invited ${admin.email} as ${role}`,
  })

  const inviteUrl = `${preferredInviteOrigin(process.env.FRONTEND_URL)}/admin/accept-invite?token=${inviteToken}`
  const { emailed } = await sendInviteEmail(admin.email, admin.role, inviteUrl, admin.id)

  // `inviteUrl` is returned whether or not the email went out, and the UI shows
  // it either way. Resend refuses any sender whose domain is unverified, so the
  // first invite sent from a new environment is the one most likely to fail —
  // exactly the moment someone needs the link in their hand. `emailed` tells the
  // UI which sentence to show; it never gates handing over the link.
  res.json({ admin: { id: admin.id, email: admin.email, role: admin.role }, inviteUrl, emailed })
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

/**
 * Same rule as `adminAuthFlows.PasswordSchema`. It was `min(8)` here while
 * reset and change both required 12, so the invite path — the one every new
 * account goes through — was the weakest of the three.
 */
const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(200, 'Password must be under 200 characters'),
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

  /**
   * Consumed atomically, in one statement.
   *
   * This was a read, a validity check, then a write. Two requests carrying the
   * same token could both pass the check before either cleared it, and both
   * would set a password — so a link that was meant to be single-use was
   * single-use only when nobody raced it. `updateMany` with the conditions in
   * the WHERE makes the database decide: the first request matches one row, the
   * second matches none.
   *
   * `is_active` is in the condition too. A revoked account that still carried a
   * live invite could previously set a password and walk back in, which made
   * revocation conditional on nobody having a pending link.
   */
  const consumed = await prisma.adminUser.updateMany({
    where: {
      invite_token: token,
      invite_expires_at: { gt: new Date() },
      is_active: true,
    },
    data: {
      password_hash: hashPassword(password),
      // Stamped so any session predating this moment is treated as revoked,
      // the same rule a password reset follows.
      password_changed_at: new Date(),
      invite_token: null,
      invite_expires_at: null,
      // An invite proves control of the mailbox, which is what a pending reset
      // was waiting for. Leaving one live would keep a second way in.
      reset_token: null,
      reset_expires_at: null,
    },
  })

  // One message for expired, already-used, unknown and deactivated. An
  // accept-invite form is a place to guess tokens, and distinguishing the cases
  // helps only the guesser.
  if (consumed.count === 0) {
    res.status(400).json({ error: 'That invite link is invalid, already used, or has expired. Ask for a new one.' })
    return
  }

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
        invite_expires_at: new Date(Date.now() + INVITE_TTL_MS),
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
  const { emailed } = await sendInviteEmail(target.email, target.role, inviteUrl, target.id)

  res.json({ success: true, inviteUrl, email: target.email, rotated: !liveInvite, emailed })
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
