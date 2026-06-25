# Data Protection

YsabelleStore data is local-first. Protection focuses on preventing accidental exposure, bad imports, unsafe errors, and unauthorized local access.

## Data Classification

| Data Area              | Sensitivity | Protection Rule                                                |
| ---------------------- | ----------- | -------------------------------------------------------------- |
| User accounts          | High        | Hash passwords and restrict account access before auth release |
| Product data           | Medium      | Validate names, categories, pricing, and status changes        |
| Sales history          | High        | Protect because it reveals business performance                |
| Inventory records      | High        | Protect because stock levels affect operations                 |
| Batch expiration data  | Medium      | Validate dates and prevent accidental corruption               |
| Forecast results       | Medium      | Keep traceable to source sales data                            |
| Recommendation outputs | Medium      | Preserve reasoning and avoid silent overwrites                 |

## Local Desktop Protection

| Area              | Standard                                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| Environment files | Keep `.env` uncommitted and use `.env.example` only for safe examples        |
| Local database    | Use local credentials and avoid shared default passwords in real deployments |
| App logs          | Avoid secrets, tokens, passwords, database URLs, and imported raw files      |
| Backups           | Store backups in a controlled local folder chosen by the store owner         |
| Exports           | Future export files must be intentional and user-visible                     |

## Data Handling Workflow

```text
User action or import
  -> input validation
  -> safe controller handling
  -> future service rule checks
  -> future database transaction
  -> future audit event
```

## Minimum Release Gates

| Gate              | Required Before                        |
| ----------------- | -------------------------------------- |
| Password hashing  | Authentication release                 |
| Protected routes  | Business module release                |
| Import validation | CSV/Excel import release               |
| Audit trail       | Inventory adjustment and sales release |
| Backup guidance   | Desktop deployment release             |
