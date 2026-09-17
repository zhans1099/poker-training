import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from './generated/prisma/client'
import { loadWorkspaceEnvironment } from './environment'

loadWorkspaceEnvironment()

export class DatabaseConfigurationError extends Error {
  override readonly name = 'DatabaseConfigurationError'
}

function createClient() {
  const connectionUrl = process.env.DATABASE_URL
  if (!connectionUrl) {
    throw new DatabaseConfigurationError('DATABASE_URL is not configured')
  }

  const parsed = new URL(connectionUrl)
  if (parsed.protocol !== 'mysql:') {
    throw new DatabaseConfigurationError(
      'DATABASE_URL must use the mysql protocol',
    )
  }

  const database = parsed.pathname.replace(/^\//, '')
  if (!database) {
    throw new DatabaseConfigurationError(
      'DATABASE_URL must include a database name',
    )
  }

  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  })

  return new PrismaClient({ adapter })
}

const globalDatabase = globalThis as typeof globalThis & {
  pokerTrainerPrisma?: PrismaClient
}

export function getPrisma() {
  const client = globalDatabase.pokerTrainerPrisma ?? createClient()
  if (process.env.NODE_ENV !== 'production')
    globalDatabase.pokerTrainerPrisma = client
  return client
}
