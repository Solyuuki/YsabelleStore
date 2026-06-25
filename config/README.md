# Configuration Foundation

## Purpose

This folder defines the repository-wide configuration strategy for YsabelleStore. It gives every layer a shared way to document application settings, environment variables, constants, runtime values, metadata, and future feature switches.

## Scope

- Repository-wide configuration policy
- Layer-aware environment documentation
- Shared application constants
- Versioning and feature-flag guidance
- Configuration validation and maintenance rules

## Configuration Philosophy

| Principle            | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Centralized guidance | Keep one top-level source of truth for configuration decisions                              |
| Layer awareness      | Let each project layer define its own env example and runtime needs                         |
| No hardcoding        | Store secrets, ports, URLs, and toggles in environment-driven configuration where practical |
| Maintainability      | Keep configuration explicit, documented, and easy to review                                 |

## Repository Layers Covered

| Layer               | Configuration Concern                                           |
| ------------------- | --------------------------------------------------------------- |
| Frontend            | Vite environment variables and app metadata                     |
| Backend             | API port, JWT secret, and database connection settings          |
| Electron            | Desktop app metadata and renderer URL settings                  |
| Database            | Prisma connection and schema validation settings                |
| Forecasting Service | Python runtime, service paths, and forecasting support settings |
| Deployment          | Version labels, packaging settings, and release metadata        |

## Centralized Management

```text
Root config docs
  -> Layer-specific .env.example files
  -> Runtime validation
  -> Build and packaging settings
  -> Release/version policy
```

## Future Implementation Notes

- Keep repository-wide configuration decisions here.
- Keep layer-specific values in the matching workspace or service folder.
- Update docs when configuration changes so implementation and validation stay aligned.

## Validation Checklist

- [x] Repository-wide purpose is defined
- [x] Layer coverage is documented
- [x] Centralized strategy is explained
- [x] No runtime configuration code is added
