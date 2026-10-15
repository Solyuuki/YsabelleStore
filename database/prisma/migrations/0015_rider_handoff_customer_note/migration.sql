-- Sprint 12: rider contact and a customer-facing note are distinct from staff-only notes.
ALTER TABLE `customer_orders`
  ADD COLUMN `rider_name` VARCHAR(120) NULL AFTER `courier_reference`,
  ADD COLUMN `rider_phone` VARCHAR(24) NULL AFTER `rider_name`,
  ADD COLUMN `customer_delivery_note` VARCHAR(500) NULL AFTER `rider_phone`;
