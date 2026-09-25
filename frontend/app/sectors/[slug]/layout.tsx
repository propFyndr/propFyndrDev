import type { Metadata } from 'next'
import { fetchSector } from './data'

type Params = { slug: string }

/**
 * Metadata for a micro-market page.
 *
 * Mirrors `property/[slug]/layout.tsx` deliberately — same title shape, same
 * 160-character description cap, same canonical and OG handling — because two
 * page types that describe themselves differently to a crawler is how one of
 * them quietly stops ranking.
 *
 * The description is assembled only from fields the sector row actually has.
 * A sector with no verified price figure gets a shorter description rather
 * than an invented one: § Answering With Data We Hold applies to a meta tag
 * exactly as it applies to a chat answer, and this is the copy Google reads.
 */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const data = await fetchSector(slug)
  const s = data?.sector

  if (!s) {
    return {
      title: 'Micro-market on PropFyndr',
      description: 'AI-guided home buying in Noida. Compare projects, see RERA status, get honest trade-offs.',
    }
  }

  const title = `${s.sector}, ${s.city} — Prices, Livability & Project Due Diligence | PropFyndr`

  const countClause = data.project_count
    ? ` ${data.project_count} verified project${data.project_count === 1 ? '' : 's'}.`
    : ''
  const priceClause = s.avg_price_per_sqft
    ? ` Average ₹${Math.round(s.avg_price_per_sqft).toLocaleString('en-IN')}/sq.ft.`
    : ''
  const metroClause = s.nearest_metro_station ? ` Nearest metro: ${s.nearest_metro_station}.` : ''
  const stageClause = s.micro_market ? ` ${s.micro_market}.` : ''

  const rawDesc =
    `${s.sector} in ${s.city}.${stageClause}${countClause}${priceClause}${metroClause}` +
    ' Independent ground due diligence — water source, air quality, flood risk and builder record — on PropFyndr.'
  const description = rawDesc.length > 160 ? rawDesc.slice(0, 157) + '...' : rawDesc

  const canonicalUrl = `https://propfyndr.in/sectors/${slug}`
  const ogImages = [{ url: 'https://propfyndr.in/og-default.jpg', width: 1200, height: 630, alt: `${s.sector}, ${s.city}` }]

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      siteName: 'PropFyndr',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages.map((img) => img.url),
    },
  }
}

export default function SectorLayout({ children }: { children: React.ReactNode }) {
  return children
}
