import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskForLangfuse, LANGFUSE_MAX_STRING } from './langfuse'

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
