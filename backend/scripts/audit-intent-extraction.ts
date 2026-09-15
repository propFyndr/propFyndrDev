// backend/scripts/audit-intent-extraction.ts
//
//   npx tsx scripts/audit-intent-extraction.ts baseline   # record current behaviour
//   npx tsx scripts/audit-intent-extraction.ts compare    # diff against the baseline
//
// Exact-match regression testing for intent extraction.
//
// Every other corpus in this repo is graded, and grading carries roughly ±6pp
// of provider nondeterminism — wider than most changes worth making, which is
// why two prompt optimizations sat deferred for weeks with no way to tell a
// real improvement from noise.
//
// Extraction does not have that problem. Its output is a small JSON object, so
// "did this change" is a field comparison, not a judgement. A shrunk prompt
// that extracts the same fields from 185 queries as the long one did is safe by
// observation rather than by argument.
//
// The extractor still calls a model, so a field can flip for reasons unrelated
// to the prompt. That is what `--repeat` is for: a field that differs between
// two runs of the SAME prompt is unstable, and unstable fields are excluded
// from the comparison rather than being counted as regressions.

import fs from 'node:fs'
import path from 'node:path'
import { extractIntent } from '../src/lib/ai/intent'

const CORPUS = path.join(__dirname, 'corpus', 'all-queries.json')
const BASELINE = path.join(__dirname, 'corpus', 'intent-baseline.json')

/** Fields that change the answer. Bookkeeping is deliberately excluded. */
const COMPARED = [
  'bhk', 'budgetMin', 'budgetMax', 'possession', 'sector', 'sectorsMentioned',
  'city', 'areaMin', 'areaMax', 'purpose', 'builderName', 'lifestyleKeywords',
  'projectNames', 'riskProfile', 'is_comparison_query', 'legal_check',
  'verbose', 'spatialScope', 'queryKind',
] as const

type Shape = Record<string, unknown>

function shapeOf(intent: Shape): Shape {
  const out: Shape = {}
  for (const f of COMPARED) {
    const v = intent[f]
    if (v === undefined || v === null) continue
    if (Array.isArray(v) && v.length === 0) continue
    out[f] = Array.isArray(v) ? [...v].map(String).sort() : v
  }
  return out
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

interface Row { q: string; shape: Shape; degraded: boolean }

/** Small, because the free-tier keys rate-limit and a 429 reads as a changed field. */
const CONCURRENCY = 4

async function run(queries: string[]): Promise<Row[]> {
  const rows: Row[] = new Array(queries.length)
  let next = 0
  let done = 0
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++
      if (i >= queries.length) return
      const q = queries[i]
      try {
        const r = await extractIntent(q, {})
        rows[i] = { q, shape: shapeOf(r.intent as Shape), degraded: r.degraded }
      } catch (err) {
        rows[i] = { q, shape: { __error: (err as Error).message.slice(0, 60) }, degraded: true }
      }
      if (++done % 25 === 0) process.stderr.write(`  ...${done}/${queries.length}\n`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return rows
}

async function main(): Promise<void> {
  const mode = process.argv[2] || 'compare'
  const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8')) as Array<{ q: string }>
  const queries = corpus.map((c) => c.q)
  console.log(`${queries.length} queries, mode=${mode}\n`)

  if (mode === 'baseline') {
    // Twice, so fields that are simply unstable are known before any prompt
    // change is blamed for them.
    console.log('run 1 of 2 (a second run identifies unstable fields)')
    const a = await run(queries)
    console.log('run 2 of 2')
    const b = await run(queries)

    const unstable: Record<string, string[]> = {}
    let stableRows = 0
    for (let i = 0; i < a.length; i++) {
      const fields = new Set([...Object.keys(a[i].shape), ...Object.keys(b[i].shape)])
      const differing = [...fields].filter((f) => !same(a[i].shape[f], b[i].shape[f]))
      if (differing.length) unstable[a[i].q] = differing
      else stableRows++
    }
    fs.writeFileSync(BASELINE, JSON.stringify({ rows: a, unstable }, null, 1))
    console.log(`\nbaseline written: ${a.length} rows, ${stableRows} identical across both runs`)
    const n = Object.keys(unstable).length
    console.log(`${n} quer${n === 1 ? 'y has' : 'ies have'} at least one unstable field (excluded from comparison)`)
    return
  }

  if (!fs.existsSync(BASELINE)) {
    console.error('No baseline. Run: npx tsx scripts/audit-intent-extraction.ts baseline')
    process.exitCode = 1
    return
  }
  const { rows: base, unstable } = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as
    { rows: Row[]; unstable: Record<string, string[]> }
  const now = await run(queries)

  let identical = 0
  const regressions: string[] = []
  const gains: string[] = []
  for (let i = 0; i < now.length; i++) {
    const q = now[i].q
    const skip = new Set(unstable[q] ?? [])
    const before = base[i]?.shape ?? {}
    const after = now[i].shape
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => !skip.has(f))
    const diff = fields.filter((f) => !same(before[f], after[f]))
    if (!diff.length) { identical++; continue }
    for (const f of diff) {
      const b = JSON.stringify(before[f] ?? null)
      const a = JSON.stringify(after[f] ?? null)
      // Losing a field the baseline had is the regression that matters: it is
      // a constraint the buyer stated and the shrunk prompt stopped reading.
      const line = `  ${q.slice(0, 62).padEnd(62)} ${f}: ${b} -> ${a}`
      if (before[f] !== undefined && after[f] === undefined) regressions.push(line)
      else if (before[f] === undefined) gains.push(line)
      else regressions.push(line)
    }
  }

  console.log(`\n${identical}/${now.length} queries extract identically to baseline`)
  if (gains.length) {
    console.log(`\n${gains.length} field(s) NEWLY extracted (not a regression):`)
    gains.slice(0, 20).forEach((l) => console.log(l))
  }
  if (regressions.length) {
    console.log(`\n${regressions.length} REGRESSION(S) — a field changed or was lost:`)
    regressions.slice(0, 40).forEach((l) => console.log(l))
    process.exitCode = 1
  } else {
    console.log('\nNo regressions.')
  }
}

main()
