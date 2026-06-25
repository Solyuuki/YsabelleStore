# Application Configuration

## Purpose

This document defines the shared application metadata and runtime defaults used across the YsabelleStore repository.

## Scope

- Application identity
- Desktop metadata
- Window defaults
- Forecast-related defaults
- Build metadata

## Application Metadata

| Setting             | Value                                       | Purpose                      |
| ------------------- | ------------------------------------------- | ---------------------------- |
| Application Name    | YsabelleStore                               | Shared project name          |
| Application Version | Repository version label                    | Align docs and releases      |
| Desktop Name        | YsabelleStore                               | Windows desktop identity     |
| Organization        | YsabelleStore thesis project                | Repository ownership context |
| Project Metadata    | Thesis-grade local desktop inventory system | High-level identity          |

## Window Defaults

| Setting        | Value | Purpose                  |
| -------------- | ----- | ------------------------ |
| Width          | 1280  | Standard desktop width   |
| Height         | 800   | Standard desktop height  |
| Minimum Width  | 1024  | Prevents unusable layout |
| Minimum Height | 720   | Prevents unusable layout |

## Forecast Settings

| Setting                   | Value                              | Purpose                         |
| ------------------------- | ---------------------------------- | ------------------------------- |
| Forecast horizon default  | Defined by forecasting layer later | Keep forecast length consistent |
| Forecast output directory | `forecasting-service/outputs/`     | Store generated artifacts       |
| Forecast metadata         | Included in output files           | Support traceability            |

## Build Metadata

| Setting             | Purpose                            |
| ------------------- | ---------------------------------- |
| App identifier      | Package and installer identity     |
| Product name        | Installer and Windows display name |
| Build output folder | Release artifact location          |
| Packaging target    | Windows installer workflow         |

## Future Implementation Notes

- Keep shared metadata stable across layers.
- Prefer a single source of truth for names and defaults.
- Update build metadata before release packaging changes.

## Validation Checklist

- [x] Application identity is documented
- [x] Window defaults are documented
- [x] Forecast-related defaults are documented
- [x] Build metadata is documented
