// Plan of 27 Oct, Day 0 task 2, at the production setting: with the main
// provider blocked on purpose (it accepts the request and never speaks), an
// answer starts within 8 s and finishes within 20 s. Same fake OpenAI-protocol
// server as fallbackRace.test.ts, but FALLBACK_HEDGE_MS is left at its default
// (5 s) so the measured times are the real ones. The backup takes 2 s to its
// first word, inside the 4 s free-Gemini p50 measured on 29 Oct.
import { it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
// Static import: the full runner (node --require tsx/cjs) cannot resolve a dynamic import() of a .ts path.
// FALLBACK_HEDGE_MS is not in .env, so the chain runs at its production default.
import { executeWithFallbackChain } from '../fallbackChain'

let server: http.Server
let base = ''
let primaryAborted = false

before(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', () => {
      const model = JSON.parse(body || '{}').model as string
      if (model === 'blocked-primary') {
        res.on('close', () => { if (!res.writableEnded) primaryAborted = true })
        return // blocked on purpose: never answers
      }
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        for (const w of 'The backup answered this question in full.'.split(' ')) {
          res.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model, choices: [{ index: 0, delta: { content: w + ' ' }, finish_reason: null }] })}\n\n`)
        }
        res.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`)
        res.end('data: [DONE]\n\n')
      }, 2000)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.STALL_KEY_A = 'k'
  process.env.STALL_KEY_B = 'k'
})
after(() => { server.close(); server.closeAllConnections?.() })

it('main provider blocked: first word under 8 s, done under 20 s, primary aborted', async () => {
  assert.equal(process.env.FALLBACK_HEDGE_MS, undefined, 'this proof needs the default hedge')
  const t0 = Date.now()
  let first: number | null = null
  let shown = ''
  const result = await executeWithFallbackChain({
    systemPrompt: 'You are a test.',
    messages: [{ role: 'user', content: 'hello' }],
    send: (event: string, data: Record<string, unknown>) => {
      if (event !== 'token') return
      if (first == null) first = Date.now() - t0
      shown += String(data.token ?? '')
    },
    onToolCall: async () => ({}),
    chainConfig: [
      { provider: 'openai', envKey: 'STALL_KEY_A', model: 'blocked-primary', supportsTools: false, label: 'A blocked', baseUrl: `${base}/cohere/v1` },
      { provider: 'openai', envKey: 'STALL_KEY_B', model: 'backup', supportsTools: false, label: 'B backup', baseUrl: `${base}/nvidia/v1` },
    ],
    userMessage: 'hello',
    config: { maxTokens: 200, tools: false },
  })
  const done = Date.now() - t0
  console.log(`[STALL_PROOF] hedge=default first_word_ms=${first} done_ms=${done} model=${result.model}`)
  assert.match(shown, /backup answered/)
  assert.equal(result.model, 'backup')
  assert.ok(first != null && first < 8000, `first word at ${first} ms`)
  assert.ok(done < 20000, `done at ${done} ms`)
  await new Promise((r) => setTimeout(r, 100))
  assert.ok(primaryAborted, 'the blocked primary was not aborted')
})
