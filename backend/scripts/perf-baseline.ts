// backend/scripts/perf-baseline.ts
//
// Phase 8.1 — the baseline.
//
// "The admin panel feels slow" is a symptom, not a measurement, and optimising
// against a feeling means changing code until the feeling goes away. This
// records wall time and query count per endpoint so 8.2's "at or under target"
// has something to be under, and 8.3's per-endpoint ceilings have something to
// be set from.
//
// Query count matters as much as time and is the number people skip: an
// endpoint at 400ms issuing 3 queries wants an index; the same endpoint issuing
// 300 wants a different shape. The timing alone cannot tell you which.
//
//   MEASURE_DB_QUERIES=1 npm run dev          # in one terminal
//   npx tsx -r dotenv/config scripts/perf-baseline.ts   # in another
//
// Reads `x-db-queries`, which `lib/queryCounter.ts` sets only when that flag is
// on. Without it the script still reports timings and prints "—" for counts.
import { performance } from 'perf_hooks'

const BASE = process.env.PERF_BASE_URL || 'http://localhost:3002/api/v1'
const EMAIL = process.env.PERF_ADMIN_EMAIL || 'admin@propfyndr.in'
const PASSWORD = process.env.PERF_ADMIN_PASSWORD

/**
 * Runs per endpoint; the first is discarded as warm-up.
 *
 * Was 4 (so 3 timed). Against a remote database that is too few to separate a
 * real change from network variance — the projects list measured 983 ms on
 * three runs and 669 ms on eleven, which is the difference between passing a
 * target and failing it. A measurement that cannot settle an argument is not
 * worth taking.
 */
const RUNS = 12

/**
 * Every admin read a person actually waits on, plus the buyer endpoints most
 * likely to be on the critical path. Ordered as a reader would scan them.
 */
const ENDPOINTS: ReadonlyArray<{ label: string; path: string; auth: boolean }> = [
  { label: 'Dashboard stats', path: '/admin/stats', auth: true },
  { label: 'Sales queue', path: '/admin/boards/queue', auth: true },
  { label: 'Data quality', path: '/admin/boards/data-quality', auth: true },
  { label: 'Leads list', path: '/admin/leads', auth: true },
  { label: 'Callbacks list', path: '/admin/callbacks', auth: true },
  { label: 'Projects list', path: '/admin/projects', auth: true },
  { label: 'Builders list', path: '/admin/builders', auth: true },
  { label: 'Sectors', path: '/admin/sectors', auth: true },
  { label: 'Coverage gaps', path: '/admin/coverage-gaps', auth: true },
  { label: 'Channel partners', path: '/admin/channel-partners', auth: true },
  { label: 'Analytics summary', path: '/admin/analytics/summary', auth: true },
  { label: 'Team', path: '/admin/team', auth: true },
  { label: 'Outbox', path: '/admin/outbox', auth: true },
  { label: 'Promotionals (public)', path: '/promotionals/active', auth: false },
]

interface Row { label: string; path: string; status: number; p50: number; max: number; queries: string }

async function login(): Promise<string | null> {
  if (!PASSWORD) return null
  const res = await fetch(`${BASE}/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) {
    console.error(`login failed: ${res.status}`)
    return null
  }
  const { token } = (await res.json()) as { token: string }
  return token
}

async function measure(
  path: string,
  token: string | null,
): Promise<{ status: number; p50: number; max: number; queries: string }> {
  const times: number[] = []
  let status = 0
  let queries = '—'

  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    const res = await fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    // Drain the body: a timing that stops at the headers measures the server
    // thinking, not the request completing, and the difference is the payload.
    await res.arrayBuffer()
    const ms = performance.now() - t0
    status = res.status
    const q = res.headers.get('x-db-queries')
    if (q) queries = q
    // Discard the first run. It pays for the connection pool warming and the
    // first compile of the query plan, which nobody waits on twice.
    if (i > 0) times.push(ms)
  }

  times.sort((a, b) => a - b)
  return {
    status,
    p50: times[Math.floor(times.length / 2)] ?? 0,
    max: times[times.length - 1] ?? 0,
    queries,
  }
}

async function main() {
  const token = await login()
  if (!token) {
    console.error(
      'No admin session. Set PERF_ADMIN_PASSWORD (and PERF_ADMIN_EMAIL if not admin@propfyndr.in).\n' +
      'Authenticated rows will be skipped.',
    )
  }

  const rows: Row[] = []
  for (const e of ENDPOINTS) {
    if (e.auth && !token) continue
    const r = await measure(e.path, e.auth ? token : null)
    rows.push({ label: e.label, path: e.path, ...r })
  }

  const w = Math.max(...rows.map((r) => r.label.length), 20)
  console.log('')
  console.log(`${'ENDPOINT'.padEnd(w)}  STATUS   p50(ms)   max(ms)   QUERIES`)
  console.log('-'.repeat(w + 38))
  for (const r of rows.sort((a, b) => b.p50 - a.p50)) {
    console.log(
      `${r.label.padEnd(w)}  ${String(r.status).padStart(6)}  ${r.p50.toFixed(0).padStart(8)}  ${r.max.toFixed(0).padStart(8)}   ${r.queries}`,
    )
  }
  console.log('')
  console.log(`${rows.length} endpoints · ${RUNS - 1} timed runs each · slowest first`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
