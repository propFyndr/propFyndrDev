import test, { describe, it, before } from 'node:test'
import assert from 'node:assert'
import { loadStatutoryRatesForState, getSyncStampDutyRate, getSyncGstRate } from '../taxEngine'
import { calcStampDuty, calcGst } from '../../calculators'

describe('Tax Engine & Dynamic Calculators', () => {
  before(async () => {
    await loadStatutoryRatesForState('UP')
  })

  it('loads UP statutory rates and computes stamp duty for male buyer', () => {
    const rate = getSyncStampDutyRate('male', 'UP')
    assert.strictEqual(rate, 7)
    const result = calcStampDuty(1.5, 'male', 'UP')
    assert.strictEqual(result.stampDuty, 1050000)
    assert.strictEqual(result.registration, 150000)
    assert.strictEqual(result.total, 1200000)
  })

  it('computes stamp duty for female buyer', () => {
    const rate = getSyncStampDutyRate('female', 'UP')
    assert.strictEqual(rate, 6)
    const result = calcStampDuty(1.5, 'female', 'UP')
    assert.strictEqual(result.stampDuty, 900000)
  })

  it('computes GST for under construction property', () => {
    const rate = getSyncGstRate('under_construction', false, 'UP')
    assert.strictEqual(rate, 5)
    const result = calcGst(1.5, 'under_construction', 100, 'UP')
    assert.strictEqual(result.gst, 750000)
  })

  it('computes 0 GST for ready to move property', () => {
    const result = calcGst(1.5, 'ready_to_move', 100, 'UP')
    assert.strictEqual(result.gst, 0)
    assert.strictEqual(result.rate, 0)
  })
})
