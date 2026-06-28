# m3 Blockers

## Active Blockers

| Blocker ID | Related Task | Description          | Impact | Owner | Status | Resolution                        |
| ---------- | ------------ | -------------------- | ------ | ----- | ------ | --------------------------------- |
| None       | None         | No active m3 blocker | None   | m3    | Clear  | Continue validation and PR review |

## Watch Items

| Watch ID   | Related Area      | Description                                                     | Response                                        |
| ---------- | ----------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| WCH-M3-001 | MySQL environment | Local build and Prisma validation require a safe `DATABASE_URL` | Use validation URL documented in Sprint Review  |
| WCH-M3-002 | Forecasting       | SARIMA execution still depends on later sales data flow         | Keep forecasting out of Sprint 1 implementation |

## Blocker Severity

| Severity | Meaning                               | Response                       |
| -------- | ------------------------------------- | ------------------------------ |
| Low      | Documentation or local setup issue    | Record note and continue       |
| Medium   | Data contract uncertainty             | Coordinate with affected owner |
| High     | Schema or migration cannot be trusted | Stop merge until resolved      |
