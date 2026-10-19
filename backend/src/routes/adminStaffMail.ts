// backend/src/routes/adminStaffMail.ts
//
// Super-admin-only: staff @realtyask.in mailboxes, managed from /admin/team.
// Mounted under /admin/team/mailboxes so adminPolicy's `/team` rule covers it too.
//
// Internal staff only. This route has no notion of builders or partners, and the
// UI offers it only for SUPER_ADMIN / ANALYST / SALES: outside people never get a
// company mailbox. The generated password is returned once, in the response to
// the request that created or reset it, and is stored nowhere on our side.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireIdentity, requireRole, recordAudit } from '../lib/adminIdentity'
import type { AdminIdentitySession } from '../lib/adminIdentity'
import { checkRateLimit } from '../lib/cache'
import { clientIp } from '../lib/request'
import {
  RealtyMailError, isRealtyMailConfigured, listAccounts, createAccount, resetPassword, setDisabled,
} from '../lib/realtyMailClient'

const router = Router()
const MAIL_DOMAIN = 'realtyask.in'

router.use(requireIdentity, requireRole('SUPER_ADMIN'))

function identityOf(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

async function audit(req: Request, entityId: string, entityName: string, action: string, summary: string) {
  const identity = identityOf(req)
  await recordAudit({
    entityType: 'staff_mailbox', entityId, entityName, action,
    actorAdminId: identity.adminUserId === 'root' ? null : identity.adminUserId,
    actorLabel: identity.email, ipAddress: clientIp(req), summary,
  })
}

function fail(res: Response, err: unknown) {
  if (err instanceof RealtyMailError) {
    res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({ error: err.message })
    return
  }
  console.error('[adminStaffMail]', err instanceof Error ? err.message : err)
  res.status(500).json({ error: 'Could not reach the mail service' })
}

/** Each write is a real account change on the mail server, so cap how fast one admin can fire them. */
async function throttled(req: Request, res: Response): Promise<boolean> {
  const { allowed } = await checkRateLimit(`admin:staffmail:${identityOf(req).adminUserId}`, 20, 60)
  if (!allowed) res.status(429).json({ error: 'Too many mailbox changes. Wait a minute.' })
  return !allowed
}

// GET /api/v1/admin/team/mailboxes
router.get('/', async (_req: Request, res: Response) => {
  if (!isRealtyMailConfigured()) {
    res.json({ configured: false, domain: MAIL_DOMAIN, accounts: [] })
    return
  }
  try {
    res.json({ configured: true, domain: MAIL_DOMAIN, accounts: await listAccounts() })
  } catch (err) {
    fail(res, err)
  }
})

const createSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, 'Use letters, numbers, dot, dash or underscore'),
  name: z.string().trim().min(1).max(100).optional(),
})

// POST /api/v1/admin/team/mailboxes — create a regular-user mailbox and return its one-time password.
router.post('/', async (req: Request, res: Response) => {
  if (await throttled(req, res)) return
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input' })
    return
  }
  try {
    const { account, password } = await createAccount({ ...parsed.data, hostname: MAIL_DOMAIN })
    await audit(req, account.id, account.email, 'CREATE', `Created staff mailbox ${account.email}`)
    res.status(201).json({ account, password, webmailUrl: 'https://mail.realtyask.in' })
  } catch (err) {
    fail(res, err)
  }
})

// POST /api/v1/admin/team/mailboxes/:id/reset-password
router.post('/:id/reset-password', async (req: Request, res: Response) => {
  if (await throttled(req, res)) return
  try {
    const password = await resetPassword(req.params.id)
    await audit(req, req.params.id, req.params.id, 'UPDATE', 'Reset a staff mailbox password')
    res.json({ password })
  } catch (err) {
    fail(res, err)
  }
})

// PATCH /api/v1/admin/team/mailboxes/:id — disable (offboard) or re-enable.
router.patch('/:id', async (req: Request, res: Response) => {
  if (await throttled(req, res)) return
  const parsed = z.object({ disabled: z.boolean() }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    await setDisabled(req.params.id, parsed.data.disabled)
    await audit(req, req.params.id, req.params.id, 'UPDATE', parsed.data.disabled ? 'Disabled a staff mailbox' : 'Re-enabled a staff mailbox')
    res.json({ ok: true })
  } catch (err) {
    fail(res, err)
  }
})

export default router
