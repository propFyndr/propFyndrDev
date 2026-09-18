'use client'

/**
 * The analyst's worklist.
 *
 * Every check behind this screen is "this column is empty", never "this value
 * looks wrong". An absent field is a fact you can act on; a heuristic that
 * guesses a row is suspect sends you to re-verify data that was already
 * correct, and after the second false lead nobody opens the board again.
 *
 * Sorted worst-first: a project missing four things is a bigger job than four
 * projects missing one each, and it is also the one most likely to be
 * misleading a buyer right now.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Buildings, Warning, ArrowRight } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { PageShell, PageHeader, Card, StatCard, EmptyState, Spinner, ErrorNote } from '@/components/portal/ui'

interface QualityProject {
  id: string
  name: string
  slug: string
  sector: string
  status: string
  updated_at: string
  gaps: string[]
}

interface ThinProject {
  id: string
  name: string
  slug: string
  sector: string
  score: number
  weakest: string | null
}

interface QualityResponse {
  stats: {
    total: number
    complete: number
    missing_rera: number
    missing_possession: number
    missing_price: number
    missing_description: number
    no_images: number
    no_unit_types: number
  }
  worklist: QualityProject[]
  thinnest: ThinProject[]
  scores_available: boolean
}

/**
 * Ordered by what a buyer is hurt by first. A missing RERA number is a legal
 * fact they cannot check; a missing description is only a thinner page.
 */
const GAP_ROWS: Array<{ key: keyof QualityResponse['stats']; label: string }> = [
  { key: 'missing_rera', label: 'No RERA number' },
  { key: 'missing_price', label: 'No price' },
  { key: 'missing_possession', label: 'No possession date' },
  { key: 'no_unit_types', label: 'No unit types' },
  { key: 'no_images', label: 'No images' },
  { key: 'missing_description', label: 'No description' },
]

export default function DataQualityPage() {
  const [data, setData] = useState<QualityResponse | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/admin/boards/data-quality')
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
    } catch {
      setError('Could not load the data quality board.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const pctComplete = data && data.stats.total > 0
    ? Math.round((data.stats.complete / data.stats.total) * 100)
    : null

  if (!data && !error) return <Spinner />

  return (
    <PageShell>
      <PageHeader
        title="Data quality"
        subtitle="Catalogue rows with fields a buyer would look for and not find."
      />

      {error && <ErrorNote message={error} />}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Projects" value={data.stats.total} icon={<Buildings size={16} />} />
            <StatCard
              label="Complete"
              value={data.stats.complete}
              tone="good"
              hint={pctComplete !== null ? `${pctComplete}%` : undefined}
              icon={<Buildings size={16} />}
            />
            <StatCard label="Need work" value={data.worklist.length} icon={<Warning size={16} weight="bold" />} />
          </div>

          <section className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              By field
            </h2>
            <ul className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
              {GAP_ROWS.map(({ key, label }) => (
                <li key={key} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-[13px] text-zinc-700 dark:text-zinc-300">{label}</span>
                  <span className={`text-[13px] font-bold tabular-nums ${data.stats[key] === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'}`}>
                    {data.stats[key]}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/*
            The six field checks below are all green across the catalogue and
            have been since this board shipped. What actually varies is the
            completeness score, which reads brochures, payment plans,
            construction milestones and the intelligence profiles — so the
            weakest rows by score are the real worklist.
          */}
          <section className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Thinnest projects
            </h2>
            {!data.scores_available ? (
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 px-0.5">
                Scores are calculated when the Projects page loads. Open it once and come back.
              </p>
            ) : data.thinnest.length === 0 ? (
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 px-0.5">No scored projects yet.</p>
            ) : (
              <Card className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                {data.thinnest.map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-zinc-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                        {p.sector}{p.weakest ? ` · weakest section: ${p.weakest}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[15px] font-extrabold tabular-nums text-amber-600 dark:text-amber-400">{p.score}</span>
                      <Link
                        href={`/admin/projects?open=${p.id}`}
                        className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        Fix
                      </Link>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Missing core fields
            </h2>
            {data.worklist.length === 0 ? (
              <EmptyState
                icon={<Buildings size={32} />}
                title="Every project has its core fields"
                body="No catalogue row is missing a RERA number, price, possession date, unit type, image or description. The thinnest-projects list above is where the remaining work is."
              />
            ) : (
              <ul className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                {data.worklist.map((p) => (
                  <li key={p.id} className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Buildings size={14} className="text-zinc-400 shrink-0" />
                        <p className="text-[14px] font-bold text-zinc-900 dark:text-white truncate">{p.name}</p>
                      </div>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {p.sector} · {p.status.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      {p.gaps.map((g) => (
                        <span
                          key={g}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900"
                        >
                          <Warning size={10} weight="bold" />{g}
                        </span>
                      ))}
                    </div>

                    <Link
                      href={`/admin/projects?open=${p.id}`}
                      className="shrink-0 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[12px] font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      Fix
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link
            href="/admin/projects"
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            All projects <ArrowRight size={14} weight="bold" />
          </Link>
        </>
      )}
    </PageShell>
  )
}
