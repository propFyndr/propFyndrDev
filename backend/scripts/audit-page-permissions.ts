// backend/scripts/audit-page-permissions.ts
//
//   npx tsx scripts/audit-page-permissions.ts
//
// Every admin/portal page, every API call it makes, checked against the real
// role matrix in lib/adminPolicy.ts.
//
// The matrix test proves the POLICY is right. This proves the UI agrees with
// it: a page reachable by a role whose own calls that role cannot make is a
// page that renders an error, and no amount of correct authorization fixes
// that. It imports `decide` rather than restating the rules, so the two cannot
// drift.
//
// Static, free and offline — no server, no tokens, no LLM spend. Run it after
// touching either the matrix or a page's data loading.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, sep, resolve } from 'path'
import { decide } from '../src/lib/adminPolicy'
import { isSelfServiceAdminPath } from '../src/lib/adminGuard'

const FRONTEND = resolve(__dirname, '..', '..', 'frontend')
const ROLES = ['SUPER_ADMIN', 'ANALYST', 'SALES'] as const
type Role = (typeof ROLES)[number]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/** `adminFetch('/admin/x', { method: 'POST' })` — method defaults to GET. */
const CALL = /adminFetch\(\s*[`'"]([^`'"]+)[`'"]\s*(?:,\s*\{[\s\S]{0,200}?method:\s*['"](\w+)['"])?/g

interface Call { path: string; method: string }

function collect(src: string): Call[] {
  const out: Call[] = []
  for (const m of src.matchAll(CALL)) {
    out.push({ path: m[1], method: (m[2] ?? 'GET').toUpperCase() })
  }
  return out
}

/** '/admin/projects/abc?x=1' -> { path: '/projects/abc', query: { x: '1' } }. */
function mountRelative(raw: string): { path: string; query: Record<string, unknown> } | null {
  const [clean, qs = ''] = raw.split('?')
  if (!clean.startsWith('/admin')) return null
  const query: Record<string, unknown> = {}
  for (const pair of qs.split('&').filter(Boolean)) {
    const [k, v = ''] = pair.split('=')
    if (k) query[k] = v
  }
  return { path: clean.slice('/admin'.length) || '/', query }
}

/**
 * Which roles the sidebar offers each section to, read from the admin layout.
 *
 * Without this the audit reports every write on /admin/team for ANALYST and
 * SALES — true of the API, irrelevant in practice, because neither role is
 * shown the link. Reading the real nav keeps the output down to combinations a
 * person can actually reach, which is the only kind worth fixing.
 */
function navVisibility(): Array<{ href: string; roles: Role[] }> {
  const layout = readFileSync(join(FRONTEND, 'app', 'admin', 'layout.tsx'), 'utf8')
  const groups: Record<string, Role[]> = {
    STAFF: ['SUPER_ADMIN', 'ANALYST', 'SALES'],
    EDITORS: ['SUPER_ADMIN', 'ANALYST'],
    OWNERS: ['SUPER_ADMIN'],
  }
  const out: Array<{ href: string; roles: Role[] }> = []
  for (const m of layout.matchAll(/href:\s*'([^']+)'[^}]*?roles:\s*\[\.\.\.(\w+)\]/g)) {
    if (groups[m[2]]) out.push({ href: m[1], roles: groups[m[2]] })
  }
  // Longest prefix wins, so /admin/projects/[id] inherits /admin/projects.
  return out.sort((a, b) => b.href.length - a.href.length)
}

const NAV = navVisibility()

/** Can this role even open the page? Unlisted sections are open to all staff. */
function pageIsOffered(route: string, role: Role): boolean {
  const rule = NAV.find((n) => route === n.href || route.startsWith(n.href + '/'))
  return rule ? rule.roles.includes(role) : true
}

/**
 * Calls a page contains but only ever fires for a role that may make them,
 * because the control behind them is hidden at runtime.
 *
 * This audit is static: it sees `adminFetch('/admin/builders', {method:'POST'})`
 * in the file and cannot see the `{mayEdit && ...}` around the button. Rather
 * than drop those findings — which would blind the audit to the next real one —
 * each is declared here with what gates it, so anything NOT on this list is a
 * genuine problem and fails the run.
 *
 * The pattern is the one `chatFieldCoverage` already uses for `NOT_BUYER_FACTS`:
 * an exception is a line someone has to argue for, not a relaxed assertion.
 */
const GATED_IN_UI: ReadonlyArray<{ role: Role; route: string; call: string; why: string }> = [
  { role: 'ANALYST', route: '/admin/analytics', call: 'GET /admin/analytics/ai-costs', why: 'fetch is behind isOwner(); the section renders a "restricted" note instead' },
  { role: 'SALES', route: '/admin/analytics', call: 'GET /admin/analytics/ai-costs', why: 'same — behind isOwner()' },
  { role: 'SALES', route: '/admin/builders', call: 'POST /admin/builders', why: '"New Builder" button behind canEditCatalogue()' },
  { role: 'SALES', route: '/admin/builders', call: 'PATCH /admin/builders/${id}', why: '"Save Changes" behind canEditCatalogue()' },
  { role: 'ANALYST', route: '/admin/builders', call: 'DELETE /admin/builders/${id}', why: 'Delete button behind canDeleteRecords()' },
  { role: 'SALES', route: '/admin/builders', call: 'DELETE /admin/builders/${id}', why: 'Delete button behind canDeleteRecords()' },
  { role: 'SALES', route: '/admin/builders', call: 'POST /admin/email/send', why: '"Pitch Developer" behind canEditCatalogue()' },
  { role: 'SALES', route: '/admin/partners', call: 'POST /admin/channel-partners', why: '"Add partner" behind canEditCatalogue()' },
  { role: 'SALES', route: '/admin/partners', call: 'PATCH /admin/channel-partners/${id}', why: 'approve/reject/verify/activate all behind canEditCatalogue()' },
  { role: 'SALES', route: '/admin/projects', call: 'POST /admin/projects/bulk-update', why: '"Bulk Update" behind canDeleteRecords()' },
  { role: 'SALES', route: '/admin/projects/[id]', call: 'GET /admin/audit-logs?entity_id=${projectId}&limit=100', why: 'whole editor page is replaced by a read-only notice for SALES' },
  { role: 'SALES', route: '/admin/projects/[id]', call: 'PUT /admin/projects/${projectId}/specs', why: 'same — the editor is never rendered for SALES' },
]

function isDeclared(role: Role, route: string, call: string): boolean {
  return GATED_IN_UI.some((g) => g.role === role && g.route === route && g.call === call)
}

/** Template holes become a plausible id so `/projects/${id}` matches `/projects/:id`. */
function concretise(path: string): string {
  return path.replace(/\$\{[^}]*\}/g, 'abc-123')
}

function main(): void {
  const pages = walk(join(FRONTEND, 'app')).filter((f) => /page\.tsx$/.test(f))
  const components = walk(join(FRONTEND, 'components')).map((f) => [f, readFileSync(f, 'utf8')] as const)

  let pagesChecked = 0
  let callsChecked = 0
  let declared = 0
  const problems: string[] = []

  for (const page of pages) {
    const src = readFileSync(page, 'utf8')
    let calls = collect(src)

    // A page's data loading often lives in the components it renders.
    for (const [file, componentSrc] of components) {
      const base = file.split(sep).pop()!.replace(/\.tsx?$/, '')
      if (new RegExp(`\\b${base}\\b`).test(src)) calls = calls.concat(collect(componentSrc))
    }

    const seen = new Set<string>()
    calls = calls.filter((c) => {
      const key = `${c.method} ${c.path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (calls.length === 0) continue

    const route = '/' + page.split(sep).join('/').split('/app/')[1].replace(/\/page\.tsx$/, '')
    pagesChecked++

    for (const call of calls) {
      const rel = mountRelative(concretise(call.path))
      if (rel === null) continue // not an /admin endpoint; the matrix has no say
      // Signed-in self-service (changing your own password) is exempt from the
      // role floor entirely — see isSelfServiceAdminPath in lib/adminGuard.ts.
      if (isSelfServiceAdminPath(rel.path)) continue
      callsChecked++
      for (const role of ROLES) {
        if (!pageIsOffered(route, role)) continue
        if (!decide(role, call.method, rel.path, rel.query).allowed) {
          const label = `${call.method} ${call.path}`
          if (isDeclared(role, route, label)) { declared++; continue }
          problems.push(`${role.padEnd(11)} ${route}  ->  ${label}`)
        }
      }
    }
  }

  console.log(`\nChecked ${callsChecked} /admin calls across ${pagesChecked} pages.`)
  console.log(`${declared} refused call(s) declared as gated in the UI.\n`)
  if (problems.length === 0) {
    console.log('No undeclared page/role combination would hit a 403.')
    return
  }
  console.log(`${problems.length} page/role combinations would hit a 403:\n`)
  for (const p of problems) console.log('  ' + p)
  console.log(
    '\nEach is either a nav item that role should not see, a call that should be\n' +
    'conditional on role, or a matrix cell that is wrong. None of them is fine.\n' +
    'If the control IS already hidden at runtime, add it to GATED_IN_UI with the\n' +
    'reason rather than deleting the check.',
  )
  process.exitCode = 1
}

main()
