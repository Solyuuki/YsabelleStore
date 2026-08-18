# Versioning

## Purpose

This document defines the deployment version policy for YsabelleStore.

## Scope

- Foundation version labels
- Future semantic versioning
- Release progression

## Version Policy

| Version               | Meaning                                                     |
| --------------------- | ----------------------------------------------------------- |
| `v0.1 Foundation`     | Deployment and repository foundations are being established |
| `v0.5 Beta`           | Feature-complete release candidate work is approaching      |
| `v1.0 Thesis Defense` | Approved thesis-ready release milestone                     |

## Semantic Versioning

| Segment | Meaning                            |
| ------- | ---------------------------------- |
| Major   | Breaking or milestone-level change |
| Minor   | New backward-compatible capability |
| Patch   | Small fix or safe refinement       |

## Release Rule

| Rule                         | Expectation                                                 |
| ---------------------------- | ----------------------------------------------------------- |
| Stable tags                  | Use version labels consistently for release preparation     |
| No guesswork                 | Release decisions must be based on validated build evidence |
| No direct production release | Final release steps remain documented until approved        |

## Repository Sources

The visible application version, private npm package metadata, and active sprint serve different
purposes. `npm run version:check` verifies their individual formats and the alignment of private
package/lockfile versions. Sprint transitions never imply semantic version bumps.

Version mutation remains an explicit release action. Local verification and pre-push workflows do
not call `version:bump`, so failed or repeated validation cannot increment a version.

## Future Implementation Notes

- Versioning should support both thesis milestones and deployment readiness.
- Each release candidate should map to a clear version label.
- Version updates should be documented before packaging.

## Validation Checklist

- [x] Foundation labels are documented
- [x] Semantic versioning is documented
- [x] Major, minor, and patch meanings are clear
- [x] Version mutation is explicit and is not part of validation
