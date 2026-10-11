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

export const adminReferralsRouter = Router()

function identity(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

/**
 * Activated = ≥3 messages, OR a save/callback/site-visit/dossier, OR a return
 * visit ≥24h after first arrival. Computed here rather than stored, since the
 * inputs (message count, saves, callbacks) already live on ChatSession and
 * CallbackRequest and would drift if duplicated onto ReferralVisit.
 */
async function countActivated(guestTokens: string[]): Promise<Set<string>> {
  if (guestTokens.length === 0) return new Set()
  const sessions = await prisma.chatSession.findMany({
    where: { guest_token: { in: guestTokens } },
    select: { guest_token: true, message_count: true, last_active: true, created_at: true },
  })
  const activated = new Set<string>()
  for (const s of sessions) {
    if (!s.guest_token) continue
    const returned = s.last_active.getTime() - s.created_at.getTime() >= 24 * 60 * 60 * 1000
    if (s.message_count >= 3 || returned) activated.add(s.guest_token)
  }
  const callbacks = await prisma.callbackRequest.findMany({
    where: { guest_token: { in: guestTokens } },
    select: { guest_token: true },
  })
  for (const c of callbacks) {
    if (c.guest_token) activated.add(c.guest_token)
  }
  const dossiers = await prisma.dossier.findMany({
    where: { guest_token: { in: guestTokens } },
    select: { guest_token: true },
  })
  for (const d of dossiers) {
    if (d.guest_token) activated.add(d.guest_token)
  }
  const siteVisits = await prisma.siteVisitRequest.findMany({
    where: { guest_token: { in: guestTokens } },
    select: { guest_token: true },
  })
  for (const v of siteVisits) {
    if (v.guest_token) activated.add(v.guest_token)
  }
  return activated
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

    const allVisits = await prisma.referralVisit.findMany({
      where: { root_code: { in: links.map((l) => l.code) } },
      select: { guest_token: true, root_code: true, generation: true, first_seen_at: true },
    })

    const activated = await countActivated(allVisits.map((v) => v.guest_token))

    const result = links.map((link) => {
      const visits = allVisits.filter((v) => v.root_code === link.code)
      const deepestGeneration = visits.reduce((max, v) => Math.max(max, v.generation), 0)
      const activatedCount = visits.filter((v) => activated.has(v.guest_token)).length
      const lastActivity = visits.reduce<Date | null>((latest, v) => (!latest || v.first_seen_at > latest ? v.first_seen_at : latest), null)

      return {
        code: link.code,
        label: link.label,
        createdByAdminId: link.created_by_admin_id,
        createdAt: link.created_at,
        revoked: Boolean(link.revoked_at),
        devicesReached: visits.length,
        deepestGeneration,
        activatedCount,
        lastActivity,
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
    await prisma.referralLink.update({ where: { code }, data: { revoked_at: new Date() } })
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

    const visits = await prisma.referralVisit.findMany({
      where: { root_code: code },
      orderBy: [{ generation: 'asc' }, { first_seen_at: 'asc' }],
    })

    const guestTokens = visits.map((v) => v.guest_token)
    const activated = await countActivated(guestTokens)

    const sessions = await prisma.chatSession.groupBy({
      by: ['guest_token'],
      where: { guest_token: { in: guestTokens } },
      _sum: { message_count: true },
    })
    const messageCountByGuest = new Map(sessions.map((s) => [s.guest_token, s._sum.message_count ?? 0]))

    const nodes = visits.map((v) => ({
      guestToken: v.guest_token,
      label: v.generation === 1 ? root.label : null,
      generation: v.generation,
      parentGuestToken: v.parent_guest_token,
      depthInferred: v.depth_inferred,
      deviceClass: v.device_class,
      os: v.os,
      appGuess: v.app_guess,
      shareChannel: v.share_channel,
      messageCount: messageCountByGuest.get(v.guest_token) ?? 0,
      activated: activated.has(v.guest_token),
      firstSeenAt: v.first_seen_at,
    }))

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
