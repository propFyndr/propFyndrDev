import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectFactTopics } from '../../projectFactsBlock'
import { substitutePointer } from '../resolvePointer'

/**
 * Heavy relations are fetched only when the turn is about them.
 *
 * buildProjectFacts has always been topic-gated, so price_history, spec_items
 * and construction_milestones only ever reached the prompt when the buyer asked
 * for them. The query did not know that: it pulled all three on every single
 * turn and the result was discarded. The cost was paid in the database and over
 * the wire, where no amount of prompt gating could reach it.
 *
 * ProjectDna is a separate case. It is in INTERNAL_ONLY_RELATIONS, redactProject
 * strips it before anything is sent to a client, and buildProjectFacts never
 * reads it — so every turn fetched a relation that could not legally be shown to
 * a buyer and that nothing looked at.
 */

const ROUTER = readFileSync(join(__dirname, '../../../routes/chat-router.ts'), 'utf8')

function detailIncludeBlock(): string {
  const at = ROUTER.indexOf('const detailedTargetProjects = await prisma.project.findMany')
  assert.ok(at !== -1, 'detail query not found')
  return ROUTER.slice(at, at + 2600)
}

describe('the chat detail query fetches only what the turn needs', () => {
  it('detects the right topic on a message that needed pointer resolution', () => {
    // "how's it doing on construction?" names no project — the pipeline
    // resolves the pointer to a project name before this reaches
    // detectFactTopics. Confirms detection still works on the resolved
    // text, not that the raw and resolved messages differ, which for a
    // topic-bearing message they should not: substitutePointer only swaps
    // the pointer phrase for a name, never touches the rest of the sentence.
    const raw = "how's it doing on construction?"
    const resolved = substitutePointer(raw, 'Godrej Woods').text
    assert.equal(resolved, "how's Godrej Woods doing on construction?")
    assert.ok(detectFactTopics(resolved).has('construction'))
  })

  it('detects topics exactly once', () => {
    // It used to be computed a second time below the query, which is how the
    // gating was missed: the value existed, just not where it was needed.
    const hits = [...ROUTER.matchAll(/const askedFactTopics = detectFactTopics\(/g)].length
    assert.equal(hits, 1, 'askedFactTopics should be computed once, above the query')
  })

  for (const [topic, relation] of [
    ['price_history', 'price_history'],
    ['construction', 'construction_milestones'],
    ['specifications', 'spec_items'],
  ] as const) {
    it(`${relation} is fetched only when the '${topic}' topic fired`, () => {
      const block = detailIncludeBlock()
      const guarded = new RegExp(
        `askedFactTopics\\.has\\('${topic}'\\)[\\s\\S]{0,120}${relation}:`,
      )
      assert.match(block, guarded, `${relation} must be conditional on askedFactTopics`)
    })
  }

  it('ProjectDna is never fetched for a buyer-facing turn', () => {
    const block = detailIncludeBlock()
    assert.ok(
      !/^\s*dna:\s*true/m.test(block),
      'dna is INTERNAL_ONLY_RELATIONS — redacted before send and never read by buildProjectFacts',
    )
  })

  it('the relations a buyer can always ask about stay unconditional', () => {
    // Gating must not creep into the core set: an amenity or payment-plan
    // question has no topic flag and must still be answerable.
    const block = detailIncludeBlock()
    for (const relation of ['builder', 'unit_types', 'payment_plans', 'cost_sheet', 'amenities']) {
      assert.match(
        block,
        new RegExp(`\\n\\s*${relation}: true`),
        `${relation} must stay unconditional — it backs questions with no topic flag`,
      )
    }
  })
})
