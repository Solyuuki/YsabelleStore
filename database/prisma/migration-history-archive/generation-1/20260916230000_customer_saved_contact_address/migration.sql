CREATE TABLE `customer_saved_addresses` (
  `customer_account_id` VARCHAR(191) NOT NULL,
  `address_line_1` VARCHAR(180) NOT NULL,
  `address_line_2` VARCHAR(180) NULL,
  `barangay` VARCHAR(120) NOT NULL,
  `city_municipality` VARCHAR(120) NOT NULL,
  `province_region` VARCHAR(120) NOT NULL,
  `postal_code` VARCHAR(20) NOT NULL,
  `country` VARCHAR(80) NOT NULL DEFAULT 'Philippines',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`customer_account_id`),
  CONSTRAINT `fk_customer_saved_addresses_account`
    FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_order_address_snapshots` (
  `order_id` VARCHAR(191) NOT NULL,
  `address_line_1` VARCHAR(180) NOT NULL,
  `address_line_2` VARCHAR(180) NULL,
  `barangay` VARCHAR(120) NOT NULL,
  `city_municipality` VARCHAR(120) NOT NULL,
  `province_region` VARCHAR(120) NOT NULL,
  `postal_code` VARCHAR(20) NOT NULL,
  `country` VARCHAR(80) NOT NULL DEFAULT 'Philippines',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`order_id`),
  CONSTRAINT `fk_customer_order_address_snapshot_order`
    FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
