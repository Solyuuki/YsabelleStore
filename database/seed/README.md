# Seed Foundation

The seed folder is reserved for future controlled development data. No seed implementation is included in this phase.

## Seed Philosophy

| Principle              | Rule                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Deterministic data     | Future seed data must create repeatable local development states                   |
| Development-only scope | Seed scripts must not represent production data                                    |
| Minimal fixtures       | Data should support validation without hiding defects                              |
| Schema alignment       | Seed scripts must follow approved Prisma models only                               |
| Clear reset behavior   | Future seed workflows must document whether data is inserted, updated, or replaced |

## Current Folder State

| Item        | Status      | Reason                                        |
| ----------- | ----------- | --------------------------------------------- |
| `.gitkeep`  | Present     | Preserves the seed folder in version control  |
| Seed script | Not present | Schema and migrations are not implemented yet |
| Seed data   | Not present | Business data is outside foundation scope     |

## Future Seed Entry Criteria

- Approved Prisma models exist.
- Initial migration has been reviewed.
- Local database setup is documented.
- Seed records support development and testing needs only.
- Seed execution is safe to repeat or clearly documented when it is not.
