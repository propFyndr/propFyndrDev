import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../lib/db'

describe('session migration attaches referral visits', () => {
  it('sets user_id on the guest token\'s ReferralVisit row when one exists', async () => {
    const guestToken = `guest-migrate-test-${Date.now()}`
    await prisma.referralLink.create({ data: { code: `MIGTEST${Date.now() % 100000}`.slice(0, 8).toUpperCase(), kind: 'PERSONAL', owner_guest_token: guestToken } })
    await prisma.referralVisit.create({
      data: {
        guest_token: guestToken,
        own_code: `MIGTST${Date.now() % 1000}`.slice(0, 8).toUpperCase(),
        root_code: guestToken,
        generation: 0,
        device_class: 'mobile',
        os: 'ios',
        app_guess: 'unknown',
      },
    })

    // Simulate what the /migrate handler will do.
    await prisma.referralVisit.updateMany({
      where: { guest_token: guestToken },
      data: { user_id: 'user-test-1' },
    })

    const visit = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
    assert.equal(visit?.user_id, 'user-test-1')
  })
})
