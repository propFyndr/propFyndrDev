'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  Eye,
  MousePointerClick,
  TrendingUp,
  Megaphone,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Layers,
  Calendar,
  Tag,
  Radio,
  Sliders,
  ChevronRight,
  BarChart2,
  X
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
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
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return

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
    return { label: 'Active', variant: 'active' as const }
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
    <div className="max-w-[1400px] mx-auto space-y-6 p-4 md:p-8">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2.5">
              <Megaphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Promotions & Campaigns
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 rounded-full">
              <span>{stats?.active ?? 0} Live Now</span>
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Manage high-intent discovery banners, sponsored CTA buttons, and spotlight announcements across PropFyndr.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingPromo(null)
            setShowModal(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Promotion</span>
        </button>
      </div>

      {/* ── Metric KPI Stats Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Campaigns */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Active Campaigns</span>
            <Radio className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-zinc-900 dark:text-white tabular-nums">
              {loading ? '—' : stats?.active ?? 0}
            </span>
            <span className="text-xs text-zinc-400">of {stats?.total ?? 0} total</span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">Currently being served to buyers</p>
        </div>

        {/* Total Impressions */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Total Impressions</span>
            <Eye className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {loading ? '—' : (stats?.impressions ?? 0).toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">Logged campaign views across discovery</p>
        </div>

        {/* Total Clicks */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Engaged Clicks</span>
            <MousePointerClick className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
              {loading ? '—' : (stats?.clicks ?? 0).toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">Direct buyer interactions</p>
        </div>

        {/* Average CTR */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Click-Through Rate (CTR)</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {loading ? '—' : `${stats?.ctr ?? 0}%`}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">Conversion efficiency ratio</p>
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search campaigns by title, copy, target sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('button')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                typeFilter === 'button'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              CTA Button
            </button>
            <button
              onClick={() => setTypeFilter('toast_text')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                typeFilter === 'toast_text'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              Toast Banner
            </button>
            <button
              onClick={() => setTypeFilter('news_feature')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                typeFilter === 'news_feature'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              News Spotlight
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'scheduled'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setStatusFilter('disabled')}
              className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'disabled'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              Disabled
            </button>
          </div>
        </div>
      </div>

      {/* ── Promotions Grid / Cards ──────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 space-y-4"
            >
              <div className="flex justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPromotions.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center max-w-2xl mx-auto shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto mb-4">
            <Megaphone className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'No matching campaigns found'
              : 'No promotions active yet'}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search terms or clearing the filters above.'
              : 'Create promotional CTA buttons, ticker announcements, or spotlight cards to engage home seekers across search results and property dossiers.'}
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => {
                setEditingPromo(null)
                setShowModal(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Promotion</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPromotions.map((promo) => {
            const status = getStatus(promo)
            const ctr = promo.impressions > 0 ? ((promo.clicks / promo.impressions) * 100).toFixed(1) : '0.0'

            return (
              <div
                key={promo.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Type Tag + Status Pill + Actions */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {promo.type === 'button'
                          ? 'CTA Button'
                          : promo.type === 'toast_text'
                          ? 'Toast Banner'
                          : 'News Spotlight'}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
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

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingPromo(promo)
                          setShowModal(true)
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                        title="Edit campaign"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(promo.id, promo.title)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                        title="Delete campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug">
                    {promo.title}
                  </h3>
                  {promo.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {promo.description}
                    </p>
                  )}

                  {/* Visual Copy Preview Box */}
                  <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-mono text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-3">
                    <span className="truncate">{promo.content}</span>
                    {promo.link_target && (
                      <span className="text-[10px] font-sans text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 shrink-0">
                        {promo.link_type}: {promo.link_target}
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {/* Target Sectors Chips */}
                  {promo.target_sectors && promo.target_sectors.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mr-1">
                        Sectors:
                      </span>
                      {promo.target_sectors.map((sector) => (
                        <span
                          key={sector}
                          className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium border border-blue-100 dark:border-blue-900/60"
                        >
                          {sector}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer: Live Metrics & Toggle Button */}
                <div className="mt-4 pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
                  {/* Metrics Bar */}
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    <span className="flex items-center gap-1" title="Impressions">
                      <Eye className="w-3.5 h-3.5 text-zinc-400" />
                      <strong className="text-zinc-700 dark:text-zinc-200">{promo.impressions}</strong>
                    </span>
                    <span className="flex items-center gap-1" title="Clicks">
                      <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
                      <strong className="text-zinc-700 dark:text-zinc-200">{promo.clicks}</strong>
                    </span>
                    <span className="flex items-center gap-1" title="CTR">
                      <BarChart2 className="w-3.5 h-3.5 text-zinc-400" />
                      <strong className="text-zinc-700 dark:text-zinc-200">{ctr}%</strong>
                    </span>
                  </div>

                  {/* Toggle Active Switch */}
                  <button
                    onClick={() => handleToggleActive(promo)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      promo.is_active
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    {promo.is_active ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal / Drawer for Creating & Editing Promotions ──────────────────── */}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-600" />
              {promo ? 'Edit Promotion Campaign' : 'Create New Promotion Campaign'}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Target specific sectors or show this promotion sitewide across AI search results.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Title & Placement Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Campaign Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Godrej Aristocrat Exclusive Launch"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Placement Type *
              </label>
              <CustomSelect
                value={formData.type}
                onChange={(val) => setFormData({ ...formData, type: val as any })}
                options={[
                  { value: 'button', label: 'Action Button' },
                  { value: 'toast_text', label: 'Toast Banner' },
                  { value: 'news_feature', label: 'News Spotlight' },
                ]}
                size="sm"
                className="w-full"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Internal Notes / Subtitle
            </label>
            <input
              type="text"
              placeholder="Internal campaign description or developer attribution"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Content / Copy */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Display Content / CTA Copy *
            </label>
            <textarea
              placeholder="The exact message or button text shown to buyers (e.g. 'View Pre-Launch Pricing on Sector 49' or '🔥 Limited 3BHK Inventories Available')"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              rows={2}
              required
            />
          </div>

          {/* Destination Link Target */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Link Type
              </label>
              <CustomSelect
                value={formData.link_type}
                onChange={(val) => setFormData({ ...formData, link_type: val })}
                options={[
                  { value: 'project', label: 'Project Slug / ID' },
                  { value: 'builder', label: 'Builder Page' },
                  { value: 'external_url', label: 'External URL' },
                ]}
                size="sm"
                className="w-full"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Link Destination
              </label>
              <input
                type="text"
                placeholder={formData.link_type === 'external_url' ? 'https://example.com' : 'e.g. godrej-aristocrat'}
                value={formData.link_target}
                onChange={(e) => setFormData({ ...formData, link_target: e.target.value })}
                className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Target Sectors */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Target Sectors (comma-separated, leave blank for all sectors)
            </label>
            <input
              type="text"
              placeholder="e.g. Sector 49, Sector 150, Golf Course Road"
              value={formData.target_sectors_str}
              onChange={(e) => setFormData({ ...formData, target_sectors_str: e.target.value })}
              className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Schedule Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Starts At
              </label>
              <input
                type="date"
                value={formData.starts_at}
                onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Ends At
              </label>
              <input
                type="date"
                value={formData.ends_at}
                onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Active Status Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
              Set campaign as Active immediately
            </label>
          </div>

          {/* Live Preview Box */}
          <div className="mt-4 p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Live Buyer Preview
            </span>
            {formData.type === 'button' ? (
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {formData.title || 'Campaign Title'}
                </span>
                <span className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg shadow-sm">
                  {formData.content || 'Action Button'}
                </span>
              </div>
            ) : (
              <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="font-bold">{formData.title || 'Announcement'}:</span>
                  <span className="font-normal opacity-90">{formData.content || 'Banner copy preview goes here...'}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75 shrink-0" />
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : promo ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
