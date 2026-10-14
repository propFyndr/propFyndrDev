import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cleanForPersist } from '../chat-helpers'

// Saved answers lost every blank line ( /\s{2,}/ -> ' ' ), so reopened chats
// showed run-together text and tables that no longer rendered.
describe('cleanForPersist', () => {
  const answer = [
    '| If prices rise by… | Value after 5 years |',
    '| :--- | :--- |',
    '| 4% a year | ₹2.43 crore |',
    '',
    '**Break-even first:** stamp duty…',
    '',
    '### To narrow this down',
    'Tell me your budget.',
  ].join('\n')

  it('keeps line breaks, blank lines and tables', () => {
    assert.equal(cleanForPersist(answer), answer)
  })

  it('still strips provenance tags and collapses repeated spaces', () => {
    assert.equal(cleanForPersist('Sector 150  is green (web search) [Source 1].\n\nNext   line'), 'Sector 150 is green.\n\nNext line')
  })

  it('caps runs of blank lines at one', () => {
    assert.equal(cleanForPersist('a\n\n\n\nb'), 'a\n\nb')
  })
})
