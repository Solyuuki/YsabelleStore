# Electron Architecture

This document defines the desktop application architecture for YsabelleStore.

## Desktop Architecture Diagram

```text
Electron Main Process
  -> Preload Script
  -> Secure IPC Boundary
  -> React Renderer Process
  -> Express Backend Communication
  -> Local MySQL Database through Backend and Prisma
```

## Desktop Components

| Component | Responsibility |
| --- | --- |
| Electron Main Process | Controls application windows, lifecycle, and packaging behavior |
| Preload Script | Safely exposes approved desktop APIs to the renderer |
| Secure IPC | Allows controlled communication between renderer and Electron main process |
| Renderer Process | Runs the React frontend UI |
| Express Backend Communication | Provides API access for products, sales, inventory, forecasts, and recommendations |
| electron-builder | Produces Windows `.exe` package when the system is ready |

## Security Rules

| Rule | Requirement |
| --- | --- |
| Main process separation | Keep lifecycle and native desktop behavior out of React components |
| Preload safety | Expose only approved functions through preload |
| IPC safety | Use explicit channels and validate payloads |
| Node exposure | Do not expose unsafe Node APIs to the frontend |
| Backend access | Renderer communicates through approved service calls |

## Deployment Model

| Area | Decision |
| --- | --- |
| Server model | No cloud server |
| Hosting model | No web hosting |
| Deployment style | Offline-first local desktop deployment |
| Database | Local MySQL Community Server |
| Package target | Windows `.exe` using electron-builder |

## Good vs Bad Desktop Design

| Good | Bad |
| --- | --- |
| React calls backend APIs through service modules | React directly reads local files or database tables |
| Preload exposes narrow IPC functions | Preload exposes unrestricted Node access |
| Packaging settings are reviewed before release | Release build is created without validation |
| Local deployment assumptions are documented | App secretly depends on a cloud server |

## Electron Validation Checklist

- [ ] Main, preload, and renderer responsibilities are separated
- [ ] IPC channels are explicit and validated
- [ ] Renderer does not receive unsafe Node access
- [ ] Development and production startup behavior are documented
- [ ] Windows `.exe` packaging remains part of the release plan

