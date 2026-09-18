// backend/src/lib/outboxDispatcher.ts
//
// Drains `notification_outbox` through Resend.
//
// The outbox already existed, and already held the right rows — an invite and a
// password reset both parked a fully-written message there. What it never had
// was anything that sent them: the schema comment said outright that "sent"
// meant a human had sent it, and `adminOutbox.ts` is the screen where that human
// marked rows off by hand. So a password reset link reached nobody unless a
// super admin noticed the queue and copied it out.
//
// This is the missing half, and it is deliberately the ONLY new send path.
// `adminTeam.ts` could have called `sendEmail` directly at invite time, and then
// invites would send while resets still queued, with two templates drifting
// apart. One queue, one dispatcher: every outbound message is a row first, which
// also means a failed send is a row with an error on it rather than a log line
// nobody reads.
//
// No cron, no queue library. Enqueue attempts dispatch immediately and
// unawaited; anything that fails stays `queued` with its error recorded, and
// `POST /admin/outbox/:id/send` retries it. A message that fails twice is a
// configuration problem, and configuration problems want a person, not a
// backoff schedule.
import { prisma } from './db'
import { sendEmail } from './emailService'

/** Matches `NotificationOutbox.template`. Adding one here is a template decision. */
export type OutboxTemplate = 'admin_invite' | 'password_reset' | 'partner_approved'

export interface EnqueueOptions {
  toEmail: string
  template: OutboxTemplate
  subject: string
  /** Plain text. Rendered into HTML by `renderHtml` — write it to read well as either. */
  body: string
  actionUrl?: string | null
  relatedType?: string | null
  relatedId?: string | null
}

/** The label on the button, per template. */
const ACTION_LABEL: Record<OutboxTemplate, string> = {
  admin_invite: 'Set your password',
  password_reset: 'Choose a new password',
  partner_approved: 'Open your portal',
}

/**
 * Minimal, table-free, inline-styled HTML.
 *
 * Deliberately plain: no logo, no tracking pixel, no external stylesheet. These
 * three messages all carry a credential, and a credential email that looks like
 * marketing is the one people report as phishing. It also renders identically
 * everywhere, which a layout would not.
 *
 * The raw URL is repeated under the button because a plain-text client, and a
 * reader who distrusts buttons in an email about a password, both need it.
 */
export function renderHtml(template: OutboxTemplate, body: string, actionUrl?: string | null): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const paragraphs = body
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#1f2937">${escape(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')

  const button = actionUrl
    ? `<p style="margin:24px 0">
         <a href="${escape(actionUrl)}"
            style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;
                   text-decoration:none;border-radius:6px;font-weight:600">
           ${ACTION_LABEL[template]}
         </a>
       </p>
       <p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all">
         Or paste this into your browser:<br>${escape(actionUrl)}
       </p>`
    : ''

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                      max-width:560px;margin:0 auto;padding:32px 24px;font-size:15px">
            ${paragraphs}
            ${button}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px">
            <p style="margin:0;font-size:12px;color:#9ca3af">
              PropFyndr — sent because someone requested it for this address.
            </p>
          </div>`
}

/**
 * Sends one queued row and records the outcome.
 *
 * Returns false rather than throwing: a failed email must never fail the request
 * that triggered it. An invite whose email bounced is still a valid invite — the
 * link is returned to the caller either way, which is why the manual copy path
 * in the admin UI stays useful rather than becoming vestigial.
 */
export async function dispatchOutboxMessage(id: string): Promise<boolean> {
  const message = await prisma.notificationOutbox.findUnique({ where: { id } })
  if (!message) return false
  if (message.status === 'sent' || message.status === 'cancelled') return false
  if (message.channel !== 'email' || !message.to_email) {
    // SMS is in the schema and has no sender. Leave it queued for a human
    // rather than marking it failed for a channel we never attempted.
    return false
  }

  const result = await sendEmail({
    to: message.to_email,
    subject: message.subject || 'PropFyndr',
    html: renderHtml(message.template as OutboxTemplate, message.body, message.action_url),
    text: message.action_url ? `${message.body}\n\n${message.action_url}` : message.body,
    tags: [{ name: 'template', value: message.template }],
  })

  await prisma.notificationOutbox.update({
    where: { id: message.id },
    data: result.ok
      ? { status: 'sent', sent_at: new Date(), sent_by: 'system', error: null }
      : { status: 'queued', error: (result.error || 'Send failed').slice(0, 500) },
  })

  if (!result.ok) {
    console.error(`[outbox] ${message.template} to ${message.to_email} failed: ${result.error}`)
  }
  return result.ok
}

/**
 * Parks a message and tries to send it.
 *
 * The row is written before the send is attempted, so a crash mid-send leaves a
 * queued row a human can see — never a message that was attempted and left no
 * trace. Returns the row id and whether it went out; callers surface `emailed`
 * so the UI can say "sent" or "copy this link" honestly instead of guessing.
 */
export async function enqueueAndSend(opts: EnqueueOptions): Promise<{ id: string; emailed: boolean }> {
  const row = await prisma.notificationOutbox.create({
    data: {
      channel: 'email',
      to_email: opts.toEmail,
      template: opts.template,
      subject: opts.subject,
      body: opts.body,
      action_url: opts.actionUrl ?? null,
      related_type: opts.relatedType ?? null,
      related_id: opts.relatedId ?? null,
    },
    select: { id: true },
  })

  const emailed = await dispatchOutboxMessage(row.id).catch((err) => {
    console.error('[outbox] dispatch threw:', err)
    return false
  })

  return { id: row.id, emailed }
}
