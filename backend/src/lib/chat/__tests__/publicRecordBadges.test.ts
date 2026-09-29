import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PUBLIC_RECORD_NOTICE_BADGE,
  unknownProjectDirective,
} from '../coverageGap'
import {
  checkAnswerIntegritySync,
  unlistedProprietaryViolations,
} from '../../ai/answerIntegrity'

describe('Phase 2.4 — Transparent Public-Record Provenance Badges', () => {
  it('unknownProjectDirective includes the mandatory Public Record Notice badge and anti-rating rules', () => {
    const directive = unknownProjectDirective('Godrej Aristocrat')

    assert.ok(
      directive.includes(PUBLIC_RECORD_NOTICE_BADGE),
      'Directive must mandate prepending PUBLIC_RECORD_NOTICE_BADGE',
    )
    assert.match(
      directive,
      /Public Record Notice/,
      'Directive must mention Public Record Notice',
    )
    assert.match(
      directive,
      /PropFyndr scores|PropFyndr ratings|physical verification/i,
      'Directive must strictly forbid emitting proprietary scores or physical inspection claims',
    )
  })

  it('answerIntegrity flags proprietary ratings/scores on unlisted project responses', () => {
    const unlistedPrompt = `
System Prompt
## PROJECT NOT IN OUR DATABASE: Supertech Supernova Spira
The buyer asked about "Supertech Supernova Spira" and we hold no verified rows for it.
`

    const violatingAnswer = `
${PUBLIC_RECORD_NOTICE_BADGE}

Supertech Supernova Spira is a 300-meter mixed-use tower in Sector 94, Noida.
We have given it an overall PropFyndr Score of 78/100 based on construction pace, and it is marked On-Ground Verified.
`

    const violations = unlistedProprietaryViolations(violatingAnswer, unlistedPrompt)
    assert.ok(violations.length > 0, 'Must flag violation when unlisted project has proprietary score/verification claim')
    assert.equal(violations[0].kind, 'opaque_score')
    assert.match(violations[0].detail, /attributes proprietary inspection or audit rating to an unlisted project/i)

    const fullViolations = checkAnswerIntegritySync(violatingAnswer, unlistedPrompt)
    assert.ok(fullViolations && fullViolations.length > 0, 'checkAnswerIntegritySync must flag unlisted proprietary metrics')
  })

  it('answerIntegrity allows valid public record disclosures without proprietary claims', () => {
    const unlistedPrompt = `
System Prompt
## PROJECT NOT IN OUR DATABASE: Godrej Aristocrat
The buyer asked about "Godrej Aristocrat" and we hold no verified rows for it.
`

    const honestAnswer = `
${PUBLIC_RECORD_NOTICE_BADGE}

Godrej Aristocrat is not yet in our verified database. Based on live public filings and developer announcements, it is an upcoming luxury residential project situated in Sector 49, Gurgaon. Reported configurations include 3 BHK and 4 BHK luxury residences. For verified master file analysis and RERA certification details, please connect directly with our advisory team.
`

    const violations = unlistedProprietaryViolations(honestAnswer, unlistedPrompt)
    assert.equal(violations.length, 0, 'Must not flag honest public record answers without proprietary metrics')
  })

  it('PUBLIC_RECORD_NOTICE_BADGE matches the exact required wording', () => {
    assert.equal(
      PUBLIC_RECORD_NOTICE_BADGE,
      '> 🌐 **Public Record Notice**: Sourced from live public filings. PropFyndr has not conducted an on-ground physical inspection for this project.',
    )
  })
})
