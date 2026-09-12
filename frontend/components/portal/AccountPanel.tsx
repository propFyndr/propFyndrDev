'use client'

/**
 * Your own account: who you are signed in as, and your password.
 *
 * One component for all three consoles. A builder and a channel partner need to
 * change a password exactly as much as staff do, and the screen is identical —
 * the only thing that differs is which shell renders it.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKey, Eye, EyeSlash, CircleNotch, UserCircle, Warning } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { PageShell, PageHeader, Card, ErrorNote, Spinner, Pill } from '@/components/portal/ui'

const MIN_PASSWORD = 12

const INPUT =
  'w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors'
const LABEL = 'block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5'

interface Me {
  email: string
  role: string
  builder: { name: string } | null
  partner: { name: string } | null
}

export default function AccountPanel() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    adminFetch('/portal/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setMe)
      .catch(() => setError('Could not load your account.'))
      .finally(() => setLoading(false))
  }, [])

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = current.length > 0 && next.length >= MIN_PASSWORD && next === confirm && next !== current

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await adminFetch('/admin/auth-flows/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not change your password.')
      setDone(true)
      // Every session ended, including this one. Clear the dead token and send
      // them to sign in rather than letting the next request 401 mysteriously.
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_role')
      setTimeout(() => router.push('/admin/login'), 2200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <PageShell>
      <PageHeader title="Your account" subtitle="Who you are signed in as, and your password." />

      {error && <ErrorNote message={error} />}

      {me && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center shrink-0">
              <UserCircle size={22} weight="duotone" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{me.email}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Pill label={me.role.replace(/_/g, ' ')} tone="blue" />
                {me.builder && <span className="text-[12px] text-zinc-500 dark:text-zinc-400">{me.builder.name}</span>}
                {me.partner && <span className="text-[12px] text-zinc-500 dark:text-zinc-400">{me.partner.name}</span>}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">Change password</h2>
        <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
          Changing it signs you out everywhere, including here. That is the point — a password you are
          replacing because someone may know it should not leave their session alive.
        </p>

        {done ? (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
            <Warning size={16} weight="fill" className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[13px] font-medium text-emerald-700 dark:text-emerald-300">
              Password updated. Taking you to sign in…
            </p>
          </div>
        ) : (
          <form onSubmit={changePassword} className="grid sm:grid-cols-2 gap-3 max-w-xl">
            <label className="sm:col-span-2">
              <span className={LABEL}>Current password</span>
              <input
                type={show ? 'text' : 'password'}
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={INPUT}
                autoComplete="current-password"
              />
            </label>

            <label>
              <span className={LABEL}>New password</span>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  className={`${INPUT} pr-10`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  aria-label={show ? 'Hide passwords' : 'Show passwords'}
                >
                  {show ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {tooShort && (
                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-1">
                  {MIN_PASSWORD - next.length} more character{MIN_PASSWORD - next.length === 1 ? '' : 's'} needed
                </p>
              )}
            </label>

            <label>
              <span className={LABEL}>Confirm new password</span>
              <input
                type={show ? 'text' : 'password'}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={INPUT}
                autoComplete="new-password"
              />
              {mismatch && <p className="text-[11.5px] text-rose-600 dark:text-rose-400 mt-1">Those do not match</p>}
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] transition-all"
              >
                {saving ? <CircleNotch size={15} className="animate-spin" /> : <LockKey size={15} weight="fill" />}
                {saving ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </form>
        )}
      </Card>
    </PageShell>
  )
}
