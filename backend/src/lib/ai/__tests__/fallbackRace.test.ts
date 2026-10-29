// Day 0 item 2: the race. A local server speaks the OpenAI streaming protocol,
// so the real adapter, buffer and chain run; only the provider is fake. The two
// legs sit on different paths (/cohere, /nvidia) so vendorOf sees two vendors.
process.env.FALLBACK_HEDGE_MS = '400'
process.env.LANGFUSE_SECRET_KEY = ''
process.env.LANGFUSE_PUBLIC_KEY = ''

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { FallbackKeyConfig } from '../../config'

let executeWithFallbackChain: typeof import('../fallbackChain').executeWithFallbackChain
let server: http.Server
let base = ''
/** model -> what the fake provider saw */
const seen: Record<string, { started: number; aborted: boolean }> = {}

function stream(res: http.ServerResponse, text: string) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  const chunk = (content: string) =>
    res.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`)
  for (const word of text.split(' ')) chunk(word + ' ')
  res.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`)
  res.end('data: [DONE]\n\n')
}

before(async () => {
  ;({ executeWithFallbackChain } = await import('../fallbackChain'))
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', () => {
      const model = JSON.parse(body || '{}').model as string
      seen[model] = { started: Date.now(), aborted: false }
      res.on('close', () => { if (!res.writableEnded) seen[model].aborted = true })
      if (model.startsWith('hang')) return // never answers; only an abort ends it
      if (model.startsWith('fail')) return void setTimeout(() => { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"error":{"message":"bad request"}}') }, Number(model.split(':')[1] ?? 0))
      const [, delay] = model.split(':')
      setTimeout(() => stream(res, `This answer came from ${model.split(':')[0]}.`), Number(delay ?? 0))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.RACE_KEY_A = 'k'
  process.env.RACE_KEY_B = 'k'
})
after(() => { server.close(); server.closeAllConnections?.() })

const legs = (a: string, b: string): FallbackKeyConfig[] => [
  { provider: 'openai', envKey: 'RACE_KEY_A', model: a, supportsTools: false, label: `A ${a}`, baseUrl: `${base}/cohere/v1` },
  { provider: 'openai', envKey: 'RACE_KEY_B', model: b, supportsTools: false, label: `B ${b}`, baseUrl: `${base}/nvidia/v1` },
]

async function run(chain: FallbackKeyConfig[]) {
  const t0 = Date.now()
  let firstTokenMs: number | null = null
  let shown = ''
  const send = (event: string, data: Record<string, unknown>) => {
    if (event !== 'token') return
    if (firstTokenMs == null) firstTokenMs = Date.now() - t0
    shown += String(data.token ?? '')
  }
  const result = await executeWithFallbackChain({
    systemPrompt: 'You are a test.',
    messages: [{ role: 'user', content: 'hello' }],
    send,
    onToolCall: async () => ({}),
    chainConfig: chain,
    userMessage: 'hello',
    config: { maxTokens: 200, tools: false },
  })
  return { result, shown, firstTokenMs }
}

describe('the race', () => {
  it('a silent primary is raced: the second vendor answers, the primary is aborted, nothing of it is shown', async () => {
    const { result, shown, firstTokenMs } = await run(legs('hang-a', 'speak-b:200'))
    assert.match(shown, /came from speak-b/)
    assert.ok(firstTokenMs != null && firstTokenMs < 3000, `first token at ${firstTokenMs}ms`)
    assert.equal(result.model, 'speak-b:200')
    await new Promise((r) => setTimeout(r, 100))
    assert.equal(seen['hang-a'].aborted, true, 'the losing primary was not aborted')
  })

  it('a primary that speaks before the hedge time is never raced', async () => {
    const { shown } = await run(legs('quick-a:50', 'unused-b:0'))
    assert.match(shown, /came from quick-a/)
    assert.equal(seen['unused-b:0'], undefined, 'the hedge was started anyway')
  })

  it('a primary that speaks first after the hedge started wins, and the hedge is aborted', async () => {
    const { shown } = await run(legs('late-a:700', 'hang-b'))
    assert.match(shown, /came from late-a/)
    assert.doesNotMatch(shown, /hang-b/)
    await new Promise((r) => setTimeout(r, 100))
    assert.equal(seen['hang-b'].aborted, true, 'the losing hedge was not aborted')
  })

  it('a primary that errors after the hedge started leaves the answer to the hedge', async () => {
    const { shown } = await run(legs('fail-a:600', 'slow-b:900'))
    assert.match(shown, /came from slow-b/)
  })
})
