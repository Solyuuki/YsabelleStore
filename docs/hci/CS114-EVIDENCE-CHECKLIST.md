# CS114 HCI Evidence Checklist — YsabelleStore

> **Project baseline:** `sprint/v0.10/sprint-10`  
> **Selected primary UI framework:** Tailwind CSS 3.4.19  
> **License:** MIT  
> **Purpose:** prepare a complete, evidence-backed submission package without claiming measurements that have not been personally verified.

## 1. Theme Declaration

| Required Item             | YsabelleStore Evidence                                                                                                                        | Status                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Theme/library name        | Tailwind CSS                                                                                                                                  | Ready                                                                  |
| Exact version             | 3.4.19 resolved in committed lockfile                                                                                                         | Ready                                                                  |
| License type              | MIT                                                                                                                                           | Ready                                                                  |
| Official repository       | Tailwind Labs `tailwindcss` upstream repository                                                                                               | Ready for citation/screenshot                                          |
| Official LICENSE evidence | Upstream `v3.4.19` LICENSE; local preserved copy at `docs/licenses/TAILWIND-CSS-LICENSE.md`                                                   | **Student must capture authoritative screenshot**                      |
| Repository attribution    | `THIRD_PARTY_NOTICES.md`, `docs/compliance/OPEN-SOURCE-ATTRIBUTION.md`, root README/compliance links                                          | Ready; capture screenshot from running/repository evidence as required |
| Modification statement    | Project customizes configuration, utility usage and application styles; Tailwind library source itself is not represented as project-authored | Ready                                                                  |

### Important submission rule

The required license screenshot should come from the **authoritative Tailwind upstream repository/version**, not only from the locally preserved copy. The local file supports traceability; it does not replace the student's personal verification evidence.

## 2. Design Direction and Rationale Evidence

Primary direction for documentation: **Minimal / Neutral**, implemented through Tailwind CSS utilities and project-specific design tokens/components.

The final 300–500 word rationale should explicitly cover:

| Rationale Element      | YsabelleStore-Specific Content to Explain                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named user groups      | Store Owner, Staff/Cashier, and customer/storefront users where relevant                                                                                                                                                        |
| Device/context         | Windows desktop/internal operations; customer-facing browser/storefront where applicable                                                                                                                                        |
| Work environment       | Retail setting with repetitive inventory/POS tasks, operational time pressure and mixed technical expertise                                                                                                                     |
| Primary task needs     | Fast recognition, clear stock/status visibility, low-friction transaction flows, reliable error/recovery feedback                                                                                                               |
| Why Tailwind           | Consistent utility-driven styling, reusable component patterns, responsive control, design-token discipline and compatibility with existing React stack                                                                         |
| Alternative considered | At least one rubric-approved direction/library should be explicitly considered and rejected for a concrete reason, e.g. a heavier data-dense/component framework could increase visual/system complexity for current task flows |
| HCI connection         | Visibility of system status, feedback, recognition over recall, error prevention, graceful recovery and clear hierarchy                                                                                                         |

Do not write the rationale as aesthetic preference alone. Tie each design decision to users, tasks, operating context, and interaction risk.

## 3. Mini Style Guide Evidence

The one-page style guide should be derived from actual Sprint 10 theme/configuration and rendered UI. Record final values only after checking the current frontend source.

| Style Guide Section      | Required Evidence                                              |
| ------------------------ | -------------------------------------------------------------- |
| Primary color role       | Actual project token/value + purpose                           |
| Surface/background roles | Actual project token/value + purpose                           |
| Text roles               | Primary/secondary/muted text values                            |
| Success role             | Color + icon/text/label secondary cue                          |
| Warning role             | Color + icon/text/label secondary cue                          |
| Error role               | Color + icon/text/label secondary cue                          |
| Typography               | Actual family/weights and coherent type scale                  |
| Spacing                  | One documented spacing unit/system and representative mappings |
| Border radius            | Actual radius scale/pattern                                    |
| Focus state              | Visible keyboard-focus treatment                               |
| Component states         | Default, hover, focus, active and disabled examples            |

Avoid unexplained one-off values. Where possible, point to theme tokens/configuration rather than isolated hardcoded values.

## 4. Accessibility Measurement Worksheet

### Contrast

Use a named tool such as **WebAIM Contrast Checker**, browser DevTools accessibility tools, axe DevTools, or Lighthouse. Record the tool used for every submitted measurement set.

| UI Element / Token Pair | Foreground | Background | Measured Ratio | Requirement                                     | Tool        | Pass?    |
| ----------------------- | ---------- | ---------- | -------------: | ----------------------------------------------- | ----------- | -------- |
| Primary body text       | _measure_  | _measure_  |      _measure_ | ≥ 4.5:1                                         | _name tool_ | _verify_ |
| Secondary text          | _measure_  | _measure_  |      _measure_ | ≥ 4.5:1 unless qualifying large text            | _name tool_ | _verify_ |
| Primary button text     | _measure_  | _measure_  |      _measure_ | ≥ 4.5:1                                         | _name tool_ | _verify_ |
| Error/status text       | _measure_  | _measure_  |      _measure_ | ≥ 4.5:1                                         | _name tool_ | _verify_ |
| Focus/UI boundary       | _measure_  | _measure_  |      _measure_ | ≥ 3:1 for applicable non-text UI/focus contrast | _name tool_ | _verify_ |

Do **not** place estimated or AI-generated ratios in the final submission. Use measured values from the actual rendered system.

### Touch / Click Targets

| Representative Control | Screen    | Width × Height | Meets 44×44 px Target? | Evidence            |
| ---------------------- | --------- | -------------: | ---------------------- | ------------------- |
| Primary action button  | _capture_ |      _measure_ | _verify_               | DevTools/screenshot |
| Navigation item        | _capture_ |      _measure_ | _verify_               | DevTools/screenshot |
| Icon-only action       | _capture_ |      _measure_ | _verify_               | DevTools/screenshot |
| Form submit/action     | _capture_ |      _measure_ | _verify_               | DevTools/screenshot |

### Keyboard / Focus

Verify at minimum:

- logical Tab order;
- visible focus indication;
- Enter/Space activation for applicable controls;
- modal/dialog focus behavior where applicable;
- no keyboard trap in tested workflows;
- form errors can be reached/understood without mouse-only interaction.

Record the exact screens/workflows tested.

### Non-Color Status Cues

Every color-coded status should also expose a secondary cue such as text label, icon, shape, pattern, or explicit message. Representative areas to check include stock status, system health, warnings/errors, success confirmations, order/restock states and validation feedback.

## 5. Required Screen Capture Set

At least four distinct screens/states are required. For YsabelleStore, a strong evidence set is:

| Capture        | Recommended Screen/State                                               | HCI Evidence to Annotate                                        |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Screen 1       | Owner Dashboard                                                        | Hierarchy, visibility of system status, recognition over recall |
| Screen 2       | POS / checkout workflow                                                | Primary-task emphasis, feedback, error prevention               |
| Screen 3       | Inventory / Restock / Forecast operational screen                      | Data hierarchy, actionable statuses, decision support           |
| Screen 4       | Customer storefront/account or another distinct operational role/state | Consistency and task-oriented navigation                        |
| Required state | Error, empty, offline, degraded, validation-error, or no-data state    | Graceful recovery and explicit system feedback                  |

If one of the first four is already a valid error/empty state, it can satisfy the required state requirement; otherwise capture an additional state.

### Screenshot Quality Rules

- Use the actual running Sprint 10 system.
- Keep text legible at PDF size.
- Avoid cropped evidence that removes navigation/context needed to understand the task.
- Add captions identifying screen, role, task and HCI principle demonstrated.
- Do not use mockups as proof of implemented behavior if the running system exists.

## 6. HCI Principle Annotation Matrix

| Principle                   | YsabelleStore Evidence Candidates                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Visibility of system status | Health/reliability state, loading/progress, inventory/restock/order statuses                   |
| Clear feedback              | POS completion, form validation, save/update confirmations, import preview/results             |
| Recognition over recall     | Persistent navigation, labeled actions, visible product/status information                     |
| Error prevention            | Validation, role restrictions, preview-before-confirm imports, owner-controlled approval flows |
| Graceful recovery           | Error/empty/offline/degraded states, retry/recovery guidance, safe error messages              |
| Consistency                 | Shared Tailwind/component patterns, repeated status/action styles, spacing/type hierarchy      |
| User control                | Cancel/back/retry, dismiss/resolve controls, explicit approval actions                         |
| Hierarchy                   | Primary actions and operational alerts visually prioritized over secondary information         |

Use screenshots/annotations to show these principles rather than only describing them in prose.

## 7. Attribution Block Evidence

The submission should include a screenshot of the repository/system attribution area. Current repository evidence includes:

- `THIRD_PARTY_NOTICES.md`
- `docs/compliance/OPEN-SOURCE-ATTRIBUTION.md`
- `docs/licenses/TAILWIND-CSS-LICENSE.md`
- root `README.md` compliance section

Recommended final attribution wording should identify Tailwind CSS, exact version, MIT license, upstream source, and project customization boundary without implying that the entire YsabelleStore repository is MIT-licensed.

## 8. Documentation / PDF Structure

Use six clearly separated sections matching the rubric:

1. **Theme Declaration** — name, version, license, official repository, LICENSE screenshot.
2. **Design Rationale** — 300–500 words, user/context/task-driven, includes rejected alternative.
3. **Mini Style Guide** — one-page color/type/spacing/radius/state guide.
4. **Accessibility Report** — contrast table, touch targets, keyboard/focus, non-color cues, named tools.
5. **Screens and HCI Annotations** — 4+ distinct screens/states with at least one error/empty state.
6. **Attribution and Repository/System Evidence** — attribution screenshot and repository/running-system link.

## 9. Rubric Risk Checklist

| Risk                                        | Prevention                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Paid/proprietary/unlicensed theme deduction | Use Tailwind CSS 3.4.19 MIT as the declared primary UI framework                                 |
| No LICENSE screenshot                       | Capture authoritative Tailwind v3.4.19 LICENSE page personally                                   |
| Fewer than four screens                     | Capture at least four distinct implemented screens/states                                        |
| No error/empty state                        | Include an implemented error/empty/offline/degraded/validation state                             |
| Contrast claimed without named tool         | Record exact measurement tool and actual measured ratios                                         |
| Missing attribution in system/repository    | Capture existing attribution/compliance block; ensure it remains visible in repo/system evidence |
| Weak rationale                              | Name users, device/context, task pressure/expertise and rejected alternative                     |
| Color-only statuses                         | Verify text/icon/other secondary cue for every submitted status example                          |
| Missing interaction states                  | Show/describe default, hover, focus, active and disabled behavior                                |
| Unsupported accessibility claim             | Submit only measurements personally verified in the actual rendered system                       |

## 10. Evidence Status Before Final PDF

| Deliverable              | Engineering/Repo Preparation     | Student Evidence Still Required                           |
| ------------------------ | -------------------------------- | --------------------------------------------------------- |
| Theme declaration        | Ready                            | Upstream LICENSE screenshot                               |
| Rationale foundation     | Ready                            | Final 300–500 word student-owned explanation/review       |
| Style guide              | Source available                 | Extract/confirm actual tokens and compose one-page visual |
| Accessibility report     | Checklist ready                  | Run tools and record measured results                     |
| Screens                  | Running implementation available | Capture 4+ legible screens including error/empty          |
| HCI annotations          | Principle map ready              | Annotate chosen screenshots                               |
| Attribution              | Repository notices ready         | Capture final screenshot                                  |
| Running system/repo link | Repository available             | Insert exact submission link(s)                           |

## 11. Related Engineering Records

- [`../compliance/FINAL-DOCUMENTATION-AUDIT.md`](../compliance/FINAL-DOCUMENTATION-AUDIT.md)
- [`../compliance/OPEN-SOURCE-ATTRIBUTION.md`](../compliance/OPEN-SOURCE-ATTRIBUTION.md)
- [`../licenses/TAILWIND-CSS-LICENSE.md`](../licenses/TAILWIND-CSS-LICENSE.md)
- [`../../SYSTEM_SUPPORT_MATRIX.md`](../../SYSTEM_SUPPORT_MATRIX.md)
- [`../security/SECURITY-CONTROLS-REGISTER.md`](../security/SECURITY-CONTROLS-REGISTER.md)
- [`../../testing/TEST-AND-QA-REGISTER.md`](../../testing/TEST-AND-QA-REGISTER.md)
- [`../../deployment/RELEASE-VERIFICATION-MATRIX.md`](../../deployment/RELEASE-VERIFICATION-MATRIX.md)

## Final Rule

The final PDF should report **measured, observed and captured evidence**, not inferred compliance. Repository documentation can explain the intended/current implementation, but accessibility scores, contrast ratios, target sizes and screenshots must come from the actual tested interface.
