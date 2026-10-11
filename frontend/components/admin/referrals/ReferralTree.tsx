// Real nested referral tree — each node renders under its actual
// parent_guest_token, not a flat generation band. Collapsed to Generation 1
// by default; clicking a node expands its children.
import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Smartphone, Monitor, Tablet, MessageSquare, Clock } from 'lucide-react'
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
  // Roots: generation-1 nodes (direct recipients) regardless of parent field
  // shape, matching the root link itself rather than another visit row.
  const roots = nodes.filter((n) => n.generation === 1)
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
    <div data-testid="tree-node" data-generation={node.generation} className="select-none">
      <div
        className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer group"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={(e) => {
              e.stopPropagation()
              toggle(node.guestToken)
            }}
            className="p-0.5 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white active:scale-95 cursor-pointer shrink-0"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[18px] shrink-0" />
        )}

        <button type="button" onClick={() => onSelect(node.guestToken)} className="flex items-center gap-2 flex-1 min-w-0 text-left active:scale-[0.99] cursor-pointer">
          <span className="text-zinc-400 dark:text-zinc-500 shrink-0">
            <DeviceIcon deviceClass={node.deviceClass} />
          </span>
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {node.label || `${node.deviceClass} · Gen ${node.generation}`}
          </span>
          <FunnelBadge stage={node.funnelStage} />
          {node.visitCount > 1 && (
            <span className="text-[10px] font-mono text-zinc-400" title="Re-entered the arrive flow">
              ×{node.visitCount}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400 shrink-0">
            <MessageSquare size={10} />
            {node.messageCount}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-zinc-400 shrink-0">
            <Clock size={10} />
            {new Date(node.lastSeenAt).toLocaleDateString()}
          </span>
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
    return <p className="text-xs text-zinc-400 italic py-8 text-center">No devices have arrived through this link yet.</p>
  }

  return (
    <div data-testid="referral-tree">
      {index.roots.map((root) => (
        <TreeRow key={root.guestToken} node={root} index={index} depth={0} expanded={expanded} toggle={toggle} onSelect={onSelectNode} />
      ))}
    </div>
  )
}
