import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site'
import { API_BASE } from '@/lib/env'

type Params = { slug: string }

async function fetchProject(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/projects/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const data = await res.json()
    return data.project ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const p = await fetchProject(slug)

  if (!p) {
    return {
      title: 'Property on RealtyAsk',
      description: 'AI-guided home buying in Noida. Compare projects, see RERA status, get honest trade-offs.',
    }
  }

  // The root layout's template adds " | RealtyAsk"; writing it here too gave "| RealtyAsk | RealtyAsk".
  const title = `${p.name}, ${p.sector || 'Noida'}, ${p.city || 'NCR'}: Price, RERA & Floor Plans`
  const shareTitle = `${title} | RealtyAsk`

  // No builder tagline (developer copy) and no "ground due diligence": we do not inspect sites.
  const builderClause = p.builder?.name ? ` by ${p.builder.name}` : ''
  const priceClause = p.price_range_label ? ` Price ${p.price_range_label}.` : ''
  const reraClause = p.rera_number ? ` UP RERA ${p.rera_number}.` : ''
  const rawDesc = `${p.name}${builderClause} in ${p.sector || 'Noida'}, ${p.city || 'NCR'}.${priceClause}${reraClause} Ask RealtyAsk about its cost, possession and trade-offs.`
  const description = rawDesc.length > 160 ? rawDesc.slice(0, 157) + '...' : rawDesc

  const canonicalUrl = `${SITE_URL}/property/${slug}`
  // Without a hero image, the route's opengraph-image.tsx supplies one (og-default.jpg does not exist).
  const ogImages = p.hero_image_url ? [{ url: p.hero_image_url, width: 1200, height: 630, alt: p.name }] : undefined

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: shareTitle,
      description,
      url: canonicalUrl,
      type: 'website',
      siteName: 'RealtyAsk',
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description,
      ...(ogImages ? { images: ogImages.map((img) => img.url) } : {}),
    },
  }
}

/**
 * Structured data for search engines and AI answer engines: only fields read from the
 * project's row (name, place, builder, RERA). No price range, rating or geo: coordinates
 * are placeholders on many rows, and a price in markup reads as a current offer.
 */
function projectJsonLd(p: { name: string; slug?: string; sector?: string | null; city?: string | null; builder?: { name?: string | null } | null; rera_number?: string | null }, url: string) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ApartmentComplex',
      name: p.name,
      url,
      address: {
        '@type': 'PostalAddress',
        addressLocality: [p.sector, p.city].filter(Boolean).join(', ') || 'Noida',
        addressRegion: 'Uttar Pradesh',
        addressCountry: 'IN',
      },
      ...(p.builder?.name ? { brand: { '@type': 'Organization', name: p.builder.name } } : {}),
      ...(p.rera_number ? { identifier: { '@type': 'PropertyValue', propertyID: 'UP RERA', value: p.rera_number } } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RealtyAsk', item: SITE_URL },
        ...(p.sector ? [{ '@type': 'ListItem', position: 2, name: p.sector }] : []),
        { '@type': 'ListItem', position: p.sector ? 3 : 2, name: p.name, item: url },
      ],
    },
  ]
}

export default async function PropertyLayout({ children, params }: { children: React.ReactNode; params: Promise<Params> }) {
  const { slug } = await params
  const p = await fetchProject(slug) // same cached fetch as generateMetadata
  return (
    <>
      {p?.name ? (
        <script
          type="application/ld+json"
          // JSON.stringify output with "<" escaped cannot close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(projectJsonLd(p, `${SITE_URL}/property/${slug}`)).replace(/</g, '\\u003c') }}
        />
      ) : null}
      {children}
    </>
  )
}
