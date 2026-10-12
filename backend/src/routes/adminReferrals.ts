// backend/src/routes/adminReferrals.ts
//
// SUPER_ADMIN only — see lib/adminPolicy.ts, which denies this whole path to
// SALES and ANALYST. Mounted under /api/v1/admin/referrals, so adminAreaGuard
// (identity, staff floor, role matrix, field redaction, read audit) applies
// automatically — this router never re-checks role itself, the same
// convention as adminBoards.ts.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import type { AdminIdentitySession } from '../lib/adminIdentity'
import { generateReferralCode } from '../lib/referralCode'
import {
  computeKFactor,
  classifyFunnelStage,
  detectBroadcastWindows,
  summariseDeviceEngagement,
  bucketArrivals,
  type TrendGranularity,
} from '../lib/referralGrowthMetrics'

export const adminReferralsRouter = Router()

function identity(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

export interface ActivationBreakdown {
  /**
   * Activated = 3+ messages summed across the device's human chats, OR a
   * return (human chats spanning 24h+), OR a callback / dossier / site-visit
   * request. See summariseDeviceEngagement.
   */
  activated: Set<string>
  hasCallback: Set<string>
  hasDossier: Set<string>
  hasSiteVisit: Set<string>
  messageCountByGuest: Map<string, number>
  /** Devices whose every chat session is a bot session — excluded from the funnel. */
  botOnly: Set<string>
}

/** Visits minus bot-only devices: the population every funnel number is about. */
function humanOnly<T extends { guest_token: string }>(visits: T[], botOnly: Set<string>): T[] {
  return botOnly.size === 0 ? visits : visits.filter((v) => !botOnly.has(v.guest_token))
}

/**
 * Splits an array into fixed-size chunks — used to keep `WHERE x IN (...)`
 * queries under Postgres's bind-variable limit when a guest-token or
 * session-id list can run into the tens of thousands (the live referral_visits
 * table is well past that size).
 */
function chunk<T>(arr: T[], size = 1000): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Computed here rather than stored, since the inputs (message count, saves,
 * callbacks) already live on ChatSession and CallbackRequest and would drift
 * if duplicated onto ReferralVisit. Returns the individual conversion-event
 * sets too, so callers (funnel classification) don't re-query.
 */
async function computeActivationBreakdown(guestTokens: string[]): Promise<ActivationBreakdown> {
  const empty: ActivationBreakdown = {
    activated: new Set(),
    hasCallback: new Set(),
    hasDossier: new Set(),
    hasSiteVisit: new Set(),
    messageCountByGuest: new Map(),
    botOnly: new Set(),
  }
  if (guestTokens.length === 0) return empty
  const batches = chunk(guestTokens)

  const sessionRows: { guest_token: string | null; message_count: number; last_active: Date; created_at: Date; is_bot: boolean }[] = []
  for (const batch of batches) {
    sessionRows.push(
      ...(await prisma.chatSession.findMany({
        where: { guest_token: { in: batch } },
        select: { guest_token: true, message_count: true, last_active: true, created_at: true, is_bot: true },
      })),
    )
  }
  const { messageCountByGuest, engaged, botOnly } = summariseDeviceEngagement(sessionRows)
  const activated = new Set(engaged)

  const hasCallback = new Set<string>()
  const hasDossier = new Set<string>()
  const hasSiteVisit = new Set<string>()
  for (const batch of batches) {
    const [callbacks, dossiers, siteVisits] = await Promise.all([
      prisma.callbackRequest.findMany({ where: { guest_token: { in: batch } }, select: { guest_token: true } }),
      prisma.dossier.findMany({ where: { guest_token: { in: batch } }, select: { guest_token: true } }),
      prisma.siteVisitRequest.findMany({ where: { guest_token: { in: batch } }, select: { guest_token: true } }),
    ])
    for (const c of callbacks) {
      if (c.guest_token) {
        hasCallback.add(c.guest_token)
        activated.add(c.guest_token)
      }
    }
    for (const d of dossiers) {
      if (d.guest_token) {
        hasDossier.add(d.guest_token)
        activated.add(d.guest_token)
      }
    }
    for (const v of siteVisits) {
      if (v.guest_token) {
        hasSiteVisit.add(v.guest_token)
        activated.add(v.guest_token)
      }
    }
  }

  return { activated, hasCallback, hasDossier, hasSiteVisit, messageCountByGuest, botOnly }
}

type Granularity = TrendGranularity

function parseGranularity(raw: unknown): Granularity {
  return raw === 'weekly' || raw === 'all' ? raw : 'daily'
}

async function adminEmailMap(adminIds: (string | null)[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(adminIds.filter((id): id is string => Boolean(id))))
  if (ids.length === 0) return new Map()
  const admins = await prisma.adminUser.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })
  return new Map(admins.map((a) => [a.id, a.email]))
}

/** Most frequent non-null value in a list, or null when the list is empty. */
function mode<T>(values: T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: T | null = null
  let bestCount = 0
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  }
  return best
}

adminReferralsRouter.post('/', async (req: Request, res: Response) => {
  const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 60) : ''
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null
  const greetingName = typeof req.body?.greetingName === 'string' ? req.body.greetingName.trim().slice(0, 60) : null

  if (!label) {
    res.status(400).json({ error: 'label is required' })
    return
  }

  try {
    let code = generateReferralCode()
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.referralLink.findUnique({ where: { code } })
      if (!clash) break
      code = generateReferralCode()
    }

    await prisma.referralLink.create({
      data: {
        code,
        kind: 'ROOT',
        label,
        note,
        greeting_name: greetingName,
        created_by_admin_id: identity(req).adminUserId,
      },
    })

    res.status(201).json({ code, url: `/r/${code}` })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:CREATE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to create referral link' })
  }
})

adminReferralsRouter.get('/', async (req: Request, res: Response) => {
  const scope = req.query.scope === 'mine' ? 'mine' : 'all'
  const me = identity(req)

  try {
    const links = await prisma.referralLink.findMany({
      where: {
        kind: 'ROOT',
        ...(scope === 'mine' ? { created_by_admin_id: me.adminUserId } : {}),
      },
      orderBy: { created_at: 'desc' },
    })

    const rawVisits = await prisma.referralVisit.findMany({
      where: { root_code: { in: links.map((l) => l.code) } },
      select: { guest_token: true, root_code: true, arrived_via_code: true, generation: true, first_seen_at: true },
    })

    const { activated, botOnly } = await computeActivationBreakdown(rawVisits.map((v) => v.guest_token))
    const allVisits = humanOnly(rawVisits, botOnly)
    const emailByAdminId = await adminEmailMap([
      ...links.map((l) => l.created_by_admin_id),
      ...links.map((l) => l.revoked_by_admin_id),
    ])

    const result = links.map((link) => {
      const visits = allVisits.filter((v) => v.root_code === link.code)
      const deepestGeneration = visits.reduce((max, v) => Math.max(max, v.generation), 0)
      const activatedCount = visits.filter((v) => activated.has(v.guest_token)).length
      const lastActivity = visits.reduce<Date | null>((latest, v) => (!latest || v.first_seen_at > latest ? v.first_seen_at : latest), null)
      const trendSparkline = bucketArrivals(visits.map((v) => v.first_seen_at), 'daily').slice(-14)
      const directArrivals = allVisits.filter((v) => v.arrived_via_code === link.code)
      const broadcastFlagged =
        detectBroadcastWindows(
          directArrivals.map((v) => ({ arrivedAt: v.first_seen_at })),
          10,
        ).length > 0

      return {
        code: link.code,
        label: link.label,
        greetingName: link.greeting_name,
        note: link.note,
        createdByAdminId: link.created_by_admin_id,
        createdByEmail: link.created_by_admin_id ? emailByAdminId.get(link.created_by_admin_id) ?? 'former admin' : null,
        revokedByEmail: link.revoked_by_admin_id ? emailByAdminId.get(link.revoked_by_admin_id) ?? 'former admin' : null,
        createdAt: link.created_at,
        revoked: Boolean(link.revoked_at),
        devicesReached: visits.length,
        deepestGeneration,
        activatedCount,
        lastActivity,
        hasHolder: Boolean(link.holder_guest_token),
        trendSparkline,
        broadcastFlagged,
      }
    })

    res.json({ links: result })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:LIST_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to load referral links' })
  }
})

adminReferralsRouter.post('/:code/revoke', async (req: Request, res: Response) => {
  const { code } = req.params
  try {
    const link = await prisma.referralLink.findUnique({ where: { code } })
    if (!link) {
      res.status(404).json({ error: 'Referral link not found' })
      return
    }
    await prisma.referralLink.update({
      where: { code },
      data: { revoked_at: new Date(), revoked_by_admin_id: identity(req).adminUserId },
    })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:REVOKE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to revoke referral link' })
  }
})

adminReferralsRouter.post('/:code/reset-holder', async (req: Request, res: Response) => {
  const { code } = req.params
  try {
    const link = await prisma.referralLink.findUnique({ where: { code } })
    if (!link || link.kind !== 'ROOT') {
      res.status(404).json({ error: 'Root referral link not found' })
      return
    }
    await prisma.referralLink.update({ where: { code }, data: { holder_guest_token: null } })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset holder' })
  }
})

adminReferralsRouter.get('/:code/tree', async (req: Request, res: Response) => {
  const { code } = req.params
  try {
    const root = await prisma.referralLink.findUnique({ where: { code } })
    if (!root) {
      res.status(404).json({ error: 'Referral link not found' })
      return
    }

    const rawVisits = await prisma.referralVisit.findMany({
      where: { root_code: code },
      orderBy: [{ generation: 'asc' }, { first_seen_at: 'asc' }],
    })

    const breakdown = await computeActivationBreakdown(rawVisits.map((v) => v.guest_token))
    const visits = humanOnly(rawVisits, breakdown.botOnly)

    const nodes = visits.map((v) => {
      const messageCount = breakdown.messageCountByGuest.get(v.guest_token) ?? 0
      const activated = breakdown.activated.has(v.guest_token)
      const funnelStage = classifyFunnelStage({
        messageCount,
        activated,
        hasCallback: breakdown.hasCallback.has(v.guest_token),
        hasDossier: breakdown.hasDossier.has(v.guest_token),
        hasSiteVisit: breakdown.hasSiteVisit.has(v.guest_token),
      })
      return {
        guestToken: v.guest_token,
        label: v.generation === 1 ? root.label : null,
        generation: v.generation,
        parentGuestToken: v.parent_guest_token,
        depthInferred: v.depth_inferred,
        deviceClass: v.device_class,
        os: v.os,
        appGuess: v.app_guess,
        shareChannel: v.share_channel,
        messageCount,
        activated,
        firstSeenAt: v.first_seen_at,
        funnelStage,
        visitCount: v.visit_count,
        lastSeenAt: v.last_seen_at,
      }
    })

    res.json({ root: { code: root.code, label: root.label, revoked: Boolean(root.revoked_at) }, nodes })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:TREE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to load referral tree' })
  }
})

adminReferralsRouter.get('/nodes/:guestToken', async (req: Request, res: Response) => {
  const { guestToken } = req.params
  try {
    const visit = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
    if (!visit) {
      res.status(404).json({ error: 'No visit found for this guest token' })
      return
    }

    const sessions = await prisma.chatSession.findMany({
      where: { guest_token: guestToken },
      select: {
        id: true,
        message_count: true,
        last_active: true,
        summary_location: true,
        summary_financial: true,
        summary_timeline: true,
      },
      orderBy: { last_active: 'desc' },
    })

    const callbacks = await prisma.callbackRequest.count({ where: { guest_token: guestToken } })
    const dossiersMade = await prisma.dossier.count({ where: { guest_token: guestToken } })

    const latest = sessions[0]

    res.json({
      node: {
        guestToken: visit.guest_token,
        generation: visit.generation,
        rootCode: visit.root_code,
        deviceClass: visit.device_class,
        os: visit.os,
        appGuess: visit.app_guess,
        depthInferred: visit.depth_inferred,
        firstSeenAt: visit.first_seen_at,
        summary: latest
          ? {
              location: latest.summary_location,
              financial: latest.summary_financial,
              timeline: latest.summary_timeline,
            }
          : null,
        actions: {
          callbacks,
          dossiersMade,
        },
        chats: sessions.map((s) => ({ id: s.id, messageCount: s.message_count, lastActive: s.last_active })),
      },
    })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:NODE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to load referral node' })
  }
})

adminReferralsRouter.get('/:code/trends', async (req: Request, res: Response) => {
  const { code } = req.params
  const granularity = parseGranularity(req.query.granularity)
  try {
    const root = await prisma.referralLink.findUnique({ where: { code } })
    if (!root) {
      res.status(404).json({ error: 'Referral link not found' })
      return
    }
    const rawVisits = await prisma.referralVisit.findMany({
      where: { root_code: code },
      select: { guest_token: true, first_seen_at: true },
    })
    const { botOnly } = await computeActivationBreakdown(rawVisits.map((v) => v.guest_token))
    const visits = humanOnly(rawVisits, botOnly)
    const buckets = bucketArrivals(
      visits.map((v) => v.first_seen_at),
      granularity,
    )
    res.json({ buckets })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:TRENDS_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to load referral trends' })
  }
})

/**
 * One aggregate call backing the growth summary strip, the By Admin tab, and
 * the referred-vs-organic comparison section. SUPER_ADMIN only (enforced by
 * adminPolicy at the router-mount level, same as the rest of this file).
 */
adminReferralsRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const links = await prisma.referralLink.findMany({ where: { kind: 'ROOT' } })
    const codes = links.map((l) => l.code)

    const rawVisits = await prisma.referralVisit.findMany({
      where: { root_code: { in: codes } },
      select: {
        guest_token: true,
        root_code: true,
        generation: true,
        share_channel: true,
        device_class: true,
        first_seen_at: true,
      },
    })
    const { activated, botOnly } = await computeActivationBreakdown(rawVisits.map((v) => v.guest_token))
    const allVisits = humanOnly(rawVisits, botOnly)

    // ── growthSummary + byAdmin: network-wide and per-admin K-factor from
    // generation -> activated-count buckets. ──────────────────────────────
    const generationCounts = (visits: typeof allVisits) => {
      const byGen = new Map<number, number>()
      for (const v of visits) {
        if (!activated.has(v.guest_token)) continue
        byGen.set(v.generation, (byGen.get(v.generation) ?? 0) + 1)
      }
      return Array.from(byGen.entries()).map(([generation, activatedCount]) => ({ generation, activatedCount }))
    }

    const networkKFactor = computeKFactor(generationCounts(allVisits))

    const totalActiveReach = links
      .filter((l) => !l.revoked_at)
      .reduce((sum, l) => sum + allVisits.filter((v) => v.root_code === l.code).length, 0)

    const byAdminMap = new Map<string, typeof links>()
    for (const l of links) {
      if (!l.created_by_admin_id) continue
      if (!byAdminMap.has(l.created_by_admin_id)) byAdminMap.set(l.created_by_admin_id, [])
      byAdminMap.get(l.created_by_admin_id)!.push(l)
    }
    const emailByAdminId = await adminEmailMap(Array.from(byAdminMap.keys()))

    const byAdmin = Array.from(byAdminMap.entries()).map(([adminId, adminLinks]) => {
      const adminCodes = new Set(adminLinks.map((l) => l.code))
      const adminVisits = allVisits.filter((v) => adminCodes.has(v.root_code))
      const kFactor = computeKFactor(generationCounts(adminVisits))
      const bestChannel = mode(adminVisits.map((v) => v.share_channel).filter((c): c is string => Boolean(c)))
      const reachByCode = new Map<string, number>()
      for (const v of adminVisits) reachByCode.set(v.root_code, (reachByCode.get(v.root_code) ?? 0) + 1)
      let topLink: { code: string; label: string | null; devicesReached: number } | null = null
      for (const l of adminLinks) {
        const reach = reachByCode.get(l.code) ?? 0
        if (!topLink || reach > topLink.devicesReached) topLink = { code: l.code, label: l.label, devicesReached: reach }
      }
      return {
        adminId,
        email: emailByAdminId.get(adminId) ?? 'former admin',
        linksCreated: adminLinks.length,
        totalDevicesReached: adminVisits.length,
        blendedKFactor: kFactor.blended,
        bestChannel,
        topLink,
      }
    })

    const topAdmin = byAdmin.reduce<(typeof byAdmin)[number] | null>(
      (best, a) => (!best || a.totalDevicesReached > best.totalDevicesReached ? a : best),
      null,
    )
    const bestChannelOverall = mode(allVisits.map((v) => v.share_channel).filter((c): c is string => Boolean(c)))

    const broadcastFlaggedCount = links.filter((l) => {
      const direct = allVisits.filter((v) => v.root_code === l.code)
      return detectBroadcastWindows(direct.map((v) => ({ arrivedAt: v.first_seen_at })), 10).length > 0
    }).length

    // ── comparison: referred vs organic, per person (guest token). ──────
    // Referred: arrived through someone (generation >= 1). Organic: has human
    // chats and no referred arrival. A codeless landing also writes a
    // generation-0 visit row, so "has no visit row" would leave out almost
    // every organic visitor — generation is the test.
    const referredGuestTokens = new Set(allVisits.filter((v) => v.generation >= 1).map((v) => v.guest_token))

    const referredSessions: { id: string; guest_token: string | null; message_count: number }[] = []
    for (const batch of chunk(Array.from(referredGuestTokens))) {
      referredSessions.push(
        ...(await prisma.chatSession.findMany({
          where: { is_bot: false, guest_token: { in: batch } },
          select: { id: true, guest_token: true, message_count: true },
        })),
      )
    }
    const organicCandidateSessions = await prisma.chatSession.findMany({
      where: { is_bot: false, guest_token: { not: null } },
      select: { id: true, guest_token: true, message_count: true },
    })
    const organicSessions = organicCandidateSessions.filter((s) => s.guest_token && !referredGuestTokens.has(s.guest_token))

    async function cohortStats(sessions: { id: string; guest_token: string | null; message_count: number }[]) {
      // Rates are per person: one device with five chats counts once.
      const people = Array.from(new Set(sessions.map((s) => s.guest_token).filter((g): g is string => Boolean(g))))
      const breakdown = await computeActivationBreakdown(people)
      const activatedCount = people.filter((g) => breakdown.activated.has(g)).length
      const convertedCount = people.filter(
        (g) => breakdown.hasCallback.has(g) || breakdown.hasDossier.has(g) || breakdown.hasSiteVisit.has(g),
      ).length
      const avgMessages =
        people.length > 0 ? people.reduce((sum, g) => sum + (breakdown.messageCountByGuest.get(g) ?? 0), 0) / people.length : 0

      const memories: { requirement_state: unknown }[] = []
      for (const batch of chunk(sessions.map((s) => s.id))) {
        memories.push(
          ...(await prisma.sessionMemory.findMany({
            where: { session_id: { in: batch }, requirement_state: { not: null as any } },
            select: { requirement_state: true },
          })),
        )
      }
      const budgetBands: Record<string, number> = {}
      let hardCeiling = 0
      let softCeiling = 0
      const sectorCounts: Record<string, number> = {}
      const bhkCounts: Record<string, number> = {}
      const possessionCounts: Record<string, number> = {}
      const amenityCounts: Record<string, number> = {}
      for (const m of memories) {
        const rs = m.requirement_state as any
        if (!rs || typeof rs !== 'object') continue
        if (typeof rs.budget?.maxCr === 'number') {
          const band = `${Math.floor(rs.budget.maxCr)}-${Math.floor(rs.budget.maxCr) + 1}Cr`
          budgetBands[band] = (budgetBands[band] ?? 0) + 1
          if (rs.budget.isHardCeiling) hardCeiling++
          else softCeiling++
        }
        for (const sector of rs.location?.include ?? []) {
          sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1
        }
        for (const bhk of rs.unit?.bhk ?? []) {
          const key = String(bhk)
          bhkCounts[key] = (bhkCounts[key] ?? 0) + 1
        }
        if (rs.unit?.status) {
          possessionCounts[rs.unit.status] = (possessionCounts[rs.unit.status] ?? 0) + 1
        }
        for (const amenity of [...(rs.preferences?.requiredAmenities ?? []), ...(rs.preferences?.preferredAmenities ?? [])]) {
          amenityCounts[amenity] = (amenityCounts[amenity] ?? 0) + 1
        }
      }
      const topAmenities = Object.entries(amenityCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([amenity, count]) => ({ amenity, count }))

      return {
        sampleSize: people.length,
        activationRate: people.length > 0 ? activatedCount / people.length : null,
        avgMessages,
        conversionRate: people.length > 0 ? convertedCount / people.length : null,
        requirementStateBreakdown: {
          sampleSize: memories.length,
          budgetBands,
          hardCeilingCount: hardCeiling,
          softCeilingCount: softCeiling,
          sectorDistribution: sectorCounts,
          bhkDistribution: bhkCounts,
          possessionStanceDistribution: possessionCounts,
          topAmenities,
        },
      }
    }

    const [referredStats, organicStats] = await Promise.all([cohortStats(referredSessions), cohortStats(organicSessions)])

    res.json({
      growthSummary: {
        blendedKFactor: networkKFactor.blended,
        totalActiveReach,
        topAdmin: topAdmin ? { email: topAdmin.email, totalDevicesReached: topAdmin.totalDevicesReached } : null,
        bestChannel: bestChannelOverall,
        broadcastFlaggedCount,
      },
      byAdmin,
      comparison: {
        referred: referredStats,
        organic: organicStats,
      },
    })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:METRICS_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to load referral metrics' })
  }
})
