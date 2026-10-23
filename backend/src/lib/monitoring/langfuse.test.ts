import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskForLangfuse, maskSpanData, otelTraceId, LANGFUSE_MAX_STRING } from './langfuse'

test('redacts phone and email anywhere in a trace payload, keeps the query', () => {
  const masked = maskForLangfuse({
    message: '3BHK in Sector 150 under 1.5cr, call me on 98765 43210',
    nested: [{ note: 'mail a@b.com' }],
    count: 3,
  }) as any
  assert.equal(masked.message, '3BHK in Sector 150 under 1.5cr, call me on [phone]')
  assert.equal(masked.nested[0].note, 'mail [email]')
  assert.equal(masked.count, 3)
})

test('caps long strings', () => {
  const masked = maskForLangfuse('x'.repeat(LANGFUSE_MAX_STRING + 10)) as string
  assert.ok(masked.startsWith('x'.repeat(LANGFUSE_MAX_STRING)))
  assert.ok(masked.endsWith('[truncated 10 chars]'))
})

test('v6 span data: masks inside the JSON string and keeps it valid JSON', () => {
  const masked = maskSpanData(JSON.stringify({ message: 'call 98765 43210', n: 2 })) as string
  assert.deepEqual(JSON.parse(masked), { message: 'call [phone]', n: 2 })
  assert.equal(maskSpanData('plain a@b.com'), 'plain [email]')
})

test('a turn id always maps to the same well-formed OpenTelemetry ids', () => {
  const a = otelTraceId('chat-turn-1')
  assert.deepEqual(a, otelTraceId('chat-turn-1'))
  assert.match(a.traceId, /^[0-9a-f]{32}$/)
  assert.match(a.spanId, /^[0-9a-f]{16}$/)
  assert.notEqual(a.traceId, otelTraceId('chat-turn-2').traceId)
})
