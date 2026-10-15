# Sprint 12: Owner-approved catalog images and canonical Git releases

## Ownership and safety

Owner-approved product images are operational runtime data. Approval updates the
`products.active_image_asset_id` and `products.image_url` fields transactionally,
and image bytes live in the configured persistent image root. A Git commit does
**not** automatically contain a newly uploaded image.

During `state:pull:sync`, verified Owner-uploaded UUID image candidates take
priority over an older Git-pinned canonical asset. The sync validates that the
image belongs to the product, is APPROVED/READY, has the correct public URL, and
that all four storage files exist. Missing/corrupted references abort convergence
rather than silently restoring an old image.

Owner product edits that pass through the catalog PATCH service are now recorded
as `MANUAL_PRODUCT_UPDATE` audit events. Canonical upserts preserve these product
rows instead of overwriting Owner-entered catalog metadata. Existing canonical
rows without Owner changes still converge to the reviewed release baseline.

The customer product detail API is no-store; the PDP revalidates when a tab
becomes visible again. Public image URLs use the active asset ID so each
successful replacement gets a distinct, safely cacheable URL.

## Important boundaries

- `git pull` and `prisma migrate deploy` are not image publication commands.
- Runtime images are **not** backed up by SQL dumps; back up the image storage
  root alongside the database, and restore the pair together.
- Do not use `state:pull:sync --force` on an operating store. The canonical
  recovery path is intended for explicitly approved, isolated environments.
- Do not give Git credentials to the running storefront. Release publication
  requires an operator-reviewed bundle with source, generated assets, release
  and distribution manifests, checksums, and the required asset version bump.
- Production hosting needs durable mounted media storage (or an approved
  equivalent), not the ephemeral frontend build directory.

## Happy Cotton read-only QA

SKU: `SARIMA-P048`; product ID: `cmtk4scoh004xib1gioe0pcxe`.
Git canonical image ID: `sarima-p048-2933697c7efd`. A newly approved runtime
image normally receives a UUID image ID.

Verify the live `products.active_image_asset_id` and the
`/api/storefront/products/<productId>` response. The returned
`detailImageUrl` must match the current asset ID with `/pdp` suffix.
Verify HTTP 200 and correct bytes for the public PDP image. Then test restart,
normal pull/migration and canonical sync on a **cloned QA DB**, not production.

## Manual release promotion

Canonical product media publication is a separate, signed-off release operation,
subject to the existing pinned 50-product and four-variant distribution rules.
Never treat an Owner upload/approval as implicit Git publication. The deployed
runtime continues serving Owner-approved uploads even if no new canonical
asset bundle has been published yet.
