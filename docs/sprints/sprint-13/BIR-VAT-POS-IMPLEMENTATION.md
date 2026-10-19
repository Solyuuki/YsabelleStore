# Sprint 13 — BIR VAT Retail POS implementation (not release approved)

Primary BIR sources:

- [RMC 77-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024.pdf)
- [BIR VAT Invoice examples](https://orus.bir.gov.ph/files/RMC_No_77_2024_Annex_A1_B6.pdf)
- [EOPT Act, RA 11976](https://lawphil.net/statutes/repacts/ra2024/ra_11976_2024.html)

## Completed technical foundation (not yet live)

- VAT category on each product: UNCLASSIFIED, VATABLE, VAT_EXEMPT, ZERO_RATED. Existing catalog defaults to UNCLASSIFIED; never assume all groceries are standard-rated.
- Unclassified POS products fail validation **before inventory mutation**. **DO NOT deploy** until all POS-sellable products are correctly reviewed/classified with an authorized workflow.
- Prices are VAT inclusive: net = VATable gross / 1.12 rounded once at sale level; VAT = VATable gross - net. Checkout price, cash, and inventory flows remain unchanged. There is no active generic POS discount control or Discount label in Retail/Sales/print UI. The existing backend discount field stays at 0 for new POS sales; a nonzero amount recorded on a historical sale is displayed solely as a read-only "Historical adjustment" to preserve the original receipt arithmetic. No recorded transaction is rewritten.
- The sale stores VATable net, VAT amount, exempt gross, zero-rated gross and immutable per-line tax classification atomically with checkout. Retry/idempotent paths return the stored amounts.
- Legacy sales keep NULL tax snapshots (unknown); reprinting does not invent VAT figures.
- Desktop Sales, mobile Sales, and print transaction summary render the persisted VAT breakdown. The output is clearly **Transaction Summary / NOT A BIR-REGISTERED VAT INVOICE** until an authorized invoice issuance flow exists.

## Mandatory production-release and tax compliance blockers

1. Collect the actual BIR-registered legal seller name, VAT TIN and branch code, registered address, and registered/approved POS or invoicing-system details. **Never invent TIN, permit, ATP or approval.**
2. Implement registered invoice number series, issuance/void/reprint audit, buyer registered name/TIN/address capture where required, proper approved invoice format and serial range, and invoice archival. A POS sale number alone is NOT evidence of an approved invoice series.
3. Have the business/accountant classify all current products and review exemptions/zero-rated transactions. Add an authenticated category-approval workflow; no mass default VATable assignment.
4. Test approved BIR VAT Invoice against the registered form and confirm BIR registration/permission for the applicable CRM/POS/CAS environment with the appropriate authority.
5. Back up first; rehearse additive Prisma migration, rollback strategy, stock concurrency and invoice QA against a disposable environment. Never reset a production database.
6. Run exact-head CI, unit tests, printer testing, POS and Storefront concurrency, retry, and old-sale reprint evidence. Do not promote branch until gates are green and owner accepts.

This is for a real BIR-registered business; it is **not** represented as a thesis demonstration or authorized tax invoice. The production BIR invoice implementation is incomplete until the blockers above are satisfied.
