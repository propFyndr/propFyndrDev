function getApiBase(): string {
  // When running in the browser, route through the Next.js rewrite proxy (/api/v1)
  // so that the backend URL (e.g. onrender) is masked behind the domain and not exposed in DevTools.
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FORCE_DIRECT_API !== 'true') {
    return '/api/v1'
  }
  const direct = process.env.NEXT_PUBLIC_API_URL
  if (direct) return direct.replace(/\/$/, '')
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL
  if (backend) return `${backend.replace(/\/$/, '')}/api/v1`
  return '/api/v1'
}

export const API_BASE = getApiBase()

