import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../db'
import { trackResultsShown } from '../tracking'

/**
 * trackResultsShown used updateMany over the whole session, so every earlier query in
 * a session was rewritten with the newest result count. It must touch one row: the latest.
 */
function swap(name: string, value: unknown): () => void {
  const original = Object.getOwnPropertyDescriptor(prisma, name)
  Object.defineProperty(prisma, name, { configurable: true, value })
  return () => {
    if (original) Object.defineProperty(prisma, name, original)
    else delete (prisma as any)[name]
  }
}

test('updates only the latest query of the session, by id', async () => {
  const calls: { findFirst?: any; update?: any; updateMany: number } = { updateMany: 0 }
  const restore = [
    swap('chatAnalytics', {
      findFirst: async () => ({ id: 'ca-1' }),
      update: async () => ({}),
    }),
    swap('queryMetrics', {
      findFirst: async (args: any) => { calls.findFirst = args; return { id: 'q-latest' } },
      update: async (args: any) => { calls.update = args; return {} },
      updateMany: async () => { calls.updateMany++; return { count: 0 } },
    }),
  ]
  try {
    await trackResultsShown('session-1', 3)
  } finally {
    restore.forEach((r) => r())
  }
  assert.equal(calls.updateMany, 0)
  assert.deepEqual(calls.findFirst.where, { session_id: 'session-1' })
  assert.deepEqual(calls.findFirst.orderBy, [{ created_at: 'desc' }, { id: 'desc' }])
  assert.deepEqual(calls.update.where, { id: 'q-latest' })
  assert.deepEqual(calls.update.data, { results_count: 3, had_results: true })
})

test('a session with no query rows updates nothing', async () => {
  let updated = false
  const restore = [
    swap('chatAnalytics', { findFirst: async () => ({ id: 'ca-1' }), update: async () => ({}) }),
    swap('queryMetrics', {
      findFirst: async () => null,
      update: async () => { updated = true; return {} },
      updateMany: async () => { updated = true; return { count: 0 } },
    }),
  ]
  try {
    await trackResultsShown('session-2', 0)
  } finally {
    restore.forEach((r) => r())
  }
  assert.equal(updated, false)
})
