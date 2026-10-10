-- Additive POS checkout request identity. Do not apply to the live store
-- until the operational schema preflight and backup have been reviewed.
ALTER TABLE `sales`
  ADD COLUMN `checkout_request_key` VARCHAR(191) NULL,
  ADD COLUMN `checkout_cash_received` DECIMAL(12, 2) NULL,
  ADD COLUMN `checkout_change` DECIMAL(12, 2) NULL,
  ADD UNIQUE INDEX `uq_sales_checkout_request_key` (`checkout_request_key`);
