// backend/scripts/audit-query-readiness.ts
//
//   npx tsx scripts/audit-query-readiness.ts
//
// Can we answer what Noida buyers actually ask?
//
// Reads the real query and keyword corpora at the repo root
// (topQueriesAndKeywords.md, keywords.md) and pushes every one through the
// DECISION layers, statically — no provider call, no spend, no database.
//
// For each query it reports:
//   EXTRACT  what intent extraction does with it — reads it outright, sends it
//            to a model, or correctly finds nothing to read
//   CLAIMED  which deterministic topic handler takes the turn, if any
//   FRAME    which advisory playbook is selected, if any
//
// A query with no handler AND no playbook is answered by the generic lane from
// whatever the model knows, with no framing of ours — which is exactly where
// unverified or vague answers come from. Those are the rows worth reading.

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { matchedPlaybooks } from '../src/lib/ai/prompts/playbooks'
import { nothingToExtract } from '../src/lib/ai/intent'
import { extractDeterministic } from '../src/lib/ai/intentDeterministic'
import { isReraProcessQuestion, isPaymentPlanRequest, isReraGuaranteeQuestion } from '../src/lib/chat/topicFlags'

const ROOT = resolve(__dirname, '..', '..')

/** Decode the HTML entities the source docs carry. */
function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function readQueries(): string[] {
  const md = decode(readFileSync(resolve(ROOT, 'topQueriesAndKeywords.md'), 'utf8'))
  const out = new Set<string>()
  // Queries are written as **"...."** in the source document.
  for (const m of md.matchAll(/\*\*"([^"]{12,300})"\*\*/g)) out.add(m[1].replace(/\s+/g, ' ').trim())
  // A few are bolded without quotes but end in a question mark.
  for (const m of md.matchAll(/\*\*([^*"]{15,220}\?)\*\*/g)) out.add(m[1].replace(/\s+/g, ' ').trim())
  return [...out]
}

function readKeywords(): string[] {
  const md = decode(readFileSync(resolve(ROOT, 'keywords.md'), 'utf8'))
  return md
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && !/^[A-Za-z, &]+\(\d+[–-]\d+\)$/.test(l) && !/^\s*$/.test(l))
}

/**
 * Topic flags that live inline in chat-router rather than in topicFlags.ts.
 * Copied deliberately and marked as such — this audit must not drift silently,
 * so a mismatch here is a finding in itself.
 */
const INLINE_FLAGS: Array<[string, RegExp]> = [
  ['statutory_tax', /(stamp duty|registration (charges?|fees?)|gst on (flat|property|real estate)|tds on (property|sale)|circle rate|index 2|agreement value charges)/i],
  ['builder_reputation', /\b(builder|developer)\s*(track\s*record|reputation|credibility|delivery\s*score|ranking|reliability|history|score)\b|\b(which|best|top|reputable|reliable)\s*(builder|developer|company)\b|\b(developer\s*track|on.?time\s*delivery|delivery\s*track\s*record|safe\s*to\s*buy\s*from)\b/i],
  ['newcomer_orientation', /(new to noida|new to (the )?city|which sector|best sector|where (should|to) (buy|look)|area guide|sector guide|best area for family|best area near)/i],
  ['ready_to_move', /\b(ready to move|rtm|occupancy certificates?|which.*ready|ready propert(y|ies)|ready flats?)\b/i],
  ['amenity', /(amenit|clubhouse|\bgym\b|\bpools?\b|swimming|playground|creche|\bparks?\b|green cover|ev charg)/i],
  ['configuration', /(balcon|bedroom|bathroom|carpet area|super area|sqft|square feet|size of|how big|configuration|unit type|floor plan)/i],
  ['total_outflow', /(total (price|cost|amount|outflow)|on.?road|all.?inclusive price|how much (in total|total will it cost)|with registry|final price)/i],
  ['subvention', /\b(subvention|20[:\s]*80|10[:\s]*90|80[:\s]*20|builder\s+subvention)\b/i],
]

function claimedBy(q: string): string[] {
  const hits: string[] = []
  if (isReraGuaranteeQuestion(q)) hits.push('rera_guarantee')
  if (isReraProcessQuestion(q)) hits.push('rera_verification')
  if (isPaymentPlanRequest(q)) hits.push('payment_plans')
  for (const [name, rx] of INLINE_FLAGS) if (rx.test(q)) hits.push(name)
  return hits
}

function extractionPath(q: string): string {
  const d = extractDeterministic(q, new Set<number>())
  if (d.literal.size > 0) return 'deterministic'
  if (nothingToExtract(q)) return 'no-signal'
  return 'model'
}

interface Row { q: string; extract: string; claimed: string[]; frame: string[] }

function main(): void {
  const queries = readQueries()
  const keywords = readKeywords()

  const rows: Row[] = queries.map((q) => ({
    q,
    extract: extractionPath(q),
    claimed: claimedBy(q),
    frame: matchedPlaybooks(q),
  }))

  const covered = rows.filter((r) => r.claimed.length > 0 || r.frame.length > 0)
  const uncovered = rows.filter((r) => r.claimed.length === 0 && r.frame.length === 0)

  console.log(`\nQUERY READINESS — ${rows.length} queries from topQueriesAndKeywords.md`)
  console.log('='.repeat(80))
  console.log(`  answered by a handler or a framed playbook : ${covered.length} (${((covered.length / rows.length) * 100).toFixed(0)}%)`)
  console.log(`  generic lane only, no framing of ours      : ${uncovered.length}`)

  const byExtract = new Map<string, number>()
  for (const r of rows) byExtract.set(r.extract, (byExtract.get(r.extract) ?? 0) + 1)
  console.log('\n  extraction path:')
  for (const [k, v] of [...byExtract].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(15)} ${v}`)
  }

  if (uncovered.length) {
    console.log('\nNO HANDLER, NO PLAYBOOK — answered from model knowledge alone:')
    console.log('='.repeat(80))
    for (const r of uncovered) console.log(`  [${r.extract.padEnd(13)}] ${r.q.slice(0, 96)}`)
  }

  console.log('\nCOVERED (handler / playbook):')
  console.log('='.repeat(80))
  for (const r of covered) {
    const tag = [...r.claimed.map((c) => `H:${c}`), ...r.frame.map((f) => `P:${f}`)].join(' ')
    console.log(`  ${tag.padEnd(46)} ${r.q.slice(0, 62)}`)
  }

  // Keywords: a vocabulary check rather than a routing one. A keyword nothing
  // recognises is a term a buyer may use that nothing in the product frames.
  const kwUncovered = keywords.filter((k) => claimedBy(k).length === 0 && matchedPlaybooks(k).length === 0)
  console.log(`\nKEYWORD VOCABULARY — ${keywords.length} terms from keywords.md`)
  console.log('='.repeat(80))
  console.log(`  recognised by a handler or playbook : ${keywords.length - kwUncovered.length}`)
  console.log(`  recognised by nothing               : ${kwUncovered.length}`)
  if (kwUncovered.length) {
    console.log('\n  unrecognised terms:')
    for (const k of kwUncovered) console.log(`    - ${k.slice(0, 74)}`)
  }
}

main()
