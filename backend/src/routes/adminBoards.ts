// backend/src/routes/adminBoards.ts
//
// The two role-specific landing boards.
//
// Until now every staff role landed on the same `/admin` dashboard with the
// nav items they could not use hidden. That is a dashboard with holes in it,
// not a dashboard for anyone: a salesperson opening it sees platform totals
// they cannot act on, and an analyst sees lead counts that are none of their
// business. Each of these answers one role's first question of the day.
//
//  - SALES:   "who do I call, in what order, and what is going cold?"
//  - ANALYST: "which rows are wrong or missing?"
//
// Mounted under /admin, so `adminAreaGuard` gives them the staff floor, the
// role matrix and field redaction for free. Neither endpoint is named in
// `adminPolicy`'s deny-lists, so both are readable by all three staff roles —
// deliberate: a super admin should be able to open either board to see what
// their team is looking at.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { loadScoreMap } from '../lib/completenessCache'

const router = Router()

/** A lead nobody has touched for this long is going cold. */
const STALE_AFTER_MS = 48 * 60 * 60 * 1000

/**
 * GET /admin/boards/queue — the salesperson's work queue.
 *
 * Ordered by what should be called first, not by what arrived first. A HOT lead
 * from this morning outranks a COLD one from last week, and a lead already
 * marked `converted` or `lost` is finished work and does not appear at all.
 */
router.get('/queue', async (_req: Request, res: Response) => {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS)

  // "Open" is the whole queue concept: anything not yet resolved.
  const open = { status: { notIn: ['converted', 'lost'] } }

  const [todayCount, hot, warm, cold, stale, unassigned, queue] = await Promise.all([
    prisma.callbackRequest.count({ where: { created_at: { gte: startOfToday } } }),
    prisma.callbackRequest.count({ where: { ...open, lead_tier: 'HOT' } }),
    prisma.callbackRequest.count({ where: { ...open, lead_tier: 'WARM' } }),
    prisma.callbackRequest.count({ where: { ...open, lead_tier: 'COLD' } }),
    prisma.callbackRequest.count({
      where: { ...open, status: 'new', created_at: { lt: staleBefore } },
    }),
    prisma.callbackRequest.count({ where: { ...open, assigned_partner_id: null } }),
    prisma.callbackRequest.findMany({
      where: open,
      select: {
        id: true, name: true, phone: true, project_name: true, project_slug: true,
        status: true, lead_tier: true, lead_score: true, intent_tier: true,
        ai_summary: true, budget_min_cr: true, budget_max_cr: true,
        created_at: true, assigned_partner_id: true,
      },
      // Score descending puts HOT first without a second sort key, because
      // `lead_tier` is derived from `lead_score` — see scoreLead().
      orderBy: [{ lead_score: 'desc' }, { created_at: 'desc' }],
      take: 100,
    }),
  ])

  res.json({
    stats: { today: todayCount, hot, warm, cold, stale, unassigned },
    /** Milliseconds, so the client can label "going cold" with the same rule. */
    stale_after_ms: STALE_AFTER_MS,
    queue,
  })
})

/**
 * GET /admin/boards/data-quality — the analyst's worklist.
 *
 * Which catalogue rows are missing fields a buyer would look for and not find,
 * worst first.
 */
router.get('/data-quality', async (_req: Request, res: Response) => {
  /**
   * Two queries, one round trip.
   *
   * This ran eight: six `count` calls asking how many projects were missing
   * each field, then a `findMany` that fetched those very fields for every
   * project so the worklist could be built. The counts were aggregates over
   * rows the handler was already holding — six network round trips to
   * recompute what was sitting in memory.
   *
   * Now the rows are fetched once and the counts are derived from them. `total`
   * stays a real count so that the "complete" figure is still correct if the
   * catalogue ever outgrows what this endpoint reads.
   */
  const [total, projects, scoreMap] = await Promise.all([
    prisma.project.count(),
    prisma.project.findMany({
      select: {
        id: true, name: true, slug: true, sector: true, status: true, updated_at: true,
        rera_number: true, possession_date: true, price_min_cr: true, description: true,
        _count: { select: { images: true, unit_types: true } },
      },
    }),
    /**
     * Completeness scores, read from the cache the projects list fills.
     *
     * Read-only on purpose: this board does not compute scores, so it never
     * pays the cold cost and never competes with the list for it. When the
     * cache is cold `thin` comes back empty and the board says so rather than
     * showing a misleading zero.
     */
    loadScoreMap(),
  ])

  /**
   * Every check is "this column is empty", never "this value looks wrong".
   *
   * An absent field is a fact an analyst can act on. A heuristic that guesses a
   * row is suspect sends them to re-verify data that was already correct, and
   * after the second false lead they stop opening the board.
   */
  const scored = projects.map((p) => {
    const gaps: string[] = []
    if (!p.rera_number) gaps.push('RERA number')
    if (!p.possession_date) gaps.push('Possession date')
    if (p.price_min_cr == null) gaps.push('Price')
    if (!p.description) gaps.push('Description')
    if (p._count.images === 0) gaps.push('Images')
    if (p._count.unit_types === 0) gaps.push('Unit types')
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sector: p.sector,
      status: p.status,
      updated_at: p.updated_at,
      gaps,
    }
  })

  /** Counted from the rows above rather than asked for again. */
  const countGap = (label: string) => scored.filter((p) => p.gaps.includes(label)).length

  /**
   * Worst first: a project missing four things is a bigger job than four
   * projects missing one each, and it is also the one most likely to be
   * misleading a buyer right now.
   */
  const worklist = scored
    .filter((p) => p.gaps.length > 0)
    .sort((a, b) => b.gaps.length - a.gaps.length)
    .slice(0, 100)

  const needingWork = scored.filter((p) => p.gaps.length > 0).length

  /**
   * The six checks above are all green across the catalogue, and have been
   * since this board shipped — every project has a RERA number, a price, a
   * possession date, a description, images and unit types. A worklist that is
   * always empty is a screen nobody opens twice.
   *
   * What actually varies is the completeness SCORE, which reads far more than
   * six columns — brochures, payment plans, construction milestones, the
   * intelligence profiles — and spans roughly 55 to 97 across the catalogue.
   * So the board reports the weakest rows by score, which is the question an
   * analyst was asking when they opened it.
   *
   * `tabScores` names which section is weakest, so the answer arrives with
   * somewhere to go rather than a number to interpret.
   */
  const thin = Object.keys(scoreMap).length === 0 ? [] : scored
    .map((p) => ({ ...p, score: scoreMap[p.id]?.score ?? null, tabScores: scoreMap[p.id]?.tabScores ?? null }))
    .filter((p): p is typeof p & { score: number } => p.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 25)
    .map((p) => ({
      id: p.id, name: p.name, slug: p.slug, sector: p.sector, score: p.score,
      // The lowest-scoring section, which is where the work is.
      weakest: p.tabScores
        ? Object.entries(p.tabScores).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null
        : null,
    }))

  res.json({
    stats: {
      total,
      // Against the full catalogue count, so this stays honest even if the
      // scored set is ever a subset of it.
      complete: total - needingWork,
      missing_rera: countGap('RERA number'),
      missing_possession: countGap('Possession date'),
      missing_price: countGap('Price'),
      missing_description: countGap('Description'),
      no_images: countGap('Images'),
      no_unit_types: countGap('Unit types'),
    },
    worklist,
    /**
     * Empty when the completeness cache is cold — the projects list fills it,
     * and this board never computes. The client distinguishes "nothing to do"
     * from "not measured yet" on `scores_available`.
     */
    thinnest: thin,
    scores_available: Object.keys(scoreMap).length > 0,
  })
})

export default router
