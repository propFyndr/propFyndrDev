import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAdmin } from '../lib/adminAuth'
import { sendEmail } from '../lib/emailService'
import { checkRateLimit } from '../lib/cache'
import { clientIp } from '../lib/request'

export const adminEmailRouter = Router()

/**
 * Capped at 20 addresses — this endpoint is for inviting a builder or
 * sending one buyer's site-visit confirmation, not a mailing list. A higher
 * ceiling turns an admin session (or a leaked admin token) into a spam relay
 * billed to our Resend account.
 */
const SendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1).max(20)]),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  text: z.string().optional(),
  // Not validated against a fixed allowlist on purpose — Resend rejects any
  // sender address whose domain isn't verified on our account, so a spoofed
  // "from" fails at Resend rather than needing a second check here.
  from: z.string().email().optional(),
  replyTo: z.string().email().optional(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })).max(10).optional(),
})

/**
 * POST /api/v1/admin/email/send
 * Dispatches live transactional or outreach emails via Resend.
 */
adminEmailRouter.post('/send', requireAdmin, async (req: Request, res: Response) => {
  const { allowed } = await checkRateLimit(`admin:email:send:${clientIp(req)}`, 10, 60)
  if (!allowed) {
    res.status(429).json({ ok: false, error: 'Too many emails sent. Please wait a moment.' })
    return
  }

  const parsed = SendEmailSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const { to, subject, html, text, from, replyTo, tags } = parsed.data

  try {
    const result = await sendEmail({ to, subject, html, text, from, replyTo, tags })

    if (!result.ok) {
      res.status(502).json({
        ok: false,
        error: result.error || 'Failed to send email via Resend',
      })
      return
    }

    res.json({
      ok: true,
      id: result.id,
      message: `Email successfully delivered to ${Array.isArray(to) ? to.join(', ') : to}`,
    })
  } catch (err) {
    console.error('[adminEmail:send:ERROR]', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Internal server error' })
  }
})
