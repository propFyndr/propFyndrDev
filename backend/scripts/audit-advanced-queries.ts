// backend/scripts/audit-advanced-queries.ts
//
//   npx tsx scripts/audit-advanced-queries.ts [path-to-queries.json]
//
// The queries in topQueriesFollowedFollower.md are not inventory searches. They
// are regulatory, insolvency, environmental and tax questions — the ones a
// distressed or institutional buyer arrives with. Almost none of them can be
// answered from our project rows, so the thing worth measuring is not whether
// we found a project. It is whether we answered at all, whether we made
// anything up, and whether we leaked our own numbers while doing it.
//
// Graded on failure modes rather than a score, for the reason the results-first
// audit gives: a pass rate on this corpus carries more provider noise than most
// changes worth making.

import fs from 'node:fs'

const ENDPOINT = process.env.CHAT_ENDPOINT || 'http://localhost:3001/api/v1/chat'
const QUERIES: string[] = JSON.parse(fs.readFileSync(process.argv[2] || '/tmp/tq2.json', 'utf8'))

/** The turn gave up instead of answering. */
const DEFLECTED =
  /\b(i (don't|do not) (have|hold)|not (in|available in) our (database|records)|unable to (help|answer)|cannot (help|assist) with (that|this)|outside (our|the) scope|no information (on|about))\b/i

/** An outage dressed as an answer. */
const OUTAGE = /\b(high traffic|experiencing (high|technical)|try again (in a|later)|services are)\b/i

/** Our own shelf size, which is never the buyer's business. */
const INVENTORY_LEAK =
  /\b(\d{2,4}\s+(projects?|societies|listings?|properties)\s+(in|across|our)|our (database|inventory) (has|holds|contains)\s+\d|we (have|hold|track)\s+\d{2,4}\b)/i

/** A number invented for a statute: section numbers and percentages we do not verify. */
const RISKY_SPECIFIC = /\b(section\s+\d+[A-Za-z]?|\d{1,3}(\.\d+)?%|₹\s?\d[\d,.]*\s?(cr|crore|lakh|lakhs))\b/i

interface Row { q: string; chars: number; cards: number; flags: string[]; head: string }

async function ask(message: string): Promise<Row> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({
      guestToken: `adv_${process.pid}_${Math.random().toString(36).slice(2, 8)}`,
      action: { type: 'TEXT_MESSAGE', payload: { text: message } },
    }),
    signal: AbortSignal.timeout(150_000),
  })
  let text = ''
  let cards = 0
  const dec = new TextDecoder()
  let buf = ''
  if (res.body) {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += dec.decode(chunk, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        try {
          const e = JSON.parse(line.slice(5).trim()) as Record<string, unknown>
          if (typeof e.token === 'string') text += e.token
          if (Array.isArray(e.exactResults)) cards = (e.exactResults as unknown[]).length
        } catch { /* keepalive */ }
      }
    }
  }
  const flags: string[] = []
  if (OUTAGE.test(text)) flags.push('OUTAGE')
  if (DEFLECTED.test(text)) flags.push('DEFLECTED')
  if (INVENTORY_LEAK.test(text)) flags.push('INVENTORY_LEAK')
  if (text.trim().length < 200) flags.push('THIN')
  if (RISKY_SPECIFIC.test(text)) flags.push('specific-figures')
  return { q: message, chars: text.trim().length, cards, flags, head: text.replace(/\s+/g, ' ').slice(0, 150) }
}

async function main(): Promise<void> {
  const rows: Row[] = []
  for (const q of QUERIES) {
    const r = await ask(q)
    const bad = r.flags.filter((f) => f !== 'specific-figures')
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${String(r.chars).padStart(5)}c ${r.flags.join(',').padEnd(26)} ${q.slice(0, 74)}`)
    if (bad.length) console.log(`        ${r.head}`)
    rows.push(r)
    await new Promise((s) => setTimeout(s, 900))
  }
  const count = (f: string) => rows.filter((r) => r.flags.includes(f)).length
  console.log(`\n${rows.length} queries`)
  for (const f of ['OUTAGE', 'DEFLECTED', 'INVENTORY_LEAK', 'THIN', 'specific-figures']) {
    console.log(`  ${f.padEnd(18)} ${count(f)}`)
  }
  const hard = rows.filter((r) => r.flags.some((f) => f !== 'specific-figures')).length
  console.log(`\n${rows.length - hard}/${rows.length} answered without deflecting, leaking or failing`)
  if (hard > 0) process.exitCode = 1
}

main()
