import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeOutput } from '../sanitizeOutput'

// 31 Oct 2026, hard-43 Q8: the model wrote "A lower price per sq. ft reflects ... delivery ...".
// The sentence rewrite cut at the "sq." full stop and welded the registration disclaimer on,
// leaving "A lower price per sq. Registration puts the project on record ..." in the answer.
test('"sq. ft" does not end a sentence for the over-promise rewrite', () => {
  const input = 'Divine Meadows is cheapest at ₹9,577 per sq. ft. A lower price per sq. ft reflects a lower cost of delivery, but check the title.'
  const { text } = sanitizeOutput(input)
  assert.ok(!/per sq\. Registration/.test(text), text)
  assert.ok(text.includes('per sq. ft'), text)
  assert.ok(text.includes('₹9,577 per sq. ft'), text)
})

test('the same claim without the abbreviation is still rewritten', () => {
  const { text } = sanitizeOutput('RERA registration guarantees compliance and timely delivery.')
  assert.ok(text.includes('it is not a warranty on delivery'), text)
})
