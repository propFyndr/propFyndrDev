import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/auth', '/dashboard', '/saved', '/_next/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

