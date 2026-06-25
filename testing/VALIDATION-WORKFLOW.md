# Validation Workflow

## Purpose

This document defines the future testing validation workflow for YsabelleStore.

## Scope

- Developer workflow
- Local validation
- CI validation
- PR review
- Merge readiness

## Workflow

```text
Developer
  -> Local Validation
  -> CI Validation
  -> PR Review
  -> Merge
```

## Validation Stages

| Stage            | Responsibility                                                  |
| ---------------- | --------------------------------------------------------------- |
| Developer        | Prepare the change and validate locally                         |
| Local Validation | Confirm the change behaves as expected on the developer machine |
| CI Validation    | Run shared checks in the repository automation layer            |
| PR Review        | Confirm evidence, scope, and ownership                          |
| Merge            | Accept only when validation and review are complete             |

## Validation Rules

- Local validation should happen before opening a PR.
- CI validation should protect the main branch.
- PR review should verify that the correct testing strategy was used.
- Merge should require the documented checks to pass.

## Future Implementation Notes

- Keep validation commands aligned with the repository’s quality gates.
- Update the workflow when new layers or test categories are added.
- Treat failed validation as a root-cause issue, not a paperwork issue.

## Validation Checklist

- [x] Workflow stages are documented
- [x] Local and CI validation are included
- [x] PR review and merge are included
- [x] No CI test runner is configured here
