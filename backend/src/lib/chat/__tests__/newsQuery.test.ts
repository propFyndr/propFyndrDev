import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isNewsQuery } from '../newsQuery'

describe('isNewsQuery', () => {
  it('fires on a question about something a developer published', () => {
    const asking = [
      'any news from Godrej?',
      'what was the recent update from Sikka Group',
      'tell me about the latest update on Ace Divino',
      "Tell me more about Godrej Properties's recent update: \"Godrej Woods tops out\". What does this mean for property buyers?",
      'did Prateek announce anything this month',
      'what is the announcement about sector 150',
      'any milestone on the Ace project',
      'was there a press release',
    ]
    for (const q of asking) {
      assert.equal(isNewsQuery(q), true, `should be a news question: ${q}`)
    }
  })

  it('does not fire on ordinary real-estate vocabulary', () => {
    // Every one of these matched the old term list. Because the news lane
    // returns the turn, each was answered as a builder press release instead of
    // reaching the handler that owns it.
    const notAsking = [
      "what's in the Noida Expressway corridor",              // corridor
      'show me flagship projects in sector 150',              // flagship
      'what is the delivery schedule for Ace Divino',         // delivery schedule
      'has this project had a RERA audit',                    // audit
      'when is handover for Godrej Woods',                    // handover
      'I need a 3BHK near a metro under 1.5 crore',
      'compare Ace Divino and Godrej Woods',
      'what is the stamp duty on a 1.2 cr flat',
      'is Godrej reliable',
      'hi',
    ]
    for (const q of notAsking) {
      assert.equal(isNewsQuery(q), false, `should not be a news question: ${q}`)
    }
  })

  it('does not fire on a quoted phrase alone', () => {
    // The old form matched any quoted run of 8+ characters.
    assert.equal(isNewsQuery('is "Sector 150" a good investment'), false)
    assert.equal(isNewsQuery('what does "ready to move" mean'), false)
  })
})
