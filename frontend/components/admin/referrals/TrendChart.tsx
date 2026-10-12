// Arrival trend visualizer with Apple/Seline craft standards,
// gradient bars, telemetry labels, and graceful empty/loading states.
import { useMemo } from 'react'
import { Activity } from 'lucide-react'

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
  const total = useMemo(() => buckets.reduce((sum, b) => sum + (b.newArrivals || 0), 0), [buckets])

  return (
    <div data-testid="trend-chart" className="space-y-4">
      {/* Chart Toolbar & Metric Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
            {total}
          </span>
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Total Arrivals
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">(days in IST)</span>
        </div>

        {/* Granularity Segmented Switch */}
        <div className="flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60">
          {(['daily', 'weekly', 'all'] as const).map((g) => (
            <button
              key={g}
              type="button"
              data-testid={`granularity-${g}`}
              aria-pressed={granularity === g}
              onClick={() => onGranularityChange(g)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                granularity === g
                  ? 'bg-[#0066cc] text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {g === 'daily' ? 'Daily' : g === 'weekly' ? 'Weekly' : 'All-time'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-32 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/20 border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-xs text-zinc-400 gap-2">
          <div className="w-5 h-5 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
          <span>Loading arrival velocity…</span>
        </div>
      ) : buckets.length === 0 ? (
        <div className="h-32 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/20 border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center p-4">
          <Activity size={20} className="text-zinc-300 dark:text-zinc-600 mb-1.5" />
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No arrivals recorded yet.</p>
          <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xs">
            As visitors arrive via this link, arrival velocity will chart here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2 pt-2">
          {/* Bar Chart Area */}
          <div className="flex items-end gap-1.5 h-28 pt-4 px-1 border-b border-zinc-100 dark:border-zinc-800">
            {buckets.map((b) => {
              // No arrivals, no bar — a minimum height would read as activity.
              const heightPct = b.newArrivals === 0 ? 0 : Math.max(8, (b.newArrivals / max) * 100)
              const isPeak = b.newArrivals === max && max > 1

              return (
                <div
                  key={b.date}
                  className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group relative"
                  title={`${b.date}: ${b.newArrivals} arrivals`}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                    {b.newArrivals}
                  </div>

                  {/* Visual Bar */}
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      isPeak
                        ? 'bg-gradient-to-t from-[#0066cc] to-[#38bdf8] group-hover:from-[#0055b3] group-hover:to-[#0284c7]'
                        : 'bg-[#0066cc]/70 group-hover:bg-[#0066cc]'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              )
            })}
          </div>

          {/* X-Axis Date Labels */}
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400 px-1">
            <span>{buckets[0]?.date || ''}</span>
            {buckets.length > 2 && <span>{buckets[Math.floor(buckets.length / 2)]?.date || ''}</span>}
            <span>{buckets[buckets.length - 1]?.date || ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}
