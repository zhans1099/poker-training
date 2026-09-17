import { OpponentReadRepository, PlayerRepository } from '../src/index'
import { seedOpponentReads, seedPlayers } from './seed-data'

const repository = new PlayerRepository()
const existing = await repository.list(true)
const existingCodes = new Set(existing.map((player) => player.code))

for (const player of seedPlayers) {
  if (existingCodes.has(player.code)) continue
  await repository.create({
    ...player,
    profileLabel: 'V1 用户校准基线',
  })
}

const availablePlayers = await repository.list(true)
const playerIdByCode = new Map(
  availablePlayers.map((player) => [player.code, player.id]),
)
const readRepository = new OpponentReadRepository()
const existingReads = await readRepository.list({ scopeKey: 'GLOBAL' })
const existingReadKeys = new Set(
  existingReads.map((read) => `${read.observer.code}:${read.subject.code}`),
)

for (const read of seedOpponentReads) {
  const key = `${read.observerCode}:${read.subjectCode}`
  if (existingReadKeys.has(key)) continue

  const observerId = playerIdByCode.get(read.observerCode)
  const subjectId = playerIdByCode.get(read.subjectCode)
  if (observerId === undefined || subjectId === undefined) {
    throw new Error(`Cannot seed opponent read for ${key}: player missing`)
  }

  await readRepository.upsert({
    observerId,
    subjectId,
    scopeKey: 'GLOBAL',
    metrics: read.metrics,
    confidence: read.confidence,
    sampleCount: 0,
  })
}

console.log(
  `Seed complete: ${seedPlayers.length} players and ${seedOpponentReads.length} baseline reads available`,
)
