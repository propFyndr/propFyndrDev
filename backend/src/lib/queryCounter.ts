// backend/src/lib/queryCounter.ts
//
// Counts the database queries one request makes.
//
// Phase 8 opens with a baseline, and "this tab feels slow" is not a baseline.
// The two numbers that actually diagnose a slow endpoint are wall time and
// query count, and the second is the one that finds N+1 — an endpoint at 400ms
// issuing 3 queries needs an index, the same endpoint issuing 300 needs a
// different shape entirely, and the timing alone cannot tell you which.
//
// Implemented with AsyncLocalStorage rather than a global counter, because the
// server serves concurrent requests and a global would attribute one request's
// queries to whichever happened to be in flight.
//
// OFF unless `MEASURE_DB_QUERIES` is set. This adds a Prisma extension to every
// query in the process; it is a diagnostic, not something to carry in
// production on the chance someone wants a number later.
import { AsyncLocalStorage } from 'async_hooks'
import type { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

export const MEASURING = process.env.MEASURE_DB_QUERIES === '1'

interface Counter { n: number }
const store = new AsyncLocalStorage<Counter>()

/** Wraps the client so every query bumps the counter for the request in flight. */
export function withQueryCounting(client: PrismaClient): PrismaClient {
  if (!MEASURING) return client
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        const counter = store.getStore()
        if (counter) counter.n += 1
        return query(args)
      },
    },
  }) as unknown as PrismaClient
}

/**
 * Reports the count on the response as `x-db-queries`.
 *
 * A header rather than a log line: the measuring script reads it straight off
 * the response it already made, so timing and query count come from the same
 * request rather than from two runs that may not have hit the same cache state.
 */
export function queryCountingMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!MEASURING) {
    next()
    return
  }
  const counter: Counter = { n: 0 }
  // Set before the body is sent — once headers are flushed it is too late.
  res.on('close', () => { /* nothing to clean up; the store is per-run */ })
  store.run(counter, () => {
    const originalEnd = res.end.bind(res)
    res.end = ((...a: Parameters<typeof originalEnd>) => {
      if (!res.headersSent) res.setHeader('x-db-queries', String(counter.n))
      return originalEnd(...a)
    }) as typeof res.end
    next()
  })
}
