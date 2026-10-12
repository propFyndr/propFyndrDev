'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/adminFetch'
import {
  ArrowLeft,
  Smartphone,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  Zap,
  GitBranch,
  Users,
  MessageSquare,
  ShieldCheck,
  FileText,
  X,
  ChevronRight,
  Share2,
} from 'lucide-react'
import { AnimatePresence, m } from 'framer-motion'
import { toast } from 'sonner'
import { StatCard } from '@/components/portal/ui'
import ReferralTree, { type ReferralTreeNode } from '@/components/admin/referrals/ReferralTree'
import TrendChart, { type Granularity, type TrendBucket } from '@/components/admin/referrals/TrendChart'

type TreeNode = ReferralTreeNode & { depthInferred: boolean }

interface NodeDrawerData {
  guestToken: string
  generation: number
  rootCode: string
  deviceClass: string
  os: string
  appGuess: string
  depthInferred: boolean
  firstSeenAt: string
  summary: { location: string | null; financial: string | null; timeline: string | null } | null
  actions: { callbacks: number; dossiersMade: number }
  chats: Array<{ id: string; messageCount: number; lastActive: string }>
}

export default function ReferralTreePage() {
  const params = useParams()
  const code = (params?.code as string) || ''
  
  const [rootLabel, setRootLabel] = useState<string | null>(null)
  const [rootRevoked, setRootRevoked] = useState(false)
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<NodeDrawerData | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Actions state
  const [revoking, setRevoking] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Trend chart + K-factor drill-down
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [trendBuckets, setTrendBuckets] = useState<TrendBucket[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [showKFactorDetail, setShowKFactorDetail] = useState(false)

  const loadTrend = useCallback(
    async (g: Granularity) => {
      if (!code) return
      setTrendLoading(true)
      try {
        const res = await adminFetch(`/admin/referrals/${code}/trends?granularity=${g}`)
        if (res.ok) {
          const data = await res.json()
          setTrendBuckets(data.buckets || [])
        }
      } catch {
        // non-fatal — trend chart just shows empty state
      } finally {
        setTrendLoading(false)
      }
    },
    [code],
  )

  useEffect(() => {
    loadTrend(granularity)
  }, [loadTrend, granularity])

  const loadTree = useCallback(async () => {
    if (!code) return
    setLoading(true)
    try {
      const res = await adminFetch(`/admin/referrals/${code}/tree`)
      if (res.ok) {
        const data = await res.json()
        setRootLabel(data.root?.label || null)
        setRootRevoked(Boolean(data.root?.revoked))
        setNodes(data.nodes || [])
      } else {
        toast.error('Could not load referral tree')
      }
    } catch {
      toast.error('Network error loading referral tree')
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    loadTree()
  }, [loadTree])

  const openNode = useCallback(async (guestToken: string) => {
    setDrawerLoading(true)
    try {
      const res = await adminFetch(`/admin/referrals/nodes/${guestToken}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedNode(data.node)
      } else {
        toast.error('Could not load visitor details')
      }
    } catch {
      toast.error('Network error fetching visitor node')
    } finally {
      setDrawerLoading(false)
    }
  }, [])

  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${code}` : `/r/${code}`

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setCopied(true)
        toast.success('Link copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const handleRevoke = async () => {
    if (!confirm('Revoke this link? New arrivals will land without attribution; the existing tree is preserved.')) return
    setRevoking(true)
    try {
      const res = await adminFetch(`/admin/referrals/${code}/revoke`, { method: 'POST' })
      if (res.ok) {
        toast.success('Link revoked')
        loadTree()
      } else {
        toast.error('Failed to revoke link')
      }
    } finally {
      setRevoking(false)
    }
  }

  const handleResetHolder = async () => {
    if (!confirm('Reset holder device? This unbinds any device previously recorded as the root holder.')) return
    setResetting(true)
    try {
      const res = await adminFetch(`/admin/referrals/${code}/reset-holder`, { method: 'POST' })
      if (res.ok) {
        toast.success('Holder reset successfully')
        loadTree()
      } else {
        toast.error('Failed to reset holder')
      }
    } finally {
      setResetting(false)
    }
  }

  // Per-generation K-factor drill-down: activated count at each generation,
  // and the simple ratio to the next (null where the denominator is zero —
  // shown as "—", matching referralGrowthMetrics.ts's computeKFactor contract).
  const perGenerationKFactor = useMemo(() => {
    const activatedByGen = new Map<number, number>()
    for (const n of nodes) {
      if (!n.activated) continue
      activatedByGen.set(n.generation, (activatedByGen.get(n.generation) ?? 0) + 1)
    }
    const gens = Array.from(activatedByGen.keys()).sort((a, b) => a - b)
    const rows: { generation: number; activatedCount: number; k: number | null }[] = []
    for (let i = 0; i < gens.length; i++) {
      const gen = gens[i]
      const count = activatedByGen.get(gen) ?? 0
      const next = gens[i + 1]
      const nextCount = next !== undefined ? activatedByGen.get(next) ?? 0 : null
      rows.push({ generation: gen, activatedCount: count, k: nextCount !== null && count > 0 ? nextCount / count : null })
    }
    return rows
  }, [nodes])

  // Channel/device breakdown — cross-tabs each channel against its activation rate.
  const channelBreakdown = useMemo(() => {
    const byChannel = new Map<string, { total: number; activated: number }>()
    for (const n of nodes) {
      const key = n.shareChannel || 'direct'
      const row = byChannel.get(key) ?? { total: 0, activated: 0 }
      row.total++
      if (n.activated) row.activated++
      byChannel.set(key, row)
    }
    return Array.from(byChannel.entries())
      .map(([channel, { total, activated }]) => ({ channel, total, activated, rate: total > 0 ? activated / total : 0 }))
      .sort((a, b) => b.total - a.total)
  }, [nodes])

  // Tree Metrics
  const metrics = useMemo(() => {
    const totalDevices = nodes.length
    const deepestGen = nodes.reduce((max, n) => Math.max(max, n.generation || 0), 0)
    const activatedCount = nodes.filter((n) => n.activated).length
    const directShares = nodes.filter((n) => n.generation === 1).length
    const totalMessages = nodes.reduce((sum, n) => sum + (n.messageCount || 0), 0)

    return { totalDevices, deepestGen, activatedCount, directShares, totalMessages }
  }, [nodes])

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0 font-sans select-none space-y-6">
      
      {/* Top Navigation & Breadcrumb */}
      <div>
        <Link
          href="/admin/referrals"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#86868b] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors active:scale-95 mb-3 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to All Referral Links</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs font-bold text-[#0066cc] dark:text-[#2997ff] bg-[#0066cc]/10 px-2.5 py-0.5 rounded-full border border-[#0066cc]/20">
                /r/{code}
              </span>
              {rootRevoked ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80">
                  Revoked
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                  Active
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
              {rootLabel || code}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#86868b] mt-1">
              Generational viral distribution tree and visitor attribution graph.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0066cc] hover:bg-[#0055b3] text-white text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>

            <a
              href={`${fullUrl}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#1c1c1e] hover:bg-[#f5f5f7] dark:hover:bg-[#242426] text-[#1d1d1f] dark:text-[#f5f5f7] border border-[#e5e5ea] dark:border-[#2c2c2e] text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
              title="Preview without recording visit"
            >
              <ExternalLink size={14} />
              <span>Safe Preview</span>
            </a>

            <button
              onClick={handleResetHolder}
              disabled={resetting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
              title="Reset holder device"
            >
              <RotateCcw size={14} />
              <span>Reset Holder</span>
            </button>

            {!rootRevoked && (
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Revoke</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Devices"
          value={metrics.totalDevices}
          icon={<Smartphone size={18} />}
          hint={`${metrics.directShares} direct · ${metrics.totalDevices - metrics.directShares} viral`}
          loading={loading}
        />
        <StatCard
          label="Viral Depth"
          value={`Gen ${metrics.deepestGen}`}
          tone={metrics.deepestGen > 1 ? 'good' : 'neutral'}
          icon={<GitBranch size={18} />}
          hint={metrics.deepestGen > 1 ? 'Cascading viral spread' : 'Direct recipients only'}
          loading={loading}
        />
        <StatCard
          label="Activated Visitors"
          value={metrics.activatedCount}
          tone={metrics.activatedCount > 0 ? 'good' : 'neutral'}
          icon={<Zap size={18} />}
          hint={metrics.totalDevices > 0 ? `${Math.round((metrics.activatedCount / metrics.totalDevices) * 100)}% conversion` : 'No visits'}
          loading={loading}
        />
        <StatCard
          label="Chat Messages"
          value={metrics.totalMessages}
          icon={<MessageSquare size={18} />}
          hint="Total across all chats"
          loading={loading}
        />
      </div>

      {/* Network Tree Visualizer */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] p-6">
        <div className="flex items-center justify-between border-b border-[#e5e5ea] dark:border-[#2c2c2e] pb-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
              <GitBranch size={18} className="text-[#0066cc]" />
              Generational Tree Hierarchy
            </h2>
            <p className="text-xs text-[#86868b] mt-0.5">
              Click any device node to open the visitor intelligence drawer.
            </p>
          </div>
          <span className="text-xs font-mono text-[#86868b] bg-[#f5f5f7] dark:bg-[#242426] px-3 py-1 rounded-full border border-[#e5e5ea] dark:border-[#38383a]">
            {nodes.length} total node{nodes.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium text-[#86868b]">Loading referral graph…</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] dark:bg-[#242426] flex items-center justify-center text-[#86868b] mb-3">
              <Share2 size={24} />
            </div>
            <p className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              No devices have arrived through this link yet
            </p>
            <p className="text-xs text-[#86868b] mt-1 max-w-sm">
              Share the link via WhatsApp or direct message. As recipients open it and share their personal links with others, the network tree will propagate here automatically.
            </p>
            <button
              onClick={handleCopyLink}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0066cc] text-white text-xs font-semibold hover:bg-[#0055b3] transition-all active:scale-[0.98] cursor-pointer"
            >
              <Copy size={14} />
              <span>Copy Link &amp; Share</span>
            </button>
          </div>
        ) : (
          <ReferralTree nodes={nodes} onSelectNode={openNode} />
        )}
      </div>

      {/* Trend + K-factor drill-down */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] p-6">
          <h2 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">Arrival Trend</h2>
          <TrendChart buckets={trendBuckets} granularity={granularity} onGranularityChange={setGranularity} loading={trendLoading} />
        </div>

        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] p-6">
          <button
            type="button"
            onClick={() => setShowKFactorDetail((v) => !v)}
            className="w-full flex items-center justify-between cursor-pointer active:scale-[0.99]"
          >
            <h2 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">K-Factor by Generation</h2>
            <ChevronRight size={14} className={`text-[#86868b] transition-transform ${showKFactorDetail ? 'rotate-90' : ''}`} />
          </button>
          {showKFactorDetail && (
            <div className="mt-3 space-y-1.5">
              {perGenerationKFactor.length === 0 ? (
                <p className="text-xs text-[#86868b] italic">No activated visitors yet.</p>
              ) : (
                perGenerationKFactor.map((row) => (
                  <div key={row.generation} className="flex items-center justify-between text-xs py-1.5 border-b border-[#e5e5ea]/60 dark:border-[#2c2c2e]/60 last:border-0">
                    <span className="font-mono text-[#86868b]">Gen {row.generation} → {row.generation + 1}</span>
                    <span className="font-mono font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {row.activatedCount} activated · {row.k === null ? '—' : row.k.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Channel / device breakdown */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] p-6">
        <h2 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">Channel Breakdown</h2>
        {channelBreakdown.length === 0 ? (
          <p className="text-xs text-[#86868b] italic">No visits yet.</p>
        ) : (
          <div className="space-y-2">
            {channelBreakdown.map((row) => (
              <div key={row.channel} className="flex items-center gap-3 text-xs">
                <span className="w-20 font-mono text-[#86868b] shrink-0">{row.channel}</span>
                <div className="flex-1 h-2 rounded-full bg-[#f5f5f7] dark:bg-[#242426] overflow-hidden">
                  <div className="h-full bg-[#0066cc]" style={{ width: `${Math.round(row.rate * 100)}%` }} />
                </div>
                <span className="font-mono text-[#1d1d1f] dark:text-[#f5f5f7] w-28 text-right shrink-0">
                  {row.activated}/{row.total} ({Math.round(row.rate * 100)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visitor Intelligence Drawer */}
      <AnimatePresence>
        {selectedNode && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50"
            onClick={() => setSelectedNode(null)}
          >
            <m.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md h-full bg-white dark:bg-[#1c1c1e] p-6 overflow-y-auto border-l border-[#e5e5ea] dark:border-[#2c2c2e] shadow-2xl flex flex-col justify-between"
            >
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea] dark:border-[#2c2c2e] mb-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-2 py-0.5 rounded-full border border-[#0066cc]/20">
                      Generation {selectedNode.generation}
                    </span>
                    <h2 className="text-xl font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] mt-1">
                      Visitor Dossier
                    </h2>
                    <p className="text-[11px] font-mono text-[#86868b] truncate max-w-xs mt-0.5">
                      token: {selectedNode.guestToken}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1.5 rounded-xl text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-[#f5f5f7] dark:hover:bg-[#242426] transition-colors active:scale-95 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Device & Client Profile */}
                <div className="p-4 rounded-2xl bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] mb-5">
                  <h3 className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Smartphone size={14} className="text-[#0066cc]" />
                    Device Profile
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#86868b] text-[11px] block">Device Class</span>
                      <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] capitalize">{selectedNode.deviceClass}</strong>
                    </div>
                    <div>
                      <span className="text-[#86868b] text-[11px] block">Operating System</span>
                      <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] capitalize">{selectedNode.os}</strong>
                    </div>
                    <div>
                      <span className="text-[#86868b] text-[11px] block">Client / App</span>
                      <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] capitalize">{selectedNode.appGuess}</strong>
                    </div>
                    <div>
                      <span className="text-[#86868b] text-[11px] block">First Seen</span>
                      <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {new Date(selectedNode.firstSeenAt).toLocaleDateString()}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Search Intent Summary */}
                {selectedNode.summary && (selectedNode.summary.location || selectedNode.summary.financial || selectedNode.summary.timeline) ? (
                  <div className="p-4 rounded-2xl bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] mb-5">
                    <h3 className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText size={14} className="text-[#0066cc]" />
                      Extracted Buyer Intent
                    </h3>
                    <div className="space-y-2 text-xs">
                      {selectedNode.summary.location && (
                        <div>
                          <span className="text-[#86868b] text-[11px] block">Preferred Location:</span>
                          <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{selectedNode.summary.location}</span>
                        </div>
                      )}
                      {selectedNode.summary.financial && (
                        <div>
                          <span className="text-[#86868b] text-[11px] block">Budget &amp; Financial:</span>
                          <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{selectedNode.summary.financial}</span>
                        </div>
                      )}
                      {selectedNode.summary.timeline && (
                        <div>
                          <span className="text-[#86868b] text-[11px] block">Purchase Timeline:</span>
                          <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{selectedNode.summary.timeline}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Lead Actions Milestones */}
                <div className="p-4 rounded-2xl bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] mb-5">
                  <h3 className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-[#0066cc]" />
                    Lead Conversion Milestones
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#38383a] text-center">
                      <span className="text-xl font-bold font-mono text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {selectedNode.actions.callbacks}
                      </span>
                      <span className="text-[10px] text-[#86868b] block mt-0.5">Callbacks Requested</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#38383a] text-center">
                      <span className="text-xl font-bold font-mono text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {selectedNode.actions.dossiersMade}
                      </span>
                      <span className="text-[10px] text-[#86868b] block mt-0.5">Dossiers Generated</span>
                    </div>
                  </div>
                </div>

                {/* Chat Sessions */}
                <div>
                  <h3 className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-[#0066cc]" />
                    Chat History ({selectedNode.chats.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedNode.chats.length === 0 ? (
                      <p className="text-xs text-[#86868b] italic">No chat sessions recorded for this device.</p>
                    ) : (
                      selectedNode.chats.map((chat) => (
                        <Link
                          key={chat.id}
                          href={`/admin/conversations?sessionId=${chat.id}`}
                          data-testid="chat-deep-link"
                          className="p-3 rounded-xl bg-[#f5f5f7] dark:bg-[#242426] hover:bg-white dark:hover:bg-[#2c2c2e] border border-[#e5e5ea] dark:border-[#38383a] hover:border-[#0066cc]/40 text-xs flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
                        >
                          <div>
                            <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                              {chat.messageCount} messages
                            </span>
                            <span className="text-[11px] text-[#86868b] block">
                              Active: {new Date(chat.lastActive).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-mono text-[#0066cc] dark:text-[#2997ff] truncate max-w-[110px]">
                            {chat.id.slice(0, 8)}…
                            <ExternalLink size={10} />
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer Action */}
              <div className="pt-6 border-t border-[#e5e5ea] dark:border-[#2c2c2e] mt-6">
                <Link
                  href={
                    selectedNode.chats[0]
                      ? `/admin/conversations?sessionId=${selectedNode.chats[0].id}`
                      : '/admin/conversations'
                  }
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0066cc] hover:bg-[#0055b3] text-white text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span>Open in Conversations Dashboard</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {drawerLoading && (
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded-xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-lg text-xs font-semibold text-[#0066cc] flex items-center gap-2 z-50">
          <div className="w-3.5 h-3.5 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
          <span>Loading visitor dossier…</span>
        </div>
      )}

    </div>
  )
}
