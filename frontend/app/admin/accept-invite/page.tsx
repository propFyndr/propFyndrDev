'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle, Eye, EyeSlash, CircleNotch, WarningCircle, LockKey } from '@phosphor-icons/react'
import { API_BASE } from '@/lib/env'

function AcceptInviteForm() {
  const [mounted, setMounted] = useState(false)
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/admin/team/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      setLoading(false)
      if (res.ok) {
        setIsDemo(Boolean(data.isDemo))
        setDone(true)
        setTimeout(() => router.push('/admin/login'), 2200)
      } else {
        setError(data.error || 'This invite is invalid or has expired.')
      }
    } catch {
      setLoading(false)
      setError('Unable to reach authentication service. Please check your network.')
    }
  }

  if (!mounted) {
    return (
      <div className="glass-card rounded-[var(--radius-2xl)] p-6 space-y-4 animate-pulse">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-11 bg-zinc-300 dark:bg-zinc-700 rounded" />
      </div>
    )
  }

  if (!token) {
    return (
      <div className="glass-card rounded-[var(--radius-2xl)] p-6 flex items-start gap-3">
        <WarningCircle size={20} className="text-[var(--color-danger)] shrink-0 mt-0.5" weight="fill" />
        <p className="text-[13.5px] text-[var(--color-text-secondary)]">No invite token in this link — check it was copied in full, without any trailing characters trimmed.</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="glass-card rounded-[var(--radius-2xl)] p-6 flex flex-col items-center text-center gap-3">
        <CheckCircle size={36} className="text-[var(--color-success)] shrink-0" weight="fill" />
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {isDemo ? 'Demo Verification Successful!' : 'Password Set Successfully!'}
          </h2>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            {isDemo
              ? 'Onboarding preview simulation complete. Redirecting you to sign in…'
              : 'Your admin credentials have been saved. Redirecting you to sign in…'}
          </p>
        </div>
      </div>
    )
  }

  const isDemoToken = token === 'prp_demo_invite_token'

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-[var(--radius-2xl)] p-6 space-y-3.5">
      {isDemoToken && (
        <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800 p-3.5 rounded-[var(--radius-md)] flex items-start gap-2.5">
          <WarningCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" weight="fill" />
          <div className="space-y-0.5">
            <p className="text-[12.5px] font-semibold text-blue-900 dark:text-blue-200">
              Interactive Preview Mode
            </p>
            <p className="text-[12px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
              You are testing the invite acceptance flow from the email preview. You can enter a password to test the complete flow. For live team onboarding, use personalized links generated from <span className="font-semibold">Admin &gt; Team</span>.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-[var(--color-text-secondary)] px-0.5">New password</label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full bg-surface-2 dark:bg-surface-3 border border-[var(--color-border)] rounded-[var(--radius-md)] px-3.5 py-3 pr-11 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
            autoFocus
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
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-[var(--color-text-secondary)] px-0.5">Confirm password</label>
        <input
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter password"
          className="w-full bg-surface-2 dark:bg-surface-3 border border-[var(--color-border)] rounded-[var(--radius-md)] px-3.5 py-3 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
        />
      </div>

      {error && (
        <p className="text-[12.5px] text-[var(--color-danger)] bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/15 rounded-[var(--radius-sm)] px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!password || loading}
        className="w-full text-white font-medium py-3 rounded-[var(--radius-md)] text-[14px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-3)]"
        style={{ background: 'var(--color-primary)' }}
      >
        {loading ? <CircleNotch size={16} className="animate-spin" /> : <LockKey size={16} weight="fill" />}
        {loading ? 'Setting password…' : 'Set password and continue'}
      </button>
    </form>
  )
}

export default function AcceptInvitePage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-surface-2 dark:bg-surface">
      <div className="pointer-events-none absolute -top-24 -right-24 w-[520px] h-[520px] opacity-[0.05] dark:opacity-[0.07] rotate-[-8deg]">
        <Image src="/images/icons/logo-square-black.png" alt="" width={520} height={520} className="object-contain block dark:hidden" unoptimized />
        <Image src="/images/icons/logo-square-white.png" alt="" width={520} height={520} className="object-contain hidden dark:block" unoptimized />
      </div>

      <div className="relative w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl shadow-[var(--shadow-3)] flex items-center justify-center mb-4 bg-white dark:bg-surface-2 border border-[var(--color-border)]">
            <Image src="/images/icons/logo-square-black.png" alt="PropFyndr" width={32} height={32} className="object-contain block dark:hidden" unoptimized />
            <Image src="/images/icons/logo-square-white.png" alt="PropFyndr" width={32} height={32} className="object-contain hidden dark:block" unoptimized />
          </div>
          <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)] tracking-tight">Set your admin password</h1>
          <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5">You've been invited to PropFyndr</p>
        </div>

        <Suspense
          fallback={
            <div className="glass-card rounded-[var(--radius-2xl)] p-6 space-y-4 animate-pulse">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
              <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
              <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="h-11 bg-zinc-300 dark:bg-zinc-700 rounded" />
            </div>
          }
        >
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  )
}
