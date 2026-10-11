CREATE TABLE `system_canonical_state` (
  `id` INTEGER UNSIGNED NOT NULL,
  `migration_epoch` INTEGER UNSIGNED NOT NULL,
  `schema_version` INTEGER UNSIGNED NOT NULL,
  `catalog_version` INTEGER UNSIGNED NOT NULL,
  `asset_version` INTEGER UNSIGNED NOT NULL,
  `release_id` VARCHAR(80) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `system_canonical_state`
  (`id`, `migration_epoch`, `schema_version`, `catalog_version`, `asset_version`, `release_id`)
VALUES
  (1, 2, 2, 1, 1, 'g2-s2-c1-a1');
