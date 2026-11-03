import express, { Request, Response } from 'express'
import { prisma } from '../lib/db'
import { z } from 'zod'
import { verifyUser } from '../lib/auth'
import { isBotRequest, isWebsiteGuestToken } from '../lib/botDetection'

const router = express.Router()

// POST /api/v1/analytics/engagement
const EngagementSchema = z.object({
  session_id: z.string().optional(),
  event: z.string(),
  project_id: z.string().optional(),
  drop_off_stage: z.string().optional(),
  idle_seconds: z.number().optional(),
})

router.post('/engagement', async (req: Request, res: Response) => {
  try {
    const parsed = EngagementSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.errors })
      return
    }
    const data = parsed.data
    
    // Check if the chat analytics record exists
    const chatAnalytics = await prisma.chatAnalytics.findFirst({
      where: { session_id: data.session_id }
    })

    if (!chatAnalytics && data.session_id) {
      // If no analytics record exists yet, we should create it if the session exists
      const sessionExists = await prisma.chatSession.findUnique({
        where: { id: data.session_id },
        select: { id: true }
      })

      if (sessionExists) {
        try {
          await prisma.chatAnalytics.create({
            data: {
              session_id: data.session_id,
              chat_started_at: new Date(),
            }
          })
        } catch (err) {
          console.warn(`[analytics/engagement] Could not create ChatAnalytics for session ${data.session_id}`)
        }
      } else {
        console.warn(`[analytics/engagement] Session ${data.session_id} does not exist yet. Skipping analytics creation.`)
      }
    }

    if (data.event === 'drop_off') {
      await prisma.chatAnalytics.updateMany({
        where: { session_id: data.session_id },
        data: {
          drop_off_at: new Date(),
          drop_off_stage: data.drop_off_stage || 'unknown',
          idle_seconds_before_drop_off: data.idle_seconds || 0,
        }
      })
      console.log(`[analytics] Drop-off recorded for session ${data.session_id} at stage ${data.drop_off_stage}`)
    } else if (data.event === 'first_engagement') {
      await prisma.chatAnalytics.updateMany({
        where: { session_id: data.session_id },
        data: { first_engagement_at: new Date() }
      })
      if (data.project_id && data.session_id) {
        // Also record a property event if project_id is provided
        await prisma.propertyEvent.create({
          data: {
            session_id: data.session_id,
            project_id: data.project_id,
            action: 'first_engagement',
          }
        })
      }
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('[analytics/engagement]', err)
    res.status(400).json({ error: 'Invalid payload' })
  }
})

// POST /api/v1/analytics/promotions
const PromotionsSchema = z.object({
  action: z.enum(['impression', 'click']),
  promotional_id: z.string(),
  session_id: z.string(),
  user_id: z.string().optional(),
  guest_token: z.string().optional(),
})

router.post('/promotions', async (req: Request, res: Response) => {
  try {
    const data = PromotionsSchema.parse(req.body)
    console.log(`[analytics] Promotion ${data.action} for ${data.promotional_id} in session ${data.session_id}`)
    res.status(200).json({ success: true })
  } catch (err) {
    console.error('[analytics/promotions]', err)
    res.status(400).json({ error: 'Invalid payload' })
  }
})

// POST /api/v1/analytics/property-event
const PropertyEventSchema = z.object({
  project_id: z.string(),
  action: z.string(),
  session_id: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  guest_token: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
})

router.post('/property-event', async (req: Request, res: Response) => {
  try {
    const data = PropertyEventSchema.parse(req.body)

    // Bots are not buyers; their clicks would only inflate engagement.
    if (isBotRequest(req)) {
      res.status(200).json({ success: true })
      return
    }

    // Identity comes from the request, never the body: the verified account, else the
    // website guest token header. body.user_id / body.guest_token are ignored.
    const userId = await verifyUser(req)
    const header = req.headers['x-guest-token']
    const guestToken = !userId && typeof header === 'string' && isWebsiteGuestToken(header.trim()) ? header.trim() : null

    // Attached to the session it names when that session is the caller's, else to this person's
    // latest real session. A person who has never chatted is still recorded, by identity, with
    // no session (property_events.session_id is optional since migration 20261104_…).
    let sessionId: string | null = null
    if (data.session_id && (userId || guestToken)) {
      // The body's session id is accepted only when it belongs to the caller.
      const s = await prisma.chatSession.findUnique({ where: { id: data.session_id }, select: { id: true, is_bot: true, user_id: true, guest_token: true } })
      if (s && !s.is_bot && (userId ? s.user_id === userId : s.guest_token === guestToken)) sessionId = s.id
    }
    if (!sessionId && (userId || guestToken)) {
      const s = await prisma.chatSession.findFirst({
        where: { is_bot: false, ...(userId ? { user_id: userId } : { guest_token: guestToken }) },
        orderBy: { last_active: 'desc' },
        select: { id: true },
      })
      sessionId = s?.id ?? null
    }

    if (sessionId || userId || guestToken) {
      await prisma.propertyEvent.create({
        data: {
          session_id: sessionId,
          project_id: data.project_id,
          action: data.action,
          user_id: userId ?? undefined,
          guest_token: guestToken ?? undefined,
        }
      })
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('[analytics/property-event]', err)
    res.status(400).json({ error: 'Invalid payload' })
  }
})

export default router
