'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/adminFetch'
import { ArrowLeft, DeviceMobile, Desktop, DeviceTablet } from '@phosphor-icons/react'

interface TreeNode {
  guestToken: string
  label: string | null
  generation: number
  parentGuestToken: string | null
  depthInferred: boolean
  deviceClass: string
  os: string
  appGuess: string
  shareChannel: string | null
  messageCount: number
  activated: boolean
  firstSeenAt: string
}

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

function DeviceIcon({ deviceClass }: { deviceClass: string }) {
  if (deviceClass === 'mobile') return <DeviceMobile size={14} />
  if (deviceClass === 'tablet') return <DeviceTablet size={14} />
  return <Desktop size={14} />
}

export default function ReferralTreePage() {
  const { code } = useParams<{ code: string }>()
  const [rootLabel, setRootLabel] = useState<string | null>(null)
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<NodeDrawerData | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)

  useEffect(() => {
    if (!code) return
    adminFetch(`/admin/referrals/${code}/tree`).then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        setRootLabel(data.root?.label || null)
        setNodes(data.nodes || [])
      }
      setLoading(false)
    })
  }, [code])

  const openNode = useCallback(async (guestToken: string) => {
    setDrawerLoading(true)
    try {
      const res = await adminFetch(`/admin/referrals/nodes/${guestToken}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedNode(data.node)
      }
    } finally {
      setDrawerLoading(false)
    }
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/admin/referrals" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 mb-4">
        <ArrowLeft size={14} /> Back to all links
      </Link>
      <h1 className="text-xl font-bold mb-6">{rootLabel || code}</h1>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : nodes.length === 0 ? (
        <p className="text-sm text-slate-500">No devices have arrived through this link yet.</p>
      ) : (
        <div className="space-y-1.5">
          {nodes.map((node) => (
            <button
              key={node.guestToken}
              onClick={() => openNode(node.guestToken)}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              style={{ marginLeft: `${(node.generation - 1) * 20}px` }}
            >
              <DeviceIcon deviceClass={node.deviceClass} />
              <span className="font-medium text-sm">{node.label || `guest · gen ${node.generation}`}</span>
              <span className="text-xs text-slate-500">{node.os} · {node.appGuess !== 'unknown' ? node.appGuess : (node.shareChannel || 'unknown app')}</span>
              <span className="text-xs text-slate-500">{node.messageCount} msgs</span>
              {node.activated && <span className="text-xs text-emerald-600 font-semibold">activated</span>}
              {node.depthInferred && <span className="text-xs text-amber-600">via parent (exact sender unknown)</span>}
            </button>
          ))}
        </div>
      )}

      {selectedNode && (
        <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={() => setSelectedNode(null)}>
          <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedNode(null)} className="text-sm text-slate-500 mb-4">Close</button>
            <h2 className="text-lg font-bold mb-1">Generation {selectedNode.generation}</h2>
            <p className="text-xs text-slate-500 mb-4">{selectedNode.deviceClass} · {selectedNode.os} · {selectedNode.appGuess}</p>

            {selectedNode.summary && (selectedNode.summary.location || selectedNode.summary.financial || selectedNode.summary.timeline) && (
              <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
                {[selectedNode.summary.location, selectedNode.summary.financial, selectedNode.summary.timeline].filter(Boolean).join(' · ')}
              </div>
            )}

            <div className="mb-4 text-sm space-y-1">
              <div>Callbacks requested: {selectedNode.actions.callbacks}</div>
              <div>Dossiers made: {selectedNode.actions.dossiersMade}</div>
            </div>

            <h3 className="text-sm font-bold mb-2">Chats</h3>
            <div className="space-y-2">
              {selectedNode.chats.map((chat) => (
                <div
                  key={chat.id}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                >
                  {chat.messageCount} messages · last active {new Date(chat.lastActive).toLocaleDateString()}
                </div>
              ))}
              {selectedNode.chats.length > 0 && (
                // /admin/conversations has no per-session deep link or URL param today —
                // it manages the open transcript as local page state. Until that page
                // supports one, this links to the list; the admin finds the session by
                // guest token/date there.
                <Link
                  href="/admin/conversations"
                  className="block mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Open in Conversations →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {drawerLoading && <div className="fixed bottom-4 right-4 text-xs text-slate-500">Loading…</div>}
    </div>
  )
}
