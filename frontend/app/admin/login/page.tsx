'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { LockKey, Eye, EyeSlash, CircleNotch, ArrowRight } from '@phosphor-icons/react'
import { API_BASE } from '@/lib/env'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    // An email present means a real admin account; omitted, this falls back
    // to the single shared password every deploy has always had.
    const res = await fetch(`${API_BASE}/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email ? { email, password } : { password }),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      if (data.token) {
        localStorage.setItem('admin_token', data.token)
        if (data.role) localStorage.setItem('admin_role', data.role)
        const destination =
          data.role === 'BUILDER' ? '/builder/portal' :
          data.role === 'PARTNER' ? '/partner/portal' :
          '/admin'
        router.push(destination)
      }
    } else {
      const errData = await res.json().catch(() => ({}))
      setError(errData.error || 'Wrong password.')
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-surface-2 dark:bg-surface">
      {/* Oversized square-mark watermark, the way a bank or SaaS login uses its
          own icon as background texture rather than a stock gradient. */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-[520px] h-[520px] opacity-[0.05] dark:opacity-[0.07] rotate-[-8deg]">
        <Image src="/images/icons/logo-square-black.png" alt="" width={520} height={520} className="object-contain block dark:hidden" unoptimized />
        <Image src="/images/icons/logo-square-white.png" alt="" width={520} height={520} className="object-contain hidden dark:block" unoptimized />
      </div>
      <div className="pointer-events-none absolute -bottom-32 -left-16 w-[360px] h-[360px] opacity-[0.04] dark:opacity-[0.05] rotate-[10deg]">
        <Image src="/images/icons/logo-square-black.png" alt="" width={360} height={360} className="object-contain block dark:hidden" unoptimized />
        <Image src="/images/icons/logo-square-white.png" alt="" width={360} height={360} className="object-contain hidden dark:block" unoptimized />
      </div>

      <div className="relative w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl shadow-[var(--shadow-3)] flex items-center justify-center mb-4 bg-white dark:bg-surface-2 border border-[var(--color-border)]">
            <Image src="/images/icons/logo-square-black.png" alt="PropFyndr" width={32} height={32} className="object-contain block dark:hidden" unoptimized />
            <Image src="/images/icons/logo-square-white.png" alt="PropFyndr" width={32} height={32} className="object-contain hidden dark:block" unoptimized />
          </div>
          <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)] tracking-tight">PropFyndr Admin</h1>
          <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5">Sign in to the internal dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-[var(--radius-2xl)] p-6 space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[var(--color-text-secondary)] px-0.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@propfyndr.in"
              className="w-full bg-surface-2 dark:bg-surface-3 border border-[var(--color-border)] rounded-[var(--radius-md)] px-3.5 py-3 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[var(--color-text-secondary)] px-0.5">Password</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
            {loading ? 'Signing in…' : 'Sign in'}
            {!loading && <ArrowRight size={14} className="opacity-70" />}
          </button>

          <p className="text-[11px] text-[var(--color-text-muted)] text-center pt-1">
            Leave email blank to use the shared bootstrap password.
          </p>
        </form>

        <p className="text-[11px] text-[var(--color-text-muted)] text-center mt-6">
          Noida &amp; Greater Noida &middot; AI Real Estate Advisor
        </p>
      </div>
    </div>
  )
}
