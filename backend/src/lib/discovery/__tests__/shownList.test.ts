import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveShownSet, lastListedProjects } from '../reference'

const shown = [{ id: 'a', name: 'Express Zenith' }, { id: 'b', name: 'Panchsheel Pratishtha' }]

describe('the list on screen (live audit, 29 Oct)', () => {
  it('"the upper two" and "two suitable projects" mean the shown list', () => {
    for (const m of ['No from the upper two properties', 'Compare two suitable projects and tell me which has the lower total cost.', 'compare both of them'])
      assert.deepEqual(resolveShownSet(m, shown).map((p) => p.name), ['Express Zenith', 'Panchsheel Pratishtha'], m)
    assert.deepEqual(resolveShownSet('compare two projects in sector 150', shown), [])
  })

  it('falls back to the last answer that listed two or more catalogue projects', () => {
    const catalog = [...shown, { id: 'c', name: 'ATS Kingston Heath' }]
    const history = [
      { role: 'assistant', content: '- **Express Zenith**, Sector 77\n- **Panchsheel Pratishtha**, Sector 75' },
      { role: 'user', content: 'What is the catch with ATS Kingston Heath?' },
      { role: 'assistant', content: '### The catch with ATS Kingston Heath\n**What our records show**' },
    ]
    assert.deepEqual(lastListedProjects(history, catalog).map((p) => p.name), ['Express Zenith', 'Panchsheel Pratishtha'])
  })
})

describe('a price is not a count', () => {
  it('"the ones above 3.8 cr" filters, it does not pick the top three', () => {
    assert.deepEqual(resolveShownSet('just the ones above 3.8 cr', shown), [])
    assert.deepEqual(resolveShownSet('above 3 cr only', shown), [])
  })
})
