import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { projectPriceNotes } from '../projectPriceNote'
import { UNDATED_NOTE } from '../priceVerification'

const NOW = new Date('2026-10-15T06:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

describe('projectPriceNotes', () => {
  it('a failed lookup gives every project the undated note, and does not throw', async () => {
    const notes = await projectPriceNotes(['a', 'b'], NOW, async () => { throw new Error('relation "fact_verifications" does not exist') })
    assert.equal(notes.get('a'), UNDATED_NOTE)
    assert.equal(notes.get('b'), UNDATED_NOTE)
  })

  it('states the date when the price was confirmed', async () => {
    const notes = await projectPriceNotes(['p'], NOW, async () => ({
      projects: [{ id: 'p' }],
      units: [],
      rows: [{ entityType: 'Project', entityId: 'p', tier: 'BUILDER_ATTESTED', verifiedAt: daysAgo(3) }],
    }))
    assert.match(notes.get('p')!, /^confirmed by the builder on 12 Oct 2026$/)
  })

  it('a price we hold with no row counts as undated, not skipped', async () => {
    const notes = await projectPriceNotes(['p'], NOW, async () => ({ projects: [{ id: 'p' }], units: [], rows: [] }))
    assert.equal(notes.get('p'), UNDATED_NOTE)
  })

  it('asks for nothing when there are no ids', async () => {
    let called = false
    const notes = await projectPriceNotes([], NOW, async () => { called = true; throw new Error('should not load') })
    assert.equal(notes.size, 0)
    assert.equal(called, false)
  })
})
