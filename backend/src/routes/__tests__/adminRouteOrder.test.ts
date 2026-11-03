import { test } from 'node:test'
import assert from 'node:assert/strict'
import adminRouter from '../admin'
import { betaRouter } from '../betaObservability'

/**
 * Express matches routes in registration order, so a literal path registered after a
 * `/:id` route on the same method is unreachable: GET /projects/export was answered by
 * the project-detail handler (404 "Project not found"), and GET /metrics by the
 * conversation-detail handler. Read the router stack directly; no database needed.
 */
function indexOf(router: any, method: string, path: string): number {
  return router.stack.findIndex((l: any) => {
    const p = l.route?.path
    const paths = Array.isArray(p) ? p : [p]
    return l.route?.methods?.[method] && paths.includes(path)
  })
}

test('admin: GET /projects/export is registered before GET /projects/:id', () => {
  const exportAt = indexOf(adminRouter, 'get', '/projects/export')
  const idAt = indexOf(adminRouter, 'get', '/projects/:id')
  assert.ok(exportAt >= 0 && idAt >= 0)
  assert.ok(exportAt < idAt, `export at ${exportAt}, :id at ${idAt}`)
})

test('admin: GET /projects/summary is registered before GET /projects/:id', () => {
  assert.ok(indexOf(adminRouter, 'get', '/projects/summary') < indexOf(adminRouter, 'get', '/projects/:id'))
})

test('beta: GET /metrics is registered before GET /:id', () => {
  const metricsAt = indexOf(betaRouter, 'get', '/metrics')
  const idAt = indexOf(betaRouter, 'get', '/:id')
  assert.ok(metricsAt >= 0 && idAt >= 0)
  assert.ok(metricsAt < idAt, `metrics at ${metricsAt}, :id at ${idAt}`)
})
