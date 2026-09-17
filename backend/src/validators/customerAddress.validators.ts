import { z } from "zod";

export const customerAddressSchema = z
  .object({
    addressLine1: z.string().trim().min(3).max(180),
    addressLine2: z.string().trim().max(180).optional().default(""),
    barangay: z.string().trim().min(2).max(120),
    cityMunicipality: z.string().trim().min(2).max(120),
    provinceRegion: z.string().trim().min(2).max(120),
    postalCode: z.string().trim().min(3).max(20),
    country: z.literal("Philippines").default("Philippines")
  })
  .strict();

export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
