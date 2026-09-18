import { NextResponse } from 'next/server'
import { authCookie, isSecureRequest } from '../../../../lib/auth'

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url), 303)
  response.cookies.set(authCookie.name, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecureRequest(request),
    path: '/',
    maxAge: 0,
  })
  return response
}
