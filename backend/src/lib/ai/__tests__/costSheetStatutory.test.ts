import { it } from 'node:test'
import assert from 'node:assert/strict'
import { renderCostSheetTable } from '../marketTable'

// The CostSheet column defaults to 6.0, so every sheet printed 6% stamp duty
// for a male buyer. Statutory rates come from UP law, never the row.
it('prints UP statutory stamp duty and registration whatever the row holds', () => {
  const table = renderCostSheetTable(
    { base_price_per_sqft: 9000, parking_cost: 400000, stamp_duty_pct: 6.0, registration_pct: 2 },
    { name: 'Test', status: 'under_construction' },
  )
  assert.match(table, /UP Stamp Duty\*\* \| 7% \| At registration \(6% for women\)/)
  assert.match(table, /Registration Fee\*\* \| 1% \|/)
})
