# Test Data Policy

## Purpose

This document defines the allowed and disallowed test data practices for YsabelleStore.

## Scope

- Allowed test data
- Generated data
- CSV samples
- Production data restrictions
- Privacy guidelines

## Policy

| Data Type         | Policy                                                   |
| ----------------- | -------------------------------------------------------- |
| Allowed test data | Safe, synthetic, or approved sample records              |
| Generated data    | Allowed when it is clearly non-production and disposable |
| CSV samples       | Allowed for testing import and validation workflows      |
| Production data   | Not allowed for general testing use                      |
| Private data      | Must be protected and minimized                          |

## Privacy Guidelines

- Do not copy production secrets into test assets.
- Do not use real customer data as sample data.
- Keep test data small, readable, and safe to share within the repository.

## Future Implementation Notes

- Use dedicated sample data only when a future test requires it.
- Keep test data policy aligned with the security and import documentation.
- Review data usage before sharing test artifacts across members.

## Validation Checklist

- [x] Allowed data is documented
- [x] Generated data policy is documented
- [x] CSV sample policy is documented
- [x] Production data is excluded
- [x] Privacy guidance is stated
