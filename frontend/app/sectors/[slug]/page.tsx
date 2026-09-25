import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchSector } from './data'

export const revalidate = 1800

type Params = { slug: string }

interface SectorProject {
  id: string
  slug: string
  name: string
  status: string | null
  price_min_cr: number | null
  price_range_label: string | null
  possession_label: string | null
  possession_date: string | null
  rera_number: string | null
  builder: { name: string | null; slug: string | null } | null
}

/**
 * A figure we hold, or nothing at all.
 *
 * Every value on this page goes through here. A sector row with a null
 * `avg_price_per_sqft` renders no price tile rather than a zero, an em dash or
 * a "typical" figure — § Answering With Data We Hold, tier `missing`: an
 * absent field means absent, and a gap must not invite a guess.
 */
function Stat({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  if (!value) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>}
    </div>
  )
}

function List({ title, items, tone }: { title: string; items: string[] | null; tone: 'good' | 'bad' }) {
  if (!items?.length) return null
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span
              aria-hidden
              className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === 'good' ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-amber-600 dark:bg-amber-500'
              }`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const crore = (n: number) => (n >= 1 ? `₹${n} Cr` : `₹${Math.round(n * 100)} L`)

export default async function SectorPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const data = await fetchSector(slug)
  if (!data?.sector) notFound()

  const s = data.sector
  const projects: SectorProject[] = data.projects ?? []

  const verified = s.last_verified_at
    ? new Date(s.last_verified_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null

  const water = s.utilities_profile as { water_source?: string; tds_ppm?: number } | null

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <nav className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">Home</Link>
        <span className="mx-1.5">/</span>
        <Link href="/discover" className="hover:text-zinc-900 dark:hover:text-zinc-100">Discover</Link>
        <span className="mx-1.5">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">{s.sector}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          {s.sector}, {s.city}
        </h1>
        {s.micro_market && (
          <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">{s.micro_market}</p>
        )}
        {s.sector_overview && (
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            {s.sector_overview}
          </p>
        )}
        {verified && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Ground data last verified {verified}.</p>
        )}
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Average rate"
          value={s.avg_price_per_sqft ? `₹${Math.round(s.avg_price_per_sqft).toLocaleString('en-IN')}` : null}
          hint="per sq.ft"
        />
        <Stat label="5-year CAGR" value={s.price_5yr_cagr_pct != null ? `${s.price_5yr_cagr_pct}%` : null} hint="recorded, not projected" />
        <Stat label="Rental yield" value={s.rental_yield_pct != null ? `${s.rental_yield_pct}%` : null} hint="gross" />
        <Stat label="Projects tracked" value={data.project_count ? String(data.project_count) : null} />
        <Stat label="Nearest metro" value={s.nearest_metro_station} hint={s.metro_distance_km != null ? `${s.metro_distance_km} km` : undefined} />
        <Stat label="Airport" value={s.airport_distance_km != null ? `${s.airport_distance_km} km` : null} hint="Jewar" />
        <Stat
          label="Water source"
          value={water?.water_source ?? null}
          hint={water?.tds_ppm != null ? `TDS ${water.tds_ppm} ppm` : undefined}
        />
        <Stat label="Air quality" value={s.aqi_annual_avg != null ? `AQI ${Math.round(s.aqi_annual_avg)}` : null} hint="annual average" />
      </section>

      {(s.sector_strengths?.length || s.sector_weaknesses?.length) && (
        <section className="mt-10 grid gap-8 sm:grid-cols-2">
          <List title="What works here" items={s.sector_strengths} tone="good" />
          <List title="What to weigh against it" items={s.sector_weaknesses} tone="bad" />
        </section>
      )}

      {(s.who_should_buy || s.who_should_avoid) && (
        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          {s.who_should_buy && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Who this suits</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{s.who_should_buy}</p>
            </div>
          )}
          {/*
            Shown with the same weight as "who this suits", not tucked below it.
            A micro-market page that only says who should buy is a brochure.
          */}
          {s.who_should_avoid && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Who should look elsewhere</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{s.who_should_avoid}</p>
            </div>
          )}
        </section>
      )}

      {s.flood_waterlogging_risk && (
        <section className="mt-10 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Monsoon &amp; drainage — {s.flood_waterlogging_risk.toLowerCase().replace(/_/g, ' ')} risk
          </h3>
          {s.flood_zone_description && (
            <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{s.flood_zone_description}</p>
          )}
          {s.drainage_network_quality && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Drainage network: {s.drainage_network_quality.toLowerCase()}.
            </p>
          )}
        </section>
      )}

      {projects.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Projects in {s.sector}
          </h2>
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/property/${p.slug}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">{p.name}</div>
                    {p.builder?.name && (
                      <div className="truncate text-sm text-zinc-500 dark:text-zinc-400">{p.builder.name}</div>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {p.price_range_label || (p.price_min_cr != null ? `From ${crore(p.price_min_cr)}` : 'Price not recorded')}
                    </div>
                    {p.possession_label && (
                      <div className="text-zinc-500 dark:text-zinc-400">{p.possession_label}</div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Deciding between {s.sector} and somewhere else?
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Ask the advisor what this micro-market trades away, and against which one.
        </p>
        <Link
          href={`/discover?q=${encodeURIComponent(`Tell me about buying in ${s.sector}, ${s.city}`)}`}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Ask the advisor
        </Link>
      </section>
    </main>
  )
}
