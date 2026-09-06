import test from 'node:test'
import assert from 'node:assert/strict'
import { INTENT_CORPUS } from './intentExtraction.corpus'
import { extractDeterministic } from '../intentDeterministic'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * The deterministic floor.
 *
 * Every case is a message this session saw in a live replay, or the shape of
 * one, and asserts only what the message states LITERALLY. The old heuristic
 * scored 15/25 on this corpus and — worse than missing — got two of them
 * backwards: "anything above 2 crore" came out `budgetMax: 2`, the exact
 * inverse of the filter asked for.
 *
 * These are the facts `applyLiterals` protects from the model, so a regression
 * here is not a lost optimisation. It is a fact the buyer typed going missing.
 */

/** Sector numbers the router supplies from the live table. */
const HELD = ['1', '2', '3', '4', '10', '16', '16B', '43', '62', '75', '76', '78', '107', '108', '128', '137', '143B', '150', '168']

for (const c of INTENT_CORPUS) {
  test(`reads: "${c.message.slice(0, 58)}"`, () => {
    const d = extractDeterministic(c.message, HELD)
    const e = c.expect

    if (e.sector) assert.equal(d.sectors[0], e.sector)
    if (e.sectors) assert.deepEqual(d.sectors.slice(0, e.sectors.length), e.sectors)
    if (e.bhk) assert.deepEqual(d.bhk, [...e.bhk].sort((a, b) => a - b))
    if (e.budgetMin !== undefined) assert.equal(d.budgetMin, e.budgetMin)
    if (e.budgetMax !== undefined) assert.equal(d.budgetMax, e.budgetMax)
    if (e.possession) assert.equal(d.possession, e.possession)

    for (const field of e.absent ?? []) {
      const value = field === 'sector'
        ? (d.sectors.length ? d.sectors : undefined)
        : field === 'bhk'
          ? (d.bhk.length ? d.bhk : undefined)
          : (d as unknown as Record<string, unknown>)[field]
      assert.equal(value === undefined || value === null, true, `${field} should be absent, got ${JSON.stringify(value)}`)
    }
  })
}

test('a floor is never recorded as a ceiling', () => {
  // The single worst case the old extractor produced: it filtered OUT
  // everything the buyer asked for.
  const d = extractDeterministic('anything above 2 crore', HELD)
  assert.equal(d.budgetMin, 2)
  assert.equal(d.budgetMax, undefined)
})

test('a range keeps both ends whichever way it is written', () => {
  for (const [msg, min, max] of [
    ['between 1 and 2 crore', 1, 2],
    ['1-2 cr', 1, 2],
    ['1 to 2 crore', 1, 2],
    ['between 90 lakh and 1.2 crore', 0.9, 1.2],
  ] as Array<[string, number, number]>) {
    const d = extractDeterministic(msg, HELD)
    assert.equal(d.budgetMin, min, msg)
    assert.equal(d.budgetMax, max, msg)
  }
})

test('every configuration named is kept', () => {
  assert.deepEqual(extractDeterministic('2 BHK and 3 BHK', HELD).bhk, [2, 3])
  assert.deepEqual(extractDeterministic('2 and 3 BHK', HELD).bhk, [2, 3])
  assert.deepEqual(extractDeterministic('2, 3 or 4 bhk', HELD).bhk, [2, 3, 4])
})

test('literal marks exactly the fields the message states', () => {
  const d = extractDeterministic('3 BHK in Sector 150 under 2 crore', HELD)
  assert.equal(d.literal.has('sector'), true)
  assert.equal(d.literal.has('bhk'), true)
  assert.equal(d.literal.has('budgetMax'), true)
  assert.equal(d.literal.has('possession'), false, 'possession was not stated')
  assert.equal(d.literal.has('budgetMin'), false, 'no floor was stated')
})

test('the extractor is wired so a literal survives whatever the model returns', () => {
  // `applyLiterals` is internal to intent.ts; this pins that every exit from
  // extractIntent goes through it. Measured: "Compare Sector 150 and Sector
  // 137" came back from the model as `{}`, a four-turn-old sticky sector
  // survived, and the buyer was answered about the wrong sector entirely.
  const src = readFileSync(join(__dirname, '..', 'intent.ts'), 'utf8')

  // Non-greedy: `applyLiterals(result, deterministic)` contains a comma of its
  // own, so a `[^,]+` capture stops inside the call and misses the exits that
  // matter most.
  const exits = [...src.matchAll(/return \{ intent: (.+?), degraded/g)].map(m => m[1].trim())
  assert.ok(exits.length >= 5, `expected every provider exit to be found, saw ${exits.length}`)
  for (const expr of exits) {
    assert.ok(
      /applyLiterals\(|^heuristic$|^heuristicIntent$/.test(expr),
      `an exit returns "${expr}" without re-applying the literals`,
    )
  }

  // The two variables that ARE bare must themselves have been through it.
  assert.match(src, /const heuristic = applyLiterals\(/)
  assert.match(src, /const heuristicIntent = applyLiterals\(/)
})
