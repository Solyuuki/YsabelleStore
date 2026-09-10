# Phase 3 Final-State Reconciliation

Accepted Phase 3 reference: `m1/v0.9/feat/customer-auth-ui-sync@a9ada3a7ef35f06788280268d4d4afad637526b5`

Current integration target: `m1/v0.9/feat/customer-recovery-email-otp`

This document records final-state reconciliation only. The Phase 3 branch is not merged or cherry-picked wholesale because the current branch contains newer Phase 4 account recovery, OTP, session, and storefront work.

| Area                                    | Phase 3 final state                                                                                            | Current classification | Reconciliation action                                                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer header About copy              | `About`                                                                                                        | RESTORED               | Restored only the `/about` navigation label; current account/auth behavior retained.                                                         |
| About premium story CSS                 | Premium location composition, native-scroll scrollbar treatment, progress glass rail, welcome ring containment | RESTORED               | Restored `customer-about-premium.css` from the accepted Phase 3 snapshot.                                                                    |
| About scroll tuning                     | 220% deferred intelligence preload; no aggressive `fastScrollEnd`; lower scrub values; forced refresh          | RESTORED               | Restored accepted Phase 3 scroll behavior in `DiscoverPage.tsx` without changing story content or storefront data flow.                      |
| Home/Shop ambient surfaces              | Scoped blue/indigo/violet/pink background lighting                                                             | RESTORED               | Restored `customer-surface-lighting.css` and its `main.tsx` import.                                                                          |
| Retailer sidebar brand mark             | `YsabelleBrandMark` mini mark                                                                                  | PRESERVED              | Current file matches the accepted Phase 3 implementation.                                                                                    |
| Retailer sidebar navigation palette     | Indigo/violet navigation treatment                                                                             | PRESERVED              | Current `SidebarNavItem.tsx` matches the accepted Phase 3 blob.                                                                              |
| Logout confirmation                     | Premium rounded/glass modal, indigo information surface, branded sign-out action                               | PRESERVED              | Previously restored on the current branch; current source matches accepted Phase 3 behavior.                                                 |
| Dashboard stat icons                    | Unified branded icon treatment                                                                                 | NEWER-PHASE4           | Current branch contains a later user-approved blue/violet/pink treatment; do not overwrite with the older Phase 3 light variant.             |
| Retailer legacy-theme bridge            | Messenger-family blue/indigo/violet/pink remap                                                                 | NEWER-PHASE4           | Current `retailer-brand.css` retains the accepted bridge and later compatibility additions.                                                  |
| Customer login/register Phase 3 styling | Phase 3 auth composition and shader layers                                                                     | NEWER-PHASE4           | Phase 3 auth layers remain present; current TSX also contains later Phase 4 recovery/storefront behavior and must not be replaced wholesale. |
| Catalog image storage root              | Durable development root with linked-worktree fallbacks                                                        | RESTORED               | Restored path resolver, fallback storage reads/promotion, env wiring while preserving Resend/OTP environment fields.                         |
| Latest catalog image candidate          | Skip orphaned source/processed image records                                                                   | RESTORED               | Restored readable-candidate selection and accepted regression coverage.                                                                      |
| Phase 4 OTP/recovery                    | Newer than Phase 3                                                                                             | NEWER-PHASE4           | No Phase 3 production file is allowed to replace the OTP challenge, recovery grant cookie, reset/session revocation, or Resend behavior.     |

## Regression guards restored or retained

- `scripts/test/customer-about-location-premium.test.mjs`
- `scripts/test/customer-about-scroll-stability.test.mjs`
- `scripts/test/customer-surface-premium-lighting.test.mjs`
- `scripts/test/retailer-brand-unification.test.mjs`
- `scripts/test/retailer-dashboard-icon-unification.test.mjs`
- `backend/test/catalog-image-storage-paths.test.ts`
- `backend/test/catalog-image-storage.test.ts`
- `backend/test/catalog-image-latest-candidate.test.ts`

## Phase 5 gate

GitHub source reconciliation is not the final runtime acceptance gate. Before Phase 5, run a fresh local `npm run typecheck`, the focused Phase 3/4 regressions, the backend test suite, and manual browser QA for Home, Shop, About scrolling/location/progress, login/register/recovery, retailer sidebar/dashboard/logout, password reset, old-password rejection, and session revocation.

No Phase 3 or Phase 4 branch/PR should be merged until those checks are green and the user explicitly approves the merge.
