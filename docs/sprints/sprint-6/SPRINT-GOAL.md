# Sprint 6 Goal

## Goal

Build the foundation for a server-side Catalog Image Quality Engine that lets a retailer or owner upload real product photos and receive safe, consistent, storefront-ready image variants without manual image editing.

## Required Outcomes

- Accept actual product-image uploads through the backend rather than requiring only a pre-existing URL/path.
- Validate image type, size, dimensions, decodeability, orientation, and basic quality.
- Detect common quality risks including blur, excessive empty canvas, extreme product scale, likely clipping, and insufficient resolution.
- Normalize accepted images to consistent product-media framing while preserving aspect ratio and the complete visible product.
- Apply conservative enhancement only: orientation correction, resize, padding, compression, mild denoise/sharpen, and bounded brightness/contrast correction.
- Generate fit-for-purpose variants for product cards and product-detail views.
- Show a Before/After preview before a newly processed image becomes the approved storefront image.
- Use image-specific quality status with `APPROVED`, `NEEDS_REVIEW`, and `REJECTED` semantics.
- Allow the product record to be saved when an image fails, while preventing that failed candidate from becoming the storefront image.
- Preserve a previously approved product image until a replacement is accepted.
- Support local/LAN deployments without requiring a paid per-image API.
- Keep an adapter boundary for optional local subject detection/background cleanup without making model inference mandatory for the baseline pipeline.

## Safety Invariant

The image engine may enhance pixels that exist, but it must never synthesize or reconstruct missing product facts such as labels, brand text, flavor, weight/volume, barcode, ingredients, packaging claims, or cropped-away portions of the product.

## Non-Goals

- Training a custom foundation model.
- Generative reconstruction of missing product packaging.
- Automatically publishing arbitrary images found on the public web.
- Replacing current inventory, POS, forecasting, supplier, or checkout business rules.
- Migrating existing GSAP/UI behavior unrelated to product-image upload.

## Success Experience

For a normal usable photo, the retailer flow should be close to:

`Upload -> Processing -> Before/After Preview -> Use Optimized Image`

Intervention is required only when the source cannot be made trustworthy or useful without guessing.
