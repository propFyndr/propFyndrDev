import type { Metadata } from 'next'
import { API_BASE } from '@/lib/env'

type Params = { slug: string }

async function fetchBuilder(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/builders/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const data = await res.json()
    return data.builder ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const b = await fetchBuilder(slug)

  if (!b) {
    return {
      title: 'Developer Profile | PropFyndr',
      description: 'Verified real estate developers, track record, delivery timelines, and project reviews in Noida & NCR.',
    }
  }

  const title = `${b.name} — Track Record, Ongoing Projects & Delivery Due Diligence | PropFyndr`
  const deliveredClause = b.delivered_units ? ` ${b.delivered_units.toLocaleString()} units delivered.` : ''
  const credaiClause = b.credai_member ? ' CREDAI Member.' : ''
  const description = `${b.name} profile on PropFyndr.${deliveredClause}${credaiClause} Track record, delivery timelines, and project reviews across Noida, Greater Noida, and Yamuna Expressway.`

  const canonicalUrl = `https://propfyndr.in/builder/${slug}`

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
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return children
}
