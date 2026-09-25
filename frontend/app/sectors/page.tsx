import type { Metadata } from 'next'
import Link from 'next/link'
import { API_BASE } from '@/lib/env'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Noida & Greater Noida Micro-Markets — Sector Guides | PropFyndr',
  description:
    'Sector-by-sector ground reality across Noida, Greater Noida and the Yamuna Expressway: prices, water source, air quality, flood risk and who each micro-market actually suits.',
  alternates: { canonical: 'https://propfyndr.in/sectors' },
}

interface SectorRow {
  slug: string
  city: string
  sector: string
  micro_market: string | null
  sector_stage: string | null
  avg_price_per_sqft: number | null
  lifestyle_tags: string[]
}

async function fetchSectors(): Promise<SectorRow[]> {
  try {
    const res = await fetch(`${API_BASE}/sectors`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = await res.json()
    return data.sectors ?? []
  } catch {
    return []
  }
}

export default async function SectorsIndexPage() {
  const sectors = await fetchSectors()

  // Grouped by city because "Sector 1" exists in three of them, and a flat
  // list of sector numbers is the exact ambiguity the advisor has a
  // disambiguation rule for.
  const byCity = sectors.reduce<Record<string, SectorRow[]>>((acc, s) => {
    ;(acc[s.city] ||= []).push(s)
    return acc
  }, {})

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
        Micro-markets we cover
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
        What each sector is actually like to live in — the water that comes out of the tap, the air in
        January, what floods in July, and who should be looking somewhere else.
      </p>

      {sectors.length === 0 && (
        <p className="mt-10 text-sm text-zinc-500 dark:text-zinc-400">
          Sector guides are being verified and will appear here shortly.
        </p>
      )}

      {Object.entries(byCity).map(([city, rows]) => (
        <section key={city} className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{city}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {rows.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/sectors/${s.slug}`}
                  className="flex min-h-[44px] items-baseline justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-900 dark:text-zinc-50">{s.sector}</span>
                    {s.micro_market && (
                      <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">{s.micro_market}</span>
                    )}
                  </span>
                  {s.avg_price_per_sqft != null && (
                    <span className="shrink-0 text-sm text-zinc-600 dark:text-zinc-400">
                      ₹{Math.round(s.avg_price_per_sqft).toLocaleString('en-IN')}/sq.ft
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
