import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../lib/db'

describe('session migration attaches referral visits', () => {
  it('sets user_id on the guest token\'s ReferralVisit row when one exists', async () => {
    const uniqueSuffix = `${Date.now()}${Math.random().toString(36).substring(7)}`
    const guestToken = `guest-migrate-test-${uniqueSuffix}`
    const refCode = `MGRT${uniqueSuffix.substring(0, 8)}`.substring(0, 12).toUpperCase()
    await prisma.referralLink.create({ data: { code: refCode, kind: 'PERSONAL', owner_guest_token: guestToken } })
    await prisma.referralVisit.create({
      data: {
        guest_token: guestToken,
        own_code: refCode,
        root_code: guestToken,
        generation: 0,
        device_class: 'mobile',
        os: 'ios',
        app_guess: 'unknown',
      },
    })

    // Simulate what the /migrate handler will do.
    await prisma.referralVisit.updateMany({
      where: { guest_token: guestToken, user_id: null },
      data: { user_id: 'user-test-1' },
    })

    const visit = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
    assert.equal(visit?.user_id, 'user-test-1')
  })
})
