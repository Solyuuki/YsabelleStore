CREATE TABLE `product_reviews` (
  `id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `reviewer_display_name` VARCHAR(120) NOT NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `comment` VARCHAR(1000) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  CONSTRAINT `chk_product_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5),
  INDEX `idx_product_reviews_product_created`(`product_id`, `created_at`),
  INDEX `idx_product_reviews_product_rating_created`(`product_id`, `rating`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `product_reviews_product_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
