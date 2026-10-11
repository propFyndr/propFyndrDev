'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/adminFetch'
import { Copy, Check, Plus, Link as LinkIcon } from 'lucide-react'

interface ReferralLinkRow {
  code: string
  label: string | null
  createdAt: string
  revoked: boolean
  devicesReached: number
  deepestGeneration: number
  activatedCount: number
  lastActivity: string | null
}

export default function ReferralsAdminPage() {
  const [links, setLinks] = useState<ReferralLinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'mine' | 'all'>('all')
  const [label, setLabel] = useState('')
  const [greetingName, setGreetingName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`/admin/referrals?scope=${scope}`)
      if (res.ok) {
        const data = await res.json()
        setLinks(data.links || [])
      }
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    if (!label.trim()) return
    setCreating(true)
    try {
      const res = await adminFetch('/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), greetingName: greetingName.trim() || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        const fullUrl = `${window.location.origin}${data.url}`
        setNewLinkUrl(fullUrl)
        setLabel('')
        setGreetingName('')
        load()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const handleRevoke = async (code: string) => {
    if (!confirm('Revoke this link? New arrivals will land without attribution; the existing tree is kept.')) return
    const res = await adminFetch(`/admin/referrals/${code}/revoke`, { method: 'POST' })
    if (res.ok) load()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Referral Links</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Generate a link, share it with one person, and watch how far it spreads.
      </p>

      <div className="mb-8 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Plus size={16} /> Generate a link
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Rahul – college)"
            maxLength={60}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
          />
          <input
            type="text"
            value={greetingName}
            onChange={(e) => setGreetingName(e.target.value)}
            placeholder="From name (e.g. Furqan)"
            maxLength={60}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !label.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
          >
            Generate
          </button>
        </div>
        {newLinkUrl && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-sm">
            <LinkIcon size={14} />
            <span className="flex-1 truncate">{newLinkUrl}</span>
            <button onClick={() => handleCopy(newLinkUrl)} className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={`${newLinkUrl}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open without recording a visit — clicking the plain link yourself would make you its holder"
              className="text-slate-600 dark:text-slate-400 font-medium hover:underline"
            >
              Preview
            </a>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setScope('all')} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${scope === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>All</button>
        <button onClick={() => setScope('mine')} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${scope === 'mine' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Mine</button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-slate-500">No referral links yet.</p>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Devices</th>
                <th className="px-4 py-3">Deepest gen.</th>
                <th className="px-4 py-3">Activated</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.code} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <Link href={`/admin/referrals/${link.code}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      {link.label || link.code}
                    </Link>
                    {link.revoked && <span className="ml-2 text-xs text-red-500">revoked</span>}
                  </td>
                  <td className="px-4 py-3">{link.devicesReached}</td>
                  <td className="px-4 py-3">{link.deepestGeneration}</td>
                  <td className="px-4 py-3">{link.activatedCount}</td>
                  <td className="px-4 py-3">{link.lastActivity ? new Date(link.lastActivity).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {!link.revoked && (
                      <button onClick={() => handleRevoke(link.code)} className="text-xs text-red-500 hover:underline">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
