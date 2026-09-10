import { adminAuthHeaders } from './authedFetch'
import { API_BASE } from './env'

export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // Normalize path so passing '/api/v1/...' or '/admin/...' never causes double /api/v1 prefixing
  let normalizedPath = path
  if (normalizedPath.startsWith('/api/v1/')) {
    normalizedPath = normalizedPath.slice('/api/v1'.length)
  } else if (normalizedPath === '/api/v1') {
    normalizedPath = ''
  }
  if (!normalizedPath.startsWith('/') && normalizedPath.length > 0) {
    normalizedPath = `/${normalizedPath}`
  }

  const res = await fetch(`${API_BASE}${normalizedPath}`, {
    ...init,
    headers: { ...(init.headers as object), ...adminAuthHeaders() },
  })
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('admin_token')
    window.location.href = '/admin/login'
  }
  return res
}
