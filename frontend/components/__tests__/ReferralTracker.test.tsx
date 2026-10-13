import { render, waitFor } from '@testing-library/react'
import ReferralTracker from '../ReferralTracker'

jest.mock('../../lib/referral', () => ({
  getStoredReferralCode: jest.fn(() => null),
  storeReferralCode: jest.fn(),
  arrive: jest.fn(() => Promise.resolve({ ownCode: 'NEWCODE1', greeting: { name: 'Furqan' } })),
}))

describe('ReferralTracker', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/discover?r=OLDCODE1')
    jest.clearAllMocks()
  })

  it('calls arrive with the code from the URL and stores the returned own code', async () => {
    const { storeReferralCode } = require('../../lib/referral')
    render(<ReferralTracker />)
    await waitFor(() => expect(storeReferralCode).toHaveBeenCalledWith('NEWCODE1'))
  })

  it("rewrites the address bar to the device's own code", async () => {
    render(<ReferralTracker />)
    await waitFor(() => expect(window.location.search).toContain('r=NEWCODE1'))
  })

  it('renders nothing visible', () => {
    const { container } = render(<ReferralTracker />)
    expect(container.firstChild).toBeNull()
  })

  it('passes the share channel from ?c= to arrive()', async () => {
    const { arrive } = require('../../lib/referral')
    window.history.pushState({}, '', '/?r=OLDCODE1&c=wa')
    render(<ReferralTracker />)
    await waitFor(() => expect(arrive).toHaveBeenCalledWith('OLDCODE1', 'wa'))
  })

  it('sends no channel when the link has none', async () => {
    const { arrive } = require('../../lib/referral')
    render(<ReferralTracker />)
    await waitFor(() => expect(arrive).toHaveBeenCalledWith('OLDCODE1', undefined))
  })

  it('skips arrive() entirely when ?preview=1 is present', async () => {
    const { arrive } = require('../../lib/referral')
    window.history.pushState({}, '', '/discover?r=OLDCODE1&preview=1')
    render(<ReferralTracker />)
    await new Promise((r) => setTimeout(r, 0))
    expect(arrive).not.toHaveBeenCalled()
  })
})
