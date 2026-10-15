# Sprint 13 Branch Plan

## Baseline

- Source: `main`
- Exact base SHA: `be5accbaf088aff3e9f5d1bb146561752335396b`
- Sprint integration: `sprint/v0.13/sprint-13`
- Development display version: `v0.13.0` (not a certified release).
- Active sprint guardrail: `config/guardrails.json` is 13 on this branch only.

## Workflow

- Do not branch Sprint 13 from an outdated Sprint 12 or pre-merge commit.
- Reviewable task branches, if required, merge into the Sprint 13 integration branch.
- CI/release documentation and exact-head tests accompany implementation.
- Promote to `main` only after manual review and green CI.
- Railway pre-deployment runs against an isolated database and is not
  triggered by every unreviewed source push.
- Keep the `main` release unchanged until a specific promotion is approved.

## Validation

- Guardrail preflight must recognize Sprint 13.
- Required sprint documentation must be populated and pass status checks.
- Package metadata versions and lockfile remain consistent and independent
  of the user-visible Sprint 13 development version.
