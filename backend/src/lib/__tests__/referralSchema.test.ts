import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../db'

describe('referral schema', () => {
  it('exposes referralLink and referralVisit on the Prisma client', () => {
    assert.equal(typeof prisma.referralLink.findUnique, 'function')
    assert.equal(typeof prisma.referralVisit.findUnique, 'function')
  })
})
