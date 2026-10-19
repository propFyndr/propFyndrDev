import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createAccount, setDisabled, listAccounts, RealtyMailError } from '../realtyMailClient'

type Call = { url: string; method: string; body: any; auth: string | null }
const realFetch = globalThis.fetch
let calls: Call[]
let respond: (c: Call) => { status?: number; json: unknown }

beforeEach(() => {
  calls = []
  process.env.REALTYMAIL_URL = 'https://mail.example.in.' // trailing dot, as it was set once
  process.env.REALTYMAIL_ADMIN_API_KEY = 'sekrit-key'
  globalThis.fetch = (async (url: string, init: any) => {
    const call = { url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers.Authorization ?? null }
    calls.push(call)
    const r = respond(call)
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.json }
  }) as any
})
afterEach(() => { globalThis.fetch = realFetch })

describe('realtyMailClient', () => {
  it('strips the trailing dot and sends the bearer key', async () => {
    respond = () => ({ json: { accounts: [] } })
    await listAccounts()
    assert.equal(calls[0].url, 'https://mail.example.in/api/v1/accounts')
    assert.equal(calls[0].auth, 'Bearer sekrit-key')
  })

  it('creates a regular user on the named domain', async () => {
    respond = (c) => c.url.endsWith('/domains')
      ? { json: { domains: [{ id: 'dom1', hostname: 'realtyask.in' }] } }
      : { json: { account: { id: 'u1', email: 'a@realtyask.in', name: 'a', role: 'user', disabled: false } } }
    const { account, password } = await createAccount({ username: 'a', hostname: 'realtyask.in' })
    const post = calls.find((c) => c.method === 'POST')!
    assert.equal(post.body.role, 'user')
    assert.equal(post.body.domainId, 'dom1')
    assert.equal(post.body.password, password)
    assert.ok(password.length >= 20)
    assert.equal(account.email, 'a@realtyask.in')
  })

  it('disabling keeps the role and rotates the password so sessions end', async () => {
    respond = (c) => c.method === 'GET'
      ? { json: { account: { id: 'u1', name: 'A', role: 'user', disabled: false, canManageMailboxes: false } } }
      : { json: { ok: true } }
    await setDisabled('u1', true)
    const patch = calls.find((c) => c.method === 'PATCH')!
    assert.equal(patch.body.disabled, true)
    assert.equal(patch.body.role, 'user')
    assert.ok(patch.body.password.length >= 20)
  })

  it('never leaks the key in an error', async () => {
    respond = () => ({ status: 401, json: { error: 'Unauthorized' } })
    await assert.rejects(listAccounts(), (e: RealtyMailError) => e.status === 502 && !e.message.includes('sekrit-key'))
  })
})
