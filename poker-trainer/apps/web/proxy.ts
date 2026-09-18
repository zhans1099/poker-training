import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authCookie, verifySessionToken } from './lib/auth'

const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/health',
  '/robots.txt',
])

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const authenticated = await verifySessionToken(
    request.cookies.get(authCookie.name)?.value,
  )

  if (pathname === '/login' && authenticated) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()
  if (authenticated) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
