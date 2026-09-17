# External Services Register

> **Baseline:** `sprint/v0.10/sprint-10`

This register distinguishes externally hosted providers from project-authored APIs and bundled open-source dependencies.

## Service Matrix

| Provider / Service                | Purpose                                            | Environment             | Required Configuration                   | Data / Security Boundary                                                                                  | Availability Dependency                    |
| --------------------------------- | -------------------------------------------------- | ----------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Resend                            | Customer email, OTP and password-recovery delivery | Production-configured   | `RESEND_API_KEY`, sender address         | Credentials must remain secrets; outbound email data is sent to provider                                  | Internet/provider availability required    |
| Gmail SMTP                        | Registration/login OTP QA delivery                 | Development only        | Gmail account + Google App Password      | Development sender credentials only; never commit secrets                                                 | Internet/Google SMTP availability required |
| Google OAuth                      | Customer social authentication                     | Configurable deployment | Client ID and client secret              | OAuth state/transaction controls are handled by backend; provider identity data crosses external boundary | Internet/Google identity service required  |
| Facebook / Meta OAuth + Graph API | Customer social authentication                     | Configurable deployment | App ID, app secret, graph API version    | OAuth state/transaction controls are handled by backend; provider identity data crosses external boundary | Internet/Meta platform required            |
| GitHub Actions                    | CI validation                                      | Repository CI           | Workflow configuration and GitHub runner | CI uses test-only DB/JWT/OAuth placeholder secrets in workflow environment                                | GitHub CI service required for hosted CI   |

## Internal APIs Are Not External Services

The following are YsabelleStore-owned backend interfaces and must not be described as external APIs: authentication, customer account/authentication, dashboard, forecast, historical sales, health, product/catalog, POS, inventory, restock, sales, search and storefront route groups.

## Secret Management Rules

1. Real provider credentials must not be committed.
2. `.env.example` contains placeholders only and documents required variable names.
3. Deployment secrets must be supplied through the local/host secret environment.
4. Logs and public error responses must not expose tokens, passwords, API keys or provider secrets.
5. OAuth transaction/state secrets must meet the application's configured minimum security expectations.

## Current Environment Variables of Interest

| Variable                                                | Service / Purpose                                |
| ------------------------------------------------------- | ------------------------------------------------ |
| `RESEND_API_KEY`                                        | Resend API access                                |
| `CUSTOMER_RECOVERY_FROM_EMAIL`                          | Customer recovery sender identity                |
| `CUSTOMER_DEV_GMAIL_SMTP_USER`                          | Development Gmail sender                         |
| `CUSTOMER_DEV_GMAIL_SMTP_APP_PASSWORD`                  | Development Gmail App Password                   |
| `CUSTOMER_OAUTH_PUBLIC_BACKEND_URL`                     | Public backend URL used by OAuth flows           |
| `CUSTOMER_OAUTH_TRANSACTION_KEY`                        | Backend OAuth transaction protection             |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth                                     |
| `FACEBOOK_OAUTH_APP_ID` / `FACEBOOK_OAUTH_APP_SECRET`   | Meta OAuth                                       |
| `FACEBOOK_GRAPH_API_VERSION`                            | Meta Graph API version; example baseline `v26.0` |

## Operational Classification

External service configuration does not make YsabelleStore cloud-hosted. The current application deployment model remains local/offline-first for core operations, while specific optional/authentication/communication features may require network access to their providers.
