# Release Checklist

## Purpose

This checklist documents the release readiness gates for the YsabelleStore deployment foundation.

## Scope

- Build validation
- Dependency validation
- Prisma validation
- Electron packaging review
- Documentation updates

## Release Checklist

- [ ] `npm run format`
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm audit --audit-level=high`
- [ ] `npx prisma validate --schema=database/prisma/schema.prisma`
- [ ] Electron build completed
- [ ] Installer generated
- [ ] Installer tested
- [ ] Documentation updated
- [ ] Version updated
- [ ] No high vulnerabilities
- [ ] No critical vulnerabilities

## Validation Matrix

| Check          | Pass Means                          | Fail Means                         |
| -------------- | ----------------------------------- | ---------------------------------- |
| Format         | Code style is consistent            | Files need formatting              |
| Lint           | Code quality rules pass             | Code issues must be fixed          |
| Build          | Workspace builds succeed            | Release cannot proceed             |
| Audit          | No high or critical vulnerabilities | Dependencies must be corrected     |
| Prisma         | Schema is valid                     | Schema change must be fixed        |
| Installer test | Desktop package behaves correctly   | Packaging or runtime issue remains |

## Future Implementation Notes

- Release approval should require completed checklist evidence.
- Missing validation means the release candidate is not ready.
- No production release should bypass the checklist.

## Validation Checklist

- [x] Checklist items are documented
- [x] Validation matrix is included
- [x] Release readiness criteria are explicit
- [x] No release step is implemented
