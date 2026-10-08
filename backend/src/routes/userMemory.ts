// backend/src/routes/userMemory.ts
import { Router, Request, Response } from 'express'
import { getMemory } from '../lib/ai/memory'
import { prisma } from '../lib/db'

export const userMemoryRouter = Router()

/**
 * GET /api/v1/user/memory
 * Returns buyer's stored preferences from user_memory table.
 */
userMemoryRouter.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req.query.userId as string)
  const guestToken = (req.headers['x-guest-token'] as string) || (req.query.guestToken as string)

  if (!userId && !guestToken) {
    res.status(400).json({ error: 'userId or guestToken is required' })
    return
  }

  try {
    const mem = await getMemory(userId, guestToken)
    res.json({ success: true, memory: mem })
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve user memory', detail: (err as Error).message })
  }
})

/**
 * DELETE /api/v1/user/memory
 * Erases buyer's stored profile (GDPR compliance).
 */
userMemoryRouter.delete('/', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req.query.userId as string)
  const guestToken = (req.headers['x-guest-token'] as string) || (req.query.guestToken as string)

  if (!userId && !guestToken) {
    res.status(400).json({ error: 'userId or guestToken is required' })
    return
  }

  try {
    const where = userId ? { user_id: userId } : { guest_token: guestToken }
    await prisma.userMemory.deleteMany({ where })
    res.json({ success: true, message: 'User memory cleared successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear user memory', detail: (err as Error).message })
  }
})
