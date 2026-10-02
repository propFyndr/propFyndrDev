import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseReviewNotes } from '../reviewNotes'

// Real notes from the generator (2026-10-02 drafts).
const NOTES = [
  'AI draft on "how Aqua Line metro stations affect where to buy in Noida". 5 sources found, 0 cited. Rewritten once because: missing the "What to check before you decide" h2 followed by a list; missing the "Frequently asked questions" h2.',
  'NO SOURCE CITED. Treat every figure and claim as unverified until checked.',
  'Figures not found in any source, verify or remove: 70, 80, 1.08, 5.6',
  'Length is 968 words (target 550-750).',
  'Title is 82 characters (SEO target 40-65).',
  'Template vocabulary to replace: enhance, elevate.',
  'POSSIBLE DUPLICATE of "Noida Authority Land Dues and Registry Delays for Flat Buyers". Retitle or discard.',
].join('\n')

test('reads the summary, flags and lists from real notes', () => {
  const n = parseReviewNotes(NOTES)
  assert.equal(n.topic, 'how Aqua Line metro stations affect where to buy in Noida')
  assert.equal(n.sourcesFound, 5)
  assert.equal(n.sourcesCited, 0)
  assert.match(n.rewrittenReason ?? '', /^missing the "What to check/)
  assert.equal(n.noSourceCited, true)
  assert.deepEqual(n.unverifiedFigures, ['70', '80', '1.08', '5.6'])
  assert.deepEqual(n.templateVocabulary, ['enhance', 'elevate'])
  assert.equal(n.wordCount, 968)
  assert.equal(n.needsReview, true)
})

test('a duplicate warning is a flag, never a pass', () => {
  const n = parseReviewNotes(NOTES)
  assert.ok(n.otherFlags.some(f => f.startsWith('POSSIBLE DUPLICATE')))
})

test('a clean draft needs no review', () => {
  const n = parseReviewNotes('AI draft on "x y z". 5 sources found, 4 cited.')
  assert.equal(n.needsReview, false)
  assert.deepEqual(n.otherFlags, [])
})

test('an unknown line is kept as a flag, so new backend notes are never hidden', () => {
  assert.deepEqual(parseReviewNotes('AI draft on "x". 1 source found, 1 cited.\nSomething new.').otherFlags, ['Something new.'])
})
