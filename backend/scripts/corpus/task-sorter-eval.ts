// Scores the task sorter (src/lib/chat/taskSorter.ts) against hand labels of real live turns
// (src/lib/eval/task-labels.json) and shows, per task, which lane the router used and how long
// it took. Read-only against Neon (NEON_DB). Usage: npx tsx scripts/corpus/task-sorter-eval.ts
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { sortTask, TASKS } from '../../src/lib/chat/taskSorter'

const { labels } = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/lib/eval/task-labels.json'), 'utf8')) as {
  labels: Record<string, string>
}
const neon = new PrismaClient({ datasources: { db: { url: process.env.NEON_DB } } })

async function main() {
  const rows = await neon.$queryRaw<Array<{ id: string; lane: string; latency_ms: number; msg: string | null }>>`
    SELECT t.id, t.lane, t.latency_ms,
      (SELECT m.content FROM chat_messages m WHERE m.session_id = t.session_id AND m.role = 'user'
         AND m.created_at <= t.created_at + interval '2 seconds' ORDER BY m.created_at DESC LIMIT 1) AS msg
    FROM turn_traces t WHERE t.id = ANY(${Object.keys(labels)})`

  const scored = rows.filter((r) => labels[r.id] && labels[r.id] !== 'none')
  let right = 0
  const perTask = new Map<string, { n: number; hit: number; predicted: number }>()
  const misses: string[] = []
  for (const r of scored) {
    const want = labels[r.id]
    const got = sortTask(r.msg)
    const t = perTask.get(want) ?? { n: 0, hit: 0, predicted: 0 }
    t.n++
    if (got.task === want) { t.hit++; right++ } else misses.push(`want ${want}, got ${got.task} (${got.rule}): ${String(r.msg).replace(/\s+/g, ' ').slice(0, 90)}`)
    perTask.set(want, t)
    const p = perTask.get(got.task) ?? { n: 0, hit: 0, predicted: 0 }
    p.predicted++
    perTask.set(got.task, p)
  }

  const out: string[] = []
  out.push(`Turns scored: ${scored.length}. Sorter agrees with the hand label on ${right} (${((right / scored.length) * 100).toFixed(1)}%).`, '')
  out.push('| Task | Labelled | Sorter right | Recall | Sorter said this | Precision |', '|---|---|---|---|---|---|')
  for (const task of TASKS) {
    const t = perTask.get(task)
    if (!t || (!t.n && !t.predicted)) continue
    const precision = t.predicted ? `${((t.hit / t.predicted) * 100).toFixed(0)}%` : '—'
    const recall = t.n ? `${((t.hit / t.n) * 100).toFixed(0)}%` : '—'
    out.push(`| ${task} | ${t.n} | ${t.hit} | ${recall} | ${t.predicted} | ${precision} |`)
  }

  out.push('', '**Where each labelled task went (lane used by the live router, turns, average seconds):**', '')
  out.push('| Task | Lanes |', '|---|---|')
  for (const task of TASKS) {
    const lanes = new Map<string, { n: number; ms: number }>()
    for (const r of scored.filter((x) => labels[x.id] === task)) {
      const l = lanes.get(r.lane) ?? { n: 0, ms: 0 }
      l.n++; l.ms += r.latency_ms
      lanes.set(r.lane, l)
    }
    if (!lanes.size) continue
    const cells = [...lanes].sort((a, b) => b[1].n - a[1].n).map(([lane, l]) => `${lane} ${l.n} (${(l.ms / l.n / 1000).toFixed(1)} s)`)
    out.push(`| ${task} | ${cells.join(', ')} |`)
  }

  out.push('', `**Disagreements (${misses.length}):**`, '', ...misses.map((m) => `- ${m}`))
  console.log(out.join('\n'))
}

main().finally(() => neon.$disconnect())
