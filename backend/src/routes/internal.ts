/**
 * Machine-to-machine endpoints for the Make.com lead automation.
 *
 * These are not admin routes. Admin auth is a Redis-TTL session UUID
 * (lib/adminAuth.ts) issued to a browser at login — an automation platform has
 * no way to hold one, which is why the stale-lead chaser could not be built in
 * Make alone. This router is guarded instead by a single static key that only
 * the scheduler knows.
 *
 * Nothing here exposes buyer data beyond what the lead alert already carries,
 * and nothing here mutates a lead's own state: the chaser records that a lead
 * was escalated, never that it was contacted. Only a human moves a lead status.
 */
import { Router, Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'
import { prisma } from '../lib/db'
import { replayDeadLetters } from '../lib/webhook'

const router = Router()

/** Default age at which an untouched lead is considered ignored. */
const DEFAULT_STALE_HOURS = 2
const MAX_ROWS = 100

function keysMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  return a.length === b.length && timingSafeEqual(a, b)
}

function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTERNAL_API_KEY
  // An unset key closes the door; it never opens it. A deployment that forgot
  // the variable must not expose the lead queue to anyone who finds the path.
  if (!expected) {
    console.error('[internal] INTERNAL_API_KEY is not set — internal endpoints are disabled.')
    res.status(503).json({ error: 'Internal API not configured' })
    return
  }

  const provided = req.headers['x-internal-key']
  if (typeof provided !== 'string' || !keysMatch(provided, expected)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

router.use(requireInternalKey)

/**
 * GET /api/v1/internal/stale-leads?hours=2
 *
 * Leads that came in, were never moved off their opening status, and have not
 * already been escalated. Returns each lead once: the caller acknowledges what
 * it actually alerted on, so a scheduler that crashes mid-run re-reads the same
 * rows on its next poll instead of losing them.
 */
router.get('/stale-leads', async (req: Request, res: Response) => {
  const parsedHours = Number(req.query.hours)
  const hours = Number.isFinite(parsedHours) && parsedHours > 0 ? Math.min(parsedHours, 720) : DEFAULT_STALE_HOURS
  const cutoff = new Date(Date.now() - hours * 3600_000)

  try {
    const [callbacks, siteVisits] = await Promise.all([
      prisma.callbackRequest.findMany({
        where: { status: 'new', chased_at: null, created_at: { lt: cutoff } },
        orderBy: { created_at: 'asc' },
        take: MAX_ROWS,
        select: {
          id: true, name: true, phone: true, project_name: true,
          lead_score: true, lead_tier: true, created_at: true,
        },
      }),
      prisma.siteVisitRequest.findMany({
        where: { status: 'pending', chased_at: null, created_at: { lt: cutoff } },
        orderBy: { created_at: 'asc' },
        take: MAX_ROWS,
        select: {
          id: true, name: true, phone: true, project_name: true,
          visit_date: true, time_slot: true, created_at: true,
        },
      }),
    ])

    const hoursWaiting = (d: Date) => Math.floor((Date.now() - d.getTime()) / 3600_000)

    res.json({
      stale_after_hours: hours,
      count: callbacks.length + siteVisits.length,
      callbacks: callbacks.map((c) => ({ ...c, hours_waiting: hoursWaiting(c.created_at) })),
      site_visits: siteVisits.map((s) => ({ ...s, hours_waiting: hoursWaiting(s.created_at) })),
    })
  } catch (err) {
    // An empty list and a broken query must not look the same to a scheduler
    // whose whole job is noticing that nothing happened.
    console.error('[internal] stale-leads query failed:', err)
    res.status(500).json({ error: 'Failed to fetch stale leads' })
  }
})

/**
 * POST /api/v1/internal/stale-leads/ack  { callback_ids: [], site_visit_ids: [] }
 *
 * Called after the alert has actually gone out. Marks those leads escalated so
 * the next poll does not alert on them again. This is deliberately a second
 * call: marking them on read would silently drop an escalation whenever the
 * scheduler failed between fetching and sending.
 */
router.post('/stale-leads/ack', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { callback_ids?: unknown; site_visit_ids?: unknown }
  const callbackIds = Array.isArray(body.callback_ids)
    ? body.callback_ids.filter((i): i is string => typeof i === 'string')
    : []
  const siteVisitIds = Array.isArray(body.site_visit_ids)
    ? body.site_visit_ids.filter((i): i is string => typeof i === 'string')
    : []

  if (!callbackIds.length && !siteVisitIds.length) {
    res.status(400).json({ error: 'Provide callback_ids and/or site_visit_ids' })
    return
  }

  try {
    const now = new Date()
    const [callbacks, siteVisits] = await Promise.all([
      callbackIds.length
        ? prisma.callbackRequest.updateMany({ where: { id: { in: callbackIds } }, data: { chased_at: now } })
        : Promise.resolve({ count: 0 }),
      siteVisitIds.length
        ? prisma.siteVisitRequest.updateMany({ where: { id: { in: siteVisitIds } }, data: { chased_at: now } })
        : Promise.resolve({ count: 0 }),
    ])
    res.json({ acknowledged: callbacks.count + siteVisits.count })
  } catch (err) {
    console.error('[internal] stale-leads ack failed:', err)
    res.status(500).json({ error: 'Failed to acknowledge leads' })
  }
})

/**
 * GET /api/v1/internal/dead-letters — alerts the webhook receiver never took.
 * Read-only; the replay endpoint is what actually resends them.
 */
router.get('/dead-letters', async (_req: Request, res: Response) => {
  try {
    const [rows, total] = await Promise.all([
      prisma.webhookDeadLetter.findMany({
        where: { replayed_at: null },
        orderBy: { created_at: 'asc' },
        take: MAX_ROWS,
        select: { id: true, event: true, error: true, attempts: true, created_at: true },
      }),
      prisma.webhookDeadLetter.count({ where: { replayed_at: null } }),
    ])
    res.json({ total_unreplayed: total, rows })
  } catch (err) {
    console.error('[internal] dead-letters query failed:', err)
    res.status(500).json({ error: 'Failed to fetch dead letters' })
  }
})

/**
 * POST /api/v1/internal/dead-letters/replay
 *
 * Re-fires parked alerts through the normal sender, so they arrive as ordinary
 * events and hit the same Make.com router as everything else. Polled on a
 * schedule, this makes a receiver outage self-healing: nothing to press.
 */
router.post('/dead-letters/replay', async (_req: Request, res: Response) => {
  try {
    const result = await replayDeadLetters()
    res.json(result)
  } catch (err) {
    console.error('[internal] dead-letter replay failed:', err)
    res.status(500).json({ error: 'Failed to replay dead letters' })
  }
})

export default router
