# Limitations and Non-Goals

> **Baseline:** `sprint/v0.10/sprint-10`

This document prevents capability overstatement by recording known boundaries of the current system and thesis method.

## Forecasting Limitations

| Limitation | Current Boundary |
| --- | --- |
| Historical depth | Forecasting service documentation states 24 monthly observations per product in the documented dataset context. |
| Seasonal cycles | Two annual seasonal cycles are represented by that 24-month context. |
| Low-volume products | SARIMA estimates may be unstable. |
| Confidence intervals | May be wide or unavailable for fallback forecasts. |
| Exogenous factors | Current forecast does not inherently model promotions, price changes, stockouts, supplier disruptions, lost demand or economic shocks. |
| Expiration | SARIMA does not forecast expiration dates. Expiry risk uses batch/inventory state, time and expected demand. |
| Model family | The approved thesis forecast remains SARIMA/SARIMAX-family unless research scope is formally changed. |

## Deployment Limitations

- Current packaging is Windows-focused through Electron Builder/NSIS.
- macOS and Linux packaged distributions are not currently verified/supported.
- Current deployment foundation is local/offline-first and does not include production cloud hosting.
- Auto-update and release publishing are outside the current deployment foundation.
- External email/OAuth features require provider/network availability even when core local workflows remain available.

## Data / Integration Limitations

- CSV/XLSX support is limited to implemented import contracts; arbitrary spreadsheet structures are not guaranteed.
- Presence of PDF/OCR libraries does not establish support for arbitrary documents or OCR workflows.
- External OAuth/email providers require valid deployment credentials and remain subject to provider terms/availability.
- Browser compatibility beyond the validated development/runtime environment must not be claimed without explicit cross-browser QA evidence.

## Replenishment Safety Boundary

Inventory recommendations are decision support. The system must not silently turn a recommendation into an external supplier purchase. If supplier/B2B integration is introduced later, owner approval is required before an external order is sent unless the formally approved requirements are changed.

## Architecture Non-Goals

The current architecture explicitly avoids:

- A second application database that bypasses Prisma/MySQL.
- Direct frontend access to MySQL/Prisma.
- Embedding Python forecasting implementation inside Express route handlers.
- Introducing unrelated computer-vision/surveillance features outside the store problem.
- Treating historical planning documents as stronger evidence than current executable implementation.
- Representing future extensions as implemented without source, integration and verification evidence.

## Compliance / Release Limitations

- Python forecasting requirements are not pinned to exact versions in the committed requirements file; release-grade reproducibility requires an approved frozen set.
- A hand-maintained component inventory is not a substitute for a release-time generated SBOM/dependency-license report.
- Electron version declarations currently differ between the workspace manifest (`^42.5.0`) and Electron Builder config (`42.8.1`); release engineering should normalize or intentionally document this.
- License/provider terms can change; exact release dependencies and external-provider terms require final review.

## Documentation Rule

A limitation should be removed from this file only when current implementation and verification evidence demonstrate that the limitation is no longer applicable.