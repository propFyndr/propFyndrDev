// End to end against the real app and the dev database: buyer sign-up, the
// email-verification gate, sign-in, and the session that verifyUser reads
// (cookie and bearer). Plus an imported Supabase user (bcrypt hash) signing in
// with the password they already had. No email is sent (Resend key blanked).
process.env.RESEND_API_KEY = ''
import '../../lib/eval/replayEnv'
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../../index'
import { prisma } from '../../lib/db'
import { verifyUser } from '../../lib/auth'

const ORIGIN = 'http://localhost:3000'
const stamp = Date.now()
const created: string[] = []

after(async () => {
  await prisma.authUser.deleteMany({ where: { email: { in: created } } })
  await prisma.$disconnect()
})

describe('buyer sign-in on Better Auth', () => {
  it('sign-up needs a confirmed email before sign-in; then the session identifies the buyer', async () => {
    const email = `qa-signup-${stamp}@example.com`
    created.push(email)
    const up = await request(app).post('/api/auth/sign-up/email').set('Origin', ORIGIN).send({ email, password: 'pass-word-1', name: 'QA' })
    assert.equal(up.status, 200, JSON.stringify(up.body))
    assert.equal(up.body.token ?? null, null, 'no session before the email is confirmed')

    const early = await request(app).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: 'pass-word-1' })
    assert.equal(early.status, 403)
    assert.equal(early.body.code, 'EMAIL_NOT_VERIFIED')

    await prisma.authUser.update({ where: { email }, data: { emailVerified: true } }) // the click on the emailed link

    const bad = await request(app).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: 'wrong-pass' })
    assert.equal(bad.status, 401)

    const ok = await request(app).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: 'pass-word-1' })
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    const user = await prisma.authUser.findUniqueOrThrow({ where: { email } })
    assert.match(user.id, /^[0-9a-f-]{36}$/, 'ids are UUIDs like the Supabase ones')

    const cookie = (ok.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ')
    assert.match(cookie, /session_token=/)
    assert.equal(await verifyUser({ headers: { cookie } } as any), user.id, 'cookie session')

    const token = ok.headers['set-auth-token'] as string
    assert.ok(token, 'bearer plugin returns the token')
    assert.equal(await verifyUser({ headers: { authorization: `Bearer ${token}` } } as any), user.id, 'bearer session')

    // The browser client reads the token from get-session (it cannot see the
    // httpOnly cookie) and sends it as a bearer to the backend's absolute URL.
    const sess = await request(app).get('/api/auth/get-session').set('Cookie', cookie)
    assert.equal(sess.status, 200)
    assert.ok(sess.body.session?.token, 'get-session returns the session token')
    assert.equal(await verifyUser({ headers: { authorization: `Bearer ${sess.body.session.token}` } } as any), user.id, 'get-session token works as a bearer')

    const out = await request(app).post('/api/auth/sign-out').set('Origin', ORIGIN).set('Cookie', cookie).send({})
    assert.equal(out.status, 200)
    assert.equal(await verifyUser({ headers: { authorization: `Bearer ${token}x` } } as any), null, 'a tampered token is a guest')
  })

  it('an imported Supabase user signs in with their existing password and keeps their id', async () => {
    const id = randomUUID()
    const email = `qa-imported-${stamp}@example.com`
    created.push(email)
    const hash = await bcrypt.hash('old-supabase-pw', 10) // same format Supabase stores
    await prisma.authUser.create({ data: { id, email, name: 'Imported', emailVerified: true } })
    await prisma.authAccount.create({ data: { id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hash } })

    const ok = await request(app).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: 'old-supabase-pw' })
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    assert.equal(ok.body.user.id, id)
    assert.equal(await verifyUser({ headers: { authorization: `Bearer ${ok.headers['set-auth-token']}` } } as any), id)
  })

  it('a request with no session is a guest', async () => {
    assert.equal(await verifyUser({ headers: {} } as any), null)
  })
})
