'use client'

/**
 * The manual send queue.
 *
 * No email or SMS provider is wired up yet, so every notification the product
 * wants to send waits here and a human dispatches it. `action_url` on a row is
 * a one-time credential — whoever holds an invite or reset link can set that
 * account's password — so the copy button is the whole feature and the link is
 * never rendered as a clickable anchor that could leak via a referrer header.
 */

import { useEffect, useMemo, useState } from 'react'
import { EnvelopeSimple, Copy, Check, X, PaperPlaneTilt, Warning } from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import { adminFetch } from '@/lib/adminFetch'
import { PageShell, PageHeader, Card, StatCard, Pill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface Message {
  id: string
  channel: string
  to_email: string | null
  to_phone: string | null
  template: string
  subject: string | null
  body: string
  action_url: string | null
  status: string
  error: string | null
  created_at: string
  sent_at: string | null
  sent_by: string | null
}

const STATUS_TONE: Record<string, 'amber' | 'emerald' | 'rose' | 'zinc'> = {
  queued: 'amber',
  sent: 'emerald',
  failed: 'rose',
  cancelled: 'zinc',
}

const FILTERS = ['queued', 'sent', 'failed', 'cancelled', 'ALL'] as const

export default function OutboxPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [queuedCount, setQueuedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('queued')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // `load` is redefined each render but only ever reads `filter`, which is the
  // dependency that matters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [filter])

  function load() {
    setLoading(true)
    adminFetch(`/admin/outbox?status=${filter}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setMessages(d.messages ?? [])
        setQueuedCount(d.queuedCount ?? 0)
      })
      .catch(() => setError('Could not load the outbox.'))
      .finally(() => setLoading(false))
  }

  async function mark(id: string, status: string) {
    setSavingId(id)
    setError('')
    try {
      const res = await adminFetch(`/admin/outbox/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Update failed')
      // Dropping out of the current filter is the expected outcome of acting
      // on a row, so remove it rather than leaving a stale entry behind.
      setMessages((prev) => (filter === 'ALL'
        ? prev.map((m) => (m.id === id ? d.message : m))
        : prev.filter((m) => m.id !== id)))
      if (status !== 'queued') setQueuedCount((c) => Math.max(0, c - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingId(null)
    }
  }

  async function copy(m: Message) {
    const text = [
      m.to_email ? `To: ${m.to_email}` : null,
      m.to_phone ? `To: ${m.to_phone}` : null,
      m.subject ? `Subject: ${m.subject}` : null,
      '',
      m.body,
    ].filter((l) => l !== null).join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedId(m.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const stats = useMemo(() => ({
    queued: queuedCount,
    shown: messages.length,
  }), [queuedCount, messages.length])

  if (loading) return <Spinner />

  return (
    <PageShell>
      <PageHeader
        title="Outbox"
        subtitle="Notifications waiting to be sent by hand. No email or SMS provider is connected yet."
      />

      {error && <ErrorNote message={error} />}

      <Card className="p-4 flex items-start gap-3 border-l-[3px] border-l-amber-400">
        <Warning size={18} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[13px] text-zinc-600 dark:text-zinc-300">
          Links in these messages are one-time credentials — anyone holding an invite or reset link can set
          that account&apos;s password. Send them to the named recipient only, then mark the message sent.
          Reset links expire one hour after they are created.
        </p>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Waiting to send" value={stats.queued} icon={<EnvelopeSimple size={16} />} tone={stats.queued > 0 ? 'hot' : 'neutral'} />
        <StatCard label="Shown" value={stats.shown} icon={<EnvelopeSimple size={16} />} />
      </div>

      <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 w-fit overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap capitalize ${
              filter === f
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {f === 'ALL' ? 'All' : f}
          </button>
        ))}
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={<EnvelopeSimple size={32} />}
          title={filter === 'queued' ? 'Nothing waiting to send' : 'Nothing here'}
          body={filter === 'queued' ? 'Invites and password resets appear here the moment they are requested.' : undefined}
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {messages.map((m) => (
            <div key={m.id} className="px-4 py-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {m.subject || m.template.replace(/_/g, ' ')}
                    </p>
                    <Pill label={m.status} tone={STATUS_TONE[m.status] ?? 'zinc'} />
                    <Pill label={m.channel} tone="blue" />
                  </div>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                    {m.to_email ?? m.to_phone ?? 'no recipient'} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    {m.sent_by ? ` · sent by ${m.sent_by}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copy(m)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    {copiedId === m.id ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
                    {copiedId === m.id ? 'Copied' : 'Copy message'}
                  </button>
                  {m.status === 'queued' && (
                    <>
                      <button
                        onClick={() => mark(m.id, 'sent')}
                        disabled={savingId === m.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-colors"
                      >
                        <PaperPlaneTilt size={13} weight="fill" />Mark sent
                      </button>
                      <button
                        onClick={() => mark(m.id, 'cancelled')}
                        disabled={savingId === m.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-zinc-500 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60 cursor-pointer transition-colors"
                      >
                        <X size={13} weight="bold" />Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              <pre className="text-[12px] text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2.5 whitespace-pre-wrap font-sans leading-relaxed">
                {m.body}
              </pre>

              {m.error && <p className="text-[12px] text-rose-600 dark:text-rose-400">{m.error}</p>}
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  )
}
