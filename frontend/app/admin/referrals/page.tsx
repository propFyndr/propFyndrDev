'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/adminFetch'
import { 
  Copy, 
  Check, 
  Plus, 
  Link as LinkIcon, 
  Search, 
  ExternalLink, 
  Share2, 
  RotateCcw, 
  X, 
  ArrowUpDown, 
  ChevronRight, 
  ShieldCheck, 
  Users, 
  Zap, 
  GitBranch, 
  Sparkles, 
  AlertCircle, 
  MessageSquare, 
  Smartphone, 
  Calendar,
  Layers,
  Send,
  HelpCircle,
} from 'lucide-react'
import { AnimatePresence, m } from 'framer-motion'
import { toast } from 'sonner'
import { StatCard } from '@/components/portal/ui'

interface ReferralLinkRow {
  code: string
  label: string | null
  greetingName?: string | null
  note?: string | null
  createdAt: string
  revoked: boolean
  devicesReached: number
  deepestGeneration: number
  activatedCount: number
  lastActivity: string | null
  hasHolder?: boolean
}

type FilterTag = 'all' | 'active' | 'with_devices' | 'activated' | 'revoked'
type SortField = 'createdAt' | 'devicesReached' | 'deepestGeneration' | 'activatedCount' | 'label'

const PRESET_LABELS = [
  { label: 'Friend & Family', icon: '🤝' },
  { label: 'WhatsApp Community', icon: '💬' },
  { label: 'LinkedIn Post', icon: '💼' },
  { label: 'Channel Partner', icon: '🏢' },
  { label: 'Campus / Alumni', icon: '🎓' },
  { label: 'Direct Buyer Lead', icon: '🎯' },
]

export default function ReferralsAdminPage() {
  const [links, setLinks] = useState<ReferralLinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'mine' | 'all'>('all')
  const [query, setQuery] = useState('')
  const [filterTag, setFilterTag] = useState<FilterTag>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Generation form state
  const [showGenerate, setShowGenerate] = useState(false)
  const [label, setLabel] = useState('')
  const [greetingName, setGreetingName] = useState('')
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState<string | null>(null)
  const [newLinkCode, setNewLinkCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Confirmation modal states
  const [revokingCode, setRevokingCode] = useState<string | null>(null)
  const [resettingCode, setResettingCode] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`/admin/referrals?scope=${scope}`)
      if (res.ok) {
        const data = await res.json()
        setLinks(data.links || [])
      } else {
        toast.error('Failed to load referral links')
      }
    } catch {
      toast.error('Network error loading referrals')
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    load()
  }, [load])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape') {
        if (showGenerate) setShowGenerate(false)
        if (revokingCode) setRevokingCode(null)
        if (resettingCode) setResettingCode(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showGenerate, revokingCode, resettingCode])

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!label.trim()) {
      toast.error('Please enter a campaign label')
      return
    }
    setCreating(true)
    try {
      const res = await adminFetch('/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          label: label.trim(), 
          greetingName: greetingName.trim() || undefined,
          note: note.trim() || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const fullUrl = `${window.location.origin}${data.url}`
        setNewLinkUrl(fullUrl)
        setNewLinkCode(data.code)
        toast.success('Referral link generated!')
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to generate link')
      }
    } catch {
      toast.error('Error creating referral link')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setLabel('')
    setGreetingName('')
    setNote('')
    setNewLinkUrl(null)
    setNewLinkCode(null)
    setShowGenerate(false)
  }

  const handleCopy = (text: string, id: string, message = 'Link copied to clipboard') => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedCode(id)
        toast.success(message)
        setTimeout(() => setCopiedCode((curr) => (curr === id ? null : curr)), 2000)
      }).catch(() => {
        toast.error('Failed to copy to clipboard')
      })
    }
  }

  const handleRevokeConfirm = async () => {
    if (!revokingCode) return
    setActionLoading(true)
    try {
      const res = await adminFetch(`/admin/referrals/${revokingCode}/revoke`, { method: 'POST' })
      if (res.ok) {
        toast.success('Referral link revoked')
        setRevokingCode(null)
        load()
      } else {
        toast.error('Failed to revoke link')
      }
    } catch {
      toast.error('Error communicating with server')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetHolderConfirm = async () => {
    if (!resettingCode) return
    setActionLoading(true)
    try {
      const res = await adminFetch(`/admin/referrals/${resettingCode}/reset-holder`, { method: 'POST' })
      if (res.ok) {
        toast.success('Holder device reset. Link is fresh for new recipients.')
        setResettingCode(null)
        load()
      } else {
        toast.error('Failed to reset holder')
      }
    } catch {
      toast.error('Error communicating with server')
    } finally {
      setActionLoading(false)
    }
  }

  // Summary Metrics Computation
  const metrics = useMemo(() => {
    const total = links.length
    const activeCount = links.filter((l) => !l.revoked).length
    const revokedCount = links.filter((l) => l.revoked).length
    const totalDevices = links.reduce((sum, l) => sum + (l.devicesReached || 0), 0)
    const deepestGen = links.reduce((max, l) => Math.max(max, l.deepestGeneration || 0), 0)
    const totalActivated = links.reduce((sum, l) => sum + (l.activatedCount || 0), 0)
    const activationPct = totalDevices > 0 ? Math.round((totalActivated / totalDevices) * 100) : 0
    const avgReach = total > 0 ? (totalDevices / total).toFixed(1) : '0'

    return {
      total,
      activeCount,
      revokedCount,
      totalDevices,
      deepestGen,
      totalActivated,
      activationPct,
      avgReach,
    }
  }, [links])

  // Filtered links
  const filtered = useMemo(() => {
    return links.filter((link) => {
      if (filterTag === 'active' && link.revoked) return false
      if (filterTag === 'revoked' && !link.revoked) return false
      if (filterTag === 'with_devices' && (link.devicesReached || 0) === 0) return false
      if (filterTag === 'activated' && (link.activatedCount || 0) === 0) return false

      if (query.trim()) {
        const q = query.toLowerCase().trim()
        const matchLabel = link.label?.toLowerCase().includes(q)
        const matchCode = link.code.toLowerCase().includes(q)
        const matchGreeting = link.greetingName?.toLowerCase().includes(q)
        const matchNote = link.note?.toLowerCase().includes(q)
        return matchLabel || matchCode || matchGreeting || matchNote
      }
      return true
    })
  }, [links, filterTag, query])

  // Sorted links
  const sortedAndFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'label') {
        cmp = (a.label || a.code).localeCompare(b.label || b.code)
      } else if (sortField === 'devicesReached') {
        cmp = (a.devicesReached || 0) - (b.devicesReached || 0)
      } else if (sortField === 'deepestGeneration') {
        cmp = (a.deepestGeneration || 0) - (b.deepestGeneration || 0)
      } else if (sortField === 'activatedCount') {
        cmp = (a.activatedCount || 0) - (b.activatedCount || 0)
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortField, sortOrder])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const getInitials = (text: string) => {
    return text
      .split(/[\s–-]+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'RF'
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0 font-sans select-none space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-1">
            <span>Overview</span>
            <span>/</span>
            <span className="text-[#0066cc] dark:text-[#2997ff]">Referrals</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            Referral Links
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#86868b] mt-1">
            Generate viral attribution links, monitor multigenerational cascade, and track buyer conversions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              if (showGenerate) {
                resetForm()
              } else {
                setShowGenerate(true)
              }
            }}
            className="flex items-center gap-2 bg-[#0066cc] hover:bg-[#0055b3] text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            {showGenerate ? <X size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
            <span>{showGenerate ? 'Close' : 'Generate Link'}</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards — Identical high-craft layout to Builders & Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Campaigns"
          value={metrics.total}
          icon={<LinkIcon size={18} />}
          hint={`${metrics.activeCount} active · ${metrics.revokedCount} revoked`}
          loading={loading}
        />
        <StatCard
          label="Viral Reach"
          value={metrics.totalDevices}
          icon={<Users size={18} />}
          hint={`${metrics.avgReach} devices / link avg`}
          loading={loading}
        />
        <StatCard
          label="Deepest Cascade"
          value={`Gen ${metrics.deepestGen}`}
          tone={metrics.deepestGen > 1 ? 'good' : 'neutral'}
          icon={<GitBranch size={18} />}
          hint={metrics.deepestGen > 1 ? 'Multigenerational spread' : 'Direct recipients only'}
          loading={loading}
        />
        <StatCard
          label="Activated Users"
          value={metrics.totalActivated}
          tone={metrics.activationPct > 0 ? 'good' : 'neutral'}
          icon={<Zap size={18} />}
          hint={`${metrics.activationPct}% overall conversion`}
          loading={loading}
        />
      </div>

      {/* Generator Drawer / Form */}
      <AnimatePresence>
        {showGenerate && (
          <m.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-[#e5e5ea] dark:border-[#2c2c2e] p-6 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[#e5e5ea] dark:border-[#2c2c2e] pb-3.5 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Create New Referral Campaign
                  </h3>
                  <p className="text-[11px] text-[#86868b]">
                    Unique cryptographic link that tracks multi-tier viral trees while preserving user privacy.
                  </p>
                </div>
              </div>
              <button
                onClick={resetForm}
                className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick preset chips */}
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block mb-2">
                Quick Preset Templates
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_LABELS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setLabel(preset.label)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#f5f5f7] dark:bg-[#242426] hover:bg-[#e5e5ea] dark:hover:bg-[#38383a] text-[#1d1d1f] dark:text-[#f5f5f7] border border-[#e5e5ea] dark:border-[#38383a] transition-all cursor-pointer"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1.5">
                    Campaign / Recipient Label <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Rahul – IIT Alumni, Noida Investors WhatsApp"
                    maxLength={60}
                    className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
                  />
                  <p className="text-[11px] text-[#86868b] mt-1">
                    Internal name visible to admins in the dashboard.
                  </p>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1.5">
                    From Name / Greeting <span className="text-[#86868b] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={greetingName}
                    onChange={(e) => setGreetingName(e.target.value)}
                    placeholder="e.g. Furqan, PropFyndr Team"
                    maxLength={60}
                    className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
                  />
                  <p className="text-[11px] text-[#86868b] mt-1">
                    Visitor sees: &quot;Your friend {greetingName || 'Furqan'} invited you to PropFyndr&quot;.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1.5">
                  Internal Notes &amp; Distribution Channel <span className="text-[#86868b] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Sent via DM on WhatsApp to verify sector 150 buyer interest"
                  maxLength={120}
                  className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !label.trim()}
                  className="flex items-center gap-2 bg-[#0066cc] hover:bg-[#0055b3] disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                >
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus size={15} />
                  )}
                  <span>Generate Link</span>
                </button>
              </div>
            </form>

            {/* Generated Link Success Shelf */}
            {newLinkUrl && (
              <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <Check size={14} className="text-emerald-600" />
                    Link Ready for Distribution
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                    code: {newLinkCode}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-black/40 border border-emerald-500/30 text-xs font-mono text-[#1d1d1f] dark:text-[#f5f5f7] truncate select-all">
                    {newLinkUrl}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(newLinkUrl, 'new-link')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0066cc] hover:bg-[#0055b3] text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      {copiedCode === 'new-link' ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedCode === 'new-link' ? 'Copied' : 'Copy Link'}</span>
                    </button>

                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Hey! Check out PropFyndr to explore verified properties and get unbiased RERA & price analysis: ${newLinkUrl}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Share2 size={14} />
                      <span>WhatsApp</span>
                    </a>

                    <a
                      href={`${newLinkUrl}?preview=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open safely without recording a visit or making you the holder device"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#242426] hover:bg-zinc-100 dark:hover:bg-[#38383a] text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <ExternalLink size={14} />
                      <span>Safe Preview</span>
                    </a>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-800 dark:text-emerald-400/90">
                  Tip: Always use &quot;Safe Preview&quot; when checking links yourself, otherwise your browser will bind as the holder device.
                </p>
              </m.div>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns by label, code, or creator (⌘F)..."
            className="w-full h-10 pl-10 pr-9 rounded-xl text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/70 shadow-2xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] p-0.5 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Scope and Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope Segmented Control */}
          <div className="flex items-center p-1 rounded-xl bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a]">
            <button
              onClick={() => setScope('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                scope === 'all'
                  ? 'bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-2xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
              }`}
            >
              All Links
            </button>
            <button
              onClick={() => setScope('mine')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                scope === 'mine'
                  ? 'bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-2xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
              }`}
            >
              Created by Me
            </button>
          </div>

          {/* Filter Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'with_devices', label: 'With Visits' },
                { id: 'activated', label: 'Activated' },
                { id: 'revoked', label: 'Revoked' },
              ] as const
            ).map((tag) => (
              <button
                key={tag.id}
                onClick={() => setFilterTag(tag.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filterTag === tag.id
                    ? 'bg-[#0066cc] text-white shadow-2xs'
                    : 'bg-[#f5f5f7] dark:bg-[#242426] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] border border-[#e5e5ea] dark:border-[#38383a]'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-2xs overflow-hidden">
        {/* Table Header with Column Sorting */}
        <div className="flex items-center px-6 py-3.5 bg-[#f5f5f7]/80 dark:bg-[#242426]/60 border-b border-[#e5e5ea] dark:border-[#2c2c2e] text-[11px] font-semibold text-[#86868b] uppercase tracking-wider select-none">
          <div className="w-10 mr-4" />

          <button
            onClick={() => toggleSort('label')}
            className="flex-1 flex items-center gap-1.5 hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer text-left"
          >
            <span>Campaign / Code</span>
            <ArrowUpDown size={12} className={sortField === 'label' ? 'text-[#0066cc]' : 'text-[#86868b]'} />
          </button>

          <button
            onClick={() => toggleSort('devicesReached')}
            className="w-28 hidden sm:flex items-center justify-end gap-1.5 pr-4 hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Viral Reach</span>
            <ArrowUpDown size={12} className={sortField === 'devicesReached' ? 'text-[#0066cc]' : 'text-[#86868b]'} />
          </button>

          <button
            onClick={() => toggleSort('deepestGeneration')}
            className="w-28 hidden md:flex items-center justify-end gap-1.5 pr-4 hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Deepest Gen</span>
            <ArrowUpDown size={12} className={sortField === 'deepestGeneration' ? 'text-[#0066cc]' : 'text-[#86868b]'} />
          </button>

          <button
            onClick={() => toggleSort('activatedCount')}
            className="w-28 hidden sm:flex items-center justify-end gap-1.5 pr-4 hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Activated</span>
            <ArrowUpDown size={12} className={sortField === 'activatedCount' ? 'text-[#0066cc]' : 'text-[#86868b]'} />
          </button>

          <button
            onClick={() => toggleSort('createdAt')}
            className="w-32 hidden lg:flex items-center gap-1.5 pr-4 hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Last Activity</span>
            <ArrowUpDown size={12} className={sortField === 'createdAt' ? 'text-[#0066cc]' : 'text-[#86868b]'} />
          </button>

          <div className="w-44 text-right pr-2">
            <span>Actions</span>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-[#e5e5ea] dark:divide-[#2c2c2e]">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-medium text-[#86868b]">Loading referral campaigns…</p>
            </div>
          ) : sortedAndFiltered.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] dark:bg-[#242426] flex items-center justify-center text-[#86868b] mb-3">
                <LinkIcon size={22} />
              </div>
              <p className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {query || filterTag !== 'all' ? 'No matching referral links' : 'No referral campaigns generated yet'}
              </p>
              <p className="text-xs text-[#86868b] mt-1 max-w-sm">
                {query || filterTag !== 'all'
                  ? 'Try clearing your search query or switching filter tabs.'
                  : 'Create your first referral link above to begin tracking viral invitations.'}
              </p>
              {!showGenerate && (
                <button
                  onClick={() => setShowGenerate(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#0066cc] text-white text-xs font-semibold hover:bg-[#0055b3] transition-all cursor-pointer"
                >
                  Generate First Link
                </button>
              )}
            </div>
          ) : (
            sortedAndFiltered.map((link) => {
              const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${link.code}` : `/r/${link.code}`
              const isCopied = copiedCode === link.code

              return (
                <div
                  key={link.code}
                  className="flex items-center px-6 py-4 hover:bg-[#f5f5f7]/50 dark:hover:bg-[#242426]/40 transition-colors group select-text"
                >
                  {/* Squircle Avatar */}
                  <div
                    className={`w-10 h-10 mr-4 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs border transition-all ${
                      link.revoked
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
                        : link.devicesReached > 0
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-[#0066cc] dark:text-[#2997ff] border-blue-200/80 dark:border-blue-800/60 shadow-2xs'
                        : 'bg-[#f5f5f7] dark:bg-[#242426] text-[#86868b] border-[#e5e5ea] dark:border-[#38383a]'
                    }`}
                  >
                    {link.label ? getInitials(link.label) : <LinkIcon size={16} />}
                  </div>

                  {/* Campaign / Details */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/admin/referrals/${link.code}`}
                        className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors truncate"
                      >
                        {link.label || `Campaign ${link.code}`}
                      </Link>

                      {link.revoked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80">
                          Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                          Active
                        </span>
                      )}

                      {link.hasHolder && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60">
                          Holder Bound
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-[#86868b]">
                      <button
                        type="button"
                        onClick={() => handleCopy(fullUrl, link.code, `Copied /r/${link.code}`)}
                        className="font-mono text-[#0066cc] dark:text-[#2997ff] hover:underline flex items-center gap-1 cursor-pointer"
                        title="Click to copy link"
                      >
                        {link.code}
                        {isCopied ? <Check size={10} /> : <Copy size={10} />}
                      </button>

                      <span>•</span>
                      <span>{new Date(link.createdAt).toLocaleDateString()}</span>

                      {link.greetingName && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            greeting: &quot;{link.greetingName}&quot;
                          </span>
                        </>
                      )}

                      {link.note && (
                        <>
                          <span>•</span>
                          <span className="italic truncate max-w-xs">{link.note}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reach (Devices) */}
                  <div className="w-28 hidden sm:flex items-center justify-end pr-4">
                    <span className="text-xs font-mono font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums flex items-center gap-1.5">
                      <Smartphone size={13} className="text-[#86868b]" />
                      {link.devicesReached}
                      <span className="text-[10px] font-sans font-normal text-[#86868b]">dev</span>
                    </span>
                  </div>

                  {/* Deepest Gen */}
                  <div className="w-28 hidden md:flex items-center justify-end pr-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                        link.deepestGeneration > 1
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                          : link.deepestGeneration === 1
                          ? 'bg-blue-500/10 text-[#0066cc] dark:text-[#2997ff] border-[#0066cc]/20'
                          : 'bg-[#f5f5f7] dark:bg-[#242426] text-[#86868b] border-[#e5e5ea] dark:border-[#38383a]'
                      }`}
                    >
                      {link.deepestGeneration > 1 && <Sparkles size={11} className="text-emerald-500" />}
                      Gen {link.deepestGeneration}
                    </span>
                  </div>

                  {/* Activated */}
                  <div className="w-28 hidden sm:flex items-center justify-end pr-4">
                    <span
                      className={`text-xs font-mono font-bold tabular-nums flex items-center gap-1 ${
                        link.activatedCount > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[#86868b]'
                      }`}
                    >
                      {link.activatedCount > 0 && <Zap size={12} className="text-emerald-500 fill-emerald-500" />}
                      {link.activatedCount}
                      <span className="text-[10px] font-sans font-normal text-[#86868b]">
                        ({link.devicesReached > 0 ? Math.round((link.activatedCount / link.devicesReached) * 100) : 0}%)
                      </span>
                    </span>
                  </div>

                  {/* Last Activity */}
                  <div className="w-32 hidden lg:flex items-center pr-4">
                    <span className="text-xs font-medium text-[#86868b] truncate">
                      {link.lastActivity ? new Date(link.lastActivity).toLocaleDateString() : '—'}
                    </span>
                  </div>

                  {/* Actions Column */}
                  <div className="w-44 flex items-center justify-end gap-1.5 pr-2">
                    {/* Copy button */}
                    <button
                      type="button"
                      onClick={() => handleCopy(fullUrl, link.code, 'Copied link URL')}
                      className="p-1.5 rounded-lg text-[#86868b] hover:text-[#0066cc] hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                      title="Copy referral link"
                    >
                      {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>

                    {/* Preview button */}
                    <a
                      href={`${fullUrl}?preview=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#f5f5f7] dark:hover:bg-[#242426] transition-colors cursor-pointer"
                      title="Safe preview link without recording visit"
                    >
                      <ExternalLink size={14} />
                    </a>

                    {/* View Tree button */}
                    <Link
                      href={`/admin/referrals/${link.code}`}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f5f5f7] dark:bg-[#242426] hover:bg-[#e5e5ea] dark:hover:bg-[#38383a] text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] transition-all cursor-pointer"
                      title="Inspect referral tree"
                    >
                      <span>Tree</span>
                      <ChevronRight size={13} className="text-[#86868b]" />
                    </Link>

                    {/* Holder reset button if bound */}
                    {link.hasHolder && (
                      <button
                        type="button"
                        onClick={() => setResettingCode(link.code)}
                        className="p-1.5 rounded-lg text-[#86868b] hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                        title="Reset holder device (clear test bindings)"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}

                    {/* Revoke button */}
                    {!link.revoked && (
                      <button
                        type="button"
                        onClick={() => setRevokingCode(link.code)}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Revoke referral link"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      <AnimatePresence>
        {revokingCode && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setRevokingCode(null)}
          >
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-3xl p-6 shadow-xl border border-[#e5e5ea] dark:border-[#2c2c2e]"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Revoke Referral Link?
                  </h3>
                  <p className="text-xs font-mono text-[#86868b]">
                    Code: {revokingCode}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#86868b] leading-relaxed mb-6">
                New visitors arriving via this link will land without attribution. All existing referral tree nodes and device analytics will be permanently preserved.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRevokingCode(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRevokeConfirm}
                  disabled={actionLoading}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                >
                  {actionLoading ? 'Revoking…' : 'Yes, Revoke Link'}
                </button>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Holder Confirmation Modal */}
      <AnimatePresence>
        {resettingCode && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setResettingCode(null)}
          >
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-3xl p-6 shadow-xl border border-[#e5e5ea] dark:border-[#2c2c2e]"
            >
              <div className="flex items-center gap-3 text-amber-600 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Reset Holder Device?
                  </h3>
                  <p className="text-xs font-mono text-[#86868b]">
                    Code: {resettingCode}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#86868b] leading-relaxed mb-6">
                This unbinds the first device registered as this root link&apos;s holder. Useful if an admin accidentally opened the link during testing without preview mode.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResettingCode(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetHolderConfirm}
                  disabled={actionLoading}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                >
                  {actionLoading ? 'Resetting…' : 'Confirm Reset'}
                </button>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
