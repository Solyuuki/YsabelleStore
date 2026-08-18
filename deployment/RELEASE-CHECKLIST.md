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

- [ ] `npm run verify:local -- --member m1`
- [ ] `npm run security:audit` reviewed, including development-only findings
- [ ] `npm run security:audit:production` passes
- [ ] `npm run version:check` passes
- [ ] Electron build completed
- [ ] Installer generated
- [ ] Installer tested
- [ ] Documentation updated
- [ ] Version updated
- [ ] No high vulnerabilities
- [ ] No critical vulnerabilities

## Validation Matrix

| Check          | Pass Means                                               | Fail Means                                        |
| -------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Format         | Code style is consistent                                 | Files need formatting                             |
| Lint           | Code quality rules pass                                  | Code issues must be fixed                         |
| Build          | Workspace builds succeed                                 | Release cannot proceed                            |
| Audit          | No production-reachable high or critical vulnerabilities | Dependencies must be corrected or release blocked |
| Prisma         | Schema is valid                                          | Schema change must be fixed                       |
| Installer test | Desktop package behaves correctly                        | Packaging or runtime issue remains                |

## Future Implementation Notes

- Release approval should require completed checklist evidence.
- Missing validation means the release candidate is not ready.
- No production release should bypass the checklist.

## Validation Checklist

- [x] Checklist items are documented
- [x] Validation matrix is included
- [x] Release readiness criteria are explicit
- [x] No release step is implemented
