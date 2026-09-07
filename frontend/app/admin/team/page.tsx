'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminFetch } from '@/lib/adminFetch'

type Role = 'SUPER_ADMIN' | 'ANALYST' | 'SALES' | 'BUILDER' | 'PARTNER'

interface AdminRow {
  id: string
  email: string
  role: Role
  builder_id: string | null
  partner_id: string | null
  linked_supabase_user_id: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  invite_pending: boolean
  builder?: { name: string } | null
  partner?: { name: string } | null
}

const ROLES: Role[] = ['SUPER_ADMIN', 'ANALYST', 'SALES', 'BUILDER', 'PARTNER']

/**
 * Super-admin-only. Two ways to add someone: invite by email (they set their
 * own password via the link this returns), or promote an existing buyer by
 * their Supabase user id (no separate password — they already have one).
 *
 * Server-enforced (adminTeam.ts requires SUPER_ADMIN); this page does not
 * duplicate that check beyond showing an honest error if the call is
 * refused, since only a real admin session can even reach it.
 */
export default function AdminTeamPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'invite' | 'promote' | null>(null)
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('ANALYST')
  const [builderId, setBuilderId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [supabaseUserId, setSupabaseUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await adminFetch('/admin/team')
    if (res.status === 403) {
      setError('Your admin account does not have super-admin access.')
      setLoading(false)
      return
    }
    if (!res.ok) {
      setError('Could not load the team list.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setAdmins(data.admins ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await adminFetch('/admin/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, role,
        builder_id: role === 'BUILDER' ? builderId : undefined,
        partner_id: role === 'PARTNER' ? partnerId : undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Could not create the invite.')
      return
    }
    const data = await res.json()
    setLastInviteUrl(data.inviteUrl)
    setEmail(''); setBuilderId(''); setPartnerId(''); setMode(null)
    load()
  }

  async function submitPromote(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await adminFetch('/admin/team/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabase_user_id: supabaseUserId, email, role,
        builder_id: role === 'BUILDER' ? builderId : undefined,
        partner_id: role === 'PARTNER' ? partnerId : undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Could not promote this user.')
      return
    }
    setEmail(''); setSupabaseUserId(''); setBuilderId(''); setPartnerId(''); setMode(null)
    load()
  }

  async function toggleActive(admin: AdminRow) {
    const res = await adminFetch(`/admin/team/${admin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !admin.is_active }),
    })
    if (res.ok) load()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Team</h1>
          <p className="text-sm text-zinc-500">Who has admin access, and at what role.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode(mode === 'invite' ? null : 'invite')}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold"
          >
            Invite by email
          </button>
          <button
            onClick={() => setMode(mode === 'promote' ? null : 'promote')}
            className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold"
          >
            Add existing user
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {lastInviteUrl && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-700 dark:text-emerald-400 break-all">
          Invite created. Send this link to them yourself (no email is wired up yet): {lastInviteUrl}
        </div>
      )}

      {mode === 'invite' && (
        <form onSubmit={submitInvite} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm" />
          <RoleAndScope role={role} setRole={setRole} builderId={builderId} setBuilderId={setBuilderId} partnerId={partnerId} setPartnerId={setPartnerId} />
          <button disabled={submitting} type="submit" className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create invite'}
          </button>
        </form>
      )}

      {mode === 'promote' && (
        <form onSubmit={submitPromote} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <input required placeholder="Supabase user id" value={supabaseUserId} onChange={(e) => setSupabaseUserId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm" />
          <input required type="email" placeholder="Their email (for display)" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm" />
          <RoleAndScope role={role} setRole={setRole} builderId={builderId} setBuilderId={setBuilderId} partnerId={partnerId} setPartnerId={setPartnerId} />
          <button disabled={submitting} type="submit" className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold disabled:opacity-50">
            {submitting ? 'Granting…' : 'Grant admin access'}
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Scope</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Last login</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center text-zinc-400">Loading…</td></tr>}
            {!loading && admins.length === 0 && !error && (
              <tr><td colSpan={6} className="p-6 text-center text-zinc-400">No admins yet — invite the first one above.</td></tr>
            )}
            {admins.map((a) => (
              <tr key={a.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-3">{a.email}{a.invite_pending && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">invite pending</span>}</td>
                <td className="p-3">{a.role}</td>
                <td className="p-3 text-zinc-500">{a.builder?.name || a.partner?.name || '—'}</td>
                <td className="p-3">{a.is_active ? <span className="text-emerald-600">Active</span> : <span className="text-zinc-400">Deactivated</span>}</td>
                <td className="p-3 text-zinc-500">{a.last_login_at ? new Date(a.last_login_at).toLocaleDateString() : 'Never'}</td>
                <td className="p-3 text-right">
                  <button onClick={() => toggleActive(a)} className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                    {a.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoleAndScope({
  role, setRole, builderId, setBuilderId, partnerId, setPartnerId,
}: {
  role: Role; setRole: (r: Role) => void
  builderId: string; setBuilderId: (v: string) => void
  partnerId: string; setPartnerId: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <select value={role} onChange={(e) => setRole(e.target.value as Role)}
        className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm">
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {role === 'BUILDER' && (
        <input required placeholder="Builder id (from /admin/builders)" value={builderId} onChange={(e) => setBuilderId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm" />
      )}
      {role === 'PARTNER' && (
        <input required placeholder="Channel partner id" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm" />
      )}
    </div>
  )
}
