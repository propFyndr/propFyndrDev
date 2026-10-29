'use client'

// Builders propose price and availability changes for their own flat types.
// Nothing here goes live: every change waits for RealtyAsk's review, and the
// page shows the outcome (with the reason, when rejected).
import { useCallback, useEffect, useState } from 'react'
import { CurrencyInr, Clock } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { useScopeId, withScope } from '@/lib/portalScope'
import { PageShell, PageHeader, Card, Pill, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface Change {
  id: string
  kind: 'price' | 'sold_out' | 'available'
  new_value: { price_min_cr?: number; price_max_cr?: number; availability?: string }
  status: 'pending_realtyask' | 'approved' | 'rejected'
  reject_reason: string | null
  created_at: string
}
interface Unit {
  id: string
  name: string
  bhk: number
  super_area_sqft: number | null
  price_min_cr: number | null
  price_max_cr: number | null
  availability: string
  listing_changes: Change[]
}
interface Project { id: string; name: string; sector: string; unit_types: Unit[] }

const cr = (n: number | null | undefined) => (n == null ? '—' : n >= 1 ? `₹${Number(n.toFixed(2))} Cr` : `₹${Math.round(n * 100)} L`)
const range = (min?: number | null, max?: number | null) => (min == null ? 'Not on record' : max != null && max > min ? `${cr(min)} – ${cr(max)}` : cr(min))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function describe(c: Change): string {
  if (c.kind === 'price') return `Price ${range(c.new_value.price_min_cr, c.new_value.price_max_cr)}`
  return c.kind === 'sold_out' ? 'Sold out' : 'Available again'
}

function StatusPill({ status }: { status: Change['status'] }) {
  if (status === 'approved') return <Pill label="Live" tone="emerald" />
  if (status === 'rejected') return <Pill label="Not approved" tone="rose" />
  return <Pill label="Waiting for RealtyAsk" tone="amber" />
}

function UnitRow({ unit, onDone, canPropose }: { unit: Unit; onDone: () => void; canPropose: boolean }) {
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = unit.listing_changes.filter((c) => c.status === 'pending_realtyask')
  const pendingPrice = pending.some((c) => c.kind === 'price')
  const pendingAvailability = pending.some((c) => c.kind !== 'price')
  const soldOut = unit.availability === 'sold_out'

  async function submit(body: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      const r = await adminFetch('/portal/builder/listing-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_type_id: unit.id, ...body, ...(note.trim() ? { source_note: note.trim() } : {}) }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not send the change')
      setMin('')
      setMax('')
      setNote('')
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const minN = Number(min)
  const maxN = max.trim() ? Number(max) : minN
  const valid = min.trim() !== '' && minN > 0 && maxN >= minN

  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
            {unit.name} <span className="font-medium text-zinc-500">· {unit.bhk} BHK{unit.super_area_sqft ? ` · ${unit.super_area_sqft} sq ft` : ''}</span>
          </p>
          <p className="text-[13px] text-zinc-600 dark:text-zinc-300 mt-0.5">Buyers see: {soldOut ? 'not offered (sold out)' : range(unit.price_min_cr, unit.price_max_cr)}</p>
        </div>
        {soldOut && <Pill label="Sold out" tone="zinc" />}
      </div>

      {canPropose && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-semibold text-zinc-500">
            Lowest (₹ Cr)
            <input type="number" step="0.01" min="0.1" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} disabled={busy || pendingPrice}
              className="mt-1 block w-28 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[13px]" />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500">
            Highest (₹ Cr)
            <input type="number" step="0.01" min="0.1" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} disabled={busy || pendingPrice} placeholder="same"
              className="mt-1 block w-28 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[13px]" />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 flex-1 min-w-[160px]">
            Source (price list, date)
            <input type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy}
              className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[13px]" />
          </label>
          <button type="button" disabled={busy || pendingPrice || !valid}
            onClick={() => submit({ kind: 'price', price_min_cr: minN, price_max_cr: maxN })}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[12px] font-bold disabled:opacity-40">
            Propose price
          </button>
          <button type="button" disabled={busy || pendingAvailability}
            onClick={() => submit({ kind: soldOut ? 'available' : 'sold_out' })}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-zinc-700 dark:text-zinc-200 disabled:opacity-40">
            {soldOut ? 'Mark available' : 'Mark sold out'}
          </button>
        </div>
      )}
      {error && <p className="text-[12px] font-medium text-rose-600 dark:text-rose-400">{error}</p>}

      {unit.listing_changes.length > 0 && (
        <ul className="space-y-1.5">
          {unit.listing_changes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-600 dark:text-zinc-400">
              <StatusPill status={c.status} />
              <span>{describe(c)}</span>
              <span className="text-zinc-400">· sent {date(c.created_at)}</span>
              {c.status === 'rejected' && c.reject_reason && <span className="text-rose-600 dark:text-rose-400">Reason: {c.reject_reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function BuilderPricesPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Empty for a BUILDER session; set when a RealtyAsk role views this console,
  // which may look but not propose (the server refuses it too).
  const scopeId = useScopeId('builder_id')

  const load = useCallback(() => {
    adminFetch(withScope('/portal/builder/unit-types', 'builder_id', scopeId))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => setError('Could not load your flat types.'))
      .finally(() => setLoading(false))
  }, [scopeId])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />

  return (
    <PageShell>
      <PageHeader
        title="Prices and availability"
        subtitle="Propose a new price or mark a flat type sold out. Buyers keep seeing the current figure until RealtyAsk approves the change; once approved, it is shown with the date you sent it."
      />
      {error && <ErrorNote message={error} />}
      {projects.length === 0 ? (
        <EmptyState icon={<CurrencyInr size={32} />} title="No flat types on record" body="Once RealtyAsk links your projects to this account, their flat types appear here." />
      ) : (
        projects.map((p) => (
          <Card key={p.id} className="divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2">
              <p className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
              <span className="text-[12px] text-zinc-500 shrink-0">{p.sector}</span>
            </div>
            {p.unit_types.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-zinc-500 flex items-center gap-2"><Clock size={14} /> No flat types on record for this project.</p>
            ) : (
              p.unit_types.map((u) => <UnitRow key={u.id} unit={u} onDone={load} canPropose={!scopeId} />)
            )}
          </Card>
        ))
      )}
    </PageShell>
  )
}
