/**
 * The Day 1 five-console smoke test, as far as a script can take it.
 *
 * Day 1 asks for a live check that every role sees only what it is allowed to
 * see. Most of that is mechanical — log in, call a path, read the status code —
 * and mechanical checks belong in a script rather than in five browser windows
 * and a person's memory of which tab was which.
 *
 * WHAT THIS DOES NOT COVER, and cannot:
 *   - Receiving the invitation email and clicking the link. That needs a real
 *     inbox. Run it once by hand; everything after the password is set is below.
 *   - What a page LOOKS like. This asserts the server's answer, which is where
 *     authorisation actually lives (§ "A tenant subdomain is addressing, never
 *     authorisation"). A hidden button over an open endpoint still passes here
 *     and is still a hole — that part is the browser's job.
 *
 * Usage:
 *   SMOKE_BASE_URL=https://api.propfyndr.in \
 *   SMOKE_SUPER_ADMIN='admin@propfyndr.in:pw' \
 *   SMOKE_ANALYST='analyst@propfyndr.in:pw' \
 *   SMOKE_SALES='sales@propfyndr.in:pw' \
 *   SMOKE_BUILDER='builder@x.com:pw' \
 *   SMOKE_PARTNER='channel.partner@propfyndr.in:pw' \
 *   npx tsx scripts/smoke-roles.ts
 *
 * Any role whose credentials are absent is reported as SKIPPED, not passed —
 * a smoke test that silently checks nothing is worse than no smoke test.
 *
 * The brute-force check is opt-in via SMOKE_LOCKOUT_EMAIL, and deliberately
 * so: passing it an address LOCKS THAT ACCOUNT FOR 15 MINUTES, because that is
 * the behaviour being verified. Point it at a throwaway account, never at the
 * address you are about to log in with.
 *
 * Exit code is 1 if any expectation fails, so CI can gate a deploy on it.
 */

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3002').replace(/\/$/, '')
const API = `${BASE}/api/v1`

type Role = 'SUPER_ADMIN' | 'ANALYST' | 'SALES' | 'BUILDER' | 'PARTNER'

/** `allow` means "not 401/403". A 404 is fine — the route exists policy-wise. */
interface Expectation {
  method: 'GET' | 'PATCH'
  path: string
  expect: 'allow' | 'deny'
  why: string
}

/**
 * The matrix, written from `lib/adminPolicy.ts` and the Day 1 spec.
 *
 * Deliberately duplicated rather than imported: a smoke test that derives its
 * expectations from the code it is testing proves only that the code equals
 * itself. These are what the ROADMAP promises a buyer's data is protected by.
 */
const MATRIX: Record<Role, Expectation[]> = {
  SUPER_ADMIN: [
    { method: 'GET', path: '/admin/leads', expect: 'allow', why: 'full access to lead rows' },
    { method: 'GET', path: '/admin/team', expect: 'allow', why: 'owns team management' },
    { method: 'GET', path: '/admin/outbox', expect: 'allow', why: 'owns the email outbox' },
    { method: 'GET', path: '/admin/conversations', expect: 'allow', why: 'owns transcripts' },
    { method: 'GET', path: '/admin/projects', expect: 'allow', why: 'owns the catalogue' },
  ],
  ANALYST: [
    { method: 'GET', path: '/admin/projects', expect: 'allow', why: 'the catalogue role' },
    { method: 'GET', path: '/admin/builders', expect: 'allow', why: 'the catalogue role' },
    { method: 'GET', path: '/admin/leads', expect: 'deny', why: 'no buyer names or phone numbers' },
    { method: 'GET', path: '/admin/callbacks', expect: 'deny', why: 'lead surface' },
    { method: 'GET', path: '/admin/boards/queue', expect: 'deny', why: 'the same lead rows under another name' },
    { method: 'GET', path: '/admin/conversations', expect: 'deny', why: 'transcripts are not theirs' },
    // The hole closed in 4a1a4e5: read was denied while PATCH stayed open.
    { method: 'PATCH', path: '/admin/leads/smoke-nonexistent-id', expect: 'deny', why: 'a write is access' },
    { method: 'GET', path: '/admin/team', expect: 'deny', why: 'only we mint identities' },
  ],
  SALES: [
    { method: 'GET', path: '/admin/leads', expect: 'allow', why: 'works the leads' },
    { method: 'GET', path: '/admin/boards/queue', expect: 'allow', why: 'the call queue' },
    { method: 'GET', path: '/admin/projects', expect: 'allow', why: 'read-only catalogue lookup' },
    { method: 'GET', path: '/admin/conversations', expect: 'deny', why: 'transcripts are not theirs' },
    { method: 'GET', path: '/admin/team', expect: 'deny', why: 'only we mint identities' },
    { method: 'GET', path: '/admin/blog', expect: 'deny', why: 'not a content role' },
    { method: 'PATCH', path: '/admin/projects/smoke-nonexistent-id', expect: 'deny', why: 'sales never edits the catalogue' },
  ],
  BUILDER: [
    { method: 'GET', path: '/portal/builder/objections', expect: 'allow', why: 'their own objection rollup' },
    // The load-bearing one. A builder receiving a transcript sells the
    // neutrality that is the entire thesis of § Trust First.
    { method: 'GET', path: '/admin/conversations', expect: 'deny', why: 'a builder never receives a chat transcript' },
    { method: 'GET', path: '/admin/leads', expect: 'deny', why: 'the admin console is not theirs' },
    { method: 'GET', path: '/admin/projects', expect: 'deny', why: 'adminAreaGuard floor' },
  ],
  PARTNER: [
    { method: 'GET', path: '/admin/leads', expect: 'deny', why: 'the admin console is not theirs' },
    { method: 'GET', path: '/admin/conversations', expect: 'deny', why: 'transcripts never leave us' },
    { method: 'GET', path: '/admin/projects', expect: 'deny', why: 'adminAreaGuard floor' },
  ],
}

interface Result { role: string; path: string; method: string; ok: boolean; detail: string }
const results: Result[] = []
const skipped: string[] = []

async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${API}/admin/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const body = (await res.json()) as { token?: string }
  return body.token ?? null
}

async function check(role: Role, token: string, e: Expectation) {
  let status = 0
  try {
    const res = await fetch(`${API}${e.path}`, {
      method: e.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(e.method === 'PATCH' ? { 'content-type': 'application/json' } : {}),
      },
      ...(e.method === 'PATCH' ? { body: JSON.stringify({ status: 'contacted' }) } : {}),
    })
    status = res.status
  } catch (err) {
    results.push({ role, path: e.path, method: e.method, ok: false, detail: `request failed: ${(err as Error).message}` })
    return
  }

  const refused = status === 401 || status === 403
  const ok = e.expect === 'deny' ? refused : !refused
  results.push({
    role,
    path: e.path,
    method: e.method,
    ok,
    detail: ok ? `${status}` : `${status} — expected ${e.expect} (${e.why})`,
  })
}

/** 5 wrong passwords must lock the account for 15 minutes (Day 1, step 1.3). */
async function checkLockout(email: string) {
  const junk = `smoke-wrong-${Date.now()}`
  let sawLock = false
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${API}/admin/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: junk }),
    })
    if (res.status === 423) { sawLock = true; break }
  }
  results.push({
    role: 'LOCKOUT',
    path: '/admin/auth',
    method: 'POST',
    ok: sawLock,
    detail: sawLock
      ? 'account locked after repeated failures (423)'
      : 'never returned 423 — brute-force lockout is not enforced. Check UPSTASH_REDIS_REST_URL/_TOKEN are set: the counter falls back to per-process memory without them.',
  })
}

async function main() {
  console.log(`Smoke: ${API}\n`)

  for (const role of Object.keys(MATRIX) as Role[]) {
    const cred = process.env[`SMOKE_${role}`]
    if (!cred || !cred.includes(':')) {
      skipped.push(role)
      continue
    }
    const idx = cred.indexOf(':')
    const email = cred.slice(0, idx)
    const password = cred.slice(idx + 1)

    const token = await login(email, password)
    if (!token) {
      results.push({ role, path: '/admin/auth', method: 'POST', ok: false, detail: 'login failed' })
      continue
    }
    results.push({ role, path: '/admin/auth', method: 'POST', ok: true, detail: 'logged in' })

    for (const e of MATRIX[role]) await check(role, token, e)
  }

  if (process.env.SMOKE_LOCKOUT_EMAIL) await checkLockout(process.env.SMOKE_LOCKOUT_EMAIL)

  const failed = results.filter((r) => !r.ok)
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.role.padEnd(12)} ${r.method.padEnd(5)} ${r.path.padEnd(38)} ${r.detail}`)
  }

  if (skipped.length) {
    console.log(`\nSKIPPED (no SMOKE_<ROLE> credentials): ${skipped.join(', ')}`)
    console.log('These roles were NOT verified. A skipped role is not a passing role.')
  }

  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)
  console.log('Still manual: send an invite to a real address, click the link, set a password.')

  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error('smoke run failed:', err)
  process.exit(1)
})
