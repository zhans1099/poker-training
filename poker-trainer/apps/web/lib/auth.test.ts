import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createSessionToken,
  credentialsMatch,
  verifySessionToken,
} from './auth'

const originalEnvironment = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  APP_LOGIN_USERNAME: process.env.APP_LOGIN_USERNAME,
  APP_LOGIN_PASSWORD: process.env.APP_LOGIN_PASSWORD,
}

describe('single-user authentication', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET =
      'test-secret-that-is-longer-than-thirty-two-characters'
    process.env.APP_LOGIN_USERNAME = 'owner'
    process.env.APP_LOGIN_PASSWORD = 'correct horse battery staple'
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('accepts configured credentials and rejects incorrect credentials', async () => {
    await expect(
      credentialsMatch('owner', 'correct horse battery staple'),
    ).resolves.toBe(true)
    await expect(credentialsMatch('owner', 'wrong')).resolves.toBe(false)
  })

  it('signs sessions and rejects a modified token', async () => {
    const token = await createSessionToken()
    await expect(verifySessionToken(token)).resolves.toBe(true)
    await expect(verifySessionToken(`${token}changed`)).resolves.toBe(false)
  })
})
