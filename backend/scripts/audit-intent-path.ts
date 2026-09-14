// backend/scripts/audit-intent-path.ts
//
//   npx tsx scripts/audit-intent-path.ts
//
// How often intent extraction avoids the model, and what it costs when it does
// not.
//
// `extractIntent` already has a deterministic pass and two escape hatches
// (`deterministicCoversMessage`, `nothingToExtract`). What was never measured
// is the SPLIT: which real buyer messages take the free path and which pay a
// round-trip. Optimising the prompt matters only in proportion to how often it
// is actually sent.
//
// Offline and free — it exercises the decision, never the provider.

import { INTENT_CORPUS } from '../src/lib/ai/__tests__/intentExtraction.corpus'
import { INTENT_EXTRACTION_PROMPT } from '../src/lib/ai/prompts/intent-extraction'
import { estimateTokensReal } from '../src/lib/ai/tokenizer'
import type { Intent } from '../src/lib/discovery'

/**
 * Messages beyond the corpus: conversational follow-ups, corrections and the
 * short replies a real session is mostly made of. The corpus deliberately
 * covers the deterministic floor; these cover the turns around it.
 */
const CONVERSATIONAL: string[] = [
  'hi', 'hello', 'thanks', 'ok', 'yes', 'no',
  'what about the second one', 'tell me more', 'compare these',
  'actually make that 2 crore', 'show me something bigger',
  'what have I told you so far', 'is it worth it',
  'which is better for a family', 'what are the hidden costs',
  'why is the registry delayed even after possession',
  'does RERA guarantee on time delivery', 'ready to move only',
  'I work in Sector 62', 'my budget is 1.5cr', 'possession within a year',
  'book a site visit', 'call me back', 'what is stamp duty in UP',
]

async function main(): Promise<void> {
  const promptTokens = estimateTokensReal(INTENT_EXTRACTION_PROMPT)
  console.log(`\nINTENT_EXTRACTION_PROMPT: ${promptTokens} tokens, ${INTENT_EXTRACTION_PROMPT.length} chars`)

  // Importing extractIntent pulls the provider chain, so the decision is
  // re-derived here from the same inputs rather than executed.
  const { extractDeterministic } = await import('../src/lib/ai/intentDeterministic')
  const mod = await import('../src/lib/ai/intent') as unknown as {
    __testHooks?: { deterministicCoversMessage?: unknown; nothingToExtract?: unknown }
  }
  void mod

  const messages = [
    ...INTENT_CORPUS.map((c) => c.message),
    ...CONVERSATIONAL,
  ]

  let literalHits = 0
  const noLiteral: string[] = []

  for (const m of messages) {
    const d = extractDeterministic(m, new Set<number>())
    if (d.literal.size > 0) literalHits++
    else noLiteral.push(m)
  }

  console.log(`\n${messages.length} messages`)
  console.log(`  deterministic found a literal constraint: ${literalHits} (${((literalHits / messages.length) * 100).toFixed(0)}%)`)
  console.log(`  nothing literal to read:                  ${noLiteral.length}`)

  console.log('\nMessages with no literal constraint (these are the model-or-nothing turns):')
  for (const m of noLiteral.slice(0, 30)) console.log(`  - ${m}`)

  console.log(`\nIf every one of those ${noLiteral.length} paid a model call:`)
  console.log(`  ${(noLiteral.length * promptTokens).toLocaleString()} tokens at the current prompt size`)
  console.log(`  ${(noLiteral.length * Math.round(promptTokens * 0.4)).toLocaleString()} tokens if the prompt were 40% of its size`)
}

main().catch((e) => { console.error(e); process.exit(1) })
