import test from 'node:test'
import assert from 'node:assert/strict'
import { asksAboutTheConversation } from './metaQuestions'

// A yes routes to the transcript handler, which answers from session state.
// A no goes to a model, which will answer this class of question fluently and
// wrongly — so a phrasing dropping off this list is a silent regression.
const ASKS = [
  'what have I told you so far?',
  'what did I ask you first?',
  'what do you know about me',
  'what are you assuming about me',
  'remind me what I said',
  'can you summarise our conversation?',
  'can you summarize our conversation',
  'give me a summary of this chat',
  'summarise the discussion',
  'recap our conversation please',
  'sum up our chat',
  'conversation summary',
  'what did we discuss',
  'what have we covered so far',
  'what did we talk about',
  'run through our conversation again',
]

const DOES_NOT_ASK = [
  '3BHK in Sector 150 under 2 crore',
  // A summary of something that is not our conversation.
  'summarise the payment plan for Godrej Nest',
  'give me a summary of Sector 150',
  'what did the builder say about possession',
  'what do you know about ACE Parkway',
  'recap the amenities',
  'what have I got to pay upfront',
]

test('phrasings that ask about the conversation route to the transcript', () => {
  for (const m of ASKS) {
    assert.equal(asksAboutTheConversation(m), true, `should match: ${m}`)
  }
})

test('a summary of project data is not a summary of the conversation', () => {
  for (const m of DOES_NOT_ASK) {
    assert.equal(asksAboutTheConversation(m), false, `should not match: ${m}`)
  }
})
