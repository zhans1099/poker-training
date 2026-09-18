import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authCookie,
  createSessionToken,
  credentialsMatch,
  isSecureRequest,
} from '../../../../lib/auth'

const loginSchema = z
  .object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(500),
  })
  .strict()

export async function POST(request: Request) {
  const input = loginSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', message: 'Invalid credentials' } },
      { status: 400 },
    )
  }
  if (!(await credentialsMatch(input.data.username, input.data.password))) {
    return NextResponse.json(
      {
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      },
      { status: 401 },
    )
  }
  const response = NextResponse.json({ data: { authenticated: true } })
  response.cookies.set(authCookie.name, await createSessionToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecureRequest(request),
    path: '/',
    maxAge: authCookie.maxAge,
  })
  return response
}
