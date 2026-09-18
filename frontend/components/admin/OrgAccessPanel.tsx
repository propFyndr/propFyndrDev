'use client'

/**
 * Who at this organisation can sign in.
 *
 * Access was manageable only from the global Team page, where you invite
 * someone and then pick their builder out of a dropdown — the question
 * backwards from how anyone actually thinks about it ("who at Lotus can sign
 * in?"). This panel puts the answer on the organisation itself. The Team page
 * stays as the cross-organisation view.
 *
 * Reads `GET /admin/team?builder_id=` / `?partner_id=`, which is the same
 * handler and the same SUPER_ADMIN guard as the global list — no second
 * endpoint, so no second place to forget that a live invite token is a bearer
 * credential and never leaves the server.
 *
 * An organisation may have several admins: `AdminUser.builder_id` is not
 * unique. There is no seat limit and none is implied.
 */

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminFetch'

export interface OrgAccessPanelProps {
  scope: 'builder' | 'partner'
  orgId: string
  orgName: string
}

interface AccessRow {
  id: string
  email: string
  role: string
  is_active: boolean
  invite_pending: boolean
  last_login_at: string | null
  linked_supabase_user_id: string | null
}

const ROLE_FOR_SCOPE = { builder: 'BUILDER', partner: 'PARTNER' } as const

function lastSeen(row: AccessRow): string {
  if (row.invite_pending) return 'Invite not yet accepted'
  if (!row.last_login_at) return 'Never signed in'
  return `Last signed in ${new Date(row.last_login_at).toLocaleDateString()}`
}

export default function OrgAccessPanel({ scope, orgId, orgName }: OrgAccessPanelProps) {
  const [rows, setRows] = useState<AccessRow[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(false)
  /** Shown whenever an invite exists but the email did not go out. */
  const [fallbackUrl, setFallbackUrl] = useState('')

  const query = scope === 'builder' ? `builder_id=${orgId}` : `partner_id=${orgId}`

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await adminFetch(`/admin/team?${query}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setRows(data.admins ?? [])
    } catch {
      setError('Could not load access for this organisation.')
      setRows([])
    }
  }, [query])

  useEffect(() => { void load() }, [load])

  async function invite() {
    const email = inviteEmail.trim()
    if (!email) return
    setBusy(true)
    setError('')
    setNotice('')
    setFallbackUrl('')
    try {
      const res = await adminFetch('/admin/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: ROLE_FOR_SCOPE[scope],
          [scope === 'builder' ? 'builder_id' : 'partner_id']: orgId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not create the invite.')
        return
      }
      // The link is shown whenever the email did not send. Resend refuses
      // unverified sender domains, so the first invite from a new environment
      // is the likeliest to fail — exactly when the link is needed by hand.
      setNotice(data.emailed ? `Invite emailed to ${email}.` : `Invite created for ${email}. The email did not send.`)
      if (!data.emailed && data.inviteUrl) setFallbackUrl(data.inviteUrl)
      setInviteEmail('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function resend(row: AccessRow) {
    setBusy(true)
    setError('')
    setNotice('')
    setFallbackUrl('')
    try {
      const res = await adminFetch(`/admin/team/${row.id}/resend-invite`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not resend the invite.')
        return
      }
      setNotice(data.emailed ? `Invite re-sent to ${row.email}.` : `Invite link ready for ${row.email}.`)
      if (!data.emailed && data.inviteUrl) setFallbackUrl(data.inviteUrl)
    } finally {
      setBusy(false)
    }
  }

  async function setActive(row: AccessRow, is_active: boolean) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/admin/team/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Could not update access.')
        return
      }
      setNotice(is_active ? `Access restored for ${row.email}.` : `Access revoked for ${row.email}.`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
        Portal Access
      </span>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
        People at {orgName} who can sign in to their own portal. Invited users choose their
        own password; we never set one for them.
      </p>

      {error && (
        <p className="text-[13px] font-semibold text-red-600 dark:text-red-400">{error}</p>
      )}
      {notice && (
        <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">{notice}</p>
      )}
      {fallbackUrl && (
        <input
          readOnly
          value={fallbackUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-200 select-all outline-none"
        />
      )}

      {rows === null ? (
        <p className="text-[13px] text-zinc-400">Loading access…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 py-2">
          Nobody at {orgName} can sign in yet. Invite someone below to give them a portal.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-zinc-900 dark:text-white truncate">{row.email}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {row.role} · {lastSeen(row)}
                  {!row.is_active && ' · revoked'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.invite_pending && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resend(row)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 disabled:opacity-50"
                  >
                    Resend
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setActive(row, !row.is_active)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 disabled:opacity-50"
                >
                  {row.is_active ? 'Revoke' : 'Restore'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder={`name@${orgName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`}
          className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-white outline-none"
        />
        <button
          type="button"
          disabled={busy || !inviteEmail.trim()}
          onClick={() => void invite()}
          className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[12px] font-bold disabled:opacity-40 shrink-0"
        >
          Invite
        </button>
      </div>
    </div>
  )
}
