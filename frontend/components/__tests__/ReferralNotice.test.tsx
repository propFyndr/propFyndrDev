import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ReferralNotice from '../ReferralNotice'

describe('ReferralNotice', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows the notice text and a privacy link', async () => {
    render(<ReferralNotice />)
    act(() => { jest.advanceTimersByTime(900) })
    await waitFor(() => expect(screen.getByText(/stored and may be reviewed/i)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy')
  })

  it('hides on close and remembers the dismissal', async () => {
    render(<ReferralNotice />)
    act(() => { jest.advanceTimersByTime(900) })
    await waitFor(() => expect(screen.getByText(/stored and may be reviewed/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    await waitFor(() => expect(screen.queryByText(/stored and may be reviewed/i)).not.toBeInTheDocument())
    expect(localStorage.getItem('referral-notice-dismissed')).toBe('true')
  })

  it('does not show again once dismissed', () => {
    localStorage.setItem('referral-notice-dismissed', 'true')
    render(<ReferralNotice />)
    act(() => { jest.advanceTimersByTime(900) })
    expect(screen.queryByText(/stored and may be reviewed/i)).not.toBeInTheDocument()
  })

  it('auto-hides after 10 seconds', async () => {
    render(<ReferralNotice />)
    act(() => { jest.advanceTimersByTime(900) })
    await waitFor(() => expect(screen.getByText(/stored and may be reviewed/i)).toBeInTheDocument())
    act(() => { jest.advanceTimersByTime(10_000) })
    await waitFor(() => expect(screen.queryByText(/stored and may be reviewed/i)).not.toBeInTheDocument())
  })
})
