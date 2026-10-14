import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { withKeyPrefix } from '../cache'

// A fake with the shape the app uses: single-key commands, a multi-key del,
// and a chainable pipeline whose commands return the pipeline itself.
function fake() {
  const calls: unknown[][] = []
  const pipeline = {
    incr(k: string) { calls.push(['incr', k]); return pipeline },
    ttl(k: string) { calls.push(['ttl', k]); return pipeline },
    exec() { calls.push(['exec']); return Promise.resolve([1, -1]) },
  }
  const client = {
    get: (k: string) => { calls.push(['get', k]); return Promise.resolve(null) },
    set: (k: string, v: unknown, o?: unknown) => { calls.push(['set', k, v, o]); return Promise.resolve('OK') },
    del: (...ks: string[]) => { calls.push(['del', ...ks]); return Promise.resolve(ks.length) },
    zadd: (k: string, m: unknown) => { calls.push(['zadd', k, m]); return Promise.resolve(1) },
    multi: () => pipeline,
    ping: () => { calls.push(['ping']); return Promise.resolve('PONG') },
  }
  return { client, calls }
}

describe('withKeyPrefix', () => {
  it('prefixes every key, including del lists and pipeline chains', async () => {
    const { client, calls } = fake()
    const r = withKeyPrefix(client, 'dev:')
    await r.get('route:/api/v1/sectors')
    await r.set('session:x', 'v', { ex: 60 })
    await r.del('a', 'b')
    await r.zadd('rl:guest:g1', { score: 1, member: 'm' })
    await r.multi().incr('rl:k').ttl('rl:k').exec()
    await r.ping()
    assert.deepEqual(calls, [
      ['get', 'dev:route:/api/v1/sectors'],
      ['set', 'dev:session:x', 'v', { ex: 60 }],
      ['del', 'dev:a', 'dev:b'],
      ['zadd', 'dev:rl:guest:g1', { score: 1, member: 'm' }],
      ['incr', 'dev:rl:k'],
      ['ttl', 'dev:rl:k'],
      ['exec'],
      ['ping'],
    ])
  })

  it('values are never prefixed', async () => {
    const { client, calls } = fake()
    await withKeyPrefix(client, 'dev:').set('k', 'dev-looking value')
    assert.deepEqual(calls[0], ['set', 'dev:k', 'dev-looking value', undefined])
  })
})
