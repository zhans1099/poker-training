import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../../../..')
const pokerTrainerRoot = resolve(repositoryRoot, 'poker-trainer')
const environmentPath = resolve(pokerTrainerRoot, '.env')
const ruoYiDatasourcePath = resolve(
  repositoryRoot,
  'RuoYi-Vue-master/ruoyi-admin/src/main/resources/application-druid.yml',
)

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function masterValue(masterBlock: string, key: string): string {
  const match = masterBlock.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'))
  if (match?.[1] === undefined) {
    throw new Error(`RuoYi master datasource is missing ${key}`)
  }
  const value = unquote(match[1])
  if (value.length === 0 || value.startsWith('${')) {
    throw new Error(`RuoYi master datasource ${key} must be a literal value`)
  }
  return value
}

const datasource = readFileSync(ruoYiDatasourcePath, 'utf8')
const masterBlock = datasource.match(
  /^\s*master:\s*$([\s\S]*?)(?=^\s*slave:\s*$)/m,
)?.[1]
if (masterBlock === undefined) {
  throw new Error('RuoYi master datasource section was not found')
}

const jdbcUrl = masterValue(masterBlock, 'url')
const username = masterValue(masterBlock, 'username')
const password = masterValue(masterBlock, 'password')
if (!jdbcUrl.startsWith('jdbc:mysql://')) {
  throw new Error('RuoYi master datasource must use jdbc:mysql')
}

const databaseUrl = new URL(jdbcUrl.slice('jdbc:'.length))
databaseUrl.username = username
databaseUrl.password = password

const currentEnvironment = readFileSync(environmentPath, 'utf8')
const databaseLine = `DATABASE_URL=${JSON.stringify(databaseUrl.toString())}`
let replaced = false
const nextLines = currentEnvironment
  .split(/\r?\n/)
  .filter((line) => {
    if (!/^\s*DATABASE_URL\s*=/.test(line)) return true
    if (replaced) return false
    replaced = true
    return true
  })
  .map((line) => (/^\s*DATABASE_URL\s*=/.test(line) ? databaseLine : line))
if (!replaced) nextLines.unshift(databaseLine)

writeFileSync(
  environmentPath,
  `${nextLines.join('\n').replace(/\n+$/, '')}\n`,
  {
    encoding: 'utf8',
    mode: 0o600,
  },
)

console.log('DATABASE_URL synchronized from the RuoYi master datasource')
