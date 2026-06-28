# Seed Strategy

The seed folder documents the controlled development data strategy for YsabelleStore. Sprint 1 defines the schema foundation, but it does not add executable seed scripts or production-like records.

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

## Current Folder State

| Item        | Status       | Reason                                         |
| ----------- | ------------ | ---------------------------------------------- |
| `.gitkeep`  | Present      | Preserves the seed folder in version control   |
| Seed script | Not included | Future task after migration application review |
| Seed data   | Not included | Avoids fake production data in Sprint 1        |

## Future Seed Entry Criteria

- Initial migration has been reviewed and applied locally.
- Password handling strategy is approved for local-only users.
- Seed records are small enough to inspect manually.
- Sales samples are explicitly marked as development-only.
- Seed execution is repeatable or its reset behavior is documented.
