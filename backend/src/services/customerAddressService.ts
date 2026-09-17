import { prisma } from "../database/prismaClient.js";
import {
  customerAddressSchema,
  type CustomerAddressInput
} from "../validators/customerAddress.validators.js";

type CustomerAddressRow = {
  address_line_1: string;
  address_line_2: string | null;
  barangay: string;
  city_municipality: string;
  province_region: string;
  postal_code: string;
  country: string;
};

export type CustomerAddress = CustomerAddressInput;

function fromRow(row: CustomerAddressRow): CustomerAddress {
  return {
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2 ?? "",
    barangay: row.barangay,
    cityMunicipality: row.city_municipality,
    provinceRegion: row.province_region,
    postalCode: row.postal_code,
    country: row.country === "Philippines" ? "Philippines" : "Philippines"
  };
}

export async function getCustomerSavedAddress(customerAccountId: string) {
  const rows = await prisma.$queryRaw<CustomerAddressRow[]>`
    SELECT
      address_line_1,
      address_line_2,
      barangay,
      city_municipality,
      province_region,
      postal_code,
      country
    FROM customer_saved_addresses
    WHERE customer_account_id = ${customerAccountId}
    LIMIT 1
  `;

  return rows[0] ? fromRow(rows[0]) : null;
}

export async function saveCustomerAddress(
  customerAccountId: string,
  addressInput: CustomerAddressInput
): Promise<CustomerAddress> {
  const address = customerAddressSchema.parse(addressInput);
  const addressLine2 = address.addressLine2 || null;

  await prisma.$executeRaw`
    INSERT INTO customer_saved_addresses (
      customer_account_id,
      address_line_1,
      address_line_2,
      barangay,
      city_municipality,
      province_region,
      postal_code,
      country
    ) VALUES (
      ${customerAccountId},
      ${address.addressLine1},
      ${addressLine2},
      ${address.barangay},
      ${address.cityMunicipality},
      ${address.provinceRegion},
      ${address.postalCode},
      ${address.country}
    )
    ON DUPLICATE KEY UPDATE
      address_line_1 = VALUES(address_line_1),
      address_line_2 = VALUES(address_line_2),
      barangay = VALUES(barangay),
      city_municipality = VALUES(city_municipality),
      province_region = VALUES(province_region),
      postal_code = VALUES(postal_code),
      country = VALUES(country),
      updated_at = CURRENT_TIMESTAMP(3)
  `;

  return address;
}

export async function saveCustomerOrderAddressSnapshot(
  orderId: string,
  addressInput: CustomerAddressInput
): Promise<CustomerAddress> {
  const address = customerAddressSchema.parse(addressInput);
  const addressLine2 = address.addressLine2 || null;

  await prisma.$executeRaw`
    INSERT INTO customer_order_address_snapshots (
      order_id,
      address_line_1,
      address_line_2,
      barangay,
      city_municipality,
      province_region,
      postal_code,
      country
    ) VALUES (
      ${orderId},
      ${address.addressLine1},
      ${addressLine2},
      ${address.barangay},
      ${address.cityMunicipality},
      ${address.provinceRegion},
      ${address.postalCode},
      ${address.country}
    )
    ON DUPLICATE KEY UPDATE
      address_line_1 = VALUES(address_line_1),
      address_line_2 = VALUES(address_line_2),
      barangay = VALUES(barangay),
      city_municipality = VALUES(city_municipality),
      province_region = VALUES(province_region),
      postal_code = VALUES(postal_code),
      country = VALUES(country)
  `;

  return address;
}
