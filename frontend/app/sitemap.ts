import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { API_BASE } from '@/lib/env'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://propfyndr.in'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/discover`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2026-08-16'),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date('2026-08-16'),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ]

  try {
    const [projects, builders] = await Promise.all([
      prisma.project.findMany({
        select: { slug: true },
        where: { slug: { not: '' } },
      }),
      prisma.builder.findMany({
        select: { slug: true },
        where: { slug: { not: '' } },
      }),
    ])

    const projectPages: MetadataRoute.Sitemap = projects.map((p) => ({
      url: `${baseUrl}/property/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    const builderPages: MetadataRoute.Sitemap = builders.map((b) => ({
      url: `${baseUrl}/builder/${b.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

    let blogPages: MetadataRoute.Sitemap = []
    try {
      const res = await fetch(`${API_BASE}/blog?limit=50`)
      if (res.ok) {
        const data = await res.json()
        blogPages = (data.posts || []).map((p: { slug: string; published_at?: string }) => ({
          url: `${baseUrl}/blog/${p.slug}`,
          lastModified: p.published_at ? new Date(p.published_at) : new Date(),
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        }))
      }
    } catch (error) {
      console.error('[SITEMAP_BLOG_ERROR]', error)
    }

    return [...staticPages, ...projectPages, ...builderPages, { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 }, ...blogPages]
  } catch (error) {
    console.error('[SITEMAP_GEN_ERROR]', error)
    return staticPages
  }
}

