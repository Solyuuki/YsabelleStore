# Frontend Foundation

The frontend folder contains the React, TypeScript, Vite, Tailwind CSS, and shadcn-ready foundation for YsabelleStore. It establishes the app shell, layout boundaries, route planning, environment validation, API client foundation, and coding conventions for future modules.

## Purpose

| Area        | Purpose                                    | Current Scope                     |
| ----------- | ------------------------------------------ | --------------------------------- |
| App shell   | Hosts the root React application structure | Foundation only                   |
| Layouts     | Defines reusable screen wrappers           | `AppLayout` and `AuthLayout` only |
| Routing     | Documents future route groups              | Planning metadata only            |
| API layer   | Provides a typed request wrapper           | No endpoint-specific calls        |
| Environment | Validates frontend runtime configuration   | Vite environment values only      |
| UI modules  | Reserves folders for future implementation | No feature pages                  |

## Folder Structure

```text
frontend/
|-- public/
|-- src/
|   |-- app/
|   |-- assets/
|   |-- components/
|   |-- hooks/
|   |-- layouts/
|   |-- lib/
|   |-- pages/
|   |-- schemas/
|   |-- services/
|   |-- styles/
|   |-- types/
|   |-- utils/
|   |-- App.tsx
|   `-- main.tsx
|-- .env.example
|-- package.json
`-- README.md
```

## Component Philosophy

| Component Type    | Rule                                                               | Example Location    |
| ----------------- | ------------------------------------------------------------------ | ------------------- |
| App shell         | Keep root composition lightweight                                  | `src/App.tsx`       |
| Shared components | Store reusable UI primitives and composed widgets                  | `src/components`    |
| Layout components | Own page frame structure only                                      | `src/layouts`       |
| Page components   | Add only when a feature is approved                                | `src/pages`         |
| Feature UI        | Keep feature-specific components close to approved feature folders | Future sprint scope |

## Layout Philosophy

| Layout       | Intended Future Use                     | Current Behavior                     |
| ------------ | --------------------------------------- | ------------------------------------ |
| `AppLayout`  | Authenticated desktop application shell | Provides a neutral app boundary      |
| `AuthLayout` | Authentication-related screens          | Provides a neutral centered boundary |

Layouts must not contain business logic, API calls, authentication decisions, or page-specific state.

## Routing Philosophy

Future routes are planned in `src/app/routes.ts` and remain inactive until their implementation phase.

| Future Group    | Planned Path       | Status  |
| --------------- | ------------------ | ------- |
| Authentication  | `/auth`            | Planned |
| Dashboard       | `/dashboard`       | Planned |
| Products        | `/products`        | Planned |
| Inventory       | `/inventory`       | Planned |
| Sales           | `/sales`           | Planned |
| Forecasts       | `/forecasts`       | Planned |
| Recommendations | `/recommendations` | Planned |
| Reports         | `/reports`         | Planned |
| Settings        | `/settings`        | Planned |

## API Layer Philosophy

| API Layer Item        | Responsibility                                                              |
| --------------------- | --------------------------------------------------------------------------- |
| `apiClient`           | Central request wrapper for future service modules                          |
| Request interceptors  | Reserved for future auth headers, tracing, and request normalization        |
| Response interceptors | Reserved for future error normalization and session handling                |
| Shared API types      | Keep frontend response expectations aligned with backend response contracts |
| Feature services      | Add endpoint-specific calls only during approved feature work               |

## Environment Setup

Create `frontend/.env` from `frontend/.env.example` for local development.

| Variable            | Purpose                     | Example                 |
| ------------------- | --------------------------- | ----------------------- |
| `VITE_APP_NAME`     | Display and metadata name   | `YsabelleStore`         |
| `VITE_APP_VERSION`  | Frontend release identifier | `0.1.0`                 |
| `VITE_API_BASE_URL` | Backend API base URL        | `http://localhost:3001` |

All runtime values exposed to Vite must use the `VITE_` prefix.

## UI Standards

| Item              | Convention                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| React components  | PascalCase file and export names                                            |
| Hooks             | `use` prefix with camelCase filenames                                       |
| Services          | camelCase files with clear domain names                                     |
| Utility functions | Small purpose-based functions in `src/utils` or shared helpers in `src/lib` |
| Shared types      | PascalCase type names in `src/types`                                        |
| Shared schemas    | Zod schemas in `src/schemas`                                                |
| Styling           | Tailwind utilities plus CSS variables in `src/styles/global.css`            |

## Coding Conventions

| Rule       | Standard                                                                   |
| ---------- | -------------------------------------------------------------------------- |
| TypeScript | Keep strict-friendly types and avoid implicit `any`                        |
| React      | Keep `App.tsx` lightweight and move structure into focused modules         |
| State      | Add state only when a real workflow requires it                            |
| API calls  | Keep endpoint calls inside services, never directly inside page components |
| Validation | Use Zod schemas for runtime validation when needed                         |
| Files      | Keep files focused and avoid broad catch-all modules                       |

## Future Roadmap

| Phase | Frontend Work                 | Entry Condition                                    |
| ----- | ----------------------------- | -------------------------------------------------- |
| 1     | Authentication UI             | Backend auth contract approved                     |
| 2     | Dashboard shell               | Navigation and dashboard requirements approved     |
| 3     | Product and inventory screens | Product and inventory APIs approved                |
| 4     | Sales and imports             | Sales schema and import rules approved             |
| 5     | Forecasts and recommendations | Forecasting and recommendation contracts approved  |
| 6     | Reports and settings          | Reporting requirements and settings scope approved |

## Validation Commands

```bash
npm run lint
npm run build
npm audit --audit-level=high
```

Frontend-only checks:

```bash
npm run lint --workspace frontend
npm run build --workspace frontend
npm run typecheck --workspace frontend
```

## Foundation Guardrails

- Do not implement login, dashboard, CRUD, charts, forecasting, recommendations, or reports during foundation work.
- Do not add endpoint-specific API calls until the matching feature module is approved.
- Do not hardcode backend URLs outside environment validation.
- Keep layout, route planning, services, schemas, and shared types separated.
- Keep future route groups planned but inactive until their implementation phase.
