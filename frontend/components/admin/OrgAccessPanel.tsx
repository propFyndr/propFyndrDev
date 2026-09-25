'use client'

/**
 * Console Access Management for Organizations (Builders & Channel Partners).
 *
 * Provides a refined, secure interface for managing team members who can
 * access their respective portals (e.g. partner console / builder portal).
 *
 * Implements Apple Design and Master Design Engineering principles:
 * - High-clarity information hierarchy with calm baseline & distinct elevation.
 * - Full state handling: loading skeleton, empty states, error/notice banners,
 *   busy/disabled transitions, and manual invite link fallbacks with instant copy.
 * - Tactile micro-interactions (press scale, hover boundaries, focus rings).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Users,
  UserPlus,
  Key,
  ShieldCheck,
  CheckCircle,
  WarningCircle,
  Clock,
  Prohibit,
  ArrowsClockwise,
  EnvelopeSimple,
  Copy,
  Check,
  X,
  CircleNotch,
  ArrowSquareOut,
  LockKey
} from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'

export interface OrgAccessPanelProps {
  scope: 'builder' | 'partner'
  orgId: string
  orgName: string
  onClose?: () => void
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

function formatLastSeen(row: AccessRow): string {
  if (row.invite_pending) return 'Invite pending'
  if (!row.last_login_at) return 'Never signed in'
  try {
    const d = new Date(row.last_login_at)
    return `Last active ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  } catch {
    return 'Active'
  }
}

function getInitials(email: string): string {
  const namePart = email.split('@')[0] || ''
  const parts = namePart.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return namePart.slice(0, 2).toUpperCase() || 'U'
}

export default function OrgAccessPanel({ scope, orgId, orgName, onClose }: OrgAccessPanelProps) {
  const [rows, setRows] = useState<AccessRow[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  /** Shown whenever an invite exists but the email did not go out. */
  const [fallbackUrl, setFallbackUrl] = useState('')
  const [copiedFallback, setCopiedFallback] = useState(false)

  const query = scope === 'builder' ? `builder_id=${orgId}` : `partner_id=${orgId}`

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await adminFetch(`/admin/team?${query}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setRows(data.admins ?? [])
    } catch {
      setError('Could not load portal access members for this organisation.')
      setRows([])
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  async function copyFallbackLink() {
    if (!fallbackUrl) return
    try {
      await navigator.clipboard.writeText(fallbackUrl)
      setCopiedFallback(true)
      setTimeout(() => setCopiedFallback(false), 2200)
    } catch {
      // Fallback if clipboard API is restricted
      setError('Please select and copy the link manually.')
    }
  }

  async function invite(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const email = inviteEmail.trim()
    if (!email || busy) return

    setBusy(true)
    setError('')
    setNotice('')
    setFallbackUrl('')
    setCopiedFallback(false)

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
        setError(data?.error || 'Could not create the invitation.')
        return
      }

      if (data.emailed) {
        setNotice(`Invitation successfully emailed to ${email}.`)
      } else {
        setNotice(`Invite created for ${email}. Email delivery was skipped.`)
      }

      if (!data.emailed && data.inviteUrl) {
        setFallbackUrl(data.inviteUrl)
      }

      setInviteEmail('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function resend(row: AccessRow) {
    setResendingId(row.id)
    setError('')
    setNotice('')
    setFallbackUrl('')
    setCopiedFallback(false)

    try {
      const res = await adminFetch(`/admin/team/${row.id}/resend-invite`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not resend the invitation.')
        return
      }
      setNotice(data.emailed ? `Invitation re-sent to ${row.email}.` : `New invitation link generated for ${row.email}.`)
      if (!data.emailed && data.inviteUrl) setFallbackUrl(data.inviteUrl)
    } finally {
      setResendingId(null)
    }
  }

  async function setActive(row: AccessRow, is_active: boolean) {
    setTogglingId(row.id)
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
        setError(data?.error || 'Could not update access status.')
        return
      }
      setNotice(is_active ? `Portal access restored for ${row.email}.` : `Portal access revoked for ${row.email}.`)
      await load()
    } finally {
      setTogglingId(null)
    }
  }

  const activeCount = rows ? rows.filter((r) => r.is_active && !r.invite_pending).length : 0
  const pendingCount = rows ? rows.filter((r) => r.invite_pending).length : 0

  return (
    <div className="space-y-5 text-zinc-900 dark:text-zinc-100">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200/70 dark:border-zinc-800/80">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs">
            <Key size={18} weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] font-bold text-zinc-900 dark:text-white tracking-tight">
                Portal Access & Credentials
              </h2>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                {scope === 'partner' ? 'Channel Partner' : 'Builder'}
              </span>
            </div>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Authorized team members at <span className="font-semibold text-zinc-700 dark:text-zinc-200">{orgName}</span> who can sign in to their dedicated console.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {rows !== null && (
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {activeCount} active
              </span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {pendingCount} pending
                </span>
              )}
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close access panel"
              aria-label="Close access panel"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Notice / Status Banners */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-[13px] animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <WarningCircle size={17} weight="fill" className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[13px] animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle size={17} weight="fill" className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-100 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Manual Invite Link Box (Fallback for dev / missing email provider) */}
      {fallbackUrl && (
        <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs font-bold">
              <Clock size={15} weight="bold" />
              <span>Direct Magic Invite Link</span>
            </div>
            <span className="text-[11px] text-amber-700/80 dark:text-amber-400 font-medium">
              Email delivery bypassed
            </span>
          </div>
          <p className="text-[12px] text-amber-700 dark:text-amber-300">
            Copy and send this secure token link directly to the member so they can set their password:
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                readOnly
                value={fallbackUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-3.5 py-2 rounded-lg border border-amber-200/90 dark:border-amber-800/80 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-800 dark:text-zinc-200 select-all outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void copyFallbackLink()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer shrink-0"
            >
              {copiedFallback ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
              {copiedFallback ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      {/* Invite Member Input Group */}
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <UserPlus size={14} /> Invite New Team Member
          </span>
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
            Assigned role: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{ROLE_FOR_SCOPE[scope]}</span>
          </span>
        </div>

        <form onSubmit={invite} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <EnvelopeSimple size={16} />
            </div>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={`colleague@${orgName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'company'}.com`}
              aria-label="New team member email address"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/60 dark:bg-zinc-800/50 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-zinc-800 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !inviteEmail.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs active:scale-[0.98] cursor-pointer shrink-0"
          >
            {busy ? (
              <>
                <CircleNotch size={14} className="animate-spin" />
                <span>Inviting…</span>
              </>
            ) : (
              <>
                <UserPlus size={14} weight="bold" />
                <span>Send Invite</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Member List Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Authorized Console Members ({rows ? rows.length : '…'})
          </span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            No seat limit
          </span>
        </div>

        {rows === null ? (
          /* Loading Skeleton */
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5 flex items-center justify-between animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                  <div className="space-y-1.5">
                    <div className="w-36 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="w-24 h-2.5 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
                  </div>
                </div>
                <div className="w-16 h-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          /* Clean Empty State */
          <div className="py-9 px-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mb-2.5">
              <Users size={20} />
            </div>
            <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
              No team members have console access yet
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
              Use the form above to invite the primary contact or team representatives from {orgName}.
            </p>
          </div>
        ) : (
          /* Members Table / List */
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 shadow-2xs divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
            {rows.map((row) => {
              const isToggling = togglingId === row.id
              const isResending = resendingId === row.id

              return (
                <div
                  key={row.id}
                  className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    !row.is_active ? 'bg-zinc-50/50 dark:bg-zinc-950/30 opacity-75' : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* User Initials Avatar */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                        !row.is_active
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200/60 dark:border-zinc-800'
                          : row.invite_pending
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200/80 dark:border-zinc-700/80'
                      }`}
                    >
                      {getInitials(row.email)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-zinc-900 dark:text-white truncate">
                          {row.email}
                        </span>

                        {/* Status Badges */}
                        {row.invite_pending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
                            <Clock size={11} weight="bold" /> Pending Invite
                          </span>
                        ) : !row.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80">
                            <Prohibit size={11} weight="bold" /> Access Revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                            <CheckCircle size={11} weight="fill" /> Active
                          </span>
                        )}

                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                          {row.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        <span>{formatLastSeen(row)}</span>
                        {row.linked_supabase_user_id && (
                          <>
                            <span>·</span>
                            <span className="text-zinc-400 dark:text-zinc-500">SSO linked</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions for this user */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {row.invite_pending && (
                      <button
                        type="button"
                        disabled={isResending || busy}
                        onClick={() => void resend(row)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 shadow-2xs active:scale-[0.98] cursor-pointer"
                        title="Resend invitation email"
                      >
                        {isResending ? (
                          <CircleNotch size={12} className="animate-spin" />
                        ) : (
                          <ArrowsClockwise size={12} weight="bold" />
                        )}
                        <span>Resend</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isToggling || busy}
                      onClick={() => void setActive(row, !row.is_active)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50 shadow-2xs active:scale-[0.98] cursor-pointer border ${
                        row.is_active
                          ? 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 dark:hover:border-rose-800/80 bg-white dark:bg-zinc-800'
                          : 'border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                      }`}
                    >
                      {isToggling ? (
                        <CircleNotch size={12} className="animate-spin" />
                      ) : row.is_active ? (
                        <Prohibit size={12} weight="bold" />
                      ) : (
                        <ShieldCheck size={12} weight="bold" />
                      )}
                      <span>{row.is_active ? 'Revoke' : 'Restore'}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Security Footnote */}
      <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 pt-1">
        <LockKey size={13} weight="bold" className="shrink-0 text-zinc-400 dark:text-zinc-500" />
        <span>
          Invite credentials use secure cryptographic single-use bearer tokens. Members set their own password directly; no plain passwords are ever handled.
        </span>
      </div>
    </div>
  )
}
