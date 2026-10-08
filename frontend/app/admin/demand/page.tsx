'use client'

import { useState, useEffect } from 'react'

interface DemandSignalSummary {
  city: string
  inquiryCount: number
  medianBudgetCr: number | null
  topBhk: number | null
  lastInquiryAt: string
}

export default function AdminDemandPage() {
  const [demandSignals, setDemandSignals] = useState<DemandSignalSummary[]>([])
  const [totalCities, setTotalCities] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'count' | 'budget' | 'date'>('count')

  useEffect(() => {
    fetchDemandData(sortBy)
  }, [sortBy])

  async function fetchDemandData(sort: 'count' | 'budget' | 'date') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/admin/demand?sortBy=${sort}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch demand signals (status: ${res.status})`)
      }
      const data = await res.json()
      setDemandSignals(data.demandSignals || [])
      setTotalCities(data.totalCities || 0)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleExportCsv() {
    if (demandSignals.length === 0) return
    const headers = ['City', 'Inquiries', 'Median Budget (Cr)', 'Top BHK Requested', 'Last Active Date']
    const rows = demandSignals.map((d) => [
      `"${d.city}"`,
      d.inquiryCount,
      d.medianBudgetCr !== null ? `₹${d.medianBudgetCr} Cr` : 'N/A',
      d.topBhk ? `${d.topBhk} BHK` : 'N/A',
      new Date(d.lastInquiryAt).toLocaleDateString(),
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `propfyndr_demand_intelligence_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const totalInquiries = demandSignals.reduce((acc, curr) => acc + curr.inquiryCount, 0)
  const topCity = demandSignals.length > 0 ? demandSignals[0].city : 'N/A'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Demand Intelligence & Expansion Radar</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time telemetry capturing buyer search interest across unserved cities.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={demandSignals.length === 0}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition"
        >
          Export CSV Report
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-400">Total Unserved Queries</p>
          <p className="text-3xl font-bold text-white mt-2">{totalInquiries.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-400">Tracked Unserved Cities</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{totalCities}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-400">#1 Demanded Market</p>
          <p className="text-3xl font-bold text-amber-400 mt-2">{topCity}</p>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-zinc-400">Sort Leaderboard By:</span>
        <button
          onClick={() => setSortBy('count')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
            sortBy === 'count'
              ? 'bg-zinc-800 border-emerald-500 text-emerald-400'
              : 'border-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          Inquiry Volume
        </button>
        <button
          onClick={() => setSortBy('budget')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
            sortBy === 'budget'
              ? 'bg-zinc-800 border-emerald-500 text-emerald-400'
              : 'border-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          Median Budget
        </button>
        <button
          onClick={() => setSortBy('date')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
            sortBy === 'date'
              ? 'bg-zinc-800 border-emerald-500 text-emerald-400'
              : 'border-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          Recency
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-400 animate-pulse">Loading expansion demand data...</div>
        ) : error ? (
          <div className="p-6 text-center text-rose-400">Error: {error}</div>
        ) : demandSignals.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">No out-of-city demand signals recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950 text-xs font-semibold uppercase text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="py-3.5 px-4">City</th>
                  <th className="py-3.5 px-4">Inquiry Count</th>
                  <th className="py-3.5 px-4">Median Budget</th>
                  <th className="py-3.5 px-4">Top BHK Demand</th>
                  <th className="py-3.5 px-4">Last Inquiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {demandSignals.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">{item.city}</td>
                    <td className="py-3.5 px-4 font-mono font-medium text-emerald-400">
                      {item.inquiryCount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.medianBudgetCr !== null ? `₹${item.medianBudgetCr} Cr` : '—'}
                    </td>
                    <td className="py-3.5 px-4">{item.topBhk ? `${item.topBhk} BHK` : '—'}</td>
                    <td className="py-3.5 px-4 text-xs text-zinc-400">
                      {new Date(item.lastInquiryAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
