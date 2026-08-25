# Local Development Guardrails

## Command Boundaries

| Command                                                    | Responsibility                                                                                               | File mutation                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `npm run verify:code`                                      | Diff check, Prisma validation, TypeScript, lint, format check, tests, build, production audit, version check | Source and metadata read-only; build tools may refresh ignored generated output |
| `npm run verify:status -- --member m1`                     | Format, artifact, sprint, and version checks                                                                 | Read-only                                                                       |
| `npm run verify:local -- --member m1`                      | Complete read-only code and status verification                                                              | Source and metadata read-only                                                   |
| `npm run status:update -- --member m1 --validation Passed` | Update implementation and active-sprint evidence, then format only those targets                             | Atomic, explicit metadata mutation                                              |
| `npm run version:bump -- --version=X.Y.Z --sprint=N`       | Explicit application/release metadata mutation                                                               | Explicit version files only                                                     |
| `npm run prepush:local -- --member m1`                     | Preflight, verify code, atomically update status, verify status                                              | Documented metadata mutation after validation                                   |
| `npm run push-ready -- --member m1`                        | Compatibility alias for complete read-only verification                                                      | Read-only                                                                       |

## Active Sprint Policy

`config/guardrails.json` is the canonical active-sprint source. A sprint integration branch that
declares `sprint-N` must match that configured number. The corresponding `docs/sprints/sprint-N`
folder and required templates must exist before any status mutation begins.

Sprint status, the user-visible application version, and private npm package versions are
independent. Validation never performs a semantic version bump.

## Failure and Rerun Policy

- A failed preflight or code gate leaves sprint and implementation artifacts unchanged.
- Status updates snapshot every target and roll back the full set if an update or targeted formatting
  step fails.
- Child exit codes propagate and later steps stop after the first failure.
- Repeated status updates replace same-date/same-branch rows instead of appending duplicates.
- Repository-wide formatting is never performed by a validation command.

## Dependency Audit Policy

`npm run security:audit` reports and blocks all high or critical findings. The pre-push and CI gate
uses `npm run security:audit:production`, which classifies lockfile nodes marked `dev` or
`devOptional` as development-only warnings and blocks high or critical findings that reach the
production dependency graph. Findings still require manual reachability review; no audit command
performs an automatic dependency update.
