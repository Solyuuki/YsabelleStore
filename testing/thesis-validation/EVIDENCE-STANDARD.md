# Thesis Validation Evidence Standard

## Anti-Bias Procedure

For every controlled test:

1. define the expected result before execution;
2. define the pass criterion before execution;
3. run the test on the recorded commit;
4. capture the actual result without altering the criterion;
5. assign PASS, FAIL, BLOCKED, or NOT TESTED;
6. keep failed evidence instead of deleting it.

## Required Metadata

Each executed test must record:

| Field | Required |
| --- | --- |
| Test ID | Yes |
| Date/time | Yes |
| Git branch | Yes |
| Commit SHA | Yes |
| Environment | Yes |
| Test data / product / order reference | Yes |
| Precondition | Yes |
| Expected result | Yes |
| Actual result | Yes |
| Status | Yes |
| Evidence files | Yes |
| Notes / limitation | When applicable |

## Screenshot Pattern

For state-changing tests, prefer:

1. **Before**
2. **Action**
3. **After**
4. **Audit / reference**

Do not capture redundant screenshots solely to increase evidence count.

### Recommended File Naming

```
FT-05_POS_01_Action.png
IT-01_POS_Inventory_01_Before.png
IT-01_POS_Inventory_02_After.png
IT-01_POS_Inventory_03_StockActivity.png

IT-04_Receiving_Inventory_01_Before.png
IT-04_Receiving_Inventory_02_PartialReceipt.png
IT-04_Receiving_Inventory_03_After.png
```

## Numerical Proof

When the system changes quantities, write the expected computation explicitly.

### Sale

```
before_stock - quantity_sold = expected_after_stock
```

### Receiving

```
expected_delivery - accepted_delivery = remaining_delivery
before_stock + accepted_delivery = expected_after_stock
```

The Chapter 3 test result should show the numbers when they materially prove the behavior.

## Automated Evidence

When using repository tests or CI, preserve:

- exact command;
- test runner output;
- number of passed / failed tests;
- commit SHA;
- workflow run URL when CI is used;
- any generated artifact relevant to the test.

A historical green run is not evidence for a newer commit.

## Physical Hardware Limitation

If a device is unavailable, use the exact status `NOT TESTED - hardware unavailable` for physical compatibility.

A terminal or simulated software check may support a separate software-path PASS, but it does not convert the physical-device test into PASS.

## Chapter 3 Reporting

The final thesis table should summarize the strongest evidence. Raw screenshots, terminal logs, CSV files, and detailed calculations should be retained separately for traceability and defense.
