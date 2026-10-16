import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { asksBuilderTrust, builderCore, builderNamedIn } from '../builderTrust'

const BUILDERS = [
  { name: 'Supertech Limited' },
  { name: 'Antriksh Group' },
  { name: 'Gulshan Homz' },
  { name: 'Gulshan Group' },
  { name: 'Jaypee Greens (Suraksha Group Resolution)' },
  { name: 'NCR' },
  { name: 'Express Builders' },
]

describe('builder trust questions', () => {
  it('reads the name a buyer types', () => {
    assert.equal(builderCore('Supertech Limited'), 'supertech')
    assert.equal(builderCore('Jaypee Greens (Suraksha Group Resolution)'), 'jaypee greens')
  })

  for (const q of [
    'Can I trust Supertech as a builder? What happened with their delayed projects?',
    'Supertech pe bharosa kar sakte hain kya?',
    'How reliable is Antriksh?',
    'Is this developer trustworthy?',
  ]) {
    it(`is a builder trust question: ${q}`, () => assert.equal(asksBuilderTrust(q, BUILDERS), true))
  }

  for (const q of [
    'Can I trust the metro timeline for Sector 150?',
    'Is the water supply reliable in NCR?',
    'Is the Noida Expressway reliable for daily commute?',
    'Tell me about Supertech projects',
  ]) {
    it(`is not: ${q}`, () => assert.equal(asksBuilderTrust(q, BUILDERS), false))
  }

  it('names the builder, not a part of a word', () => {
    assert.equal(builderNamedIn('Supertech pe bharosa kar sakte hain kya?', BUILDERS)?.name, 'Supertech Limited')
    assert.equal(builderNamedIn('Is the Noida Expressway reliable?', BUILDERS), null)
  })
})
