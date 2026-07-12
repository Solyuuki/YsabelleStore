-- Make trusted-device access revocation-based instead of expiration-based.
ALTER TABLE `trusted_devices` MODIFY `expires_at` DATETIME(3) NULL;
