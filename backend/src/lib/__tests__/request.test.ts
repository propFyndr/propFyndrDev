import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Request } from 'express'
import { clientIp } from '../request'

const req = (headers: Record<string, string>, ip?: string) => ({ headers, ip }) as unknown as Request

describe('clientIp', () => {
  it('uses the Cloudflare-set address', () => {
    assert.equal(clientIp(req({ 'cf-connecting-ip': '203.0.113.7' }, '10.0.0.1')), '203.0.113.7')
  })

  it('ignores client-forgeable X-Forwarded-For and X-Real-IP', () => {
    const forged = req({ 'x-forwarded-for': '1.2.3.4, 198.51.100.9', 'x-real-ip': '5.6.7.8' }, '198.51.100.9')
    assert.equal(clientIp(forged), '198.51.100.9')
  })
})
