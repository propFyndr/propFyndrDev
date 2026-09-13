// backend/scripts/measure-prompt.ts
//
//   npx tsx scripts/measure-prompt.ts
//
// What the system prompt actually costs, per turn shape, broken down by section.
//
// Every prompt-size change in this codebase so far was justified by a measured
// number (the playbook extraction quotes 5,569 characters; the tool gating
// quotes 1,860 tokens/turn). This keeps that honest: it prints the current
// numbers so a proposed cut can be argued against the real distribution rather
// than a hunch about which block "feels" long.
//
// Free and offline — no provider call.

import { getBaseSystemPrompt, splitSystemPrompt, SYSTEM_PROMPT_BOUNDARY } from '../src/lib/ai/prompts/base'
import { estimateTokensReal } from '../src/lib/ai/tokenizer'
import type { QueryKind } from '../src/lib/discovery/types'

interface Shape {
  label: string
  message: string
  intent: Record<string, unknown>
  queryKind: QueryKind
  intentState: string
}

const SHAPES: Shape[] = [
  { label: 'greeting', message: 'hi', intent: {}, queryKind: 'OPEN' as QueryKind, intentState: 'GATHERING' },
  { label: 'discovery (3bhk + sector + budget)', message: 'Show me 3BHK in Sector 150 under 2 crore', intent: { bhk: [3], sector: 'Sector 150', budgetMax: 2 }, queryKind: 'PROPERTY_SEARCH' as QueryKind, intentState: 'SHORTLISTED' },
  { label: 'advisory (legal)', message: 'Why is the registry delayed even after possession?', intent: {}, queryKind: 'OPEN' as QueryKind, intentState: 'GATHERING' },
  { label: 'advisory (cost stack)', message: 'What are the hidden costs beyond the basic sale price?', intent: {}, queryKind: 'OPEN' as QueryKind, intentState: 'GATHERING' },
  { label: 'comparison', message: 'Is Sector 128 worth the premium over Sector 137?', intent: { sector: 'Sector 128' }, queryKind: 'COMPARISON' as QueryKind, intentState: 'COMPARING' },
  { label: 'project detail', message: 'Tell me about Ace Divino', intent: { projectNames: ['Ace Divino'] }, queryKind: 'PROJECT_DETAIL' as QueryKind, intentState: 'SHORTLISTED' },
]

/** Split the prompt on its markdown headings so each block can be costed. */
function sections(prompt: string): Array<{ heading: string; chars: number; tokens: number }> {
  const lines = prompt.split('\n')
  const out: Array<{ heading: string; chars: number; tokens: number }> = []
  let heading = '(preamble)'
  let buf: string[] = []
  const flush = () => {
    if (!buf.length) return
    const text = buf.join('\n')
    out.push({ heading, chars: text.length, tokens: estimateTokensReal(text) })
    buf = []
  }
  for (const line of lines) {
    if (/^#{1,3}\s+\S/.test(line) || line.startsWith('---')) {
      flush()
      heading = line.replace(/^#+\s*/, '').slice(0, 58) || '(rule)'
    }
    buf.push(line)
  }
  flush()
  return out
}

function pad(n: number, w: number): string {
  return String(n).padStart(w)
}

function main(): void {
  console.log('\nSYSTEM PROMPT COST BY TURN SHAPE')
  console.log('='.repeat(78))

  const totals: Array<{ label: string; tokens: number; head: number; tail: number }> = []

  for (const s of SHAPES) {
    for (const toolsEnabled of [true, false]) {
      const prompt = getBaseSystemPrompt(s.intent, [], 'noida' as never, s.intentState, s.queryKind, s.message, toolsEnabled)
      const tokens = estimateTokensReal(prompt)
      const { head, tail } = splitSystemPrompt(prompt)
      if (toolsEnabled) {
        totals.push({ label: s.label, tokens, head: estimateTokensReal(head), tail: estimateTokensReal(tail) })
      }
      console.log(
        `${s.label.padEnd(36)} tools=${toolsEnabled ? 'yes' : 'no '}  ` +
        `${pad(tokens, 6)} tok  ${pad(prompt.length, 7)} chars`,
      )
    }
  }

  console.log('\nCACHEABLE HEAD vs PER-TURN TAIL (tools enabled)')
  console.log('='.repeat(78))
  console.log(`${'shape'.padEnd(36)} ${'head'.padStart(7)} ${'tail'.padStart(7)} ${'tail %'.padStart(7)}`)
  for (const t of totals) {
    const pct = t.tokens > 0 ? Math.round((t.tail / t.tokens) * 100) : 0
    console.log(`${t.label.padEnd(36)} ${pad(t.head, 7)} ${pad(t.tail, 7)} ${pad(pct, 6)}%`)
  }
  console.log(`\nBoundary sentinel present: ${SHAPES.length > 0 ? String(getBaseSystemPrompt({}, [], 'noida' as never, 'GATHERING', 'OPEN' as QueryKind, 'hi', true).includes(SYSTEM_PROMPT_BOUNDARY)) : 'n/a'}`)

  // The biggest blocks in the largest prompt — where a cut would actually pay.
  const worst = SHAPES.reduce((a, b) => {
    const ta = estimateTokensReal(getBaseSystemPrompt(a.intent, [], 'noida' as never, a.intentState, a.queryKind, a.message, true))
    const tb = estimateTokensReal(getBaseSystemPrompt(b.intent, [], 'noida' as never, b.intentState, b.queryKind, b.message, true))
    return tb > ta ? b : a
  })
  const worstPrompt = getBaseSystemPrompt(worst.intent, [], 'noida' as never, worst.intentState, worst.queryKind, worst.message, true)

  console.log(`\nLARGEST SHAPE: "${worst.label}" — ${estimateTokensReal(worstPrompt)} tokens`)
  console.log('Top blocks:')
  console.log('='.repeat(78))
  const blocks = sections(worstPrompt).sort((a, b) => b.tokens - a.tokens).slice(0, 22)
  for (const b of blocks) {
    console.log(`  ${pad(b.tokens, 6)} tok  ${pad(b.chars, 7)} ch   ${b.heading}`)
  }
}

main()
