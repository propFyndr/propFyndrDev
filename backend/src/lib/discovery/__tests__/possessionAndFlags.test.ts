import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildMatchSignals, scoreProject } from '../scoring'
import type { Intent } from '../types'

const NOW = new Date('2026-10-15T06:00:00Z')

function signals(overrides: Record<string, unknown> = {}, intent: Intent = {}) {
  return buildMatchSignals(
    { unit_types: [{ bhk: 3, price_min_cr: 1.5 }], sector: 'Sector 150', ...overrides } as Parameters<typeof buildMatchSignals>[0],
    intent,
    undefined,
    NOW,
  )
}

describe('buildMatchSignals: a passed possession date', () => {
  const late = { status: 'under_construction', possession_date: new Date('2025-06-30'), possession_label: 'Q2 2025' }

  it('is never "ready to move", and is said as a concern with its date', () => {
    const s = signals(late)
    assert.ok(!s.matchReasons.some((r) => /ready to move|possession/i.test(r)), s.matchReasons.join(' | '))
    assert.ok(s.concerns.some((c) => /possession date \(Jun 2025\) has passed/i.test(c)), s.concerns.join(' | '))
  })

  it('a ready-to-move project still says so and has no such concern', () => {
    const s = signals({ ...late, status: 'ready_to_move' })
    assert.ok(s.matchReasons.includes('ready to move'))
    assert.ok(!s.concerns.some((c) => /has passed/.test(c)))
  })

  it('a date still ahead keeps its horizon reason', () => {
    const reasons = (date: string) => signals({ status: 'under_construction', possession_date: new Date(date) }).matchReasons
    assert.ok(reasons('2027-01-15').includes('possession in 6 months'))      // ~3 months out
    assert.ok(reasons('2027-08-15').includes('possession within a year'))    // ~10 months out
    assert.ok(!reasons('2028-06-01').some((r) => /possession/.test(r)))      // too far to be a reason
  })

  it('a passed date on a project of unknown status says nothing, not "in 6 months"', () => {
    const s = signals({ possession_date: new Date('2025-06-30') })
    assert.ok(!s.matchReasons.some((r) => /possession/.test(r)), s.matchReasons.join(' | '))
  })
})

describe('buildMatchSignals: stored risk and legal flags', () => {
  it('"low_risk" and "none" are not concerns', () => {
    const s = signals({ project_risk_flag: 'low_risk', builder: { legal_flag: 'none' } })
    assert.deepEqual(s.concerns, [])
  })

  it('"moderate_risk" is said in words, never as the stored token', () => {
    const s = signals({ project_risk_flag: 'moderate_risk' })
    assert.deepEqual(s.concerns, ['Risk flag on record: moderate risk'])
  })

  it('developer legal tokens are said in words, with acronyms and names intact', () => {
    assert.deepEqual(signals({ builder: { legal_flag: 'NCLT_INSOLVENCY' } }).concerns, ['Developer legal flag on record: NCLT insolvency'])
    assert.deepEqual(signals({ builder: { legal_flag: 'SUPREME_COURT_RECEIVERSHIP' } }).concerns, ['Developer legal flag on record: Supreme Court receivership'])
    assert.deepEqual(signals({ builder: { legal_flag: 'NCLT_SPV_RESOLUTION' } }).concerns, ['Developer legal flag on record: NCLT SPV resolution'])
  })

  it('a flag that is already a sentence passes through unchanged', () => {
    assert.deepEqual(signals({ project_risk_flag: 'Insolvency proceedings ongoing' }).concerns, ['Insolvency proceedings ongoing'])
  })

  it('no stored token reaches a concern as written', () => {
    const s = signals({ project_risk_flag: 'moderate_risk', builder: { legal_flag: 'NCLT_PROCEEDINGS' } })
    assert.ok(!s.concerns.some((c) => /_/.test(c)), s.concerns.join(' | '))
  })
})

describe('scoreProject: a missed date is not immediate possession', () => {
  const intent: Intent = { possession: 'immediate' }
  const base = {
    unit_types: [{ bhk: 3, price_min_cr: 1.5, price_max_cr: 2.0, carpet_area_sqft: 1200 }],
    possession_date: new Date('2018-04-30'),
    amenities: [],
    ai_search_keywords: [],
    builder: {},
    hero_image_url: null,
    images: [],
    rera_number: 'UPRERAPRJ1234',
  }

  it('a project that missed its date scores below one that is ready, for an immediate buyer', () => {
    const late = scoreProject({ ...base, status: 'under_construction' }, intent)
    const ready = scoreProject({ ...base, status: 'ready_to_move' }, intent)
    assert.ok(late < ready, `late ${late} should be below ready ${ready}`)
    assert.equal(ready - late, 15, 'the passed date earns the unknown 5, not the full 20')
  })

  it('without a status the old behaviour holds', () => {
    assert.equal(scoreProject(base, intent), scoreProject({ ...base, status: 'ready_to_move' }, intent))
  })
})

describe('the ranking rule is wired into discovery', () => {
  it('projects.ts passes status to scoreProject, or the passed-date rule never fires', () => {
    // scoreProject only knows a date has passed when it is told the project is still being built.
    const source = readFileSync(join(__dirname, '..', 'projects.ts'), 'utf8')
    assert.match(source, /scoreProject\(\s*\{[^}]*\bstatus:\s*String\(p\.status\)/)
  })
})
