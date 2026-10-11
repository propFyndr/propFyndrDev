//
// POST /api/v1/referral/arrive — called once per device, on landing. Public:
// no auth, no admin session. Resolves attribution (lib/referralAttribution),
// mints the device's own personal link, and records the visit.
//
// Preview-bot fetches (WhatsApp, iMessage, Facebook, etc. building a link
// card) return 204 with no row created — see lib/referralCode.ts.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { checkRateLimit } from '../lib/cache'
import { generateReferralCode, isPreviewBotUserAgent, parseDeviceInfo } from '../lib/referralCode'
import { resolveAttribution, type AttributionLookup } from '../lib/referralAttribution'

export const referralRouter = Router()

referralRouter.post('/arrive', async (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] as string | undefined
  if (isPreviewBotUserAgent(userAgent)) {
    res.status(204).end()
    return
  }

  const guestToken = typeof req.body?.guestToken === 'string' ? req.body.guestToken.trim() : ''
  if (!guestToken) {
    res.status(400).json({ error: 'guestToken required' })
    return
  }

  const code = typeof req.body?.code === 'string' && req.body.code.trim() ? req.body.code.trim().toUpperCase() : null
  const channel = typeof req.body?.channel === 'string' ? req.body.channel.slice(0, 20) : null

  const limit = await checkRateLimit(`referral_arrive:${guestToken}`, 20, 600)
  const ipLimit = await checkRateLimit(`referral_arrive_ip:${req.ip}`, 60, 600)
  if (!limit.allowed || !ipLimit.allowed) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  try {
    const existingVisit = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
    if (existingVisit) {
      const [ownLink] = await prisma.$transaction([
        prisma.referralLink.findUnique({ where: { code: existingVisit.own_code } }),
        prisma.referralVisit.update({
          where: { guest_token: guestToken },
          data: { visit_count: { increment: 1 }, last_seen_at: new Date() },
        }),
      ])
      res.json({ ownCode: existingVisit.own_code, greeting: null, revoked: Boolean(ownLink?.revoked_at) })
      return
    }

    const priorChat = await prisma.chatSession.findFirst({ where: { guest_token: guestToken }, select: { id: true } })

    const linkRow = code
      ? await prisma.referralLink.findUnique({ where: { code } })
      : null

    let holderVisit: { root_code: string; generation: number } | null = null
    if (linkRow?.kind === 'ROOT' && linkRow.holder_guest_token) {
      holderVisit = await prisma.referralVisit.findUnique({
        where: { guest_token: linkRow.holder_guest_token },
        select: { root_code: true, generation: true },
      })
    }
    let ownerVisit: { root_code: string; generation: number } | null = null
    if (linkRow?.kind === 'PERSONAL' && linkRow.owner_guest_token) {
      ownerVisit = await prisma.referralVisit.findUnique({
        where: { guest_token: linkRow.owner_guest_token },
        select: { root_code: true, generation: true },
      })
    }

    const lookup: AttributionLookup = {
      getLink: (c) => (linkRow && c === linkRow.code
        ? {
            kind: linkRow.kind,
            holder_guest_token: linkRow.holder_guest_token,
            owner_guest_token: linkRow.owner_guest_token,
            revoked_at: linkRow.revoked_at,
          }
        : null),
      hasPriorChats: () => Boolean(priorChat),
      getVisit: () => null, // already checked above; this branch is unreachable here
      getVisitByGuestToken: (gt) => {
        if (linkRow?.holder_guest_token === gt) return holderVisit
        if (linkRow?.owner_guest_token === gt) return ownerVisit
        return null
      },
    }

    const attribution = resolveAttribution(guestToken, code, lookup)
    const device = parseDeviceInfo(userAgent)

    let ownCode = generateReferralCode()
    // Collision retry: astronomically unlikely at this volume, but cheap to guard.
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.referralLink.findUnique({ where: { code: ownCode } })
      if (!clash) break
      ownCode = generateReferralCode()
    }

    const rootCode = attribution.root_code ?? ownCode

    await prisma.$transaction([
      prisma.referralLink.create({
        data: { code: ownCode, kind: 'PERSONAL', owner_guest_token: guestToken },
      }),
      prisma.referralVisit.create({
        data: {
          guest_token: guestToken,
          own_code: ownCode,
          arrived_via_code: attribution.arrived_via_code,
          root_code: rootCode,
          parent_guest_token: attribution.parent_guest_token,
          generation: attribution.generation,
          depth_inferred: attribution.depth_inferred,
          prior_user: attribution.prior_user,
          device_class: device.device_class,
          os: device.os,
          app_guess: device.app_guess,
          share_channel: channel,
        },
      }),
      ...(attribution.becameHolderOf
        ? [prisma.referralLink.update({ where: { code: attribution.becameHolderOf }, data: { holder_guest_token: guestToken } })]
        : []),
    ])

    const greeting = linkRow?.kind === 'ROOT' && linkRow.greeting_name && !attribution.prior_user
      ? { name: linkRow.greeting_name }
      : null

    res.json({ ownCode, greeting })
  } catch (err: any) {
    console.error('[REFERRAL:ARRIVE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to record arrival' })
  }
})
