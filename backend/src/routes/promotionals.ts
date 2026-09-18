// backend/src/routes/promotionals.ts
//
// The buyer-facing half of the promotional system.
//
// `Promotional` has existed with `impressions`, `clicks` and `conversions`
// columns, a `PromotionalInteraction` table, sector and BHK targeting, and a
// full admin CRUD screen. None of it was ever read by the buyer app: there was
// no public endpoint, no component, nothing on /discover. The counters and the
// entire interaction table were dead columns, and every news item a builder
// submitted was approved into a queue nobody displayed.
//
// ── The constraint that makes this sellable ──────────────────────────────
//
// A promoted project is NEVER ranked higher in recommendations, and nothing in
// this file touches recommendation ordering. That is the whole reason a builder
// can pay for a news slot without the advisor becoming an advertising channel:
// the rail is a place to LEARN about a project, and the advisor stays as honest
// about a promoted one as about any other. The day ranking bends to this, the
// product is dead — see CLAUDE.md § Trust First.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { verifyUser } from '../lib/auth'

const router = Router()

/**
 * Fields a buyer may see. The admin row also carries `created_by` and the
 * running counters, which are ours.
 */
const PUBLIC_PROMO_SELECT = {
  id: true,
  title: true,
  description: true,
  type: true,
  content: true,
  link_type: true,
  link_target: true,
  image_url: true,
  icon_url: true,
  builder_id: true,
} as const

/**
 * GET /api/v1/promotionals/active — what to show this buyer, right now.
 *
 * Targeting is a filter, never a ranking: `target_sectors` and `target_bhk`
 * decide whether an item is RELEVANT enough to appear, and an empty array means
 * "everyone". Nothing here scores or orders by commercial value.
 */
router.get('/active', async (req: Request, res: Response) => {
  const now = new Date()
  const sector = typeof req.query.sector === 'string' ? req.query.sector.trim() : ''
  const bhkRaw = typeof req.query.bhk === 'string' ? parseInt(req.query.bhk, 10) : NaN
  const bhk = Number.isFinite(bhkRaw) ? bhkRaw : null
  const type = typeof req.query.type === 'string' ? req.query.type : undefined

  const promos = await prisma.promotional.findMany({
    where: {
      is_active: true,
      starts_at: { lte: now },
      ends_at: { gte: now },
      ...(type === 'news_feature' || type === 'button' || type === 'toast_text' ? { type } : {}),
    },
    select: PUBLIC_PROMO_SELECT,
    orderBy: { starts_at: 'desc' },
    take: 20,
  })

  // Targeting filtered in code rather than SQL: an empty array means "show to
  // everyone", and expressing "empty OR contains" in Prisma for two array
  // columns is less readable than the two lines it replaces, over at most 20
  // rows already in memory.
  const targeted = await prisma.promotional.findMany({
    where: { id: { in: promos.map((p) => p.id) } },
    select: { id: true, target_sectors: true, target_bhk: true },
  })
  const targetingById = new Map(targeted.map((t) => [t.id, t]))

  const visible = promos.filter((p) => {
    const t = targetingById.get(p.id)
    if (!t) return true
    const sectorOk = t.target_sectors.length === 0 || (sector ? t.target_sectors.includes(sector) : false)
    const bhkOk = t.target_bhk.length === 0 || (bhk !== null ? t.target_bhk.includes(bhk) : false)
    return sectorOk && bhkOk
  })

  res.json({ promotionals: visible })
})

const InteractionSchema = z.object({
  interaction_type: z.enum(['impression', 'click', 'conversion']),
  session_id: z.string().optional(),
  converted_project_id: z.string().optional(),
}).strict()

/**
 * POST /api/v1/promotionals/:id/interaction — record a view, a tap, a conversion.
 *
 * Accepts a guest token, like every other lead-generating surface: CLAUDE.md is
 * explicit that a guest token is an identity, and an anonymous interaction is
 * still an attributed one. A row that cannot say who created it is a bug, not a
 * privacy feature.
 *
 * Answers 202 and never fails the caller. Analytics must not be able to break a
 * page a buyer is reading — a lost impression costs a number, a thrown error
 * costs the visit.
 */
router.post('/:id/interaction', async (req: Request, res: Response) => {
  const parsed = InteractionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid interaction' })
    return
  }
  const { interaction_type, session_id, converted_project_id } = parsed.data

  const userId = await verifyUser(req).catch(() => null)
  const guestHeader = req.headers['x-guest-token']
  const guestToken = typeof guestHeader === 'string' && guestHeader.trim() ? guestHeader.trim() : null

  try {
    const promo = await prisma.promotional.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    })
    if (!promo) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    await prisma.$transaction([
      prisma.promotionalInteraction.create({
        data: {
          promotional_id: promo.id,
          interaction_type,
          session_id: session_id ?? null,
          user_id: userId ?? null,
          guest_token: guestToken,
          converted_project_id: converted_project_id ?? null,
        },
      }),
      // The denormalised counter on the row, so the admin list does not have to
      // aggregate the interaction table to show a number.
      prisma.promotional.update({
        where: { id: promo.id },
        data:
          interaction_type === 'impression' ? { impressions: { increment: 1 } }
          : interaction_type === 'click' ? { clicks: { increment: 1 } }
          : { conversions: { increment: 1 } },
      }),
    ])

    res.status(202).json({ ok: true })
  } catch (err) {
    console.error('[promotionals] interaction failed:', err)
    // Still 202: the buyer's page must not care.
    res.status(202).json({ ok: false })
  }
})

/**
 * GET /api/v1/promotionals/:id/context — what the chat should know on a tap.
 *
 * A news item's own copy is marketing written by a builder. When a buyer taps
 * it and lands in chat, the assistant must answer from the PROJECT'S OWN ROWS —
 * "launching in Sector 150 from ₹1.4 Cr" has to be the verified figure, not the
 * figure in the advertisement. This endpoint resolves `link_target` to the real
 * record so the chat can seed itself from data rather than from copy.
 *
 * Returns the promotional's headline for display and the resolved project slug
 * for the assistant. If the link does not resolve, the slug is null and the
 * chat opens on the headline alone rather than on a project we cannot verify.
 */
router.get('/:id/context', async (req: Request, res: Response) => {
  const promo = await prisma.promotional.findUnique({
    where: { id: req.params.id },
    select: { id: true, title: true, link_type: true, link_target: true, is_active: true },
  })
  if (!promo || !promo.is_active) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  let projectSlug: string | null = null
  let builderName: string | null = null

  if (promo.link_type === 'project' && promo.link_target) {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id: promo.link_target }, { slug: promo.link_target }] },
      select: { slug: true, builder: { select: { name: true } } },
    })
    projectSlug = project?.slug ?? null
    builderName = project?.builder?.name ?? null
  } else if (promo.link_type === 'builder' && promo.link_target) {
    const builder = await prisma.builder.findFirst({
      where: { OR: [{ id: promo.link_target }, { slug: promo.link_target }] },
      select: { name: true },
    })
    builderName = builder?.name ?? null
  }

  res.json({
    id: promo.id,
    title: promo.title,
    project_slug: projectSlug,
    builder_name: builderName,
    // The question the chat opens with. Phrased as the buyer would ask it, so
    // the existing router classifies it the same way it would a typed question
    // — no special-case path, no second way for an answer to be produced.
    seed_question: projectSlug
      ? `Tell me about ${promo.title}. What are the prices, possession timeline and trade-offs?`
      : `Tell me more about: ${promo.title}`,
  })
})

export default router
