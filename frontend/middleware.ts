import { NextRequest, NextResponse } from 'next/server'
import { tenantFromHost, isPassThroughPath } from '@/lib/subdomain'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const requestHeaders = new Headers(request.headers)

  // Strip x-user-id to prevent spoofing
  requestHeaders.delete('x-user-id')

  // Derive access token from the Supabase auth cookie dynamically. A session
  // past ~3.1KB (a JWT carrying extra claims) is chunked by @supabase/ssr into
  // sb-<ref>-auth-token.0, .1, .2… — matching only the bare name silently drops
  // the token for any such session, forwarding no Authorization header at all.
  const authCookieParts = request.cookies.getAll()
    .filter(c => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => {
      const ai = Number(a.name.match(/\.(\d+)$/)?.[1] ?? -1)
      const bi = Number(b.name.match(/\.(\d+)$/)?.[1] ?? -1)
      return ai - bi
    })
  const supabaseToken = authCookieParts.length ? authCookieParts.map(c => c.value).join('') : undefined
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

  const rawHost = request.headers.get('host') || ''
  const host = rawHost.split(':')[0].trim().toLowerCase()

  // App subdomain routing: app.propfyndr.in directly serves the discovery / chat app
  if (host === 'app.propfyndr.in') {
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/discover'
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    }
  }

  // Apex domain routing: the buyer discovery/chat app lives on app.propfyndr.in,
  // so an old bookmark or shared link to one of its routes on the marketing
  // domain still ends up there. Deliberately NOT a blanket "redirect everything
  // except a few pages" — /admin, /builder, /partner, /auth are separate apps,
  // and /property, /dossier, /s are public share links meant to stay stable on
  // the apex domain without an extra hop. Only the bounded set of real
  // buyer-chat routes redirects.
  const APP_SUBDOMAIN_ROUTES = ['/discover', '/saved']
  if (
    (host === 'propfyndr.in' || host === 'www.propfyndr.in') &&
    APP_SUBDOMAIN_ROUTES.some(r => pathname === r || pathname.startsWith(`${r}/`))
  ) {
    const url = request.nextUrl.clone()
    url.host = 'app.propfyndr.in'
    url.protocol = 'https:'
    return NextResponse.redirect(url)
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
