import { render, screen, fireEvent } from '@testing-library/react'
import { ReferralShareButton } from '../chat/ReferralShareButton'

jest.mock('../../lib/referral', () => ({
  getStoredReferralCode: jest.fn(() => 'ABCD1234'),
}))

describe('ReferralShareButton', () => {
  const originalClipboard = navigator.clipboard

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true })
  })

  it('renders a Share PropFyndr trigger', () => {
    render(<ReferralShareButton />)
    expect(screen.getByRole('button', { name: /share propfyndr/i })).toBeInTheDocument()
  })

  it('opens a menu with WhatsApp, SMS and Copy options', () => {
    render(<ReferralShareButton />)
    fireEvent.click(screen.getByRole('button', { name: /share propfyndr/i }))
    expect(screen.getByRole('menuitem', { name: /whatsapp/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /sms/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeInTheDocument()
  })

  it('copies a link containing the stored referral code and channel=copy', async () => {
    const writeText = jest.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<ReferralShareButton />)
    fireEvent.click(screen.getByRole('button', { name: /share propfyndr/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /copy link/i }))

    expect(writeText).toHaveBeenCalledTimes(1)
    const [url] = writeText.mock.calls[0]
    expect(url).toContain('r=ABCD1234')
    expect(url).toContain('c=copy')
  })
})
