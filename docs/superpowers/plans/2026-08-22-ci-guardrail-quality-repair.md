# CI Guardrail Quality Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make YsabelleStore CI and guardrails deterministic, read-only in validation, correctly scoped to the real PR branch, database-capable, and trustworthy enough that a green check means the repository is actually safe to proceed.

**Architecture:** GitHub Actions will provide an explicit source-branch/base-branch context and a disposable MySQL service. Guardrail scripts will resolve branch context from GitHub Actions environment when Git is detached, compare the real PR range, and distinguish member branches from sprint integration branches instead of hardcoding M1. Validation workflows will test committed state only and will never commit or push repair changes.

**Tech Stack:** GitHub Actions, Node.js 22, npm workspaces, Node test runner, Prisma 6, MySQL 8, Husky, Prettier, ESLint.

**Spec:** `docs/standards/CI-GUARDRAILS.md` and `docs/GITHUB-WORKFLOW.md`

## Global Constraints

- CI must block real build, formatting, lint, type, test, Prisma, security, branch, PR metadata, and ownership failures.
- CI validation must be read-only and must not commit or push repository changes.
- Sprint integration branches must not be falsely attributed to M1.
- Member branches must resolve and validate their real member ownership.
- PR checks must use the real PR source branch and PR diff, not a detached merge branch guess.
- Database-backed tests must have a disposable MySQL database available.
- Temporary Sprint 7 schema/format mutation workflows must be removed after equivalent committed-state checks exist.
- Phase 2 customer UI work remains blocked until the repaired quality gates are green.

---

### Task 1: Guardrail GitHub Actions Context Regression Tests

**Files:**

- Modify: `scripts/test/guardrails.test.mjs`
- Modify: `scripts/lib/git-utils.mjs`

**Interfaces:**

- Consumes: Git branch state plus `GITHUB_HEAD_REF`, `GITHUB_BASE_REF`, and optional explicit Ysabelle guardrail environment.
- Produces: deterministic `getBranch()` and PR-aware `collectChangedFiles()` behavior.

- [ ] **Step 1: Write failing tests** proving detached GitHub PR runs resolve the source branch and that PR changed-file collection compares the configured base branch instead of falling back to only the synthetic merge commit.
- [ ] **Step 2: Run `npm run test:guardrails` in CI and verify RED** on the new expectations.
- [ ] **Step 3: Implement minimal environment-aware branch resolution and base comparison** in `scripts/lib/git-utils.mjs`.
- [ ] **Step 4: Run `npm run test:guardrails` and verify GREEN.**
- [ ] **Step 5: Commit the context repair.**

### Task 2: Remove Hardcoded M1 From Generic CI

**Files:**

- Modify: `scripts/lib/guardrail-config.mjs`
- Modify: `scripts/guardrail-preflight.mjs`
- Modify: `scripts/verify-status.mjs`
- Modify: `scripts/sprint-check.mjs`
- Modify: `scripts/test/guardrails.test.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: branch classification: member branch, sprint integration branch, staging/main.
- Produces: member-scoped checks only when a member exists; sprint-level validation for sprint integration branches.

- [ ] **Step 1: Write failing tests** showing a sprint integration branch can run preflight/status validation without pretending to be M1, while member branches still resolve M1/M2/M3 correctly.
- [ ] **Step 2: Verify RED** with `npm run test:guardrails`.
- [ ] **Step 3: Implement optional-member guardrail context** for integration branches while preserving explicit `--member` support for local metadata updates.
- [ ] **Step 4: Remove `--member m1` from generic CI** and pass explicit PR branch/base context through workflow environment.
- [ ] **Step 5: Verify guardrail tests GREEN.**

### Task 3: Make Main CI Database-Capable and Runtime-Consistent

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `package.json` only if a deterministic CI database preparation command is needed.
- Modify: database migration/test setup only if an existing persisted invariant is proven broken by the now-correct database test lane.

**Interfaces:**

- Consumes: committed Prisma schema and backend tests.
- Produces: disposable MySQL schema and strict workspace test results.

- [ ] **Step 1: Add MySQL 8 service and Node 22 runtime** to repository quality gates so dependency engine requirements and Prisma-backed tests share one supported runtime.
- [ ] **Step 2: Generate and validate Prisma, then build the disposable DB with `prisma db push`** before workspace tests because the historical migration chain is not blank-database replay-safe.
- [ ] **Step 3: Run all workspace tests strictly.** Any real baseline data-integrity failure that surfaces must be repaired rather than hidden.
- [ ] **Step 4: Keep workspace build matrix independent and green.**

### Task 4: Make Validation Read-Only and Remove Temporary Self-Mutating Workflows

**Files:**

- Modify: `.github/workflows/sprint-7-validation.yml`
- Delete: `.github/workflows/sprint-7-phase1-schema-apply.yml`
- Delete: `.github/sprint-7-phase1-schema-trigger.txt`
- Delete: `scripts/sprint7-phase1-schema-candidate.mjs`
- Modify: `backend/package.json` if the committed customer-auth contract must become part of the normal backend test command.

**Interfaces:**

- Consumes: committed Sprint 7 schema/service/tests only.
- Produces: strict, read-only Sprint 7 validation with no commit/push permissions.

- [ ] **Step 1: Add the customer-auth contract to the normal backend test lane or an explicit strict committed-state CI step.**
- [ ] **Step 2: Change Sprint 7 Validation permissions to `contents: read`.**
- [ ] **Step 3: Remove candidate-schema mutation and commit/push steps.**
- [ ] **Step 4: Remove `continue-on-error` from real backend tests.**
- [ ] **Step 5: Delete obsolete schema-apply/format-repair helpers and trigger files after equivalent checks are green.**

### Task 5: Reduce False Failures Without Weakening Safety

**Files:**

- Modify: `.prettierignore` only for generated/external content that should never be repository-owned formatting policy.
- Modify: `.github/workflows/repository-governance.yml` only where a check is proven stale or unrelated.
- Modify: `scripts/lib/change-classifier.mjs`
- Modify: `scripts/test/guardrails.test.mjs`

**Interfaces:**

- Consumes: changed-file set.
- Produces: generic, current-scope risk/manual-QA classification without stale trusted-device-specific conclusions.

- [ ] **Step 1: Write failing regression tests** showing generic schema/script changes do not manufacture trusted-device decisions or auth-specific QA text.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Replace stale feature-specific classifier rules with generic descriptions derived from actual changed areas.**
- [ ] **Step 4: Verify GREEN and preserve strict risky-change classification for backend/database/auth/security files.**

### Task 6: Final Guardrail Verification

**Files:**

- Modify: `docs/standards/CI-GUARDRAILS.md` and `docs/GITHUB-WORKFLOW.md` only to document the repaired behavior.

**Interfaces:**

- Consumes: final committed checker architecture.
- Produces: a repeatable local/CI contract.

- [ ] **Step 1: Run the guardrail regression suite.**
- [ ] **Step 2: Run formatting, lint, typecheck, workspace tests, build, production security audit, version check, Prisma validation, and status checks through GitHub Actions.**
- [ ] **Step 3: Confirm PR source branch and changed-file diagnostics in logs.**
- [ ] **Step 4: Confirm CI, Repository Governance, Pull Request Checks, and Sprint 7 committed-state validation are green on the same head SHA.**
- [ ] **Step 5: Inspect the Sprint 7 diff for accidental unrelated checker weakening.**
- [ ] **Step 6: Only after the same-head checks are green may Phase 2 begin.**
