import { prisma } from './db'

/**
 * Outbound lead webhook — one sender for every event Make.com consumes.
 *
 * Previously three routes (leads, builderRegistration, partnerRegistration)
 * each carried their own copy of this function, and they had drifted: only the
 * leads copy flattened the payload to the root, so a Make.com mapping that
 * worked for a callback silently produced empty cells for a builder or partner
 * application. One sender, one payload shape.
 *
 * Wire format: { event, data: {...}, ...data, ts }. `data` is the contract;
 * the flattened copy at the root exists for direct Google Sheets column mapping.
 */

/** Events Make.com routes on. Adding one here is a routing decision, not a detail. */
export type WebhookEvent =
  | 'callback_requested'
  | 'site_visit_requested'
  | 'builder_application_submitted'
  | 'partner_application_submitted'

/**
 * "2, 3, 4" from a project's unit types.
 *
 * Project has no `bhk` column — the configurations live on UnitType. Both lead
 * payloads read `project.bhk`, which is therefore always null, so every lead
 * alert has shipped without the single fact a salesperson asks first.
 */
export function bhkLabel(unitTypes: Array<{ bhk?: number | null }> | null | undefined): string | null {
  const bhks = [...new Set((unitTypes ?? []).map((u) => u.bhk).filter((b): b is number => typeof b === 'number'))]
  return bhks.length ? bhks.sort((a, b) => a - b).join(', ') : null
}

/**
 * The fields Make.com maps for each event.
 *
 * This is the contract the drift broke: `site_visit_requested` stopped sending
 * `lead_score`, `sector` and `price_range`, the Gmail template kept reading
 * them, and every site visit alert rendered blank rows for months with nothing
 * failing. A missing key is logged loudly here rather than discovered in an
 * inbox. Adding a field to a template means adding it to this list.
 */
const REQUIRED_FIELDS: Record<WebhookEvent, string[]> = {
  callback_requested: ['name', 'phone', 'project_name', 'sector', 'price_range', 'bhk', 'lead_score', 'lead_tier', 'ai_summary'],
  site_visit_requested: ['name', 'phone', 'project_name', 'visit_date', 'time_slot', 'sector', 'price_range', 'bhk', 'lead_score', 'lead_tier'],
  builder_application_submitted: ['application_id', 'company_name', 'email', 'phone'],
  partner_application_submitted: ['partner_id', 'partner_name', 'builder_name', 'email', 'phone'],
}

/** Absent key, not a null value: a null sector is a fact, a missing one is a bug. */
export function missingFields(event: WebhookEvent, data: Record<string, unknown>): string[] {
  return REQUIRED_FIELDS[event].filter((f) => !(f in data))
}

export async function fireWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>,
  // Off when replaying a parked alert — otherwise a failed replay would park a
  // second copy of a row that is already parked.
  opts: { park?: boolean } = {},
): Promise<void> {
  const { park = true } = opts
  // Never send test suite runs to live webhooks / Make.com
  if (process.env.NODE_ENV === 'test') return

  const url = process.env.WEBHOOK_URL
  if (!url) {
    console.error(`[webhook] ⚠️ WEBHOOK_URL not configured — ${event} was not sent.`)
    return
  }

  // Never block a lead on a contract violation — log it and send what we have.
  const missing = missingFields(event, data)
  if (missing.length) {
    console.error(`[webhook] ⚠️ ${event} is missing mapped fields: ${missing.join(', ')} — the alert will render blank rows.`)
  }

  // Flatten data at root for Make.com / Google Sheets direct field mapping compatibility
  const body = JSON.stringify({ event, data, ...data, ts: Date.now() })

  // Sign the payload so the receiver can verify it actually came from us.
  const secret = process.env.WEBHOOK_SECRET
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) {
    const { createHmac } = await import('crypto')
    headers['X-Signature'] = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  }

  // One retry on failure — leads are the revenue event; don't drop them silently.
  let lastError = 'receiver rejected the payload'
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) })
      if (res.ok) return
      lastError = `HTTP ${res.status}`
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  if (park) await deadLetter(event, data, lastError)
  throw new Error(`[webhook] ${event} failed after 2 attempts: ${lastError}${park ? ' — dead-lettered' : ''}`)
}

/**
 * Park an undelivered alert for replay.
 *
 * The lead itself is already committed to its own table, so nothing a buyer
 * typed is lost here. What is lost without this is the alert, and with it the
 * response time that wins the buyer — a Make.com outage used to mean a lead
 * sitting in the database with nobody told, discovered whenever someone next
 * opened the admin panel.
 */
async function deadLetter(event: WebhookEvent, data: Record<string, unknown>, error: string): Promise<void> {
  try {
    await prisma.webhookDeadLetter.create({
      data: { event, payload: data as object, error: error.slice(0, 500), attempts: 2 },
    })
  } catch (e) {
    // Last line of defence: if even the database is unavailable, the payload
    // goes to the log rather than nowhere.
    console.error(`[webhook] ⚠️ dead-letter write failed for ${event}. Payload:`, JSON.stringify(data), e)
  }
}

/**
 * Re-send parked alerts, oldest first. Returns how many the receiver accepted.
 *
 * Called by the internal replay endpoint, which Make.com polls — so a receiver
 * outage heals itself the moment the receiver is back, with no manual step.
 */
export async function replayDeadLetters(limit = 25): Promise<{ replayed: number; failed: number }> {
  const parked = await prisma.webhookDeadLetter.findMany({
    where: { replayed_at: null },
    orderBy: { created_at: 'asc' },
    take: limit,
  })

  let replayed = 0
  let failed = 0
  for (const row of parked) {
    try {
      await fireWebhook(row.event as WebhookEvent, row.payload as Record<string, unknown>, { park: false })
      await prisma.webhookDeadLetter.update({ where: { id: row.id }, data: { replayed_at: new Date() } })
      replayed++
    } catch {
      // Count the attempt on the existing row and stop — if the receiver is
      // still down, the rest of the batch will fail too.
      await prisma.webhookDeadLetter.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } })
      failed++
      break
    }
  }
  return { replayed, failed }
}
