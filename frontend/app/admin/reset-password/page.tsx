'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LockKey, Eye, EyeSlash, CircleNotch, ArrowLeft } from '@phosphor-icons/react'
import { API_BASE } from '@/lib/env'
import AuthCard, { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS, AuthError, AuthNotice, AuthSubmit } from '@/components/admin/AuthCard'

/** Matches the server's rule. Length first — it is what actually resists guessing. */
const MIN_PASSWORD = 12

function ResetPasswordForm() {
  const router = useRouter()
  const token = useSearchParams().get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= MIN_PASSWORD && password === confirm && Boolean(token)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/admin/auth-flows/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not reset your password.')
      // Any session this browser held is dead server-side now; clear the stale
      // token so the login page does not try to use it.
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_role')
      setDone(true)
      setTimeout(() => router.push('/admin/login'), 2200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthCard title="Reset your password" subtitle="That link is incomplete">
        <div className="glass-card rounded-[var(--radius-2xl)] p-6 space-y-3.5">
          <AuthError message="This reset link is missing its token. Request a new one." />
          <Link
            href="/admin/forgot-password"
            className="block text-center text-[12.5px] font-medium text-[var(--color-primary)] hover:underline"
          >
            Request a new link
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="This ends every other session on your account"
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
          <AuthNotice message="Password updated. Taking you to sign in…" />
        ) : (
          <>
            <div className="space-y-1.5">
              <label htmlFor="pw" className={AUTH_LABEL_CLASS}>New password</label>
              <div className="relative">
                <input
                  id="pw"
                  type={show ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  className={`${AUTH_INPUT_CLASS} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeSlash size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {tooShort && (
                <p className="text-[11.5px] text-[var(--color-text-muted)] px-0.5">
                  {MIN_PASSWORD - password.length} more character{MIN_PASSWORD - password.length === 1 ? '' : 's'} needed
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pw2" className={AUTH_LABEL_CLASS}>Confirm password</label>
              <input
                id="pw2"
                type={show ? 'text' : 'password'}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                className={AUTH_INPUT_CLASS}
              />
              {mismatch && (
                <p className="text-[11.5px] text-[var(--color-danger)] px-0.5">Those do not match</p>
              )}
            </div>

            {error && <AuthError message={error} />}

            <AuthSubmit
              loading={loading}
              disabled={!canSubmit}
              icon={loading ? <CircleNotch size={16} className="animate-spin" /> : <LockKey size={16} weight="fill" />}
            >
              {loading ? 'Saving…' : 'Set new password'}
            </AuthSubmit>
          </>
        )}
      </form>
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary or the whole route opts out of
  // static rendering.
  return (
    <Suspense fallback={<AuthCard title="Reset your password" subtitle="Loading…"><div /></AuthCard>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
