-- Poker Trainer initial MySQL schema
-- Generated from packages/database/prisma/schema.prisma
-- Requires MySQL 8.0+; intended for a fresh database.

CREATE DATABASE IF NOT EXISTS `poker_trainer`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `poker_trainer`;
SET NAMES utf8mb4;
Loaded Prisma config from prisma.config.ts.

-- CreateTable
CREATE TABLE `players` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `display_name` VARCHAR(80) NOT NULL,
    `kind` ENUM('HERO', 'OPPONENT') NOT NULL DEFAULT 'OPPONENT',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `active_profile_version_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `players_code_key`(`code`),
    INDEX `players_enabled_kind_idx`(`enabled`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profile_versions` (
    `id` VARCHAR(30) NOT NULL,
    `player_id` VARCHAR(30) NOT NULL,
    `version` INTEGER NOT NULL,
    `label` VARCHAR(120) NULL,
    `profile` JSON NOT NULL,
    `source` VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `profile_versions_player_id_created_at_idx`(`player_id`, `created_at`),
    UNIQUE INDEX `profile_versions_player_id_version_key`(`player_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_sessions` (
    `id` VARCHAR(30) NOT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'ABANDONED') NOT NULL DEFAULT 'ACTIVE',
    `table_size` TINYINT UNSIGNED NOT NULL,
    `small_blind` INTEGER UNSIGNED NOT NULL,
    `big_blind` INTEGER UNSIGNED NOT NULL,
    `starting_stack` INTEGER UNSIGNED NOT NULL,
    `config` JSON NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `training_sessions_status_started_at_idx`(`status`, `started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_participants` (
    `id` VARCHAR(30) NOT NULL,
    `session_id` VARCHAR(30) NOT NULL,
    `player_id` VARCHAR(30) NOT NULL,
    `seat_no` TINYINT UNSIGNED NOT NULL,
    `stack` INTEGER UNSIGNED NOT NULL,
    `state` JSON NULL,

    INDEX `session_participants_player_id_idx`(`player_id`),
    UNIQUE INDEX `session_participants_session_id_seat_no_key`(`session_id`, `seat_no`),
    UNIQUE INDEX `session_participants_session_id_player_id_key`(`session_id`, `player_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hands` (
    `id` VARCHAR(30) NOT NULL,
    `session_id` VARCHAR(30) NOT NULL,
    `hand_no` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('ACTIVE', 'FROZEN', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `seed_hash` VARCHAR(128) NOT NULL,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `button_seat` TINYINT UNSIGNED NOT NULL,
    `state` JSON NOT NULL,
    `result` JSON NULL,
    `state_hash` VARCHAR(128) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `hands_session_id_started_at_idx`(`session_id`, `started_at`),
    INDEX `hands_status_started_at_idx`(`status`, `started_at`),
    UNIQUE INDEX `hands_session_id_hand_no_key`(`session_id`, `hand_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hand_participants` (
    `id` VARCHAR(30) NOT NULL,
    `hand_id` VARCHAR(30) NOT NULL,
    `player_id` VARCHAR(30) NOT NULL,
    `profile_version_id` VARCHAR(30) NOT NULL,
    `seat_no` TINYINT UNSIGNED NOT NULL,
    `starting_stack` INTEGER UNSIGNED NOT NULL,
    `ending_stack` INTEGER UNSIGNED NULL,
    `hole_cards` JSON NULL,

    INDEX `hand_participants_player_id_hand_id_idx`(`player_id`, `hand_id`),
    INDEX `hand_participants_profile_version_id_idx`(`profile_version_id`),
    UNIQUE INDEX `hand_participants_hand_id_seat_no_key`(`hand_id`, `seat_no`),
    UNIQUE INDEX `hand_participants_hand_id_player_id_key`(`hand_id`, `player_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hand_events` (
    `id` VARCHAR(30) NOT NULL,
    `hand_id` VARCHAR(30) NOT NULL,
    `sequence_no` INTEGER UNSIGNED NOT NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `actor_id` VARCHAR(30) NULL,
    `command_id` VARCHAR(64) NULL,
    `payload` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hand_events_actor_id_created_at_idx`(`actor_id`, `created_at`),
    UNIQUE INDEX `hand_events_hand_id_sequence_no_key`(`hand_id`, `sequence_no`),
    UNIQUE INDEX `hand_events_hand_id_command_id_key`(`hand_id`, `command_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hero_decisions` (
    `id` VARCHAR(30) NOT NULL,
    `hand_id` VARCHAR(30) NOT NULL,
    `hero_id` VARCHAR(30) NOT NULL,
    `event_sequence` INTEGER UNSIGNED NOT NULL,
    `actor_view` JSON NOT NULL,
    `thought_input` JSON NULL,
    `legal_actions` JSON NOT NULL,
    `chosen_action` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hero_decisions_hero_id_created_at_idx`(`hero_id`, `created_at`),
    UNIQUE INDEX `hero_decisions_hand_id_event_sequence_key`(`hand_id`, `event_sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_decisions` (
    `id` VARCHAR(30) NOT NULL,
    `hand_id` VARCHAR(30) NOT NULL,
    `player_id` VARCHAR(30) NOT NULL,
    `profile_version_id` VARCHAR(30) NOT NULL,
    `event_sequence` INTEGER UNSIGNED NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `model` VARCHAR(80) NOT NULL,
    `source` ENUM('PRIOR', 'LLM', 'FALLBACK') NOT NULL,
    `prompt_version` VARCHAR(40) NOT NULL,
    `actor_view` JSON NOT NULL,
    `output` JSON NOT NULL,
    `validation` JSON NULL,
    `latency_ms` INTEGER UNSIGNED NULL,
    `input_tokens` INTEGER UNSIGNED NULL,
    `output_tokens` INTEGER UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_decisions_player_id_created_at_idx`(`player_id`, `created_at`),
    INDEX `ai_decisions_provider_model_created_at_idx`(`provider`, `model`, `created_at`),
    UNIQUE INDEX `ai_decisions_hand_id_event_sequence_player_id_key`(`hand_id`, `event_sequence`, `player_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hand_reviews` (
    `id` VARCHAR(30) NOT NULL,
    `hand_id` VARCHAR(30) NOT NULL,
    `version` INTEGER NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `model` VARCHAR(80) NOT NULL,
    `prompt_version` VARCHAR(40) NOT NULL,
    `review` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hand_reviews_hand_id_created_at_idx`(`hand_id`, `created_at`),
    UNIQUE INDEX `hand_reviews_hand_id_version_key`(`hand_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leak_occurrences` (
    `id` VARCHAR(30) NOT NULL,
    `hand_id` VARCHAR(30) NOT NULL,
    `hero_decision_id` VARCHAR(30) NULL,
    `leak_code` VARCHAR(80) NOT NULL,
    `street` VARCHAR(20) NOT NULL,
    `severity` TINYINT UNSIGNED NOT NULL,
    `evidence` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `leak_occurrences_leak_code_created_at_idx`(`leak_code`, `created_at`),
    INDEX `leak_occurrences_hand_id_created_at_idx`(`hand_id`, `created_at`),
    INDEX `leak_occurrences_hero_decision_id_idx`(`hero_decision_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opponent_reads` (
    `id` VARCHAR(30) NOT NULL,
    `observer_id` VARCHAR(30) NOT NULL,
    `subject_id` VARCHAR(30) NOT NULL,
    `session_id` VARCHAR(30) NULL,
    `scope_key` VARCHAR(40) NOT NULL DEFAULT 'GLOBAL',
    `metrics` JSON NOT NULL,
    `confidence` DOUBLE NOT NULL DEFAULT 0,
    `sample_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `opponent_reads_subject_id_scope_key_idx`(`subject_id`, `scope_key`),
    INDEX `opponent_reads_session_id_idx`(`session_id`),
    UNIQUE INDEX `opponent_reads_observer_id_subject_id_scope_key_key`(`observer_id`, `subject_id`, `scope_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profile_feedback` (
    `id` VARCHAR(30) NOT NULL,
    `player_id` VARCHAR(30) NOT NULL,
    `hand_id` VARCHAR(30) NULL,
    `source_hand_ref` VARCHAR(80) NULL,
    `sentiment` ENUM('LIKE_PLAYER', 'UNLIKE_PLAYER', 'CORRECTION') NOT NULL,
    `trait` VARCHAR(80) NULL,
    `observation` TEXT NOT NULL,
    `observed_action` JSON NULL,
    `proposed_patch` JSON NULL,
    `confidence` DOUBLE NOT NULL DEFAULT 0.5,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `applied_profile_version_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    INDEX `profile_feedback_player_id_status_created_at_idx`(`player_id`, `status`, `created_at`),
    INDEX `profile_feedback_hand_id_idx`(`hand_id`),
    INDEX `profile_feedback_applied_profile_version_id_idx`(`applied_profile_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `players` ADD CONSTRAINT `players_active_profile_version_id_fkey` FOREIGN KEY (`active_profile_version_id`) REFERENCES `profile_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_versions` ADD CONSTRAINT `profile_versions_player_id_fkey` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `training_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_player_id_fkey` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hands` ADD CONSTRAINT `hands_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `training_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hand_participants` ADD CONSTRAINT `hand_participants_hand_id_fkey` FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hand_participants` ADD CONSTRAINT `hand_participants_player_id_fkey` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hand_participants` ADD CONSTRAINT `hand_participants_profile_version_id_fkey` FOREIGN KEY (`profile_version_id`) REFERENCES `profile_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hand_events` ADD CONSTRAINT `hand_events_hand_id_fkey` FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hand_events` ADD CONSTRAINT `hand_events_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `players`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hero_decisions` ADD CONSTRAINT `hero_decisions_hand_id_fkey` FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hero_decisions` ADD CONSTRAINT `hero_decisions_hero_id_fkey` FOREIGN KEY (`hero_id`) REFERENCES `players`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_decisions` ADD CONSTRAINT `ai_decisions_hand_id_fkey` FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_decisions` ADD CONSTRAINT `ai_decisions_player_id_fkey` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_decisions` ADD CONSTRAINT `ai_decisions_profile_version_id_fkey` FOREIGN KEY (`profile_version_id`) REFERENCES `profile_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hand_reviews` ADD CONSTRAINT `hand_reviews_hand_id_fkey` FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leak_occurrences` ADD CONSTRAINT `leak_occurrences_hand_id_fkey` FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leak_occurrences` ADD CONSTRAINT `leak_occurrences_hero_decision_id_fkey` FOREIGN KEY (`hero_decision_id`) REFERENCES `hero_decisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opponent_reads` ADD CONSTRAINT `opponent_reads_observer_id_fkey` FOREIGN KEY (`observer_id`) REFERENCES `players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opponent_reads` ADD CONSTRAINT `opponent_reads_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opponent_reads` ADD CONSTRAINT `opponent_reads_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `training_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_feedback` ADD CONSTRAINT `profile_feedback_player_id_fkey` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_feedback` ADD CONSTRAINT `profile_feedback_hand_id_fkey` FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_feedback` ADD CONSTRAINT `profile_feedback_applied_profile_version_id_fkey` FOREIGN KEY (`applied_profile_version_id`) REFERENCES `profile_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

