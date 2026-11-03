import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { retryNoteFor, exceedsGroqRequestLimit } from '../fallbackChain'

test('a request larger than Groq\'s per-minute allowance skips Groq (live 413s, 27 and 29 Oct)', () => {
  assert.equal(exceedsGroqRequestLimit(15_750), true)
  assert.equal(exceedsGroqRequestLimit(6_200), false)
  assert.match(readFileSync(join(__dirname, '..', 'fallbackChain.ts'), 'utf8'), /vendor === 'groq' && tooBigForGroq/)
})

const chainSource = readFileSync(join(__dirname, '..', 'fallbackChain.ts'), 'utf8')

test('a discarded answer tells the next leg what was wrong, once per detail', () => {
  const note = retryNoteFor([
    { kind: 'fabrication', detail: 'quoted "₹1.85 Cr" for A, but that figure is B\'s, not theirs' },
    { kind: 'fabrication', detail: 'quoted "₹1.85 Cr" for A, but that figure is B\'s, not theirs' },
    { kind: 'META_LEAK', detail: 'mentioned the facts block' },
  ])
  assert.match(note, /^## CORRECTION/)
  assert.equal(note.match(/that figure is B's/g)?.length, 1)
  assert.match(note, /mentioned the facts block/)
})

test('the checks read the prompt without the note, so a rejected figure never counts as supplied', () => {
  assert.match(chainSource, /effectivePrompt: prompt,/)
  assert.match(chainSource, /const modelPrompt = retryNote \? `\$\{prompt\}\\n\\n\$\{retryNote\}` : prompt/)
  for (const call of ['streamWithMistral', 'streamWithGemini', 'streamWithGroq']) {
    assert.ok(!new RegExp(`${call}\\(prompt,`).test(chainSource), `${call} must receive modelPrompt`)
  }
  assert.match(chainSource, /streamWithOpenAI\(\s*modelPrompt,/)
})
