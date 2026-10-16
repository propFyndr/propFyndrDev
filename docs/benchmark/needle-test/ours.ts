// Runs our live intent extractor with every model call stubbed (deterministic reading only),
// and records whether the turn would have called the model (no "[INTENT:DETERMINISTIC]" log).
process.env.NODE_ENV = 'test'
process.env.LLM_STUB = '1'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
const dir = __dirname

async function main() {
  const { extractIntent } = await import('file:///C:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/intent.ts')
  const qs = JSON.parse(readFileSync(join(dir, 'questions.json'), 'utf8'))
  const logs: string[] = []
  const orig = console.log
  console.log = (...a: unknown[]) => { logs.push(a.map(String).join(' ')) }
  await extractIntent('warm up', {} as any)
  await new Promise((r) => setTimeout(r, 4000)) // let the known-sector list load
  const out = []
  for (const q of qs) {
    let intent: any = {}
    const turns = []
    for (const t of q.turns) {
      logs.length = 0
      const t0 = performance.now()
      const r = await extractIntent(t, intent)
      const ms = performance.now() - t0
      intent = r.intent
      turns.push({ text: t, ms: +ms.toFixed(2), wouldCallModel: !logs.some((l) => l.includes('[INTENT:DETERMINISTIC]') || l.includes('[INTENT:NO_SIGNAL]')) })
    }
    out.push({ id: q.id, turns, intent })
  }
  console.log = orig
  writeFileSync(join(dir, 'ours.json'), JSON.stringify(out, null, 1))
  console.log('ok', out.length)
  process.exit(0)
}
main()
