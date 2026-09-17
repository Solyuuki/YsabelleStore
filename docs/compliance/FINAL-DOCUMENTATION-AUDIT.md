# YsabelleStore Final Documentation Audit

> **Baseline branch:** `sprint/v0.10/sprint-10`  
> **Scope:** planning → architecture → implementation → support → APIs → data → security → testing → packaging → deployment → licensing/compliance → HCI evidence

## 1. Executive Status

YsabelleStore now has a consolidated production-style documentation set for the current Sprint 10 implementation. The repository documentation distinguishes **implemented behavior**, **configured capability**, **manual evidence still required**, **known release gaps**, and **unsupported/not-claimed behavior**.

This audit intentionally does not convert a configured feature into a release claim without evidence. Documentation completeness is therefore separate from production-release readiness.

| Area                        | Documentation Status                                | Runtime / Release Status                                                     |
| --------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Project/Sprint baseline     | Complete                                            | Sprint 10 active                                                             |
| Architecture                | Complete/current index coverage                     | Implemented architecture with documented boundaries                          |
| Technology stack            | Complete register                                   | Implemented/configured components documented                                 |
| System support              | Complete support matrix                             | Some environments/features intentionally not claimed                         |
| Internal APIs               | Complete source-derived register                    | Mounted routes documented from executable source                             |
| Data model                  | Complete current Prisma register                    | 40 current Prisma models documented                                          |
| Forecasting                 | Documented model policy and dependencies            | SARIMA/fallback pipeline implemented; release dependency freeze still needed |
| Server health/status        | Complete                                            | Health/liveness/readiness implemented                                        |
| Security                    | Complete current-controls register                  | Known hardening discrepancies remain visible                                 |
| Testing/QA                  | Complete layered QA register                        | Automated CI is substantial; numeric code coverage not configured            |
| Windows packaging           | Complete configured-boundary docs                   | NSIS configured; self-contained full-stack installer not proven              |
| Operations/release          | Runbook, checklist and verification matrix complete | Target-machine/recovery evidence still required for formal release           |
| Third-party attribution     | Full-stack notice/component coverage present        | Exact release-time SBOM/license verification remains required                |
| Primary UI license evidence | Complete local evidence for Tailwind CSS 3.4.19     | MIT verified for selected UI framework                                       |
| CS114 evidence planning     | Complete checklist                                  | Manual screenshots/measurements still required                               |

## 2. Documentation Coverage Map

| Lifecycle Stage        | Primary Documents                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Planning / scope       | Root `README.md`, `docs/PROJECT-SCOPE.md`, Sprint 10 docs                          |
| Architecture           | `docs/architecture/`, `docs/compliance/ARCHITECTURE-AND-RUNTIME-DISCLOSURE.md`     |
| Full-stack technology  | `SYSTEM_TECHNOLOGY_REGISTER.md`, `docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md` |
| Supported system       | `SYSTEM_SUPPORT_MATRIX.md`, `docs/support/`                                        |
| APIs                   | `docs/api/API-REGISTER.md` plus API contract standards                             |
| Persistence/data       | `docs/data/DATA-MODEL-REGISTER.md`, Prisma schema/migrations                       |
| Forecasting/models     | `forecasting-service/README.md`, technology/component registers                    |
| Security               | `docs/security/SECURITY-CONTROLS-REGISTER.md`, backend security source             |
| Testing/QA             | `testing/TEST-AND-QA-REGISTER.md`, `testing/README.md`, CI workflows               |
| Packaging              | `deployment/WINDOWS-INSTALLER.md`, Electron Builder config                         |
| Operations             | `deployment/OPERATIONS-RUNBOOK.md`                                                 |
| Release gates          | `deployment/RELEASE-CHECKLIST.md`, `deployment/RELEASE-VERIFICATION-MATRIX.md`     |
| Third-party compliance | `THIRD_PARTY_NOTICES.md`, `docs/compliance/`, `docs/licenses/`                     |
| HCI/CS114 evidence     | `docs/hci/CS114-EVIDENCE-CHECKLIST.md`                                             |

## 3. Verified Current System Boundaries

| Boundary                | Current Evidence-Based Position                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Frontend                | React/Vite/TypeScript application using Tailwind CSS and supporting UI/chart/motion libraries   |
| Backend                 | Project-authored Express/TypeScript API                                                         |
| Database                | MySQL through Prisma                                                                            |
| Desktop                 | Electron shell with Windows NSIS packaging configuration                                        |
| Forecasting             | Project-authored orchestration using Python scientific dependencies and `statsmodels` SARIMA    |
| Internal authentication | OWNER/STAFF bearer JWT boundary with role enforcement and trusted-device support                |
| Customer authentication | Separate session/cookie, OTP/recovery, remembered-auth and social-auth domain                   |
| Inventory truth         | Aggregate inventory + batch + movement persistence model                                        |
| Storefront              | Shared backend/catalog/inventory source of truth with customer order flow                       |
| External services       | Resend, Gmail SMTP development QA, Google OAuth, Meta/Facebook OAuth/Graph API where configured |
| Health                  | `/api/health`, `/api/health/live`, `/api/health/ready`                                          |
| CI                      | Node 22, Python 3.12, MySQL 8.0 service plus static/test/build/security/status gates            |

## 4. Ownership and License Position

| Class                                   | Current Treatment                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| YsabelleStore-authored application code | Private project code; third-party licenses do not automatically relicense it                                          |
| Tailwind CSS 3.4.19                     | MIT; primary UI/HCI library license evidence preserved                                                                |
| Other npm dependencies                  | Tracked in manifests/lockfile and third-party notices; exact resolved license review required for formal distribution |
| Python dependencies                     | Names committed but versions currently unpinned; release freeze and license capture required                          |
| MySQL Community Server                  | External database runtime with its own licensing/distribution obligations; not treated as project-authored code       |
| Hosted APIs/services                    | Governed by provider terms, not npm/Python open-source notices                                                        |

**Important:** a root `LICENSE.md` containing a permissive license for the entire repository has intentionally not been created because that would be a separate decision to license YsabelleStore-authored source code. Third-party compliance is handled through notices, component inventory, and preserved license evidence.

## 5. Known Release / Production Gaps

The following are not documentation omissions; they are implementation, release-engineering, or evidence items that remain visible by design.

| ID   | Gap                                                                                                                       | Classification              | Required Action Before Claiming Full Production Readiness                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| G-01 | Import runtime limit is 100 MiB while a stale planning constant references 10 MB and generic error detail references 5MB  | Security/config consistency | Normalize one authoritative limit and matching error contract/tests                           |
| G-02 | Electron workspace declares `^42.5.0` while builder config pins `42.8.1`                                                  | Build reproducibility       | Normalize or explicitly pin/document release runtime                                          |
| G-03 | NSIS packaging visibly bundles Electron output + frontend renderer, not a proven backend/Python/MySQL provisioning bundle | Deployment                  | Define/prove full-stack installation/startup procedure before calling artifact self-contained |
| G-04 | Python requirements are unpinned                                                                                          | Reproducibility/compliance  | Freeze exact approved versions and record licenses/SBOM                                       |
| G-05 | Exact transitive dependency-license inventory is not archived as a generated SBOM                                         | Compliance                  | Generate/review exact release SBOM/license report                                             |
| G-06 | Sprint branch metadata currently does not establish branch protection                                                     | Governance                  | Enable/verify appropriate protection/rulesets for release lanes as project policy requires    |
| G-07 | No committed numeric code-coverage threshold/tool                                                                         | QA metrics                  | Keep risk-based test claims only or configure a measured coverage policy                      |
| G-08 | Automated production DB backup/restore subsystem is not established by reviewed source                                    | Operations/data safety      | Define operational backup, retention and restore drill evidence                               |
| G-09 | Installer code signing/publisher trust is not evidenced                                                                   | Distribution                | Configure/sign if required for intended distribution; otherwise do not claim signing          |
| G-10 | macOS/Linux packaged support is not configured                                                                            | Support                     | Keep unsupported/not claimed unless added and tested                                          |
| G-11 | Broad browser-support matrix is not proven by QA evidence                                                                 | Support                     | Test named browser/version targets before official compatibility claims                       |
| G-12 | Accessibility contrast/touch/keyboard evidence is manual and not yet attached                                             | HCI/release evidence        | Perform named-tool measurements and retain screenshots/results                                |

## 6. Stale-Documentation Corrections Completed

During the final audit, the following contradictions were corrected:

| Document                          | Previous Problem                                                     | Corrected Position                                                                |
| --------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `backend/src/security/README.md`  | Claimed authentication/JWT/roles were not implemented                | Now documents current implemented controls and known gaps                         |
| `deployment/WINDOWS-INSTALLER.md` | Described installer as only planned                                  | Now records actual NSIS configuration and the unproven full-stack bundle boundary |
| `deployment/RELEASE-CHECKLIST.md` | Contained stale commands and claimed no release step was implemented | Replaced with current CI/build/runtime/data/security/HCI release gates            |
| `testing/COVERAGE-STANDARDS.md`   | Future-only wording despite implemented test architecture            | Now defines risk-based coverage and explicitly prohibits invented percentages     |

## 7. Release Evidence Required Beyond Documentation

A formal release should attach evidence for the exact candidate rather than relying on these Markdown files alone.

| Evidence             | Minimum Record                                                        |
| -------------------- | --------------------------------------------------------------------- |
| Source identity      | Commit SHA/tag/branch                                                 |
| CI                   | Successful applicable workflow run IDs/logs                           |
| Dependency security  | Production dependency audit result                                    |
| Build                | Root + workspace build result                                         |
| Installer            | Artifact name/hash and target-machine test record                     |
| Database             | Schema/migration state plus backup/restore responsibility             |
| Health               | Live/readiness output from accepted runtime                           |
| Critical smoke tests | OWNER/STAFF, POS, inventory, storefront/forecast where in scope       |
| Compliance           | Exact release dependency/SBOM/license review                          |
| Accessibility/HCI    | Named-tool contrast evidence, keyboard/focus and target-size evidence |

## 8. Final Documentation Acceptance Criteria

The documentation set is considered internally complete for Sprint 10 when:

- the root README points to the central technology/support/compliance records;
- compliance index links the API, data, security, QA, operations and release registers;
- no known stale foundation statement is used as implementation truth where current executable source contradicts it;
- third-party and project-authored components are clearly separated;
- supported and unsupported scenarios are explicit;
- release gaps remain visible instead of being converted into unsupported claims;
- CS114 evidence requirements are separated from engineering implementation claims.

## 9. Maintenance Rule

Any material change to a dependency, route group, Prisma model, authentication mechanism, forecasting model/policy, supported OS/runtime, external provider, installer behavior, test gate, or release process should update its corresponding register in the same pull request or explicitly state why the documentation set is unaffected.
