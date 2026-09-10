# Phase 3 Final-State Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore every accepted Phase 3 final-state behavior that is missing from the current Phase 4 OTP branch without redoing approved UI work or overwriting newer Phase 4 account-recovery changes.

**Architecture:** Treat `m1/v0.9/feat/customer-auth-ui-sync@a9ada3a7ef35f06788280268d4d4afad637526b5` as the accepted Phase 3 snapshot, not as a branch to merge wholesale. Reconcile snapshot-level deltas into `m1/v0.9/feat/customer-recovery-email-otp` using focused regression tests first, exact historical files where they are still authoritative, and surgical edits where Phase 4 has newer code in the same file.

**Tech Stack:** React, TypeScript, Vite, CSS, Node.js `node:test`, Express, Prisma, Git/GitHub.

**Spec:** `docs/superpowers/specs/2026-08-25-auth-access-and-customer-login-design.md`; accepted Phase 3 baseline is `m1/v0.9/feat/customer-auth-ui-sync@a9ada3a7ef35f06788280268d4d4afad637526b5`.

## Global Constraints

- Work only on `m1/v0.9/feat/customer-recovery-email-otp` unless the user explicitly approves a different branch.
- Do not create another branch or worktree for this reconciliation.
- Do not merge or cherry-pick the 75 divergent Phase 3 commits wholesale.
- Preserve newer Phase 4 OTP, recovery-cookie, account-security, and Resend behavior.
- Already restored Phase 3 staff/theme pieces must not be rewritten unless an exact final-state comparison proves a remaining regression.
- Every behavioral restoration gets a regression test before production code is changed.
- Do not declare Phase 4 complete or start Phase 5 until focused tests, typecheck, backend regression, and manual QA are fresh and green.

---

### Task 1: Build the Phase 3 final-state reconciliation manifest

**Files:**

- Create: `docs/implementation-artifacts/m1-abarado/PHASE3-FINAL-STATE-RECONCILIATION.md`

**Interfaces:**

- Consumes: accepted Phase 3 snapshot `a9ada3a7ef35f06788280268d4d4afad637526b5` and current OTP branch head.
- Produces: a path-by-path classification of `PRESERVED`, `MISSING`, `REGRESSED`, or `NEWER-PHASE4` used by Tasks 2-5.

- [ ] **Step 1: Compare final snapshots, not intermediate history**

Inspect the Phase 3 and current versions of these accepted areas: storefront/About (`frontend/src/main.tsx`, `frontend/src/components/customer/CustomerHeader.tsx`, `frontend/src/styles/customer-about-premium.css`, `frontend/src/styles/customer-surface-lighting.css`), retailer/staff theme (`AppSidebar.tsx`, `SidebarNavItem.tsx`, `LogoutConfirmationModal.tsx`, `StatCard.tsx`, `AppLayout.tsx`, `button.tsx`, `retailer-brand.css`), customer auth Phase 3 styles/components, and Phase 3 catalog/dev-image-storage fixes.

- [ ] **Step 2: Record exact status and evidence**

For each inspected path, record the accepted Phase 3 blob SHA, current blob SHA or `MISSING`, classification, and action. `PRESERVED` and `NEWER-PHASE4` paths receive no production edit.

- [ ] **Step 3: Commit the manifest**

```bash
git add docs/implementation-artifacts/m1-abarado/PHASE3-FINAL-STATE-RECONCILIATION.md
git commit -m "docs(phase3): record final-state reconciliation manifest"
```

### Task 2: Restore the accepted About and customer surface polish

**Files:**

- Create/restore test: `scripts/test/customer-about-location-premium.test.mjs`
- Create/restore: `frontend/src/styles/customer-about-premium.css`
- Create/restore: `frontend/src/styles/customer-surface-lighting.css`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/components/customer/CustomerHeader.tsx`

**Interfaces:**

- Consumes: exact accepted Phase 3 CSS and header label.
- Produces: the approved `About` navigation copy, premium About location/progress treatment, and customer surface lighting without changing Phase 4 routing or recovery behavior.

- [ ] **Step 1: Restore the historical failing regression test**

Use the exact accepted Phase 3 test body from `scripts/test/customer-about-location-premium.test.mjs@06d19eb03530443e7297fd0a9450014981aee87a`.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test scripts/test/customer-about-location-premium.test.mjs
```

Expected before implementation: FAIL because `frontend/src/styles/customer-about-premium.css` is absent from the current branch.

- [ ] **Step 3: Restore the exact accepted CSS and surgical imports/copy**

Restore `customer-about-premium.css` and `customer-surface-lighting.css` from the accepted Phase 3 snapshot. In `frontend/src/main.tsx`, append imports for those two files after the existing brand/theme imports. In `CustomerHeader.tsx`, change only the `/about` link label from `About Us` to `About`; preserve current account/recovery logic.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
node --test scripts/test/customer-about-location-premium.test.mjs
npm run typecheck
```

Expected: focused test PASS and all typecheck workspaces PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/test/customer-about-location-premium.test.mjs frontend/src/styles/customer-about-premium.css frontend/src/styles/customer-surface-lighting.css frontend/src/main.tsx frontend/src/components/customer/CustomerHeader.tsx
git commit -m "fix(phase3): restore accepted About storefront polish"
```

### Task 3: Verify and preserve retailer/staff Phase 3 final state

**Files:**

- Test: existing retailer/theme regression tests under `scripts/test/`
- Inspect: `frontend/src/components/app/AppSidebar.tsx`
- Inspect: `frontend/src/components/app/SidebarNavItem.tsx`
- Inspect: `frontend/src/components/shared/LogoutConfirmationModal.tsx`
- Inspect: `frontend/src/components/shared/StatCard.tsx`
- Inspect: `frontend/src/layouts/AppLayout.tsx`
- Inspect: `frontend/src/components/ui/button.tsx`
- Inspect: `frontend/src/styles/retailer-brand.css`

**Interfaces:**

- Consumes: current restored staff/theme state and accepted Phase 3 snapshot.
- Produces: proof that already restored sidebar branding, dashboard icon treatment, logout modal, pagination/status/stat surfaces, and palette are preserved.

- [ ] **Step 1: Compare accepted/current blobs and behavior**

Do not replace files whose current behavior is equivalent or newer. Add a regression only for a concrete missing Phase 3 behavior found by comparison.

- [ ] **Step 2: Run the retailer/theme focused regression set**

```bash
node --test scripts/test/retailer-brand-unification.test.mjs scripts/test/retailer-dashboard-icon-unification.test.mjs
```

Expected: PASS after any proven missing delta is restored.

- [ ] **Step 3: Commit only if a concrete missing delta exists**

Use a focused `test(theme): ...` commit before a matching `fix(theme): ...` commit. If everything is preserved, make no production commit for this task.

### Task 4: Reconcile customer authentication Phase 3 final state without touching OTP recovery behavior

**Files:**

- Inspect/test: `frontend/src/pages/customer/CustomerLoginPage.tsx`
- Inspect/test: `frontend/src/pages/customer/CustomerRegisterPage.tsx`
- Inspect/test: Phase 3 auth CSS files already present under `frontend/src/styles/customer-auth-*.css`
- Test: existing `scripts/test/customer-auth-*.test.mjs` regressions

**Interfaces:**

- Consumes: accepted Phase 3 login/register visual contracts and current Phase 4 OTP branch.
- Produces: Phase 3 login/register composition and hints while retaining the newer account-recovery route and OTP UI.

- [ ] **Step 1: Compare final Phase 3 and current files path by path**

Classify differences as `accepted Phase 3 missing` or `newer Phase 4 intentional`. Never copy the Phase 3 recovery implementation over the current OTP flow.

- [ ] **Step 2: Add a failing focused regression for each proven missing behavior**

Use the repository's existing `node:test` static-contract style and one behavior per test.

- [ ] **Step 3: Restore only the minimal accepted delta**

Prefer exact accepted Phase 3 CSS for files that are absent; use surgical edits for TSX files containing newer Phase 4 logic.

- [ ] **Step 4: Run the auth UI regression set**

```bash
node --test scripts/test/customer-auth-centered-login-shader.test.mjs scripts/test/customer-auth-login-icon.test.mjs scripts/test/customer-auth-premium-hints.test.mjs scripts/test/customer-auth-quick-sign-preview.test.mjs scripts/test/customer-auth-register-density.test.mjs scripts/test/customer-auth-surface-balance.test.mjs scripts/test/customer-auth-ui-redesign.test.mjs scripts/test/customer-auth-wide-composition.test.mjs
```

Expected: all PASS.

### Task 5: Reconcile accepted Phase 3 catalog/dev-storage final behavior

**Files:**

- Inspect: Phase 3 catalog image storage/recovery files and corresponding current files.
- Test: existing catalog storage/fixture regression tests.

**Interfaces:**

- Consumes: final Phase 3 snapshot only; transient experiments that were removed before `a9ada3a7` are explicitly excluded.
- Produces: durable image-storage and storefront fixture-containment behavior if any accepted final-state delta is still missing.

- [ ] **Step 1: Compare final snapshot paths and exclude transient commits**

Do not revive the disposable backend test-database isolation spike or any other change absent from the Phase 3 final tree.

- [ ] **Step 2: Add RED regression only for a proven missing final behavior**

Run the existing focused catalog test that covers the affected behavior before editing production code.

- [ ] **Step 3: Restore the minimal final-state delta and rerun its test**

Expected: focused catalog regression PASS. Make no production change if current behavior is already equivalent or newer.

### Task 6: Fresh Phase 3 + Phase 4 verification gate before Phase 5

**Files:**

- No production files unless a failing verification reveals a separately diagnosed defect.

**Interfaces:**

- Consumes: Tasks 1-5.
- Produces: evidence-based go/no-go decision for Phase 5.

- [ ] **Step 1: Run TypeScript verification**

```bash
npm run typecheck
```

- [ ] **Step 2: Run recovery UI and email regressions**

```bash
node --test scripts/test/customer-recovery-otp-ui.test.mjs
node --test scripts/test/customer-recovery-email-delivery.test.mjs
```

- [ ] **Step 3: Run backend regression**

```bash
npm test --workspace backend
```

- [ ] **Step 4: Manual QA**

Verify customer Home/Shop/About, About story progress/location/handoff, login/register/recovery OTP, staff sidebar/dashboard/logout/theme surfaces, password reset completion, sign-in with the new password, rejection of the old password, and old-session revocation.

- [ ] **Step 5: Phase 5 gate**

Proceed to Phase 5 only when the reconciliation manifest has no unresolved `MISSING`/`REGRESSED` entries and every fresh automated/manual check above is green.
