import { NextRequest, NextResponse } from 'next/server'
import { tenantFromHost, isPassThroughPath } from '@/lib/subdomain'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const requestHeaders = new Headers(request.headers)

  // Strip x-user-id to prevent spoofing
  requestHeaders.delete('x-user-id')

  // A signed-in buyer's session is an httpOnly cookie on our domain
  // (Better Auth, backend lib/betterAuth.ts). /api/* is rewritten to the
  // backend with the cookie attached, so nothing is copied into a header here.

  const rawHost = request.headers.get('host') || ''
  const host = rawHost.split(':')[0].trim().toLowerCase()

  // App subdomain routing: app.realtyask.in directly serves the discovery / chat app.
  //
  // realtyask.in/discover and /saved move to the app host in the browser
  // (components/AppHostRedirect), not here: the guest identity lives in
  // localStorage, which a server redirect cannot see, so the page first
  // mirrors it into a `.realtyask.in` cookie and only then hops
  // (lib/sharedIdentity.ts). /property, /dossier and /s share links stay on
  // the apex. propfyndr.in hosts are 308'd to realtyask.in by Vercel.
  if (host === 'app.realtyask.in' && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/discover'
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  /**
   * Tenant subdomain routing. `lotus.realtyask.in/` serves the portal entry
   * instead of the buyer homepage.
   *
   * A rewrite, not a redirect: the address bar keeps saying
   * `lotus.realtyask.in`, which is the entire point of the feature.
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

  if (process.env.DEBUG_MIDDLEWARE === 'true' && pathname.startsWith('/api/')) {
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
