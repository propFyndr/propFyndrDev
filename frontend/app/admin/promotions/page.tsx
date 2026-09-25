'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Megaphone,
  Plus,
  PencilSimple,
  Trash,
  Eye,
  Cursor,
  TrendUp,
  MagnifyingGlass,
  ArrowUpRight,
  MapPin,
  Radio,
  X,
  ChartBar,
  CalendarBlank,
  CheckCircle,
} from '@phosphor-icons/react'
import { m, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { adminFetch } from '@/lib/adminFetch'
import { toast } from 'sonner'
import CustomSelect from '@/components/admin/CustomSelect'

export interface Promotion {
  id: string
  title: string
  description?: string | null
  type: 'button' | 'toast_text' | 'news_feature'
  content: string
  link_type?: string | null
  link_target?: string | null
  image_url?: string | null
  icon_url?: string | null
  builder_id?: string | null
  starts_at: string
  ends_at: string
  is_active: boolean
  target_sectors: string[]
  target_bhk: number[]
  impressions: number
  clicks: number
  conversions: number
  created_at: string
}

interface PromotionStats {
  total: number
  active: number
  inactive: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
}

export default function PromotionsAdminPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [stats, setStats] = useState<PromotionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'button' | 'toast_text' | 'news_feature'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'ended' | 'disabled'>('all')

  const fetchPromotions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminFetch('/admin/promotions')
      if (res.ok) {
        const data = await res.json()
        setPromotions(data.promotions || [])
        setStats(data.stats || null)
      } else {
        toast.error('Could not load promotions')
      }
    } catch (err) {
      console.error('Failed to fetch promotions:', err)
      toast.error('Network error loading promotions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPromotions()
  }, [fetchPromotions])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete campaign "${title}"?`)) return

    try {
      const res = await adminFetch(`/admin/promotions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPromotions((prev) => prev.filter((p) => p.id !== id))
        toast.success(`Deleted "${title}"`)
        fetchPromotions()
      } else {
        toast.error('Failed to delete promotion')
      }
    } catch (err) {
      console.error('Delete failed:', err)
      toast.error('Failed to delete promotion')
    }
  }

  const handleToggleActive = async (promo: Promotion) => {
    const updatedStatus = !promo.is_active
    try {
      const res = await adminFetch(`/admin/promotions/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: updatedStatus }),
      })
      if (res.ok) {
        setPromotions((prev) =>
          prev.map((p) => (p.id === promo.id ? { ...p, is_active: updatedStatus } : p))
        )
        toast.success(updatedStatus ? `Activated "${promo.title}"` : `Deactivated "${promo.title}"`)
        fetchPromotions()
      } else {
        toast.error('Failed to update status')
      }
    } catch (err) {
      console.error('Toggle failed:', err)
      toast.error('Failed to toggle status')
    }
  }

  const getStatus = (promo: Promotion) => {
    if (!promo.is_active) return { label: 'Disabled', variant: 'disabled' as const }
    const now = new Date()
    const start = new Date(promo.starts_at)
    const end = new Date(promo.ends_at)
    if (now < start) return { label: 'Scheduled', variant: 'scheduled' as const }
    if (now > end) return { label: 'Ended', variant: 'ended' as const }
    return { label: 'Live Now', variant: 'active' as const }
  }

  // Filtered promotions
  const filteredPromotions = useMemo(() => {
    return promotions.filter((promo) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        promo.title.toLowerCase().includes(q) ||
        (promo.description && promo.description.toLowerCase().includes(q)) ||
        promo.content.toLowerCase().includes(q) ||
        (promo.target_sectors && promo.target_sectors.some((s) => s.toLowerCase().includes(q)))

      const matchesType = typeFilter === 'all' || promo.type === typeFilter

      const status = getStatus(promo).variant
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && status === 'active') ||
        (statusFilter === 'scheduled' && status === 'scheduled') ||
        (statusFilter === 'ended' && status === 'ended') ||
        (statusFilter === 'disabled' && status === 'disabled')

      return matchesSearch && matchesType && matchesStatus
    })
  }, [promotions, searchQuery, typeFilter, statusFilter])

  return (
    <div className="max-w-[1440px] mx-auto space-y-7 p-4 sm:p-6 lg:p-8 font-sans">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-xs">
              <Megaphone size={22} weight="duotone" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                  Promotions & Campaigns
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{stats?.active ?? 0} Live Now</span>
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
                Manage high-intent discovery banners, sponsored CTA buttons, and spotlight announcements across PropFyndr.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingPromo(null)
            setShowModal(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer shrink-0"
        >
          <Plus size={16} weight="bold" />
          <span>New Promotion</span>
        </button>
      </div>

      {/* ── Metric KPI Stats Row (Interactive Filter Cards) ─────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Campaigns */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          className={`text-left p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Active Campaigns
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60">
              <Radio size={16} weight="bold" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums tracking-tight">
              {loading ? '—' : stats?.active ?? 0}
            </span>
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              of {stats?.total ?? 0} total
            </span>
          </div>
        </button>

        {/* Total Impressions */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Impressions
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60">
              <Eye size={16} weight="bold" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums tracking-tight">
              {loading ? '—' : (stats?.impressions ?? 0).toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Logged buyer views</span>
          </div>
        </div>

        {/* Engaged Clicks */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Engaged Clicks
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200/60 dark:border-violet-800/60">
              <Cursor size={16} weight="bold" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums tracking-tight">
              {loading ? '—' : (stats?.clicks ?? 0).toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Direct buyer interactions</span>
          </div>
        </div>

        {/* Click-Through Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Click-Through Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/60">
              <TrendUp size={16} weight="bold" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums tracking-tight">
              {loading ? '—' : `${stats?.ctr ?? 0}%`}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-medium">
              Conversion efficiency
            </span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search campaigns by title, copy, target sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('button')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                typeFilter === 'button'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              CTA Button
            </button>
            <button
              onClick={() => setTypeFilter('toast_text')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                typeFilter === 'toast_text'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Toast Banner
            </button>
            <button
              onClick={() => setTypeFilter('news_feature')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                typeFilter === 'news_feature'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              News Spotlight
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'scheduled'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setStatusFilter('disabled')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'disabled'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Disabled
            </button>
          </div>
        </div>
      </div>

      {/* ── Promotions Grid ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredPromotions.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center max-w-xl mx-auto shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto mb-4">
            <Megaphone size={28} weight="duotone" />
          </div>
          <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
            {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'No matching campaigns found'
              : 'No promotions created yet'}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed font-medium">
            {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search terms or clearing active filters.'
              : 'Create promotional CTA buttons, ticker announcements, or spotlight cards to engage home seekers across discovery results.'}
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => {
                setEditingPromo(null)
                setShowModal(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus size={16} weight="bold" />
              <span>Create First Promotion</span>
            </button>
          </div>
        </div>
      ) : (
        /* Responsive 3-Column Studio Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPromotions.map((promo) => {
            const status = getStatus(promo)
            const ctr = promo.impressions > 0 ? ((promo.clicks / promo.impressions) * 100).toFixed(1) : '0.0'

            return (
              <div
                key={promo.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setEditingPromo(promo)
                  setShowModal(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setEditingPromo(promo)
                    setShowModal(true)
                  }
                }}
                className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-2xs hover:border-blue-500/70 dark:hover:border-blue-500/60 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group min-h-[290px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <div>
                  {/* Card Header: Type Tag + Status Pill + Actions */}
                  <div className="flex items-center justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                        {promo.type === 'button'
                          ? 'CTA Button'
                          : promo.type === 'toast_text'
                          ? 'Toast Banner'
                          : 'News Spotlight'}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          status.variant === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                            : status.variant === 'scheduled'
                            ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                            : status.variant === 'ended'
                            ? 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500'
                            : 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {status.variant === 'active' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                        <span>{status.label}</span>
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingPromo(promo)
                          setShowModal(true)
                        }}
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                        title="Edit campaign"
                      >
                        <PencilSimple size={15} weight="bold" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(promo.id, promo.title)
                        }}
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                        title="Delete campaign"
                      >
                        <Trash size={15} weight="bold" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-white leading-snug line-clamp-1">
                    {promo.title}
                  </h3>
                  {promo.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {promo.description}
                    </p>
                  )}

                  {/* ── High-Fidelity Buyer UI Preview ───────────────────────── */}
                  <div className="mt-4">
                    {promo.type === 'button' ? (
                      /* CTA Button Preview */
                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between gap-3 shadow-2xs">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {promo.content}
                        </span>
                        <span className="px-2.5 py-1 bg-blue-600 text-white font-bold text-[11px] rounded-lg shadow-2xs shrink-0 flex items-center gap-1">
                          <span>Action</span>
                          <ArrowUpRight size={11} weight="bold" />
                        </span>
                      </div>
                    ) : promo.type === 'toast_text' ? (
                      /* Floating Toast Banner Preview */
                      <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 text-blue-950 dark:text-blue-100 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                          <span className="text-xs font-semibold truncate">{promo.content}</span>
                        </div>
                        <ArrowUpRight size={13} weight="bold" className="shrink-0 text-blue-500 opacity-80" />
                      </div>
                    ) : (
                      /* News Spotlight Preview */
                      <div className="p-3 rounded-xl bg-zinc-900 text-white dark:bg-zinc-800 border border-zinc-800 dark:border-zinc-700 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-white/20 text-white font-extrabold text-[9px] uppercase tracking-wider shrink-0">
                            Spotlight
                          </span>
                          <span className="text-xs font-medium truncate text-zinc-100">{promo.content}</span>
                        </div>
                        <ArrowUpRight size={13} weight="bold" className="shrink-0 text-zinc-400" />
                      </div>
                    )}
                  </div>

                  {/* Destination Pill & Target Sectors */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    {promo.link_target && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                        <ArrowUpRight size={11} weight="bold" className="text-blue-500" />
                        <span className="capitalize">{promo.link_type || 'link'}:</span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200">{promo.link_target}</span>
                      </span>
                    )}

                    {promo.target_sectors && promo.target_sectors.length > 0 && (
                      promo.target_sectors.map((sector) => (
                        <span
                          key={sector}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-semibold border border-blue-200/50 dark:border-blue-800/50"
                        >
                          <MapPin size={10} weight="bold" />
                          <span>{sector}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* ── Footer: Metrics & Toggle Switch ─────────────────────── */}
                <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                  {/* Metrics Bar */}
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1" title="Impressions">
                      <Eye size={14} className="text-zinc-400" />
                      <strong className="text-zinc-700 dark:text-zinc-200 font-bold tabular-nums">
                        {promo.impressions}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1" title="Clicks">
                      <Cursor size={14} className="text-zinc-400" />
                      <strong className="text-zinc-700 dark:text-zinc-200 font-bold tabular-nums">
                        {promo.clicks}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1" title="Click-Through Rate">
                      <TrendUp size={14} className="text-zinc-400" />
                      <strong className="text-zinc-700 dark:text-zinc-200 font-bold tabular-nums">
                        {ctr}%
                      </strong>
                    </span>
                  </div>

                  {/* Modern Active Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleActive(promo)
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      promo.is_active
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${promo.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                    <span>{promo.is_active ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Studio Modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <PromotionModal
          promo={editingPromo}
          onClose={() => {
            setShowModal(false)
            setEditingPromo(null)
          }}
          onSaved={() => {
            setShowModal(false)
            setEditingPromo(null)
            fetchPromotions()
          }}
        />
      )}
    </div>
  )
}

function PromotionModal({
  promo,
  onClose,
  onSaved,
}: {
  promo: Promotion | null
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: promo?.title || '',
    description: promo?.description || '',
    type: promo?.type || ('button' as const),
    content: promo?.content || '',
    link_type: promo?.link_type || 'project',
    link_target: promo?.link_target || '',
    image_url: promo?.image_url || '',
    starts_at: promo?.starts_at
      ? new Date(promo.starts_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    ends_at: promo?.ends_at
      ? new Date(promo.ends_at).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_active: promo ? promo.is_active : true,
    target_sectors_str: promo?.target_sectors ? promo.target_sectors.join(', ') : '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Title and Content are required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        type: formData.type,
        content: formData.content.trim(),
        link_type: formData.link_type || null,
        link_target: formData.link_target.trim() || null,
        image_url: formData.image_url.trim() || null,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: new Date(formData.ends_at).toISOString(),
        is_active: formData.is_active,
        target_sectors: formData.target_sectors_str
          ? formData.target_sectors_str.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      }

      const url = promo ? `/admin/promotions/${promo.id}` : '/admin/promotions'
      const method = promo ? 'PATCH' : 'POST'

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success(promo ? 'Promotion updated successfully' : 'Promotion created successfully')
        onSaved()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || 'Failed to save promotion')
      }
    } catch (err) {
      console.error('Save failed:', err)
      toast.error('Failed to save promotion')
    } finally {
      setSaving(false)
    }
  }

  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  const daysDuration = useMemo(() => {
    try {
      const s = new Date(formData.starts_at).getTime()
      const e = new Date(formData.ends_at).getTime()
      const diff = Math.round((e - s) / (1000 * 60 * 60 * 24))
      return diff > 0 ? diff : 0
    } catch {
      return 0
    }
  }, [formData.starts_at, formData.ends_at])

  const quickSectors = ['Sector 150', 'Yamuna Expressway', 'Sector 128', 'Noida Expressway', 'Golf Course Ext']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
        onClick={onClose}
      />

      <m.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="relative w-full max-w-4xl lg:max-w-5xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 flex flex-col my-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Mode Toggle & Pinned Actions (Parity with Blog Modal) */}
        <div className="px-6 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/20 shadow-2xs">
              <Megaphone size={18} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white tracking-tight truncate">
                  {promo ? 'Edit Campaign' : 'New Campaign'}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  formData.is_active
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {formData.is_active ? 'Live Now' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium truncate max-w-sm">
                {formData.title || 'Configure creative, targeting, and live schedule'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Segmented Mode Toggle */}
            <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'edit'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Studio Editor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Live Preview
              </button>
            </div>

            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer hidden sm:block"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs hover:bg-black dark:hover:bg-zinc-100 shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {saving ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white/40 dark:border-zinc-900/40 border-t-white dark:border-t-zinc-900 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{promo ? 'Save Changes' : 'Launch'}</span>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === 'preview' ? (
          /* Live Buyer Full Simulation View */
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
            <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 p-7 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60">
                  Discovery Simulation
                </span>
                <span className="text-[11px] text-zinc-400 font-medium">Format: {formData.type.toUpperCase()}</span>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Target: {formData.target_sectors_str || 'Sitewide (All Corridors)'}
                </p>
                <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                  {formData.title || 'Untitled Campaign'}
                </h3>
                {formData.description && (
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    {formData.description}
                  </p>
                )}
              </div>

              {/* Component Simulation */}
              <div className="pt-2">
                {formData.type === 'button' ? (
                  <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-between gap-3 shadow-2xs">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {formData.content || 'Click here to explore inventory'}
                    </span>
                    <button
                      type="button"
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-2xs shrink-0 flex items-center gap-1"
                    >
                      <span>Explore</span>
                      <ArrowUpRight size={13} weight="bold" />
                    </button>
                  </div>
                ) : formData.type === 'toast_text' ? (
                  <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-blue-950 dark:text-blue-100 flex items-center justify-between gap-3 shadow-2xs text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                      <span className="font-semibold truncate">{formData.content || 'Special Announcement Headline'}</span>
                    </div>
                    <ArrowUpRight size={14} weight="bold" className="shrink-0 text-blue-500 opacity-80" />
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-800 border border-zinc-700 flex items-center justify-between gap-3 shadow-2xs text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-white/20 text-white font-extrabold text-[9px] uppercase tracking-wider shrink-0">
                        Spotlight
                      </span>
                      <span className="font-medium truncate text-zinc-100">{formData.content || 'Live Announcement Headline'}</span>
                    </div>
                    <ArrowUpRight size={14} weight="bold" className="shrink-0 text-zinc-400" />
                  </div>
                )}
              </div>

              {formData.link_target && (
                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-2">
                  <ArrowUpRight size={13} className="text-blue-500" />
                  <span>Links to {formData.link_type}:</span>
                  <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{formData.link_target}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Horizontal Two-Column Split Workspace (Left: 58%, Right: 42%) */
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800 min-h-0">
            {/* Left Column: Creative & Targeting (58%) */}
            <div className="md:col-span-7 p-5 sm:p-6 space-y-4 overflow-y-auto bg-white dark:bg-zinc-900">
              {/* Campaign Title */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ready-to-Move Registry Assurance Program"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-base font-extrabold bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-600 outline-none pb-1.5 border-b border-zinc-100 dark:border-zinc-800 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              {/* Placement Format (Segmented 3-pill toggle) */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Display Format *
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/70 dark:border-zinc-700/70">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'button' })}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                      formData.type === 'button'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Action Button
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'toast_text' })}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                      formData.type === 'toast_text'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Toast Banner
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'news_feature' })}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                      formData.type === 'news_feature'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Spotlight
                  </button>
                </div>
              </div>

              {/* Display Content / CTA Copy */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Buyer Display Copy *
                  </label>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {formData.content.length} chars
                  </span>
                </div>
                <textarea
                  placeholder="The exact message or call to action displayed to buyers..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs font-medium bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all resize-none leading-relaxed"
                  rows={2}
                  required
                />
              </div>

              {/* Internal Notes / Subtitle */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Internal Notes / Subtitle
                </label>
                <input
                  type="text"
                  placeholder="e.g. Exclusive inventory with OC obtained and guaranteed zero builder authority dues."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-medium bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Destination Link Target */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Link Type
                  </label>
                  <CustomSelect
                    value={formData.link_type}
                    onChange={(val) => setFormData({ ...formData, link_type: val })}
                    options={[
                      { value: 'project', label: 'Project Slug' },
                      { value: 'builder', label: 'Builder Page' },
                      { value: 'external_url', label: 'External URL' },
                    ]}
                    size="sm"
                    className="w-full"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Destination Target
                  </label>
                  <input
                    type="text"
                    placeholder={formData.link_type === 'external_url' ? 'https://...' : 'e.g. godrej-aristocrat'}
                    value={formData.link_target}
                    onChange={(e) => setFormData({ ...formData, link_target: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs font-mono bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Target Sectors with Quick Add Chips */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Target Sectors (comma-separated, blank = sitewide)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sector 150, Sector 128, Yamuna Expressway"
                  value={formData.target_sectors_str}
                  onChange={(e) => setFormData({ ...formData, target_sectors_str: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-medium bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-white outline-none focus:border-blue-500"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-zinc-400 font-semibold">Quick add:</span>
                  {quickSectors.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        const current = formData.target_sectors_str
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                        if (!current.includes(sec)) {
                          setFormData({
                            ...formData,
                            target_sectors_str: current.length ? `${current.join(', ')}, ${sec}` : sec,
                          })
                        }
                      }}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 border border-zinc-200/70 dark:border-zinc-700/70 transition-colors cursor-pointer"
                    >
                      + {sec}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Live Buyer Preview & Flight Schedule (42%) */}
            <div className="md:col-span-5 p-5 sm:p-6 space-y-3.5 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/40">
              {/* Card 1: Live Buyer Preview Box */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Live Buyer Preview
                  </span>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60">
                    Simulated View
                  </span>
                </div>

                {formData.type === 'button' ? (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-between gap-3 shadow-2xs">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {formData.content || 'Action button message preview'}
                    </span>
                    <span className="px-2.5 py-1 bg-blue-600 text-white font-bold text-[11px] rounded-lg shadow-2xs shrink-0 flex items-center gap-1">
                      <span>Action</span>
                      <ArrowUpRight size={11} weight="bold" />
                    </span>
                  </div>
                ) : formData.type === 'toast_text' ? (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-blue-950 dark:text-blue-100 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                      <span className="font-semibold truncate">{formData.content || 'Toast Banner message preview'}</span>
                    </div>
                    <ArrowUpRight size={13} weight="bold" className="shrink-0 text-blue-500 opacity-80" />
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-900 text-white dark:bg-zinc-800 rounded-xl border border-zinc-800 dark:border-zinc-700 flex items-center justify-between gap-3 shadow-2xs text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-white/20 text-white font-extrabold text-[9px] uppercase tracking-wider shrink-0">
                        Spotlight
                      </span>
                      <span className="font-medium truncate text-zinc-100">{formData.content || 'News Headline preview'}</span>
                    </div>
                    <ArrowUpRight size={13} weight="bold" className="shrink-0 text-zinc-400" />
                  </div>
                )}
                <p className="text-[10px] text-zinc-400 font-medium">
                  Previews exact rendering shown to home buyers in discovery.
                </p>
              </div>

              {/* Card 2: Flight Schedule & Lifecycle */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Flight Schedule & Lifecycle
                  </span>
                  {daysDuration > 0 && (
                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                      {daysDuration} days flight
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Starts At
                    </label>
                    <input
                      type="date"
                      value={formData.starts_at}
                      onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-white outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Ends At
                    </label>
                    <input
                      type="date"
                      value={formData.ends_at}
                      onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-white outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Active Status</p>
                    <p className="text-[10px] text-zinc-400">Launch campaign immediately</p>
                  </div>
                  <input
                    type="checkbox"
                    id="is_active_modal"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Card 3: Performance Intelligence or Placement Guide */}
              {promo ? (
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Audience Engagement
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Live Telemetry
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-400 font-semibold uppercase">Views</p>
                      <p className="text-sm font-extrabold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                        {promo.impressions.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-400 font-semibold uppercase">Clicks</p>
                      <p className="text-sm font-extrabold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                        {promo.clicks.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-400 font-semibold uppercase">CTR</p>
                      <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                        {promo.impressions > 0 ? ((promo.clicks / promo.impressions) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Placement Optimization
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    {formData.type === 'button'
                      ? 'Action Buttons deliver direct lead inquiries to high-intent project pages.'
                      : formData.type === 'toast_text'
                      ? 'Toast Banners maintain continuous visibility for advisory and legal alerts.'
                      : 'News Spotlights generate maximum credibility for corridor & regulatory reports.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </m.div>
    </div>
  )
}
