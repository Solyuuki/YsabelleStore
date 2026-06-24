# Environment Variables

Environment variables must be explicit, validated, and documented. Secrets must never be committed to the repository.

## Environment File Strategy

| File                   | Commit? | Purpose                                               |
| ---------------------- | ------- | ----------------------------------------------------- |
| `.env.example`         | Yes     | Documents required variables with safe example values |
| `.env`                 | No      | Local developer configuration                         |
| `.env.test`            | No      | Local test database and test-only settings            |
| GitHub Actions secrets | No      | CI credentials if needed later                        |

## Required Variable Standards

| Variable                  | Owner  | Purpose                            | Example                                              |
| ------------------------- | ------ | ---------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`            | m2     | Prisma connection string for MySQL | `mysql://user:password@localhost:3306/ysabellestore` |
| `APP_ENV`                 | Shared | Runtime environment                | `development`                                        |
| `API_PORT`                | m2     | Express API port                   | `3001`                                               |
| `FORECASTING_PYTHON_PATH` | m3     | Python executable path when needed | `python`                                             |
| `FORECASTING_TIMEOUT_MS`  | m3     | SARIMA process timeout             | `30000`                                              |
| `ELECTRON_APP_NAME`       | m1     | Desktop app display name           | `YsabelleStore`                                      |

## Naming Rules

| Rule       | Requirement                                             |
| ---------- | ------------------------------------------------------- |
| Format     | Uppercase snake case                                    |
| Prefix     | Use clear domain prefixes for module-specific variables |
| Secrets    | Never commit real passwords, tokens, or private keys    |
| Validation | Application startup must validate required variables    |

## Good vs Bad Examples

| Good Example             | Bad Example               |
| ------------------------ | ------------------------- |
| `DATABASE_URL`           | `db`                      |
| `FORECASTING_TIMEOUT_MS` | `timeout`                 |
| `API_PORT`               | `port_number_for_backend` |
| `ELECTRON_APP_NAME`      | `Name`                    |

## Validation Checklist

- [ ] Required variables are listed in `.env.example`
- [ ] Runtime code validates missing variables before starting
- [ ] Secrets are excluded by `.gitignore`
- [ ] CI variables are configured through GitHub secrets when needed
- [ ] Environment names match this document exactly
