-- Sprint 2 trusted device session migration for YsabelleStore.
-- Adds backend-approved trusted-device auto-login tokens.
-- Raw trusted device tokens must stay client-side only; this table stores token hashes.

-- CreateTable
CREATE TABLE `trusted_devices` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `device_label` VARCHAR(120) NULL,
    `user_agent` VARCHAR(255) NULL,
    `last_used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `uq_trusted_devices_token_hash`(`token_hash`),
    INDEX `idx_trusted_devices_user_id`(`user_id`),
    INDEX `idx_trusted_devices_expires_at`(`expires_at`),
    INDEX `idx_trusted_devices_revoked_at`(`revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trusted_devices` ADD CONSTRAINT `trusted_devices_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
