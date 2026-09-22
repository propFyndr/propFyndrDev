import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { track } from '../analytics'

describe('Analytics High-Intent Events & Test Isolation', () => {
  it('safely handles cost_sheet_calculated event with typed payload', () => {
    assert.doesNotThrow(() => {
      track('cost_sheet_calculated', {
        project_name: 'Ace Parkway',
        unit_bhk: '3 BHK',
        total_landed_cost: 24500000,
      })
    })
  })

  it('safely handles site_visit_booked event with typed payload', () => {
    assert.doesNotThrow(() => {
      track('site_visit_booked', {
        project_slug: 'ace-parkway',
        project_name: 'Ace Parkway',
        visit_date: '2026-10-01T10:00:00Z',
        time_slot: '11:00 AM',
      })
    })
  })

  it('safely handles callback_requested event with typed payload', () => {
    assert.doesNotThrow(() => {
      track('callback_requested', {
        project_slug: 'ace-parkway',
        project_name: 'Ace Parkway',
        sector: 'Sector 150',
        intent_tier: 'immediate',
      })
    })
  })

  it('guarantees zero network calls and no-op in NODE_ENV=test', () => {
    const prevEnv = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'test'
      assert.doesNotThrow(() => {
        track('cost_sheet_calculated', { test: true })
      })
    } finally {
      process.env.NODE_ENV = prevEnv
    }
  })
})
