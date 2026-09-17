import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadWorkspaceEnvironment(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), 'poker-trainer/.env'),
  ]
  const environmentFile = candidates.find((candidate) => existsSync(candidate))
  if (environmentFile !== undefined) process.loadEnvFile(environmentFile)
}
