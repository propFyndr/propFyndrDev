/**
 * PropFyndr Transactional & Outreach Email Service
 * Powered by Resend API
 */

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  tags?: Array<{ name: string; value: string }>
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
}

const RESEND_API_URL = 'https://api.resend.com/emails'

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  tags,
}: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn('[emailService] No RESEND_API_KEY set; skipping live dispatch.')
    return {
      ok: false,
      error: 'RESEND_API_KEY is not configured',
    }
  }

  const defaultFrom =
    process.env.EMAIL_FROM || 'PropFyndr <onboarding@resend.dev>'
  const sender = from || defaultFrom

  const recipients = Array.isArray(to) ? to : [to]

  try {
    const payload: Record<string, unknown> = {
      from: sender,
      to: recipients,
      subject,
      html,
    }
    if (text) payload.text = text
    if (replyTo) payload.reply_to = replyTo
    if (tags && tags.length > 0) payload.tags = tags

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as any

    if (!response.ok) {
      const errorMsg = data?.message || `Resend HTTP error ${response.status}`
      console.error('[emailService:ERROR]', errorMsg, data)
      return { ok: false, error: errorMsg }
    }

    return { ok: true, id: data?.id }
  } catch (err: any) {
    console.error('[emailService:EXCEPTION]', err)
    return { ok: false, error: err?.message || 'Failed to send email' }
  }
}
