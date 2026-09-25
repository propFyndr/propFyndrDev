import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'

const router = Router()

/**
 * GET /api/v1/news/active — list live published builder news and milestones for discovery
 */
router.get(['/', '/active'], async (_req: Request, res: Response) => {
  try {
    const news = await prisma.builderNews.findMany({
      where: {
        status: 'published',
        archived_at: null,
      },
      include: {
        builder: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [
        { run_as_promo: 'desc' },
        { published_at: 'desc' },
        { created_at: 'desc' },
      ],
      take: 20,
    })

    // Editorial cadence, not real-time. The rail rotates every 3.4s but its
    // CONTENT changes when someone publishes a post, so a short shared cache
    // costs a homepage render nothing and spares the database one query per
    // visitor. stale-while-revalidate keeps the rail instant while the refresh
    // happens behind it. Paired with the client, which must not use
    // `cache: 'force-cache'` — that never revalidates at all.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

    res.json({
      success: true,
      total: news.length,
      news: news.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        image_url: item.image_url,
        link_type: item.link_type || 'builder',
        link_target: item.link_target,
        run_as_promo: item.run_as_promo,
        created_at: item.created_at,
        published_at: item.published_at,
        builder: item.builder,
      })),
    })
  } catch (err) {
    console.error('[news] public news fetch failed:', err)
    res.status(500).json({ error: 'Failed to fetch active announcements' })
  }
})

export default router
