ALTER TABLE `customer_accounts`
  ADD COLUMN `username` VARCHAR(30) NULL,
  ADD COLUMN `phone_normalized` VARCHAR(16) NULL;

CREATE UNIQUE INDEX `uq_customer_accounts_username`
  ON `customer_accounts`(`username`);

CREATE UNIQUE INDEX `uq_customer_accounts_phone_normalized`
  ON `customer_accounts`(`phone_normalized`);
