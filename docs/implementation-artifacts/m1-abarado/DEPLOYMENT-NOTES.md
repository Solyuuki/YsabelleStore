# m1 Deployment Notes

## Desktop Deployment Ownership

| Area | Owner | Standard |
| --- | --- | --- |
| Electron packaging | m1 | Use `electron-builder` |
| Desktop app name | m1 | `YsabelleStore` |
| Backend startup coordination | m1 and m2 | Electron must start or connect to approved Express process |
| Release validation | Shared | Build, lint, tests, and packaging checks |

## Deployment Log

| Version | Date | Package Target | Status | Notes |
| --- | --- | --- | --- | --- |
| v0.1 | 2026-06-24 | Documentation foundation | Completed | Application package not created during foundation phase |

## Release Checklist

- [ ] Frontend build passes
- [ ] Backend starts successfully
- [ ] Prisma migrations are applied
- [ ] Forecasting engine responds to valid input
- [ ] Electron package builds successfully
- [ ] Release notes identify known limitations
