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
