# Versioning Strategy

## Purpose

This document defines how version labels should be used for YsabelleStore configuration, deployment, and thesis milestones.

## Scope

- Foundation
- Alpha
- Beta
- Release Candidate
- Final Defense
- Semantic versioning
- Maintenance policy

## Version Stages

| Stage             | Meaning                                                   |
| ----------------- | --------------------------------------------------------- |
| Foundation        | Repository and deployment baselines are being established |
| Alpha             | Core modules are being introduced                         |
| Beta              | Feature completeness is nearing review readiness          |
| Release Candidate | Build is validation-ready and packageable                 |
| Final Defense     | Thesis-ready version for evaluation                       |

## Semantic Versioning

| Segment | Meaning                               |
| ------- | ------------------------------------- |
| Major   | Breaking or milestone-level change    |
| Minor   | Backward-compatible enhancement       |
| Patch   | Small fix or documentation adjustment |

## Maintenance Policy

| Rule                | Requirement                                       |
| ------------------- | ------------------------------------------------- |
| Version labels      | Must be documented before release work starts     |
| Version consistency | Must match PR, release notes, and deployment docs |
| Safe evolution      | Must not change silently across layers            |

## Future Implementation Notes

- Version policy should remain simple enough for thesis review.
- Release candidates should map to a visible version label.
- Maintenance updates should be reflected in both docs and release artifacts.

## Validation Checklist

- [x] Foundation through final defense stages are documented
- [x] Semantic versioning is included
- [x] Maintenance policy is clear
- [x] No release automation is added
