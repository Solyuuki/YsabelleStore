# YsabelleStore Compliance Documentation Index

> **Baseline:** `sprint/v0.10/sprint-10`
>
> This directory is the navigation and governance entry point for YsabelleStore software-component, open-source, external-service, architecture, runtime, support, security, QA, deployment and HCI evidence documentation. It is an engineering compliance record. It does **not** grant a blanket open-source license to YsabelleStore-authored source code.

## 1. Master Documentation Map

| Document                                                                                             | Scope                                                                          | Primary Evidence                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [`FINAL-DOCUMENTATION-AUDIT.md`](FINAL-DOCUMENTATION-AUDIT.md)                                       | Final Sprint 10 documentation completeness, known gaps and evidence boundaries | Cross-repository audit of current source/config/docs                             |
| [`../../THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)                                       | Human-readable full-stack third-party software/service notices                 | Package manifests, lockfile, Python requirements, runtime configuration          |
| [`../../SYSTEM_TECHNOLOGY_REGISTER.md`](../../SYSTEM_TECHNOLOGY_REGISTER.md)                         | Full-stack technology register                                                 | Frontend/backend/Electron manifests, forecasting requirements, CI/runtime config |
| [`../../SYSTEM_SUPPORT_MATRIX.md`](../../SYSTEM_SUPPORT_MATRIX.md)                                   | Supported and unsupported system boundaries                                    | Current source/configuration/tests/deployment files                              |
| [`OPEN-SOURCE-ATTRIBUTION.md`](OPEN-SOURCE-ATTRIBUTION.md)                                           | Open-source attribution policy and primary UI-library declaration              | Exact dependency/upstream license evidence                                       |
| [`SOFTWARE-COMPONENT-INVENTORY.md`](SOFTWARE-COMPONENT-INVENTORY.md)                                 | Material software-component inventory                                          | Direct dependencies and material runtime/build components                        |
| [`EXTERNAL-SERVICES-REGISTER.md`](EXTERNAL-SERVICES-REGISTER.md)                                     | Hosted providers and external integration boundaries                           | `.env.example`, auth/email integration source/config                             |
| [`ARCHITECTURE-AND-RUNTIME-DISCLOSURE.md`](ARCHITECTURE-AND-RUNTIME-DISCLOSURE.md)                   | Project-authored vs third-party runtime responsibilities                       | Canonical architecture, manifests, service boundaries                            |
| [`../licenses/README.md`](../licenses/README.md)                                                     | Preserved license-evidence index                                               | Authoritative upstream license text/version evidence                             |
| [`../api/API-REGISTER.md`](../api/API-REGISTER.md)                                                   | Current mounted internal API inventory                                         | Express routers/controllers/middleware                                           |
| [`../data/DATA-MODEL-REGISTER.md`](../data/DATA-MODEL-REGISTER.md)                                   | Current Prisma persistence/domain inventory                                    | `database/prisma/schema.prisma`                                                  |
| [`../security/SECURITY-CONTROLS-REGISTER.md`](../security/SECURITY-CONTROLS-REGISTER.md)             | Implemented security controls, limitations and hardening gaps                  | Middleware/services/schema/tests                                                 |
| [`../../testing/TEST-AND-QA-REGISTER.md`](../../testing/TEST-AND-QA-REGISTER.md)                     | Layered automated/manual QA architecture                                       | Package scripts, tests and CI                                                    |
| [`../../deployment/OPERATIONS-RUNBOOK.md`](../../deployment/OPERATIONS-RUNBOOK.md)                   | Build/startup/health/failure/recovery operations                               | Runtime config, packaging and health boundaries                                  |
| [`../../deployment/RELEASE-VERIFICATION-MATRIX.md`](../../deployment/RELEASE-VERIFICATION-MATRIX.md) | Release evidence gates                                                         | CI, build, installer, runtime and manual evidence                                |
| [`../../deployment/RELEASE-CHECKLIST.md`](../../deployment/RELEASE-CHECKLIST.md)                     | Operator release sign-off checklist                                            | Exact release-candidate evidence                                                 |
| [`../support/SUPPORTED-ENVIRONMENTS.md`](../support/SUPPORTED-ENVIRONMENTS.md)                       | Environment/runtime support                                                    | Build/deployment/CI configuration                                                |
| [`../support/SUPPORTED-FEATURES.md`](../support/SUPPORTED-FEATURES.md)                               | Product capability support                                                     | Source/schema/tests and current scope                                            |
| [`../support/SUPPORTED-DATA-FORMATS.md`](../support/SUPPORTED-DATA-FORMATS.md)                       | Data/import/export boundaries                                                  | Import parsers, services and tests                                               |
| [`../support/LIMITATIONS-AND-NON-GOALS.md`](../support/LIMITATIONS-AND-NON-GOALS.md)                 | Explicit non-goals/limitations                                                 | Current scope and implementation evidence                                        |
| [`../hci/CS114-EVIDENCE-CHECKLIST.md`](../hci/CS114-EVIDENCE-CHECKLIST.md)                           | CS114 theme/accessibility/screens/HCI evidence plan                            | Current UI framework + rubric evidence requirements                              |

## 2. Ownership and Licensing Position

YsabelleStore contains two distinct classes of software:

| Class                             | Treatment                                                                                                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **YsabelleStore-authored code**   | Project source, internal APIs, schema, migrations, domain logic, forecasting orchestration, application tests, packaging configuration and project tooling. A third-party dependency license does not automatically apply to this code. |
| **Third-party software/services** | Libraries, runtimes, build tools, open-source components and hosted providers remain governed by their own licenses/terms. Required notices and obligations must be preserved and verified against the exact release dependency set.    |

The npm root and application workspaces are marked `private`. No document in this directory should be interpreted as silently relicensing the entire repository under MIT or another dependency license.

A project-level root `LICENSE.md` should be created only if the project owners intentionally choose a license for **YsabelleStore-authored source code**. Third-party attribution alone is not a reason to apply Tailwind's MIT license to the entire repository.

## 3. Verification State Model

| State                         | Meaning                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Verified**                  | Exact component/version and license/behavior evidence was checked against authoritative upstream or committed resolved metadata.   |
| **Declared**                  | Component is present in a committed manifest/configuration, but exact resolved release evidence has not yet been archived locally. |
| **Runtime-confirmed**         | Component/service is present in executable configuration/source and forms part of the supported runtime.                           |
| **Configured capability**     | Configuration/code exists but target-artifact/runtime acceptance is still required.                                                |
| **Development-only**          | Tool/service is supported only for development, test or QA workflows.                                                              |
| **Pending release review**    | Must be rechecked against the exact distributable/SBOM before formal public/commercial distribution.                               |
| **Unsupported / not claimed** | The repository does not currently establish official support for the environment, platform or capability.                          |

Do not upgrade a component, platform, accessibility property or deployment state to **Verified** by assumption.

## 4. Current Primary UI / HCI Evidence

The primary UI styling framework declared by the frontend is Tailwind CSS. The committed lockfile resolves Tailwind CSS **3.4.19**, and the verified upstream release license is MIT with copyright held by Tailwind Labs, Inc.

Local evidence:

- [`../licenses/TAILWIND-CSS-LICENSE.md`](../licenses/TAILWIND-CSS-LICENSE.md)
- [`OPEN-SOURCE-ATTRIBUTION.md`](OPEN-SOURCE-ATTRIBUTION.md)
- [`../../THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)
- [`../hci/CS114-EVIDENCE-CHECKLIST.md`](../hci/CS114-EVIDENCE-CHECKLIST.md)

For academic/UI-HCI evidence, screenshots should show the authoritative upstream license page and the repository attribution block. The preserved local copy supports traceability but does not replace personal upstream verification.

## 5. Full-Stack Compliance Boundary

The compliance scope covers more than the selected UI framework:

| Layer                                 | Compliance Treatment                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Frontend/UI libraries                 | npm manifests/lockfile + third-party notice/inventory                                          |
| Backend libraries                     | npm manifests/lockfile + third-party notice/inventory                                          |
| Electron/build tooling                | npm manifests + builder config + release review                                                |
| Python forecasting/image dependencies | Requirements/component register; exact version freeze required for formal reproducible release |
| MySQL                                 | External database runtime with its own license/distribution terms                              |
| Internal APIs/models                  | Project-authored; documented as architecture/domain components, not third-party APIs           |
| Hosted services                       | Provider terms/credentials/privacy boundaries; not redistributed library licenses              |
| Installer                             | Third-party tooling + project packaging configuration; artifact-level review required          |

The repository's human-readable notices are **not a generated SBOM**. Formal public/commercial distribution should generate or otherwise capture the exact release component/license set from the final artifact/dependency graph.

## 6. External Services Are Not Dependency Licenses

Hosted providers such as Resend, Gmail SMTP, Google OAuth, and Facebook/Meta OAuth/Graph API are integration/service boundaries. They are not redistributed npm/Python libraries simply because the application calls them. Their provider terms, credential handling, privacy/security responsibilities, and availability boundaries are tracked in [`EXTERNAL-SERVICES-REGISTER.md`](EXTERNAL-SERVICES-REGISTER.md).

## 7. Internal APIs, Data Models and Forecasting Are Project Components

YsabelleStore's Express routes, controllers, services, validators, health endpoints, inventory/POS/storefront APIs, Prisma domain model, and forecasting orchestration are project-authored components built using third-party frameworks. They should not be labeled as third-party APIs/products.

The thesis forecasting workflow is an internal service using `statsmodels` and related Python dependencies. The current policy includes constrained monthly SARIMA candidates, finite-AIC selection, seasonal-naive fallback, moving-average fallback, evaluation metrics, persistence and backend/process integration. `statsmodels` remains a third-party statistical dependency; the YsabelleStore orchestration/policy and application integration remain project implementation.

## 8. Evidence Precedence

When documentation disagrees, use this precedence for implemented behavior and dependency facts:

1. Current executable source and runtime/package configuration.
2. Committed lockfiles, schema, migrations and tests.
3. Exact-version authoritative upstream license/terms evidence.
4. Current CI/build/package configuration and produced artifact evidence.
5. Current project scope and subsystem contracts.
6. Current sprint status/plans.
7. Historical planning/sprint evidence.

A historical document must not override a current lockfile, source file or executable configuration.

## 9. Release Compliance Checklist

Before a formal distributable release:

- [ ] Run dependency/security audits against the exact release branch/head.
- [ ] Freeze or otherwise record exact Python dependency versions used to build/test the release.
- [ ] Generate/capture an exact software-component inventory/SBOM or equivalent license report for the distributable.
- [ ] Verify material direct/runtime dependency licenses against exact resolved versions.
- [ ] Preserve required copyright/license notices in the release where applicable.
- [ ] Review GSAP and any other component with non-standard or special distribution terms for the intended release model.
- [ ] Confirm external-service production credentials are supplied only through approved secret storage/configuration.
- [ ] Confirm Windows installer/runtime packaging matches the documented support matrix and target-machine evidence.
- [ ] Run CI, workspace builds, forecast tests, security audits and release/status guardrails.
- [ ] Validate database backup/restore and rollback responsibilities for the deployment.
- [ ] Reconcile these compliance documents with any dependency/service changes since the previous review.
- [ ] Complete manual HCI/accessibility evidence before making accessibility/submission claims.

## 10. Current Known Release Gaps

The canonical list of known release/evidence gaps is maintained in [`FINAL-DOCUMENTATION-AUDIT.md`](FINAL-DOCUMENTATION-AUDIT.md). Key categories include upload-limit consistency, Electron version normalization, self-contained installer proof, Python dependency pinning, exact release SBOM/license evidence, branch governance, backup/restore proof, installer signing evidence, platform/browser support validation and accessibility measurements.

## 11. Maintenance Rule

Any pull request or sprint change that introduces/removes a material runtime dependency, API route, Prisma model, authentication mechanism, external provider, forecast model/policy, test gate, build/runtime technology or supported deployment target should update the corresponding register in the same change or explicitly document why no compliance/support change is required.
