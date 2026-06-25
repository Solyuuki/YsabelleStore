# Troubleshooting Guide

## Purpose

This guide documents common deployment and packaging issues for YsabelleStore.

## Scope

- Build failures
- Electron startup failures
- Missing environment variables
- Prisma validation issues
- Node version mismatch
- Dependency mismatch
- Packaging failures

## Common Issues

| Issue                    | Likely Cause                                      | First Check                                               |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------- |
| Build failed             | TypeScript or workspace build issue               | Re-run `npm run build` and read the first failing package |
| Electron failed          | Main process or preload issue                     | Check Electron workspace output and window entry paths    |
| Missing `DATABASE_URL`   | Environment variable not set for validation       | Set a temporary placeholder value for validation only     |
| Prisma validation failed | Schema or env issue                               | Re-run Prisma validate with the expected schema path      |
| Node version mismatch    | Local runtime differs from repository expectation | Confirm Node matches the engine requirement               |
| Dependency mismatch      | Lockfile and installed packages are out of sync   | Reinstall dependencies with `npm ci`                      |
| Packaging failed         | Builder config or missing build output            | Confirm the Electron and frontend build outputs exist     |

## Troubleshooting Flow

```text
Identify failure
  -> Reproduce locally
  -> Inspect the first error
  -> Fix root cause
  -> Re-run validation
```

## Future Implementation Notes

- Troubleshooting should favor root-cause fixes over temporary workarounds.
- Build and packaging issues should be diagnosed separately.
- Environment issues should be corrected before changing source code.

## Validation Checklist

- [x] Common issues are documented
- [x] Likely causes are mapped
- [x] A troubleshooting flow is provided
- [x] No fix scripts are included
