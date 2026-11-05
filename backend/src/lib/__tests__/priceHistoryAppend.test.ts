import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { newPricePoints } from '../priceHistoryAppend'

test('saved rows are skipped; only new rows are appended', () => {
  const r = newPricePoints([
    { id: 'saved-1', quarter_label: 'Q1 2025', price_per_sqft: 7000 },
    { quarter_label: 'Q2 2025', price_per_sqft: '7300', event_note: ' Metro opened ' },
  ])
  assert.deepEqual(r, { rows: [{ quarter_label: 'Q2 2025', price_per_sqft: 7300, total_price_cr: null, event_note: 'Metro opened' }] })
})

test('no default quarter and no default price', () => {
  assert.match((newPricePoints([{ price_per_sqft: 7000 }]) as any).error, /quarter is required/)
  assert.match((newPricePoints([{ quarter_label: 'Q3 2025' }]) as any).error, /price/)
})

test('the admin route never deletes price history on save', () => {
  const src = readFileSync(join(__dirname, '../../routes/admin.ts'), 'utf8')
  const put = src.slice(src.indexOf("router.put('/projects/:id/price-history'"))
  const body = put.slice(0, put.indexOf('\n})'))
  assert.ok(body.length > 0, 'route not found')
  assert.ok(!/deleteMany|\.delete\(|\.update\(/.test(body), 'price-history PUT must only append')
})
