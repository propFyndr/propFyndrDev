import test from 'node:test'
import assert from 'node:assert/strict'
import { offTopicReply } from './offTopic'

test('each off-topic ask gets one short reply that ends on a property question', () => {
  for (const q of [
    'Tell me a joke',
    'Which IPO should I apply for this week?',
    'Which model are you? ChatGPT or Gemini?',
    'What is the weather in Noida today?',
    'Who will win the cricket match tonight?',
    'Should I put my money in bitcoin or gold instead of a flat?',
    'Write python code to sort a list',
    'write a poem about Noida',
  ]) {
    const r = offTopicReply(q)
    assert.ok(r, q)
    assert.ok(r.trim().endsWith('?'), `${q} -> must end on a question`)
    assert.ok(!r.includes('!'), `${q} -> no exclamation marks`)
    assert.ok(r.split(/\s+/).length <= 50, `${q} -> short`)
  }
})

test('the model reply names no vendor', () => {
  assert.doesNotMatch(offTopicReply('which model are you?') ?? '', /chatgpt|gemini|claude|openai|gpt|cohere|groq/i)
})

test('property questions that share a word are left alone', () => {
  for (const q of [
    'Is there a cricket pitch or football turf in the society?',
    'What is the AQI near Sector 150?',
    'Is there a swimming pool at Astralis?',
    'What is the SIP-style payment plan for Gulshan Ikebana?',
    'Which stocks of ready flats are left in Sector 78?',
    'Which model of payment plan is better, CLP or flexi?',
  ]) assert.equal(offTopicReply(q), null, q)
})
