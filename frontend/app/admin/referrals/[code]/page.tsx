'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/adminFetch'
import {
  ArrowLeft,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  Zap,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  FileText,
  X,
  Share2,
} from 'lucide-react'
import { AnimatePresence, m } from 'framer-motion'
import { toast } from 'sonner'
import { StatCard } from '@/components/portal/ui'
import ReferralTree, { type ReferralTreeNode } from '@/components/admin/referrals/ReferralTree'
import TrendChart, { type Granularity, type TrendBucket } from '@/components/admin/referrals/TrendChart'
import DefinitionHint from '@/components/admin/referrals/DefinitionHint'
import { FunnelStageDefinitions } from '@/components/admin/referrals/FunnelBadge'

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
    } catch {
      toast.error('Error communicating with server')
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
    } catch {
      toast.error('Error communicating with server')
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    if (!selectedNode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedNode(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNode])

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
    const presentGens = new Set(nodes.map((n) => n.generation))
    const rows: { generation: number; activatedCount: number; k: number | null }[] = []
    for (const gen of gens) {
      const count = activatedByGen.get(gen) ?? 0
      // Gen N → N+1 only. If generation N+1 has no devices at all there is no
      // ratio to show (a gap is not "next wave"); if it has devices but none
      // activated, k is a real 0.
      const k = count > 0 && presentGens.has(gen + 1) ? (activatedByGen.get(gen + 1) ?? 0) / count : null
      rows.push({ generation: gen, activatedCount: count, k })
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6e6e73] dark:text-[#98989d] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors active:scale-95 mb-3 cursor-pointer"
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
            <p className="text-xs sm:text-sm font-medium text-[#6e6e73] dark:text-[#98989d] mt-1">
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
              className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
              title="Reset holder device"
            >
              <RotateCcw size={14} />
              <span>Reset Holder</span>
            </button>

            {!rootRevoked && (
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
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
          hint={metrics.totalDevices > 0 ? `${Math.round((metrics.activatedCount / metrics.totalDevices) * 100)}% of devices activated` : 'No visits'}
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
            <div className="flex items-center gap-1">
              <h2 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                <GitBranch size={18} className="text-[#0066cc] dark:text-[#2997ff]" />
                Generational Tree Hierarchy
              </h2>
              <DefinitionHint label="How funnel stages are assigned">
                <FunnelStageDefinitions />
              </DefinitionHint>
            </div>
            <p className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-0.5">
              Click any device node to open the visitor intelligence drawer.
            </p>
          </div>
          <span className="text-xs font-mono text-[#6e6e73] dark:text-[#98989d] bg-[#f5f5f7] dark:bg-[#242426] px-3 py-1 rounded-full border border-[#e5e5ea] dark:border-[#38383a]">
            {nodes.length} total node{nodes.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium text-[#6e6e73] dark:text-[#98989d]">Loading referral graph…</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] dark:bg-[#242426] flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] mb-3">
              <Share2 size={24} />
            </div>
            <p className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              No devices have arrived through this link yet
            </p>
            <p className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-1 max-w-sm">
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

      {/* Trend + K-Factor Generational Cascade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Arrival Trend Card */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Arrival Trend</h2>
              <p className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">Arrival volume partitioned by date and granularity.</p>
            </div>
          </div>
          <TrendChart buckets={trendBuckets} granularity={granularity} onGranularityChange={setGranularity} loading={trendLoading} />
        </div>

        {/* Open Visual K-Factor by Generation Card */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#e5e5ea]/80 dark:border-[#2c2c2e]/80">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <GitBranch size={13} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">K-Factor by Generation</h2>
                  <p className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">Viral transmission multiplier between successive waves.</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-[#6e6e73] dark:text-[#98989d] bg-[#f5f5f7] dark:bg-[#242426] px-2.5 py-0.5 rounded-full border border-[#e5e5ea] dark:border-[#38383a]">
                Viral Cascade
              </span>
            </div>

            {perGenerationKFactor.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] dark:bg-[#242426] flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] mb-2.5">
                  <GitBranch size={18} />
                </div>
                <p className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  No activated cascades yet
                </p>
                <p className="text-[11px] text-[#6e6e73] dark:text-[#98989d] mt-1 max-w-xs">
                  When Gen 1 visitors activate and distribute their own referral links to friends, generational multipliers (k &ge; 1.0) appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {perGenerationKFactor.map((row) => {
                  const isViral = (row.k ?? 0) >= 1
                  return (
                    <div
                      key={row.generation}
                      className="p-3.5 rounded-xl bg-[#f5f5f7]/60 dark:bg-[#242426]/50 border border-[#e5e5ea] dark:border-[#38383a] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            Gen {row.generation} → Gen {row.generation + 1}
                          </span>
                          <span className="text-[10px] text-[#6e6e73] dark:text-[#98989d] font-mono">
                            ({row.activatedCount} activated)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {row.k !== null && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isViral
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-800/80'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                            }`}
                          >
                            {isViral ? 'Exponential Amplification' : 'Linear Transmission'}
                          </span>
                          )}
                          <span className="font-mono font-black text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
                            k = {row.k === null ? '—' : row.k.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Multiplier retention bar */}
                      <div className="w-full h-1.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isViral ? 'bg-emerald-500' : 'bg-[#0066cc]'
                          }`}
                          style={{
                            width: `${row.k ? Math.min(100, Math.round(row.k * 50)) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="pt-3 mt-4 border-t border-[#e5e5ea]/80 dark:border-[#2c2c2e]/80 text-[10px] text-[#6e6e73] dark:text-[#98989d] flex items-center justify-between">
            <span>Formula: next wave activations / current wave</span>
            <span className="font-mono">Threshold: k &ge; 1.0</span>
          </div>
        </div>
      </div>

      {/* Channel / Device Breakdown */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#e5e5ea]/80 dark:border-[#2c2c2e]/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center">
              <Share2 size={13} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Channel Attribution Breakdown</h2>
              <p className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">Traffic source vectors mapped against conversational activation rates.</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#6e6e73] dark:text-[#98989d] bg-[#f5f5f7] dark:bg-[#242426] px-2.5 py-0.5 rounded-full border border-[#e5e5ea] dark:border-[#38383a]">
            {channelBreakdown.reduce((sum, c) => sum + c.total, 0)} total sessions
          </span>
        </div>

        {channelBreakdown.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#6e6e73] dark:text-[#98989d] italic">
            No channel visits recorded yet for this link.
          </div>
        ) : (
          <div className="space-y-3">
            {channelBreakdown.map((row) => (
              <div
                key={row.channel}
                className="p-3 rounded-xl bg-[#f5f5f7]/50 dark:bg-[#242426]/40 border border-[#e5e5ea] dark:border-[#38383a] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-[140px]">
                  <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
                  <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] capitalize">{row.channel}</span>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-zinc-200/80 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-[#0066cc] dark:bg-[#2997ff] rounded-full transition-all"
                      style={{ width: `${Math.round(row.rate * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0 w-28 text-right">
                    {row.activated}/{row.total} ({Math.round(row.rate * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visitor Intelligence Drawer */}
      <AnimatePresence>
        {selectedNode && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-50"
            onClick={() => setSelectedNode(null)}
          >
            <m.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Visitor details"
              className="w-full max-w-md h-full bg-white dark:bg-[#1c1c1e] p-6 overflow-y-auto border-l border-[#e5e5ea] dark:border-[#2c2c2e] shadow-2xl flex flex-col justify-between"
            >
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea] dark:border-[#2c2c2e] mb-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0066cc] dark:text-[#2997ff] bg-[#0066cc]/10 px-2 py-0.5 rounded-full border border-[#0066cc]/20">
                      Generation {selectedNode.generation}
                    </span>
                    <h2 className="text-xl font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] mt-1">
                      Visitor Dossier
                    </h2>
                    <p className="text-[11px] font-mono text-[#6e6e73] dark:text-[#98989d] truncate max-w-xs mt-0.5">
                      token: {selectedNode.guestToken}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Close visitor details"
                    onClick={() => setSelectedNode(null)}
                    className="p-1.5 rounded-xl text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-[#f5f5f7] dark:hover:bg-[#242426] transition-colors active:scale-95 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Device & Client Profile */}
                <div className="p-4 rounded-2xl bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] mb-5">
                  <h3 className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Smartphone size={14} className="text-[#0066cc] dark:text-[#2997ff]" />
                    Device Profile
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#6e6e73] dark:text-[#98989d] text-[11px] block">Device Class</span>
                      <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] capitalize">{selectedNode.deviceClass}</strong>
                    </div>
                    <div>
                      <span className="text-[#6e6e73] dark:text-[#98989d] text-[11px] block">Operating System</span>
                      <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] capitalize">{selectedNode.os}</strong>
                    </div>
                    <div>
                      <span className="text-[#6e6e73] dark:text-[#98989d] text-[11px] block">Client / App</span>
                      <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] capitalize">{selectedNode.appGuess}</strong>
                    </div>
                    <div>
                      <span className="text-[#6e6e73] dark:text-[#98989d] text-[11px] block">First Seen</span>
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
                      <FileText size={14} className="text-[#0066cc] dark:text-[#2997ff]" />
                      Extracted Buyer Intent
                    </h3>
                    <div className="space-y-2 text-xs">
                      {selectedNode.summary.location && (
                        <div>
                          <span className="text-[#6e6e73] dark:text-[#98989d] text-[11px] block">Preferred Location:</span>
                          <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{selectedNode.summary.location}</span>
                        </div>
                      )}
                      {selectedNode.summary.financial && (
                        <div>
                          <span className="text-[#6e6e73] dark:text-[#98989d] text-[11px] block">Budget &amp; Financial:</span>
                          <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{selectedNode.summary.financial}</span>
                        </div>
                      )}
                      {selectedNode.summary.timeline && (
                        <div>
                          <span className="text-[#6e6e73] dark:text-[#98989d] text-[11px] block">Purchase Timeline:</span>
                          <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{selectedNode.summary.timeline}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Lead Actions Milestones */}
                <div className="p-4 rounded-2xl bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] mb-5">
                  <h3 className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-[#0066cc] dark:text-[#2997ff]" />
                    Lead Conversion Milestones
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#38383a] text-center">
                      <span className="text-xl font-bold font-mono text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {selectedNode.actions.callbacks}
                      </span>
                      <span className="text-[10px] text-[#6e6e73] dark:text-[#98989d] block mt-0.5">Callbacks Requested</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#38383a] text-center">
                      <span className="text-xl font-bold font-mono text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {selectedNode.actions.dossiersMade}
                      </span>
                      <span className="text-[10px] text-[#6e6e73] dark:text-[#98989d] block mt-0.5">Dossiers Generated</span>
                    </div>
                  </div>
                </div>

                {/* Chat Sessions */}
                <div>
                  <h3 className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-[#0066cc] dark:text-[#2997ff]" />
                    Chat History ({selectedNode.chats.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedNode.chats.length === 0 ? (
                      <p className="text-xs text-[#6e6e73] dark:text-[#98989d] italic">No chat sessions recorded for this device.</p>
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
                            <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] block">
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
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded-xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-lg text-xs font-semibold text-[#0066cc] dark:text-[#2997ff] flex items-center gap-2 z-50">
          <div className="w-3.5 h-3.5 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
          <span>Loading visitor dossier…</span>
        </div>
      )}

    </div>
  )
}
