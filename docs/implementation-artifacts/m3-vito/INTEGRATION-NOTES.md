# Sprint 11 Customer Support Integration Notes

This branch integrates the completed M3 customer-support/Gmail work from `m3/v0.11/feat/customer-service` onto the current `sprint/v0.11/sprint-11` tree.

## History preservation

The integration merge commit retains two parents:

1. current Sprint 11 head as the first parent; and
2. M3 customer-support head `2ee4aa64d9e08e4aacc029bfd4de76bc5ede723c` as the second parent.

This preserves the original M3 commit history and authorship while allowing the resolved tree to keep newer Sprint 11 work.

## Database convergence

The original M3 migration name `0006_customer_support_foundation` conflicts with newer Sprint 11 migrations. The integrated tree therefore carries the same support-table foundation forward as `0009_customer_support_foundation`, after:

- `0006_paymongo_billing`
- `0007_delivery_fulfillment`
- `0008_customer_profile_defaults`

The current schema retains PayMongo, delivery/COD, customer-profile, and support relations together.

## Merge policy

The integration is intentionally isolated in a draft PR. It must not be merged into Sprint 11 until repository CI, migration rehearsal, canonical-state checks, workspace builds, and support tests all pass.
