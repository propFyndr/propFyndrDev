import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sortTask } from '../taskSorter'

// One or two unseen phrasings per task, not copies of the labelled live turns, so this
// fails when a rule regresses rather than when the eval set changes.
const CASES: Array<[string, string]> = [
  ['2bhk near sector 62 metro under 90 lakh', 'search'],
  ['ready to move 3 bhk in greater noida west', 'search'],
  ['what is the cost sheet for gaur city', 'project_fact'],
  ['how far is mahagun moderne from the metro?', 'project_fact'],
  ['compare ats pristine vs godrej woods', 'compare'],
  ['is 11,000 per sq ft fair for sector 150?', 'price_check'],
  ['what will stamp duty be on 95 lakh', 'cost_calc'],
  ['my salary is 1.2 lakh, how much loan can i get', 'cost_calc'],
  ['which sector is best for a family with kids?', 'advice'],
  ['is the registry open in this society', 'legal'],
  ['are you chatgpt?', 'meta'],
  ['book a site visit for saturday', 'action'],
  ['yes', 'followup'],
  ['step 3', 'followup'],
  ['hello!', 'smalltalk'],
  ['2bhk in pune under 80 lakh', 'out_of_scope'],
  ['looking for a 2bhk on rent under 25k', 'out_of_scope'],
]

describe('sortTask', () => {
  for (const [message, task] of CASES) {
    it(`${task}: ${message}`, () => assert.equal(sortTask(message).task, task))
  }

  it('does not read a BHK token as keyboard noise', () => {
    assert.equal(sortTask('3bhk').task, 'search')
  })

  it('reads monthly income as a cost question, not a rental', () => {
    assert.equal(sortTask('monthly income is 1,50,000/month, what emi can i manage').task, 'cost_calc')
  })
})
