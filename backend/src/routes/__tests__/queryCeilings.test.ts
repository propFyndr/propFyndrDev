import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * No endpoint issues more database queries than it is allowed.
 *
 * The projects list reached production issuing one query that read seventeen
 * relations in full, and it took five seconds. Nothing noticed, because nothing
 * was counting — the slowness was reported as a feeling months later.
 *
 * The ceilings below are the counts measured after Phase 8, set tight rather
 * than with headroom. A tight ceiling turns "someone added a query" into a
 * failing build with the endpoint named; a generous one turns it into a number
 * nobody trusts. When a new query is genuinely needed, raise the number in this
 * file — that edit is the point, because it is where someone has to look at the
 * count and agree to it.
 *
 * Needs the server running with counting enabled:
 *
 *   MEASURE_DB_QUERIES=1 npm run dev
 *   CEILING_BASE_URL=http://localhost:3001/api/v1 \
 *   CEILING_EMAIL=analyst@propfyndr.in CEILING_PASSWORD=... npm test
 *
 * Skips loudly without those. A skipped check that reads as green is worse than
 * no check at all.
 */

const BASE = process.env.CEILING_BASE_URL
const EMAIL = process.env.CEILING_EMAIL
const PASSWORD = process.env.CEILING_PASSWORD

/**
 * Endpoint → the most queries it may issue.
 *
 * Only endpoints an analyst session can reach: the ceiling is about query
 * shape, and a 403 issues zero queries, which would pass any ceiling while
 * measuring nothing.
 */
const CEILINGS: ReadonlyArray<{ path: string; max: number; note?: string }> = [
  /**
   * Two on a warm completeness cache (the list and its count), four on a cold
   * one (plus the scoring read and the documents lookup). The ceiling is the
   * cold number because that is the worst case, and a ceiling that only holds
   * while a cache happens to be warm is not a ceiling.
   */
  { path: '/admin/projects?limit=1000', max: 4, note: 'cold cache; 2 when warm' },
  // Was 8: six counts asking how many projects lacked each field, plus a
  // findMany that fetched those very fields. The counts are now derived from
  // the rows. Lowered, never raised.
  { path: '/admin/boards/data-quality', max: 2 },
  { path: '/admin/analytics/summary', max: 9 },
  { path: '/admin/stats', max: 5 },
  { path: '/admin/builders', max: 2 },
  { path: '/admin/channel-partners', max: 2 },
  { path: '/admin/sectors', max: 1 },
  { path: '/admin/coverage-gaps', max: 1 },
]

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  assert.equal(res.status, 200, 'ceiling check could not sign in')
  const { token } = (await res.json()) as { token: string }
  return token
}

describe('query ceilings', { skip: !BASE || !PASSWORD ? 'set CEILING_BASE_URL, CEILING_EMAIL and CEILING_PASSWORD with the server running under MEASURE_DB_QUERIES=1' : false }, () => {
  it('the server is actually counting', async () => {
    // Without this, a server started without MEASURE_DB_QUERIES=1 sends no
    // header, every count reads as zero, and every ceiling below passes while
    // measuring nothing at all.
    const token = await login()
    const res = await fetch(`${BASE}/admin/sectors`, { headers: { Authorization: `Bearer ${token}` } })
    assert.ok(
      res.headers.get('x-db-queries') !== null,
      'no x-db-queries header — start the server with MEASURE_DB_QUERIES=1',
    )
  })

  for (const { path, max, note } of CEILINGS) {
    it(`${path} issues at most ${max} quer${max === 1 ? 'y' : 'ies'}${note ? ` (${note})` : ''}`, async () => {
      const token = await login()
      const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      await res.arrayBuffer()

      assert.equal(res.status, 200, `${path} returned ${res.status}`)

      const header = res.headers.get('x-db-queries')
      assert.ok(header !== null, `${path} reported no query count`)

      const count = Number(header)
      assert.ok(
        count <= max,
        `${path} issued ${count} queries, ceiling is ${max}. ` +
        `Either the query shape regressed, or the extra query is deliberate — ` +
        `in which case raise the ceiling in this file so somebody has agreed to it.`,
      )
    })
  }
})
