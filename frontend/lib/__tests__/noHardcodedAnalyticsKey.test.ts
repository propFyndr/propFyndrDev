import { readFileSync } from 'fs'
import { join } from 'path'

// The PostHog project key lives only in env (NEXT_PUBLIC_POSTHOG_KEY).
// A literal key in the client loader was removed on 2026-10-23 (week plan Day 4.5).
describe('PostHog key', () => {
  it('is not written into the client loader', () => {
    const src = readFileSync(join(__dirname, '..', 'posthogClient.ts'), 'utf8')
    expect(src).not.toMatch(/phc_[A-Za-z0-9]{20,}/)
  })
})
