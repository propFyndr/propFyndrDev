'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { SelectOption } from '@/components/admin/CustomSelect'
import EmailPreviewModal from '@/components/admin/EmailPreviewModal'
import {
  Users,
  UserCheck,
  Clock,
  Building2,
  Shield,
  Search,
  Plus,
  Mail,
  Share2,
  Check,
  RotateCcw,
  Sparkles,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  X,
  Copy,
  MessageCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin (Full Access)', dotColor: 'bg-purple-500' },
  { value: 'ANALYST', label: 'Analyst (Intelligence & Catalog)', dotColor: 'bg-blue-500' },
  { value: 'SALES', label: 'Sales (Leads & CRM)', dotColor: 'bg-emerald-500' },
  { value: 'BUILDER', label: 'Builder (Scoped Partner)', dotColor: 'bg-amber-500' },
  { value: 'PARTNER', label: 'Channel Partner (Agent)', dotColor: 'bg-rose-500' },
]

export default function AdminTeamPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [buildersList, setBuildersList] = useState<Array<{ id: string; name: string }>>([])
  const [partnersList, setPartnersList] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Modals & Flows
  const [mode, setMode] = useState<'invite' | 'promote' | null>(null)
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
  const [lastInvitedEmail, setLastInvitedEmail] = useState<string>('')
  const [lastInvitedRole, setLastInvitedRole] = useState<string>('ANALYST')

  // Email Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<'team_invite' | 'builder_pitch'>('team_invite')
  const [previewTargetEmail, setPreviewTargetEmail] = useState('')
  const [previewTargetName, setPreviewTargetName] = useState('')
  const [previewTargetRole, setPreviewTargetRole] = useState('ANALYST')
  const [previewTargetLink, setPreviewTargetLink] = useState('')

  // Form Fields
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('ANALYST')
  const [builderId, setBuilderId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [supabaseUserId, setSupabaseUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setIsRefreshing(true)
    setError('')
    try {
      const [res, bRes, pRes] = await Promise.all([
        adminFetch('/admin/team'),
        adminFetch('/admin/builders').catch(() => null),
        adminFetch('/admin/channel-partners').catch(() => null),
      ])

      if (res.status === 403) {
        setError('Your admin account does not have super-admin privileges to manage team roles.')
        return
      }
      if (!res.ok) {
        setError('Could not load admin team members.')
        return
      }
      const data = await res.json()
      setAdmins(data.admins ?? [])

      if (bRes && bRes.ok) {
        const bData = await bRes.json()
        setBuildersList(
          (bData.builders || []).map((b: any) => ({
            id: b.id,
            name: b.name || b.company_name || 'Unnamed Builder',
          }))
        )
      }

      if (pRes && pRes.ok) {
        const pData = await pRes.json()
        // Only an approved partner can be given a login — inviting someone into
        // an unapproved firm would hand them a portal the server will refuse.
        setPartnersList(
          (pData.partners || [])
            .filter((p: any) => p.status === 'approved')
            .map((p: any) => ({
              id: p.id,
              name: p.builder?.name ? `${p.name} — ${p.builder.name}` : p.name,
            }))
        )
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with administration gateway')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // KPI calculations
  const kpis = useMemo(() => {
    const total = admins.length
    const active = admins.filter((a) => a.is_active).length
    const pending = admins.filter((a) => a.invite_pending).length
    const scoped = admins.filter((a) => a.builder_id || a.partner_id).length
    return { total, active, pending, scoped }
  }, [admins])

  // Filtered rows
  const filteredAdmins = useMemo(() => {
    return admins.filter((a) => {
      // Search match
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        a.email.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        (a.builder?.name && a.builder.name.toLowerCase().includes(q)) ||
        (a.partner?.name && a.partner.name.toLowerCase().includes(q))

      // Role match
      const matchesRole = roleFilter === 'ALL' || a.role === roleFilter

      // Status match
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && a.is_active && !a.invite_pending) ||
        (statusFilter === 'PENDING' && a.invite_pending) ||
        (statusFilter === 'DEACTIVATED' && !a.is_active)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [admins, searchQuery, roleFilter, statusFilter])

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await adminFetch('/admin/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          builder_id: role === 'BUILDER' ? builderId : undefined,
          partner_id: role === 'PARTNER' ? partnerId : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not create the invite.')
        setSubmitting(false)
        return
      }
      const data = await res.json()
      setLastInviteUrl(data.inviteUrl)
      setLastInvitedEmail(email)
      setLastInvitedRole(role)
      setSuccessToast(`Invite generated for ${email}!`)
      setTimeout(() => setSuccessToast(''), 6000)

      setEmail('')
      setBuilderId('')
      setPartnerId('')
      setMode(null)
      load(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to submit invitation')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitPromote(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await adminFetch('/admin/team/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_user_id: supabaseUserId,
          email,
          role,
          builder_id: role === 'BUILDER' ? builderId : undefined,
          partner_id: role === 'PARTNER' ? partnerId : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not promote this user.')
        setSubmitting(false)
        return
      }
      setSuccessToast(`Granted ${role} privileges to ${email}!`)
      setTimeout(() => setSuccessToast(''), 5000)

      setEmail('')
      setSupabaseUserId('')
      setBuilderId('')
      setPartnerId('')
      setMode(null)
      load(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to promote user')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(admin: AdminRow) {
    try {
      const res = await adminFetch(`/admin/team/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !admin.is_active }),
      })
      if (res.ok) {
        setSuccessToast(`Account ${admin.is_active ? 'deactivated' : 'reactivated'} successfully`)
        setTimeout(() => setSuccessToast(''), 4000)
        load(true)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Could not update status')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update account')
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openEmailPreview = (
    templateType: 'team_invite' | 'builder_pitch',
    targetEmail: string,
    targetName: string,
    targetRole: string,
    inviteLinkText: string
  ) => {
    setPreviewTemplate(templateType)
    setPreviewTargetEmail(targetEmail)
    setPreviewTargetName(targetName)
    setPreviewTargetRole(targetRole)
    setPreviewTargetLink(inviteLinkText)
    setIsPreviewOpen(true)
  }

  const getRoleBadgeStyle = (r: Role) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/80'
      case 'ANALYST':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80'
      case 'SALES':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80'
      case 'BUILDER':
        return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80'
      case 'PARTNER':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80'
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
    }
  }

  const getInitials = (str: string) => {
    const parts = str.split('@')[0].split(/[._-]/)
    return (parts[0]?.[0] || 'A') + (parts[1]?.[0] || parts[0]?.[1] || '').toUpperCase()
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans select-none min-w-0">
      
      {/* ── Header Banner ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Admin Team & Roles
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Access Control
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Manage administrative permissions, invite colleagues, and monitor system access tiers
          </p>
        </div>

        {/* Top Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              openEmailPreview(
                'team_invite',
                email || 'teammate@propfyndr.in',
                'Colleague',
                role,
                lastInviteUrl || ''
              )
            }
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-800 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            title="Preview how invite and outreach emails render"
          >
            <Mail size={15} className="text-blue-600 dark:text-blue-400" />
            <span>Email Preview</span>
          </button>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200/90 dark:border-zinc-800 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh team list"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-zinc-500'} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'promote' ? null : 'promote')}
            className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
          >
            <Users size={14} />
            <span>Promote Buyer</span>
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'invite' ? null : 'invite')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <Plus size={15} />
            <span>Invite by Email</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Administrators */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Administrators
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Shield size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
            {kpis.total}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>Super Admins & Staff</span>
          </div>
        </div>

        {/* Active Accounts */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Active Access
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
            {kpis.active}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Operational users</span>
          </div>
        </div>

        {/* Pending Invites */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Pending Invites
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
            {kpis.pending}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Awaiting first login</span>
          </div>
        </div>

        {/* Scoped Partners & Builders */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Scoped Accounts
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Building2 size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
            {kpis.scoped}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Builder / Agent restricted</span>
          </div>
        </div>
      </div>

      {/* ── Feedback & Alert Banners ─────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X size={15} />
          </button>
        </div>
      )}

      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast('')} className="text-emerald-500 hover:text-emerald-700">
            <X size={15} />
          </button>
        </div>
      )}

      {lastInviteUrl && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-50/90 to-indigo-50/70 dark:from-blue-950/40 dark:to-zinc-900 border border-blue-200/80 dark:border-blue-900/60 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <h4 className="text-xs font-extrabold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                Invite Link Created for {lastInvitedEmail}
              </h4>
            </div>
            <button
              onClick={() =>
                openEmailPreview(
                  'team_invite',
                  lastInvitedEmail,
                  lastInvitedEmail.split('@')[0],
                  lastInvitedRole,
                  lastInviteUrl
                )
              }
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs"
            >
              <Mail size={13} />
              <span>Preview Email & WhatsApp Format</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={lastInviteUrl}
              className="flex-1 px-3.5 py-2 rounded-xl border border-blue-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-200 select-all outline-none"
            />
            <button
              onClick={() => copyToClipboard(lastInviteUrl, 'banner-link')}
              className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 font-bold text-xs flex items-center gap-1.5 shrink-0"
            >
              {copiedId === 'banner-link' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedId === 'banner-link' ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Inline Invite / Promote Cards ────────────────────────────── */}
      {mode === 'invite' && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-blue-200/90 dark:border-blue-900/60 p-6 shadow-md space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Plus size={16} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Invite New Administrator
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  They will receive a secure token to establish credentials and access the console
                </p>
              </div>
            </div>
            <button
              onClick={() => setMode(null)}
              className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={submitInvite} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  placeholder="colleague@propfyndr.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Select Role & Privileges
                </label>
                <CustomSelect
                  value={role}
                  onChange={(v) => setRole(v as Role)}
                  options={ROLE_OPTIONS}
                  size="md"
                />
              </div>
            </div>

            {/* Role scope inputs if BUILDER or PARTNER */}
            {role === 'BUILDER' && (
              <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-4 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Target Builder Organization
                </label>
                {buildersList.length > 0 ? (
                  <CustomSelect
                    value={builderId}
                    onChange={(v) => setBuilderId(v)}
                    options={buildersList.map((b) => ({ value: b.id, label: b.name }))}
                    placeholder="Choose builder from registered catalog…"
                    size="md"
                  />
                ) : (
                  <input
                    required
                    placeholder="Builder UUID (from /admin/builders)"
                    value={builderId}
                    onChange={(e) => setBuilderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                  />
                )}
              </div>
            )}

            {role === 'PARTNER' && (
              <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 p-4 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                  Channel Partner Firm
                </label>
                {partnersList.length > 0 ? (
                  <CustomSelect
                    value={partnerId}
                    onChange={(v) => setPartnerId(v)}
                    options={partnersList.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Choose an approved channel partner…"
                    size="md"
                  />
                ) : (
                  <p className="text-xs font-medium text-rose-900/80 dark:text-rose-200/80">
                    No approved channel partners yet — approve one under Partners first.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() =>
                  openEmailPreview(
                    'team_invite',
                    email || 'colleague@propfyndr.in',
                    email.split('@')[0] || 'Teammate',
                    role,
                    ''
                  )
                }
                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline cursor-pointer"
              >
                <Mail size={13} />
                <span>Preview Email Before Sending</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting || !email}
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Generating Invite…' : 'Generate & Send Invite'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {mode === 'promote' && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-purple-200/90 dark:border-purple-900/60 p-6 shadow-md space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Users size={16} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Promote Registered User to Admin
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Grant console access to an existing Supabase user account directly
                </p>
              </div>
            </div>
            <button
              onClick={() => setMode(null)}
              className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={submitPromote} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Supabase User ID (UUID)
                </label>
                <input
                  required
                  placeholder="e.g. 550e8400-e29b-41d4-a716..."
                  value={supabaseUserId}
                  onChange={(e) => setSupabaseUserId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Their Registered Email
                </label>
                <input
                  required
                  type="email"
                  placeholder="user@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Assigned Privileges
                </label>
                <CustomSelect
                  value={role}
                  onChange={(v) => setRole(v as Role)}
                  options={ROLE_OPTIONS}
                  size="md"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={submitting || !supabaseUserId || !email}
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Promoting…' : 'Grant Admin Privileges'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Search & Filter Controls ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search administrator by email, role, or organization…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500 shadow-2xs outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Segmented Filter Bar & Status Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Role Tabs */}
          <div className="flex items-center p-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs text-xs font-semibold overflow-x-auto">
            {['ALL', 'SUPER_ADMIN', 'ANALYST', 'SALES', 'BUILDER', 'PARTNER'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  roleFilter === r
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {r === 'ALL'
                  ? 'All Roles'
                  : r === 'SUPER_ADMIN'
                  ? 'Super Admin'
                  : r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Status Dropdown */}
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active', dotColor: 'bg-emerald-500' },
              { value: 'PENDING', label: 'Pending Invite', dotColor: 'bg-amber-500' },
              { value: 'DEACTIVATED', label: 'Deactivated', dotColor: 'bg-zinc-400' },
            ]}
            size="md"
            className="w-40"
          />
        </div>
      </div>

      {/* ── Administrators Table ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 dark:bg-zinc-800/50 border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Administrator</th>
                <th className="py-3.5 px-4">Privilege Role</th>
                <th className="py-3.5 px-4">Organization Scope</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    <RotateCcw className="animate-spin inline-block mr-2" size={16} />
                    Loading administrator directory…
                  </td>
                </tr>
              )}

              {!loading && filteredAdmins.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-400">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mx-auto flex items-center justify-center text-zinc-400 mb-3">
                      <Users size={24} />
                    </div>
                    <p className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">No administrators match your filters</p>
                    <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                      Adjust your search query or role filter, or invite a new team member above.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                filteredAdmins.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors group"
                  >
                    {/* Administrator column */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 border border-zinc-200/80 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {getInitials(a.email)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-[13px]">
                              {a.email}
                            </span>
                            {a.invite_pending && (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80 shrink-0">
                                Invite Pending
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            ID: {a.id.slice(0, 8)}…
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role column */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-2xs ${getRoleBadgeStyle(
                          a.role
                        )}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {a.role}
                      </span>
                    </td>

                    {/* Scope column */}
                    <td className="py-4 px-4">
                      {a.builder?.name ? (
                        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                          <Building2 size={13} className="text-amber-500 shrink-0" />
                          <span className="font-semibold">{a.builder.name}</span>
                        </div>
                      ) : a.partner?.name ? (
                        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                          <Users size={13} className="text-rose-500 shrink-0" />
                          <span className="font-semibold">{a.partner.name}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 font-normal">Global Platform</span>
                      )}
                    </td>

                    {/* Status column */}
                    <td className="py-4 px-4">
                      {a.is_active ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-zinc-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-zinc-400" />
                          <span>Deactivated</span>
                        </div>
                      )}
                    </td>

                    {/* Last activity */}
                    <td className="py-4 px-4 text-zinc-500 dark:text-zinc-400">
                      {a.last_login_at ? (
                        <span title={new Date(a.last_login_at).toLocaleString()}>
                          {formatDistanceToNow(new Date(a.last_login_at), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-normal italic">Never logged in</span>
                      )}
                    </td>

                    {/* Actions column */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Email Preview button for this user */}
                        <button
                          type="button"
                          onClick={() =>
                            openEmailPreview(
                              'team_invite',
                              a.email,
                              a.email.split('@')[0],
                              a.role,
                              lastInviteUrl || ''
                            )
                          }
                          className="p-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-blue-600 transition-all cursor-pointer"
                          title="Preview onboarding email for this role"
                        >
                          <Mail size={14} />
                        </button>

                        {/* Toggle active button */}
                        <button
                          type="button"
                          onClick={() => toggleActive(a)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer ${
                            a.is_active
                              ? 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200'
                              : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                          }`}
                        >
                          {a.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Email Preview Modal ──────────────────────────────────────── */}
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        initialTemplate={previewTemplate}
        defaultRecipientEmail={previewTargetEmail}
        defaultRecipientName={previewTargetName}
        defaultRole={previewTargetRole}
        inviteLink={previewTargetLink}
      />
    </div>
  )
}
