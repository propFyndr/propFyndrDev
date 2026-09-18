// backend/src/routes/sitemap.ts
//
// Slugs for the sitemap, and nothing else.
//
// The frontend used to read these straight out of its own Prisma client, which
// meant a second schema, a second generated client and a second connection pool
// existing to answer one question at build time. This is that question, asked
// over the API like everything else.
//
// A dedicated endpoint rather than `GET /projects`, which returns the full
// catalogue with builders and unit types attached. Pulling all of that to read
// a slug off each row is exactly the waste Phase 8 spent its time removing.
//
// Public by design: every URL here is a page a crawler is meant to find. It
// returns slugs and nothing else, so there is no field to classify.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { routeCache } from '../lib/routeCache'

const router = Router()

/**
 * GET /api/v1/sitemap — every indexable project and builder slug.
 *
 * Cached for an hour. A sitemap is regenerated on deploy or on a schedule, and
 * a project that appears an hour late costs nothing; hitting the database on
 * every crawler request costs more.
 */
router.get('/', routeCache(3600), async (_req: Request, res: Response) => {
  try {
    const [projects, builders] = await Promise.all([
      prisma.project.findMany({
        where: { slug: { not: '' } },
        select: { slug: true, updated_at: true },
      }),
      prisma.builder.findMany({
        where: { slug: { not: '' } },
        select: { slug: true },
      }),
    ])

    res.json({
      projects: projects.map((p) => ({ slug: p.slug, updated_at: p.updated_at })),
      builders: builders.map((b) => ({ slug: b.slug })),
    })
  } catch (err) {
    console.error('[sitemap] slug fetch failed:', err)
    res.status(500).json({ error: 'Failed to build sitemap' })
  }
})

export default router
