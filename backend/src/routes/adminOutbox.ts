// backend/src/routes/adminOutbox.ts
//
// The send queue. Super-admin only.
//
// Every notification the product wants to send is a NotificationOutbox row
// first. `outboxDispatcher` sends it through Resend on creation; this screen is
// where a super admin sees what failed, retries it (POST /:id/send), or marks it
// off by hand when it was delivered some other way.
//
// `action_url` on a row is a one-time credential — anyone holding an invite or
// reset link can set that account's password — which is why this router is
// SUPER_ADMIN and nothing else.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireIdentity, requireRole, recordAudit } from '../lib/adminIdentity'
import type { AdminIdentitySession } from '../lib/adminIdentity'
import { dispatchOutboxMessage } from '../lib/outboxDispatcher'

const router = Router()

function identityOf(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

const STATUSES = ['queued', 'sent', 'failed', 'cancelled'] as const

// GET / — the queue, newest first.
router.get('/', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' && req.query.status !== 'ALL' ? req.query.status : undefined
  const [messages, queuedCount] = await Promise.all([
    prisma.notificationOutbox.findMany({
      where: status ? { status } : {},
      orderBy: { created_at: 'desc' },
      take: 200,
    }),
    prisma.notificationOutbox.count({ where: { status: 'queued' } }),
  ])
  res.json({ messages, queuedCount })
})

// PATCH /:id — mark one as sent, failed or cancelled after handling it.
router.patch('/:id', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const parsed = z
    .object({ status: z.enum(STATUSES), error: z.string().max(500).nullable().optional() })
    .strict()
    .safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.issues })
    return
  }

  const identity = identityOf(req)
  const existing = await prisma.notificationOutbox.findUnique({
    where: { id: req.params.id },
    select: { id: true, to_email: true, template: true },
  })
  if (!existing) {
    res.status(404).json({ error: 'Message not found' })
    return
  }

  const message = await prisma.notificationOutbox.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      error: parsed.data.error ?? null,
      // Only a real send records who and when; cancelling is not sending.
      sent_at: parsed.data.status === 'sent' ? new Date() : null,
      sent_by: parsed.data.status === 'sent' ? identity.email : null,
    },
  })

  await recordAudit({
    entityType: 'notification',
    entityId: message.id,
    entityName: `${existing.template} → ${existing.to_email ?? 'unknown'}`,
    action: `outbox:${parsed.data.status}`,
    actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
    actorLabel: identity.email,
    ipAddress: req.ip,
    summary: `Marked ${existing.template} notification as ${parsed.data.status}`,
  })

  res.json({ message })
})

/**
 * POST /:id/send — actually send a queued message.
 *
 * The retry, for a row whose first automatic attempt failed. Separate from
 * PATCH on purpose: PATCH records what a human did outside the system, this one
 * performs the send. Collapsing them would make "mark as sent" ambiguous
 * between "I sent this from my own inbox" and "the system sent it", and the
 * audit trail needs those distinguishable.
 */
router.post('/:id/send', requireIdentity, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const existing = await prisma.notificationOutbox.findUnique({
    where: { id: req.params.id },
    select: { id: true, to_email: true, template: true, status: true },
  })
  if (!existing) {
    res.status(404).json({ error: 'Message not found' })
    return
  }
  if (existing.status === 'sent') {
    res.status(400).json({ error: 'This message has already been sent.' })
    return
  }
  if (existing.status === 'cancelled') {
    res.status(400).json({ error: 'This message was cancelled. Re-issue the invite or reset instead.' })
    return
  }

  const sent = await dispatchOutboxMessage(existing.id)
  const message = await prisma.notificationOutbox.findUnique({ where: { id: existing.id } })

  const identity = identityOf(req)
  await recordAudit({
    entityType: 'notification',
    entityId: existing.id,
    entityName: `${existing.template} → ${existing.to_email ?? 'unknown'}`,
    action: sent ? 'outbox:sent' : 'outbox:send_failed',
    actorAdminId: identity.adminUserId,
    actorLabel: identity.email,
    ipAddress: req.ip,
    summary: sent
      ? `Sent ${existing.template} notification to ${existing.to_email}`
      : `Send failed for ${existing.template} notification to ${existing.to_email}`,
  })

  res.status(sent ? 200 : 502).json({ sent, message })
})

export default router
