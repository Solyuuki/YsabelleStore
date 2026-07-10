# Product and Inventory Contract

## Overview

This document describes the implemented Sprint 3 M3 backend contract for products, inventory, movement history, POS stock lookup, stock deduction, and forecasting-friendly data access.

The backend uses:

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id`
- `PATCH /api/products/:id/status`
- `GET /api/inventory`
- `GET /api/inventory/product/:productId`
- `GET /api/inventory/lookup?barcode=...`
- `POST /api/inventory/:productId/stock-in`
- `POST /api/inventory/:productId/adjust`
- `POST /api/inventory/deduct`
- `GET /api/inventory/:productId/movements`

## Product Schema

Implemented product fields:

- `id`
- `name`
- `sku`
- `barcode`
- `categoryId`
- `description`
- `unit`
- `costPrice`
- `sellingPrice`
- `reorderLevel`
- `targetStockLevel`
- `status`
- `createdAt`
- `updatedAt`

Notes:

- `sku` is unique.
- `barcode` is unique when present.
- `status` uses `ACTIVE`, `INACTIVE`, and `DISCONTINUED`.
- Money values are serialized as strings to preserve precision.
- Whitespace is normalized before saving product names, SKUs, and barcodes.

## Inventory Schema

Implemented inventory fields:

- `id`
- `productId`
- `quantityOnHand`
- `lastStockUpdatedAt`
- `version`
- `createdAt`
- `updatedAt`

Inventory behavior:

- One inventory record exists per product.
- `quantityOnHand` is the current stock state.
- `version` increments with each stock mutation.
- `lastStockUpdatedAt` reflects the most recent successful stock change.

## Stock Movement Schema

Implemented movement fields:

- `id`
- `inventoryId`
- `productId`
- `batchId`
- `performedById`
- `type`
- `quantity`
- `quantityBefore`
- `quantityAfter`
- `reason`
- `referenceType`
- `referenceId`
- `createdAt`

Canonical movement types:

- `STOCK_IN`
- `SALE`
- `ADJUSTMENT_IN`
- `ADJUSTMENT_OUT`
- `RETURN_IN`
- `RETURN_OUT`
- `DAMAGE`
- `EXPIRED`
- `INITIAL_STOCK`

Legacy enum values remain in Prisma for compatibility, but the API only validates the canonical set above.

## API Endpoints

### Create Product

- Method: `POST`
- Path: `/api/products`
- Access: `OWNER`
- Request:

```json
{
  "name": "Milk",
  "sku": "BEV-MILK-001",
  "barcode": "4800000000000",
  "categoryId": "cat_beverages",
  "unit": "BOTTLE",
  "costPrice": "20.00",
  "sellingPrice": "25.00",
  "reorderLevel": 6,
  "targetStockLevel": 24,
  "description": "Optional description"
}
```

- Response purpose: create the product and its zeroed inventory row.

### List Products

- Method: `GET`
- Path: `/api/products`
- Access: `OWNER`, `STAFF`
- Query: `search`, `sku`, `barcode`, `categoryId`, `category`, `status`, `page`, `pageSize`, `sortBy`, `sortOrder`
- Response purpose: return paginated product records with category and inventory summary.

### Get Product

- Method: `GET`
- Path: `/api/products/:id`
- Access: `OWNER`, `STAFF`
- Response purpose: return a single product with category and inventory summary.

### Update Product

- Method: `PATCH`
- Path: `/api/products/:id`
- Access: `OWNER`
- Request: partial product fields from the create shape.
- Response purpose: update product details without removing untouched fields.

### Change Product Status

- Method: `PATCH`
- Path: `/api/products/:id/status`
- Access: `OWNER`
- Request:

```json
{
  "status": "INACTIVE"
}
```

- Response purpose: safely deactivate or discontinue a product.

### Inventory List

- Method: `GET`
- Path: `/api/inventory`
- Access: `OWNER`, `STAFF`
- Query: `search`, `categoryId`, `category`, `productStatus`, `stockStatus`, `page`, `pageSize`, `sortBy`, `sortOrder`
- Response purpose: return current stock rows with product and category context.

### Inventory by Product

- Method: `GET`
- Path: `/api/inventory/product/:productId`
- Access: `OWNER`, `STAFF`
- Response purpose: return current quantity, reorder level, stock status, and last update time for one product.

### POS Barcode Lookup

- Method: `GET`
- Path: `/api/inventory/lookup`
- Access: `OWNER`, `STAFF`
- Query:

```text
barcode=4800000000000
```

- Response purpose: provide POS-friendly product lookup data.

### Stock In

- Method: `POST`
- Path: `/api/inventory/:productId/stock-in`
- Access: `OWNER`
- Request:

```json
{
  "quantity": 10,
  "reason": "Supplier restock",
  "referenceType": "PURCHASE",
  "referenceId": "PO-2026-001"
}
```

- Response purpose: update stock and create one `STOCK_IN` movement in a transaction.

### Manual Adjustment

- Method: `POST`
- Path: `/api/inventory/:productId/adjust`
- Access: `OWNER`
- Request:

```json
{
  "movementType": "ADJUSTMENT_OUT",
  "quantity": 2,
  "reason": "Damaged pack"
}
```

- Response purpose: apply a positive stock adjustment with audit history.

### Movement History

- Method: `GET`
- Path: `/api/inventory/:productId/movements`
- Access: `OWNER`, `STAFF`
- Query: `movementType`, `from`, `to`, `page`, `pageSize`
- Response purpose: return newest-first audit history for stock changes.

### POS Stock Deduction

- Method: `POST`
- Path: `/api/inventory/deduct`
- Access: `OWNER`, `STAFF`
- Request:

```json
{
  "referenceType": "POS_CHECKOUT",
  "referenceId": "SALE-2026-001",
  "reason": "Checkout sale",
  "lineItems": [
    { "productId": "prd_cola_15l", "quantity": 2 },
    { "productId": "prd_cheese_crackers", "quantity": 1 }
  ]
}
```

- Response purpose: deduct multiple items atomically and create one `SALE` movement per product.

Duplicate line item handling:

- The backend merges repeated `productId` entries before validation and deduction.

## POS Integration Contract

M1 should:

- Look up products by calling `GET /api/inventory/lookup?barcode=...`
- Use `available`, `isActive`, `currentStock`, and `sellingPrice` to decide whether a line can be added
- Call `POST /api/inventory/deduct` after checkout confirmation
- Treat `409` responses with `INSUFFICIENT_STOCK` or `PRODUCT_INACTIVE` as checkout blockers
- Treat `404` responses as invalid barcode or product references

Suggested POS lookup response shape:

```json
{
  "productId": "prd_cola_15l",
  "productName": "Classic Cola 1.5L",
  "sku": "BEV-COLA-001",
  "barcode": "4800012345678",
  "sellingPrice": "28.00",
  "currentStock": 28,
  "available": true,
  "isActive": true
}
```

## SARIMA Data Contract

M2 should consume:

- Stable `productId`
- Product metadata: `name`, `sku`, `category`, `unit`
- Product state: `status`
- Inventory state: `quantityOnHand`, `reorderLevel`
- Movement history: `SALE` movements only for demand aggregation

Recommended monthly demand input:

```text
productId
productName
sku
periodStart
periodEnd
quantitySold
currentStock
reorderLevel
```

Aggregation rules:

- Count `SALE` movements only for demand.
- Exclude `STOCK_IN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `RETURN_IN`, `RETURN_OUT`, `DAMAGE`, `EXPIRED`, and `INITIAL_STOCK`.
- Use a consistent timezone and month boundary when grouping data.
- Use zero-demand rows for missing product-month combinations when the forecasting pipeline needs a complete matrix.

## Seed Data

Development seed data currently includes:

- Categories for beverages, canned goods, snacks, instant noodles, toiletries, and household products
- Active products
- Inactive products
- Discontinued products
- Barcode and no-barcode examples
- Normal, low-stock, and out-of-stock inventory states
- Initial stock, stock-in, sale, and manual adjustment movements

## Related Contracts

- [Product Import Contract](./PRODUCT-IMPORT-CONTRACT.md)

## Role Permissions

- `OWNER`: create/update/deactivate products, stock-in, manual adjustments, POS deduction, inventory reads
- `STAFF`: read products/inventory, POS lookup, movement history, POS deduction

## Known Limitations

- The backend currently exposes the stock deduction contract but not the full sales module.
- Historical sales aggregation for SARIMA should use `SALE` movements until a dedicated sales API is in place.
- The inventory list currently computes stock status in application code.
