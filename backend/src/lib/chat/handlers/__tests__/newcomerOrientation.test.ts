import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { newcomerOrientationHandler } from '../newcomerOrientation'

// The guide used to close with a fixed "prioritize Sector 75 / 76 … explore
// Sector 137 / 150" and offer fixed Sector 76 / 137 chips, whatever the table
// held. Everything it says must now come from the rows it shows.
describe('newcomer orientation', () => {
  it('derives its closing line and chips from the table, not a fixed pair of sectors', async () => {
    let text = ''
    let chips: { label: string; payload: { text: string } }[] = []
    const ctx: any = {
      flags: { isNewcomerOrientation: true },
      message: 'i am new to noida, which sector should i look at',
      intent: {},
      sessionId: null,
      send: (event: string, data: any) => { if (event === 'token') text += data.token },
      emitUiState: (state: any) => { chips = state.chips },
      setCachedResponse: () => {},
      res: { end: () => {} },
    }

    assert.equal(await newcomerOrientationHandler.handle(ctx), true)

    assert.doesNotMatch(text, /prioritize \*\*Sector 75/)
    assert.doesNotMatch(text, /Sector 137 \/ 150/)
    assert.match(text, /To narrow this down/)
    assert.match(text, /budget.*commute.*BHK/s)

    const tableSectors = [...text.matchAll(/^\| \*\*([^*]+)\*\*/gm)].map((m) => m[1].trim())
    assert.ok(tableSectors.length > 0, 'the guide shows at least one sector')
    for (const chip of chips) {
      const named = tableSectors.filter((s) => chip.payload.text.includes(s))
      assert.ok(named.length > 0, `chip "${chip.label}" names a sector that is not in the table`)
    }
  })
})
