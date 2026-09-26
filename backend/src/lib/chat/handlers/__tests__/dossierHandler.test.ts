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

  it('matches the words buyers actually use', () => {
    // None of these matched before: the matcher was built from the internal
    // feature name rather than from what people type.
    const asking = [
      'give me a memo',
      'can I get a memo of this',
      'chat summary please',
      'give me a conversation summary',
      'summarise this chat',
      'summarize our conversation',
      'can you recap this discussion',
      'send me the dossier',
      'consultation recap',
    ]
    for (const q of asking) {
      assert.strictEqual(dossierHandler.matches(dummyCtx(q)), true, `should match: ${q}`)
    }
  })

  it('matches a request to share, whoever it is shared with', () => {
    const asking = [
      'make something I can share with my CA',
      'share this with my wife',
      'can I share this conversation with a friend',
      'give me a shareable summary',
      'I want a summary to share with my father',
    ]
    for (const q of asking) {
      assert.strictEqual(dossierHandler.matches(dummyCtx(q)), true, `should match: ${q}`)
    }
  })

  it('ignores unrelated general queries', () => {
    assert.strictEqual(dossierHandler.matches(dummyCtx('Show me 3 BHK in Sector 150')), false)
    assert.strictEqual(dossierHandler.matches(dummyCtx('What is the distance to Jewar airport?')), false)
  })

  it('does not hijack a request to summarise a PROJECT', () => {
    // A bare "summary" belongs to the handler that holds the project's rows.
    const notAsking = [
      'give me a summary of Godrej Woods',
      'summarise this project',
      'what is the price summary for ATS Nobility',
      'summarize the amenities',
      'can you summarise the payment plan',
      'what is the market share of Godrej in Noida',
    ]
    for (const q of notAsking) {
      assert.strictEqual(dossierHandler.matches(dummyCtx(q)), false, `should not match: ${q}`)
    }
  })
})
