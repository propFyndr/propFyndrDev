import { MetadataRoute } from 'next'
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
      url: `${baseUrl}/sectors`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
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
    /**
     * Read over the API rather than from a second Prisma client.
     *
     * This file and one API route were the only two consumers of a whole
     * duplicate schema, generated client and connection pool in the frontend —
     * 1,768 lines maintained by hand against the backend's 2,041, with nothing
     * keeping them in agreement. `GET /api/v1/sitemap` returns slugs and
     * nothing else.
     */
    const res = await fetch(`${API_BASE}/sitemap`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`sitemap slugs: ${res.status}`)
    const { projects, builders } = (await res.json()) as {
      projects: Array<{ slug: string; updated_at?: string }>
      builders: Array<{ slug: string }>
    }

    const projectPages: MetadataRoute.Sitemap = projects.map((p) => ({
      url: `${baseUrl}/property/${p.slug}`,
      // Real row timestamps now, where before every page claimed to have
      // changed at build time — which tells a crawler nothing.
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    const builderPages: MetadataRoute.Sitemap = builders.map((b) => ({
      url: `${baseUrl}/builder/${b.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

    /**
     * Sector pages, from their own endpoint.
     *
     * A separate fetch rather than an extra key on /sitemap: sector rows are
     * analyst-maintained on a different cadence to the catalogue, and a failure
     * to load them must not cost us the project URLs — hence its own try.
     */
    let sectorPages: MetadataRoute.Sitemap = []
    try {
      const secRes = await fetch(`${API_BASE}/sectors`, { next: { revalidate: 3600 } })
      if (secRes.ok) {
        const { sectors } = (await secRes.json()) as {
          sectors: Array<{ slug: string; updated_at?: string }>
        }
        sectorPages = (sectors || []).map((s) => ({
          url: `${baseUrl}/sectors/${s.slug}`,
          lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        }))
      }
    } catch (error) {
      console.error('[SITEMAP_SECTOR_ERROR]', error)
    }

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

    return [...staticPages, ...projectPages, ...builderPages, ...sectorPages, { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 }, ...blogPages]
  } catch (error) {
    console.error('[SITEMAP_GEN_ERROR]', error)
    return staticPages
  }
}

