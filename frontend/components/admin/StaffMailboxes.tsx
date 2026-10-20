'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminFetch'
import {
  EnvelopeSimple,
  Plus,
  Copy,
  Check,
  Key,
  Prohibit,
  ArrowCounterClockwise,
  Trash,
  ArrowSquareOut,
  User,
  ShieldCheck,
  X,
  LockKey,
  WarningCircle,
  Warning,
  Clock,
  Sparkle
} from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'

export interface MailAccount {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  isPrimaryAdmin: boolean
  disabled: boolean
  lastSignInAt: string | null
  deletedAt: string | null
}

/** RealtyMail keeps a deleted account restorable this long, then purges it with its mail. */
const RESTORE_DAYS = 20
const restorableUntil = (deletedAt: string) => new Date(new Date(deletedAt).getTime() + RESTORE_DAYS * 86_400_000)

interface Handover {
  email: string
  password: string
  webmailUrl: string
}

const WEBMAIL_URL = 'https://mail.realtyask.in'

/**
 * Company mailboxes for internal staff (SUPER_ADMIN / ANALYST / SALES). Builders and
 * partners are outside people and never appear here. Passwords are shown once, here,
 * and are not stored anywhere by us.
 */
export default function StaffMailboxes() {
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [configured, setConfigured] = useState(true)
  const [domain, setDomain] = useState('realtyask.in')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [handover, setHandover] = useState<Handover | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Mailbox Deletion Modal State
  const [deleteTarget, setDeleteTarget] = useState<MailAccount | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await adminFetch('/admin/team/mailboxes')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load mailboxes')
      setConfigured(data.configured !== false)
      setDomain(data.domain || 'realtyask.in')
      setAccounts(data.accounts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load mailboxes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function run(id: string, path: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setBusyId(id)
    setError('')
    try {
      const res = await adminFetch(path, { ...init, headers: { 'Content-Type': 'application/json' } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
      return null
    } finally {
      setBusyId(null)
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const data = await run('new', '/admin/team/mailboxes', {
      method: 'POST',
      body: JSON.stringify({ username, ...(name.trim() ? { name } : {}) }),
    })
    setCreating(false)
    if (!data) return
    const account = data.account as MailAccount
    setHandover({ email: account.email, password: String(data.password), webmailUrl: String(data.webmailUrl || WEBMAIL_URL) })
    setUsername('')
    setName('')
    setSuccessToast(`Mailbox ${account.email} provisioned successfully!`)
    setTimeout(() => setSuccessToast(''), 4000)
    void load()
  }

  async function reset(a: MailAccount) {
    if (!window.confirm(`Reset the password for ${a.email}? They will be signed out everywhere.`)) return
    const data = await run(a.id, `/admin/team/mailboxes/${a.id}/reset-password`, { method: 'POST', body: '{}' })
    if (data) {
      setHandover({ email: a.email, password: String(data.password), webmailUrl: WEBMAIL_URL })
      setSuccessToast(`Password rotated for ${a.email}. Credentials ready for handover.`)
      setTimeout(() => setSuccessToast(''), 4000)
    }
  }

  async function toggle(a: MailAccount) {
    const next = !a.disabled
    if (next && !window.confirm(`Disable ${a.email}? They will be signed out and cannot sign in until re-enabled.`)) return
    const data = await run(a.id, `/admin/team/mailboxes/${a.id}`, { method: 'PATCH', body: JSON.stringify({ disabled: next }) })
    if (data) {
      // Re-enabling sets a fresh password: the one disable left behind is known to nobody.
      if (data.password) setHandover({ email: a.email, password: String(data.password), webmailUrl: WEBMAIL_URL })
      setSuccessToast(`Mailbox ${a.email} ${next ? 'disabled' : 're-enabled with a new password'}.`)
      setTimeout(() => setSuccessToast(''), 4000)
      void load()
    }
  }

  const openDeleteModal = (a: MailAccount) => {
    setDeleteError(null)
    setDeleteTarget(a)
  }

  async function executeDeleteMailbox() {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await adminFetch(`/admin/team/mailboxes/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(data.error || 'Server rejected mailbox deletion.')
        return
      }
      setSuccessToast(`Mailbox ${deleteTarget.email} deleted. Restorable in RealtyMail for ${RESTORE_DAYS} days.`)
      setTimeout(() => setSuccessToast(''), 4000)
      setDeleteTarget(null)
      void load()
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete mailbox.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  async function copyFullHandover() {
    if (!handover) return
    const text = `RealtyAsk Official Staff Mailbox Credentials\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nEmail: ${handover.email}\nTemporary Password: ${handover.password}\nWebmail Sign-in: ${handover.webmailUrl}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNote: Please sign in immediately, update your password, and enable Two-Factor Authentication (2FA).`
    await copyText(text, 'handover-full')
  }

  const getInitials = (str: string) => {
    if (!str) return 'MB'
    const namePart = str.split('@')[0]
    const segments = namePart.split(/[._-]/).filter(Boolean)
    if (segments.length >= 2) return (segments[0][0] + segments[1][0]).toUpperCase()
    return namePart.slice(0, 2).toUpperCase()
  }

  return (
    <section className="mt-8 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-7 shadow-xs space-y-6">
      
      {/* ── Section Header & Server Status Banner ──────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/70 text-[#0066cc] dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
            <EnvelopeSimple size={22} weight="bold" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Staff Mailboxes
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] animate-pulse" />
                @{domain}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Self-hosted company inboxes for internal staff and executives. Cryptographic credentials are generated on-demand and kept isolated.
            </p>
          </div>
        </div>

        {/* Webmail Quick Launch Button */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={WEBMAIL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            title="Open RealtyMail Webmail portal"
          >
            <span>Open Webmail</span>
            <ArrowSquareOut size={14} weight="bold" className="text-zinc-400" />
          </a>
        </div>
      </div>

      {/* ── Status / Error Alerts ───────────────────────────────────────── */}
      {!configured && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-2xs">
          <Warning size={18} weight="bold" className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Mail Service Not Connected</p>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
              Ensure <code className="font-mono font-bold">REALTYMAIL_URL</code> and <code className="font-mono font-bold">REALTYMAIL_ADMIN_API_KEY</code> are configured on your backend service.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/80 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <WarningCircle size={16} weight="bold" className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/80 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <Check size={16} weight="bold" className="text-emerald-600" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast('')} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Provisioning Card / Form ───────────────────────────────────── */}
      {configured && (
        <div className="bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkle size={15} weight="bold" className="text-[#0066cc]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Provision New Staff Mailbox
            </h3>
          </div>
          <form onSubmit={create} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            {/* Username Input with Domain Suffix Badge */}
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                Mailbox Address <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs focus-within:ring-2 focus-within:ring-[#0066cc]/20 focus-within:border-[#0066cc] overflow-hidden transition-all">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  placeholder="firstname"
                  required
                  maxLength={64}
                  className="w-full px-3.5 py-2 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-transparent outline-none placeholder:text-zinc-400"
                />
                <span className="px-3 py-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100/80 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 shrink-0 select-none">
                  @{domain}
                </span>
              </div>
            </div>

            {/* Display Name Input */}
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                Display Name <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <div className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs focus-within:ring-2 focus-within:ring-[#0066cc]/20 focus-within:border-[#0066cc] overflow-hidden transition-all">
                <span className="pl-3 text-zinc-400">
                  <User size={14} />
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Furqan Syed"
                  maxLength={100}
                  className="w-full px-3 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-transparent outline-none placeholder:text-zinc-400"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={creating || !username.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#0066cc] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer h-[38px]"
            >
              {creating ? (
                <>
                  <ArrowCounterClockwise size={14} className="animate-spin" />
                  <span>Provisioning…</span>
                </>
              ) : (
                <>
                  <Plus size={15} weight="bold" />
                  <span>Provision Mailbox</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── Mailbox Directory List ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold px-1">
          <span>Active Company Inboxes ({accounts.filter((a) => !a.deletedAt).length})</span>
          <span>Managed via RealtyMail REST API</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-zinc-400 space-y-2">
            <ArrowCounterClockwise className="animate-spin inline-block" size={18} />
            <p>Loading enterprise mailboxes…</p>
          </div>
        ) : (
          configured && (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
              {accounts.length === 0 && (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  <EnvelopeSimple size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="font-bold text-zinc-700 dark:text-zinc-300">No staff mailboxes created yet</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Use the form above to provision company email addresses.</p>
                </div>
              )}

              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:px-5 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  {/* Account Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 border shadow-2xs ${
                      a.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-200 border-purple-200/80 dark:border-purple-800/70'
                        : 'bg-blue-100 text-[#0066cc] dark:bg-blue-950/80 dark:text-blue-200 border-blue-200/80 dark:border-blue-800/70'
                    }`}>
                      {getInitials(a.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 font-mono truncate" title={a.email}>
                          {a.email}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(a.email, `email-${a.id}`)}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                          title="Copy email address"
                        >
                          {copiedKey === `email-${a.id}` ? (
                            <Check size={12} weight="bold" className="text-emerald-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                        {a.name && <span className="font-medium text-zinc-700 dark:text-zinc-300">{a.name} ·</span>}
                        <span className="capitalize">{a.isPrimaryAdmin ? 'Primary Admin' : a.role === 'admin' ? 'Admin' : 'Staff User'}</span>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        {a.deletedAt ? (
                          <span className="inline-flex items-center gap-1 font-bold text-zinc-500 dark:text-zinc-400" title="Restore it from the RealtyMail dashboard before then">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            Deleted · restorable until {restorableUntil(a.deletedAt).toLocaleDateString()}
                          </span>
                        ) : a.disabled ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Disabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                        {a.lastSignInAt && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="hidden md:inline text-zinc-400" title={new Date(a.lastSignInAt).toLocaleString()}>
                              Active {formatDistanceToNow(new Date(a.lastSignInAt), { addSuffix: true })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    {a.role === 'user' && !a.deletedAt && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => void reset(a)}
                          className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs active:scale-[0.98]"
                          title="Generate a new temporary password and sign out of all active sessions"
                        >
                          <Key size={13} weight="bold" className="text-amber-600 dark:text-amber-400" />
                          <span>Reset Password</span>
                        </button>

                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => void toggle(a)}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs active:scale-[0.98] ${
                            a.disabled
                              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                              : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-amber-600'
                          }`}
                          title={a.disabled ? 'Re-enable mailbox login with a new password' : 'Disable mailbox and scramble password'}
                        >
                          {a.disabled ? <ArrowCounterClockwise size={13} weight="bold" /> : <Prohibit size={13} weight="bold" />}
                          <span>{a.disabled ? 'Re-enable' : 'Disable'}</span>
                        </button>

                        {/* Direct Mailbox Delete Button */}
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => openDeleteModal(a)}
                          className="p-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-50"
                          title="Delete mailbox (restorable in RealtyMail for 20 days)"
                        >
                          <Trash size={14} weight="bold" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Handover Credentials Modal (1Password / Vault Grade) ──────── */}
      {handover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} weight="bold" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  Handover Mailbox Credentials
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Transmit these details securely to the account owner
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Email Address</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">{handover.email}</span>
                  <button
                    type="button"
                    onClick={() => copyText(handover.email, 'h-email')}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {copiedKey === 'h-email' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Temporary Password (Shown Once)</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-extrabold text-[#0066cc] dark:text-blue-400 select-all">{handover.password}</span>
                  <button
                    type="button"
                    onClick={() => copyText(handover.password, 'h-pass')}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {copiedKey === 'h-pass' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Webmail URL</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{handover.webmailUrl}</span>
                  <button
                    type="button"
                    onClick={() => copyText(handover.webmailUrl, 'h-url')}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {copiedKey === 'h-url' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-200/50 dark:border-blue-900/50">
              🔒 <strong>Security Notice:</strong> Passwords are not saved or retrievable after closing this window. Advise staff to sign in immediately, update their password, and configure 2FA.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => void copyFullHandover()}
                className="px-4 py-2 rounded-xl bg-[#0066cc] hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                {copiedKey === 'handover-full' ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
                <span>{copiedKey === 'handover-full' ? 'Copied All!' : 'Copy Full Details'}</span>
              </button>
              <button
                type="button"
                onClick={() => setHandover(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mailbox Delete Confirmation Modal ──────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash size={20} weight="bold" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Delete Staff Mailbox
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Signs out now, purged after {RESTORE_DAYS} days
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {deleteError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                <WarningCircle size={16} weight="bold" className="text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-0.5">
                  <p className="font-bold">Delete Request Rejected</p>
                  <p className="text-[11px] font-normal leading-relaxed text-rose-600 dark:text-rose-300/90">{deleteError}</p>
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Mailbox:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{deleteTarget.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Name:</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{deleteTarget.name || 'Staff User'}</span>
              </div>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to delete <strong className="text-zinc-800 dark:text-zinc-200">{deleteTarget.email}</strong>? They are signed out at once. RealtyMail keeps the account restorable from its dashboard for {RESTORE_DAYS} days, then permanently erases it with all its mail.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteMailbox}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <ArrowCounterClockwise size={14} className="animate-spin" /> : <Trash size={14} weight="bold" />}
                <span>{isDeleting ? 'Deleting…' : 'Delete Mailbox'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}
