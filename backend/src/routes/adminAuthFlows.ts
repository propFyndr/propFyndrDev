// backend/src/routes/adminAuthFlows.ts
//
// Forgot / reset / change password for admin, builder and partner accounts.
//
// Mounted at /api/v1/admin/auth-flows. The forgot and reset endpoints are in
// adminGuard's public list because a person who has lost their password has no
// session by definition; `change` requires one.
//
// No email or SMS provider is configured yet, so nothing here sends anything.
// Every message is written to NotificationOutbox and dispatched by hand from
// the admin panel — see that model's comment for why that is a deliberate
// interim state rather than a gap.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { prisma } from '../lib/db'
import { checkRateLimit } from '../lib/cache'
import {
  requireIdentity,
  hashPassword,
  verifyPassword,
  revokeAllSessions,
  recordAudit,
} from '../lib/adminIdentity'
import type { AdminIdentitySession } from '../lib/adminIdentity'

const router = Router()

/** One hour. Long enough to act on by hand, short enough to matter if leaked. */
const RESET_TTL_MS = 60 * 60 * 1000

/**
 * Minimum password rules. Deliberately length-first rather than a character
 * class puzzle: length is what actually resists guessing, and complexity rules
 * push people toward `Passw0rd!` and a sticky note.
 */
const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(200, 'Password must be under 200 characters')

function identityOf(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

function frontendOrigin(): string {
  const raw = process.env.FRONTEND_URL || 'http://localhost:3000'
  return raw.split(',')[0].trim().replace(/\/$/, '')
}

// ── POST /forgot ─────────────────────────────────────────────────────────────
// Public. Always answers the same way.
router.post('/forgot', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown'
  const { allowed } = await checkRateLimit(`admin:forgot:${ip}`, 5, 900)
  if (!allowed) {
    res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' })
    return
  }

  const parsed = z.object({ email: z.string().email() }).strict().safeParse(req.body)
  // An invalid email and an unknown one get the same answer, for the same
  // reason: this endpoint must never reveal whether an account exists.
  const generic = {
    ok: true,
    message: 'If that email has an account, a reset link has been prepared for it.',
  }
  if (!parsed.success) {
    res.json(generic)
    return
  }

  const email = parsed.data.email.trim().toLowerCase()
  const admin = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, email: true, is_active: true, role: true },
  })

  if (admin && admin.is_active) {
    const token = randomBytes(32).toString('hex')
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { reset_token: token, reset_expires_at: new Date(Date.now() + RESET_TTL_MS) },
    })

    const url = `${frontendOrigin()}/admin/reset-password?token=${token}`
    await prisma.notificationOutbox.create({
      data: {
        channel: 'email',
        to_email: admin.email,
        template: 'password_reset',
        subject: 'Reset your PropFyndr password',
        body:
          `A password reset was requested for ${admin.email}.\n\n` +
          `Open this link to set a new password. It expires in one hour:\n${url}\n\n` +
          `If you did not request this, ignore this message — the password is unchanged.`,
        action_url: url,
        related_type: 'admin_user',
        related_id: admin.id,
      },
    })
  }

  res.json(generic)
})

// ── POST /reset ──────────────────────────────────────────────────────────────
// Public. Consumes a reset token and sets the password.
router.post('/reset', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown'
  const { allowed } = await checkRateLimit(`admin:reset:${ip}`, 10, 900)
  if (!allowed) {
    res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' })
    return
  }

  const parsed = z
    .object({ token: z.string().min(32), password: PasswordSchema })
    .strict()
    .safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  const admin = await prisma.adminUser.findUnique({
    where: { reset_token: parsed.data.token },
    select: { id: true, email: true, is_active: true, reset_expires_at: true },
  })
  // One message for expired, unknown and deactivated: a reset form is a place
  // to guess tokens, and distinguishing the cases helps only the guesser.
  if (!admin || !admin.is_active || !admin.reset_expires_at || admin.reset_expires_at < new Date()) {
    res.status(400).json({ error: 'That reset link is invalid or has expired. Request a new one.' })
    return
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      password_hash: hashPassword(parsed.data.password),
      password_changed_at: new Date(),
      reset_token: null,
      reset_expires_at: null,
      // A reset proves control of the mailbox, which is what an invite was
      // waiting for. Leaving it live would keep a second way in.
      invite_token: null,
      invite_expires_at: null,
    },
  })

  const revoked = await revokeAllSessions(admin.id)
  await recordAudit({
    entityType: 'admin_user',
    entityId: admin.id,
    entityName: admin.email,
    action: 'password_reset',
    actorAdminId: admin.id,
    actorLabel: admin.email,
    ipAddress: req.ip,
    summary: `Password reset via emailed link; ${revoked} session(s) ended`,
  })

  res.json({ ok: true, message: 'Password updated. Sign in with your new password.' })
})

// ── POST /change ─────────────────────────────────────────────────────────────
// Requires a session, and the current password.
router.post('/change', requireIdentity, async (req: Request, res: Response) => {
  const identity = identityOf(req)
  if (identity.adminUserId === 'root') {
    // The shared ADMIN_PASSWORD bootstrap login has no AdminUser row to update.
    res.status(400).json({
      error: 'The shared admin login has no per-user password. Change ADMIN_PASSWORD in the environment instead.',
    })
    return
  }

  const parsed = z
    .object({ current_password: z.string().min(1), new_password: PasswordSchema })
    .strict()
    .safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: identity.adminUserId },
    select: { id: true, email: true, password_hash: true },
  })
  if (!admin?.password_hash || !verifyPassword(parsed.data.current_password, admin.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect' })
    return
  }
  if (parsed.data.current_password === parsed.data.new_password) {
    res.status(400).json({ error: 'The new password must be different from the current one' })
    return
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      password_hash: hashPassword(parsed.data.new_password),
      password_changed_at: new Date(),
    },
  })

  // Every session, including this one. Changing a password because it may be
  // known to someone else and leaving their session alive defeats the point;
  // the caller signs in again.
  const revoked = await revokeAllSessions(admin.id)
  await recordAudit({
    entityType: 'admin_user',
    entityId: admin.id,
    entityName: admin.email,
    action: 'password_change',
    actorAdminId: admin.id,
    actorLabel: admin.email,
    ipAddress: req.ip,
    summary: `Password changed; ${revoked} session(s) ended`,
  })

  res.json({ ok: true, message: 'Password updated. Please sign in again.' })
})

export default router
