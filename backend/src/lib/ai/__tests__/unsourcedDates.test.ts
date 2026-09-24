import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkAnswerIntegritySync } from '../answerIntegrity'

/**
 * A date a buyer is shown must have come from the prompt.
 *
 * Both strings below were produced by the live server on 24 Sep 2026, one probe
 * each, against rows holding NULL in every date column. The model was handed a
 * status — the word "Obtained", or `oc_status: FULL_OC` — and rendered it as a
 * calendar date, because a date is what the sentence wanted.
 *
 * Every other guard passed them: a date is not a price, not a project name and
 * not a RERA number. A buyer plans a registry appointment, a loan disbursement
 * and a move around an OC date, so it is among the most expensive facts in the
 * product to get wrong, and it was the least guarded.
 */

const kinds = (text: string, prompt: string) =>
  (checkAnswerIntegritySync(text, prompt) ?? []).map(v => v.kind)

describe('a date in an answer must be sourced from the prompt', () => {
  it('catches the two dates measured live', () => {
    const amrapali = 'The Occupancy Certificate was obtained on April 10, 2024.'
    const mahagun = 'Full OC obtained on November 15, 2023.'
    const prompt = '## MATCHED PROJECTS IN DATABASE\n[{"name":"Amrapali Crystal Homes","oc_status":null}]'

    assert.ok(kinds(amrapali, prompt).includes('unsourced_date'), 'April 10, 2024 was never supplied')
    assert.ok(kinds(mahagun, prompt).includes('unsourced_date'), 'November 15, 2023 was never supplied')
  })

  it('allows a date the prompt actually carried, in any rendering', () => {
    for (const [answer, prompt] of [
      ['Possession is 15 November 2023.', 'possession_date: 2023-11-15'],
      ['Possession is 2023-11-15.', 'possession: 15 Nov 2023'],
      ['OC granted on November 15, 2023.', '"oc_date":"2023-11-15T00:00:00.000Z"'],
      ['Handover 10/04/2024.', 'handover 2024-04-10'],
    ]) {
      assert.ok(
        !kinds(answer, prompt).includes('unsourced_date'),
        `supplied date wrongly flagged: ${answer} / ${prompt}`,
      )
    }
  })

  it('leaves years and month-years alone', () => {
    // A bare year is general knowledge the prompt allows, and a month-year is
    // how possession_label is written. Flagging either would fire on almost
    // every answer, and neither is the failure: it is the DAY that cannot be
    // inferred from a status and is never a coincidence.
    for (const answer of [
      'The UP Lifts and Escalators Act 2024 requires an ARD.',
      'Possession is expected by December 2027.',
      'The project launched in 2019 and RERA expires in 2027.',
      'Stamp duty in UP is 7%, registration 1%.',
    ]) {
      assert.deepEqual(
        kinds(answer, 'nothing relevant here').filter(k => k === 'unsourced_date'),
        [],
        `false positive on: ${answer}`,
      )
    }
  })

  it('reports the date it objected to, so the log is actionable', () => {
    const v = (checkAnswerIntegritySync('OC came through on April 10, 2024.', 'no dates') ?? [])
      .find(x => x.kind === 'unsourced_date')
    assert.ok(v, 'expected a violation')
    assert.match(v!.detail, /April 10, 2024/)
  })
})
