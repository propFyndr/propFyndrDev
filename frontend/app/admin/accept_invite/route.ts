import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const destination = new URL('/admin/accept-invite', request.url)
  searchParams.forEach((val, key) => {
    destination.searchParams.set(key, val)
  })
  return NextResponse.redirect(destination, 307)
}
