-- Customer moderation scalability indexes.
-- Supports server-side pagination, status filtering, and indexed prefix search
-- without loading large customer/review populations into the frontend.

CREATE INDEX `idx_customer_accounts_created_id`
  ON `customer_accounts`(`created_at`, `id`);

CREATE INDEX `idx_customer_accounts_status_created_id`
  ON `customer_accounts`(`status`, `created_at`, `id`);

CREATE INDEX `idx_customer_accounts_name_id`
  ON `customer_accounts`(`name`, `id`);

CREATE INDEX `idx_customer_accounts_phone_id`
  ON `customer_accounts`(`phone`, `id`);

CREATE INDEX `idx_product_reviews_created_id`
  ON `product_reviews`(`created_at`, `id`);

CREATE INDEX `idx_product_reviews_status_created_id`
  ON `product_reviews`(`status`, `created_at`, `id`);

CREATE INDEX `idx_product_reviews_reviewer_id`
  ON `product_reviews`(`reviewer_display_name`, `id`);
