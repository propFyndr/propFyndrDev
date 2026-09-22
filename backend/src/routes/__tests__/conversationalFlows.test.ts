import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../index'

describe('End-to-End Conversational Flows via Chat SSE', () => {
  it('Scenario 1: Geography query emits 0 property cards', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({
        action: {
          type: 'TEXT_MESSAGE',
          payload: { text: 'does sector 150 fall under noida extension' }
        },
        guestToken: 'guest_test_geo_123'
      })

    assert.equal(res.status, 200)
    const body = res.text

    // Parse SSE lines for 'properties' event
    const sseLines = body.split('\n')
    let propertyEvents = 0
    let totalCardsEmitted = 0

    for (let i = 0; i < sseLines.length; i++) {
      if (sseLines[i].startsWith('event: properties')) {
        propertyEvents++
        const dataLine = sseLines[i + 1]
        if (dataLine?.startsWith('data: ')) {
          try {
            const data = JSON.parse(dataLine.slice(6))
            totalCardsEmitted += (data.exactResults?.length ?? 0) + (data.nearbyResults?.length ?? 0)
          } catch {
            // ignore
          }
        }
      }
    }

    assert.equal(totalCardsEmitted, 0, 'Zero property cards should be emitted for geography inquiry')
  })

  it('Scenario 2: Consultative inquiry without criteria emits 0 property cards', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({
        action: {
          type: 'TEXT_MESSAGE',
          payload: { text: 'I have a family of three, what should I look for?' }
        },
        guestToken: 'guest_test_consult_123'
      })

    assert.equal(res.status, 200)
    const body = res.text

    const sseLines = body.split('\n')
    let totalCardsEmitted = 0

    for (let i = 0; i < sseLines.length; i++) {
      if (sseLines[i].startsWith('event: properties')) {
        const dataLine = sseLines[i + 1]
        if (dataLine?.startsWith('data: ')) {
          try {
            const data = JSON.parse(dataLine.slice(6))
            totalCardsEmitted += (data.exactResults?.length ?? 0) + (data.nearbyResults?.length ?? 0)
          } catch {
            // ignore
          }
        }
      }
    }

    assert.equal(totalCardsEmitted, 0, 'Zero property cards should be emitted for consultative turn before criteria are provided')
  })
})
