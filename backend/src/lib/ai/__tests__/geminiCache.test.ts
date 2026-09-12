import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getCachedPrefix,
  explicitCacheEnabled,
  resetGeminiCacheState,
  cachedPrefixCount,
} from '../geminiCache'
import { splitSystemPrompt, SYSTEM_PROMPT_BOUNDARY, getBaseSystemPrompt } from '../prompts/base'

/**
 * Explicit caching is the only caching that can work for us.
 *
 * Implicit caching was measured directly against gemini-3.6-flash: two
 * byte-identical requests back to back both reported cachedContentTokenCount 0.
 * The explicit path then returned, unambiguously:
 *
 *   TotalCachedContentStorageTokensPerModelFreeTier limit exceeded
 *   for model gemini-3.6-flash: limit=0
 *
 * Cache storage is simply not available on the free tier, which is a billing
 * prerequisite rather than a code defect. What the code must guarantee is that
 * this costs a buyer nothing: every failure path falls back to the full prompt.
 */

const LONG_HEAD = 'x'.repeat(20_000) // ~5k estimated tokens, over the floor

function fakeClient(behaviour: {
  create?: () => Promise<{ name?: string }>
  update?: () => Promise<unknown>
}) {
  let creates = 0
  let updates = 0
  return {
    calls: () => ({ creates, updates }),
    client: {
      caches: {
        create: async () => {
          creates++
          return behaviour.create ? behaviour.create() : { name: 'cachedContents/test' }
        },
        update: async () => {
          updates++
          return behaviour.update ? behaviour.update() : {}
        },
      },
    } as never,
  }
}

describe('explicit cache never costs the buyer an answer', () => {
  beforeEach(() => {
    resetGeminiCacheState()
    // Explicit caching is now OFF by default — it 400'd every request that also
    // set system_instruction or tools, which is every request we make, and it
    // caches less than Gemini's implicit cache already does on a billed key.
    // These cases are about the module's behaviour when it IS enabled, so they
    // enable it rather than assuming the default.
    process.env.GEMINI_EXPLICIT_CACHE = 'true'
  })
  afterEach(() => {
    delete process.env.GEMINI_EXPLICIT_CACHE
    resetGeminiCacheState()
  })

  it('a rejected create falls back to the uncached path', async () => {
    // This is the live free-tier case: 429, limit=0.
    const { client } = fakeClient({
      create: async () => {
        throw new Error('TotalCachedContentStorageTokensPerModelFreeTier limit exceeded: limit=0')
      },
    })
    const name = await getCachedPrefix(client, 'gemini-3.6-flash', 'key', LONG_HEAD)
    assert.equal(name, null, 'a failed create must yield null, not throw')
  })

  it('a failed create is not retried on every turn', async () => {
    const fake = fakeClient({ create: async () => { throw new Error('nope') } })
    for (let i = 0; i < 5; i++) {
      await getCachedPrefix(fake.client, 'gemini-3.6-flash', 'key', LONG_HEAD)
    }
    assert.equal(fake.calls().creates, 1, 'one attempt per model+prompt, not one per request')
  })

  it('a prompt below the floor is never sent to the API', async () => {
    const fake = fakeClient({})
    const name = await getCachedPrefix(fake.client, 'gemini-3.6-flash', 'key', 'too short')
    assert.equal(name, null)
    assert.equal(fake.calls().creates, 0, 'a create that would certainly fail should not be made')
  })

  it('the flag turns it off completely', async () => {
    process.env.GEMINI_EXPLICIT_CACHE = 'false'
    assert.equal(explicitCacheEnabled(), false)
    const fake = fakeClient({})
    assert.equal(await getCachedPrefix(fake.client, 'm', 'key', LONG_HEAD), null)
    assert.equal(fake.calls().creates, 0)
  })

  it('one entry is created and then reused', async () => {
    const fake = fakeClient({})
    const a = await getCachedPrefix(fake.client, 'gemini-3.6-flash', 'key', LONG_HEAD)
    const b = await getCachedPrefix(fake.client, 'gemini-3.6-flash', 'key', LONG_HEAD)
    assert.equal(a, 'cachedContents/test')
    assert.equal(b, a)
    assert.equal(fake.calls().creates, 1, 'the second turn must reuse, not recreate')
    assert.equal(cachedPrefixCount(), 1)
  })

  it('a different key or model gets its own entry', async () => {
    // Entries belong to one model and one API key; the chain fails over between
    // numbered keys, so sharing one entry across them would be wrong.
    const fake = fakeClient({})
    await getCachedPrefix(fake.client, 'gemini-3.6-flash', 'key-a', LONG_HEAD)
    await getCachedPrefix(fake.client, 'gemini-3.6-flash', 'key-b', LONG_HEAD)
    await getCachedPrefix(fake.client, 'gemini-3.5-flash-lite', 'key-a', LONG_HEAD)
    assert.equal(fake.calls().creates, 3)
  })

  it('a changed prompt does not reuse the old entry', async () => {
    const fake = fakeClient({})
    await getCachedPrefix(fake.client, 'm', 'key', LONG_HEAD)
    await getCachedPrefix(fake.client, 'm', 'key', LONG_HEAD + 'edited')
    assert.equal(fake.calls().creates, 2, 'editing the prompt must mint a new entry')
  })
})

describe('the prompt splits where caching needs it to', () => {
  it('the head is the stable part and the tail is the per-turn part', () => {
    const full = getBaseSystemPrompt()
    const { head, tail } = splitSystemPrompt(full)
    assert.ok(head.length > 0, 'head must not be empty')
    assert.ok(tail.length > 0, 'tail must not be empty')
    assert.ok(!head.includes(SYSTEM_PROMPT_BOUNDARY), 'boundary must not survive into the head')
    assert.ok(!tail.includes(SYSTEM_PROMPT_BOUNDARY), 'boundary must not survive into the tail')
  })

  it('the tool catalogue lands in the tail, not the cached head', () => {
    // It is filtered per turn. In the head it would make the cache useless.
    const { head, tail } = splitSystemPrompt(getBaseSystemPrompt())
    assert.ok(tail.includes('## TOOLS'), 'the tool catalogue belongs to the per-turn tail')
    assert.ok(!head.includes('## TOOLS'), 'the tool catalogue must not be cached')
  })

  it('splitting loses nothing', () => {
    const full = getBaseSystemPrompt()
    const { head, tail } = splitSystemPrompt(full)
    for (const section of ['## HARD RULES', '## COMPETITOR BAN', '## TOOLS', '## DOMAIN KNOWLEDGE']) {
      assert.ok(
        head.includes(section) || tail.includes(section),
        `${section} vanished in the split`,
      )
    }
  })

  it('a prompt with no boundary degrades to uncached rather than truncated', () => {
    const { head, tail } = splitSystemPrompt('no marker here')
    assert.equal(head, 'no marker here')
    assert.equal(tail, '')
  })

  /**
   * Tools live inside the cached resource, because Gemini rejects `tools` on a
   * request that carries `cachedContent`. Two consequences have to hold, and
   * both are silent failures if they stop holding: the declarations must
   * actually reach caches.create, and a different catalogue must not reuse
   * another catalogue's entry.
   */
  it('the tool declarations are stored in the cache, not sent per request', async () => {
    process.env.GEMINI_EXPLICIT_CACHE = 'true'
    resetGeminiCacheState()

    let seenConfig: Record<string, unknown> | null = null
    const client = {
      caches: {
        create: async (params: { config: Record<string, unknown> }) => {
          seenConfig = params.config
          return { name: 'cachedContents/with-tools' }
        },
        update: async () => ({}),
      },
    } as never

    const tools = [{ functionDeclarations: [{ name: 'sector_projects' }] }]
    const name = await getCachedPrefix(client, 'gemini-3.6-flash', 'k', LONG_HEAD, tools)

    assert.equal(name, 'cachedContents/with-tools')
    assert.ok(seenConfig, 'caches.create was never called')
    assert.deepEqual(
      (seenConfig as unknown as { tools: unknown }).tools,
      tools,
      'the declarations must be stored in the cache, or a cached request has no tools at all',
    )
  })

  it('a different tool catalogue does not reuse another catalogue’s cache entry', async () => {
    process.env.GEMINI_EXPLICIT_CACHE = 'true'
    resetGeminiCacheState()

    let creates = 0
    const client = {
      caches: {
        create: async () => {
          creates++
          return { name: `cachedContents/e${creates}` }
        },
        update: async () => ({}),
      },
    } as never

    const withTools = [{ functionDeclarations: [{ name: 'sector_projects' }] }]
    await getCachedPrefix(client, 'gemini-3.6-flash', 'k', LONG_HEAD, withTools)
    await getCachedPrefix(client, 'gemini-3.6-flash', 'k', LONG_HEAD, undefined)

    assert.equal(creates, 2, 'same head, different catalogue — must be two entries')
    assert.equal(cachedPrefixCount(), 2)
  })
})
