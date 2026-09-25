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
  summary_location: string | null
  summary_financial: string | null
  summary_timeline: string | null
  focus_project_id: string | null
  focus_project?: { id: string; name: string; slug: string; sector: string } | null
}

// ── In-Memory Cached Intelligence for Instant Response (<10ms) ──────────────
let cachedIntelligence: { data: any; timestamp: number } | null = null

betaRouter.get(
  ['/intelligence', '/top-entities'],
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Return cached intelligence if under 60 seconds old
    if (cachedIntelligence && Date.now() - cachedIntelligence.timestamp < 60_000) {
      res.json(cachedIntelligence.data)
      return
    }

    try {
      const [focusedAgg, topProjectsList, userMessages, totalSessions, totalLeads, dbSectorsList, sessionLocations] = await Promise.all([
        prisma.chatSession.groupBy({
          by: ['focus_project_id'],
          where: { focus_project_id: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { focus_project_id: 'desc' } },
          take: 20,
        }),
        prisma.project.findMany({
          select: { id: true, name: true, slug: true, sector: true },
          take: 120,
        }),
        prisma.chatMessage.findMany({
          where: {
            role: 'user',
            content: { notIn: ['test', 'Test', 'TEST', 'test.', 'Test.', 'testing', 'Testing'] },
          },
          select: { content: true, session_id: true },
          orderBy: { created_at: 'desc' },
          take: 4000,
        }),
        prisma.chatSession.count({
          where: {
            message_count: { gt: 0 },
            messages: {
              some: {
                role: 'user',
                content: { notIn: ['test', 'Test', 'TEST', 'test.', 'Test.', 'testing', 'Testing'] },
              },
            },
          },
        }),
        prisma.callbackRequest.count(),
        prisma.project.findMany({
          where: { sector: { not: '' } },
          distinct: ['sector'],
          select: { sector: true },
        }),
        prisma.chatSession.groupBy({
          by: ['summary_location'],
          where: { summary_location: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { summary_location: 'desc' } },
          take: 40,
        }),
      ])

      const projectCountMap = new Map<string, { id: string; name: string; slug: string; sector: string; count: number }>()

      // 1. Seed from focused project aggregations
      const projectById = new Map(topProjectsList.map((p) => [p.id, p]))
      for (const f of focusedAgg) {
        if (!f.focus_project_id) continue
        const proj = projectById.get(f.focus_project_id)
        if (proj) {
          projectCountMap.set(proj.name, {
            id: proj.id,
            name: proj.name,
            slug: proj.slug,
            sector: proj.sector,
            count: f._count._all * 3, // Weighted priority
          })
        }
      }

      // 2. Scan recent user messages for project mentions
      for (const p of topProjectsList) {
        const pNameLower = p.name.toLowerCase()
        let count = 0
        for (const m of userMessages) {
          if (m.content.toLowerCase().includes(pNameLower)) count++
        }
        if (count > 0 || projectCountMap.has(p.name)) {
          const existing = projectCountMap.get(p.name)
          const total = (existing?.count || 0) + count
          projectCountMap.set(p.name, {
            id: p.id,
            name: p.name,
            slug: p.slug,
            sector: p.sector,
            count: total,
          })
        }
      }

      const topProjects = Array.from(projectCountMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)

      // 3. Scan Sector Mentions dynamically from database projects & session locations
      const allDiscoveredSectors = new Set<string>()
      for (const s of dbSectorsList) {
        if (s.sector && s.sector.trim().length > 1) allDiscoveredSectors.add(s.sector.trim())
      }
      const locationCountMap = new Map<string, number>()
      for (const loc of sessionLocations) {
        if (loc.summary_location && loc.summary_location.trim().length > 1) {
          allDiscoveredSectors.add(loc.summary_location.trim())
          locationCountMap.set(loc.summary_location.trim().toLowerCase(), loc._count._all)
        }
      }

      const sectorCounts: Array<{ sector: string; count: number }> = []
      for (const sec of allDiscoveredSectors) {
        const sLower = sec.toLowerCase()
        let count = (locationCountMap.get(sLower) || 0) * 2
        for (const m of userMessages) {
          if (m.content.toLowerCase().includes(sLower)) count++
        }
        if (count > 0) {
          sectorCounts.push({ sector: sec, count })
        }
      }
      sectorCounts.sort((a, b) => b.count - a.count)
      const topSectors = sectorCounts.slice(0, 20)

      // 4. Extract Top Buyer Inquiry Questions
      const queryMap = new Map<string, number>()
      for (const m of userMessages) {
        const text = m.content.replace(/[?!.]/g, '').trim()
        if (text.length > 8 && text.length < 100) {
          queryMap.set(text, (queryMap.get(text) || 0) + 1)
        }
      }
      const topQueries = Array.from(queryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([query, count]) => ({ query, count }))

      const responsePayload = {
        topProjects,
        topSectors,
        topQueries,
        userMetrics: {
          totalEngagedSessions: totalSessions,
          capturedLeads: totalLeads,
          leadConversionRate: totalSessions > 0 ? +((totalLeads / totalSessions) * 100).toFixed(1) : 0,
        },
      }

      cachedIntelligence = { data: responsePayload, timestamp: Date.now() }
      res.json(responsePayload)
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
    const notTestCondition: any = {
      OR: [
        { callback_requests: { some: {} } },
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
      where.callback_requests = { some: {} }
    } else if (tab === 'users') {
      where.user_id = { not: null }
    } else if (tab === 'guests') {
      where.user_id = null
    }

    const conditions: any[] = []

    if (!includeTests) {
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

    const [
      sessions,
      totalSessions,
      totalLeadsCount,
      totalCostAgg,
      totalPlatformSessions,
      leadsTabCount,
      usersTabCount,
      guestsTabCount,
    ] = await Promise.all([
      (prisma.chatSession.findMany({
        where,
        orderBy: orderByClause,
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
          summary_location: true,
          summary_financial: true,
          summary_timeline: true,
          focus_project_id: true,
          focus_project: {
            select: { id: true, name: true, slug: true, sector: true },
          },
        },
      })) as Promise<SessionRow[]>,
      prisma.chatSession.count({ where }),
      prisma.callbackRequest.count(),
      prisma.aiUsageEvent.aggregate({ _sum: { cost_usd: true } }),
      prisma.chatSession.count({ where: includeTests ? {} : notTestCondition }),
      prisma.chatSession.count({ where: { callback_requests: { some: {} } } }),
      prisma.chatSession.count({ where: { user_id: { not: null }, ...(includeTests ? {} : notTestCondition) } }),
      prisma.chatSession.count({ where: { user_id: null, ...(includeTests ? {} : notTestCondition) } }),
    ])

    const ids = sessions.map((s) => s.id)
    const userIds = sessions.map((s) => s.user_id).filter(Boolean) as string[]
    const guestTokens = sessions.map((s) => s.guest_token).filter(Boolean) as string[]

    // Batch fetch spend, leads, memories, and opening messages
    const [spend, leads, memories, userMessagesList] = await Promise.all([
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
          name: lead?.name || (s.user_id ? 'Registered User' : null),
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
        name: lead?.name || (session.user_id ? 'Registered User' : null),
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
