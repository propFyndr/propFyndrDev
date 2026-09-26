'use client'

/**
 * Account & Access Profile Console.
 *
 * Implements Apple Human Interface & Master Design Engineering standards:
 * - Enterprise Identity Hero: Monogram avatar, active role badge with live pulse,
 *   and organization scope.
 * - Cryptographic Session Telemetry: Token lifespan, bearer invalidation policy,
 *   and device security health.
 * - Dynamic Role Capabilities: Contextual breakdown of what the current user's
 *   role allows, plus an expandable cross-role capability comparison matrix.
 * - Password Security Management: Real-time strength meter, confirmation match check,
 *   and instant session invalidation warning.
 */

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  LockKey,
  Eye,
  EyeSlash,
  CircleNotch,
  ShieldCheck,
  Check,
  Copy,
  Warning,
  Buildings,
  Handshake,
  Clock,
  EnvelopeSimple,
  ChartLineUp,
  PhoneCall,
  SealCheck,
  MagnifyingGlass,
  ArrowRight,
  CaretDown,
  CaretUp,
  Key,
  DeviceMobile,
  CheckCircle,
  XCircle,
  Info
} from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'

const MIN_PASSWORD = 12

interface Me {
  email: string
  role: string
  builder: { name: string } | null
  partner: { name: string } | null
}

interface CapabilityItem {
  title: string
  description: string
  granted: boolean
}

export default function AccountPanel() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  // Password fields
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [showHierarchyMatrix, setShowHierarchyMatrix] = useState(false)

  useEffect(() => {
    adminFetch('/portal/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setMe)
      .catch(() => setError('Could not load your administrative account details.'))
      .finally(() => setLoading(false))
  }, [])

  // Password validation checks
  const hasMinLength = next.length >= MIN_PASSWORD
  const hasUpper = /[A-Z]/.test(next)
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(next)
  const isMatching = confirm.length > 0 && next === confirm
  const isDifferentFromCurrent = current.length > 0 && next.length > 0 && next !== current

  const canSubmit =
    current.length > 0 &&
    hasMinLength &&
    hasUpper &&
    hasNumberOrSymbol &&
    isMatching &&
    isDifferentFromCurrent

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

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

      // Invalidate local storage tokens immediately
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_role')
      setTimeout(() => router.push('/admin/login'), 2400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.')
    } finally {
      setSaving(false)
    }
  }

  const copyEmail = () => {
    if (!me?.email) return
    navigator.clipboard.writeText(me.email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  // Proper uppercase monogram
  const getInitials = (str: string) => {
    if (!str) return 'AD'
    const namePart = str.split('@')[0]
    const segments = namePart.split(/[._-]/).filter(Boolean)
    if (segments.length >= 2) {
      return (segments[0][0] + segments[1][0]).toUpperCase()
    }
    return namePart.slice(0, 2).toUpperCase()
  }

  // Dynamic capabilities for the current role
  const roleCapabilities = useMemo((): CapabilityItem[] => {
    const role = me?.role?.toUpperCase() || ''

    if (role === 'SUPER_ADMIN') {
      return [
        {
          title: 'Full Catalog & Inventory Authority',
          description: 'Create, update, bulk-import, and permanently delete projects, builders, and developers.',
          granted: true,
        },
        {
          title: 'Lead CRM & Pipeline Management',
          description: 'Full unredacted access to buyer profiles, callback schedules, and conversion states.',
          granted: true,
        },
        {
          title: 'AI Economics & Financial Auditing',
          description: 'Inspect real-time per-chat OpenAI & Gemini unit economics, budget run-rates, and server audit trails.',
          granted: true,
        },
        {
          title: 'Access Control & Cryptographic Governance',
          description: 'Manage staff roles, dispatch single-use invite tokens, promote users, and revoke authorizations instantly.',
          granted: true,
        },
        {
          title: 'Notification Outbox & Delivery Queue',
          description: 'Audit manual dispatches, copy one-time credentials, and trigger manual email send retries.',
          granted: true,
        },
      ]
    }

    if (role === 'ANALYST') {
      return [
        {
          title: 'Catalog Data & Specs Management',
          description: 'Edit pricing matrices, possession dates, RERA certifications, floor plans, and construction milestones.',
          granted: true,
        },
        {
          title: 'Data Quality & Freshness Workbench',
          description: 'Audit listing completeness, resolve documentation issues, and score catalog health.',
          granted: true,
        },
        {
          title: 'Market Intelligence & Search Analytics',
          description: 'Track corridor demand trends, top queried sectors, and builder performance telemetry.',
          granted: true,
        },
        {
          title: 'Customer PII & Transcripts Privacy Guard',
          description: 'Buyer personal identities, phone numbers, and raw conversation transcripts are strictly redacted to protect consumer confidence.',
          granted: false,
        },
        {
          title: 'Destructive Actions Restriction',
          description: 'Permanent project and builder deletions are reserved for Super Administrators.',
          granted: false,
        },
      ]
    }

    if (role === 'SALES') {
      return [
        {
          title: 'Priority Sales Call Queue',
          description: 'Access live inbound buyer leads ranked by AI intent score, budget tier, and freshness.',
          granted: true,
        },
        {
          title: 'Buyer Dossiers & WhatsApp Integration',
          description: 'View buyer budget brackets, loan pre-approval signals, and dispatch one-click WhatsApp messages.',
          granted: true,
        },
        {
          title: 'Real-time Catalog Lookup',
          description: 'Fast, read-only property search mid-call to answer buyer queries with accurate specs.',
          granted: true,
        },
        {
          title: 'Catalog Edit Restriction',
          description: 'Inventory specs, pricing, and project details are read-only to preserve catalog integrity.',
          granted: false,
        },
        {
          title: 'System Governance & Outbox Restriction',
          description: 'Administrative user management, team invites, and financial audit logs are inaccessible.',
          granted: false,
        },
      ]
    }

    if (role === 'BUILDER') {
      return [
        {
          title: 'Dedicated Developer Portal',
          description: 'Scoped strictly to your registered developer company and associated projects.',
          granted: true,
        },
        {
          title: 'Inbound Project Inquiries',
          description: 'Review verified buyer leads showing direct purchase intent for your developments.',
          granted: true,
        },
        {
          title: 'Channel Partner Access Roster',
          description: 'Authorize or restrict channel partner broker connections selling your inventory.',
          granted: true,
        },
      ]
    }

    if (role === 'PARTNER') {
      return [
        {
          title: 'Authorized Channel Partner Console',
          description: 'Scoped strictly to your registered channel partner brokerage agency.',
          granted: true,
        },
        {
          title: 'Assigned Buyer Leads',
          description: 'Access client callback inquiries routed specifically to your brokerage.',
          granted: true,
        },
        {
          title: 'Site Visit Scheduling & Follow-ups',
          description: 'Coordinate in-person site visits with calendar slots and client status tracking.',
          granted: true,
        },
      ]
    }

    return []
  }, [me])

  const roleTheme = useMemo(() => {
    const role = me?.role?.toUpperCase() || ''
    switch (role) {
      case 'SUPER_ADMIN':
        return {
          pill: 'bg-purple-50 text-purple-700 border-purple-200/90 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/80',
          dot: 'bg-purple-500',
          avatar: 'bg-gradient-to-tr from-purple-100 to-indigo-100 text-purple-800 dark:from-purple-950 dark:to-indigo-950 dark:text-purple-200 border-purple-200/80 dark:border-purple-800/60',
          sessionTtl: '7 Days (Staff Automatic Invalidation)',
          label: 'Super Administrator',
        }
      case 'ANALYST':
        return {
          pill: 'bg-blue-50 text-[#0066cc] border-blue-200/90 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80',
          dot: 'bg-[#0066cc]',
          avatar: 'bg-gradient-to-tr from-blue-100 to-cyan-100 text-[#0066cc] dark:from-blue-950 dark:to-cyan-950 dark:text-blue-200 border-blue-200/80 dark:border-blue-800/60',
          sessionTtl: '7 Days (Staff Automatic Invalidation)',
          label: 'Intelligence Analyst',
        }
      case 'SALES':
        return {
          pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/90 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80',
          dot: 'bg-emerald-500',
          avatar: 'bg-gradient-to-tr from-emerald-100 to-teal-100 text-emerald-800 dark:from-emerald-950 dark:to-teal-950 dark:text-emerald-200 border-emerald-200/80 dark:border-emerald-800/60',
          sessionTtl: '7 Days (Staff Automatic Invalidation)',
          label: 'Sales Specialist',
        }
      case 'BUILDER':
        return {
          pill: 'bg-amber-50 text-amber-700 border-amber-200/90 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80',
          dot: 'bg-amber-500',
          avatar: 'bg-gradient-to-tr from-amber-100 to-orange-100 text-amber-800 dark:from-amber-950 dark:to-orange-950 dark:text-amber-200 border-amber-200/80 dark:border-amber-800/60',
          sessionTtl: '24 Hours (External Account)',
          label: 'Builder Partner',
        }
      case 'PARTNER':
        return {
          pill: 'bg-rose-50 text-rose-700 border-rose-200/90 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80',
          dot: 'bg-rose-500',
          avatar: 'bg-gradient-to-tr from-rose-100 to-pink-100 text-rose-800 dark:from-rose-950 dark:to-pink-950 dark:text-rose-200 border-rose-200/80 dark:border-rose-800/60',
          sessionTtl: '24 Hours (External Account)',
          label: 'Channel Partner Broker',
        }
      default:
        return {
          pill: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
          dot: 'bg-zinc-500',
          avatar: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
          sessionTtl: '7 Days',
          label: 'Administrator',
        }
    }
  }, [me])

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-3">
        <CircleNotch size={28} className="animate-spin text-[#0066cc] mx-auto" />
        <p className="text-xs font-semibold text-zinc-400">Loading administrative credentials…</p>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans select-none min-w-0">
      
      {/* ── Apple-Style Header Banner ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Account & Access Profile
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Cryptographic Session
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Personal identity credentials, active role privilege boundaries, and cryptographic session management.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <XCircle size={15} />
          </button>
        </div>
      )}

      {/* ── Identity & Session Hub Card ──────────────────────────────── */}
      {me && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-7 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: User Identity */}
            <div className="lg:col-span-7 flex items-center gap-4 sm:gap-5">
              <div
                className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl border flex items-center justify-center font-black text-xl sm:text-2xl shrink-0 shadow-xs ${roleTheme.avatar}`}
              >
                {getInitials(me.email)}
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white truncate">
                    {me.email}
                  </h2>
                  <button
                    onClick={copyEmail}
                    className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Copy Email Address"
                  >
                    {copiedEmail ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${roleTheme.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${roleTheme.dot}`} />
                    {roleTheme.label}
                  </span>

                  {me.builder && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                      <Buildings size={13} weight="duotone" />
                      {me.builder.name}
                    </span>
                  )}

                  {me.partner && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60">
                      <Handshake size={13} weight="duotone" />
                      {me.partner.name}
                    </span>
                  )}

                  {!me.builder && !me.partner && (
                    <span className="text-[11px] text-zinc-400 font-medium bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50">
                      Global Platform Authority
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Cryptographic Session Telemetry */}
            <div className="lg:col-span-5 bg-zinc-50/80 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <Key size={13} className="text-[#0066cc]" />
                  Session Mechanism
                </span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">Cryptographic Bearer</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-500" />
                  TTL Rotation Policy
                </span>
                <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{roleTheme.sessionTtl}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  Security Standard
                </span>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">HMAC-SHA256 & TLS 1.3</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Role Privileges & Capabilities ────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={18} weight="bold" className="text-[#0066cc]" />
              Your Role Capabilities ({me?.role})
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Specific administrative boundaries enforced by server-side authorization policies
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHierarchyMatrix(!showHierarchyMatrix)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all cursor-pointer self-start sm:self-auto shadow-2xs"
          >
            <span>Compare All Admin Roles</span>
            {showHierarchyMatrix ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
          </button>
        </div>

        {/* Capability Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {roleCapabilities.map((cap, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl border transition-all ${
                cap.granted
                  ? 'bg-zinc-50/60 dark:bg-zinc-800/30 border-zinc-200/70 dark:border-zinc-700/50'
                  : 'bg-zinc-100/50 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-800 opacity-75'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {cap.granted ? (
                  <CheckCircle size={15} weight="fill" className="text-emerald-600 shrink-0" />
                ) : (
                  <XCircle size={15} weight="fill" className="text-zinc-400 shrink-0" />
                )}
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                  {cap.title}
                </h4>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                {cap.description}
              </p>
            </div>
          ))}
        </div>

        {/* Expandable Platform Role Comparison Matrix */}
        {showHierarchyMatrix && (
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3 animate-in fade-in duration-200">
            <h4 className="text-xs font-extrabold uppercase text-zinc-400 tracking-wider">
              Platform Role Governance Matrix (Who Gets What)
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200/80 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Administrative Role</th>
                    <th className="py-3 px-4">Target Workspace</th>
                    <th className="py-3 px-4 text-center">Catalog Edit</th>
                    <th className="py-3 px-4 text-center">Lead Pipeline</th>
                    <th className="py-3 px-4 text-center">AI Costs & Unit Econ</th>
                    <th className="py-3 px-4 text-center">Team Governance</th>
                    <th className="py-3 px-4 text-center">Outbox Dispatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                  {/* Super Admin */}
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 px-4">
                      <span className="font-bold text-purple-700 dark:text-purple-300">Super Admin</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Executive Console (`/admin`)</td>
                    <td className="py-3 px-4 text-center"><Check size={14} weight="bold" className="text-emerald-600 inline" /></td>
                    <td className="py-3 px-4 text-center"><Check size={14} weight="bold" className="text-emerald-600 inline" /></td>
                    <td className="py-3 px-4 text-center"><Check size={14} weight="bold" className="text-emerald-600 inline" /></td>
                    <td className="py-3 px-4 text-center"><Check size={14} weight="bold" className="text-emerald-600 inline" /></td>
                    <td className="py-3 px-4 text-center"><Check size={14} weight="bold" className="text-emerald-600 inline" /></td>
                  </tr>

                  {/* Analyst */}
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#0066cc] dark:text-blue-300">Analyst</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Data Quality Workbench (`/admin/quality`)</td>
                    <td className="py-3 px-4 text-center"><Check size={14} weight="bold" className="text-emerald-600 inline" /></td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                  </tr>

                  {/* Sales */}
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 px-4">
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">Sales</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Priority Lead Queue (`/admin/queue`)</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">Read only</td>
                    <td className="py-3 px-4 text-center"><Check size={14} weight="bold" className="text-emerald-600 inline" /></td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                  </tr>

                  {/* Builder */}
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 px-4">
                      <span className="font-bold text-amber-700 dark:text-amber-300">Builder</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Builder Portal (`/builder/portal`)</td>
                    <td className="py-3 px-4 text-center text-zinc-400">Own projects</td>
                    <td className="py-3 px-4 text-center text-zinc-400">Own leads</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                  </tr>

                  {/* Partner */}
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 px-4">
                      <span className="font-bold text-rose-700 dark:text-rose-300">Partner</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Channel Partner Portal (`/partner/portal`)</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-400">Assigned leads</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                    <td className="py-3 px-4 text-center text-zinc-300 dark:text-zinc-600">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Change Password Console ──────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-7 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <LockKey size={18} weight="bold" className="text-amber-500" />
            Rotate Administrative Password
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
            Changing your password terminates all live sessions across every device immediately, safeguarding against credential leakage.
          </p>
        </div>

        {done ? (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80">
            <CheckCircle size={18} weight="fill" className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                Password Successfully Updated
              </h4>
              <p className="text-xs font-medium text-emerald-800/90 dark:text-emerald-300/90 mt-0.5">
                All existing sessions have been revoked. Redirecting you to sign in with your new credentials…
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={changePassword} className="space-y-4 max-w-xl">
            {/* Current Password */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-all pr-10"
                  autoComplete="current-password"
                  placeholder="Enter current password"
                />
              </div>
            </div>

            {/* New Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    placeholder={`At least ${MIN_PASSWORD} characters`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-all pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeSlash size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition-all"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {/* Password Validation Meter Checklist */}
            {next.length > 0 && (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  {hasMinLength ? <Check size={12} weight="bold" /> : <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 ml-0.5 mr-1" />}
                  <span>Minimum 12 characters ({next.length}/{MIN_PASSWORD})</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  {hasUpper ? <Check size={12} weight="bold" /> : <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 ml-0.5 mr-1" />}
                  <span>At least one uppercase character</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumberOrSymbol ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  {hasNumberOrSymbol ? <Check size={12} weight="bold" /> : <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 ml-0.5 mr-1" />}
                  <span>At least one number or special symbol</span>
                </div>
                {confirm.length > 0 && (
                  <div className={`flex items-center gap-1.5 ${isMatching ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isMatching ? <Check size={12} weight="bold" /> : <XCircle size={12} weight="fill" />}
                    <span>{isMatching ? 'Passwords match' : 'Passwords do not match yet'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="inline-flex items-center gap-2 bg-[#0066cc] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] transition-all shadow-sm"
              >
                {saving ? <CircleNotch size={14} className="animate-spin" /> : <LockKey size={14} weight="bold" />}
                <span>{saving ? 'Invalidating Sessions & Updating…' : 'Update Password & Invalidate Sessions'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
