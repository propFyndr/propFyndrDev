'use client'

// Review builder-proposed price and availability changes. Approval publishes
// with the builder's date and the approver's name; rejection needs a reason the
// builder sees in their portal. Each row opens the full price history.
import { useCallback, useEffect, useState } from 'react'
import { CurrencyInr } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { PageShell, PageHeader, Card, Pill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'
import PriceHistory from '@/components/admin/PriceHistory'

type Status = 'pending_realtyask' | 'approved' | 'rejected'
interface Value { price_min_cr?: number | null; price_max_cr?: number | null; availability?: string }
interface Change {
  id: string
  kind: 'price' | 'sold_out' | 'available'
  old_value: Value
  new_value: Value
  source_note: string | null
  status: Status
  submitted_by: string
  reviewed_by: string | null
  reviewed_at: string | null
  reject_reason: string | null
  created_at: string
  unit_type_id: string
  project: { name: string; sector: string; builder: { name: string } | null }
  unit_type: { name: string; bhk: number; super_area_sqft: number | null }
}

const TABS: Array<{ id: Status; label: string }> = [
  { id: 'pending_realtyask', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

const cr = (n: number | null | undefined) => (n == null ? '—' : n >= 1 ? `₹${Number(n.toFixed(2))} Cr` : `₹${Math.round(n * 100)} L`)
const range = (min?: number | null, max?: number | null) => (min == null ? 'Not on record' : max != null && max > min ? `${cr(min)} – ${cr(max)}` : cr(min))
const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const show = (kind: Change['kind'], v: Value) => (kind === 'price' ? range(v.price_min_cr, v.price_max_cr) : v.availability === 'sold_out' ? 'Sold out' : 'Available')

function ChangeRow({ c, onDone }: { c: Change; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  async function act(path: string, body?: object) {
    setBusy(true)
    setError('')
    try {
      const r = await adminFetch(`/admin/listing-changes/${c.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        // A conflict names both values, so the reviewer sees what changed under the proposal.
        const cur = d.detail?.current
        throw new Error(cur ? `${d.error}. Now on record: ${show(c.kind, cur)}; the builder proposed over ${show(c.kind, d.detail.proposed_over)}.` : d.error ?? 'Failed')
      }
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-5 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
            {c.project.name} · {c.unit_type.name} <span className="font-medium text-zinc-500">({c.unit_type.bhk} BHK)</span>
          </p>
          <p className="text-[12px] text-zinc-500">{c.project.builder?.name ?? 'No builder'} · {c.project.sector} · sent by {c.submitted_by} on {when(c.created_at)}</p>
        </div>
        <Pill label={c.kind === 'price' ? 'Price' : c.kind === 'sold_out' ? 'Sold out' : 'Available again'} tone={c.kind === 'price' ? 'blue' : 'amber'} />
      </div>
      <p className="text-[13px] text-zinc-800 dark:text-zinc-200">
        {show(c.kind, c.old_value)} <span className="text-zinc-400">→</span> <span className="font-bold">{show(c.kind, c.new_value)}</span>
      </p>
      {c.source_note && <p className="text-[12px] text-zinc-500">Builder&apos;s source: {c.source_note}</p>}
      {c.status !== 'pending_realtyask' && (
        <p className="text-[12px] text-zinc-500">
          {c.status === 'approved' ? 'Approved' : 'Rejected'} by {c.reviewed_by} on {when(c.reviewed_at)}{c.reject_reason ? `. Reason: ${c.reject_reason}` : ''}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {c.status === 'pending_realtyask' && !rejecting && (
          <>
            <button type="button" disabled={busy} onClick={() => act('approve')}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[12px] font-bold disabled:opacity-40">Approve and publish</button>
            <button type="button" disabled={busy} onClick={() => setRejecting(true)}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-zinc-700 dark:text-zinc-200">Reject</button>
          </>
        )}
        {rejecting && (
          <>
            <input type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason the builder will see"
              className="flex-1 min-w-[200px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[13px]" />
            <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => act('reject', { reason: reason.trim() })}
              className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-[12px] font-bold disabled:opacity-40">Send rejection</button>
            <button type="button" disabled={busy} onClick={() => setRejecting(false)} className="text-[12px] text-zinc-500">Cancel</button>
          </>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[12px] font-semibold text-blue-600 dark:text-blue-400">
          {open ? 'Hide price history' : 'Price history'}
        </button>
      </div>
      {error && <p className="text-[12px] font-medium text-rose-600 dark:text-rose-400">{error}</p>}
      {open && <PriceHistory unitTypeId={c.unit_type_id} />}
    </div>
  )
}

export default function ListingChangesPage() {
  const [tab, setTab] = useState<Status>('pending_realtyask')
  const [changes, setChanges] = useState<Change[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    adminFetch(`/admin/listing-changes?status=${tab}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { setChanges(d.changes ?? []); setError('') })
      .catch(() => setError('Could not load proposals.'))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { load() }, [load])

  return (
    <PageShell>
      <PageHeader title="Builder price changes" subtitle="Nothing a builder sends reaches buyers until it is approved here." />
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-bold border ${tab === t.id ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <ErrorNote message={error} />}
      {loading ? <Spinner /> : changes.length === 0 ? (
        <EmptyState icon={<CurrencyInr size={32} />} title="Nothing here" body={tab === 'pending_realtyask' ? 'No builder changes are waiting for review.' : undefined} />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
          {changes.map((c) => <ChangeRow key={c.id} c={c} onDone={load} />)}
        </Card>
      )}
    </PageShell>
  )
}
