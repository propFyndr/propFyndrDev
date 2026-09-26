'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { adminFetch } from '@/lib/adminFetch'
import CustomSelect, { SelectOption } from '@/components/admin/CustomSelect'
import EmailPreviewModal from '@/components/admin/EmailPreviewModal'
import { MetricCard, MetricCardSkeleton } from '@/components/admin/ui/MetricCard'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import {
  ShieldCheck,
  UserCheck,
  Clock,
  Buildings,
  Copy,
  Check,
  Trash,
  ArrowsClockwise,
  Plus,
  MagnifyingGlass,
  EnvelopeSimple,
  Shield,
  Info,
  ArrowRight,
  X,
  UserPlus,
  Users,
  Handshake,
  Key,
  PaperPlaneTilt,
  LockKey,
  Eye
} from '@phosphor-icons/react'
import { RotateCcw } from 'lucide-react'
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
  { value: 'SUPER_ADMIN', label: 'Super Admin (Full Platform Control)', dotColor: 'bg-purple-500' },
  { value: 'ANALYST', label: 'Analyst (Intelligence & Catalog)', dotColor: 'bg-blue-500' },
  { value: 'SALES', label: 'Sales (Leads, Outreach & CRM)', dotColor: 'bg-emerald-500' },
  { value: 'BUILDER', label: 'Builder (Scoped Developer Account)', dotColor: 'bg-amber-500' },
  { value: 'PARTNER', label: 'Channel Partner (Authorized Broker)', dotColor: 'bg-rose-500' },
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
  const [lastInviteEmailed, setLastInviteEmailed] = useState(false)
  const [lastInvitedEmail, setLastInvitedEmail] = useState<string>('')
  const [lastInvitedRole, setLastInvitedRole] = useState<string>('ANALYST')

  // Email Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<'team_invite' | 'builder_pitch'>('team_invite')
  const [previewTargetEmail, setPreviewTargetEmail] = useState('')
  const [previewTargetName, setPreviewTargetName] = useState('')
  const [previewTargetRole, setPreviewTargetRole] = useState('ANALYST')
  const [previewTargetLink, setPreviewTargetLink] = useState('')

  // Deletion Modal State
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Form Fields
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('ANALYST')
  const [builderId, setBuilderId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [supabaseUserId, setSupabaseUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fetchingInviteId, setFetchingInviteId] = useState<string | null>(null)

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
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        a.email.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        (a.builder?.name && a.builder.name.toLowerCase().includes(q)) ||
        (a.partner?.name && a.partner.name.toLowerCase().includes(q))

      const matchesRole = roleFilter === 'ALL' || a.role === roleFilter

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
    if (role === 'BUILDER' && !builderId) {
      setError('Please choose a target builder organization from the catalog.')
      return
    }
    if (role === 'PARTNER' && !partnerId) {
      setError('Please choose an approved channel partner firm.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await adminFetch('/admin/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          role,
          builder_id: role === 'BUILDER' && builderId ? builderId : undefined,
          partner_id: role === 'PARTNER' && partnerId ? partnerId : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const fieldErrors = (data?.details?.fieldErrors as Record<string, string[]> | undefined)
        const firstFieldErr = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : null
        const detailedErr = (data?.error as string) || firstFieldErr
        setError(detailedErr || 'Could not create the invite.')
        setSubmitting(false)
        return
      }
      const data = await res.json()
      setLastInviteUrl(data.inviteUrl)
      setLastInviteEmailed(Boolean(data.emailed))
      setLastInvitedEmail(email)
      setLastInvitedRole(role)
      setSuccessToast(
        data.emailed
          ? `Invite emailed to ${email}.`
          : `Invite link created for ${email}. Email was not delivered; copy the link below.`
      )
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
    if (role === 'BUILDER' && !builderId) {
      setError('Please choose a target builder organization from the catalog.')
      return
    }
    if (role === 'PARTNER' && !partnerId) {
      setError('Please choose an approved channel partner firm.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await adminFetch('/admin/team/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_user_id: supabaseUserId.trim(),
          email: email.trim(),
          role,
          builder_id: role === 'BUILDER' && builderId ? builderId : undefined,
          partner_id: role === 'PARTNER' && partnerId ? partnerId : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const fieldErrors = (data?.details?.fieldErrors as Record<string, string[]> | undefined)
        const firstFieldErr = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : null
        const detailedErr = (data?.error as string) || firstFieldErr
        setError(detailedErr || 'Could not promote this user.')
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

  const executeDeleteAdmin = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setError('')
    try {
      const res = await adminFetch(`/admin/team/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not delete administrator.')
        return
      }
      setSuccessToast(data.message || `Admin ${deleteTarget.email} was removed successfully.`)
      setTimeout(() => setSuccessToast(''), 4000)
      setDeleteTarget(null)
      load(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to delete administrator.')
    } finally {
      setIsDeleting(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const fetchLiveInviteLink = async (adminId: string): Promise<string | null> => {
    try {
      const res = await adminFetch(`/admin/team/${adminId}/resend-invite`, { method: 'POST' })
      if (!res.ok) return null
      const data = await res.json()
      return data.inviteUrl || null
    } catch {
      return null
    }
  }

  const copyPendingInviteLink = async (a: AdminRow) => {
    setFetchingInviteId(a.id)
    try {
      const link = await fetchLiveInviteLink(a.id)
      if (link) {
        navigator.clipboard.writeText(link)
        setCopiedId(`invite-${a.id}`)
        setSuccessToast(`Invite link copied to clipboard for ${a.email}!`)
        setTimeout(() => {
          setCopiedId(null)
          setSuccessToast('')
        }, 4000)
      } else {
        setError(`Could not retrieve invite link for ${a.email}`)
      }
    } catch {
      setError(`Failed to copy invite link for ${a.email}`)
    } finally {
      setFetchingInviteId(null)
    }
  }

  const handleOpenEmailPreviewForAdmin = async (a: AdminRow) => {
    let link = ''
    if (a.invite_pending) {
      setFetchingInviteId(a.id)
      link = (await fetchLiveInviteLink(a.id)) || ''
      setFetchingInviteId(null)
    }
    openEmailPreview(
      'team_invite',
      a.email,
      a.email.split('@')[0],
      a.role,
      link || lastInviteUrl || ''
    )
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
        return 'bg-purple-50 text-purple-700 border-purple-200/90 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/80'
      case 'ANALYST':
        return 'bg-blue-50 text-[#0066cc] border-blue-200/90 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/80'
      case 'SALES':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/90 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80'
      case 'BUILDER':
        return 'bg-amber-50 text-amber-700 border-amber-200/90 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80'
      case 'PARTNER':
        return 'bg-rose-50 text-rose-700 border-rose-200/90 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/80'
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
    }
  }

  const getAvatarStyle = (r: Role) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-200 border-purple-200/80 dark:border-purple-800/60'
      case 'ANALYST':
        return 'bg-blue-100 text-[#0066cc] dark:bg-blue-950/80 dark:text-blue-200 border-blue-200/80 dark:border-blue-800/60'
      case 'SALES':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-200/80 dark:border-emerald-800/60'
      case 'BUILDER':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-amber-200/80 dark:border-amber-800/60'
      case 'PARTNER':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border-rose-200/80 dark:border-rose-800/60'
      default:
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
    }
  }

  // Proper uppercase enterprise initials (Fixes bU, sY bug)
  const getInitials = (str: string) => {
    if (!str) return 'AD'
    const namePart = str.split('@')[0]
    const segments = namePart.split(/[._-]/).filter(Boolean)
    if (segments.length >= 2) {
      return (segments[0][0] + segments[1][0]).toUpperCase()
    }
    return namePart.slice(0, 2).toUpperCase()
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans select-none min-w-0">
      
      {/* ── Apple-Style Header Banner ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Admin Team & Permissions
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] animate-pulse" />
              Access Control Console
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Manage administrative privileges, dispatch cryptographic invite tokens, scope developer access, and revoke credentials in real time.
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
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            title="Preview onboarding email layout"
          >
            <EnvelopeSimple size={15} weight="bold" className="text-[#0066cc]" />
            <span>Email Preview</span>
          </button>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-800 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh administrator directory"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-[#0066cc]' : 'text-zinc-500'} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('promote')}
            className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 text-zinc-900 dark:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer border border-zinc-200/60 dark:border-zinc-700/60"
          >
            <UserPlus size={15} weight="bold" />
            <span>Promote Buyer</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('invite')}
            className="flex items-center gap-1.5 bg-[#0066cc] hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <Plus size={15} weight="bold" />
            <span>Invite by Email</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards Grid (Apple HIG MetricCard) ───────────────── */}
      {loading ? (
        <MetricCardSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            title="Total Staff"
            value={kpis.total}
            subBadge="Super Admins & Staff"
            subBadgeVariant="violet"
            icon={ShieldCheck}
            iconColorClass="text-purple-600 dark:text-purple-400"
            iconBgClass="bg-purple-50 dark:bg-purple-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Total Staff"
                description="Total active and pending administrative personnel registered on the platform."
              />
            }
          />
          <MetricCard
            title="Active Access"
            value={kpis.active}
            subBadge="Operational users"
            subBadgeVariant="emerald"
            icon={UserCheck}
            iconColorClass="text-emerald-600 dark:text-emerald-400"
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Active Access"
                description="Team members with active login sessions and valid authorization grants."
              />
            }
          />
          <MetricCard
            title="Pending Invites"
            value={kpis.pending}
            subBadge="Awaiting first login"
            subBadgeVariant="amber"
            icon={Clock}
            iconColorClass="text-amber-600 dark:text-amber-400"
            iconBgClass="bg-amber-50 dark:bg-amber-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Pending Invites"
                description="Cryptographic invitations dispatched that have not yet been claimed by the recipient."
              />
            }
          />
          <MetricCard
            title="Scoped Accounts"
            value={kpis.scoped}
            subBadge="Builder & Partner restricted"
            subBadgeVariant="blue"
            icon={Buildings}
            iconColorClass="text-[#0066cc] dark:text-blue-400"
            iconBgClass="bg-blue-50 dark:bg-blue-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Scoped Accounts"
                description="Accounts strictly partitioned to a specific developer company or channel partner agency."
              />
            }
          />
        </div>
      )}

      {/* ── Feedback & Alert Banners ─────────────────────────────────── */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <Check size={15} weight="bold" className="text-emerald-600" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast('')} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Active Invitation Banner (if recently dispatched) ────────── */}
      {lastInviteUrl && (
        <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 space-y-2.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0066cc] animate-ping" />
              <h4 className="text-xs font-extrabold text-blue-900 dark:text-blue-100 uppercase tracking-wider">
                {lastInviteEmailed ? 'Invite Emailed to' : 'Invite Link Created for'} {lastInvitedEmail}
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
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#0066cc] hover:bg-blue-700 text-white font-bold text-xs shadow-2xs cursor-pointer self-start sm:self-auto"
            >
              <EnvelopeSimple size={13} weight="bold" />
              <span>Preview Email & WhatsApp Format</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={lastInviteUrl}
              className="flex-1 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-200 select-all outline-none"
            />
            <button
              onClick={() => copyToClipboard(lastInviteUrl, 'banner-link')}
              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
            >
              {copiedId === 'banner-link' ? <Check size={14} weight="bold" className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedId === 'banner-link' ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Search & Filter Controls ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search administrator by email, role, or organization…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium placeholder:text-zinc-400 focus:ring-1 focus:ring-[#0066cc] focus:border-[#0066cc] shadow-2xs outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Segmented Filter Bar & Status Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Role Tabs (Apple HIG) */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-semibold overflow-x-auto">
            {['ALL', 'SUPER_ADMIN', 'ANALYST', 'SALES', 'BUILDER', 'PARTNER'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  roleFilter === r
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold shadow-2xs'
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
            className="w-38"
          />
        </div>
      </div>

      {/* ── Administrators Table ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-50/75 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6 min-w-[220px]">Administrator</th>
                <th className="py-3.5 px-4 min-w-[130px]">Privilege Role</th>
                <th className="py-3.5 px-4 min-w-[180px]">Organization Scope</th>
                <th className="py-3.5 px-4 min-w-[110px]">Status</th>
                <th className="py-3.5 px-4 min-w-[110px]">Last Activity</th>
                <th className="py-3.5 px-6 text-right min-w-[180px]">Actions</th>
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
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors group"
                  >
                    {/* Administrator column with uppercase avatar */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl border font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs ${getAvatarStyle(a.role)}`}>
                          {getInitials(a.email)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-xs block" title={a.email}>
                            {a.email}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            ID: {a.id.slice(0, 8)}…
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role column */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border shadow-2xs ${getRoleBadgeStyle(
                          a.role
                        )}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {a.role}
                      </span>
                    </td>

                    {/* Scope column */}
                    <td className="py-3.5 px-4">
                      {a.builder?.name ? (
                        <div className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-800/60 text-xs">
                          <Buildings size={13} weight="duotone" className="shrink-0" />
                          <span className="font-semibold truncate max-w-[160px]">{a.builder.name}</span>
                        </div>
                      ) : a.partner?.name ? (
                        <div className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300 bg-rose-50/70 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200/60 dark:border-rose-800/60 text-xs">
                          <Handshake size={13} weight="duotone" className="shrink-0" />
                          <span className="font-semibold truncate max-w-[160px]">{a.partner.name}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-medium bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50">
                          Global Platform
                        </span>
                      )}
                    </td>

                    {/* Status column */}
                    <td className="py-3.5 px-4">
                      {a.invite_pending ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>Pending</span>
                        </div>
                      ) : a.is_active ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-zinc-400 font-semibold text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                          <span>Deactivated</span>
                        </div>
                      )}
                    </td>

                    {/* Last activity */}
                    <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400 text-xs">
                      {a.last_login_at ? (
                        <span title={new Date(a.last_login_at).toLocaleString()}>
                          {formatDistanceToNow(new Date(a.last_login_at), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-normal italic text-[11px]">Never logged in</span>
                      )}
                    </td>

                    {/* Actions column: Compact, elegant Apple HIG buttons */}
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Copy live invite link for pending accounts */}
                        {a.invite_pending && (
                          <button
                            type="button"
                            onClick={() => copyPendingInviteLink(a)}
                            disabled={fetchingInviteId === a.id}
                            className="px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-[11px] font-semibold flex items-center gap-1 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Copy personalized invite link"
                          >
                            {copiedId === `invite-${a.id}` ? (
                              <>
                                <Check size={12} weight="bold" className="text-emerald-600" />
                                <span>Copied!</span>
                              </>
                            ) : fetchingInviteId === a.id ? (
                              <>
                                <RotateCcw size={12} className="animate-spin" />
                                <span>Link…</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} weight="bold" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Email Preview icon button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEmailPreviewForAdmin(a)}
                          disabled={fetchingInviteId === a.id}
                          className="p-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-500 hover:text-[#0066cc] dark:hover:text-blue-400 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                          title={a.invite_pending ? 'Preview onboarding email with live link' : 'Preview onboarding email for this role'}
                        >
                          <EnvelopeSimple size={13} weight="bold" />
                        </button>

                        {/* Toggle active button */}
                        <button
                          type="button"
                          onClick={() => toggleActive(a)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all shadow-2xs active:scale-[0.98] cursor-pointer ${
                            a.is_active
                              ? 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200'
                              : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                          }`}
                        >
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>

                        {/* Delete / Revoke button */}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(a)}
                          className="p-1.5 rounded-lg border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
                          title={a.invite_pending ? 'Revoke and delete invitation' : 'Permanently remove administrator'}
                        >
                          <Trash size={13} weight="bold" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Apple HIG Modal Sheet: Invite or Promote Administrator ──── */}
      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                  mode === 'invite' 
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80' 
                    : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/80'
                }`}>
                  {mode === 'invite' ? <Plus size={18} weight="bold" /> : <UserPlus size={18} weight="bold" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {mode === 'invite' ? 'Invite New Administrator' : 'Promote Registered Buyer'}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {mode === 'invite'
                      ? 'Dispatches a secure cryptographic invite token to establish credentials'
                      : 'Elevates an existing registered Supabase buyer account directly'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMode(null)}
                className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Segmented Switch between Invite and Promote */}
            <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode('invite')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  mode === 'invite'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Invite by Email
              </button>
              <button
                type="button"
                onClick={() => setMode('promote')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  mode === 'promote'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Promote Existing User
              </button>
            </div>

            {/* Invite Flow */}
            {mode === 'invite' && (
              <form onSubmit={submitInvite} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="colleague@propfyndr.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Assigned Privilege Role
                  </label>
                  <CustomSelect
                    value={role}
                    onChange={(v) => setRole(v as Role)}
                    options={ROLE_OPTIONS}
                    size="md"
                  />
                </div>

                {/* Role scope inputs if BUILDER or PARTNER */}
                {role === 'BUILDER' && (
                  <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 p-3.5 rounded-xl space-y-2">
                    <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                      Target Builder Organization
                    </label>
                    {buildersList.length > 0 ? (
                      <CustomSelect
                        value={builderId}
                        onChange={(v) => setBuilderId(v)}
                        options={buildersList.map((b) => ({ value: b.id, label: b.name }))}
                        placeholder="Choose developer from catalog…"
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
                  <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/60 p-3.5 rounded-xl space-y-2">
                    <label className="block text-[11px] font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                      Channel Partner Agency
                    </label>
                    {partnersList.length > 0 ? (
                      <CustomSelect
                        value={partnerId}
                        onChange={(v) => setPartnerId(v)}
                        options={partnersList.map((p) => ({ value: p.id, label: p.name }))}
                        placeholder="Choose an approved partner…"
                        size="md"
                      />
                    ) : (
                      <p className="text-xs font-medium text-rose-900/80 dark:text-rose-200/80">
                        No approved channel partners yet — approve one under Partners first.
                      </p>
                    )}
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
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
                    className="flex items-center gap-1.5 text-[#0066cc] dark:text-blue-400 text-xs font-semibold hover:underline cursor-pointer"
                  >
                    <EnvelopeSimple size={13} weight="bold" />
                    <span>Preview Email</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMode(null)}
                      className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={submitting || !email}
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#0066cc] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Generating Invite…' : 'Generate & Send Invite'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Promote Flow */}
            {mode === 'promote' && (
              <form onSubmit={submitPromote} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Supabase User ID (UUID)
                  </label>
                  <input
                    required
                    placeholder="e.g. 550e8400-e29b-41d4-a716..."
                    value={supabaseUserId}
                    onChange={(e) => setSupabaseUserId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white text-xs font-mono focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Registered Email Address
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="user@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Assigned Privileges
                  </label>
                  <CustomSelect
                    value={role}
                    onChange={(v) => setRole(v as Role)}
                    options={ROLE_OPTIONS}
                    size="md"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setMode(null)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
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
            )}
          </div>
        </div>
      )}

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

      {/* ── Apple HIG Delete Confirmation Modal ─────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash size={20} weight="bold" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Remove Administrator
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Permanently revoke credentials and account access
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Account:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{deleteTarget.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Role:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{deleteTarget.role}</span>
              </div>
              {deleteTarget.invite_pending && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                  <span>Status:</span>
                  <span>Pending Invitation (unclaimed)</span>
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to remove <strong className="text-zinc-800 dark:text-zinc-200">{deleteTarget.email}</strong>? All active sessions and pending invite tokens will be terminated immediately. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
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
                onClick={executeDeleteAdmin}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <RotateCcw size={14} className="animate-spin" /> : <Trash size={14} weight="bold" />}
                <span>{isDeleting ? 'Removing…' : 'Delete Administrator'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
