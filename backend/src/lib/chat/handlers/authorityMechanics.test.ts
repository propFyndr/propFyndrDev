import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { authorityMechanicsHandler } from './authorityMechanics'
import {
  NOIDA_AUTHORITY,
  AUTHORITY_FACTS_LAST_REVIEWED,
  AUTHORITY_RATE_CAVEAT,
} from '../../factPresentation'

const claims = (message: string) =>
  (authorityMechanicsHandler.matches as (c: unknown) => boolean)({ message, flags: {} })

describe('authorityMechanics — what it claims', () => {
  it('claims the tenure questions buyers actually ask', () => {
    for (const q of [
      'Is property in Noida freehold or leasehold?',
      'Can a leasehold flat be converted to freehold?',
      'What is a Transfer Memorandum and who pays transfer charges?',
      'Why is an RWA No-Dues Certificate not sufficient to confirm clean title?',
      'What is the difference between an Occupancy Certificate and a Completion Certificate?',
      'Why is my registry delayed even after physical possession?',
      'Will banks finance a 90-year leasehold property?',
      'How does one-time lease rent work on resale?',
    ]) {
      assert.equal(claims(q), true, `should claim: ${q}`)
    }
  })

  it('leaves a plain statutory tax question to statutoryTax', () => {
    // The handler sits above statutoryTax in the registry, so an over-broad
    // matcher here would swallow the stamp duty table.
    for (const q of [
      'What is the stamp duty and registration charge in UP?',
      'How much GST do I pay on an under-construction flat?',
      'Calculate my EMI for a 1.5 crore flat',
      'Show me 3BHK flats in Sector 150 under 1.5 crore',
    ]) {
      assert.equal(claims(q), false, `should NOT claim: ${q}`)
    }
  })
})

describe('authority facts stay honest', () => {
  it('states tenure structure plainly — it is the same for every project', () => {
    assert.equal(NOIDA_AUTHORITY.structure.tenureYears, 90)
    assert.equal(NOIDA_AUTHORITY.structure.notFreehold, true)
    assert.equal(NOIDA_AUTHORITY.structure.buyerInstrument, 'sub-lease deed')
  })

  it('keeps every rate as a band, never a single figure', () => {
    // A bare number here would be quoted to a buyer as fact. Each of these is
    // set per authority circular, so each must read as a range or an
    // approximation rather than a rate we are asserting.
    for (const [key, value] of Object.entries(NOIDA_AUTHORITY.bands)) {
      assert.equal(typeof value, 'string', `${key} must be a string band, not a number`)
      assert.ok(/[–-]|about|around|approx/i.test(value), `${key} reads as an exact figure: "${value}"`)
    }
  })

  it('carries an instruction to confirm the live rate', () => {
    assert.ok(AUTHORITY_RATE_CAVEAT.includes('confirm'))
  })

  /**
   * The forcing function. An authority circular revises these and nothing in a
   * codebase notices on its own; the failure mode is a stale percentage quoted
   * with confidence, which is exactly what factPresentation exists to prevent.
   *
   * When this fails: re-read the current authority circulars, correct the bands
   * if they moved, and bump AUTHORITY_FACTS_LAST_REVIEWED. Bumping the date
   * without re-reading is the one thing that makes this test worse than nothing.
   */
  it('has been reviewed within the last twelve months', () => {
    const [year, month] = AUTHORITY_FACTS_LAST_REVIEWED.split('-').map(Number)
    assert.ok(year && month, `AUTHORITY_FACTS_LAST_REVIEWED must be YYYY-MM, got "${AUTHORITY_FACTS_LAST_REVIEWED}"`)
    const reviewed = new Date(Date.UTC(year, month - 1, 1))
    const now = new Date()
    assert.ok(reviewed <= now, 'review date is in the future')
    const monthsStale = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month)
    assert.ok(
      monthsStale <= 12,
      `Noida authority facts were last reviewed ${AUTHORITY_FACTS_LAST_REVIEWED}, ${monthsStale} months ago. ` +
        'Re-read the current authority circulars, correct NOIDA_AUTHORITY.bands if they moved, then bump the date.',
    )
  })
})
