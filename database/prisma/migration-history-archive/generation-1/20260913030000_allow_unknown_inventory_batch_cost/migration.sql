-- Physical inventory must remain recordable when procurement cost has not yet been verified.
ALTER TABLE `inventory_batches`
  MODIFY `unit_cost` DECIMAL(10, 2) NULL;
