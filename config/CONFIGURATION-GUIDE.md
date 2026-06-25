# Configuration Guide

## Purpose

This guide explains where configuration belongs in YsabelleStore and how it should evolve over time.

## Scope

- Configuration ownership
- Hardcode avoidance
- Layer responsibilities
- Growth path for future settings

## Where Configuration Belongs

| Configuration Type           | Location                                                             |
| ---------------------------- | -------------------------------------------------------------------- |
| Frontend env values          | `frontend/.env.example`                                              |
| Backend env values           | `backend/.env.example`                                               |
| Database env values          | `database/.env.example`                                              |
| Electron env values          | `electron/.env.example`                                              |
| Forecasting service settings | `forecasting-service/config/` docs and future service-specific files |
| Deployment policy            | `deployment/` docs                                                   |
| Repository-wide strategy     | `config/` docs                                                       |

## What Must Never Be Hardcoded

- Secrets
- Local database credentials
- Service URLs meant to change by environment
- Ports that differ across development and production
- Desktop app metadata that should remain versioned or centralized
- Feature toggles that may change during thesis evolution

## How Configuration Should Evolve

| Phase          | Expectation                                                         |
| -------------- | ------------------------------------------------------------------- |
| Foundation     | Document the configuration model and required variables             |
| Implementation | Add runtime validation and layer-specific usage                     |
| Integration    | Align backend, Electron, frontend, and forecasting service settings |
| Release        | Lock versioned defaults and verify packaging behavior               |

## Layer Responsibilities

| Layer               | Responsibility                                                                     |
| ------------------- | ---------------------------------------------------------------------------------- |
| Frontend            | Consume validated environment values only                                          |
| Backend             | Own server runtime, secret handling, and database connection settings              |
| Electron            | Own desktop metadata, renderer URL behavior, and safe runtime bridge configuration |
| Database            | Own Prisma connection expectations and validation inputs                           |
| Forecasting Service | Own service-specific runtime paths and dependency settings                         |
| Deployment          | Own release-oriented configuration and version policy                              |

## Future Implementation Notes

- Configuration should be explicit before runtime behavior is added.
- Environment variables should be validated close to the layer that uses them.
- Shared values should be documented once and reused consistently.

## Validation Checklist

- [x] Configuration locations are defined
- [x] Hardcoded values are discouraged
- [x] Layer responsibilities are clear
- [x] Growth path is documented
