'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminFetch'
import { EnvelopeSimple, Plus, Copy, Check, Key, Prohibit, ArrowCounterClockwise } from '@phosphor-icons/react'

interface MailAccount {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  disabled: boolean
  lastSignInAt: string | null
}

interface Handover {
  email: string
  password: string
  webmailUrl: string
}

const WEBMAIL_URL = 'https://mail.realtyask.in'
const BTN = 'px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5'

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
  const [busyId, setBusyId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [handover, setHandover] = useState<Handover | null>(null)
  const [copied, setCopied] = useState(false)

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

  useEffect(() => { void load() }, [load])

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
    void load()
  }

  async function reset(a: MailAccount) {
    if (!window.confirm(`Reset the password for ${a.email}? They will be signed out everywhere.`)) return
    const data = await run(a.id, `/admin/team/mailboxes/${a.id}/reset-password`, { method: 'POST', body: '{}' })
    if (data) setHandover({ email: a.email, password: String(data.password), webmailUrl: WEBMAIL_URL })
  }

  async function toggle(a: MailAccount) {
    const next = !a.disabled
    if (next && !window.confirm(`Disable ${a.email}? They are signed out and cannot sign in until re-enabled.`)) return
    const data = await run(a.id, `/admin/team/mailboxes/${a.id}`, { method: 'PATCH', body: JSON.stringify({ disabled: next }) })
    if (data) void load()
  }

  async function copyHandover() {
    if (!handover) return
    const text = `Email: ${handover.email}\nTemporary password: ${handover.password}\nSign in: ${handover.webmailUrl}\nChange your password and turn on 2FA at first login.`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Select the text manually.')
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <EnvelopeSimple size={18} weight="bold" className="text-[#0066cc]" />
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Staff mailboxes</h2>
        <span className="text-xs text-zinc-500">@{domain} — internal staff only</span>
      </div>

      {!configured && (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          Mail service is not connected. Set REALTYMAIL_URL and REALTYMAIL_ADMIN_API_KEY on the backend.
        </p>
      )}
      {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

      {configured && (
        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Address
            <span className="mt-1 flex items-center">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="firstname"
                required
                maxLength={64}
                className="w-40 rounded-l-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs"
              />
              <span className="rounded-r-xl border border-l-0 border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-500">@{domain}</span>
            </span>
          </label>
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="optional"
              maxLength={100}
              className="mt-1 block w-44 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs"
            />
          </label>
          <button
            type="submit"
            disabled={creating || !username.trim()}
            className="flex items-center gap-1.5 bg-[#0066cc] hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            <Plus size={15} weight="bold" />
            <span>{creating ? 'Creating…' : 'Provision mailbox'}</span>
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-zinc-500">Loading…</p>
      ) : (
        configured && (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {accounts.length === 0 && <li className="py-3 text-xs text-zinc-500">No mailboxes managed from here yet.</li>}
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{a.email}</p>
                  <p className="text-xs text-zinc-500">
                    {a.name} · {a.role === 'admin' ? 'admin' : 'user'}
                    {a.disabled && <span className="ml-1.5 font-bold text-rose-600">· disabled</span>}
                  </p>
                </div>
                {a.role === 'user' && (
                  <div className="flex gap-2">
                    <button type="button" className={BTN} disabled={busyId === a.id} onClick={() => void reset(a)}>
                      <Key size={14} weight="bold" /> Reset password
                    </button>
                    <button type="button" className={BTN} disabled={busyId === a.id} onClick={() => void toggle(a)}>
                      {a.disabled ? <ArrowCounterClockwise size={14} weight="bold" /> : <Prohibit size={14} weight="bold" />}
                      {a.disabled ? 'Re-enable' : 'Disable'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {handover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-xl">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Send these details privately</h3>
            <pre className="whitespace-pre-wrap break-all rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3 text-xs text-zinc-800 dark:text-zinc-200 select-text">
{`Email: ${handover.email}
Temporary password: ${handover.password}
Sign in: ${handover.webmailUrl}`}
            </pre>
            <p className="text-xs text-zinc-500">
              This password is shown once and is not stored. They should change it and turn on 2FA at first login. The mail service does not force this.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className={BTN} onClick={() => void copyHandover()}>
                {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" className={BTN} onClick={() => setHandover(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
