// backend/scripts/corpus/run-corpus.ts
//
// Runs the corpus against a live chat endpoint and grades every answer.
//
//   npx tsx scripts/corpus/run-corpus.ts                  # whole corpus
//   npx tsx scripts/corpus/run-corpus.ts --class=sector   # one class
//   npx tsx scripts/corpus/run-corpus.ts --limit=20 --concurrency=4
//
// Cost is attributed per query by session id, read back from ai_usage_events —
// the same rows the daily-budget guard reads, so the totals are the real spend
// and not a local estimate.
//
// Grading here is mechanical on purpose. It catches the failures that are
// unambiguous — a deflection, an empty answer, an out-of-scope query we
// answered anyway — and leaves quality judgement to a separate judge pass.
// A heuristic that tried to score advisory quality would be the fake
// confidence score CLAUDE.md forbids.

import { readFileSync, writeFileSync } from 'node:fs'
import { scanDisclosure } from '../../src/lib/ai/answerIntegrity'
import { endsRagged } from '../../src/lib/ai/endsRagged'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '../../src/lib/db'
import type { CorpusEntry, QueryClass } from './build-corpus'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENDPOINT = process.env.CHAT_ENDPOINT || 'http://localhost:3001/api/v1/chat'

// ── grading ────────────────────────────────────────────────────────────────

export type Grade =
  | 'pass'
  | 'unavailable'
  | 'deflected'
  | 'clarifying_only'
  | 'too_short'
  | 'not_declined'
  | 'empty'
  | 'error'
  /** Present, fluent, and carrying something a buyer must never be shown. */
  | 'integrity'
  /** Present but cut mid-clause — a truncated generation. */
  | 'truncated'

/**
 * The failure we found on the very first query: a direct question answered with
 * an onboarding greeting. Detected on the opening of the answer rather than
 * anywhere in it, so a reply that answers first and offers help afterwards is
 * not flagged.
 */
const DEFLECTION_OPENERS = [
  /^how can i (assist|help)/i,
  /^what (are you|kind of property)/i,
  /^(hi|hello|hey)\b/i,
  /^i can help you (find|with)/i,
  /^to (help|assist|give) you\b.{0,60}\bcould you\b/i,
  /^let me know what/i,
  /^welcome\b/i,
]

/**
 * Evidence that an out-of-scope query was handled honestly rather than answered
 * as though we held the inventory.
 *
 * The first version only looked for an explicit refusal and failed answers that
 * were doing the right thing in different words — "1 BHK inventory here is
 * virtually non-existent", "societies prohibit short-term rentals". Those are
 * better than a flat decline: they explain why, which is what the trade-off
 * rule asks for.
 *
 * This stays a mechanical check and cannot judge whether the redirect was
 * appropriate. It catches the failure that matters — presenting rental or
 * resale stock we do not have — and anything subtler needs a reading pass.
 */
const DECLINE_MARKERS =
  /\b(don'?t|do not|cannot|can'?t|not able to|no data|not something we|outside|out of scope|only cover|focus(ed)? (on|only)|we track|not in our|unable to|don'?t have|non-existent|not available|unavailable|prohibit|do not list|not list|limited|rather than|instead of|we specialise|we specialize|new(-| )(build|construction)|primary market)\b/i

/**
 * Evidence that the answer actually said something: a markdown table, a rupee
 * figure, a sector number, a rate, a year. Deliberately generous — its only job
 * is to tell a real answer apart from a bare "what's your budget?".
 */
const CARRIES_DATA = /\||₹|\bcr\b|\bcrore\b|\blakh\b|\bsq\.?\s?ft\b|\bsector\s*\d+|\b20\d\d\b|\d{3,}/i

/** The message shown when every provider in the chain has failed. */
const PROVIDER_EXHAUSTED =
  /currently experiencing high traffic|out of service|check back shortly/i

/**
 * Minimum useful length for a class this table does not name.
 *
 * `MIN_CHARS[entry.class]` returns undefined for any class added elsewhere, and
 * `length < undefined` is false — so the length gate silently stopped running.
 * The long-tail set added twelve new class names and scored 100%, with a
 * 77-character answer passing a floor that never executed. A missing floor must
 * fail closed.
 */
const DEFAULT_MIN_CHARS = 120

const minChars = (cls: string): number =>
  (MIN_CHARS as Record<string, number>)[cls] ?? DEFAULT_MIN_CHARS

/** Minimum useful length per class. Below this the answer cannot carry a trade-off. */
const MIN_CHARS: Record<QueryClass, number> = {
  market_fact: 200,
  sector: 250,
  comparison: 300,
  project_builder: 200,
  budget_personal: 300,
  financial: 150,
  risk_legal: 250,
  temporal: 200,
  discovery: 250,
  navigational: 120,
  brand_probe: 80,
  out_of_scope: 60,
  malformed: 60,
  other: 150,
}

export function grade(entry: CorpusEntry, text: string, errored: boolean): Grade {
  if (errored) return 'error'
  const answer = text.trim()
  if (!answer) return 'empty'

  // The chain ran dry and the buyer was told to come back later. It is 190
  // characters of polite prose, so every length check passes it — 30 of 120
  // long-tail turns were graded `pass` while showing "our AI services are
  // currently experiencing high traffic". A run that scores an outage as a
  // success is measuring the wrong thing.
  if (PROVIDER_EXHAUSTED.test(answer)) return 'unavailable'

  // Order matters: a deflection is a deflection even when it is long enough,
  // and an out-of-scope query answered with a deflection is still a deflection.
  if (DEFLECTION_OPENERS.some((r) => r.test(answer))) return 'deflected'

  if (entry.class === 'out_of_scope' && !DECLINE_MARKERS.test(answer)) return 'not_declined'

  // HARD RULE 8 in the system prompt is "RESULTS FIRST: Show data before asking
  // any follow-up question." An answer that is only a question carries no data
  // to have shown, whatever its length — it was passing on character count
  // alone. A question that follows real content is fine and is not flagged.
  // Only when the question IS the answer. An answer that says something real and
  // then asks a follow-up is doing what a good advisor does — "Check the RERA
  // registration and the developer's delivery record. Which project are you
  // looking at?" was being failed for its last sentence. So the length floor
  // applies here too: below it there was no answer, above it there was.
  if (
    !CARRIES_DATA.test(answer) &&
    answer.trimEnd().endsWith('?') &&
    answer.length < minChars(entry.class)
  ) {
    return 'clarifying_only'
  }

  /**
   * Integrity outranks length, and the order is the point.
   *
   * These checks sat below the length floor at first, so a 200-character answer
   * carrying a raw JSON dump graded `too_short` — which understates it, and
   * points at the wrong repair: an answer that is forbidden does not become
   * acceptable by being longer. Presence of a thing a buyer must never see is a
   * harder failure than brevity, so it is decided first.
   *
   * The failures this grader could not see.
   *
   * Everything above catches an answer that is ABSENT — an outage, a
   * deflection, a stub. Every failure found in the 6 Sep review was an answer
   * that was PRESENT, fluent and long, and wrong in a way no length check can
   * reach: a "92% builder delivery score" quoted at a buyer, a count of our own
   * table, the model reading its prompt rules aloud, 1,400 characters of raw
   * JSON with internal UUIDs, and an instruction to avoid two developers whose
   * legal flags it had invented.
   *
   * Every one of those graded `pass` here. That is why a corpus of 120 turns
   * with thirty results files on disk never surfaced any of them.
   *
   * `scanDisclosure` is the SAME function the live chain runs before an answer
   * reaches a buyer, so the grader cannot drift from the product: a class the
   * runtime blocks is a class this fails on, by construction.
   */
  const violations = scanDisclosure(answer)
  if (violations.length > 0) return 'integrity'

  // A ragged ending is a truncated generation. `endCleanly` repairs the shapes
  // it knows about; anything still ending mid-clause is a real defect and was
  // being graded a pass on character count alone.
  if (endsRagged(answer)) return 'truncated'

  if (answer.length < minChars(entry.class)) return 'too_short'

  return 'pass'
}

// ── transport ──────────────────────────────────────────────────────────────

interface Turn {
  text: string
  sessionId: string | null
  /**
   * Chip labels offered after the answer, and the project cards rendered with it.
   *
   * Recorded because they are what the buyer can act on next: a run that keeps
   * only the prose cannot tell whether the turn was useful. The first long-tail
   * run graded 120 answers without capturing a single chip.
   */
  chips: string[]
  cards: string[]
  ttftMs: number | null
  totalMs: number
  error?: string
}

/**
 * The server allows 100 requests/minute per IP and the whole corpus arrives
 * from one. A 429 is the harness outrunning the limiter, not a product failure,
 * so it is waited out rather than recorded — 67 of the first 321 results were
 * 429s and they made the grade table meaningless.
 */
const MAX_429_RETRIES = 6

async function ask(message: string, guestToken: string): Promise<Turn> {
  for (let attempt = 0; ; attempt++) {
    const turn = await askOnce(message, guestToken)
    if (turn.error !== 'HTTP 429' || attempt >= MAX_429_RETRIES) return turn
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
  }
}

async function askOnce(message: string, guestToken: string): Promise<Turn> {
  const t0 = Date.now()
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      // The route reads the question from action.payload.text — BodySchema's
      // transform accepts text/query/label and nothing else, and a top-level
      // `message` is discarded. Sending `payload: { message }` therefore posts
      // an empty question, which the server answers with a greeting. Both
      // scripts/live-chat-test-eval.ts and scripts/run-stress-test-suite.ts
      // still have this bug, so their results measure nothing.
      body: JSON.stringify({
        guestToken,
        action: { type: 'TEXT_MESSAGE', payload: { text: message } },
      }),
    })
    if (!res.ok || !res.body) {
      return { text: '', sessionId: null, chips: [], cards: [], ttftMs: null, totalMs: Date.now() - t0, error: `HTTP ${res.status}` }
    }

    let raw = ''
    let ttftMs: number | null = null
    const decoder = new TextDecoder()
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      if (ttftMs === null) ttftMs = Date.now() - t0
      raw += decoder.decode(chunk, { stream: true })
    }

    let text = ''
    let sessionId: string | null = null
    let chips: string[] = []
    const cards: string[] = []
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data:')) continue
      const body = line.slice(5).trim()
      if (!body || body === '[DONE]') continue
      try {
        const ev = JSON.parse(body)
        const piece = ev.token ?? ev.content ?? ev.text
        if (typeof piece === 'string') text += piece
        if (ev.sessionId) sessionId = ev.sessionId
        // The last ui_state wins: chips are re-emitted as the turn progresses
        // and only the final set is what the buyer is left looking at.
        if (Array.isArray(ev.chips)) {
          chips = (ev.chips as Array<{ label?: string }>).map((c) => c?.label ?? '').filter(Boolean)
        }
        for (const key of ['exactResults', 'nearbyResults', 'properties']) {
          const list = (ev as Record<string, unknown>)[key]
          if (Array.isArray(list)) {
            for (const c of list as Array<{ name?: string }>) if (c?.name) cards.push(c.name)
          }
        }
      } catch {
        text += body
      }
    }
    return { text, sessionId, chips, cards: [...new Set(cards)], ttftMs, totalMs: Date.now() - t0 }
  } catch (err) {
    return {
      text: '',
      sessionId: null,
      chips: [],
      cards: [],
      ttftMs: null,
      totalMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── run ────────────────────────────────────────────────────────────────────

interface Result {
  id: string
  query: string
  class: QueryClass
  grade: Grade
  chars: number
  ttftMs: number | null
  totalMs: number
  sessionId: string | null
  costUsd: number
  promptTokens: number
  completionTokens: number
  calls: number
  model: string
  answer: string
  chips: string[]
  cards: string[]
  error?: string
}

/** Runs `worker` over `items` with at most `n` in flight. */
async function mapLimit<T, R>(items: T[], n: number, worker: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      for (;;) {
        const i = next++
        if (i >= items.length) return
        out[i] = await worker(items[i], i)
      }
    }),
  )
  return out
}

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

async function main() {
  // --demo runs the curated set from pick-demo-set.ts: one query per distinct
  // shape, balanced across classes. It is the set to be satisfied with before
  // running the full 321, which is mostly the same shapes repeated.
  // --top50 is demand-weighted: the queries to be confident about before a
  // launch. --demo is class-balanced: the set that finds bugs. Different jobs.
  const source = process.argv.includes('--longtail')
    ? 'longtail.json'
    : process.argv.includes('--top50')
    ? 'top50.json'
    : process.argv.includes('--demo')
      ? 'demo-set.json'
      : 'corpus.json'
  const corpus: CorpusEntry[] = JSON.parse(readFileSync(join(HERE, source), 'utf8'))
  const only = arg('class')
  const limit = Number(arg('limit', '0'))
  const concurrency = Number(arg('concurrency', '4'))
  const tag = arg('tag', 'baseline')!

  let queries = only ? corpus.filter((e) => e.class === only) : corpus
  if (limit > 0) queries = queries.slice(0, limit)

  console.log(`running ${queries.length} queries from ${source} against ${ENDPOINT} (concurrency ${concurrency})`)
  const runStart = new Date()
  const stamp = `${Date.now()}`

  let done = 0
  const turns = await mapLimit(queries, concurrency, async (entry, i) => {
    const turn = await ask(entry.query, `guest_corpus_${stamp}_${i}`)
    done++
    if (done % 10 === 0 || done === queries.length) {
      process.stdout.write(`  ${done}/${queries.length}\n`)
    }
    return turn
  })

  // Usage rows are written after the stream closes.
  await new Promise((r) => setTimeout(r, 2500))

  const usage = await prisma.aiUsageEvent.findMany({
    where: { created_at: { gte: runStart } },
    select: {
      session_id: true,
      cost_usd: true,
      prompt_tokens: true,
      completion_tokens: true,
      model: true,
      provider: true,
    },
  })

  const bySession = new Map<
    string,
    { cost: number; prompt: number; completion: number; calls: number; model: string }
  >()
  for (const u of usage) {
    if (!u.session_id) continue
    const cur = bySession.get(u.session_id) ?? { cost: 0, prompt: 0, completion: 0, calls: 0, model: '' }
    cur.cost += Number(u.cost_usd)
    cur.prompt += u.prompt_tokens
    cur.completion += u.completion_tokens
    cur.calls++
    cur.model = `${u.provider}/${u.model}`
    bySession.set(u.session_id, cur)
  }

  const results: Result[] = queries.map((entry, i) => {
    const turn = turns[i]
    const u = (turn.sessionId && bySession.get(turn.sessionId)) || {
      cost: 0,
      prompt: 0,
      completion: 0,
      calls: 0,
      model: '',
    }
    return {
      id: entry.id,
      query: entry.query,
      class: entry.class,
      grade: grade(entry, turn.text, Boolean(turn.error)),
      chars: turn.text.trim().length,
      ttftMs: turn.ttftMs,
      totalMs: turn.totalMs,
      sessionId: turn.sessionId,
      costUsd: u.cost,
      promptTokens: u.prompt,
      completionTokens: u.completion,
      calls: u.calls,
      model: u.model,
      answer: turn.text.trim(),
      chips: turn.chips,
      cards: turn.cards,
      ...(turn.error ? { error: turn.error } : {}),
    }
  })

  const outFile = join(HERE, `results-${tag}.json`)
  writeFileSync(outFile, JSON.stringify(results, null, 2))

  report(results)
  console.log(`\nwritten: ${outFile}`)
  await prisma.$disconnect()
}

function pct(n: number, total: number) {
  return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`
}

function report(results: Result[]) {
  const total = results.length
  const byGrade = new Map<Grade, number>()
  for (const r of results) byGrade.set(r.grade, (byGrade.get(r.grade) ?? 0) + 1)

  console.log('\n─── GRADES ───────────────────────────────────────────')
  for (const [g, n] of [...byGrade.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${g.padEnd(14)} ${String(n).padStart(4)}  ${pct(n, total)}`)
  }

  console.log('\n─── BY CLASS ─────────────────────────────────────────')
  const classes = [...new Set(results.map((r) => r.class))]
  console.log(`  ${'class'.padEnd(17)} ${'n'.padStart(4)} ${'pass'.padStart(6)}  top failure`)
  for (const c of classes.sort()) {
    const rows = results.filter((r) => r.class === c)
    const passes = rows.filter((r) => r.grade === 'pass').length
    const fails = new Map<Grade, number>()
    for (const r of rows) if (r.grade !== 'pass') fails.set(r.grade, (fails.get(r.grade) ?? 0) + 1)
    const top = [...fails.entries()].sort((a, b) => b[1] - a[1])[0]
    console.log(
      `  ${c.padEnd(17)} ${String(rows.length).padStart(4)} ${pct(passes, rows.length).padStart(6)}  ${
        top ? `${top[0]} × ${top[1]}` : '—'
      }`,
    )
  }

  const cost = results.reduce((s, r) => s + r.costUsd, 0)
  const promptTok = results.reduce((s, r) => s + r.promptTokens, 0)
  const outTok = results.reduce((s, r) => s + r.completionTokens, 0)
  const priced = results.filter((r) => r.costUsd > 0)
  const lat = results.map((r) => r.totalMs).sort((a, b) => a - b)
  const p = (q: number) => lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] ?? 0

  console.log('\n─── COST & LATENCY ───────────────────────────────────')
  console.log(`  total          $${cost.toFixed(4)} over ${priced.length}/${total} billed queries`)
  console.log(`  per query      $${(cost / Math.max(1, priced.length)).toFixed(6)}`)
  console.log(`  input tokens   ${promptTok.toLocaleString()}  (avg ${Math.round(promptTok / Math.max(1, priced.length))}/query)`)
  console.log(`  output tokens  ${outTok.toLocaleString()}  (avg ${Math.round(outTok / Math.max(1, priced.length))}/query)`)
  console.log(`  latency        p50 ${p(0.5)}ms  p90 ${p(0.9)}ms  p99 ${p(0.99)}ms`)
  console.log(`  at 1k/day      $${(cost / Math.max(1, priced.length) * 1000).toFixed(2)}/day`)
}

/**
 * Only run when invoked directly.
 *
 * `grade()` is exported so a test can assert what it catches, and importing it
 * used to execute the whole corpus run as a side effect — 321 queries against
 * a chat endpoint that was not up, overwriting a results file on the way out.
 * A module that runs on import cannot be tested, which is a large part of why
 * this grader was never covered.
 */
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (invokedDirectly) {
  main().catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
}
