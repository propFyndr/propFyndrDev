// backend/scripts/corpus/route-replay.ts
//
// Replays src/lib/eval/route-replay.json through the real chat route with the
// model stubbed. Zero tokens, no Redis, cleans up its guest sessions.
//
//   npx tsx scripts/corpus/route-replay.ts            # table + exit 1 on any failure
//   npx tsx scripts/corpus/route-replay.ts --answers  # also print each answer
//   npx tsx scripts/corpus/route-replay.ts q5-catch   # only cases whose id contains this

import '../../src/lib/eval/replayEnv'
import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from '../../src/index'
import { prisma } from '../../src/lib/db'
import { runReplay, formatResults, type ReplayCase } from '../../src/lib/eval/routeReplay'

async function main() {
  const args = process.argv.slice(2)
  const showAnswers = args.includes('--answers')
  const filter = args.find((a) => !a.startsWith('--'))
  const all = JSON.parse(readFileSync(join(__dirname, '../../src/lib/eval/route-replay.json'), 'utf8')) as ReplayCase[]
  const cases = filter ? all.filter((c) => c.id.includes(filter)) : all

  const results = await runReplay(app as never, cases)
  // Stdout carries only the report; the router's own logs go to the console above it.
  process.stdout.write('\n==== ROUTE REPLAY ====\n' + formatResults(results) + '\n')
  if (showAnswers) {
    for (const r of results) process.stdout.write(`\n---- ${r.caseId}#${r.turn} [${r.lane}]\n${r.answer.slice(0, 1500)}\n`)
  }
  const failed = results.filter((r) => r.failures.length)
  const llm = results.filter((r) => r.usedLlm).length
  process.stdout.write(`\n${results.length - failed.length}/${results.length} turns pass · ${results.length - llm} answered by code, ${llm} by the model\n`)
  await prisma.$disconnect()
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
