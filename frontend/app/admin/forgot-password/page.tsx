'use client'

/**
 * Request a password reset.
 *
 * The response is identical whether or not the email has an account — the
 * server is deliberately built that way, and this page must not undo it by
 * rendering a different message for a known address.
 */

import { useState } from 'react'
import Link from 'next/link'
import { PaperPlaneTilt, CircleNotch, ArrowLeft } from '@phosphor-icons/react'
import { API_BASE } from '@/lib/env'
import AuthCard, { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS, AuthError, AuthNotice, AuthSubmit } from '@/components/admin/AuthCard'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/admin/auth-flows/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Could not send that request.')
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll prepare a reset link for your account"
      footer={
        <Link
          href="/admin/login"
          className="mt-5 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={13} weight="bold" /> Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="glass-card rounded-[var(--radius-2xl)] p-6 space-y-3.5">
        {done ? (
          <>
            <AuthNotice message="If that email has an account, a reset link has been prepared for it." />
            <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
              PropFyndr does not send email automatically yet — the team dispatches reset links by hand.
              If you do not hear back shortly, contact whoever set up your account.
            </p>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <label htmlFor="email" className={AUTH_LABEL_CLASS}>Email</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@propfyndr.in"
                className={AUTH_INPUT_CLASS}
              />
            </div>

            {error && <AuthError message={error} />}

            <AuthSubmit
              loading={loading}
              disabled={!email.trim()}
              icon={loading ? <CircleNotch size={16} className="animate-spin" /> : <PaperPlaneTilt size={16} weight="fill" />}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </AuthSubmit>
          </>
        )}
      </form>
    </AuthCard>
  )
}
