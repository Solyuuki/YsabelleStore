import { z } from "zod";

const trimmedString = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : "";
    }

    return value;
  }, z.string().min(1, "Category name is required.").max(maxLength));

const optionalTrimmedString = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : undefined;
    }

    return value;
  }, z.string().max(maxLength).optional());

export const createCategorySchema = z.object({
  name: trimmedString(120),
  slug: optionalTrimmedString(140),
  description: optionalTrimmedString(255)
});

export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;
