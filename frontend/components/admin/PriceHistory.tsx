'use client'

// Every price we hold for one flat type: who gave it, who approved it, when,
// back to the first recorded row, and who confirmed the price shown now.
import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminFetch'

interface HistoryRow {
  id: string
  recorded_at: string
  total_price_cr: number | null
  total_price_max_cr: number | null
  source: string
  submitted_by: string | null
  approved_by: string | null
  unit_type_id: string | null
}
interface History {
  rows: HistoryRow[]
  current: Array<{ fieldName: string; tier: string; verifiedAt: string | null; verifiedBy: string | null; sourceDoc: string | null }>
}

const cr = (n: number | null | undefined) => (n == null ? '—' : n >= 1 ? `₹${Number(n.toFixed(2))} Cr` : `₹${Math.round(n * 100)} L`)
const range = (min?: number | null, max?: number | null) => (min == null ? 'Not on record' : max != null && max > min ? `${cr(min)} – ${cr(max)}` : cr(min))
const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

const SOURCE_LABEL: Record<string, string> = {
  builder_portal: 'Builder, approved by us',
  admin_update: 'Entered by our team',
  monthly_auto_snapshot: 'Automatic snapshot',
}

export default function PriceHistory({ unitTypeId }: { unitTypeId: string }) {
  const [h, setH] = useState<History | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    adminFetch(`/admin/listing-changes/unit-types/${unitTypeId}/price-history`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setH)
      .catch(() => setError('Could not load the history.'))
  }, [unitTypeId])
  if (error) return <p className="text-[12px] text-rose-600">{error}</p>
  if (!h) return <p className="text-[12px] text-zinc-500">Loading history…</p>
  const price = h.current.find((c) => c.fieldName === 'price_min_cr')
  return (
    <div className="mt-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 p-3 space-y-2 text-[12px] text-zinc-600 dark:text-zinc-300">
      <p>
        <span className="font-semibold">Price shown now:</span>{' '}
        {price && price.verifiedAt
          ? `confirmed by ${price.verifiedBy ?? 'unknown'} on ${when(price.verifiedAt)} (${price.tier.toLowerCase().replace(/_/g, ' ')})${price.sourceDoc ? `, ${price.sourceDoc}` : ''}`
          : 'no confirmation date on record'}
      </p>
      {h.rows.length === 0 ? (
        <p>No earlier prices recorded.</p>
      ) : (
        <table className="w-full text-left">
          <thead><tr className="text-zinc-400"><th className="font-semibold py-1">When</th><th className="font-semibold">Price</th><th className="font-semibold">Given by</th><th className="font-semibold">Approved by</th></tr></thead>
          <tbody>
            {h.rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-200/60 dark:border-zinc-700/60">
                <td className="py-1 pr-2">{when(r.recorded_at)}</td>
                <td className="pr-2">{range(r.total_price_cr, r.total_price_max_cr)}{r.unit_type_id ? '' : ' (BHK-wide)'}</td>
                <td className="pr-2">{r.submitted_by ?? SOURCE_LABEL[r.source] ?? r.source}</td>
                <td>{r.approved_by ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

