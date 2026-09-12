// backend/src/routes/adminOutbox.ts
//
// The manual send queue. Super-admin only.
//
// Until an email/SMS provider is configured, every notification the product
// wants to send is queued in NotificationOutbox and dispatched by hand from
// here. `action_url` on a row is a one-time credential — anyone holding an
// invite or reset link can set that account's password — which is why this
// router is SUPER_ADMIN and nothing else.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireIdentity, requireRole, recordAudit } from '../lib/adminIdentity'
import type { AdminIdentitySession } from '../lib/adminIdentity'

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

export default router
