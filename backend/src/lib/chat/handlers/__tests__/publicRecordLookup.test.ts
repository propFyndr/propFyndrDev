import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { candidateProjectName, isInCatalog, matchesPublicRecordQuestion } from '../publicRecordLookup'
import { isOfficialSource, toHits, lookupPublicRecord, publicRecordAnswer } from '../../../publicRecord'

const catalog = [{ name: 'Gulshan Botnia' }, { name: 'ACE Parkway' }]

describe('public record lane', () => {
  it('claims a registration question about a project we do not hold, and only then', () => {
    const ask = 'Check the RERA registration of Elite X in Sector 10'
    assert.equal(candidateProjectName(ask), 'Elite X')
    assert.ok(matchesPublicRecordQuestion({ message: ask, catalog }))
    assert.ok(!matchesPublicRecordQuestion({ message: 'Check the RERA registration of Gulshan Botnia', catalog }), 'held project')
    assert.ok(!matchesPublicRecordQuestion({ message: ask, catalog, activeProjectName: 'Gulshan Botnia' }), 'a project is in scope')
    assert.ok(isInCatalog('ace parkway', catalog))
  })

  it('accepts only official sources', () => {
    assert.ok(isOfficialSource('https://up-rera.in/ViewDocument?Param=X.pdf'))
    assert.ok(isOfficialSource('https://ecourts.gov.in/x'))
    assert.ok(!isOfficialSource('https://housing.com/in/buy/noida/elite-x'))
    assert.ok(!isOfficialSource('https://brickplot.com/blog/x'))
    assert.ok(!isOfficialSource('not a url'))
  })

  it('drops listing-portal results and keeps the source and date on what remains', async () => {
    const results = [
      { title: 'Elite X listing', url: 'https://housing.com/x', content: '3BHK from ₹1.85 Cr' },
      { title: 'Elite X registration', url: 'https://up-rera.in/p.pdf', content: 'Registration UPRERAPRJ916631/02/2024 completion 2028' },
    ]
    assert.equal(toHits(results).length, 1)
    const r = await lookupPublicRecord('Elite X', 'k', async () => results, new Date('2026-10-15T00:00:00Z'))
    const text = publicRecordAnswer('Elite X', r)
    assert.match(text, /UPRERAPRJ916631\/02\/2024/)
    assert.match(text, /up-rera\.in, read on 15 Oct 2026; not verified by RealtyAsk/)
    assert.doesNotMatch(text, /1\.85/)
    assert.match(text, /isn't in our records/)
  })

  it('says it found nothing rather than inventing a record, and never sends the buyer elsewhere', async () => {
    const r = await lookupPublicRecord('Elite X', 'k', async () => [])
    const text = publicRecordAnswer('Elite X', r)
    assert.match(text, /found no official/)
    assert.match(text, /advisory team/)
    assert.doesNotMatch(text, /up-rera\.in|visit/i)
  })
})
