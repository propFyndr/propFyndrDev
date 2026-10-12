// Real nested referral tree with visual branch guides, telemetry cards,
// and hierarchical generational navigation.
import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Smartphone, Monitor, Tablet, MessageSquare, Clock, ArrowUpRight } from 'lucide-react'
import FunnelBadge, { type FunnelStage } from './FunnelBadge'

export interface ReferralTreeNode {
  guestToken: string
  label: string | null
  generation: number
  parentGuestToken: string | null
  deviceClass: string
  os: string
  appGuess: string
  shareChannel: string | null
  messageCount: number
  activated: boolean
  firstSeenAt: string
  funnelStage: FunnelStage
  visitCount: number
  lastSeenAt: string
}

function DeviceIcon({ deviceClass }: { deviceClass: string }) {
  if (deviceClass === 'mobile') return <Smartphone size={14} />
  if (deviceClass === 'tablet') return <Tablet size={14} />
  return <Monitor size={14} />
}

interface TreeIndex {
  byParent: Map<string | null, ReferralTreeNode[]>
  roots: ReferralTreeNode[]
}

function buildIndex(nodes: ReferralTreeNode[]): TreeIndex {
  const byParent = new Map<string | null, ReferralTreeNode[]>()
  for (const n of nodes) {
    const key = n.parentGuestToken
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(n)
  }
  // A node whose parent isn't in this tree (e.g. a purged visit) is shown at the
  // top level rather than silently dropped.
  const tokens = new Set(nodes.map((n) => n.guestToken))
  const roots = nodes.filter((n) => n.generation === 1 || !n.parentGuestToken || !tokens.has(n.parentGuestToken))
  return { byParent, roots }
}

function TreeRow({
  node,
  index,
  depth,
  expanded,
  toggle,
  onSelect,
}: {
  node: ReferralTreeNode
  index: TreeIndex
  depth: number
  expanded: Set<string>
  toggle: (token: string) => void
  onSelect: (token: string) => void
}) {
  const children = index.byParent.get(node.guestToken) ?? []
  const isExpanded = expanded.has(node.guestToken)

  return (
    <div data-testid="tree-node" data-generation={node.generation} className="select-none relative">
      {/* Branch connector visual guideline for nested nodes */}
      {depth > 0 && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-px border-l border-zinc-200 dark:border-zinc-800 pointer-events-none"
          style={{ left: `${(depth - 1) * 24 + 18}px` }}
        />
      )}

      <div
        className="flex items-center gap-2.5 py-1.5 px-2 my-1 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border border-transparent hover:border-zinc-200/60 dark:hover:border-zinc-800/60 transition-all cursor-pointer group"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={(e) => {
              e.stopPropagation()
              toggle(node.guestToken)
            }}
            className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs"
          >
            {isExpanded ? <ChevronDown size={13} strokeWidth={2.5} /> : <ChevronRight size={13} strokeWidth={2.5} />}
          </button>
        ) : (
          <span className="w-6 flex items-center justify-center shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          </span>
        )}

        <button
          type="button"
          onClick={() => onSelect(node.guestToken)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left p-2 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800 shadow-2xs hover:shadow-xs hover:border-[#0066cc]/40 dark:hover:border-[#0066cc]/40 transition-all active:scale-[0.99] cursor-pointer"
        >
          {/* Device Squircle */}
          <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors shrink-0">
            <DeviceIcon deviceClass={node.deviceClass} />
          </div>

          {/* Node Identity */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors truncate">
                {node.label || `${node.deviceClass} · Gen ${node.generation}`}
              </span>
              <FunnelBadge stage={node.funnelStage} />
              {node.visitCount > 1 && (
                <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded" title="Re-entered the arrival flow">
                  ×{node.visitCount} visits
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
              {node.os} • {node.appGuess !== 'unknown' ? node.appGuess : node.shareChannel || 'direct'}
            </p>
          </div>

          {/* Telemetry metadata */}
          <div className="flex items-center gap-3 shrink-0 text-zinc-500 dark:text-zinc-400 text-[11px]">
            <span className="flex items-center gap-1 font-mono tabular-nums">
              <MessageSquare size={11} className="text-zinc-400" />
              <strong className="text-zinc-700 dark:text-zinc-300 font-semibold">{node.messageCount}</strong>
            </span>
            <span className="flex items-center gap-1 font-mono text-[10.5px]">
              <Clock size={11} className="text-zinc-400" />
              {new Date(node.lastSeenAt).toLocaleDateString()}
            </span>
            <ArrowUpRight size={13} className="text-zinc-300 dark:text-zinc-600 group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors" />
          </div>
        </button>
      </div>

      {isExpanded &&
        children.map((child) => (
          <TreeRow key={child.guestToken} node={child} index={index} depth={depth + 1} expanded={expanded} toggle={toggle} onSelect={onSelect} />
        ))}
    </div>
  )
}

export default function ReferralTree({
  nodes,
  onSelectNode,
}: {
  nodes: ReferralTreeNode[]
  onSelectNode: (guestToken: string) => void
}) {
  const index = useMemo(() => buildIndex(nodes), [nodes])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (token: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(token)) next.delete(token)
      else next.add(token)
      return next
    })
  }

  if (nodes.length === 0) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400 italic py-8 text-center">No devices have arrived through this link yet.</p>
  }

  return (
    <div data-testid="referral-tree" className="space-y-1">
      {index.roots.map((root) => (
        <TreeRow key={root.guestToken} node={root} index={index} depth={0} expanded={expanded} toggle={toggle} onSelect={onSelectNode} />
      ))}
    </div>
  )
}
