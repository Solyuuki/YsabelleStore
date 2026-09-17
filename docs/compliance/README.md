# YsabelleStore Compliance Documentation Index

> **Baseline:** `sprint/v0.10/sprint-10`
>
> This directory is the navigation and governance entry point for YsabelleStore software-component, open-source, external-service, architecture, runtime, and support documentation. It is an engineering compliance record. It does **not** grant a blanket open-source license to YsabelleStore-authored source code.

## 1. Documentation Map

| Document | Scope | Primary Evidence |
| --- | --- | --- |
| [`../../THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) | Human-readable third-party software/service notices | Package manifests, lockfile, requirements, runtime configuration |
| [`../../SYSTEM_TECHNOLOGY_REGISTER.md`](../../SYSTEM_TECHNOLOGY_REGISTER.md) | Full-stack technology register | Frontend/backend/electron manifests, forecasting requirements, CI/runtime config |
| [`../../SYSTEM_SUPPORT_MATRIX.md`](../../SYSTEM_SUPPORT_MATRIX.md) | Supported and unsupported system boundaries | Current source/configuration/tests/deployment files |
| [`OPEN-SOURCE-ATTRIBUTION.md`](OPEN-SOURCE-ATTRIBUTION.md) | Open-source attribution policy and primary UI-library declaration | Exact dependency/upstream license evidence |
| [`SOFTWARE-COMPONENT-INVENTORY.md`](SOFTWARE-COMPONENT-INVENTORY.md) | Material software component inventory | Direct dependencies and material runtime/build components |
| [`EXTERNAL-SERVICES-REGISTER.md`](EXTERNAL-SERVICES-REGISTER.md) | Hosted providers and external integration boundaries | `.env.example`, auth/email integration source/config |
| [`ARCHITECTURE-AND-RUNTIME-DISCLOSURE.md`](ARCHITECTURE-AND-RUNTIME-DISCLOSURE.md) | Project-authored vs third-party runtime responsibilities | Canonical architecture, manifests, service boundaries |
| [`../licenses/README.md`](../licenses/README.md) | Preserved license-evidence index | Authoritative upstream license text/version evidence |
| [`../support/SUPPORTED-ENVIRONMENTS.md`](../support/SUPPORTED-ENVIRONMENTS.md) | Environment/runtime support | Build/deployment/CI configuration |
| [`../support/SUPPORTED-FEATURES.md`](../support/SUPPORTED-FEATURES.md) | Product capability support | Source/schema/tests and current scope |
| [`../support/SUPPORTED-DATA-FORMATS.md`](../support/SUPPORTED-DATA-FORMATS.md) | Data/import/export boundaries | Import parsers, services and tests |
| [`../support/LIMITATIONS-AND-NON-GOALS.md`](../support/LIMITATIONS-AND-NON-GOALS.md) | Explicit non-goals/limitations | Current scope and implementation evidence |

## 2. Ownership and Licensing Position

YsabelleStore contains two distinct classes of software:

| Class | Treatment |
| --- | --- |
| **YsabelleStore-authored code** | Project source, internal APIs, schema, migrations, domain logic, forecasting orchestration, application tests, packaging configuration and project tooling. A third-party dependency license does not automatically apply to this code. |
| **Third-party software/services** | Libraries, runtimes, build tools, open-source components and hosted providers remain governed by their own licenses/terms. Required notices and obligations must be preserved and verified against the exact release dependency set. |

The npm root and application workspaces are marked `private`. No document in this directory should be interpreted as silently relicensing the entire repository under MIT or another dependency license.

## 3. Verification State Model

Use the following labels when maintaining compliance records:

| State | Meaning |
| --- | --- |
| **Verified** | Exact component/version and license/terms evidence was checked against an authoritative source or committed resolved metadata. |
| **Declared** | Component is present in a committed manifest/configuration, but exact resolved license evidence has not yet been archived locally. |
| **Runtime-confirmed** | Component/service is present in executable configuration/source and forms part of the supported runtime. |
| **Development-only** | Tool/service is supported only for development, test or QA workflows. |
| **Pending release review** | Must be rechecked against the exact distributable/SBOM before formal public/commercial distribution. |
| **Unsupported / not claimed** | The repository does not currently establish official support for the environment, platform or capability. |

Do not upgrade a component to **Verified** by assumption.

## 4. Current Primary UI / HCI Evidence

The primary UI styling framework declared by the frontend is Tailwind CSS. The committed lockfile resolves Tailwind CSS **3.4.19**, and the upstream `v3.4.19` license is MIT with copyright held by Tailwind Labs, Inc.

Local evidence:

- [`../licenses/TAILWIND-CSS-LICENSE.md`](../licenses/TAILWIND-CSS-LICENSE.md)
- [`OPEN-SOURCE-ATTRIBUTION.md`](OPEN-SOURCE-ATTRIBUTION.md)
- [`../../THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)

For academic/UI-HCI evidence, screenshots should show the authoritative upstream license page and the repository attribution block; the preserved local copy supports traceability but does not replace the upstream source.

## 5. External Services Are Not Dependency Licenses

Hosted providers such as Resend, Gmail SMTP, Google OAuth, and Facebook/Meta OAuth/Graph API are integration/service boundaries. They are not redistributed npm/Python libraries simply because the application calls them. Their provider terms, credential handling, privacy/security responsibilities, and availability boundaries are tracked in [`EXTERNAL-SERVICES-REGISTER.md`](EXTERNAL-SERVICES-REGISTER.md).

## 6. Internal APIs and Forecasting Are Project Components

YsabelleStore's Express routes, controllers, services, validators, health endpoints, inventory/POS/storefront APIs, and forecasting-service orchestration are project-authored components built using third-party frameworks. They should not be labeled as third-party APIs.

Likewise, the thesis forecasting workflow is an internal service using `statsmodels` and related Python dependencies. The current forecasting policy includes constrained monthly SARIMA candidates, finite-AIC selection, seasonal-naive fallback, moving-average fallback, evaluation metrics, and backend/process integration. `statsmodels` remains a third-party statistical dependency; the YsabelleStore orchestration/policy and application integration remain project implementation.

## 7. Evidence Precedence

When compliance documentation disagrees with another repository document, use this precedence for implemented behavior and dependency facts:

1. Current executable source and package/runtime configuration.
2. Committed lockfiles, schema, migrations and tests.
3. Exact-version authoritative upstream license/terms evidence.
4. Current project scope and subsystem contracts.
5. Current sprint status/plans.
6. Historical planning/sprint evidence.

A historical document must not override a current lockfile, source file or executable configuration.

## 8. Release Compliance Checklist

Before a formal distributable release:

- [ ] Run dependency/security audits against the exact release branch/head.
- [ ] Freeze or otherwise record exact Python dependency versions used to build/test the release.
- [ ] Generate or capture an exact software-component inventory/SBOM for the distributable.
- [ ] Verify material direct/runtime dependency licenses against exact resolved versions.
- [ ] Preserve required copyright/license notices in the release where applicable.
- [ ] Review GSAP and any other component with distribution terms that require special attention for the intended release model.
- [ ] Confirm external-service production credentials are supplied only through approved secret storage/configuration.
- [ ] Confirm Windows installer/runtime packaging matches the documented support matrix.
- [ ] Run CI, workspace builds, forecast tests, security audits and release/status guardrails.
- [ ] Reconcile these compliance documents with any dependency/service changes since the previous review.

## 9. Maintenance Rule

Any pull request or sprint change that introduces/removes a material runtime dependency, external provider, build/runtime technology, or supported deployment target should update the appropriate register in the same change or explicitly document why no compliance/support change is required.
