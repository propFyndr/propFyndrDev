import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { routeCache } from '../routeCache'

// Found live 2026-10-14: the key used req.path, which is relative to the
// router, so /api/v1/sectors, /builders, /blog and /projects all returned the
// sitemap's cached { projects: [...] } — every router's GET / was one key.
describe('routeCache', () => {
  it('keeps two routers mounted at different paths apart, for / and for the same slug', async () => {
    const run = Date.now()
    const a = express.Router()
    const b = express.Router()
    a.get('/', routeCache(60), (_req, res) => { res.json({ from: 'a' }) })
    a.get('/:slug', routeCache(60), (req, res) => { res.json({ from: 'a', slug: req.params.slug }) })
    b.get('/', routeCache(60), (_req, res) => { res.json({ from: 'b' }) })
    b.get('/:slug', routeCache(60), (req, res) => { res.json({ from: 'b', slug: req.params.slug }) })
    const app = express()
    app.use(`/t${run}/a`, a)
    app.use(`/t${run}/b`, b)

    // Prime a, then read b: before the fix b got a's cached body.
    assert.equal((await request(app).get(`/t${run}/a`)).body.from, 'a')
    await new Promise((r) => setTimeout(r, 50))
    assert.equal((await request(app).get(`/t${run}/b`)).body.from, 'b')

    assert.equal((await request(app).get(`/t${run}/a/same-slug`)).body.from, 'a')
    await new Promise((r) => setTimeout(r, 50))
    assert.equal((await request(app).get(`/t${run}/b/same-slug`)).body.from, 'b')
  })
})
