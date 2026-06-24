# System Framework

This document defines the official framework stack for YsabelleStore before Sprint 1 implementation begins. The stack supports the core thesis flow:

```text
Sales Data
  -> SARIMA Forecast
  -> Inventory Recommendation
```

Any feature or framework that does not support this flow must be reviewed as possible scope creep.

## Official Framework Stack

| Layer | Framework/Tool | Purpose | Reason |
| --- | --- | --- | --- |
| Frontend | React | Build the desktop application's user interface | Modern, widely documented, component-based, and manageable for thesis development |
| Build Tool | Vite | Run and build the React frontend | Fast development server, simple configuration, and strong TypeScript support |
| Language | TypeScript | Add type safety to frontend and backend logic | Reduces runtime errors and improves maintainability |
| Styling | Tailwind CSS | Provide utility-first styling | Keeps UI consistent without heavy custom CSS |
| UI Components | shadcn/ui | Provide accessible component patterns | Supports professional dashboard UI without proprietary templates |
| Desktop | Electron | Package the system as a local desktop app | Enables Windows `.exe` deployment for store use |
| Backend | Node.js and Express.js | Provide local API and business logic layer | Lightweight, familiar, and appropriate for local desktop-backed services |
| ORM | Prisma | Manage database access and migrations | Type-safe database client and structured migration workflow |
| Database | MySQL Community Server | Store products, sales, inventory, batches, forecasts, recommendations, and audit records | Reliable relational database suitable for inventory data |
| Forecasting | Python 3.12+ and statsmodels SARIMA/SARIMAX | Generate seasonal demand forecasts from historical sales | Mature statistical tooling and explainable model behavior |
| Charts | Recharts | Display dashboards and analytics | React-friendly charting for thesis demonstrations |
| Fallback Charts | Chart.js | Support charts when Recharts is not suitable | Mature fallback for special chart needs |
| Validation | Zod | Validate frontend and backend data contracts | Clear schemas and predictable validation errors |
| Authentication | JWT | Secure user sessions | Simple token-based authentication for local app workflows |
| Code Quality | ESLint, Prettier, Husky | Enforce style and pre-commit quality gates | Keeps contributions consistent across members |
| Deployment | electron-builder | Build Windows desktop installer/package | Standard Electron packaging workflow |
| Development | Git, GitHub, npm, npx, GitHub Actions | Version control, dependency commands, and automation | Professional collaboration workflow |

## Thesis Suitability

| Quality | How the Stack Supports It |
| --- | --- |
| Modern | Uses current TypeScript, React, Prisma, Electron, and Python forecasting tools |
| Manageable | Separates UI, backend, database, forecasting, and desktop responsibilities |
| Deployable | Supports local Windows `.exe` packaging through Electron and electron-builder |
| Professional | Includes validation, code quality tools, GitHub workflow, and modular architecture |
| Avoids overengineering | Uses one local database, one backend API, one forecasting service, and one desktop shell |

## Scope Boundary

| Allowed | Not Allowed |
| --- | --- |
| Local desktop deployment | Cloud server deployment |
| MySQL Community Server | MongoDB |
| Express.js API | PHP or XAMPP stack |
| SARIMA demand forecasting | Supplier procurement automation |
| Inventory recommendations | Purchase orders or restock history module |
| Local app packaging | Web hosting |

## Framework Validation Checklist

- [ ] The selected tool directly supports the approved architecture
- [ ] The tool is compatible with local desktop deployment
- [ ] The tool does not introduce cloud-only requirements
- [ ] The tool supports the Sales Data -> SARIMA Forecast -> Inventory Recommendation flow
- [ ] The tool can be explained clearly during thesis defense

