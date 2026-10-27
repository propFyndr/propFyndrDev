// backend/src/routes/sessions.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { verifyUser } from '../lib/auth'

const router = Router()

router.get('/re-engagement/latest', async (req: Request, res: Response) => {
  const userId = (await verifyUser(req)) ?? undefined
  const guestToken = (req.query.guestToken as string | undefined) ||
                     (req.headers['x-guest-token'] as string | undefined)

  if (!userId && !guestToken) { res.json({ session: null }); return }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const session = await prisma.chatSession.findFirst({
    where: {
      ...(userId ? { user_id: userId } : { guest_token: guestToken }),
      last_active: { gt: sevenDaysAgo },
      chat_phase: { in: ['GATHERING', 'READY_TO_SEARCH', 'SHORTLISTED', 'ADVISOR'] },
    },
    orderBy: { last_active: 'desc' },
    select: { id: true, title: true, chat_phase: true, last_active: true, last_projects: true },
  })

  res.json({ session })
})

router.post('/migrate', async (req: Request, res: Response) => {
  const userId = await verifyUser(req)
  const { guestToken } = req.body as { guestToken: string }

  // Require authenticated user + guest token to migrate
  if (!userId) {
    res.status(401).json({ error: 'Authentication required to migrate sessions' })
    return
  }

  if (!guestToken) {
    res.status(400).json({ error: 'guestToken required in request body' })
    return
  }

  try {
    // Migrate all guest sessions to authenticated user
    const sessionResult = await prisma.chatSession.updateMany({
      where: { guest_token: guestToken, user_id: null },
      data: { user_id: userId },
    })

    // Attach this device's referral visit to the now-identified user, so the
    // admin tree can show "possibly the same person" across devices once a
    // phone number or sign-in links them. See docs/archive/superpowers/specs/2026-10-11-referral-tracking-design.md.
    await prisma.referralVisit.updateMany({
      where: { guest_token: guestToken, user_id: null },
      data: { user_id: userId },
    })

    // Migrate user memory if it exists
    const memory = await prisma.userMemory.findFirst({
      where: { guest_token: guestToken },
    })

    if (memory) {
      const { id: _id, guest_token: _gt, updated_at: _ua, ...memData } = memory
      await prisma.userMemory.upsert({
        where: { user_id: userId },
        create: { ...memData, user_id: userId, guest_token: null },
        update: {
          viewed_slugs: memory.viewed_slugs,
          saved_slugs: memory.saved_slugs,
          bhk_preference: memory.bhk_preference,
          budget_max_cr: memory.budget_max_cr,
          sector_preference: memory.sector_preference,
        },
      })
    }

    res.json({
      success: true,
      migrated: sessionResult.count,
      message: `Migrated ${sessionResult.count} session(s) to authenticated user`,
    })
  } catch (err) {
    console.error('[SESSIONS:MIGRATE_ERROR]', err)
    res.status(500).json({ error: 'Migration failed' })
  }
})

export default router
