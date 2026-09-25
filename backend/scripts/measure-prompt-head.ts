/**
 * What the head actually costs, per query shape.
 *
 * The roadmap's Day 3.5 pass condition is a <=1,800 token system prompt. Nobody
 * could tell whether it was met because nothing printed the number. This does,
 * broken down by `queryKind` — which is the only axis the head is gated on and
 * also part of the base-prompt cache key, so each row is a real cache variant.
 *
 *   npx tsx scripts/measure-prompt-head.ts
 */
import { getBaseSystemPrompt, splitSystemPrompt } from '../src/lib/ai/prompts/base'
import { estimateTokensReal } from '../src/lib/ai/tokenizer'

const KINDS = [
  'DRILLDOWN',
  'PROJECT_DEEP_DIVE',
  'COST_BREAKDOWN',
  'COMPARISON',
  'DISCOVERY',
  'ADVISORY',
  'OPEN',
  'RANKING',
  undefined,
]

const CEILING = 1800

let worst = 0
console.log('queryKind'.padEnd(20), 'chars'.padStart(8), 'tokens'.padStart(8), '  vs ceiling')
for (const kind of KINDS) {
  const full = getBaseSystemPrompt(undefined, undefined, 'Noida' as any, undefined, kind as any, undefined, true)
  const { head } = splitSystemPrompt(full)
  const tokens = estimateTokensReal(head)
  worst = Math.max(worst, tokens)
  const delta = tokens - CEILING
  console.log(
    String(kind ?? '(none)').padEnd(20),
    String(head.length).padStart(8),
    String(tokens).padStart(8),
    `  ${delta > 0 ? `+${delta} over` : `${-delta} under`}`,
  )
}
console.log(`\nworst case: ${worst} tokens against a ${CEILING} ceiling`)
