/**
 * Test-only replacement for every model call, used by the route replay.
 *
 * Two conditions, both required, so a stray env var in production can never
 * switch the advisor off: NODE_ENV=test AND LLM_STUB=1. With it on, intent
 * extraction returns the deterministic reading and the answer chain streams a
 * fixed marker, so a replay can tell "the model would have answered this"
 * from "code answered this" without spending a token.
 */
export const LLM_STUB_ANSWER = '[[LLM_STUB_ANSWER]]'

export function isLlmStubbed(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.LLM_STUB === '1'
}

/**
 * What the model would have been sent, observable in tests.
 *
 * The stub answers before any provider is reached, so a replay can tell code
 * from model but not whether the data a question needs was in the prompt. An
 * observer closes that gap: a coverage test asserts that a project's data reaches
 * the model, which is the failure no answer-text check can see ("price history
 * is not available" over a table that holds six rows). Fired only when stubbed.
 */
export interface StubbedModelCall {
  systemPrompt?: string
  messages?: unknown
}
const stubObservers = new Set<(call: StubbedModelCall) => void>()

export function onStubbedModelCall(fn: (call: StubbedModelCall) => void): () => void {
  stubObservers.add(fn)
  return () => { stubObservers.delete(fn) }
}

export function emitStubbedModelCall(call: StubbedModelCall): void {
  for (const fn of stubObservers) {
    try { fn(call) } catch { /* an observer never breaks a turn */ }
  }
}
