// `requireAdmin` is not an authorization check, and it must not be used as one
// outside the /admin area.
//
// It validates that a session EXISTS and never reads its role — the
// `AdminSession` type in `adminAuth.ts` has no role field. `adminAuth` and
// `adminIdentity` also share one session store and one key prefix, so a BUILDER
// or PARTNER token satisfies it completely.
//
// Inside /admin that is survivable, because `adminAreaGuard` is mounted on the
// path prefix and `admin.ts` installs its own `router.use(requireRole(...))`
// floor. Outside it, nothing inherits either guard, and three routers were
// relying on `requireAdmin` alone:
//
//   /api/v1/leads                 GET /callback/:leadId/dossier returned a
//                                 buyer's name and phone to a BUILDER token,
//                                 for any lead id, measured live. Plus
//                                 /metrics and /market/snapshot company-wide.
//   /api/v1/builder-applications  list, read and approve/reject prospective
//                                 builders' onboarding applications.
//   /api/v1/documents             POST uploads a file against any project.
//
// This is a source test rather than a behavioural one for the same reason
// `adminRoleFloor.test.ts` is: the protection is structural, and structural
// protection fails silently. A router added tomorrow at a new non-admin path
// with `requireAdmin` on it would be unguarded with nothing to notice.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = join(__dirname, '..', '..')
const index = readFileSync(join(SRC, 'index.ts'), 'utf8')

/** routerVariableName -> source file, from the import lines. */
function routerImports(): Map<string, string> {
  const out = new Map<string, string>()
  const rx = /import\s+(?:(\w+)|\{\s*(\w+)\s*\})\s+from\s+'\.\/routes\/([\w-]+)'/g
  for (const m of index.matchAll(rx)) {
    out.set(m[1] ?? m[2], m[3])
  }
  return out
}

/** mountPath -> routerVariableName, from the app.use lines. */
function routerMounts(): Array<{ path: string; router: string }> {
  const rx = /app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g
  return [...index.matchAll(rx)].map(m => ({ path: m[1], router: m[2] }))
}

const isAdminArea = (p: string) => p.startsWith('/api/v1/admin') || p.startsWith('/api/admin')

describe('authorization outside the /admin area', () => {
  const imports = routerImports()
  const mounts = routerMounts().filter(m => imports.has(m.router) && !isAdminArea(m.path))

  it('finds the mounted routers to check', () => {
    // If the parsing breaks, every assertion below passes vacuously — which is
    // the failure mode a guard test must not have.
    assert.ok(mounts.length >= 8, `only parsed ${mounts.length} non-admin router mounts from index.ts`)
  })

  for (const { path, router } of mounts) {
    const file = imports.get(router)!
    it(`${path} does not guard a route with requireAdmin`, () => {
      const src = readFileSync(join(SRC, 'routes', `${file}.ts`), 'utf8')
      // `requireAdmin,` is the shape of it being passed as route middleware.
      // A mention in a comment carries no comma and does not trip this.
      assert.ok(
        !/requireAdmin\s*,/.test(src),
        `routes/${file}.ts is mounted at ${path}, outside adminAreaGuard, and uses requireAdmin as a route guard. ` +
        `requireAdmin reads no role, so a BUILDER or PARTNER token passes it. Use requireStaff from lib/adminGuard.`,
      )
    })
  }
})
