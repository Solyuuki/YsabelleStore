-- Preserve historical NULL tax amounts and require catalog VAT classification.
ALTER TABLE `products`
  ADD COLUMN `vat_category` ENUM('UNCLASSIFIED', 'VATABLE', 'VAT_EXEMPT', 'ZERO_RATED') NOT NULL DEFAULT 'UNCLASSIFIED';

ALTER TABLE `sales`
  ADD COLUMN `vatable_sales_amount` DECIMAL(12,2) NULL,
  ADD COLUMN `vat_amount` DECIMAL(12,2) NULL,
  ADD COLUMN `vat_exempt_sales_amount` DECIMAL(12,2) NULL,
  ADD COLUMN `zero_rated_sales_amount` DECIMAL(12,2) NULL;

ALTER TABLE `sale_items`
  ADD COLUMN `vat_category_at_sale` ENUM('UNCLASSIFIED', 'VATABLE', 'VAT_EXEMPT', 'ZERO_RATED') NULL;
