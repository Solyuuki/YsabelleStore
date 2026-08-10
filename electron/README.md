# Electron Foundation

This folder contains the desktop shell foundation for YsabelleStore. It is intentionally limited to Electron runtime setup and security boundaries, not business features.

## Role In The Architecture

| Layer        | Responsibility                                                        |
| ------------ | --------------------------------------------------------------------- |
| Main process | Owns app lifecycle, window creation, and production loading behavior  |
| Preload      | Exposes a narrow, safe bridge into the renderer                       |
| IPC          | Defines the allowed message surface between renderer and main process |
| Renderer     | Hosts the React app and stays free of direct Node or database access  |

## Folder Structure

```text
electron/
├── src/
│   ├── config/
│   ├── ipc/
│   ├── main/
│   ├── preload/
│   ├── security/
│   └── types/
├── README.md
├── .env.example
└── electron-builder.config.cjs
```

## Responsibilities

### Main Process

- Creates and manages the Electron window
- Loads the renderer in development from a local Vite URL
- Loads the packaged renderer from `frontend/index.html` in production
- Applies safe window defaults
- Keeps desktop lifecycle logic out of the React app

### Preload

- Uses `contextBridge` only
- Exposes a frozen `window.ysabelleStore` API
- Does not expose `fs`, `path`, `ipcRenderer`, or other Node APIs directly
- Keeps the IPC contract narrow and explicit

### Renderer

- Runs the React frontend
- Talks to the preload bridge only
- Does not access the database directly
- Does not rely on Electron internals

## IPC Rules

- Channel names are namespaced through `ysabellestore:*`
- Only explicitly approved channels should be added to `electron/src/ipc/channels.ts`
- Renderer calls must be validated before being forwarded to Electron APIs
- Business handlers do not belong in the foundation layer

## Security Rules

- `contextIsolation` stays enabled
- `nodeIntegration` stays disabled
- `sandbox` is enabled where practical
- `remote` is not used
- Secrets are never hardcoded into the Electron layer
- Renderer code never receives direct database access

## Development Workflow

1. Run `npm run dev` at the repository root.
2. The root owner starts the backend, waits for health, starts Vite, waits for its URL, and only then
   starts the Electron shell.
3. The main process uses `ELECTRON_RENDERER_DEV_URL` when present and otherwise uses
   `http://localhost:5173` in development.
4. The window retains a bounded retry as a secondary recovery path, while normal startup uses the
   root readiness checks.
5. Electron never spawns a backend; its React renderer uses the same `VITE_API_BASE_URL` as the
   browser.
6. A packaged application loads the built renderer from `frontend/index.html`.
7. Ctrl+C at the root terminates the Electron process tree together with Vite and the backend.

## Production Packaging Plan

- Target Windows with `nsis`
- Package the Electron main and preload output from `electron/dist`
- Ship the renderer build from `frontend/dist`
- Keep the output folder under `electron/release`
- Do not run packaging as part of normal foundation validation

## Validation Commands

Run these from the repository root:

```bash
npm run lint
npm run build
npm audit --audit-level=high
```

For Electron-specific checks:

```bash
npm run build --workspace electron
npm run lint --workspace electron
npm run typecheck --workspace electron
```

## Notes

- This foundation is designed for future local-first desktop integration.
- No inventory, sales, forecasting, authentication, or database business logic is included here.
