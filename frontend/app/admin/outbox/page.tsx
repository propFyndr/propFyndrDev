'use client'

/**
 * Outbox & Notification Dispatch Queue.
 *
 * Manual send queue for notifications and cryptographic credentials.
 * Every notification dispatched by the product (invitations, password resets,
 * channel partner alerts) is audited here.
 *
 * `action_url` contains single-use cryptographic credentials — links are
 * one-click copyable and never rendered as raw anchor tags that could leak
 * via browser referrer headers.
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  EnvelopeSimple,
  Copy,
  Check,
  X,
  PaperPlaneTilt,
  Warning,
  LockKey,
  Clock,
  MagnifyingGlass,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Eye,
  Info,
  ArrowsClockwise
} from '@phosphor-icons/react'
import { RotateCcw, ArrowLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { adminFetch } from '@/lib/adminFetch'
import { MetricCard, MetricCardSkeleton } from '@/components/admin/ui/MetricCard'
import AdminInfoTooltip from '@/components/admin/AdminInfoTooltip'
import EmailPreviewModal from '@/components/admin/EmailPreviewModal'

interface Message {
  id: string
  channel: string
  to_email: string | null
  to_phone: string | null
  template: string
  subject: string | null
  body: string
  action_url: string | null
  status: string
  error: string | null
  created_at: string
  sent_at: string | null
  sent_by: string | null
}

const FILTERS = ['queued', 'sent', 'failed', 'cancelled', 'ALL'] as const

export default function OutboxPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [queuedCount, setQueuedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())
  const [error, setError] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [filter, setFilter] = useState<string>('queued')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)

  // Email Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<'team_invite' | 'builder_pitch'>('team_invite')
  const [previewEmail, setPreviewEmail] = useState('')
  const [previewLink, setPreviewLink] = useState('')

  const isFetchingRef = useRef(false)

  const load = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    if (isManual) setIsRefreshing(true)
    setError('')

    try {
      // Fetch both current filter and overview for multi-metric totals
      const [filterRes, allRes] = await Promise.all([
        adminFetch(`/admin/outbox?status=${filter}`),
        adminFetch('/admin/outbox?status=ALL').catch(() => null)
      ])

      if (!filterRes.ok) throw new Error('Could not load the outbox queue.')
      const d = await filterRes.json()
      setMessages(d.messages ?? [])
      setQueuedCount(d.queuedCount ?? 0)

      if (allRes && allRes.ok) {
        const allData = await allRes.json()
        setAllMessages(allData.messages ?? [])
      } else {
        setAllMessages(d.messages ?? [])
      }

      setLastRefreshedAt(new Date())
    } catch (e: any) {
      setError(e?.message || 'Error communicating with notification outbox gateway.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      isFetchingRef.current = false
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  // Mark message as sent, failed, or cancelled
  async function mark(id: string, status: string) {
    setSavingId(id)
    setError('')
    try {
      const res = await adminFetch(`/admin/outbox/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Update failed')

      setSuccessToast(`Notification marked as ${status}.`)
      setTimeout(() => setSuccessToast(''), 4000)

      setMessages((prev) =>
        filter === 'ALL'
          ? prev.map((m) => (m.id === id ? d.message : m))
          : prev.filter((m) => m.id !== id)
      )
      setAllMessages((prev) => prev.map((m) => (m.id === id ? d.message : m)))

      if (status !== 'queued') setQueuedCount((c) => Math.max(0, c - 1))
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingId(null)
    }
  }

  // Attempt Resend delivery via backend POST /:id/send
  async function dispatchNow(id: string) {
    setDispatchingId(id)
    setError('')
    try {
      const res = await adminFetch(`/admin/outbox/${id}/send`, { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Dispatch attempt failed.')

      setSuccessToast('Notification dispatched via email provider successfully!')
      setTimeout(() => setSuccessToast(''), 4000)
      load(true)
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Dispatch failed.')
    } finally {
      setDispatchingId(null)
    }
  }

  // Copy full message content
  async function copy(m: Message) {
    const text = [
      m.to_email ? `To: ${m.to_email}` : null,
      m.to_phone ? `To: ${m.to_phone}` : null,
      m.subject ? `Subject: ${m.subject}` : null,
      '',
      m.body,
    ].filter((l) => l !== null).join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedId(m.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // Copy one-time link directly
  async function copyLinkOnly(url: string, id: string) {
    await navigator.clipboard.writeText(url)
    setCopiedId(`link-${id}`)
    setSuccessToast('One-time cryptographic credential copied to clipboard!')
    setTimeout(() => {
      setCopiedId(null)
      setSuccessToast('')
    }, 3500)
  }

  // Filtered messages by search
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages
    const q = searchQuery.toLowerCase().trim()
    return messages.filter((m) =>
      (m.to_email && m.to_email.toLowerCase().includes(q)) ||
      (m.to_phone && m.to_phone.toLowerCase().includes(q)) ||
      (m.subject && m.subject.toLowerCase().includes(q)) ||
      m.template.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q)
    )
  }, [messages, searchQuery])

  // Counts across all categories
  const summaryCounts = useMemo(() => {
    const dataset = allMessages.length > 0 ? allMessages : messages
    const sent = dataset.filter((m) => m.status === 'sent').length
    const failed = dataset.filter((m) => m.status === 'failed').length
    const cancelled = dataset.filter((m) => m.status === 'cancelled').length
    const total = dataset.length
    return { queued: queuedCount, sent, failed, cancelled, total }
  }, [allMessages, messages, queuedCount])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Queued
          </span>
        )
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Sent
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Failed
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            {status}
          </span>
        )
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans select-none min-w-0">
      
      {/* ── Apple-Style Header Banner ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Outbox & Dispatch Queue
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Manual Send & Audit Queue
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Audit outbound notifications, copy one-time cryptographic credentials, and manage delivery status logs across invitations and security alerts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline-block">
            Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-60"
            title="Refresh outbox queue"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-[#0066cc]' : 'text-zinc-500'} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <Link
            href="/admin/email-preview"
            className="flex items-center gap-1.5 bg-[#0066cc] hover:bg-[#0055b3] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
          >
            <EnvelopeSimple size={14} weight="bold" />
            <span>Preview Studio</span>
          </Link>

          <Link
            href="/admin/team"
            className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 text-zinc-900 dark:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer border border-zinc-200/60 dark:border-zinc-700/60"
          >
            <span>Team & Invites</span>
            <ArrowRight size={13} weight="bold" />
          </Link>
        </div>
      </div>

      {/* ── Security & Cryptographic Disclosure Callout ──────────────── */}
      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-3.5 text-xs shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/60 dark:border-amber-800/60">
          <LockKey size={18} weight="bold" />
        </div>
        <div className="space-y-1">
          <h4 className="font-extrabold text-amber-900 dark:text-amber-100 text-xs">
            Cryptographic One-Time Credentials
          </h4>
          <p className="text-amber-800/90 dark:text-amber-200/80 font-medium text-[11px] leading-relaxed">
            Links in these messages contain single-use cryptographic authorization tokens. Anyone holding an invite or password reset link can establish credentials for that account. Deliver them solely to the verified recipient. Security reset links expire 60 minutes after creation.
          </p>
        </div>
      </div>

      {/* ── Feedback Banners ─────────────────────────────────────────── */}
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

      {/* ── KPI Row: 4 Apple HIG MetricCards ─────────────────────────── */}
      {loading ? (
        <MetricCardSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            title="Awaiting Dispatch"
            value={summaryCounts.queued}
            subBadge={summaryCounts.queued > 0 ? 'Pending send' : 'Queue clear'}
            subBadgeVariant={summaryCounts.queued > 0 ? 'amber' : 'emerald'}
            icon={Clock}
            iconColorClass="text-amber-600 dark:text-amber-400"
            iconBgClass="bg-amber-50 dark:bg-amber-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Awaiting Dispatch"
                description="Notifications currently waiting in the outbox for delivery to recipients."
              />
            }
          />
          <MetricCard
            title="Delivered Sends"
            value={summaryCounts.sent}
            subBadge="Verified delivery"
            subBadgeVariant="emerald"
            icon={PaperPlaneTilt}
            iconColorClass="text-emerald-600 dark:text-emerald-400"
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Delivered Sends"
                description="Messages successfully dispatched and confirmed by the administrator."
              />
            }
          />
          <MetricCard
            title="Delivery Failures"
            value={summaryCounts.failed}
            subBadge={summaryCounts.failed > 0 ? 'Requires attention' : 'Zero failures'}
            subBadgeVariant={summaryCounts.failed > 0 ? 'amber' : 'zinc'}
            icon={Warning}
            iconColorClass="text-rose-600 dark:text-rose-400"
            iconBgClass="bg-rose-50 dark:bg-rose-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Delivery Failures"
                description="Outbound messages that encountered gateway or delivery issues and may need retry."
              />
            }
          />
          <MetricCard
            title="Total Dispatches"
            value={summaryCounts.total}
            subBadge="Audit log records"
            subBadgeVariant="blue"
            icon={EnvelopeSimple}
            iconColorClass="text-[#0066cc] dark:text-blue-400"
            iconBgClass="bg-blue-50 dark:bg-blue-950/60"
            tooltip={
              <AdminInfoTooltip
                title="Total Dispatches"
                description="Total notification events logged in the outbox database."
              />
            }
          />
        </div>
      )}

      {/* ── Filter Controls & Search Bar ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by recipient, subject, or template…"
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

        {/* Apple HIG Segmented Control */}
        <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-semibold overflow-x-auto">
          {FILTERS.map((f) => {
            const count =
              f === 'queued'
                ? summaryCounts.queued
                : f === 'sent'
                ? summaryCounts.sent
                : f === 'failed'
                ? summaryCounts.failed
                : f === 'cancelled'
                ? summaryCounts.cancelled
                : summaryCounts.total

            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  filter === f
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <span>{f === 'ALL' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  filter === f
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono'
                    : 'bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content Area: Message Cards or Empty State ───────────────── */}
      {filteredMessages.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-12 sm:p-16 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 mx-auto flex items-center justify-center text-[#0066cc] dark:text-blue-400 shadow-2xs">
            <EnvelopeSimple size={28} weight="duotone" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-zinc-900 dark:text-white tracking-tight">
              {filter === 'queued' ? 'Outbox Queue is Completely Clear' : 'No Messages Match Filter'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed">
              {filter === 'queued'
                ? 'All pending invitations, password resets, and buyer notifications have been dispatched. Newly triggered notification events will appear here in real time.'
                : 'No notification records match the current status filter. Adjust your filter selection above or check all records.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/admin/team"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0066cc] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs active:scale-[0.98]"
            >
              <span>Invite New Administrator</span>
              <ArrowRight size={13} weight="bold" />
            </Link>
            <button
              onClick={() => {
                setPreviewTemplate('team_invite')
                setPreviewEmail('colleague@propfyndr.in')
                setPreviewLink('')
                setIsPreviewOpen(true)
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-all shadow-2xs"
            >
              <Eye size={14} weight="bold" />
              <span>Preview Email Template</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((m) => {
            const hasActionUrl = Boolean(m.action_url)

            return (
              <div
                key={m.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-2xs space-y-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                {/* Message Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
                        {m.subject || m.template.replace(/_/g, ' ')}
                      </span>
                      {getStatusBadge(m.status)}
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                        {m.channel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {m.to_email ?? m.to_phone ?? 'No recipient specified'}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} className="text-zinc-400" />
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </span>
                      {m.sent_by && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-400">Sent by {m.sent_by}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Top Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Copy Link Button */}
                    {hasActionUrl && (
                      <button
                        type="button"
                        onClick={() => copyLinkOnly(m.action_url!, m.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 shadow-2xs transition-all cursor-pointer"
                        title="Copy single-use invite or reset link"
                      >
                        {copiedId === `link-${m.id}` ? (
                          <>
                            <Check size={13} weight="bold" className="text-emerald-600" />
                            <span>Link Copied!</span>
                          </>
                        ) : (
                          <>
                            <LockKey size={13} weight="bold" />
                            <span>Copy Action Link</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Copy Full Text */}
                    <button
                      type="button"
                      onClick={() => copy(m)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-2xs transition-all cursor-pointer"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check size={13} weight="bold" className="text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} weight="bold" />
                          <span>Copy Message</span>
                        </>
                      )}
                    </button>

                    {/* Queued Action Controls */}
                    {m.status === 'queued' && (
                      <>
                        <button
                          type="button"
                          onClick={() => mark(m.id, 'sent')}
                          disabled={savingId === m.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 shadow-2xs transition-all cursor-pointer"
                        >
                          <Check size={13} weight="bold" />
                          <span>Mark Sent</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => mark(m.id, 'cancelled')}
                          disabled={savingId === m.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-500 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60 shadow-2xs transition-all cursor-pointer"
                        >
                          <X size={13} weight="bold" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Message Body Content */}
                <div className="bg-zinc-50/80 dark:bg-zinc-800/40 rounded-xl p-3.5 border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {m.body}
                </div>

                {m.error && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <Warning size={14} weight="bold" />
                    <span>Delivery error: {m.error}</span>
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Email Preview Modal ──────────────────────────────────────── */}
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        initialTemplate={previewTemplate}
        defaultRecipientEmail={previewEmail}
        inviteLink={previewLink}
      />
    </div>
  )
}
