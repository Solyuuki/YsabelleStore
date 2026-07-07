# Sprint 3 Risk Plan

Sprint 3 has more integration risk than the earlier shell-based work because product, inventory, sales, forecasting,
and reports all depend on each other.

| Risk                                       | Impact                            | Mitigation                                                    |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------- |
| SARIMA depends on clean sales/product data | Forecasting may be blocked        | M2 and M3 coordinate data format early                        |
| POS depends on product/inventory APIs      | POS may stay static               | M1 and M3 define API contract early                           |
| UI cleanup may consume too much time       | Core logic may be delayed         | M1 limits UI work to spacing/alignment and integration polish |
| Merge conflicts across fullstack modules   | Sprint 3 integration may fail     | M1 owns merge conflict handling                               |
| M2/M3 branches may overlap                 | Broken integration risk           | Keep module boundaries clear and document shared files        |
| Fake completion risk                       | Thesis progress may be overstated | Docs must label shell/foundation vs complete features clearly |

## Risk Notes

| Area                       | Notes                                                                            |
| -------------------------- | -------------------------------------------------------------------------------- |
| Product and inventory data | Data must remain stable enough for both POS lookup and forecasting input         |
| Sales summaries            | Aggregation shape should be agreed before UI work expands                        |
| Reports                    | Reports should remain a consumer of structured data, not an invented data source |
| Integration                | M1 should coordinate branch merges instead of waiting until the end              |
