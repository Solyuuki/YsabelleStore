# Supported Environments

> **Baseline:** `sprint/v0.10/sprint-10`

## Production / Distribution Envelope

| Environment                        | Support Level                        | Evidence / Notes                                                               |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| Windows desktop                    | Primary supported packaging target   | Electron Builder config targets Windows NSIS.                                  |
| Local MySQL-backed operation       | Supported                            | Application persistence uses Prisma/MySQL.                                     |
| Local frontend/backend development | Supported                            | Default endpoints are Vite `:5173` and backend `:3001`.                        |
| Packaged Electron renderer         | Supported by CORS/config boundary    | `.env.example` includes packaged renderer `null` origin.                       |
| LAN-capable local deployment       | Within current product scope         | Requires environment/network configuration and deployment-specific validation. |
| macOS packaged app                 | Not officially supported             | No current packaging target/evidence.                                          |
| Linux packaged app                 | Not officially supported             | No current packaging target/evidence.                                          |
| Cloud-hosted production            | Not in current deployment foundation | Requires a separate approved architecture/deployment decision.                 |

## Runtime Baselines

| Runtime  | Baseline                                    |
| -------- | ------------------------------------------- |
| Node.js  | Root engine `>=20.11.0`; CI uses Node 22    |
| npm      | Root engine `>=10.0.0`                      |
| Python   | CI validation uses Python 3.12              |
| MySQL    | CI uses MySQL 8.0                           |
| Electron | Manifest `^42.5.0`; builder config `42.8.1` |

## Browser Support Policy

The web frontend is React/Vite-based, but the repository evidence reviewed for this register does not establish a formal Chrome/Edge/Firefox/Safari support matrix. Do not claim universal cross-browser support until explicit QA evidence exists. Browser development access is supported; named-browser production guarantees require testing.

## External-Network Requirements

Core local inventory/POS/database behavior is designed around the local deployment model. The following integrations require network/provider availability when enabled:

- Resend email delivery.
- Gmail SMTP development OTP QA.
- Google OAuth.
- Facebook/Meta OAuth and Graph API.
- Hosted GitHub Actions CI.

## Environment Configuration

Real secrets belong in local/host secret configuration and must not be committed. `.env.example` documents expected variable names and safe development placeholders.
