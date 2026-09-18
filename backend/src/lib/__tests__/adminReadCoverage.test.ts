import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decide } from '../adminPolicy'

/**
 * Every readable path under /admin has a stated verdict.
 *
 * Reads default OPEN at runtime while writes default closed, and that stays
 * true: denying unlisted reads would mean enumerating every GET before it works
 * at all, and a half-enumerated deny-list breaks working screens silently — a
 * worse failure mode than the gap.
 *
 * This closes the gap from the other side. The registry below states who may
 * read what; the walk below reads the actual router sources and fails if a
 * mounted GET is missing from it. So a new read-only console still ships
 * working on day one, and the test — not a buyer — is what notices that nobody
 * decided who should see it.
 *
 * It also cross-checks the registry against `decide()` for all three roles, so
 * the two cannot drift: a rule quietly relaxed in adminPolicy.ts fails here
 * against the intent written down.
 *
 * This is the test that would have caught `chat_session_id` surviving in one
 * endpoint's select after the list endpoint dropped it — per-endpoint decisions
 * are exactly what drifts.
 */

type Role = 'SUPER_ADMIN' | 'ANALYST' | 'SALES'

const ALL: Record<Role, boolean> = { SUPER_ADMIN: true, ANALYST: true, SALES: true }
const OWNER_ONLY: Record<Role, boolean> = { SUPER_ADMIN: true, ANALYST: false, SALES: false }
/** The catalogue-editing roles. Marketing copy, scoring, analytics. */
const EDITORS: Record<Role, boolean> = { SUPER_ADMIN: true, ANALYST: true, SALES: false }
/** The lead-working roles. An analyst has no call on a buyer's phone number. */
const LEAD_WORKERS: Record<Role, boolean> = { SUPER_ADMIN: true, ANALYST: false, SALES: true }

/**
 * Who may read each mounted GET, keyed by the path RELATIVE TO THE /admin MOUNT
 * — the same path `adminRolePolicy` passes to `decide`.
 *
 * `:id` is written as a literal segment here and substituted before the check,
 * because the policy matches real paths, not route templates.
 */
const READ_REGISTRY: Record<string, Record<Role, boolean>> = {
  // ── Catalogue. Sales reads it to answer a buyer; nobody is shut out. ──
  '/projects': ALL,
  '/projects/:id': ALL,
  '/projects/:id/channel-partners': ALL,
  '/projects/:id/completeness': ALL,
  '/projects/:id/documents': ALL,
  '/projects/:id/lifecycle-updates': ALL,
  '/projects/:id/milestones': ALL,
  '/projects/:id/payment-plans': ALL,
  '/projects/:id/price-history': ALL,
  '/projects/:id/specs': ALL,
  '/projects/:id/updates': ALL,
  '/projects/export': ALL,
  '/builders': ALL,
  '/sectors': ALL,
  '/sector-tiers': ALL,
  '/coverage-gaps': ALL,
  // Which catalogue rows are missing fields. Catalogue metadata, no buyer in it.
  '/boards/data-quality': ALL,
  '/stats': ALL,
  '/channel-partners': ALL,
  '/channel-partners/:id': ALL,

  // ── Buyer contact rows. The sales surface. ──
  // `/boards/queue` belongs here, not with the dashboards: it returns names,
  // phone numbers and profile summaries, so it is a lead surface whatever the
  // route is called.
  '/boards/queue': LEAD_WORKERS,
  '/leads': LEAD_WORKERS,
  '/leads/:id/brief': LEAD_WORKERS,
  '/callbacks': LEAD_WORKERS,
  '/callbacks/:id': LEAD_WORKERS,

  // ── Transcripts. What a buyer told an ADVISOR. Owner only. ──
  '/conversations/metrics': OWNER_ONLY,
  '/beta/metrics': OWNER_ONLY,

  // ── Unpublished copy and internal scoring. ──
  '/news': EDITORS,
  '/blog': EDITORS,
  '/blog/:id': EDITORS,
  '/promotions': EDITORS,
  '/promotions/:id': EDITORS,
  '/intelligence/status/summary': EDITORS,

  // ── Analytics. The summary is the shared number; the rest is company
  //    performance, which is not a sales work queue. Spend is owner-only. ──
  '/analytics/summary': ALL,
  '/analytics/funnel': EDITORS,
  '/analytics/market-demand': EDITORS,
  '/analytics/properties': EDITORS,
  '/analytics/quality': EDITORS,
  '/analytics/unmet-demand': EDITORS,
  '/analytics/users': EDITORS,
  '/analytics/ai-costs': OWNER_ONLY,

  // ── Oversight. Not read by the people it covers. ──
  '/audit-logs': OWNER_ONLY,
  '/team': OWNER_ONLY,
  '/outbox': OWNER_ONLY,
}

/**
 * Which routers are mounted under /admin, and at what prefix — read from
 * `index.ts` rather than listed here.
 *
 * It WAS a hand-maintained list, and that list silently missed
 * `adminBoards.ts` the day it was mounted: the test passed while two new
 * readable endpoints had no stated verdict, which is the exact failure this
 * file exists to prevent, reproduced one level up. A hand-maintained list of
 * what to check is itself a thing that drifts.
 *
 * `betaRouter` is mounted twice on purpose (at /conversations and /beta); both
 * prefixes are picked up because both `app.use` lines are read.
 */
function mountedRouters(): Array<{ file: string; prefixes: string[] }> {
  const index = readFileSync(join(__dirname, '../../index.ts'), 'utf-8')

  // `import xRouter from './routes/y'` — the variable name to its file.
  const fileOf = new Map<string, string>()
  for (const m of index.matchAll(/import\s+(?:\{\s*(\w+)\s*\}|(\w+))\s+from\s+'\.\/routes\/([\w.-]+)'/g)) {
    fileOf.set(m[1] ?? m[2], `${m[3]}.ts`)
  }

  // `app.use('/api/v1/admin...', xRouter)` — the prefix each is served at.
  const byFile = new Map<string, Set<string>>()
  for (const m of index.matchAll(/app\.use\(\s*'\/api\/v1\/admin([^']*)'\s*,\s*(\w+)\s*\)/g)) {
    const file = fileOf.get(m[2])
    // adminAreaGuard is middleware, not a router, and resolves to no file.
    if (!file) continue
    if (!byFile.has(file)) byFile.set(file, new Set())
    byFile.get(file)!.add(m[1].replace(/\/$/, ''))
  }

  return [...byFile].map(([file, prefixes]) => ({ file, prefixes: [...prefixes] }))
}

/** Every GET registered in a router file, whatever the router variable is named. */
function getPaths(file: string): string[] {
  const source = readFileSync(join(__dirname, '../../routes', file), 'utf-8')
  const found = new Set<string>()
  for (const m of source.matchAll(/(\w+)\.get\(\s*'([^']+)'/g)) {
    found.add(m[2])
  }
  return [...found]
}

/** Mount-relative paths, with a trailing bare slash collapsed. */
function mountedReadPaths(): string[] {
  const out = new Set<string>()
  for (const { file, prefixes } of mountedRouters()) {
    for (const p of getPaths(file)) {
      for (const prefix of prefixes) {
        const joined = (prefix + p).replace(/\/+$/, '') || '/'
        out.add(joined)
      }
    }
  }
  return [...out].sort()
}

/** A route template becomes a path the policy can actually match. */
function concrete(path: string): string {
  return path.replace(/:[A-Za-z_]+/g, 'abc-123')
}

const ROLES: Role[] = ['SUPER_ADMIN', 'ANALYST', 'SALES']

describe('every mounted admin GET has a stated verdict', () => {
  const mounted = mountedReadPaths()

  it('finds routes to check at all', () => {
    // A regex that silently matched nothing would make every assertion below
    // pass while checking nothing — the classic green-for-the-wrong-reason.
    assert.ok(mounted.length > 25, `only found ${mounted.length} GET routes`)
  })

  for (const path of mounted) {
    it(`${path} is classified`, () => {
      assert.ok(
        READ_REGISTRY[path],
        `${path} is readable under /admin but nobody has decided which roles may read it. ` +
        `Add it to READ_REGISTRY in this file — and if it exposes buyer PII, ` +
        `transcripts or commercial terms, add it to the deny-lists in adminPolicy.ts too.`,
      )
    })
  }

  it('has no registry entries for routes that no longer exist', () => {
    // A stale entry is a rule defending nothing, which reads as coverage.
    const live = new Set(mounted)
    const stale = Object.keys(READ_REGISTRY).filter((p) => !live.has(p))
    assert.deepEqual(stale, [], `stale READ_REGISTRY entries: ${stale.join(', ')}`)
  })
})

describe('the policy agrees with the registry', () => {
  for (const [path, expected] of Object.entries(READ_REGISTRY)) {
    for (const role of ROLES) {
      it(`${role} ${expected[role] ? 'may' : 'may NOT'} GET ${path}`, () => {
        assert.equal(decide(role, 'GET', concrete(path)).allowed, expected[role])
      })
    }
  }
})
