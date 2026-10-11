-- Renumbered from M3's original 0006 to preserve Sprint 11 PayMongo/delivery/profile migrations.
-- CreateTable
CREATE TABLE `support_tickets` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_number` VARCHAR(80) NOT NULL,
    `customer_account_id` VARCHAR(191) NULL,
    `customer_order_id` VARCHAR(191) NULL,
    `customer_name` VARCHAR(120) NOT NULL,
    `customer_email` VARCHAR(191) NOT NULL,
    `customer_phone` VARCHAR(40) NULL,
    `category` ENUM('ORDER', 'PAYMENT', 'PRODUCT', 'PICKUP_DELIVERY', 'ACCOUNT', 'RETURN_REFUND', 'FEEDBACK', 'OTHER') NOT NULL,
    `subject` VARCHAR(160) NOT NULL,
    `status` ENUM('NEW', 'OPEN', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `gmail_thread_id` VARCHAR(191) NULL,
    `last_message_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_customer_message_at` DATETIME(3) NULL,
    `last_staff_message_at` DATETIME(3) NULL,
    `last_read_by_staff_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_support_tickets_ticket_number`(`ticket_number`),
    UNIQUE INDEX `uq_support_tickets_gmail_thread_id`(`gmail_thread_id`),
    INDEX `idx_support_tickets_status_last_message`(`status`, `last_message_at`),
    INDEX `idx_support_tickets_category_status_message`(`category`, `status`, `last_message_at`),
    INDEX `idx_support_tickets_customer_created`(`customer_account_id`, `created_at`),
    INDEX `idx_support_tickets_email_created`(`customer_email`, `created_at`),
    INDEX `idx_support_tickets_order`(`customer_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_messages` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_id` VARCHAR(191) NOT NULL,
    `sender_type` ENUM('CUSTOMER', 'STAFF', 'SYSTEM') NOT NULL,
    `channel` ENUM('WEB', 'EMAIL', 'SYSTEM') NOT NULL DEFAULT 'WEB',
    `sender_user_id` VARCHAR(191) NULL,
    `sender_name` VARCHAR(120) NULL,
    `sender_email` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `gmail_message_id` VARCHAR(191) NULL,
    `gmail_thread_id` VARCHAR(191) NULL,
    `delivery_status` ENUM('NOT_APPLICABLE', 'PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'NOT_APPLICABLE',
    `delivery_error` VARCHAR(500) NULL,
    `email_sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_support_messages_gmail_message_id`(`gmail_message_id`),
    INDEX `idx_support_messages_ticket_created`(`ticket_id`, `created_at`),
    INDEX `idx_support_messages_sender_created`(`sender_type`, `created_at`),
    INDEX `idx_support_messages_channel_created`(`channel`, `created_at`),
    INDEX `idx_support_messages_gmail_thread`(`gmail_thread_id`),
    INDEX `idx_support_messages_sender_user`(`sender_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_customer_account_id_fkey`
  FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_customer_order_id_fkey`
  FOREIGN KEY (`customer_order_id`) REFERENCES `customer_orders`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_ticket_id_fkey`
  FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_sender_user_id_fkey`
  FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `system_canonical_state`
SET `schema_version` = 10,
    `release_id` = 'g2-s10-c5-a2'
WHERE `id` = 1;
