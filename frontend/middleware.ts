import { NextRequest, NextResponse } from 'next/server'
import { tenantFromHost, isPassThroughPath } from '@/lib/subdomain'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const requestHeaders = new Headers(request.headers)

  // Strip x-user-id to prevent spoofing
  requestHeaders.delete('x-user-id')

  // Derive access token from the Supabase auth cookie dynamically
  const cookieName = request.cookies.getAll().find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))?.name
  const supabaseToken = cookieName ? request.cookies.get(cookieName)?.value : undefined
  if (supabaseToken) {
    try {
      const parsed = JSON.parse(supabaseToken)
      const accessToken: string | undefined = Array.isArray(parsed) ? parsed[0] : parsed?.access_token
      if (accessToken) {
        requestHeaders.set('Authorization', `Bearer ${accessToken}`)
      }
    } catch {
      // Ignore parse errors, the backend will just see no Authorization header
    }
  }

  /**
   * Tenant subdomain routing. `lotus.propfyndr.in/` serves the portal entry
   * instead of the buyer homepage.
   *
   * A rewrite, not a redirect: the address bar keeps saying
   * `lotus.propfyndr.in`, which is the entire point of the feature.
   *
   * The subdomain is passed on as a header for BRANDING only. Nothing
   * downstream may treat it as proof of identity — scope comes from the
   * session, server-side, on every portal endpoint.
   */
  const tenant = tenantFromHost(request.headers.get('host'))
  if (tenant && !isPassThroughPath(pathname)) {
    requestHeaders.set('x-portal-tenant', tenant)
    const url = request.nextUrl.clone()
    url.pathname = '/portal-entry'
    url.searchParams.set('tenant', tenant)
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }
  if (tenant) {
    requestHeaders.set('x-portal-tenant', tenant)
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  if (pathname.startsWith('/api/')) {
    const hasAuth = requestHeaders.has('Authorization')
    console.log(`[mw] ${request.method} ${pathname} auth=${hasAuth ? 'yes' : 'no'}`)
  }

  return response
}

export const config = {
  // Was '/api/:path*'. Tenant routing has to see ordinary page requests too,
  // so the matcher now covers everything except the static asset paths that
  // would only pay the middleware cost for nothing.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
}
