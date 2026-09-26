// backend/scripts/corpus/baseline.ts
//
//   npx tsx scripts/corpus/baseline.ts results-<tag>.json [results-<tag2>.json ...]
//
// Turns one or more corpus result files into a dated scorecard: pass rate, cost
// and tokens per turn, latency percentiles, which lanes answered, and — for the
// rows in router-labels.json — whether today's router sent each question to a
// lane that serves its labelled task.
//
// Every later phase of CHAT_INTELLIGENCE_ROADMAP.md cites its delta against the
// scorecard this writes. Reads files only; no network, no database.
//
// The lane → task map below is deliberately a SET per lane: today's lanes are
// coarser than the task vocabulary (the OPEN lane serves both law and market
// questions), so a lane "hits" when the labelled task is one it can serve. That
// flatters the old router; it does not undercount it. `unlabelled` and
// clarify-only lanes map to nothing and always miss.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isOutageNotice } from '../../src/lib/ai/outageNotice'

const HERE = dirname(fileURLToPath(import.meta.url))

type Task =
  | 'discover' | 'project_fact' | 'compare' | 'calculate' | 'market_explain'
  | 'legal_process' | 'meta' | 'lead' | 'smalltalk' | 'out_of_scope'

interface Result {
  id: string
  grade: string
  answer?: string
  totalMs: number
  ttftMs: number | null
  costUsd: number
  promptTokens: number
  completionTokens: number
  calls: number
  lane?: string | null
  queryKind?: string | null
  jev?: { task?: string; via?: string } | null
}

interface Label { id: string; task: Task; uncertain?: boolean }

const TOPIC: Record<string, Task[]> = {
  affordability_advisor: ['calculate'],
  'amenity-lifestyle': ['project_fact'],
  authority_mechanics: ['legal_process'],
  'builder-reputation': ['project_fact', 'market_explain'],
  'commute-shortlist': ['discover'],
  forensic_comparison: ['compare'],
  connectivity: ['project_fact'],
  'cost-sheet': ['project_fact', 'calculate'],
  dossier_generator: ['meta'],
  due_diligence: ['project_fact'],
  'newcomer-orientation': ['market_explain'],
  'payment-plans': ['project_fact'],
  possession_status: ['project_fact'],
  rera_verification: ['project_fact', 'legal_process'],
  'sector-comparison': ['compare', 'market_explain'],
  statutory_tax: ['calculate', 'legal_process'],
  total_outflow: ['calculate'],
  unit_configuration: ['project_fact'],
  'vicinity-lookup': ['project_fact', 'market_explain'],
}

const LANE: Record<string, Task[]> = {
  greeting: ['smalltalk'],
  thanks: ['smalltalk'],
  jailbreak: ['out_of_scope'],
  'off-topic': ['out_of_scope'],
  coverage: ['out_of_scope'],
  'coverage-lane': ['market_explain', 'out_of_scope', 'project_fact'],
  transcript: ['meta'],
  'budget-history': ['meta'],
  'id-document': ['lead'],
  'unknown-project': ['project_fact'],
  'ground-truth-db': ['project_fact'],
  OPEN: ['legal_process', 'market_explain'],
  NEWS_MILESTONE: ['market_explain', 'project_fact'],
  PROJECT_DETAIL_NO_PROJECT: ['project_fact'],
}

const QUERY_KIND: Record<string, Task[]> = {
  DISCOVERY: ['discover'],
  RANKING: ['discover'],
  DRILLDOWN: ['project_fact'],
  COMPARISON: ['compare'],
  SUMMARY: ['market_explain'],
  ADVISORY: ['discover', 'market_explain'],
  OPEN: ['legal_process', 'market_explain'],
}

/** Tasks the lane that answered can serve. Empty = unattributable. */
export function tasksServedBy(lane: string | null | undefined, queryKind: string | null | undefined): Task[] {
  if (!lane) return []
  if (lane.startsWith('topic:')) return TOPIC[lane.slice(6)] ?? []
  if (lane === 'main') return (queryKind && QUERY_KIND[queryKind]) || []
  return LANE[lane] ?? []
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

function main(): void {
  const files = process.argv.slice(2)
  if (files.length === 0) throw new Error('usage: baseline.ts results-<tag>.json [...]')
  const results: Result[] = files.flatMap((f) => JSON.parse(readFileSync(join(HERE, f), 'utf8')))
  // Result files written before the grader knew the current outage wording
  // scored the notice as a pass. Re-grade it here so old and new runs compare.
  for (const r of results) if (r.answer && isOutageNotice(r.answer)) r.grade = 'unavailable'
  const labels: Label[] = JSON.parse(readFileSync(join(HERE, 'router-labels.json'), 'utf8'))
  const labelById = new Map(labels.map((l) => [l.id, l]))

  const n = results.length
  const grades: Record<string, number> = {}
  const lanes: Record<string, number> = {}
  for (const r of results) {
    grades[r.grade] = (grades[r.grade] ?? 0) + 1
    const lane = r.lane ?? 'no-trace'
    lanes[lane] = (lanes[lane] ?? 0) + 1
  }

  // Routing: only rows that carry a label and a trace, cache hits excluded
  // (a cached answer says nothing about where the router would send it).
  const perTask: Record<string, { n: number; hit: number }> = {}
  const misses: Array<{ id: string; task: Task; lane: string | null | undefined; queryKind: string | null | undefined }> = []
  let routed = 0
  let hits = 0
  for (const r of results) {
    const label = labelById.get(r.id)
    if (!label || !r.lane || r.lane === 'answer-cache') continue
    routed++
    const t = (perTask[label.task] ??= { n: 0, hit: 0 })
    t.n++
    if (tasksServedBy(r.lane, r.queryKind).includes(label.task)) {
      hits++
      t.hit++
    } else {
      misses.push({ id: r.id, task: label.task, lane: r.lane, queryKind: r.queryKind })
    }
  }

  // JEV (shadow): same labelled rows, JEV's own task against the label. Rows
  // where JEV made no decision count as misses — silence is not a right answer.
  const jevPerTask: Record<string, { n: number; hit: number }> = {}
  let jevN = 0
  let jevHits = 0
  let jevDecided = 0
  for (const r of results) {
    const label = labelById.get(r.id)
    if (!label || !r.lane || r.lane === 'answer-cache') continue
    jevN++
    const t = (jevPerTask[label.task] ??= { n: 0, hit: 0 })
    t.n++
    if (r.jev?.task) jevDecided++
    if (r.jev?.task === label.task) {
      jevHits++
      t.hit++
    }
  }

  const sum = (f: (r: Result) => number) => results.reduce((a, r) => a + (f(r) || 0), 0)
  const scorecard = {
    date: new Date().toISOString().slice(0, 10),
    files,
    turns: n,
    passPct: pct(grades.pass ?? 0, n),
    outagePct: pct(grades.unavailable ?? 0, n),
    grades,
    costPerTurnUsd: n ? Number((sum((r) => r.costUsd) / n).toFixed(5)) : 0,
    promptTokensPerTurn: n ? Math.round(sum((r) => r.promptTokens) / n) : 0,
    completionTokensPerTurn: n ? Math.round(sum((r) => r.completionTokens) / n) : 0,
    llmCallsPerTurn: n ? Number((sum((r) => r.calls) / n).toFixed(2)) : 0,
    latencyMs: {
      p50: percentile(results.map((r) => r.totalMs), 50),
      p95: percentile(results.map((r) => r.totalMs), 95),
      ttftP50: percentile(results.flatMap((r) => (r.ttftMs == null ? [] : [r.ttftMs])), 50),
    },
    lanes,
    routing: {
      labelledAndTraced: routed,
      accuracyPct: pct(hits, routed),
      perTask: Object.fromEntries(
        Object.entries(perTask).map(([k, v]) => [k, { ...v, pct: pct(v.hit, v.n) }]),
      ),
      misses,
    },
    jev: {
      decidedPct: pct(jevDecided, jevN),
      accuracyPct: pct(jevHits, jevN),
      perTask: Object.fromEntries(
        Object.entries(jevPerTask).map(([k, v]) => [k, { ...v, pct: pct(v.hit, v.n) }]),
      ),
    },
  }

  mkdirSync(join(HERE, 'scorecards'), { recursive: true })
  const tag = files[0].replace(/^results-|\.json$/g, '')
  const out = join(HERE, 'scorecards', `${scorecard.date}-${tag}.json`)
  writeFileSync(out, JSON.stringify(scorecard, null, 2))

  console.log(`turns ${n} · pass ${scorecard.passPct}% · outage ${scorecard.outagePct}% · $${scorecard.costPerTurnUsd}/turn · ` +
    `${scorecard.promptTokensPerTurn} in / ${scorecard.completionTokensPerTurn} out tokens · ` +
    `${scorecard.llmCallsPerTurn} calls · p50 ${scorecard.latencyMs.p50}ms p95 ${scorecard.latencyMs.p95}ms`)
  console.log(`routing ${scorecard.routing.accuracyPct}% of ${routed} labelled turns`)
  for (const [k, v] of Object.entries(scorecard.routing.perTask)) console.log(`  ${k.padEnd(15)} ${v.hit}/${v.n} (${v.pct}%)`)
  if (jevDecided > 0) {
    console.log(`jev ${scorecard.jev.accuracyPct}% (decided on ${scorecard.jev.decidedPct}%)`)
    for (const [k, v] of Object.entries(scorecard.jev.perTask)) console.log(`  ${k.padEnd(15)} ${v.hit}/${v.n} (${v.pct}%)`)
  }
  console.log(`written: ${out}`)
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) main()
