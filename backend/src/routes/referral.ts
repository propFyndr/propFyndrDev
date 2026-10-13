//
// POST /api/v1/referral/arrive — called once per device, on landing. Public:
// no auth, no admin session. Resolves attribution (lib/referralAttribution),
// mints the device's own personal link, and records the visit.
//
// Preview-bot fetches (WhatsApp, iMessage, Facebook, etc. building a link
// card) return 204 with no row created — see lib/referralCode.ts.
import { Router, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/db'
import { checkRateLimit } from '../lib/cache'
import { generateReferralCode, isPreviewBotUserAgent, parseDeviceInfo } from '../lib/referralCode'
import { resolveAttribution, type AttributionLookup } from '../lib/referralAttribution'

export const referralRouter = Router()

/** The reply for a device that already has a visit row: its own code, never a greeting. */
async function existingArrival(guestToken: string, countVisit: boolean) {
  const visit = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
  if (!visit) return null
  const [ownLink] = await prisma.$transaction([
    prisma.referralLink.findUnique({ where: { code: visit.own_code } }),
    ...(countVisit
      ? [prisma.referralVisit.update({
          where: { guest_token: guestToken },
          data: { visit_count: { increment: 1 }, last_seen_at: new Date() },
        })]
      : []),
  ])
  return { ownCode: visit.own_code, greeting: null, revoked: Boolean(ownLink?.revoked_at) }
}

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
    const existing = await existingArrival(guestToken, true)
    if (existing) {
      res.json(existing)
      return
    }

    const priorChat = await prisma.chatSession.findFirst({ where: { guest_token: guestToken }, select: { id: true } })
    const device = parseDeviceInfo(userAgent)

    let ownCode = generateReferralCode()
    // Collision retry: astronomically unlikely at this volume, but cheap to guard.
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.referralLink.findUnique({ where: { code: ownCode } })
      if (!clash) break
      ownCode = generateReferralCode()
    }

    // One transaction: claiming the holder seat and writing the visit commit
    // together. The claim is a conditional update, so of several devices
    // opening a fresh ROOT link at once exactly one gets count 1; the others
    // block on the row lock, find the seat taken, and attach under the holder.
    const outcome = await prisma.$transaction(async (tx) => {
      // Same device arriving twice at once (two tabs, a double-fired effect):
      // queue the second behind the first on a per-device lock, then let it
      // find the visit the first one wrote. Without this the second insert
      // raised a unique violation that Prisma logs as an error even though it
      // is handled below.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${guestToken}))`
      if (await tx.referralVisit.findUnique({ where: { guest_token: guestToken }, select: { guest_token: true } })) {
        return null
      }

      let linkRow = code ? await tx.referralLink.findUnique({ where: { code } }) : null

      if (linkRow?.kind === 'ROOT' && !linkRow.revoked_at && !linkRow.holder_guest_token && !priorChat) {
        const claim = await tx.referralLink.updateMany({
          where: { code: linkRow.code, holder_guest_token: null },
          data: { holder_guest_token: guestToken },
        })
        // Lost the race: re-read so attribution sees the winner as holder.
        if (claim.count === 0) linkRow = await tx.referralLink.findUnique({ where: { code: linkRow.code } })
      }

      let holderVisit: { root_code: string; generation: number } | null = null
      if (linkRow?.kind === 'ROOT' && linkRow.holder_guest_token) {
        holderVisit = await tx.referralVisit.findUnique({
          where: { guest_token: linkRow.holder_guest_token },
          select: { root_code: true, generation: true },
        })
      }
      let ownerVisit: { root_code: string; generation: number } | null = null
      // Revoking a ROOT link stops new attribution into its whole tree, not
      // just arrivals on the ROOT code: a personal link inside a revoked
      // campaign attributes nothing either. The existing tree is kept.
      let campaignRevokedAt: Date | null = null
      if (linkRow?.kind === 'PERSONAL' && linkRow.owner_guest_token) {
        ownerVisit = await tx.referralVisit.findUnique({
          where: { guest_token: linkRow.owner_guest_token },
          select: { root_code: true, generation: true },
        })
        if (ownerVisit) {
          const root = await tx.referralLink.findUnique({
            where: { code: ownerVisit.root_code },
            select: { kind: true, revoked_at: true },
          })
          if (root?.kind === 'ROOT') campaignRevokedAt = root.revoked_at
        }
      }

      const link = linkRow
      const lookup: AttributionLookup = {
        getLink: (c) => (link && c === link.code
          ? {
              kind: link.kind,
              // A seat this request just claimed reads as empty, so the pure
              // resolver returns "became holder" (generation 1).
              holder_guest_token: link.holder_guest_token === guestToken ? null : link.holder_guest_token,
              owner_guest_token: link.owner_guest_token,
              revoked_at: link.revoked_at ?? campaignRevokedAt,
            }
          : null),
        hasPriorChats: () => Boolean(priorChat),
        getVisit: () => null, // already checked above; this branch is unreachable here
        getVisitByGuestToken: (gt) => {
          if (link?.holder_guest_token === gt) return holderVisit
          if (link?.owner_guest_token === gt) return ownerVisit
          return null
        },
      }

      const attribution = resolveAttribution(guestToken, code, lookup)

      await tx.referralLink.create({
        data: { code: ownCode, kind: 'PERSONAL', owner_guest_token: guestToken },
      })
      await tx.referralVisit.create({
        data: {
          guest_token: guestToken,
          own_code: ownCode,
          arrived_via_code: attribution.arrived_via_code,
          root_code: attribution.root_code ?? ownCode,
          parent_guest_token: attribution.parent_guest_token,
          generation: attribution.generation,
          depth_inferred: attribution.depth_inferred,
          prior_user: attribution.prior_user,
          device_class: device.device_class,
          os: device.os,
          app_guess: device.app_guess,
          share_channel: channel,
        },
      })
      return { linkRow: link, attribution }
    })

    if (!outcome) {
      const existingNow = await existingArrival(guestToken, false)
      if (existingNow) {
        res.json(existingNow)
        return
      }
      throw new Error('visit vanished between lock and read')
    }
    const { linkRow, attribution } = outcome

    const greeting = linkRow?.kind === 'ROOT' && !linkRow.revoked_at && linkRow.greeting_name && !attribution.prior_user
      ? { name: linkRow.greeting_name }
      : null

    res.json({ ownCode, greeting })
  } catch (err: any) {
    // Backstop for the per-device lock above: if a unique violation still
    // slips through, the visit exists — answer with its code, not a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await existingArrival(guestToken, false).catch(() => null)
      if (existing) {
        res.json(existing)
        return
      }
    }
    console.error('[REFERRAL:ARRIVE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to record arrival' })
  }
})
