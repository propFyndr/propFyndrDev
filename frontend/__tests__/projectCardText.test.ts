import { cleanConcern, isPossessionDatePassed, withoutPassedNote } from '@/lib/projectCardText'

const NOW = new Date('2026-10-15T06:00:00Z')

describe('isPossessionDatePassed', () => {
  it('is true for a passed date on a project still being built', () => {
    expect(isPossessionDatePassed({ status: 'under_construction', possession_date: '2025-06-30' }, NOW)).toBe(true)
    expect(isPossessionDatePassed({ status: 'new_launch', possession_date: '2018-04-30' }, NOW)).toBe(true)
  })

  it('is false for ready-to-move, a future date, or no status', () => {
    expect(isPossessionDatePassed({ status: 'ready_to_move', possession_date: '2019-01-01' }, NOW)).toBe(false)
    expect(isPossessionDatePassed({ status: 'under_construction', possession_date: '2027-03-31' }, NOW)).toBe(false)
    expect(isPossessionDatePassed({ possession_date: '2019-01-01' }, NOW)).toBe(false)
  })

  it('counts a date that is exactly now as passed, like the backend', () => {
    expect(isPossessionDatePassed({ status: 'under_construction', possession_date: NOW }, NOW)).toBe(true)
  })

  it("recognises the backend's label note when no date was sent", () => {
    const label = 'Q2 2025 (possession date passed — status unconfirmed)'
    expect(isPossessionDatePassed({ status: 'under_construction', possession_label: label }, NOW)).toBe(true)
    expect(isPossessionDatePassed({ status: 'ready_to_move', possession_label: label }, NOW)).toBe(false)
  })

  it('does not judge a bare label or an unreadable date', () => {
    expect(isPossessionDatePassed({ status: 'under_construction', possession_label: 'Q2 2019' }, NOW)).toBe(false)
    expect(isPossessionDatePassed({ status: 'under_construction', possession_date: 'soon' }, NOW)).toBe(false)
  })
})

describe('withoutPassedNote', () => {
  it('removes only the backend note', () => {
    expect(withoutPassedNote('Q2 2025 (possession date passed — status unconfirmed)')).toBe('Q2 2025')
    expect(withoutPassedNote('Expected October 2027')).toBe('Expected October 2027')
    expect(withoutPassedNote(null)).toBe('')
  })
})

describe('cleanConcern', () => {
  it('drops "low_risk" and "none"', () => {
    expect(cleanConcern('low_risk')).toBeNull()
    expect(cleanConcern('LOW-RISK')).toBeNull()
    expect(cleanConcern('none')).toBeNull()
    expect(cleanConcern('  ')).toBeNull()
    expect(cleanConcern(null)).toBeNull()
  })

  it('says a stored risk token in words', () => {
    expect(cleanConcern('moderate_risk')).toBe('Risk flag on record: moderate risk')
    expect(cleanConcern('high_risk')).toBe('Risk flag on record: high risk')
  })

  it('says a stored legal token in words, keeping acronyms and names', () => {
    expect(cleanConcern('NCLT_INSOLVENCY')).toBe('Flag on record: NCLT insolvency')
    expect(cleanConcern('SUPREME_COURT_RECEIVERSHIP')).toBe('Flag on record: Supreme Court receivership')
  })

  it('leaves a sentence or a plain word alone', () => {
    expect(cleanConcern('₹0.46Cr above your budget')).toBe('₹0.46Cr above your budget')
    expect(cleanConcern('Possession delay risk')).toBe('Possession delay risk')
    expect(cleanConcern('pricing not disclosed')).toBe('pricing not disclosed')
  })
})
