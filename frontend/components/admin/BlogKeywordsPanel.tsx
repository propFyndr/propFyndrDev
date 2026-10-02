'use client'

// Topics the AI draft generator rotates through (least recently used first).
// The daily cron and the "Generate AI Draft" button both pick from this list.
import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Tag, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { adminFetch } from '@/lib/adminFetch'

interface BlogKeyword {
  id: string
  keyword: string
  active: boolean
  use_count: number
  last_used_at: string | null
}

export default function BlogKeywordsPanel({ onError: onErrorProp }: { onError: (msg: string) => void }) {
  // Ref so a parent passing an inline callback doesn't re-trigger the load effect.
  const onErrorRef = useRef(onErrorProp)
  onErrorRef.current = onErrorProp
  const onError = (msg: string) => onErrorRef.current(msg)
  const [open, setOpen] = useState(false)
  const [keywords, setKeywords] = useState<BlogKeyword[]>([])
  const [draft, setDraft] = useState('')

  const load = useCallback(async () => {
    const res = await adminFetch('/admin/blog/keywords')
    if (res.ok) setKeywords((await res.json()).keywords ?? [])
    else onErrorRef.current('Failed to load blog keywords')
  }, [])

  useEffect(() => { load() }, [load])

  const add = async () => {
    const keyword = draft.trim()
    if (keyword.length < 3) return
    const res = await adminFetch('/admin/blog/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
    })
    if (res.ok) { setDraft(''); load() }
    else onError((await res.json().catch(() => ({}))).error || 'Failed to add keyword')
  }

  const toggle = async (k: BlogKeyword) => {
    const res = await adminFetch(`/admin/blog/keywords/${k.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !k.active }),
    })
    if (res.ok) setKeywords(prev => prev.map(x => (x.id === k.id ? { ...x, active: !k.active } : x)))
    else onError('Failed to update keyword')
  }

  const remove = async (k: BlogKeyword) => {
    if (!confirm(`Remove "${k.keyword}" from the rotation?`)) return
    const res = await adminFetch(`/admin/blog/keywords/${k.id}`, { method: 'DELETE' })
    if (res.ok) setKeywords(prev => prev.filter(x => x.id !== k.id))
    else onError('Failed to delete keyword')
  }

  const activeCount = keywords.filter(k => k.active).length

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 cursor-pointer"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
          <Tag size={14} className="text-blue-600" />
          AI draft topics
          <span className="font-medium text-zinc-400">{activeCount} active · one draft daily at 9:00 IST</span>
        </span>
        <ChevronDown size={15} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              placeholder="e.g. stamp duty for women buyers in Noida"
              maxLength={120}
              className="flex-1 px-3 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-transparent text-xs font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
            />
            <button
              onClick={add}
              disabled={draft.trim().length < 3}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 disabled:opacity-50 cursor-pointer"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {keywords.length === 0 ? (
            <p className="text-xs text-zinc-500">No topics yet. Drafts can't be generated until you add one.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {keywords.map(k => (
                <li key={k.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${k.active ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 line-through'}`}>{k.keyword}</p>
                    <p className="text-[11px] text-zinc-400">
                      {k.last_used_at ? `Used ${k.use_count}× · last ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}` : 'Not used yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggle(k)} className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer">
                      {k.active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => remove(k)} aria-label={`Delete ${k.keyword}`} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
