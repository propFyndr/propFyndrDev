// backend/src/routes/sectors.ts
//
// Public sector pages — the micro-market landing surface.
//
// Day 5 asked for dynamic metadata on `/sectors/[slug]`, and the audit found
// there was no such route to put metadata on: micro-markets were reachable
// only through `/discover` and through whichever project happened to sit in
// them. That is a real gap rather than a documentation error — "Sector 150"
// and "Greater Noida West" are how buyers search, and we hold a verified
// `SectorIntelligence` row for each one saying what living there is actually
// like.
//
// Public by design. Every field returned is allowlisted in
// `lib/sectorExposure.ts`; the analyst's name and the row bookkeeping are not
// in it.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { routeCache } from '../lib/routeCache'
import { SECTOR_PUBLIC_SELECT, sectorSlug } from '../lib/sectorExposure'
import { PROJECT_PUBLIC_SELECT } from '../lib/projectExposure'

const router = Router()

/**
 * The project card, as a sector page shows it.
 *
 * Every key here must also be a key of `PROJECT_PUBLIC_SELECT` — asserted in
 * `sectorExposure.test.ts`, because a card select assembled by hand is exactly
 * where an unclassified column gets published by accident.
 */
const SECTOR_PROJECT_CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  sector: true,
  city: true,
  status: true,
  hero_image_url: true,
  price_min_cr: true,
  price_range_label: true,
  possession_date: true,
  possession_label: true,
  rera_number: true,
  builder: { select: { name: true, slug: true } },
} as const

/**
 * GET /api/v1/sectors — every sector we hold intelligence for.
 *
 * Drives the sitemap and the index page. Cached for an hour: sector rows are
 * analyst-maintained and change on the order of weeks.
 */
router.get('/', routeCache(3600), async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.sectorIntelligence.findMany({
      select: {
        city: true,
        sector: true,
        micro_market: true,
        sector_stage: true,
        avg_price_per_sqft: true,
        lifestyle_tags: true,
        last_verified_at: true,
        updated_at: true,
      },
      orderBy: [{ city: 'asc' }, { sector: 'asc' }],
    })

    res.json({
      sectors: rows.map((r) => ({
        slug: sectorSlug(r.sector, r.city),
        city: r.city,
        sector: r.sector,
        micro_market: r.micro_market,
        sector_stage: r.sector_stage,
        avg_price_per_sqft: r.avg_price_per_sqft,
        lifestyle_tags: r.lifestyle_tags,
        last_verified_at: r.last_verified_at,
        updated_at: r.updated_at,
      })),
    })
  } catch (err) {
    console.error('[sectors] list failed:', err)
    res.status(500).json({ error: 'Failed to load sectors' })
  }
})

/**
 * GET /api/v1/sectors/:slug — one micro-market, plus the projects in it.
 *
 * The slug is matched by recomputing it over the candidate rows rather than by
 * parsing it apart. "Sector 16B" and "Greater Noida West" both contain
 * separators that a parser would have to guess at, and a wrong guess is a 404
 * on a page a crawler has already indexed.
 */
router.get('/:slug', routeCache(1800), async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').toLowerCase()
  if (!slug || slug.length > 120) {
    res.status(400).json({ error: 'Invalid sector' })
    return
  }

  try {
    /**
     * Two queries, not one scan.
     *
     * The slug cannot be parsed back into (sector, city) — "Sector 16B" and
     * "Greater Noida West" both contain separators a parser would have to
     * guess at — so the match is done by recomputing the slug. Doing that over
     * the FULL public select pulled every JSON column of all 65 rows on every
     * uncached request. This pulls two strings per row to find the key, then
     * reads the one row through its `@@unique([city, sector])` index.
     */
    const keys = await prisma.sectorIntelligence.findMany({
      select: { city: true, sector: true },
    })
    const key = keys.find((r) => sectorSlug(r.sector, r.city) === slug)

    if (!key) {
      res.status(404).json({ error: 'Sector not found' })
      return
    }

    const row = await prisma.sectorIntelligence.findUnique({
      where: { city_sector: { city: key.city, sector: key.sector } },
      select: SECTOR_PUBLIC_SELECT,
    })
    if (!row) {
      res.status(404).json({ error: 'Sector not found' })
      return
    }

    /**
     * The projects we actually hold there.
     *
     * Capped at 24. A sector page is a landing surface, not a catalogue
     * dump, and an unbounded findMany over the busiest micro-market is the
     * query-ceiling problem `queryCeilings.test.ts` exists to catch.
     */
    const projects = await prisma.project.findMany({
      where: { sector: row.sector, city: row.city },
      select: SECTOR_PROJECT_CARD_SELECT,
      orderBy: [{ price_min_cr: 'asc' }],
      take: 24,
    })

    res.json({ sector: { ...row, slug }, projects, project_count: projects.length })
  } catch (err) {
    console.error('[sectors] detail failed:', err)
    res.status(500).json({ error: 'Failed to load sector' })
  }
})

export default router
