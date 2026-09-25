import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dossierHandler } from '../dossierHandler'

describe('Dossier Handler Matcher', () => {
  const dummyCtx = (msg: string) => ({
    message: msg,
    intent: { type: 'QUERY' } as any,
    sessionId: 's-1',
    send: () => {},
    emitUiState: () => {},
    res: {} as any,
    cachedProjects: [],
    flags: {},
    builders: [],
    catalog: [],
    intentState: 'START',
  })

  it('matches buyer queries requesting family deal dossiers', () => {
    assert.strictEqual(dossierHandler.matches(dummyCtx('Generate family deal dossier for Godrej Woods')), true)
    assert.strictEqual(dossierHandler.matches(dummyCtx('Create a deal dossier to share with my family')), true)
    assert.strictEqual(dossierHandler.matches(dummyCtx('I want a summary to share with my spouse')), true)
    assert.strictEqual(dossierHandler.matches(dummyCtx('Can you give me a family dossier?')), true)
  })

  it('ignores unrelated general queries', () => {
    assert.strictEqual(dossierHandler.matches(dummyCtx('Show me 3 BHK in Sector 150')), false)
    assert.strictEqual(dossierHandler.matches(dummyCtx('What is the distance to Jewar airport?')), false)
  })
})
