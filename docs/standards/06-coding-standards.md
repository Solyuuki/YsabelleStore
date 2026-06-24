# Coding Standards

These standards keep YsabelleStore maintainable, testable, and thesis-ready. They apply to all application code once development begins.

## Architecture Principles

| Principle | Requirement |
| --- | --- |
| Strict TypeScript | Frontend and backend TypeScript must avoid implicit `any` |
| Modular Architecture | Separate UI, API, database, forecasting, and recommendation responsibilities |
| Small Focused Modules | Prefer focused files with one clear responsibility |
| No Duplicate Logic | Extract shared logic into services, utilities, or validators |
| Proper Error Handling | Convert failures into clear user or API responses |
| Input Validation | Validate user input, imports, environment variables, and forecast requests |
| Separation of Concerns | UI must not contain database logic; backend must not contain UI logic |
| Maintainability First | Choose readable code over clever abstractions |
| Scalability Second | Design for growth without overengineering early thesis modules |

## React Standards

| Rule | Requirement |
| --- | --- |
| Components | Use typed props and focused component files |
| State | Keep local state local; move shared state only when needed |
| Forms | Validate input before submitting to backend services |
| Tables | Use stable keys and predictable empty states |
| UI Library | Use shadcn/ui patterns consistently |
| Styling | Use Tailwind CSS utility classes with readable grouping |

| Good Example | Bad Example |
| --- | --- |
| `function ProductTable({ products }: ProductTableProps)` | `function ProductTable(props: any)` |
| `useInventoryFilters()` | `filterStuff()` |

## TypeScript Standards

| Rule | Requirement |
| --- | --- |
| Types | Define explicit request, response, and domain types |
| Nullability | Handle `null` and `undefined` intentionally |
| Imports | Use clear module paths and avoid circular dependencies |
| Errors | Use typed error helpers when shared behavior exists |

## Express Standards

| Rule | Requirement |
| --- | --- |
| Routes | Route files define endpoints and delegate logic |
| Controllers | Controllers translate HTTP requests into service calls |
| Services | Services contain business rules |
| Validators | Validators reject invalid input before service execution |
| Responses | Use consistent status codes and response shapes |

| Good Example | Bad Example |
| --- | --- |
| `inventory.routes.ts -> inventory.controller.ts -> inventory.service.ts` | All endpoint logic inside one route callback |
| Return `400` for invalid quantity | Save invalid quantity and fix later |

## Prisma Standards

| Rule | Requirement |
| --- | --- |
| Models | Use descriptive singular model names |
| Migrations | One migration should represent one coherent database change |
| Relations | Define explicit relations and constraints |
| Transactions | Use transactions for multi-step inventory updates |
| Data Integrity | Prevent negative stock and invalid expiration dates |

## Electron Standards

| Rule | Requirement |
| --- | --- |
| Main Process | Keep desktop lifecycle logic in Electron-owned files |
| Preload | Expose only approved APIs to the renderer |
| Security | Disable unsafe renderer access patterns |
| Packaging | Package through `electron-builder` only after validation |

## Python SARIMA Standards

| Rule | Requirement |
| --- | --- |
| Input | Validate date range, product identifier, and sales history length |
| Model | Use statsmodels SARIMA implementation |
| Output | Return structured forecast data and confidence metadata |
| Failure Handling | Return clear failure reason for insufficient or invalid data |
| Integration | Keep Python forecasting isolated from Express route handling |

## Folder Rules

| Rule | Requirement |
| --- | --- |
| UI files | Stay inside frontend folder |
| API files | Stay inside backend folder |
| Forecasting files | Stay inside forecasting folder |
| Database files | Stay inside Prisma folder |
| Shared contracts | Must be approved by affected owners |

## File Rules

| Rule | Requirement |
| --- | --- |
| File size | Split files when responsibilities become mixed |
| Exports | Prefer named exports for shared modules |
| Comments | Explain why, not obvious what |
| Generated files | Commit only when required by project tooling |

## Validation Rules

| Input Type | Validation |
| --- | --- |
| Product data | Required name, valid price, valid status |
| Sales data | Positive quantity, valid date, existing product |
| Inventory batch | Non-negative stock, valid expiration date |
| Imports | Header validation, row validation, error report |
| Forecast request | Sufficient history and valid forecast horizon |

## Error Handling Rules

| Layer | Rule |
| --- | --- |
| Frontend | Show clear recoverable messages |
| Express | Return consistent JSON error responses |
| Prisma | Catch known database errors and map them safely |
| Python | Return structured failure output instead of crashing silently |
| Electron | Log packaging/runtime failures clearly |

## Testing Rules

| Test Area | Required Coverage |
| --- | --- |
| Validators | Valid and invalid input cases |
| Services | Business rules and edge cases |
| Prisma | Migration and relation correctness |
| Forecasting | Insufficient history, seasonal data, failure paths |
| UI | Important forms, tables, and alert states |
| Packaging | Electron build smoke test before release |

## Completion Checklist

- [ ] Code follows ownership rules
- [ ] TypeScript has no avoidable `any`
- [ ] Inputs are validated before use
- [ ] Errors are handled at the correct layer
- [ ] Tests or documented validation evidence are provided
- [ ] No unrelated files are modified

