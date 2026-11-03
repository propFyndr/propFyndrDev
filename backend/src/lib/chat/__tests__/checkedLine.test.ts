import { describe, it } from 'node:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import assert from 'node:assert/strict'
import { checkedSources, createCheckedTracker } from '../checkedLine'
import { MARKET_QUALIFIER, computedQualifier } from '../../factPresentation'

const NAMES = ['Divine Meadows', 'Great Value Sharanam', 'Gaur City', 'Gaur City 2 - 14th Avenue']

describe('the "what I checked" line', () => {
  it('names our records, the statute and the gaps the answer carries', () => {
    const t = '### Divine Meadows\n\n| Charge | Amount |\n| :--- | ---: |\n| Stamp duty (7%) | ₹9,80,000 |\n| GST if under construction (5%) | ₹7,00,000 |\n| OC status | Not on record |\n\nThe possession date is not on record.'
    assert.deepEqual(checkedSources(t, { cardsShown: 0, names: NAMES }), [
      'RealtyAsk records: Divine Meadows',
      'UP law: stamp duty, GST',
      'Not on record: OC status, possession date',
    ])
  })

  it('counts a longer name once, not also its prefix', () => {
    const [first] = checkedSources('Gaur City 2 - 14th Avenue has two towers.', { cardsShown: 0, names: NAMES })
    assert.equal(first, 'RealtyAsk records: Gaur City 2 - 14th Avenue')
  })

  it('labels computed and market figures by their qualifiers', () => {
    const t = `Sector 150 averages ₹14,500 per sq ft (${computedQualifier(12)}). Rents run higher (${MARKET_QUALIFIER}).`
    const out = checkedSources(t, { cardsShown: 0, names: NAMES })
    assert.ok(out.includes('Arithmetic over 12 projects we hold'))
    assert.ok(out.includes('Noida-wide figures, not verified for this project'))
  })

  it('says nothing for an answer with no sources, and treats an undated price as no gap', () => {
    assert.deepEqual(checkedSources('Happy to help. What budget are you working with?', { cardsShown: 0, names: NAMES }), [])
    assert.deepEqual(checkedSources('On ₹1.40 Cr, date of last confirmation not on record.', { cardsShown: 0, names: NAMES }), [])
  })

  it('falls back to the cards when the prose names no project', () => {
    assert.deepEqual(checkedSources('Here are three options in your budget.', { cardsShown: 3, names: NAMES }), ['RealtyAsk records for the projects shown'])
  })

  it('follows a replaced answer, and leaves a lane\'s own label alone', () => {
    const turn = () => ({ cardsShown: 0, names: NAMES })
    const tr = createCheckedTracker(turn)
    tr.onToken('Stamp duty is 7%. ', false)
    tr.onToken('Divine Meadows starts at ₹1.2 Cr.', true)
    assert.deepEqual(tr.attach({}).checked, ['RealtyAsk records: Divine Meadows'])
    assert.equal('checked' in createCheckedTracker(turn).attach({}), false)
    const lane = createCheckedTracker(turn)
    lane.onToken('Divine Meadows starts at ₹1.2 Cr.', false)
    assert.deepEqual(lane.attach({ checked: ['x'] }).checked, ['x'])
    assert.deepEqual(lane.withChecked(undefined), [{ type: 'checked', labels: ['x'] }])
  })

  it('every path that writes an answer row stores the line', () => {
    const src = (f: string) => readFileSync(join(__dirname, f), 'utf8')
    const fact = src('../deterministicFactRouter.ts')
    assert.match(fact, /artifacts: \[\{ type: 'checked', labels: checked \}\]/)
    assert.match(fact, /\.\.\.\(checked\.length \? \{ checked \} : \{\}\)/, 'the line sent at done is the one stored')
    const router = src('../../../routes/chat-router.ts')
    assert.ok((router.match(/checkedLine\.withChecked\(/g) ?? []).length >= 5, 'each chat-router answer write goes through withChecked')
  })

  it('stores the line with the message artifacts, once, next to the cards', () => {
    const tr = createCheckedTracker(() => ({ cardsShown: 2, names: NAMES }))
    tr.onToken('Here are two options.', false)
    const cards = { type: 'property_results', exactResults: [] }
    assert.deepEqual(tr.withChecked([cards, { type: 'checked', labels: ['old'] }]), [cards, { type: 'checked', labels: ['RealtyAsk records for the projects shown'] }])
    const empty = createCheckedTracker(() => ({ cardsShown: 0, names: NAMES }))
    empty.onToken('What budget are you working with?', false)
    assert.equal(empty.withChecked(undefined), undefined)
  })
})
