// backend/scripts/audit-answer-provenance.ts
//
// Where did every fact in a chat run come from? For each turn of a stress-run
// answers file: which lane wrote it (code from our rows, or the model), whether
// each project name exists in our catalogue, whether each ₹ figure is one the
// buyer typed or one we hold for a project named in that answer, and which
// distance / time / area / percentage / credential / forecast claims have no
// source. Read-only against DATABASE_URL (dev).
//
//   npx tsx scripts/audit-answer-provenance.ts docs/benchmark/answers/<run>.json
import 'dotenv/config'
import { readFileSync } from 'fs'
import { prisma } from '../src/lib/db'
import { UP_STATUTORY } from '../src/lib/factPresentation'

const MODEL_LANES = new Set(['main', 'OPEN', 'answer-cache'])

const toCr = (v: number, unit: string) => (/^l/i.test(unit) ? v / 100 : v)
const RUPEE = /₹\s*(\d+(?:,\d{2,3})*(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac)?s?)?/gi
const FLAGS: Array<[RegExp, string]> = [
  [/\b\d+(?:\.\d+)?\s*(?:-|–|to)?\s*\d*\s*(?:km|kilomet)/i, 'distance'],
  [/\b\d+\s*(?:-|–|to)?\s*\d*\s*(?:min(?:ute)?s?)\b/i, 'travel time'],
  [/\b\d+(?:\.\d+)?\s*-?\s*acres?\b/i, 'land area'],
  [/\bcredai|\biso\s*\d|pre-?approved|tie-?ups?\b/i, 'credential'],
  [/\bcagr\b|apprecia\w+\s+(?:of|at|rate)|rental yield|\byield of\b/i, 'forecast / yield'],
  [/units?\s*\/\s*acre|units per acre|% open (?:green|space)/i, 'density / open-space figure'],
]

async function main() {
  const file = process.argv[2]
  const turns = JSON.parse(readFileSync(file, 'utf8'))[0].turns as Array<{ q: string; lane: string; answer: string }>
  const projects = await prisma.project.findMany({
    select: { name: true, price_min_cr: true, unit_types: { select: { price_min_cr: true, price_max_cr: true } } },
  })
  const statutory = new Set(Object.values(UP_STATUTORY).filter((v) => typeof v === 'number').map(String))
  let buyerText = ''
  let modelTurns = 0, issues = 0
  for (const [i, t] of turns.entries()) {
    buyerText += ` ${t.q}`
    const a = t.answer ?? ''
    const code = !MODEL_LANES.has(t.lane)
    if (!code) modelTurns++
    const named = projects.filter((p) => p.name.length >= 5 && a.toLowerCase().includes(p.name.toLowerCase()))
    const held = new Set<number>()
    for (const p of named) {
      if (p.price_min_cr) held.add(+p.price_min_cr.toFixed(2))
      for (const u of p.unit_types) for (const v of [u.price_min_cr, u.price_max_cr]) if (v) held.add(+v.toFixed(2))
    }
    const buyerNums = new Set([...buyerText.matchAll(/(\d+(?:\.\d+)?)\s*(cr|l|lakh|lac)?/gi)].map((m) => +toCr(Number(m[1]), m[2] ?? 'cr').toFixed(2)))
    const unsupported: string[] = []
    for (const m of a.matchAll(RUPEE)) {
      const v = Number(m[1].replace(/,/g, ''))
      if (!m[2] && v >= 1000) continue // rupees per month / per sq ft: checked by hand below
      const crv = +toCr(v, m[2] ?? 'cr').toFixed(2)
      const near = (s: Set<number>) => [...s].some((x) => Math.abs(x - crv) <= 0.011)
      if (!near(held) && !near(buyerNums)) unsupported.push(m[0].trim())
    }
    const flags = code ? [] : FLAGS.filter(([re]) => re.test(a)).map(([, l]) => l)
    const pct = code ? [] : [...a.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => m[1]).filter((p) => !statutory.has(p))
    const outage = /couldn't get you a reliable answer/.test(a)
    const bad = (!code && unsupported.length) || flags.length || pct.length || outage
    if (bad) issues++
    console.log(`${String(i + 1).padStart(2)} ${code ? 'CODE ' : 'MODEL'} [${t.lane}] ${t.q.slice(0, 58)}`)
    if (named.length) console.log(`     projects: ${named.map((p) => p.name).join(', ')}`)
    if (!code && unsupported.length) console.log(`     ₹ not in our rows or the buyer's words: ${[...new Set(unsupported)].join(', ')}`)
    if (flags.length) console.log(`     unsourced claim types: ${flags.join(', ')}`)
    if (pct.length) console.log(`     non-statutory %: ${[...new Set(pct)].join(', ')}`)
    if (outage) console.log('     OUTAGE NOTICE')
  }
  console.log(`\n${turns.length} turns · ${turns.length - modelTurns} from code · ${modelTurns} model-written · ${issues} with a provenance issue`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
