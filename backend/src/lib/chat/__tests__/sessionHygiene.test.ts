import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Three defects reported from real usage, all verified in the source and fixed.
 * These guard the fixes, since none of them is reachable by a unit test — they
 * live in an Express handler and a React component.
 */

const ROUTER = readFileSync(join(__dirname, '../../../routes/chat-router.ts'), 'utf8')
const DISCOVERY = readFileSync(
  join(__dirname, '../../../../../frontend/components/DiscoveryContent.tsx'),
  'utf8',
)

describe('"New chat" must not create an empty session', () => {
  it('DELETE /intent resets memory without creating a session row', () => {
    // The row it created was worse than wasted: the client adopted that id, so
    // the next message arrived with a sessionId whose row already existed,
    // isNewSession was false, and the branch that titles a session from its
    // first message never ran. Every conversation started that way stayed
    // titled "Chat", and clicking New chat without typing left a permanent
    // empty row in the sidebar.
    const start = ROUTER.indexOf("delete('/intent'")
    assert.ok(start !== -1, 'DELETE /intent handler not found')
    const handler = ROUTER.slice(start, start + 1400)

    assert.ok(
      !/chatSession\.create/.test(handler),
      'DELETE /intent must not create a session — the first message creates it, with a title',
    )
    assert.ok(/userMemory\.deleteMany/.test(handler), 'it should still clear user memory')
  })

  it('the session list hides sessions that contain no messages', () => {
    const start = ROUTER.indexOf("'/sessions/list'")
    assert.ok(start !== -1, 'session list handler not found')
    const handler = ROUTER.slice(start, start + 2000)
    assert.match(
      handler,
      /messages:\s*\{\s*some:\s*\{\}\s*\}/,
      'a session with no messages is an artifact, not a conversation',
    )
  })

  it('the session list does not issue a query per session', () => {
    // It ran a findFirst and a count for every row: 101 queries for a 50-row
    // sidebar, on every load.
    const start = ROUTER.indexOf("'/sessions/list'")
    const handler = ROUTER.slice(start, start + 2000)
    assert.ok(/_count/.test(handler), 'message count should come from _count')
    assert.ok(
      !/chatMessage\.count/.test(handler),
      'per-session count query reintroduced',
    )
    assert.ok(
      !/chatMessage\.findFirst/.test(handler),
      'per-session title query reintroduced',
    )
  })
})

describe('the first turn must not fork the session', () => {
  it('sending reads the session id from a ref, not from React state', () => {
    // The backend returns the id it created on the first turn's `done` event.
    // Reading React state meant a second message sent before that commit went
    // out with sessionId undefined, and the backend created a second session.
    // The conversation split across two rows and half of it vanished on refresh.
    assert.match(
      DISCOVERY,
      /sessionId:\s*sessionIdRef\.current\s*\?\?/,
      'send must read sessionIdRef.current first',
    )
    assert.match(DISCOVERY, /sessionIdRef\.current = id/, 'the ref must be written synchronously')
  })

  it('every session-id write goes through the setter that updates the ref', () => {
    // A stray setSessionIdState call would update the render without updating
    // the ref, reintroducing the fork.
    const rawStateWrites = [...DISCOVERY.matchAll(/setSessionIdState\(/g)].length
    assert.equal(
      rawStateWrites,
      1,
      'setSessionIdState should only be called inside the setSessionId wrapper',
    )
  })
})

describe('an open answer shows cards for the projects it named', () => {
  /**
   * The open lane's source, bounded by where the lane actually ends.
   *
   * This was a fixed character window, widened from 4000 to 9000 the first time
   * a comment pushed the code it looks for out of range, and it failed the same
   * way again the next time — twice now, for a test about behaviour that never
   * changed. A numeric window measures documentation, not code. The lane ends
   * at the next lane banner, so that is the boundary.
   */
  const openLaneSource = (): string => {
    const start = ROUTER.indexOf('OPEN QUERY LANE')
    assert.ok(start !== -1, 'open lane not found')
    const nextBanner = ROUTER.indexOf('─── ', start + 20)
    return ROUTER.slice(start, nextBanner === -1 ? undefined : nextBanner)
  }

  it('the open lane emits a properties event', () => {
    // The lane returned prose with inline links and no cards, so "what are the
    // most premium gated communities in Sector 78" — which names four real
    // projects — gave the buyer nothing to save, compare or open.
    const lane = openLaneSource()
    assert.match(lane, /loadMentionedProjectCards/, 'open lane should load cards for named projects')
    assert.match(lane, /send\('properties'/, 'open lane should emit the cards')
  })

  it('cards come only from projects the answer actually named', () => {
    // The scope rule: never widen to a sector, never append similar projects.
    assert.match(
      openLaneSource(),
      /loadMentionedProjectCards\(mentionedProjects\)/,
      'the card set must be exactly the mentioned projects',
    )
  })
})
