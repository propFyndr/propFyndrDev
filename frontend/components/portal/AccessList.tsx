'use client'

/**
 * Who can sign in at this organisation, and the switch to stop them.
 *
 * A builder whose sales manager left had to email PropFyndr and wait for a
 * super admin. That makes us a bottleneck on somebody else's staffing, and
 * leaves the person who actually knows someone has left unable to act.
 *
 * Revocation only, by design. Creating a login stays with PropFyndr — a builder
 * proposes a partner account and we approve it. The asymmetry is deliberate:
 * switching an account off is reversible and reduces access, while creating one
 * grants it.
 *
 * The server decides what this viewer may act on and sends `can_manage` per
 * row, so this component never re-derives the hierarchy. Two implementations of
 * one rule is how the two come to disagree.
 */

import { useCallback, useEffect, useState } from 'react'
import { Prohibit, ArrowCounterClockwise, ShieldCheck } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { Card, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface AccessAccount {
  id: string
  email: string
  role: string
  is_active: boolean
  last_login_at: string | null
  invite_pending: boolean
  organisation: string | null
  can_manage: boolean
}

function activity(a: AccessAccount): string {
  if (a.invite_pending) return 'Invite not yet accepted'
  if (!a.last_login_at) return 'Never signed in'
  return `Last signed in ${new Date(a.last_login_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export default function AccessList() {
  const [accounts, setAccounts] = useState<AccessAccount[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  /** The row awaiting a second click. Revoking someone deserves one pause. */
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/portal/access')
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setAccounts(data.accounts ?? [])
    } catch {
      setError('Could not load access for your organisation.')
      setAccounts([])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function setActive(account: AccessAccount, is_active: boolean) {
    setSavingId(account.id)
    setError('')
    setNotice('')
    setConfirmId(null)
    try {
      const res = await adminFetch(`/portal/access/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not update that account.')
        return
      }
      setNotice(
        is_active
          ? `${account.email} can sign in again.`
          : `${account.email} can no longer sign in${data.sessions_ended ? `, and ${data.sessions_ended} open session${data.sessions_ended === 1 ? '' : 's'} ended immediately` : ''}.`,
      )
      await load()
    } finally {
      setSavingId(null)
    }
  }

  if (accounts === null && !error) return <Spinner />

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          Portal access
        </h2>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
          People who can sign in to your portal. Revoking takes effect immediately — any open
          session ends with it. To add someone, ask PropFyndr; only they can create a login.
        </p>
      </div>

      {error && <ErrorNote message={error} />}
      {notice && (
        <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">{notice}</p>
      )}

      {accounts && accounts.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={32} />}
          title="No portal accounts yet"
          body="When PropFyndr sets up a login for your organisation it appears here."
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {(accounts ?? []).map((a) => (
            <div key={a.id} className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-[14px] font-semibold truncate ${a.is_active ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500 line-through'}`}>
                    {a.email}
                  </p>
                  {!a.is_active && (
                    <span className="text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      Revoked
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {a.role === 'PARTNER' ? (a.organisation ?? 'Channel partner') : 'Your organisation'}
                  {' · '}{activity(a)}
                </p>
              </div>

              <div className="shrink-0">
                {!a.can_manage ? (
                  // Shown rather than hidden: a row you cannot act on is still
                  // information about who has access.
                  <span className="text-[12px] text-zinc-400 dark:text-zinc-500">Managed by PropFyndr</span>
                ) : a.is_active ? (
                  confirmId === a.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingId === a.id}
                        onClick={() => void setActive(a, false)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-bold disabled:opacity-50 cursor-pointer"
                      >
                        {savingId === a.id ? 'Revoking…' : 'Yes, revoke'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(a.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Prohibit size={13} weight="bold" />Revoke
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={savingId === a.id}
                    onClick={() => void setActive(a, true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                  >
                    <ArrowCounterClockwise size={13} weight="bold" />Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}
