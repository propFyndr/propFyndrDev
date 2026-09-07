import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { FALLBACK_CHAIN } from '../../config'

const chainSource = readFileSync(join(__dirname, '..', 'fallbackChain.ts'), 'utf8')
const geminiSource = readFileSync(join(__dirname, '..', 'gemini.ts'), 'utf8')

/**
 * Three defects that were invisible because each one failed quietly.
 *
 * The chain reports a leg failure as one log line and rolls on, so a leg that
 * has been broken since it was added looks exactly like a leg that is merely
 * slow. All three of these ran in production for as long as they existed.
 */

test('a non-Gemini leg is never asked for the profile model', () => {
  // `effectiveConfig.model` is the per-turn choice from `inferenceProfile`, and
  // it names a Gemini model. Preferring it on the OpenAI leg asked Cohere,
  // NVIDIA and Cloudflare for `gemini-3.5-flash-lite`: 404, 404, 400. All three
  // tool-capable non-Gemini legs failed on every turn.
  assert.ok(
    !/streamWithOpenAI\([\s\S]{0,800}?effectiveConfig\.model \?\? item\.model/.test(chainSource),
    'the OpenAI leg must pass item.model, not effectiveConfig.model',
  )
  // Was a single-line object literal until 7 Sep 2026, when a conditional
  // Groq-only maxTokens override (see groqReplyCeiling in config.ts) made it
  // multi-line. The regex now tolerates either shape — the property this test
  // actually cares about is that `model` is set to the literal `item.model`,
  // spread after `...effectiveConfig` so the spread cannot silently reintroduce
  // effectiveConfig's own `model` key afterwards.
  assert.match(chainSource, /\.\.\.effectiveConfig,\s*\r?\n?\s*model: item\.model,?\s*\r?\n?/)
})

test('the Gemini leg only accepts a Gemini model name from the profile', () => {
  assert.match(chainSource, /\/\^gemini\/i\.test\(effectiveConfig\.model\)/)
})

test('every leg on a non-default host names its own model', () => {
  for (const leg of FALLBACK_CHAIN) {
    if (!leg.baseUrl) continue
    assert.ok(leg.model, `${leg.label} carries a baseUrl but no model`)
  }
})

test('the thinking budget the caller asked for is the one sent', () => {
  // Both fields read the module constant, so the free-tier clamp and every
  // per-turn budget were computed and discarded.
  assert.match(geminiSource, /maxOutputTokens: config\.maxTokens \+ thinkingBudget/)
  assert.match(geminiSource, /thinkingConfig: \{ thinkingBudget \}/)
})

test('a thinking budget of zero is floored to what the model accepts', () => {
  // gemini-3.5-flash-lite answers `thinkingBudget: 0` with a bare
  // 400 INVALID_ARGUMENT. 128 is the smallest value it takes.
  assert.match(geminiSource, /requestedThinking <= 0 \? MIN_THINKING_BUDGET_TOKENS/)
})

test('tool declarations survive the final cycle', () => {
  // Dropping them left function-call history in a request declaring no
  // functions, and Gemini returned an empty string — reported up the chain as
  // "returned no text", so both free legs failed every tool-using turn.
  assert.ok(
    !/if \(cycle < MAX_TOOL_CYCLES - 1 && GEMINI_TOOLS_ENABLED/.test(geminiSource),
    'tools must not be dropped on the last cycle',
  )
  assert.match(geminiSource, /functionCallingConfig: \{ mode: 'NONE' \}/)
})
