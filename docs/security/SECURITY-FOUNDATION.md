# Security Foundation

YsabelleStore is an offline-first desktop inventory system. The security foundation protects local store data without making daily staff workflows heavy or confusing.

## Security Goals

| Goal            | Practical Standard                                                                 |
| --------------- | ---------------------------------------------------------------------------------- |
| Data protection | Keep inventory, sales, forecasts, recommendations, and user data local and guarded |
| Safe access     | Use simple future local login and role checks                                      |
| Input safety    | Validate forms, route inputs, and import files before accepting data               |
| Secret handling | Keep secrets in environment files that are not committed                           |
| Error safety    | Return safe messages and keep technical details internal                           |
| Staff usability | Avoid security patterns that slow normal store operations without clear benefit    |

## System Security Map

```text
React frontend
  -> typed API client
  -> Express security middleware
  -> future validation layer
  -> future Prisma/MySQL access
  -> local data storage

Electron shell
  -> secure IPC boundary
  -> local desktop runtime

Forecasting service
  -> validated input files and records
  -> generated forecast outputs
```

## Decision Matrix

| Security Area  | Foundation Decision     | Reason                                               |
| -------------- | ----------------------- | ---------------------------------------------------- |
| Authentication | Future local login only | Offline-first and simple for store staff             |
| Authorization  | Future Admin/User roles | Enough for store ownership and staff access          |
| Tokens         | Future JWT access token | Works with local backend and desktop renderer        |
| Cloud identity | Not planned             | The system must work without internet dependency     |
| File imports   | Preview before commit   | Prevents bad CSV/Excel data from entering records    |
| Error details  | Internal logs only      | Prevents leaking secrets, paths, or database details |

## Good vs Bad Examples

| Good                                | Bad                                                   |
| ----------------------------------- | ----------------------------------------------------- |
| Validate CSV rows before saving     | Write imported rows directly to the database          |
| Keep `JWT_SECRET` in `.env`         | Hardcode secrets in source files                      |
| Return `Invalid request` to users   | Return stack traces to the frontend                   |
| Use simple roles                    | Add complex permissions before business modules exist |
| Log technical errors on the backend | Show database connection strings in UI errors         |

## Foundation Checklist

- [x] Security docs are centralized under `docs/security`
- [x] Backend security headers are available
- [x] Future rate-limit policy is documented through middleware
- [x] Authentication is documented but not implemented
- [x] Import safety is documented but parser logic is not implemented
- [x] Audit logging is planned but not implemented
