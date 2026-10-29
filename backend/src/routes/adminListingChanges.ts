// backend/src/routes/adminListingChanges.ts
//
// RealtyAsk's review of builder-proposed price and availability changes
// (lib/listingChanges.ts). Approval publishes, with date and approver;
// rejection returns a reason the builder sees in their portal.
//
// Mounted at /api/v1/admin/listing-changes before the catch-all admin router.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireIdentity, requireRole } from '../lib/adminIdentity'
import type { AdminIdentitySession } from '../lib/adminIdentity'
import { approve, reject, reviewQueue, priceHistoryFor } from '../lib/listingChanges'

const router = Router()

function approverOf(req: Request) {
  const identity = (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
  return { email: identity.email, adminId: identity.adminUserId }
}

const STATUSES = ['pending_realtyask', 'approved', 'rejected'] as const

router.get('/', requireIdentity, requireRole('SUPER_ADMIN', 'ANALYST'), async (req: Request, res: Response) => {
  const status = STATUSES.includes(req.query.status as (typeof STATUSES)[number]) ? (req.query.status as string) : 'pending_realtyask'
  res.json({ changes: await reviewQueue(status) })
})

router.post('/:id/approve', requireIdentity, requireRole('SUPER_ADMIN', 'ANALYST'), async (req: Request, res: Response) => {
  const r = await approve(req.params.id, approverOf(req))
  if (!r.ok) { res.status(r.status).json({ error: r.error, detail: r.detail }); return }
  res.json({ success: true })
})

const RejectSchema = z.object({ reason: z.string().trim().min(3).max(300) }).strict()

router.post('/:id/reject', requireIdentity, requireRole('SUPER_ADMIN', 'ANALYST'), async (req: Request, res: Response) => {
  const parsed = RejectSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'A reason the builder can act on is required' }); return }
  const r = await reject(req.params.id, parsed.data.reason, approverOf(req))
  if (!r.ok) { res.status(r.status).json({ error: r.error }); return }
  res.json({ success: true })
})

// Every price we hold for one flat type: who gave it, who approved it, when,
// back to the first recorded row, plus who confirmed the price shown now.
router.get('/unit-types/:id/price-history', requireIdentity, requireRole('SUPER_ADMIN', 'ANALYST'), async (req: Request, res: Response) => {
  const h = await priceHistoryFor(req.params.id)
  if (!h) { res.status(404).json({ error: 'Flat type not found' }); return }
  const current = await prisma.factVerification.findMany({
    where: { entityType: 'UnitType', entityId: h.unit.id, fieldName: { in: ['price_min_cr', 'availability'] } },
    select: { fieldName: true, tier: true, verifiedAt: true, verifiedBy: true, sourceDoc: true },
  })
  res.json({ ...h, current })
})

export default router
