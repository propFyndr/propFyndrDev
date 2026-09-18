import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * The projects list and the project detail page must agree on completeness.
 *
 * They did not. `ProjectDocument` has no Prisma relation to `Project` — it is
 * matched on `project_id` OR `project_slug` — so it cannot be an `include`, and
 * the list simply never fetched it while `/projects/:id/completeness` did. Every
 * project with a brochure scored 4–5 points lower in the list than on its own
 * page, always the list reading low.
 *
 * That sent an analyst scanning the Data Quality board to projects that were
 * already finished: a correctness bug in the one screen built to find
 * correctness bugs.
 *
 * Asserted against a running server rather than by re-implementing the two code
 * paths here, because the bug was never in the scoring function — it was in what
 * each caller fed it. A test that mocked the inputs would have passed throughout.
 *
 *   MEASURE_DB_QUERIES=1 npm run dev
 *   PARITY_BASE_URL=http://localhost:3001/api/v1 \
 *   PARITY_EMAIL=analyst@propfyndr.in PARITY_PASSWORD=... npm test
 *
 * Skips loudly without those, rather than passing quietly — a skipped check that
 * looks green is worse than a missing one.
 */

const BASE = process.env.PARITY_BASE_URL
const EMAIL = process.env.PARITY_EMAIL
const PASSWORD = process.env.PARITY_PASSWORD

/** Enough projects to span the score range; the bug showed on 6 of 12. */
const SAMPLE_SIZE = 12

interface ListProject { id: string; name: string; completenessScore: number }

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  assert.equal(res.status, 200, 'parity check could not sign in')
  const { token } = (await res.json()) as { token: string }
  return token
}

describe('list and detail agree on completeness', { skip: !BASE || !PASSWORD ? 'set PARITY_BASE_URL, PARITY_EMAIL and PARITY_PASSWORD with the server running' : false }, () => {
  it(`matches on ${SAMPLE_SIZE} projects spread across the score range`, async () => {
    const token = await login()
    const H = { Authorization: `Bearer ${token}` }

    const listRes = await fetch(`${BASE}/admin/projects?limit=1000`, { headers: H })
    assert.equal(listRes.status, 200)
    const { projects } = (await listRes.json()) as { projects: ListProject[] }
    assert.ok(projects.length >= SAMPLE_SIZE, `only ${projects.length} projects to sample`)

    // Spread the sample across the catalogue rather than taking the first N:
    // the first N share a sector and a data-entry batch, so they share gaps.
    const step = Math.max(1, Math.floor(projects.length / SAMPLE_SIZE))
    const sample = projects.filter((_, i) => i % step === 0).slice(0, SAMPLE_SIZE)

    const mismatches: string[] = []
    for (const p of sample) {
      const r = await fetch(`${BASE}/admin/projects/${p.id}/completeness`, { headers: H })
      assert.equal(r.status, 200, `detail failed for ${p.name}`)
      const detail = (await r.json()) as { totalScore: number }
      if (detail.totalScore !== p.completenessScore) {
        mismatches.push(`${p.name}: list=${p.completenessScore} detail=${detail.totalScore}`)
      }
    }

    assert.deepEqual(
      mismatches,
      [],
      'the list and the project page disagree on completeness — the list is almost ' +
      'certainly missing a relation the detail endpoint loads',
    )
  })
})
