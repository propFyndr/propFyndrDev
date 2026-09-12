const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Two `next dev` instances sharing one .next directory corrupt each other's
  // chunks — the browser gets "require.e is not a function" and renders a blank
  // page. Set NEXT_DIST_DIR to run a second instance (a QA pass against a
  // different backend, say) without disturbing the one already running.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    instrumentationHook: true,
    optimizePackageImports: [
      'lucide-react',
      '@phosphor-icons/react',
      'framer-motion',
      'date-fns',
      'recharts'
    ],
    serverComponentsExternalPackages: ['@sentry/node', '@apm-js-collab/tracing-hooks'],
  },
  transpilePackages: ['leaflet', 'react-leaflet', 'recharts', 'react-is'],
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'unpkg.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
      {
        protocol: 'https',
        hostname: 'storage.propfyndr.com',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
    ],
  },
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/discovery',
        destination: '/discover',
        permanent: true,
      },
      {
        // /get-listed hosted a form that saved nothing — it showed
        // "Listing Submitted!" and discarded the submission. Builder
        // registration is the real pipeline, so any surviving link lands there.
        source: '/get-listed',
        destination: '/builder-register',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'X-XSS-Protection',         value: '1; mode=block' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',       value: 'camera=(), microphone=(self), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: (() => {
              // Must allow every origin the browser actually calls, which means
              // mirroring lib/env.ts's precedence exactly. It did not: env.ts
              // prefers NEXT_PUBLIC_API_URL, this read NEXT_PUBLIC_BACKEND_URL
              // first. Setting the two to different hosts made the CSP block
              // every API request — silently, with the app simply not loading
              // any data. Both origins are allowed now so the two cannot drift.
              const origins = new Set(
                [
                  process.env.NEXT_PUBLIC_API_URL,
                  process.env.NEXT_PUBLIC_BACKEND_URL,
                  process.env.BACKEND_URL,
                  'http://localhost:3001',
                ]
                  .filter(Boolean)
                  .map(u => {
                    try { return new URL(u.replace(/\/$/, '')).origin } catch { return null }
                  })
                  .filter(Boolean),
              )
              // PostHog's asset and ingestion hosts are separate from the app host.
              const connectSrc = `'self' ${[...origins].join(' ')} https://*.supabase.co https://*.supabase.in https://*.posthog.com https://*.i.posthog.com https://us.posthog.com https://app.posthog.com https://maps.googleapis.com https://*.onrender.com https://*.vercel.app https: wss:`
              const scriptSrc = "'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.google-analytics.com https://maps.googleapis.com https://*.posthog.com https://us.posthog.com https://app.posthog.com https://us-assets.i.posthog.com https://*.i.posthog.com"
              const fontSrc = "'self' https://fonts.gstatic.com https://fonts.googleapis.com data: https:"
              return `default-src 'self'; script-src ${scriptSrc}; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src ${fontSrc}; img-src 'self' data: blob: https:; connect-src ${connectSrc}; frame-ancestors 'none';`
            })(),
          },
        ],
      },
    ]
  },
}

const isDev = process.env.NODE_ENV !== 'production'

module.exports = isDev ? nextConfig : withSentryConfig(nextConfig, {
  org: 'propfyndr',
  project: 'propfyndr-sentry',
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
})
