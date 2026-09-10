import type { Metadata } from 'next'
import { API_BASE } from '@/lib/env'

type Params = { slug: string }

async function fetchPost(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/blog/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const data = await res.json()
    return data.post ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const post = await fetchPost(slug)

  if (!post) {
    return {
      title: 'Article on PropFyndr',
      description: 'Guides, market notes, and honest analysis for Noida home buyers.',
    }
  }

  const title = post.meta_title || post.title
  const description = post.meta_description || post.excerpt || `${post.title} — read on the PropFyndr blog.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'PropFyndr',
      images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
