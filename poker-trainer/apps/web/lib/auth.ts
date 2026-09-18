const SESSION_COOKIE = 'workspace_session'
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7

function encode(value: Uint8Array | string) {
  const bytes =
    typeof value === 'string' ? new TextEncoder().encode(value) : value
  return Buffer.from(bytes).toString('base64url')
}

function decode(value: string) {
  return new Uint8Array(Buffer.from(value, 'base64url'))
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)),
  )
}

function authSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 characters')
  }
  return secret
}

export function loginConfiguration() {
  const username = process.env.APP_LOGIN_USERNAME
  const password = process.env.APP_LOGIN_PASSWORD
  if (!username || !password) {
    throw new Error('APP_LOGIN_USERNAME and APP_LOGIN_PASSWORD are required')
  }
  return { username, password }
}

export async function createSessionToken() {
  const payload = encode(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
    }),
  )
  return `${payload}.${encode(await signature(payload, authSecret()))}`
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return false
  try {
    const [payload, suppliedSignature, extra] = token.split('.')
    if (!payload || !suppliedSignature || extra !== undefined) return false
    const expected = await signature(payload, authSecret())
    const supplied = decode(suppliedSignature)
    if (expected.length !== supplied.length) return false
    let difference = 0
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected[index]! ^ supplied[index]!
    }
    if (difference !== 0) return false
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { exp?: unknown }
    return (
      typeof parsed.exp === 'number' &&
      parsed.exp > Math.floor(Date.now() / 1000)
    )
  } catch {
    return false
  }
}

export async function credentialsMatch(username: string, password: string) {
  const expected = loginConfiguration()
  const candidate = encode(
    await signature(`${username}\u0000${password}`, authSecret()),
  )
  const configured = encode(
    await signature(
      `${expected.username}\u0000${expected.password}`,
      authSecret(),
    ),
  )
  return candidate === configured
}

export const authCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_LIFETIME_SECONDS,
} as const

export function isSecureRequest(request: Request) {
  return (
    new URL(request.url).protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  )
}
