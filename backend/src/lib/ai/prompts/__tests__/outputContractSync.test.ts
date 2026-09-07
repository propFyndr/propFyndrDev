import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyShape } from '../../inferenceProfile'
import { outputContract } from '../base'

/**
 * `outputContract`'s shape classification is deliberately duplicated from
 * `classifyShape` rather than imported (base.ts sits behind the prompt-cache
 * layer; importing inferenceProfile would cycle back through it). A duplicate
 * with no test drifted silently: this copy was missing `\bwhich (one|is
 * better)\b` from its reasoning check and `\brisk|\bavoid\b` from its
 * advisory check, found 7 Sep 2026. The practical effect: `inferenceProfile`
 * gave "which one is better, X or Y?" a 2600-token reasoning budget and
 * GEMINI_MAIN, while `outputContract` told the model to answer it in ~120
 * words with no table — the shape the model was BUDGETED for and the shape
 * it was INSTRUCTED to produce disagreed, on a real user-facing message
 * shape, not an edge case.
 *
 * This runs both classifiers over one shared message list so the two files
 * cannot silently disagree again — a new message added to either regex
 * without the other fails here before it fails a buyer.
 */

const ONE_MARKER: Record<'reasoning' | 'advisory' | 'factual' | 'lookup', string> = {
  reasoning: 'Spend the words',
  advisory: 'Commit in the first sentence',
  factual: 'supporting facts, one line each',
  lookup: 'This is a search phrase',
}

const MESSAGES = [
  // The two drifts this test exists to catch, verbatim.
  'which one is better, Ace Parkway or Godrej Woods',
  'what risks should I know about before buying here',
  // General coverage across all four shapes, so a future edit to either file
  // that narrows a pattern is caught too, not only the two historical cases.
  'compare Ace Parkway vs Godrej Woods',
  'I earn 1.2L a month and want a 2 BHK near my office',
  'is this a good investment',
  'should I avoid this builder',
  'what is the RERA number',
  'best 3 bhk in sector 150',
  '3 bhk sector 150 under 2 cr',
  'ready to move flats in noida',
]

describe('outputContract stays in sync with classifyShape', () => {
  for (const message of MESSAGES) {
    it(`agrees on: "${message}"`, () => {
      const shape = classifyShape(message)
      const contract = outputContract(message)
      const marker = ONE_MARKER[shape]
      assert.ok(
        contract.includes(marker),
        `classifyShape said "${shape}" but outputContract's text does not contain its marker ` +
          `("${marker}") — the two classifiers disagree on this message.`,
      )
    })
  }
})
