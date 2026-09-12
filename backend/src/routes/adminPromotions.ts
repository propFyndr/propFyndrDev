import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { requireAdmin } from '../lib/adminAuth'
import { z } from 'zod'

export const adminPromotionsRouter = Router()

const PromotionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  type: z.enum(['button', 'toast_text', 'news_feature']),
  content: z.string().min(1, 'Content / CTA text is required'),
  link_type: z.string().optional().nullable(),
  link_target: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  icon_url: z.string().optional().nullable(),
  builder_id: z.string().optional().nullable(),
  starts_at: z.string().datetime().or(z.date()).optional(),
  ends_at: z.string().datetime().or(z.date()).optional(),
  is_active: z.boolean().default(true),
  target_sectors: z.array(z.string()).default([]),
  target_bhk: z.array(z.number()).default([]),
})

const PromotionPatchSchema = PromotionSchema.partial()

// GET /api/v1/admin/promotions — list all promotions with stats
adminPromotionsRouter.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type, active, q } = req.query

    const where: any = {}
    if (type && typeof type === 'string' && type !== 'all') {
      where.type = type
    }
    if (active === 'true') {
      where.is_active = true
    } else if (active === 'false') {
      where.is_active = false
    }
    if (q && typeof q === 'string' && q.trim()) {
      where.OR = [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { description: { contains: q.trim(), mode: 'insensitive' } },
        { content: { contains: q.trim(), mode: 'insensitive' } },
      ]
    }

    const [promotions, totalCount, activeCount, aggregates] = await Promise.all([
      prisma.promotional.findMany({
        where,
        orderBy: { created_at: 'desc' },
      }),
      prisma.promotional.count(),
      prisma.promotional.count({ where: { is_active: true } }),
      prisma.promotional.aggregate({
        _sum: {
          impressions: true,
          clicks: true,
          conversions: true,
        },
      }),
    ])

    const totalImpressions = aggregates._sum.impressions || 0
    const totalClicks = aggregates._sum.clicks || 0
    const totalConversions = aggregates._sum.conversions || 0
    const avgCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0

    res.json({
      promotions,
      stats: {
        total: totalCount,
        active: activeCount,
        inactive: totalCount - activeCount,
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        ctr: avgCtr,
      },
    })
  } catch (err: any) {
    console.error('[admin:promotions:list] error:', err)
    res.status(500).json({ error: 'Failed to fetch promotions' })
  }
})

// GET /api/v1/admin/promotions/:id — get single promotion
adminPromotionsRouter.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const promo = await prisma.promotional.findUnique({
      where: { id: req.params.id },
      include: {
        interactions: {
          take: 20,
          orderBy: { created_at: 'desc' },
        },
      },
    })
    if (!promo) {
      res.status(404).json({ error: 'Promotion not found' })
      return
    }
    res.json(promo)
  } catch (err: any) {
    console.error('[admin:promotions:get] error:', err)
    res.status(500).json({ error: 'Failed to fetch promotion' })
  }
})

// POST /api/v1/admin/promotions — create a promotion
adminPromotionsRouter.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = PromotionSchema.parse(req.body)

    const startsAt = parsed.starts_at ? new Date(parsed.starts_at) : new Date()
    // Default to 30 days from startsAt if not provided
    const endsAt = parsed.ends_at
      ? new Date(parsed.ends_at)
      : new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000)

    const created = await prisma.promotional.create({
      data: {
        title: parsed.title,
        description: parsed.description || null,
        type: parsed.type,
        content: parsed.content,
        link_type: parsed.link_type || null,
        link_target: parsed.link_target || null,
        image_url: parsed.image_url || null,
        icon_url: parsed.icon_url || null,
        builder_id: parsed.builder_id || null,
        starts_at: startsAt,
        ends_at: endsAt,
        is_active: parsed.is_active ?? true,
        target_sectors: parsed.target_sectors || [],
        target_bhk: parsed.target_bhk || [],
      },
    })

    res.status(201).json(created)
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors })
      return
    }
    console.error('[admin:promotions:create] error:', err)
    res.status(500).json({ error: 'Failed to create promotion' })
  }
})

// PATCH /api/v1/admin/promotions/:id — update promotion or toggle is_active
adminPromotionsRouter.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const parsed = PromotionPatchSchema.parse(req.body)

    const dataToUpdate: any = {}
    if (parsed.title !== undefined) dataToUpdate.title = parsed.title
    if (parsed.description !== undefined) dataToUpdate.description = parsed.description
    if (parsed.type !== undefined) dataToUpdate.type = parsed.type
    if (parsed.content !== undefined) dataToUpdate.content = parsed.content
    if (parsed.link_type !== undefined) dataToUpdate.link_type = parsed.link_type
    if (parsed.link_target !== undefined) dataToUpdate.link_target = parsed.link_target
    if (parsed.image_url !== undefined) dataToUpdate.image_url = parsed.image_url
    if (parsed.icon_url !== undefined) dataToUpdate.icon_url = parsed.icon_url
    if (parsed.builder_id !== undefined) dataToUpdate.builder_id = parsed.builder_id
    if (parsed.is_active !== undefined) dataToUpdate.is_active = parsed.is_active
    if (parsed.starts_at !== undefined) dataToUpdate.starts_at = new Date(parsed.starts_at)
    if (parsed.ends_at !== undefined) dataToUpdate.ends_at = new Date(parsed.ends_at)
    if (parsed.target_sectors !== undefined) dataToUpdate.target_sectors = parsed.target_sectors
    if (parsed.target_bhk !== undefined) dataToUpdate.target_bhk = parsed.target_bhk

    const updated = await prisma.promotional.update({
      where: { id },
      data: dataToUpdate,
    })

    res.json(updated)
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors })
      return
    }
    console.error('[admin:promotions:patch] error:', err)
    res.status(500).json({ error: 'Failed to update promotion' })
  }
})

// DELETE /api/v1/admin/promotions/:id — delete promotion
adminPromotionsRouter.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    await prisma.promotional.delete({
      where: { id },
    })
    res.json({ ok: true, deletedId: id })
  } catch (err: any) {
    console.error('[admin:promotions:delete] error:', err)
    res.status(500).json({ error: 'Failed to delete promotion' })
  }
})
