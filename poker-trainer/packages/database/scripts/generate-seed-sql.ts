import { seedOpponentReads, seedPlayers } from './seed-data'

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`
const sqlJson = (value: Record<string, unknown>) =>
  `CAST(${sqlString(JSON.stringify(value))} AS JSON)`
const safeIdPart = (value: string) => value.replaceAll(/[^a-zA-Z0-9]/g, '_')

const lines = [
  '-- Poker Trainer initial players, profile V1 records, and relationship reads',
  '-- Generated from packages/database/scripts/seed-data.ts',
  '-- Import poker_trainer_schema.sql before this file.',
  '',
  'USE `poker_trainer`;',
  'SET NAMES utf8mb4;',
  'START TRANSACTION;',
  '',
]

for (const player of seedPlayers) {
  const playerId = `seed_player_${safeIdPart(player.code)}`
  lines.push(
    `INSERT INTO \`players\` (\`id\`, \`code\`, \`display_name\`, \`kind\`, \`enabled\`, \`created_at\`, \`updated_at\`)`,
    `VALUES (${sqlString(playerId)}, ${sqlString(player.code)}, ${sqlString(player.displayName)}, ${sqlString(player.kind)}, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
    'ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);',
    '',
  )
}

for (const player of seedPlayers) {
  const profileId = `seed_profile_${safeIdPart(player.code)}_v1`
  lines.push(
    `SET @player_id = (SELECT \`id\` FROM \`players\` WHERE \`code\` = ${sqlString(player.code)} LIMIT 1);`,
    `INSERT INTO \`profile_versions\` (\`id\`, \`player_id\`, \`version\`, \`label\`, \`profile\`, \`source\`, \`created_at\`)`,
    `VALUES (${sqlString(profileId)}, @player_id, 1, 'V1 用户校准基线', ${sqlJson(player.profile)}, 'SEED', CURRENT_TIMESTAMP(3))`,
    'ON DUPLICATE KEY UPDATE `id` = `id`;',
    'UPDATE `players`',
    'SET `active_profile_version_id` = (',
    '  SELECT `id` FROM `profile_versions`',
    '  WHERE `player_id` = @player_id AND `version` = 1 LIMIT 1',
    ')',
    'WHERE `id` = @player_id AND `active_profile_version_id` IS NULL;',
    '',
  )
}

for (const read of seedOpponentReads) {
  const readId = `seed_read_${safeIdPart(read.observerCode)}_${safeIdPart(read.subjectCode)}`
  lines.push(
    `SET @observer_id = (SELECT \`id\` FROM \`players\` WHERE \`code\` = ${sqlString(read.observerCode)} LIMIT 1);`,
    `SET @subject_id = (SELECT \`id\` FROM \`players\` WHERE \`code\` = ${sqlString(read.subjectCode)} LIMIT 1);`,
    `INSERT INTO \`opponent_reads\` (\`id\`, \`observer_id\`, \`subject_id\`, \`scope_key\`, \`metrics\`, \`confidence\`, \`sample_count\`, \`created_at\`, \`updated_at\`)`,
    `VALUES (${sqlString(readId)}, @observer_id, @subject_id, 'GLOBAL', ${sqlJson(read.metrics)}, ${read.confidence}, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
    'ON DUPLICATE KEY UPDATE `id` = `id`;',
    '',
  )
}

lines.push('COMMIT;', '')
process.stdout.write(lines.join('\n'))
