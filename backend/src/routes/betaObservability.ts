import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { requireAdmin } from '../lib/adminAuth'
import { computeEntityIntelligence } from '../lib/admin/entityIntelligence'
import { realPeopleSessions, realLeads } from '../lib/analytics/cohort'

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
  summary_location: string | null
  summary_financial: string | null
  summary_timeline: string | null
  focus_project_id: string | null
  focus_project?: { id: string; name: string; slug: string; sector: string } | null
}

// ── Entity Intelligence: what buyers ask about, from real turns (60 s cache per window)
const intelligenceCache = new Map<string, { data: unknown; timestamp: number }>()

betaRouter.get(
  ['/intelligence', '/top-entities'],
  requireAdmin,
  asyncHandler(async (req, res) => {
    // ?days=7 | 30 (default) | 0 for all time
    const daysRaw = Number(req.query.days ?? 30)
    const days = Number.isFinite(daysRaw) && daysRaw >= 0 ? Math.min(Math.floor(daysRaw), 3650) : 30
    const key = String(days)
    const hit = intelligenceCache.get(key)
    if (hit && Date.now() - hit.timestamp < 60_000) {
      res.json(hit.data)
      return
    }

    try {
      const since = days > 0 ? new Date(Date.now() - days * 86_400_000) : undefined
      const realUser = { is_bot: false }
      const [messages, projects, focused, totalSessions, totalLeads] = await Promise.all([
        prisma.chatMessage.findMany({
          where: { role: 'user', session: realUser, ...(since ? { created_at: { gte: since } } : {}) },
          select: { content: true, session_id: true, intent_snapshot: true },
          orderBy: { created_at: 'desc' },
          take: 20_000,
        }),
        prisma.project.findMany({ select: { id: true, name: true, slug: true, sector: true } }),
        prisma.chatSession.findMany({
          where: { ...realUser, focus_project_id: { not: null }, ...(since ? { messages: { some: { created_at: { gte: since } } } } : {}) },
          select: { id: true, focus_project_id: true },
        }),
        prisma.chatSession.count({
          where: { ...realUser, message_count: { gt: 0 }, ...(since ? { messages: { some: { created_at: { gte: since } } } } : {}) },
        }),
        prisma.callbackRequest.count(since ? { where: { created_at: { gte: since } } } : undefined),
      ])
      // Conversion is per person (lib/analytics/cohort.ts): real people who chatted in the
      // window, and how many of them made a real lead (callback or site visit) in it.
      const sinceSql = since ?? new Date(0)
      const [people] = await prisma.$queryRaw<Array<{ engaged: number; withLead: number }>>`
        WITH s AS (${realPeopleSessions()}),
        active AS (SELECT DISTINCT s.person FROM s WHERE s.message_count > 0
                   AND EXISTS (SELECT 1 FROM chat_messages m WHERE m.session_id = s.id AND m.created_at >= ${sinceSql}))
        SELECT (SELECT COUNT(*) FROM active)::int AS engaged,
               (SELECT COUNT(DISTINCT l.person) FROM (${realLeads()}) l
                 WHERE l.created_at >= ${sinceSql} AND l.person IN (SELECT person FROM active))::int AS "withLead"`

      const focusBySession = new Map(focused.map((s) => [s.id, s.focus_project_id as string]))
      const intel = computeEntityIntelligence(messages, projects, focusBySession)
      const payload = {
        ...intel,
        window: { days, since: since?.toISOString() ?? null, messagesScanned: messages.length },
        generatedAt: new Date().toISOString(),
        userMetrics: {
          totalEngagedSessions: totalSessions,
          capturedLeads: totalLeads,
          // People with a real lead / real people who chatted, in the window (was leads / sessions).
          leadConversionRate: people.engaged > 0 ? +((people.withLead / people.engaged) * 100).toFixed(1) : 0,
          engagedPeople: people.engaged,
          peopleWithLead: people.withLead,
        },
      }
      intelligenceCache.set(key, { data: payload, timestamp: Date.now() })
      res.json(payload)
    } catch (err) {
      console.error('[intelligence:ERROR]', err)
      res.status(500).json({ error: 'Failed to compute intelligence' })
    }
  }),
)

betaRouter.get(
  ['/', '/conversations'],
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const offset = Number(req.query.offset ?? 0)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const projectFilter = typeof req.query.project === 'string' ? req.query.project.trim() : ''
    const sectorFilter = typeof req.query.sector === 'string' ? req.query.sector.trim() : ''
    const tab = typeof req.query.tab === 'string' ? req.query.tab.trim() : ''
    const sortBy = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'recent'

    const includeTests = req.query.includeTests === 'true'
    // A relation filter skips the excludeTestLeads extension, so is_test is stated here.
    const realLead = includeTests ? { some: {} } : { some: { is_test: false } }
    const notTestCondition: any = {
      OR: [
        { callback_requests: realLead },
        {
          messages: {
            some: {
              role: 'user',
              content: {
                notIn: ['test', 'Test', 'TEST', 'test.', 'Test.', 'testing', 'Testing'],
              },
            },
          },
        },
      ],
    }

    // Build Prisma Where Clause
    const where: any = {}

    if (tab === 'leads') {
      where.callback_requests = realLead
    } else if (tab === 'users') {
      where.user_id = { not: null }
    } else if (tab === 'guests') {
      where.user_id = null
    }

    const conditions: any[] = []

    // is_bot (lib/botDetection.ts) already exists and is already correctly set
    // on exactly this traffic -- crawlers, uptime checks, our own corpus runs
    // and integration tests, none of which point at a separate database. This
    // endpoint never read the flag, so the Conversations Observatory's first
    // page was dominated by that traffic (confirmed: 212 bot sessions in one
    // hour on 2026-10-11 vs. the last real buyer session hours earlier),
    // which is the entire reason "it's always the same chats" was reported.
    // admin.ts's /analytics/users already filters this; bringing this file in
    // line with that, gated by the same includeTests escape hatch so bot
    // traffic stays inspectable on demand rather than invisible.
    if (!includeTests) {
      where.is_bot = false
      conditions.push(notTestCondition)
    }

    if (projectFilter) {
      conditions.push({
        OR: [
          { focus_project: { name: { contains: projectFilter, mode: 'insensitive' } } },
          { focus_project: { slug: { contains: projectFilter, mode: 'insensitive' } } },
          { messages: { some: { content: { contains: projectFilter, mode: 'insensitive' } } } },
        ],
      })
    }

    if (sectorFilter) {
      conditions.push({
        OR: [
          { summary_location: { contains: sectorFilter, mode: 'insensitive' } },
          { messages: { some: { content: { contains: sectorFilter, mode: 'insensitive' } } } },
        ],
      })
    }

    if (q) {
      conditions.push({
        OR: [
          { id: { startsWith: q } },
          { user_id: { contains: q, mode: 'insensitive' } },
          { guest_token: { contains: q, mode: 'insensitive' } },
          { messages: { some: { content: { contains: q, mode: 'insensitive' } } } },
          {
            callback_requests: {
              some: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { phone: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      })
    }

    if (conditions.length === 1) {
      Object.assign(where, conditions[0])
    } else if (conditions.length > 1) {
      where.AND = conditions
    }

    let orderByClause: any = { last_active: 'desc' }
    if (sortBy === 'turns') orderByClause = { message_count: 'desc' }
    else if (sortBy === 'oldest') orderByClause = { created_at: 'asc' }

    const sessionSelect = {
      id: true,
      user_id: true,
      guest_token: true,
      created_at: true,
      last_active: true,
      message_count: true,
      chat_phase: true,
      summary_location: true,
      summary_financial: true,
      summary_timeline: true,
      focus_project_id: true,
      focus_project: {
        select: { id: true, name: true, slug: true, sector: true },
      },
    } as const

    // "Highest AI Cost" has no column on ChatSession to order by — cost lives on
    // aiUsageEvent, summed per session, with no relation to ChatSession. Walk the
    // sessions by spend, highest first, in batches, keeping those that match
    // `where`, until the page is full. Only sessions with recorded spend are
    // ranked; when the page runs past them it is filled with zero-cost matches
    // by recency. Bounded by offset + limit, never every session id.
    let sessions: SessionRow[]
    let totalSessions: number
    if (sortBy === 'cost') {
      totalSessions = await prisma.chatSession.count({ where })
      const want = offset + limit
      const ranked: string[] = []
      const BATCH = 500
      for (let skip = 0; ranked.length < want; skip += BATCH) {
        const batch = await prisma.$queryRaw<Array<{ session_id: string }>>`
          SELECT session_id FROM ai_usage_events WHERE session_id IS NOT NULL
          GROUP BY session_id ORDER BY SUM(cost_usd) DESC, session_id LIMIT ${BATCH} OFFSET ${skip}`
        if (batch.length === 0) break
        const ids = batch.map((b) => b.session_id)
        const hits = new Set((await prisma.chatSession.findMany({ where: { AND: [where, { id: { in: ids } }] }, select: { id: true } })).map((r) => r.id))
        for (const id of ids) if (hits.has(id)) ranked.push(id)
        if (batch.length < BATCH) break
      }
      if (ranked.length < want) {
        // Spend exhausted: top up with zero-spend matches, newest first.
        const zero = await prisma.chatSession.findMany({
          where: { AND: [where, { id: { notIn: ranked } }] },
          orderBy: { last_active: 'desc' },
          take: want - ranked.length,
          select: { id: true },
        })
        ranked.push(...zero.map((z) => z.id))
      }
      const orderedIds = ranked.slice(offset, offset + limit)
      const rows = (await prisma.chatSession.findMany({
        where: { id: { in: orderedIds } },
        select: sessionSelect,
      })) as SessionRow[]
      const rowById = new Map(rows.map((r) => [r.id, r]))
      sessions = orderedIds.map((id) => rowById.get(id)).filter((r): r is SessionRow => Boolean(r))
    } else {
      [sessions, totalSessions] = await Promise.all([
        (prisma.chatSession.findMany({
          where,
          orderBy: orderByClause,
          take: limit,
          skip: offset,
          select: sessionSelect,
        })) as Promise<SessionRow[]>,
        prisma.chatSession.count({ where }),
      ])
    }

    const [
      totalLeadsCount,
      totalCostAgg,
      totalPlatformSessions,
      leadsTabCount,
      usersTabCount,
      guestsTabCount,
    ] = await Promise.all([
      prisma.callbackRequest.count(),
      prisma.aiUsageEvent.aggregate({ _sum: { cost_usd: true } }),
      prisma.chatSession.count({ where: includeTests ? {} : { is_bot: false, ...notTestCondition } }),
      prisma.chatSession.count({ where: { callback_requests: realLead, ...(includeTests ? {} : { is_bot: false }) } }),
      prisma.chatSession.count({ where: { user_id: { not: null }, ...(includeTests ? {} : { is_bot: false, ...notTestCondition }) } }),
      prisma.chatSession.count({ where: { user_id: null, ...(includeTests ? {} : { is_bot: false, ...notTestCondition }) } }),
    ])

    const ids = sessions.map((s) => s.id)
    const userIds = sessions.map((s) => s.user_id).filter(Boolean) as string[]
    const guestTokens = sessions.map((s) => s.guest_token).filter(Boolean) as string[]

    // Batch fetch spend, leads, memories, and opening messages
    const [spend, leads, memories, userMessagesList, sessionMemories] = await Promise.all([
      prisma.aiUsageEvent.groupBy({
        by: ['session_id'],
        where: { session_id: { in: ids } },
        _sum: { cost_usd: true, prompt_tokens: true, completion_tokens: true },
        _count: { _all: true },
      }),
      prisma.callbackRequest.findMany({
        where: {
          OR: [
            { chat_session_id: { in: ids } },
            userIds.length > 0 ? { user_id: { in: userIds } } : { id: 'none' },
            guestTokens.length > 0 ? { guest_token: { in: guestTokens } } : { id: 'none' },
          ],
        },
        select: {
          chat_session_id: true,
          user_id: true,
          guest_token: true,
          name: true,
          phone: true,
          lead_tier: true,
          lead_score: true,
          ai_summary: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.userMemory.findMany({
        where: {
          OR: [
            userIds.length > 0 ? { user_id: { in: userIds } } : { id: 'none' },
            guestTokens.length > 0 ? { guest_token: { in: guestTokens } } : { id: 'none' },
          ],
        },
        select: {
          user_id: true,
          guest_token: true,
          contact_phone: true,
          bhk_preference: true,
          budget_min_cr: true,
          budget_max_cr: true,
          sector_preference: true,
          purpose: true,
        },
      }),
      prisma.chatMessage.findMany({
        where: { session_id: { in: ids }, role: 'user' },
        orderBy: { created_at: 'asc' },
        select: { session_id: true, content: true, created_at: true },
      }),
      prisma.sessionMemory.findMany({
        where: { session_id: { in: ids } },
        select: { session_id: true, requirement_state: true },
      }),
    ])

    const spendBy = new Map(spend.map((s) => [s.session_id, s]))

    // Match leads by chat_session_id, user_id, or guest_token
    const leadBySession = new Map<string, (typeof leads)[0]>()
    for (const l of leads) {
      if (l.chat_session_id && !leadBySession.has(l.chat_session_id)) {
        leadBySession.set(l.chat_session_id, l)
      }
    }
    const leadByUserOrGuest = new Map<string, (typeof leads)[0]>()
    for (const l of leads) {
      if (l.user_id && !leadByUserOrGuest.has(l.user_id)) leadByUserOrGuest.set(l.user_id, l)
      if (l.guest_token && !leadByUserOrGuest.has(l.guest_token)) leadByUserOrGuest.set(l.guest_token, l)
    }

    // Match user memories
    const memMap = new Map<string, (typeof memories)[0]>()
    for (const m of memories) {
      if (m.user_id) memMap.set(m.user_id, m)
      if (m.guest_token) memMap.set(m.guest_token, m)
    }

    // Group user messages by session
    const userMsgsBySession = new Map<string, Array<{ content: string; created_at: Date }>>()
    for (const m of userMessagesList) {
      if (!userMsgsBySession.has(m.session_id)) {
        userMsgsBySession.set(m.session_id, [])
      }
      userMsgsBySession.get(m.session_id)!.push(m)
    }

    // What this buyer actually stated, distilled from RequirementState — a
    // one-line summary per row so the list is scannable without opening every
    // transcript. Degrades to null when nothing was ever parsed for a session
    // (e.g. a connection-only session with no real turns).
    const reqStateBySession = new Map(sessionMemories.map((m) => [m.session_id, m.requirement_state]))
    const summarizeRequirementState = (raw: unknown): string | null => {
      if (!raw || typeof raw !== 'object') return null
      const rs = raw as Record<string, any>
      const parts: string[] = []
      if (rs.unit?.bhk?.length) parts.push(`${rs.unit.bhk.join('/')}BHK`)
      if (rs.location?.include?.length) parts.push(rs.location.include.join(', '))
      if (rs.budget?.maxCr !== undefined && rs.budget?.maxCr !== null) {
        parts.push(`${rs.budget.isHardCeiling ? '≤' : '~'}₹${rs.budget.maxCr}Cr`)
      }
      if (rs.unit?.status && rs.unit.status !== 'any') parts.push(rs.unit.status.replace(/_/g, ' '))
      if (rs.preferences?.requiredAmenities?.length) parts.push(rs.preferences.requiredAmenities.join(', '))
      return parts.length > 0 ? parts.join(' · ') : null
    }

    res.json({
      sessions: sessions.map((s) => {
        const sp = spendBy.get(s.id)
        const lead =
          leadBySession.get(s.id) ||
          (s.user_id ? leadByUserOrGuest.get(s.user_id) : null) ||
          (s.guest_token ? leadByUserOrGuest.get(s.guest_token) : null)
        const mem = (s.user_id ? memMap.get(s.user_id) : null) || (s.guest_token ? memMap.get(s.guest_token) : null)

        // Connected User Dossier Identity
        const userProfile = {
          // No invented names: the UI labels an unnamed account by its kind.
          name: lead?.name || null,
          phone: lead?.phone || mem?.contact_phone || null,
          isRegistered: Boolean(s.user_id),
          leadTier: lead?.lead_tier || null,
          leadScore: lead?.lead_score || null,
          preferredSector: mem?.sector_preference || s.summary_location || null,
          bhkPreference: mem?.bhk_preference || null,
          budgetMin: mem?.budget_min_cr || null,
          budgetMax: mem?.budget_max_cr || null,
        }

        const sessionMsgs = userMsgsBySession.get(s.id) || []
        const openingMsg = sessionMsgs[0] || null
        const latestMsg = sessionMsgs[sessionMsgs.length - 1] || null
        const queryTimestamp = latestMsg?.created_at ? latestMsg.created_at.toISOString() : s.last_active.toISOString()

        return {
          id: s.id,
          identity: s.user_id ? { kind: 'user', id: s.user_id } : { kind: 'guest', id: s.guest_token },
          user: userProfile,
          statedRequirements: summarizeRequirementState(reqStateBySession.get(s.id)),
          openingQuestion: openingMsg ? openingMsg.content : null,
          latestQuery: latestMsg ? { content: latestMsg.content, at: latestMsg.created_at.toISOString() } : null,
          queryTime: queryTimestamp,
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
          lead: lead ? { tier: lead.lead_tier, at: lead.created_at, name: lead.name, phone: lead.phone } : null,
          focusProject: s.focus_project || null,
          summaryLocation: s.summary_location,
        }
      }),
      pagination: { limit, offset, returned: sessions.length },
      tabCounts: {
        all: totalPlatformSessions,
        leads: leadsTabCount,
        users: usersTabCount,
        guests: guestsTabCount,
      },
      total: totalSessions,
      totalLeads: totalLeadsCount,
      totalCostUsd: Number(totalCostAgg._sum.cost_usd || 0),
    })
  }),
)

betaRouter.get(
  '/metrics',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const days = Math.min(Number(req.query.days ?? 7), 90)
    const since = new Date(Date.now() - days * 86_400_000)

    // Aggregated in the database: no message content is loaded except the 40 gap
    // examples and the top-query groups. `[^\w\s]` and `\s` mean the same in Postgres
    // and JS regexes for ASCII text, so the normalisation matches the earlier JS one.
    const [sessions, [turnRow], topQueryRows, [gapRow], gapQueryRows, leads, usage] = await Promise.all([
      // Sessions with no messages are excluded from every denominator here.
      // A guest session is created on the first request, before we know a
      // message will follow, so 6,452 of 14,762 rows had zero turns — 44% — and
      // they dragged turns-per-session to 0.58 and the conversion rate to
      // almost nothing. They are connection attempts, not conversations.
      prisma.chatSession.findMany({
        where: { created_at: { gte: since }, message_count: { gt: 0 }, is_bot: false },
        select: { id: true, message_count: true },
      }),
      prisma.$queryRaw<Array<{ turns: number }>>`
        SELECT COUNT(*)::int AS turns FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
        WHERE m.created_at >= ${since} AND m.role = 'user' AND s.is_bot = false`,
      // What they actually typed, normalised so casing and spacing do not split
      // one question into five.
      prisma.$queryRaw<Array<{ query: string; count: number }>>`
        SELECT k AS query, COUNT(*)::int AS count FROM (
          SELECT trim(regexp_replace(regexp_replace(lower(m.content), ${'[^\\w\\s]'}, ' ', 'g'), ${'\\s+'}, ' ', 'g')) AS k
          FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
          WHERE m.created_at >= ${since} AND m.role = 'user' AND s.is_bot = false
        ) n WHERE length(k) >= 3 GROUP BY k ORDER BY count DESC, k LIMIT 30`,
      // Coverage gaps our own answers admitted to (COVERAGE_GAP, same pattern in SQL).
      prisma.$queryRaw<Array<{ sessions: number }>>`
        SELECT COUNT(DISTINCT m.session_id)::int AS sessions FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
        WHERE m.created_at >= ${since} AND m.role = 'assistant' AND s.is_bot = false AND m.content ~* ${COVERAGE_GAP.source}`,
      prisma.$queryRaw<Array<{ content: string }>>`
        SELECT m.content FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
        WHERE m.created_at >= ${since} AND m.role = 'user' AND s.is_bot = false
          AND m.session_id IN (SELECT a.session_id FROM chat_messages a WHERE a.created_at >= ${since}
                               AND a.role = 'assistant' AND a.content ~* ${COVERAGE_GAP.source})
        ORDER BY m.created_at DESC LIMIT 40`,
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
    const userTurns = turnRow.turns

    // Where conversations end. A one-turn session is a bounce; the shape of
    // this histogram is the clearest read on whether the product holds anyone.
    const turnHistogram = new Map<number, number>()
    for (const s of sessions) {
      const turns = Math.min(Math.floor(s.message_count / 2), 10)
      turnHistogram.set(turns, (turnHistogram.get(turns) ?? 0) + 1)
    }

    const gapSessionCount = gapRow.sessions
    const gapQueries = gapQueryRows.map((m) => m.content)

    const emptySessions = await prisma.chatSession.count({
      where: { created_at: { gte: since }, message_count: 0, is_bot: false },
    })
    const totalCost = Number(usage._sum.cost_usd ?? 0)
    const leadSessions = new Set(leads.map((l) => l.chat_session_id).filter(Boolean))

    res.json({
      window: { days, since },
      volume: {
        sessions: sessions.length,
        emptySessionsExcluded: emptySessions,
        turns: userTurns,
        turnsPerSession: sessions.length ? +(userTurns / sessions.length).toFixed(2) : 0,
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
      topQueries: topQueryRows,
      coverageGaps: {
        affectedSessions: gapSessionCount,
        pctOfSessions: sessions.length ? +((gapSessionCount / sessions.length) * 100).toFixed(1) : 0,
        queries: gapQueries,
      },
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
        where: {
          OR: [
            { chat_session_id: id },
            session.user_id ? { user_id: session.user_id } : { id: 'none' },
            session.guest_token ? { guest_token: session.guest_token } : { id: 'none' },
          ],
        },
        select: { name: true, phone: true, lead_tier: true, lead_score: true, ai_summary: true, created_at: true },
        orderBy: { created_at: 'desc' },
      }),
    ])

    // Fetch user memory and other sessions by same user/guest
    const userIdentifier = session.user_id
      ? { user_id: session.user_id }
      : session.guest_token
      ? { guest_token: session.guest_token }
      : null

    const [userMemory, otherSessions, focusProject] = await Promise.all([
      userIdentifier
        ? prisma.userMemory.findFirst({
            where: userIdentifier,
            select: {
              contact_phone: true,
              bhk_preference: true,
              budget_min_cr: true,
              budget_max_cr: true,
              sector_preference: true,
              purpose: true,
              saved_slugs: true,
              viewed_slugs: true,
            },
          })
        : null,
      userIdentifier
        ? prisma.chatSession.findMany({
            where: {
              ...userIdentifier,
              id: { not: id },
            },
            select: {
              id: true,
              created_at: true,
              last_active: true,
              message_count: true,
              chat_phase: true,
            },
            orderBy: { last_active: 'desc' },
            take: 6,
          })
        : [],
      session.focus_project_id
        ? prisma.project.findUnique({
            where: { id: session.focus_project_id },
            select: { id: true, name: true, slug: true, sector: true },
          })
        : null,
    ])

    // What the buyer actually asked for, distilled from RequirementState
    // (lib/discovery/requirementState.ts) rather than re-read from the raw
    // transcript by eye. Until this session's persistence work, this snapshot
    // didn't exist anywhere past the end of a single turn.
    const sessionMemory = await prisma.sessionMemory.findUnique({
      where: { session_id: id },
      select: { requirement_state: true },
    })
    const requirementSnapshot = (() => {
      const raw = sessionMemory?.requirement_state
      if (!raw || typeof raw !== 'object') return null
      const rs = raw as Record<string, any>
      return {
        sectors: rs.location?.include ?? [],
        excludedSectors: rs.location?.exclude ?? [],
        softSectors: rs.location?.softPreferences ?? [],
        budgetMaxCr: rs.budget?.maxCr ?? null,
        budgetMinCr: rs.budget?.minCr ?? null,
        isHardCeiling: Boolean(rs.budget?.isHardCeiling),
        bhk: rs.unit?.bhk ?? [],
        possessionStatus: rs.unit?.status && rs.unit.status !== 'any' ? rs.unit.status : null,
        possessionDeadlineYears: rs.unit?.possessionDeadlineYears ?? null,
        requiredAmenities: rs.preferences?.requiredAmenities ?? [],
        preferredAmenities: rs.preferences?.preferredAmenities ?? [],
        useCase: rs.preferences?.useCase && rs.preferences.useCase !== 'unknown' ? rs.preferences.useCase : null,
        allowedCompromises: rs.control?.allowedCompromises ?? [],
      }
    })()

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
        focusProject,
      },
      userDossier: {
        name: lead?.name || null,
        phone: lead?.phone || userMemory?.contact_phone || null,
        isRegistered: Boolean(session.user_id),
        leadTier: lead?.lead_tier || null,
        leadScore: lead?.lead_score || null,
        aiSummary: lead?.ai_summary || null,
        memory: userMemory || null,
        otherSessions: otherSessions.map((s) => ({
          id: s.id,
          turns: Math.floor(s.message_count / 2),
          phase: s.chat_phase,
          lastActiveAt: s.last_active,
        })),
      },
      turns,
      lead,
      requirementSnapshot,
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
