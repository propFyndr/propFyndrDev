import type { Metadata } from 'next'
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
      title: 'Property on PropFyndr',
      description: 'AI-guided home buying in Noida. Compare projects, see RERA status, get honest trade-offs.',
    }
  }

  const title = `${p.name}, ${p.sector || 'Noida'}, ${p.city || 'NCR'} — Prices, Floor Plans & Due Diligence | PropFyndr`
  
  const builderClause = p.builder?.name ? ` by ${p.builder.name}` : ''
  const priceClause = p.price_range_label ? ` Pricing: ${p.price_range_label}.` : ''
  const reraClause = p.rera_number ? ` UP RERA #${p.rera_number}.` : ''
  const groundClause = p.tagline?.trim() ? ` ${p.tagline.trim()}` : ''
  const rawDesc = `${p.name}${builderClause} in ${p.sector || 'Noida'}, ${p.city || 'NCR'}.${priceClause}${reraClause}${groundClause} Independent ground due diligence and AI advisor on PropFyndr.`
  const description = rawDesc.length > 160 ? rawDesc.slice(0, 157) + '...' : rawDesc

  const canonicalUrl = `https://propfyndr.in/property/${slug}`
  const ogImages = p.hero_image_url
    ? [{ url: p.hero_image_url, width: 1200, height: 630, alt: p.name }]
    : [{ url: 'https://propfyndr.in/og-default.jpg', width: 1200, height: 630, alt: 'PropFyndr' }]

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
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

export default function PropertyLayout({ children }: { children: React.ReactNode }) {
  return children
}
