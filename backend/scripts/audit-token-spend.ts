// backend/scripts/audit-token-spend.ts
//
//   npx tsx scripts/audit-token-spend.ts
//
// Where the input tokens actually go, from AiUsageEvent.
//
// "Input is 94% of spend" is true and not actionable. What matters is the
// DISTRIBUTION: if a small number of turn shapes carry most of the tokens,
// optimising the average is wasted effort and optimising the tail is not.
// Prints the percentiles, the concentration, and the per-model split so a
// proposed change can be aimed at the part that is actually expensive.

import { prisma } from '../src/lib/db'

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[i]
}

const n = (v: number) => v.toLocaleString('en-US')

async function main(): Promise<void> {
  const rows = await prisma.aiUsageEvent.findMany({
    select: { prompt_tokens: true, completion_tokens: true, cached_tokens: true, model: true, endpoint: true, cost_usd: true },
    orderBy: { created_at: 'desc' },
    take: 50_000,
  })

  if (rows.length === 0) {
    console.log('No AiUsageEvent rows.')
    return
  }

  const totalIn = rows.reduce((a, r) => a + r.prompt_tokens, 0)
  const totalOut = rows.reduce((a, r) => a + r.completion_tokens, 0)
  const totalCost = rows.reduce((a, r) => a + Number(r.cost_usd), 0)

  console.log(`\n${n(rows.length)} LLM calls`)
  console.log(`input  ${n(totalIn)}   output ${n(totalOut)}   ratio ${(totalIn / Math.max(totalOut, 1)).toFixed(1)}:1`)
  console.log(`cost   $${totalCost.toFixed(4)}   per call $${(totalCost / rows.length).toFixed(5)}`)

  const sorted = rows.map(r => r.prompt_tokens).sort((a, b) => a - b)
  console.log('\nINPUT TOKENS PER CALL')
  console.log('='.repeat(64))
  for (const p of [10, 25, 50, 75, 90, 95, 99]) {
    console.log(`  p${String(p).padEnd(3)} ${n(pct(sorted, p)).padStart(9)}`)
  }
  console.log(`  max  ${n(sorted[sorted.length - 1]).padStart(9)}`)
  console.log(`  mean ${n(Math.round(totalIn / rows.length)).padStart(9)}`)

  // Concentration: how much of the bill comes from the worst calls?
  const byTokens = [...rows].sort((a, b) => b.prompt_tokens - a.prompt_tokens)
  console.log('\nCONCENTRATION — share of ALL input tokens')
  console.log('='.repeat(64))
  for (const share of [1, 5, 10, 25, 50]) {
    const cut = Math.max(1, Math.round((share / 100) * byTokens.length))
    const sum = byTokens.slice(0, cut).reduce((a, r) => a + r.prompt_tokens, 0)
    console.log(`  worst ${String(share).padStart(2)}% of calls  ->  ${((sum / totalIn) * 100).toFixed(1)}% of input tokens`)
  }

  // Buckets, so a fix can be aimed at a band rather than an average.
  const BANDS = [0, 1000, 2500, 5000, 10000, 20000, 40000, Infinity]
  console.log('\nBY SIZE BAND')
  console.log('='.repeat(64))
  console.log(`  ${'band'.padEnd(18)} ${'calls'.padStart(7)} ${'% calls'.padStart(8)} ${'input tok'.padStart(12)} ${'% input'.padStart(8)}`)
  for (let i = 0; i < BANDS.length - 1; i++) {
    const lo = BANDS[i], hi = BANDS[i + 1]
    const band = rows.filter(r => r.prompt_tokens >= lo && r.prompt_tokens < hi)
    if (band.length === 0) continue
    const sum = band.reduce((a, r) => a + r.prompt_tokens, 0)
    const label = hi === Infinity ? `${n(lo)}+` : `${n(lo)}–${n(hi)}`
    console.log(
      `  ${label.padEnd(18)} ${n(band.length).padStart(7)} ${((band.length / rows.length) * 100).toFixed(1).padStart(7)}% ` +
      `${n(sum).padStart(12)} ${((sum / totalIn) * 100).toFixed(1).padStart(7)}%`,
    )
  }

  // Per model — which leg is actually carrying the traffic and the cost.
  const byModel = new Map<string, { calls: number; input: number; output: number; cached: number; cost: number }>()
  for (const r of rows) {
    const m = byModel.get(r.model) ?? { calls: 0, input: 0, output: 0, cached: 0, cost: 0 }
    m.calls++; m.input += r.prompt_tokens; m.output += r.completion_tokens
    m.cached += r.cached_tokens; m.cost += Number(r.cost_usd)
    byModel.set(r.model, m)
  }
  console.log('\nBY MODEL')
  console.log('='.repeat(78))
  console.log(`  ${'model'.padEnd(30)} ${'calls'.padStart(6)} ${'avg in'.padStart(8)} ${'cached%'.padStart(8)} ${'cost $'.padStart(9)}`)
  for (const [model, m] of [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
    console.log(
      `  ${model.slice(0, 30).padEnd(30)} ${n(m.calls).padStart(6)} ${n(Math.round(m.input / m.calls)).padStart(8)} ` +
      `${((m.cached / Math.max(m.input, 1)) * 100).toFixed(1).padStart(7)}% ${m.cost.toFixed(4).padStart(9)}`,
    )
  }

  // Endpoint split — is this chat, or something else quietly spending?
  const byEndpoint = new Map<string, { calls: number; input: number }>()
  for (const r of rows) {
    const e = byEndpoint.get(r.endpoint) ?? { calls: 0, input: 0 }
    e.calls++; e.input += r.prompt_tokens
    byEndpoint.set(r.endpoint, e)
  }
  console.log('\nBY ENDPOINT')
  console.log('='.repeat(64))
  for (const [ep, e] of [...byEndpoint.entries()].sort((a, b) => b[1].input - a[1].input).slice(0, 10)) {
    console.log(`  ${ep.slice(0, 30).padEnd(30)} ${n(e.calls).padStart(7)} calls  ${((e.input / totalIn) * 100).toFixed(1).padStart(5)}% of input`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
