import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { requireAdmin } from '../lib/adminAuth'

/**
 * Reading the beta back.
 *
 * Every table needed to answer "what happened" already existed and nothing read
 * any of it: ChatMessage holds transcripts, ai_usage_events holds cost keyed by
 * session, CallbackRequest holds leads. The data was being written into a room
 * nobody had a door to.
 *
 * Three questions this answers, which are the three a 50-200 user beta exists
 * to ask: what did they say, where did they stop, and what did it cost to get
 * the ones who converted.
 */
export const betaRouter = Router()

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error('[beta:ERROR]', err)
      res.status(500).json({ error: 'Internal error' })
    })
  }

/** Answers containing this are our own "we do not hold that" sentinel. */
const COVERAGE_GAP = /not recorded|do not (currently )?track|we do not hold|nothing verified/i

interface SessionRow {
  id: string
  user_id: string | null
  guest_token: string | null
  created_at: Date
  last_active: Date
  message_count: number
  chat_phase: string
}

betaRouter.get(
  ['/', '/conversations'],
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const offset = Number(req.query.offset ?? 0)

    const [sessions, totalSessions, totalLeadsCount, totalCostAgg] = await Promise.all([
      (prisma.chatSession.findMany({
        orderBy: { last_active: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          user_id: true,
          guest_token: true,
          created_at: true,
          last_active: true,
          message_count: true,
          chat_phase: true,
        },
      })) as Promise<SessionRow[]>,
      prisma.chatSession.count(),
      prisma.callbackRequest.count(),
      prisma.aiUsageEvent.aggregate({ _sum: { cost_usd: true } }),
    ])

    const ids = sessions.map((s) => s.id)

    // Cost and lead status per session, in two queries rather than 2N.
    const [spend, leads, firstMessages] = await Promise.all([
      prisma.aiUsageEvent.groupBy({
        by: ['session_id'],
        where: { session_id: { in: ids } },
        _sum: { cost_usd: true, prompt_tokens: true, completion_tokens: true },
        _count: { _all: true },
      }),
      prisma.callbackRequest.findMany({
        where: { chat_session_id: { in: ids } },
        select: { chat_session_id: true, lead_tier: true, created_at: true },
      }),
      prisma.chatMessage.findMany({
        where: { session_id: { in: ids }, role: 'user' },
        orderBy: { created_at: 'asc' },
        select: { session_id: true, content: true, created_at: true },
      }),
    ])

    const spendBy = new Map(spend.map((s) => [s.session_id, s]))
    const leadBy = new Map(leads.map((l) => [l.chat_session_id, l]))
    const openerBy = new Map<string, string>()
    for (const m of firstMessages) {
      if (!openerBy.has(m.session_id)) openerBy.set(m.session_id, m.content)
    }

    res.json({
      sessions: sessions.map((s) => {
        const sp = spendBy.get(s.id)
        const lead = leadBy.get(s.id)
        return {
          id: s.id,
          identity: s.user_id ? { kind: 'user', id: s.user_id } : { kind: 'guest', id: s.guest_token },
          openingQuestion: openerBy.get(s.id) ?? null,
          turns: Math.floor(s.message_count / 2),
          phase: s.chat_phase,
          startedAt: s.created_at,
          lastActiveAt: s.last_active,
          durationMs: s.last_active.getTime() - s.created_at.getTime(),
          costUsd: Number(sp?._sum.cost_usd ?? 0),
          modelCalls: sp?._count._all ?? 0,
          tokens: {
            in: sp?._sum.prompt_tokens ?? 0,
            out: sp?._sum.completion_tokens ?? 0,
          },
          lead: lead ? { tier: lead.lead_tier, at: lead.created_at } : null,
        }
      }),
      pagination: { limit, offset, returned: sessions.length },
      total: totalSessions,
      totalLeads: totalLeadsCount,
      totalCostUsd: Number(totalCostAgg._sum.cost_usd || 0),
    })
  }),
)

betaRouter.get(
  ['/:id', '/conversations/:id'],
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id

    const session = await prisma.chatSession.findUnique({
      where: { id },
      select: {
        id: true,
        user_id: true,
        guest_token: true,
        created_at: true,
        last_active: true,
        chat_phase: true,
        summary_location: true,
        summary_financial: true,
        summary_timeline: true,
        property_reactions: true,
        focus_project_id: true,
      },
    })
    if (!session) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }

    const [messages, usage, lead] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { session_id: id },
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          intent_snapshot: true,
          artifacts: true,
          chips: true,
          created_at: true,
        },
      }),
      prisma.aiUsageEvent.findMany({
        where: { session_id: id },
        orderBy: { created_at: 'asc' },
        select: {
          provider: true,
          model: true,
          prompt_tokens: true,
          completion_tokens: true,
          cost_usd: true,
          endpoint: true,
          created_at: true,
        },
      }),
      prisma.callbackRequest.findFirst({
        where: { chat_session_id: id },
        select: { name: true, phone: true, lead_tier: true, lead_score: true, ai_summary: true, created_at: true },
      }),
    ])

    // The reviewer's real question is "what did the buyer see", so the project
    // cards that were on screen come back with the turn that showed them rather
    // than as a separate blob to correlate by hand.
    const turns = messages.map((m) => {
      const artifacts = (m.artifacts ?? {}) as Record<string, unknown>
      const cards = Array.isArray(artifacts.property_results) ? artifacts.property_results : []
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        at: m.created_at,
        intent: m.intent_snapshot ?? null,
        chips: m.chips ?? [],
        cardsShown: cards.map((c) => {
          const p = c as Record<string, unknown>
          return {
            id: p.id,
            name: p.name,
            sector: p.sector,
            price: p.price_range_label ?? p.price_min_cr ?? null,
          }
        }),
        // The signal a beta exists to find: we told them we do not hold it.
        flaggedCoverageGap: m.role === 'assistant' && COVERAGE_GAP.test(m.content),
      }
    })

    res.json({
      session: {
        ...session,
        identity: session.user_id
          ? { kind: 'user', id: session.user_id }
          : { kind: 'guest', id: session.guest_token },
      },
      turns,
      lead,
      cost: {
        totalUsd: usage.reduce((s, u) => s + Number(u.cost_usd), 0),
        calls: usage.map((u) => ({
          provider: u.provider,
          model: u.model,
          endpoint: u.endpoint,
          in: u.prompt_tokens,
          out: u.completion_tokens,
          usd: Number(u.cost_usd),
          at: u.created_at,
        })),
      },
    })
  }),
)

betaRouter.get(
  '/metrics',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const days = Math.min(Number(req.query.days ?? 7), 90)
    const since = new Date(Date.now() - days * 86_400_000)

    const [sessions, userMessages, assistantMessages, leads, usage] = await Promise.all([
      // Sessions with no messages are excluded from every denominator here.
      // A guest session is created on the first request, before we know a
      // message will follow, so 6,452 of 14,762 rows had zero turns — 44% — and
      // they dragged turns-per-session to 0.58 and the conversion rate to
      // almost nothing. They are connection attempts, not conversations.
      prisma.chatSession.findMany({
        where: { created_at: { gte: since }, message_count: { gt: 0 } },
        select: { id: true, message_count: true, created_at: true, last_active: true },
      }),
      prisma.chatMessage.findMany({
        where: { created_at: { gte: since }, role: 'user' },
        select: { session_id: true, content: true },
      }),
      prisma.chatMessage.findMany({
        where: { created_at: { gte: since }, role: 'assistant' },
        select: { session_id: true, content: true },
      }),
      prisma.callbackRequest.findMany({
        where: { created_at: { gte: since } },
        select: { chat_session_id: true, lead_tier: true },
      }),
      prisma.aiUsageEvent.aggregate({
        where: { created_at: { gte: since } },
        _sum: { cost_usd: true },
        _count: { _all: true },
      }),
    ])

    // What they actually typed, normalised so casing and spacing do not split
    // one question into five.
    const queryCounts = new Map<string, number>()
    for (const m of userMessages) {
      const k = m.content.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
      if (k.length < 3) continue
      queryCounts.set(k, (queryCounts.get(k) ?? 0) + 1)
    }

    // Where conversations end. A one-turn session is a bounce; the shape of
    // this histogram is the clearest read on whether the product holds anyone.
    const turnHistogram = new Map<number, number>()
    for (const s of sessions) {
      const turns = Math.min(Math.floor(s.message_count / 2), 10)
      turnHistogram.set(turns, (turnHistogram.get(turns) ?? 0) + 1)
    }

    // Coverage gaps our own answers admitted to. Real users find holes the
    // curated corpus never touches, and this is the list worth seeding from.
    const gapSessions = new Set<string>()
    for (const m of assistantMessages) {
      if (COVERAGE_GAP.test(m.content)) gapSessions.add(m.session_id)
    }
    const gapQueries = userMessages
      .filter((m) => gapSessions.has(m.session_id))
      .map((m) => m.content)

    const emptySessions = await prisma.chatSession.count({
      where: { created_at: { gte: since }, message_count: 0 },
    })
    const totalCost = Number(usage._sum.cost_usd ?? 0)
    const leadSessions = new Set(leads.map((l) => l.chat_session_id).filter(Boolean))

    res.json({
      window: { days, since },
      volume: {
        sessions: sessions.length,
        emptySessionsExcluded: emptySessions,
        turns: userMessages.length,
        turnsPerSession: sessions.length ? +(userMessages.length / sessions.length).toFixed(2) : 0,
      },
      funnel: {
        started: sessions.length,
        engaged: sessions.filter((s) => s.message_count >= 4).length,
        leads: leadSessions.size,
        conversionPct: sessions.length ? +((leadSessions.size / sessions.length) * 100).toFixed(1) : 0,
        byTier: leads.reduce<Record<string, number>>((acc, l) => {
          const t = l.lead_tier ?? 'UNSCORED'
          acc[t] = (acc[t] ?? 0) + 1
          return acc
        }, {}),
      },
      cost: {
        totalUsd: +totalCost.toFixed(4),
        modelCalls: usage._count._all,
        perSessionUsd: sessions.length ? +(totalCost / sessions.length).toFixed(5) : 0,
        perLeadUsd: leadSessions.size ? +(totalCost / leadSessions.size).toFixed(4) : null,
      },
      dropOff: [...turnHistogram.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([turns, count]) => ({ turns, sessions: count })),
      topQueries: [...queryCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([query, count]) => ({ query, count })),
      coverageGaps: {
        affectedSessions: gapSessions.size,
        pctOfSessions: sessions.length ? +((gapSessions.size / sessions.length) * 100).toFixed(1) : 0,
        queries: gapQueries.slice(0, 40),
      },
    })
  }),
)
