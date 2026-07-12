# Seed Strategy

The seed folder documents the controlled development data strategy for YsabelleStore. Sprint 3 adds an executable development seed script with deterministic product, inventory, and movement fixtures.

## Seed Philosophy

| Principle              | Rule                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Deterministic data     | Seed records must create repeatable local development states                       |
| Development-only scope | Seed data must never represent real customers, sales, passwords, or production use |
| Minimal fixtures       | Data should support validation without hiding defects                              |
| Schema alignment       | Seed scripts must follow approved Prisma models only                               |
| Clear reset behavior   | Seed workflow must document whether data is inserted, updated, or replaced         |

## Future Seed Groups

| Group             | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| Users             | One local owner and one staff account with non-real passwords |
| Categories        | Small grocery/convenience-store category set                  |
| Products          | Representative barcode-ready product examples                 |
| Inventory batches | Controlled stock and expiry examples                          |
| Sales history     | Small chronological sales sample for later forecast tests     |
| Import samples    | Canonical CSV and Excel product import fixtures               |

## Current Folder State

| Item        | Status      | Reason                                                                          |
| ----------- | ----------- | ------------------------------------------------------------------------------- |
| `.gitkeep`  | Present     | Preserves the seed folder in version control                                    |
| Seed script | Present     | `development.mjs` creates users, categories, products, inventory, and movements |
| Seed data   | Development | Deterministic local fixtures for auth and inventory validation                  |

## Development Login Accounts

Run the seed script only against a local development database:

```bash
npm run db:seed
```

| Role  | Email                       | Password         | Scope            |
| ----- | --------------------------- | ---------------- | ---------------- |
| Owner | `owner@ysabellestore.local` | `OwnerPass#2026` | Development only |
| Staff | `staff@ysabellestore.local` | `StaffPass#2026` | Development only |

Passwords are written to the database as `scrypt` hashes. These accounts are fixtures for local authentication testing only and must not be used as production credentials.

## Current Seed Coverage

- Deterministic categories for beverages, canned goods, snacks, instant noodles, toiletries, and household products
- Active, inactive, and discontinued products
- Barcode and no-barcode examples
- Current stock examples for normal, low-stock, and out-of-stock conditions
- Initial stock, stock-in, sale, and manual adjustment movement history

## Sample Import Fixtures

The repo also includes deterministic import examples for validation and QA:

- `docs/samples/product-import/valid-products.csv`
- `docs/samples/product-import/valid-products.xlsx`
- `docs/samples/product-import/duplicate-sku.csv`
- `docs/samples/product-import/duplicate-barcode.csv`
- `docs/samples/product-import/invalid-category.csv`
- `docs/samples/product-import/negative-stock.csv`
- `docs/samples/product-import/missing-required-column.csv`

These files are intentionally small and should be used to verify preview, validation, and successful import behavior.

## Future Seed Entry Criteria

- Initial migration has been reviewed and applied locally.
- Password handling strategy is approved for local-only users.
- Seed records are small enough to inspect manually.
- Sales samples are explicitly marked as development-only.
- Seed execution is repeatable or its reset behavior is documented.
