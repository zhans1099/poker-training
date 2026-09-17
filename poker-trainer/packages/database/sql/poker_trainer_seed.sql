-- Poker Trainer initial players, profile V1 records, and relationship reads
-- Generated from packages/database/scripts/seed-data.ts
-- Import poker_trainer_schema.sql before this file.

USE `poker_trainer`;
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO `players` (`id`, `code`, `display_name`, `kind`, `enabled`, `created_at`, `updated_at`)
VALUES ('seed_player_hero', 'hero', 'Hero', 'HERO', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `players` (`id`, `code`, `display_name`, `kind`, `enabled`, `created_at`, `updated_at`)
VALUES ('seed_player_jl', 'jl', 'JL', 'OPPONENT', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `players` (`id`, `code`, `display_name`, `kind`, `enabled`, `created_at`, `updated_at`)
VALUES ('seed_player_jj', 'jj', 'JJ', 'OPPONENT', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `players` (`id`, `code`, `display_name`, `kind`, `enabled`, `created_at`, `updated_at`)
VALUES ('seed_player_23', '23', '23', 'OPPONENT', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `players` (`id`, `code`, `display_name`, `kind`, `enabled`, `created_at`, `updated_at`)
VALUES ('seed_player_hg', 'hg', 'HG', 'OPPONENT', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `players` (`id`, `code`, `display_name`, `kind`, `enabled`, `created_at`, `updated_at`)
VALUES ('seed_player_pangzi', 'pangzi', '胖子', 'OPPONENT', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

SET @player_id = (SELECT `id` FROM `players` WHERE `code` = 'hero' LIMIT 1);
INSERT INTO `profile_versions` (`id`, `player_id`, `version`, `label`, `profile`, `source`, `created_at`)
VALUES ('seed_profile_hero_v1', @player_id, 1, 'V1 用户校准基线', CAST('{"schemaVersion":1,"aiControlled":false,"tags":["hero","decision-training-subject"],"notes":"Hero 只保存身份和训练泄漏，不使用 AI 行为画像。"}' AS JSON), 'SEED', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;
UPDATE `players`
SET `active_profile_version_id` = (
  SELECT `id` FROM `profile_versions`
  WHERE `player_id` = @player_id AND `version` = 1 LIMIT 1
)
WHERE `id` = @player_id AND `active_profile_version_id` IS NULL;

SET @player_id = (SELECT `id` FROM `players` WHERE `code` = 'jl' LIMIT 1);
INSERT INTO `profile_versions` (`id`, `player_id`, `version`, `label`, `profile`, `source`, `created_at`)
VALUES ('seed_profile_jl_v1', @player_id, 1, 'V1 用户校准基线', CAST('{"schemaVersion":1,"vpip":0.93,"pfr":0.6,"threeBetFrequency":0.14,"fourBetFrequency":0.05,"foldToThreeBet":0.18,"callThreeBetFrequency":0.7,"fourBetBluffFrequency":0.18,"foldToFourBet":0.28,"limpFrequency":0.3,"coldCallFrequency":0.62,"squeezeFrequency":0.18,"aggressionFactor":0.62,"flopCbetFrequency":0.72,"turnBarrelFrequency":0.62,"riverBarrelFrequency":0.48,"foldToBet":0.2,"foldToRaise":0.25,"drawChasing":0.86,"topPairStickiness":0.9,"middlePairStickiness":0.72,"heroCallFrequency":0.86,"bluffFrequency":0.38,"semiBluffFrequency":0.58,"largeBetBluffFrequency":0.16,"overbetFrequency":0.32,"allInBluffFrequency":0.1,"slowPlayFrequency":0.22,"trapFrequency":0.28,"flopCheckRaiseFrequency":0.12,"turnCheckRaiseFrequency":0.09,"riverCheckRaiseFrequency":0.07,"checkRaiseBluffFrequency":0.16,"foldToCheckRaise":0.5,"tiltSensitivity":0.85,"lossChasing":0.9,"riskTolerance":0.82,"tags":["extremely-loose","draw-chaser","pair-plus-draw-occasionally-aggressive","large-bet-value-heavy-when-calm","tilt-amplifies-aggression","rational-when-winning"],"notes":"入池率超过 90%；对子加听牌有时激进。水上相对理性；连续输钱或情绪上头后，大尺度下注、半诈唬和 shove 显著增加。深筹码本身不是攻击性触发器。正常状态突然大柱或 raise 以成牌为主。"}' AS JSON), 'SEED', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;
UPDATE `players`
SET `active_profile_version_id` = (
  SELECT `id` FROM `profile_versions`
  WHERE `player_id` = @player_id AND `version` = 1 LIMIT 1
)
WHERE `id` = @player_id AND `active_profile_version_id` IS NULL;

SET @player_id = (SELECT `id` FROM `players` WHERE `code` = 'jj' LIMIT 1);
INSERT INTO `profile_versions` (`id`, `player_id`, `version`, `label`, `profile`, `source`, `created_at`)
VALUES ('seed_profile_jj_v1', @player_id, 1, 'V1 用户校准基线', CAST('{"schemaVersion":1,"vpip":0.72,"pfr":0.16,"threeBetFrequency":0.05,"fourBetFrequency":0.02,"foldToThreeBet":0.24,"callThreeBetFrequency":0.66,"fourBetBluffFrequency":0.18,"foldToFourBet":0.34,"limpFrequency":0.4,"coldCallFrequency":0.54,"squeezeFrequency":0.05,"aggressionFactor":0.3,"flopCbetFrequency":0.42,"turnBarrelFrequency":0.3,"riverBarrelFrequency":0.22,"foldToBet":0.26,"foldToRaise":0.3,"drawChasing":0.68,"topPairStickiness":0.88,"middlePairStickiness":0.76,"heroCallFrequency":0.84,"bluffFrequency":0.18,"semiBluffFrequency":0.26,"largeBetBluffFrequency":0.08,"overbetFrequency":0.08,"allInBluffFrequency":0.04,"slowPlayFrequency":0.5,"trapFrequency":0.5,"flopCheckRaiseFrequency":0.12,"turnCheckRaiseFrequency":0.09,"riverCheckRaiseFrequency":0.07,"checkRaiseBluffFrequency":0.16,"foldToCheckRaise":0.5,"tiltSensitivity":0.52,"lossChasing":0.48,"riskTolerance":0.56,"tags":["loose-passive","sticky-medium-strength","strong-hand-half-attack-half-trap","low-active-bluffing"],"notes":"主动进攻较少，中等牌力粘性跟注。大牌约一半主动进攻、一半慢打蹲人；被动线路不能自动判弱。"}' AS JSON), 'SEED', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;
UPDATE `players`
SET `active_profile_version_id` = (
  SELECT `id` FROM `profile_versions`
  WHERE `player_id` = @player_id AND `version` = 1 LIMIT 1
)
WHERE `id` = @player_id AND `active_profile_version_id` IS NULL;

SET @player_id = (SELECT `id` FROM `players` WHERE `code` = '23' LIMIT 1);
INSERT INTO `profile_versions` (`id`, `player_id`, `version`, `label`, `profile`, `source`, `created_at`)
VALUES ('seed_profile_23_v1', @player_id, 1, 'V1 用户校准基线', CAST('{"schemaVersion":1,"vpip":0.46,"pfr":0.3,"threeBetFrequency":0.1,"fourBetFrequency":0.035,"foldToThreeBet":0.5,"callThreeBetFrequency":0.39,"fourBetBluffFrequency":0.18,"foldToFourBet":0.52,"limpFrequency":0.12,"coldCallFrequency":0.28,"squeezeFrequency":0.11,"aggressionFactor":0.52,"flopCbetFrequency":0.58,"turnBarrelFrequency":0.46,"riverBarrelFrequency":0.38,"foldToBet":0.46,"foldToRaise":0.52,"drawChasing":0.43,"topPairStickiness":0.58,"middlePairStickiness":0.38,"heroCallFrequency":0.48,"bluffFrequency":0.31,"semiBluffFrequency":0.38,"largeBetBluffFrequency":0.2,"overbetFrequency":0.13,"allInBluffFrequency":0.07,"slowPlayFrequency":0.2,"trapFrequency":0.2,"flopCheckRaiseFrequency":0.12,"turnCheckRaiseFrequency":0.09,"riverCheckRaiseFrequency":0.07,"checkRaiseBluffFrequency":0.16,"foldToCheckRaise":0.5,"tiltSensitivity":0.32,"lossChasing":0.28,"riskTolerance":0.48,"tags":["relatively-rational","range-aware","odds-aware","not-solver"],"notes":"相对理性，会综合位置、赔率、有效筹码、牌面和双方范围；当前唯一不对 Hero 保持天然不信任的玩家。"}' AS JSON), 'SEED', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;
UPDATE `players`
SET `active_profile_version_id` = (
  SELECT `id` FROM `profile_versions`
  WHERE `player_id` = @player_id AND `version` = 1 LIMIT 1
)
WHERE `id` = @player_id AND `active_profile_version_id` IS NULL;

SET @player_id = (SELECT `id` FROM `players` WHERE `code` = 'hg' LIMIT 1);
INSERT INTO `profile_versions` (`id`, `player_id`, `version`, `label`, `profile`, `source`, `created_at`)
VALUES ('seed_profile_hg_v1', @player_id, 1, 'V1 用户校准基线', CAST('{"schemaVersion":1,"vpip":0.38,"pfr":0.22,"threeBetFrequency":0.07,"fourBetFrequency":0.03,"foldToThreeBet":0.48,"callThreeBetFrequency":0.42,"fourBetBluffFrequency":0.18,"foldToFourBet":0.52,"limpFrequency":0.12,"coldCallFrequency":0.25,"squeezeFrequency":0.08,"aggressionFactor":0.43,"flopCbetFrequency":0.52,"turnBarrelFrequency":0.38,"riverBarrelFrequency":0.28,"foldToBet":0.44,"foldToRaise":0.5,"drawChasing":0.44,"topPairStickiness":0.72,"middlePairStickiness":0.46,"heroCallFrequency":0.72,"bluffFrequency":0.22,"semiBluffFrequency":0.3,"largeBetBluffFrequency":0.13,"overbetFrequency":0.12,"allInBluffFrequency":0.06,"slowPlayFrequency":0.2,"trapFrequency":0.2,"flopCheckRaiseFrequency":0.12,"turnCheckRaiseFrequency":0.09,"riverCheckRaiseFrequency":0.07,"checkRaiseBluffFrequency":0.16,"foldToCheckRaise":0.5,"tiltSensitivity":0.45,"lossChasing":0.38,"riskTolerance":0.42,"tags":["medium-tight","basic-hand-reading","limited-sample"],"notes":"中等偏稳，有基本判断能力，不过度诈唬也不过度粘；面对 Hero 大柱时，顶对通常会继续。"}' AS JSON), 'SEED', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;
UPDATE `players`
SET `active_profile_version_id` = (
  SELECT `id` FROM `profile_versions`
  WHERE `player_id` = @player_id AND `version` = 1 LIMIT 1
)
WHERE `id` = @player_id AND `active_profile_version_id` IS NULL;

SET @player_id = (SELECT `id` FROM `players` WHERE `code` = 'pangzi' LIMIT 1);
INSERT INTO `profile_versions` (`id`, `player_id`, `version`, `label`, `profile`, `source`, `created_at`)
VALUES ('seed_profile_pangzi_v1', @player_id, 1, 'V1 用户校准基线', CAST('{"schemaVersion":1,"vpip":0.3,"pfr":0.21,"threeBetFrequency":0.08,"fourBetFrequency":0.03,"foldToThreeBet":0.48,"callThreeBetFrequency":0.42,"fourBetBluffFrequency":0.18,"foldToFourBet":0.52,"limpFrequency":0.12,"coldCallFrequency":0.25,"squeezeFrequency":0.08,"aggressionFactor":0.46,"flopCbetFrequency":0.56,"turnBarrelFrequency":0.42,"riverBarrelFrequency":0.34,"foldToBet":0.48,"foldToRaise":0.54,"drawChasing":0.38,"topPairStickiness":0.7,"middlePairStickiness":0.4,"heroCallFrequency":0.7,"bluffFrequency":0.25,"semiBluffFrequency":0.32,"largeBetBluffFrequency":0.15,"overbetFrequency":0.12,"allInBluffFrequency":0.06,"slowPlayFrequency":0.2,"trapFrequency":0.2,"flopCheckRaiseFrequency":0.12,"turnCheckRaiseFrequency":0.09,"riverCheckRaiseFrequency":0.07,"checkRaiseBluffFrequency":0.16,"foldToCheckRaise":0.5,"tiltSensitivity":0.3,"lossChasing":0.26,"riskTolerance":0.4,"tags":["relatively-rational","odds-aware","risk-averse"],"notes":"相对理性、会算赔率，整体比 23 稍稳；对 Hero 是例外，面对 Hero 大柱时顶对通常会跟。"}' AS JSON), 'SEED', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;
UPDATE `players`
SET `active_profile_version_id` = (
  SELECT `id` FROM `profile_versions`
  WHERE `player_id` = @player_id AND `version` = 1 LIMIT 1
)
WHERE `id` = @player_id AND `active_profile_version_id` IS NULL;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'jl' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'hero' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_jl_hero', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.72,"perceivedBluffFrequency":0.7,"largeBetBluffReputation":0.78,"heroCallReputation":0.58,"aggressionReputation":0.72,"topPairContinueVsLargeBet":0.82,"notes":"天然不信任 Hero；Hero 下大柱时，持有顶对通常会继续。"}' AS JSON), 0.8, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'jj' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'hero' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_jj_hero', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.72,"perceivedBluffFrequency":0.7,"largeBetBluffReputation":0.78,"heroCallReputation":0.58,"aggressionReputation":0.72,"topPairContinueVsLargeBet":0.82,"notes":"天然不信任 Hero；Hero 下大柱时，持有顶对通常会继续。"}' AS JSON), 0.8, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'hg' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'hero' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_hg_hero', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.72,"perceivedBluffFrequency":0.7,"largeBetBluffReputation":0.78,"heroCallReputation":0.58,"aggressionReputation":0.72,"topPairContinueVsLargeBet":0.82,"notes":"天然不信任 Hero；Hero 下大柱时，持有顶对通常会继续。"}' AS JSON), 0.8, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'pangzi' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'hero' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_pangzi_hero', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.72,"perceivedBluffFrequency":0.7,"largeBetBluffReputation":0.78,"heroCallReputation":0.58,"aggressionReputation":0.72,"topPairContinueVsLargeBet":0.82,"notes":"天然不信任 Hero；Hero 下大柱时，持有顶对通常会继续。"}' AS JSON), 0.8, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'hero' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jl' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_hero_jl', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.95,"perceivedBluffFrequency":0.62,"largeBetBluffReputation":0.2,"heroCallReputation":0.76,"aggressionReputation":0.72,"suddenLargeBetValueWeight":0.8,"notes":"普通线路不太信任 JL，但其突然大柱或 raise 大概率有成牌，偷鸡概率较低。"}' AS JSON), 0.75, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'jj' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jl' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_jj_jl', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.95,"perceivedBluffFrequency":0.62,"largeBetBluffReputation":0.2,"heroCallReputation":0.76,"aggressionReputation":0.72,"suddenLargeBetValueWeight":0.8,"notes":"普通线路不太信任 JL，但其突然大柱或 raise 大概率有成牌，偷鸡概率较低。"}' AS JSON), 0.75, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = '23' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jl' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_23_jl', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.95,"perceivedBluffFrequency":0.62,"largeBetBluffReputation":0.2,"heroCallReputation":0.76,"aggressionReputation":0.72,"suddenLargeBetValueWeight":0.8,"notes":"普通线路不太信任 JL，但其突然大柱或 raise 大概率有成牌，偷鸡概率较低。"}' AS JSON), 0.75, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'hg' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jl' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_hg_jl', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.95,"perceivedBluffFrequency":0.62,"largeBetBluffReputation":0.2,"heroCallReputation":0.76,"aggressionReputation":0.72,"suddenLargeBetValueWeight":0.8,"notes":"普通线路不太信任 JL，但其突然大柱或 raise 大概率有成牌，偷鸡概率较低。"}' AS JSON), 0.75, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'pangzi' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jl' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_pangzi_jl', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.95,"perceivedBluffFrequency":0.62,"largeBetBluffReputation":0.2,"heroCallReputation":0.76,"aggressionReputation":0.72,"suddenLargeBetValueWeight":0.8,"notes":"普通线路不太信任 JL，但其突然大柱或 raise 大概率有成牌，偷鸡概率较低。"}' AS JSON), 0.75, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'hero' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jj' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_hero_jj', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.74,"perceivedBluffFrequency":0.5,"largeBetBluffReputation":0.54,"heroCallReputation":0.8,"aggressionReputation":0.34,"notes":"不太信任 JJ，但要注意其大牌约一半主动进攻、一半慢打。"}' AS JSON), 0.68, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'jl' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jj' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_jl_jj', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.74,"perceivedBluffFrequency":0.5,"largeBetBluffReputation":0.54,"heroCallReputation":0.8,"aggressionReputation":0.34,"notes":"不太信任 JJ，但要注意其大牌约一半主动进攻、一半慢打。"}' AS JSON), 0.68, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = '23' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jj' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_23_jj', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.74,"perceivedBluffFrequency":0.5,"largeBetBluffReputation":0.54,"heroCallReputation":0.8,"aggressionReputation":0.34,"notes":"不太信任 JJ，但要注意其大牌约一半主动进攻、一半慢打。"}' AS JSON), 0.68, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'hg' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jj' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_hg_jj', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.74,"perceivedBluffFrequency":0.5,"largeBetBluffReputation":0.54,"heroCallReputation":0.8,"aggressionReputation":0.34,"notes":"不太信任 JJ，但要注意其大牌约一半主动进攻、一半慢打。"}' AS JSON), 0.68, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

SET @observer_id = (SELECT `id` FROM `players` WHERE `code` = 'pangzi' LIMIT 1);
SET @subject_id = (SELECT `id` FROM `players` WHERE `code` = 'jj' LIMIT 1);
INSERT INTO `opponent_reads` (`id`, `observer_id`, `subject_id`, `scope_key`, `metrics`, `confidence`, `sample_count`, `created_at`, `updated_at`)
VALUES ('seed_read_pangzi_jj', @observer_id, @subject_id, 'GLOBAL', CAST('{"perceivedLooseness":0.74,"perceivedBluffFrequency":0.5,"largeBetBluffReputation":0.54,"heroCallReputation":0.8,"aggressionReputation":0.34,"notes":"不太信任 JJ，但要注意其大牌约一半主动进攻、一半慢打。"}' AS JSON), 0.68, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

COMMIT;
