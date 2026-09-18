# YsabelleStore System Evaluation Questionnaire — PROPOSED

> **Status:** Proposed researcher-developed instrument. Adviser/panel approval is required before formal data collection.

## Basis

This questionnaire adapts the nine product-quality characteristics of **ISO/IEC 25010:2023** to the implemented YsabelleStore system. The item statements below are researcher-authored and are not copied verbatim from the ISO standard.

## Evaluator information

Record:
- anonymous evaluator ID/code;
- role/qualification;
- evaluation date;
- system version / Git commit used during evaluation.

## Rating scale

| Rating | Response |
| ---: | --- |
| 5 | Strongly Agree |
| 4 | Agree |
| 3 | Neither Agree nor Disagree |
| 2 | Disagree |
| 1 | Strongly Disagree |

For technical characteristics such as Maintainability, the evaluator should base the rating on the technical demonstration, documentation, test evidence, and repository review.

## Evaluation items

### Functional Suitability
- **FS1** — The system provides the functions needed for inventory monitoring, sales recording, forecasting, replenishment, receiving, reporting, e-commerce, and user management.
- **FS2** — The system produces correct quantities, totals, statuses, and transaction results for the tasks demonstrated.
- **FS3** — The available functions are appropriate for accomplishing the store's intended operational tasks.

### Performance Efficiency
- **PE1** — Pages, searches, and common actions respond within a reasonable time during normal use.
- **PE2** — Sales, receiving, forecast, restock, and report operations complete without unreasonable delay.
- **PE3** — The system can handle the store's expected product and transaction data without noticeable performance degradation.

### Compatibility
- **C1** — POS, Inventory, Receiving, Restock, Forecast, Reports, and related modules exchange data consistently.
- **C2** — Administrative and customer-facing functions use shared product, stock, and transaction information without conflicting records.
- **C3** — Supported import, export, and software interface pathways work with the system without disrupting core operations.

### Interaction Capability
- **IC1** — Navigation, labels, tables, forms, and screen organization are understandable to the intended users.
- **IC2** — Common tasks can be learned and performed with minimal guidance.
- **IC3** — Validation messages, confirmations, and error feedback help users avoid or correct mistakes.

### Reliability
- **R1** — The system behaves consistently when normal operations are repeated.
- **R2** — Completed transactions and inventory changes remain correctly stored and available after refresh or reopening.
- **R3** — Invalid or interrupted actions are handled without silently corrupting operational data.

### Security
- **SEC1** — Owner and Staff access restrictions protect functions according to their assigned roles.
- **SEC2** — Authentication and session controls help prevent unauthorized access to protected system functions.
- **SEC3** — Transaction references, histories, and stock activity records provide accountability and support data integrity.

### Maintainability
- **M1** — The system is organized into modules that can be diagnosed or modified without unnecessary changes to unrelated functions.
- **M2** — Automated tests and validation procedures support safe verification after changes are made.
- **M3** — Technical configuration, logs, references, and documentation make system issues traceable and maintainable.

### Flexibility
- **FL1** — Products, suppliers, stock levels, and related operational data can be changed without requiring source-code changes for routine updates.
- **FL2** — The system can accommodate changes in store operations through configurable data, rules, and workflows.
- **FL3** — The modular design and supported data exchange pathways allow reasonable future extension of the system.

### Safety
- **SA1** — Confirmations, validations, and access controls reduce the risk of accidental high-impact sales or inventory changes.
- **SA2** — Restock approval, receiving, stock adjustment, and sale completion follow controls that prevent silent or unintended stock changes.
- **SA3** — The system surfaces important errors or exceptional conditions so users can respond before operational data is adversely affected.

## Proposed scoring guide

This scoring guide must be approved **before** actual responses are collected.

| Mean range | Interpretation | Evaluation status |
| ---: | --- | --- |
| 4.20 to 5.00 | Strongly Agree / Highly Acceptable | Meets acceptance criterion |
| 3.40 to <4.20 | Agree / Acceptable | Meets acceptance criterion |
| 2.60 to <3.40 | Neither Agree nor Disagree / Needs Review | Below acceptance criterion |
| 1.80 to <2.60 | Disagree / Not Acceptable | Below acceptance criterion |
| 1.00 to <1.80 | Strongly Disagree / Not Acceptable | Below acceptance criterion |

**Proposed acceptance threshold:** 3.40.

Criterion means are computed from the numeric item ratings. The proposed overall score is the **mean of the criterion means**, giving each quality characteristic equal weight.

A criterion below 3.40 is retained as a real finding, corrected where appropriate, and re-evaluated. Evaluator ratings must never be altered to force a passing result.

## Response encoding

Use:

```text
respondent_id,criterion,item,rating
```

Use the exact criterion names and item codes above. Give every evaluator an anonymous unique ID such as `EVALUATOR_001`.

The number and qualifications of evaluators should follow the adviser/school requirement and must be documented in the thesis.

## Reference

International Organization for Standardization / International Electrotechnical Commission. **ISO/IEC 25010:2023**, *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model*.
