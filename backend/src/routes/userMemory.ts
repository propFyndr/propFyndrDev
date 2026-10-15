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

const EDITABLE = {
  bhk_preference: (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 6 ? v : undefined),
  budget_max_cr: (v: unknown) => (typeof v === 'number' && v > 0 && v <= 100 ? v : undefined),
  sector_preference: (v: unknown) => (typeof v === 'string' && /^Sector \d{1,3}$/i.test(v) ? v : undefined),
  work_location: (v: unknown) => (typeof v === 'string' && v.trim().length > 0 && v.length <= 60 ? v.trim() : undefined),
  possession_pref: (v: unknown) => (['immediate', '1year', '2year', '3year+'].includes(v as string) ? v : undefined),
  purpose: (v: unknown) => (v === 'endUse' || v === 'investment' ? v : undefined),
} as const

/**
 * PATCH /api/v1/user/memory
 * Lets the buyer correct what we hold. Only the fields above, each validated;
 * `null` clears a field. Nothing outside the buyer's own row can be touched.
 */
userMemoryRouter.patch('/', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req.query.userId as string)
  const guestToken = (req.headers['x-guest-token'] as string) || (req.query.guestToken as string)
  if (!userId && !guestToken) {
    res.status(400).json({ error: 'userId or guestToken is required' })
    return
  }

  const data: Record<string, unknown> = {}
  for (const [key, check] of Object.entries(EDITABLE)) {
    if (!(key in (req.body ?? {}))) continue
    const value = (req.body as Record<string, unknown>)[key]
    if (value === null) { data[key] = null; continue }
    const ok = check(value)
    if (ok === undefined) { res.status(400).json({ error: `invalid value for ${key}` }); return }
    data[key] = ok
  }
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'no editable fields supplied' })
    return
  }

  try {
    const where = userId ? { user_id: userId } : { guest_token: guestToken }
    const result = await prisma.userMemory.updateMany({ where, data })
    if (result.count === 0) { res.status(404).json({ error: 'nothing saved to edit yet' }); return }
    res.json({ success: true, memory: await getMemory(userId, guestToken) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user memory', detail: (err as Error).message })
  }
})
