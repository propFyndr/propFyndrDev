import test from 'node:test'
import assert from 'node:assert/strict'
import { INTENT_CORPUS } from './intentExtraction.corpus'
import { extractDeterministic } from '../intentDeterministic'
import { buildHardFilters } from '../../discovery/projects'
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

import { applyLiterals } from '../intent'

test('the four-fact one-liner keeps its possession constraint', () => {
  const d = extractDeterministic('3BHK, Sector 150, under 1.5cr, possession within a year')
  assert.deepEqual(d.bhk, [3])
  assert.equal(d.budgetMax, 1.5)
  assert.equal(d.possession, '1year')
  assert.ok(d.sectors.length === 1)
})

test('possession phrasings people actually use', () => {
  assert.equal(extractDeterministic('ready in 12 months').possession, '1year')
  assert.equal(extractDeterministic('in one year').possession, '1year')
  assert.equal(extractDeterministic('within two years').possession, '2year')
})

test('"something bigger" steps the remembered BHK up once', () => {
  const prev = { bhk: [2] } as any
  const out = applyLiterals({ bhk: [2] } as any, extractDeterministic('show me something bigger'), 'show me something bigger', prev)
  assert.deepEqual(out.bhk, [3])
  // Model already stepped it: no double step.
  const out2 = applyLiterals({ bhk: [3] } as any, extractDeterministic('show me something bigger'), 'show me something bigger', prev)
  assert.deepEqual(out2.bhk, [3])
})


test('budget: a preference inside the ceiling is not a floor', () => {
  const r = extractDeterministic('up to 1.5 Cr, rather closer to 1.3 cr')
  assert.equal(r.budgetMax, 1.5)
  assert.equal(r.budgetMin, undefined)
})
test('budget: a correction replaces the earlier figure', () => {
  assert.equal(extractDeterministic('budget 1.5 Cr. Sorry, I meant 1.35 cr').budgetMax, 1.35)
})
test('budget: cash in hand and a quoted price are not budget ceilings', () => {
  assert.equal(extractDeterministic('40 lakh cash, finance the rest').budgetMax, undefined)
  assert.equal(extractDeterministic('sales guy quoted 1.9cr for 3bhk in gulshan botnia. fair?').budgetMax, undefined)
  assert.equal(extractDeterministic('budget 1.5 cr, have 40 lakh cash').budgetMax, 1.5)
})
test('sectors: a sector the buyer ruled out is never a search filter', () => {
  const r = extractDeterministic('3bhk not in Sector 150, avoid 137, sector 79 is fine')
  assert.deepEqual(r.sectors, ['Sector 79'])
  assert.deepEqual(r.excludedSectors, ['Sector 150', 'Sector 137'])
  assert.deepEqual(extractDeterministic('sector 150 nahi chahiye').sectors, [])
})
test('sectors: "not more than 1.5 cr in sector 150" is a ceiling and keeps the sector', () => {
  const r = extractDeterministic('budget not more than 1.5 cr in sector 150')
  assert.equal(r.budgetMax, 1.5)
  assert.equal(r.budgetMin, undefined)
  assert.deepEqual(r.sectors, ['Sector 150'])
})
test('sectors: exclusions carry across turns and become a hard NOT filter', () => {
  const q1 = '3bhk under 2 cr, avoid sector 137'
  const t1 = applyLiterals({} as any, extractDeterministic(q1), q1)
  assert.deepEqual(t1.excludeSectors, ['Sector 137'])
  const q2 = 'show me something bigger'
  const t2 = applyLiterals({} as any, extractDeterministic(q2), q2, t1)
  assert.deepEqual(t2.excludeSectors, ['Sector 137'], 'an exclusion is not forgotten next turn')
  const q3 = 'ok actually show sector 137 too'
  const t3 = applyLiterals({} as any, extractDeterministic(q3), q3, t2)
  assert.equal(t3.excludeSectors, undefined, 'naming it again lifts the exclusion')
  const where = JSON.stringify(buildHardFilters(t1 as any, undefined))
  assert.match(where, /"NOT":\{"sector":\{"equals":"Sector 137"/)
})
test('budget: a quoted price proposed as the budget by another reader is dropped', () => {
  const q = 'sales guy quoted 1.9cr for 3bhk in gulshan botnia. fair?'
  const out = applyLiterals({ budgetMax: 1.9, bhk: [3] } as any, extractDeterministic(q), q)
  assert.equal(out.budgetMax, undefined)
  const kept = applyLiterals({ budgetMax: 1.9 } as any, extractDeterministic(q), q, { budgetMax: 2.5 } as any)
  assert.equal(kept.budgetMax, 2.5, 'the budget the buyer stated earlier survives')
})

import { readExcludedSectorNumbers } from '../intentDeterministic'
import { cityNamedIn } from '../../discovery/constants'

test('sectors: a negation carries across a list of sector numbers', () => {
  for (const q of ['except 137, 143 and 150', 'not in 137, 143 or 150']) {
    assert.deepEqual([...readExcludedSectorNumbers(q)].sort(), ['137', '143', '150'], q)
    assert.deepEqual(extractDeterministic(q, HELD).sectors, [], `${q}: an excluded sector is not also included`)
  }
})
test('sectors: forget / drop / remove / skip / avoid all rule a sector out', () => {
  for (const [q, n] of [['Forget Sector 150', '150'], ['drop sector 150', '150'], ['remove 150', '150'], ['skip 150', '150'], ['avoid 137', '137']]) {
    assert.deepEqual([...readExcludedSectorNumbers(q)], [n], q)
    assert.deepEqual(extractDeterministic(q, HELD).sectors, [], q)
  }
})
test('sectors: a negation does not jump unrelated words, and durations are not sectors', () => {
  for (const q of ['not extension maybe 150', 'older than 10 years', 'not older than 10 years', '10 years old', 'not within 10 minutes of metro']) {
    assert.equal(readExcludedSectorNumbers(q).size, 0, q)
  }
})
test('budget: a loan, down payment, EMI or top-up is not a budget', () => {
  for (const q of ['need ₹90 lakh loan', '₹45 lakh down payment', '₹1 lakh EMI', 'another ₹7 lakh', '₹8 lakh more', 'stretch 10 lakh extra']) {
    const d = extractDeterministic(q)
    assert.equal(d.budgetMax, undefined, q)
    assert.equal(d.budgetMin, undefined, q)
  }
  assert.equal(extractDeterministic('budget 1.5 cr, have 45 lakh down payment').budgetMax, 1.5)
  assert.equal(extractDeterministic('₹90 lakh loan, budget 1.2 cr').budgetMax, 1.2)
  assert.equal(extractDeterministic('EMI of 1 lakh per month, budget 1.5cr').budgetMax, 1.5)
  const orMore = extractDeterministic('1.5 cr or more')
  assert.equal(orMore.budgetMin ?? orMore.budgetMax, 1.5, '"or more" is not a top-up')
})
test('budget: the stated max wins, with or without a unit', () => {
  for (const [q, max] of [['around 1.5 maybe 1.6 max', 1.6], ['1.2 but 1.35 max', 1.35], ['around 1.5 cr maybe 1.6 cr max', 1.6], ['budget 1.5', 1.5], ['under 1.5 in sector 150', 1.5]] as Array<[string, number]>) {
    const d = extractDeterministic(q)
    assert.equal(d.budgetMax, max, q)
    assert.equal(d.budgetMin, undefined, q)
  }
  for (const q of ['within 1.5 km of metro', 'sector 1.5', 'under 2', '2.5 bhk']) {
    assert.equal(extractDeterministic(q).budgetMax, undefined, q)
  }
})
test('area: commas, plus signs, minimums and square metres', () => {
  const area = (q: string) => { const d = extractDeterministic(q); return [d.areaMin, d.areaMax] }
  assert.deepEqual(area('1,500 sq ft'), [1350, 1650])
  assert.deepEqual(area('minimum 1400 sqft'), [1400, undefined])
  assert.deepEqual(area('1400+ sq.ft'), [1400, undefined])
  assert.deepEqual(area('130 sqm'), [1259, 1539])
  assert.deepEqual(area('about 1500 sqft'), [1350, 1650])
  assert.deepEqual(area('1200-1500 sq ft'), [1200, 1500])
})
test('city: a negated city is not the city named', () => {
  assert.equal(cityNamedIn("I don't want Greater Noida"), undefined)
  assert.equal(cityNamedIn('not Greater Noida proper'), undefined)
  assert.equal(cityNamedIn('anywhere except Noida Extension'), undefined)
  assert.equal(cityNamedIn("don't want Noida Extension unless it is cheap"), undefined)
  assert.equal(cityNamedIn("I don't want Greater Noida, show Noida"), 'Noida')
  assert.equal(cityNamedIn('not Greater Noida West, Noida please'), 'Noida')
  assert.equal(cityNamedIn('best properties in sector 107 NOIDA'), 'Noida')
  assert.equal(cityNamedIn('sector 107 greater noida west'), 'Greater Noida West')
  assert.equal(cityNamedIn('flats in noida extension'), 'Greater Noida West')
  assert.equal(cityNamedIn('sector 107'), undefined)
})
