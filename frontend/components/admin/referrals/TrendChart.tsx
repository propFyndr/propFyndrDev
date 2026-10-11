// Daily/weekly/all-time arrival trend — a plain bar chart (no new chart
// dependency; the existing stack doesn't carry one for this page) with a
// granularity toggle. The parent owns data fetching; this component only
// renders whatever buckets it's given and reports toggle clicks upward.
export type Granularity = 'daily' | 'weekly' | 'all'

export interface TrendBucket {
  date: string
  newArrivals: number
}

export default function TrendChart({
  buckets,
  granularity,
  onGranularityChange,
  loading = false,
}: {
  buckets: TrendBucket[]
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
  loading?: boolean
}) {
  const max = Math.max(1, ...buckets.map((b) => b.newArrivals))

  return (
    <div data-testid="trend-chart">
      <div className="flex items-center justify-end gap-1 mb-3">
        {(['daily', 'weekly', 'all'] as const).map((g) => (
          <button
            key={g}
            type="button"
            data-testid={`granularity-${g}`}
            onClick={() => onGranularityChange(g)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 cursor-pointer ${
              granularity === g
                ? 'bg-[#0066cc] text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {g === 'daily' ? 'Daily' : g === 'weekly' ? 'Weekly' : 'All-time'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-24 flex items-center justify-center text-xs text-zinc-400">Loading trend…</div>
      ) : buckets.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-xs text-zinc-400 italic">No arrivals recorded yet.</div>
      ) : (
        <div className="flex items-end gap-1 h-24">
          {buckets.map((b) => (
            <div key={b.date} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 group" title={`${b.date}: ${b.newArrivals}`}>
              <div
                className="w-full rounded-t bg-[#0066cc]/70 group-hover:bg-[#0066cc] transition-colors"
                style={{ height: `${Math.max(2, (b.newArrivals / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
