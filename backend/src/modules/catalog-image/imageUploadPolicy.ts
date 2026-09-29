import {
  CATEGORY_COVER_UPLOAD_LIMITS,
  PRODUCT_IMAGE_UPLOAD_LIMITS
} from "../../security/security.constants.js";
import { HttpError } from "../../utils/httpError.js";

export type CatalogImageUploadInspection = {
  detectedMimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: ".jpg" | ".png" | ".webp";
};

type ProductImageUploadInput = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

function startsWithBytes(buffer: Buffer, signature: readonly number[]) {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

function detectImageType(buffer: Buffer): CatalogImageUploadInspection | null {
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
    return { detectedMimeType: "image/jpeg", extension: ".jpg" };
  }

  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { detectedMimeType: "image/png", extension: ".png" };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { detectedMimeType: "image/webp", extension: ".webp" };
  }

  return null;
}

export function inspectProductImageUpload(
  input: ProductImageUploadInput
): CatalogImageUploadInspection {
  if (input.size > PRODUCT_IMAGE_UPLOAD_LIMITS.maxFileBytes) {
    throw new HttpError(413, "Product image exceeds the upload size limit.", {
      code: "PRODUCT_IMAGE_TOO_LARGE",
      details: { maxFileBytes: PRODUCT_IMAGE_UPLOAD_LIMITS.maxFileBytes }
    });
  }

  const detected = detectImageType(input.buffer);

  if (!detected) {
    throw new HttpError(415, "Product image type is not supported.", {
      code: "PRODUCT_IMAGE_UNSUPPORTED_TYPE",
      details: {
        allowedMimeTypes: [...PRODUCT_IMAGE_UPLOAD_LIMITS.allowedMimeTypes]
      }
    });
  }

  return detected;
}

export function inspectCategoryCoverUpload(
  input: ProductImageUploadInput
): CatalogImageUploadInspection {
  if (input.size > CATEGORY_COVER_UPLOAD_LIMITS.maxFileBytes) {
    throw new HttpError(413, "Category cover exceeds the upload size limit.", {
      code: "CATEGORY_COVER_TOO_LARGE",
      details: { maxFileBytes: CATEGORY_COVER_UPLOAD_LIMITS.maxFileBytes }
    });
  }

  const detected = detectImageType(input.buffer);

  if (!detected) {
    throw new HttpError(415, "Category cover type is not supported.", {
      code: "CATEGORY_COVER_UNSUPPORTED_TYPE",
      details: {
        allowedMimeTypes: [...CATEGORY_COVER_UPLOAD_LIMITS.allowedMimeTypes]
      }
    });
  }

  return detected;
}
