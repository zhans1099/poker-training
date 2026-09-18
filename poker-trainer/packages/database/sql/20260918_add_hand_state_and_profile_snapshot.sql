-- Add the persisted engine state and per-hand profile snapshot reference that
-- were missing from the first exported RuoYi database snapshot.
--
-- Preconditions for this migration:
--   * hands and hand_participants are empty, or callers have backfilled values.
--   * MySQL 8.0+.

ALTER TABLE `hands`
  ADD COLUMN `state` JSON NOT NULL AFTER `button_seat`;

ALTER TABLE `hand_participants`
  ADD COLUMN `profile_version_id` VARCHAR(30) NOT NULL AFTER `player_id`,
  ADD INDEX `hand_participants_profile_version_id_idx` (`profile_version_id`),
  ADD CONSTRAINT `hand_participants_profile_version_id_fkey`
    FOREIGN KEY (`profile_version_id`) REFERENCES `profile_versions` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
