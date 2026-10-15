import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * A ratchet on chat-router.ts: it may shrink, it may not grow.
 *
 * `router.post('/')` is one ~6,600-line function with about 40 gates, and 41 of
 * the last 50 commits (2026-10-15) touched the file, so every feature added
 * here lands in the same place and collides. New behaviour belongs in
 * `lib/chat/handlers/` (see the registry in handlers/index.ts) or its own
 * module; this test fails when the file gets longer than it is today.
 *
 * When you move code out, lower the two limits to the new size. The test also
 * fails when a limit is more than SLACK lines above the real size, so the
 * ratchet tightens instead of leaving room for the file to grow back.
 */
const MAX_FILE_LINES = 7385
const MAX_POST_HANDLER_LINES = 6635
const SLACK = 50

const source = readFileSync(join(__dirname, '..', 'chat-router.ts'), 'utf8').replace(/\r\n/g, '\n')
const lines = source.endsWith('\n') ? source.split('\n').length - 1 : source.split('\n').length

function postHandlerLines(): number {
  const all = source.split('\n')
  const start = all.findIndex((l) => l.startsWith("router.post('/', "))
  // The next route after the main POST handler.
  const end = all.findIndex((l, i) => i > start && l.startsWith("router.get('/session/list'"))
  assert.ok(start >= 0 && end > start, "could not find router.post('/') and the route after it; update this test")
  return end - start
}

describe('chat-router.ts size ratchet', () => {
  it('the file has not grown', () => {
    assert.ok(
      lines <= MAX_FILE_LINES,
      `chat-router.ts is ${lines} lines, over the limit of ${MAX_FILE_LINES}. Put new behaviour in lib/chat/handlers/ or its own module.`,
    )
  })

  it('the main POST handler has not grown', () => {
    const n = postHandlerLines()
    assert.ok(
      n <= MAX_POST_HANDLER_LINES,
      `router.post('/') is ${n} lines, over the limit of ${MAX_POST_HANDLER_LINES}. Extract instead of adding.`,
    )
  })

  it('the limits track the real size, so the ratchet keeps tightening', () => {
    const n = postHandlerLines()
    assert.ok(
      MAX_FILE_LINES - lines <= SLACK && MAX_POST_HANDLER_LINES - n <= SLACK,
      `The file is ${lines} lines and the handler ${n}; the limits (${MAX_FILE_LINES}, ${MAX_POST_HANDLER_LINES}) are more than ${SLACK} lines above. Lower them in this file.`,
    )
  })
})
