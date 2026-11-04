// Cycle 2 Day 1 task 6 (and the weekly task 2): ask the 40 safety questions, score every answer,
// ours and other assistants', on the same four counts (safetyScore.ts).
//
//   # our answers, through a running backend (real model chain):
//   CHAT_ENDPOINT=http://localhost:3201/api/v1/chat npx tsx scripts/corpus/safety40.ts ours --label before
//
//   # other assistants' answers, pasted weekly (free; see docs/benchmark/external-ai/README.md):
//   npx tsx scripts/corpus/safety40.ts external docs/benchmark/external-ai/2026-11-04
//
// Writes docs/benchmark/safety40/<label>.json. For external runs it also writes
// claims-to-check.json beside the pasted files: every sentence with a figure about complaints,
// orders, court cases, registration, OC or possession, as a "check this on UP-RERA" list for the
// approver. Internal only; never shown to buyers, never written to a project row.
import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { scoreSafety, type SafetyScore } from './safetyScore'

const ROOT = join(__dirname, '../../..')
const OUT_DIR = join(ROOT, 'docs/benchmark/safety40')
const ENDPOINT = process.env.CHAT_ENDPOINT || 'http://localhost:3001/api/v1/chat'

export function questions(): { id: string; project: string; q: string }[] {
  const set = JSON.parse(readFileSync(join(__dirname, process.env.SAFETY_SET ?? 'safety40.json'), 'utf8')) as { projects: string[]; phrasings: string[] }
  return set.projects.flatMap((p, i) => set.phrasings.map((f, j) => ({ id: `s${i + 1}.${j + 1}`, project: p, q: f.replace('{p}', p) })))
}

async function ask(text: string): Promise<{ answer: string; totalMs: number; error?: string }> {
  const t0 = Date.now()
  try {
    // A non-website token shape: these turns count as a script, never as a real person.
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ guestToken: `bench-safety40-${randomUUID()}`, action: { type: 'TEXT_MESSAGE', payload: { text } } }),
    })
    if (!res.ok || !res.body) return { answer: '', totalMs: Date.now() - t0, error: `HTTP ${res.status}` }
    let raw = ''
    const dec = new TextDecoder()
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) raw += dec.decode(chunk, { stream: true })
    let answer = ''
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data:')) continue
      try {
        const ev = JSON.parse(line.slice(5).trim())
        const piece = ev.token ?? ev.content ?? ev.text
        if (typeof piece === 'string') answer = ev.replace ? piece : answer + piece
      } catch { /* keep-alive or non-JSON line */ }
    }
    return { answer, totalMs: Date.now() - t0 }
  } catch (e) {
    return { answer: '', totalMs: Date.now() - t0, error: (e as Error).message }
  }
}

const CLAIM_TOPIC = /complaint|order|court|litigation|case|nclt|insolven|rera|registration|occupancy|\boc\b|possession|delay|abeyance/i

function totals(rows: { score: SafetyScore }[]) {
  const t = { sourced: 0, unsourced: 0, reassurance: 0, notOnRecord: 0, answersWithReassurance: 0 }
  for (const { score } of rows) {
    t.sourced += score.sourced; t.unsourced += score.unsourced; t.reassurance += score.reassurance; t.notOnRecord += score.notOnRecord
    if (score.reassurance > 0) t.answersWithReassurance++
  }
  return t
}

async function runOurs(label: string) {
  const rows = []
  for (const item of questions()) {
    const r = await ask(item.q)
    rows.push({ ...item, ...r, score: scoreSafety(r.answer) })
    process.stdout.write(`${item.id} ${r.error ?? `${r.totalMs}ms`} reassurance=${rows.at(-1)!.score.reassurance}\n`)
    await new Promise((res) => setTimeout(res, 3000)) // free provider chain: pace it
  }
  mkdirSync(OUT_DIR, { recursive: true })
  const file = join(OUT_DIR, `${label}.json`)
  writeFileSync(file, JSON.stringify({ label, endpoint: ENDPOINT, ranAt: new Date().toISOString(), totals: totals(rows), rows }, null, 2))
  console.log(JSON.stringify(totals(rows)), '->', file)
}

/** Pasted file shape: [{ "q": "...", "answer": "...", "links": ["..."] }], one file per assistant. */
function runExternal(dir: string) {
  const claims: { platform: string; q: string; claim: string; links: string[]; check: string }[] = []
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'claims-to-check.json')) {
    const platform = basename(f, '.json')
    const items = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { q: string; answer: string; links?: string[] }[]
    const rows = items.map((it) => ({ ...it, score: scoreSafety(it.answer) }))
    for (const it of items) {
      for (const s of (it.answer.match(/[^.!?\n]+[.!?]?/g) ?? []).map((x) => x.trim())) {
        if (/\d/.test(s) && CLAIM_TOPIC.test(s)) claims.push({ platform, q: it.q, claim: s, links: it.links ?? [], check: 'Check this on UP-RERA before it enters any record. Internal only.' })
      }
    }
    mkdirSync(OUT_DIR, { recursive: true })
    const out = join(OUT_DIR, `${basename(dir)}-${platform}.json`)
    writeFileSync(out, JSON.stringify({ platform, source: dir, totals: totals(rows), rows }, null, 2))
    console.log(platform, JSON.stringify(totals(rows)), '->', out)
  }
  writeFileSync(join(dir, 'claims-to-check.json'), JSON.stringify(claims, null, 2))
  console.log(`claims to check on UP-RERA: ${claims.length}`)
}

if (require.main === module) {
  const [mode, arg] = process.argv.slice(2)
  const label = process.argv.includes('--label') ? process.argv[process.argv.indexOf('--label') + 1] : 'run'
  if (mode === 'ours') runOurs(label).catch((e) => { console.error(e); process.exitCode = 1 })
  else if (mode === 'external' && arg) runExternal(arg)
  else console.error('usage: safety40.ts ours --label <name> | external <dir>')
}
