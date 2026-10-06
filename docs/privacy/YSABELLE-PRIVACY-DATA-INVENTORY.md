# Ysabelle Store Privacy Data Inventory

Status: implementation baseline for Sprint 11 privacy surfaces  
Primary jurisdiction: Philippines  
Primary legal framework: Republic Act No. 10173 (Data Privacy Act of 2012) and applicable National Privacy Commission issuances.

This document records what the repository currently processes so the public privacy notice remains tied to system behavior instead of generic template language.

## 1. Customer identity and account data

Verified in `database/prisma/schema.prisma`:

- name
- username
- email
- phone
- default contact phone
- normalized phone
- email / phone verification timestamps
- password hash
- account status
- account creation / update timestamps

Purpose in the current system:

- account registration and profile management
- password and OTP authentication
- email verification
- account recovery
- session management
- account moderation and support

## 2. Authentication, verification and browser security state

Verified cookie behavior:

| Mechanism                              | Current purpose                             | Current duration / behavior                            |
| -------------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| `ysabelle_customer_session`            | authenticated customer session              | cookie max age 7 days; revocable                       |
| registration email grant               | registration verification                   | 10-minute OTP/grant lifetime                           |
| password setup grant                   | password setup verification                 | 10-minute grant lifetime                               |
| recovery grant                         | password recovery verification              | 10-minute grant lifetime                               |
| session-revoke grant                   | verification before revoking other sessions | 10-minute grant lifetime                               |
| OAuth binding/link state               | safe social-auth callback binding           | 10 minutes                                             |
| `ysabelle_customer_remembered_browser` | remembered-account browser credential       | cookie max age 365 days; database trust window 30 days |

Customer cookies are configured HttpOnly and SameSite=Lax, with Secure enabled in production where implemented.

Database security records include:

- hashed session / browser / grant tokens where applicable
- expiration, revocation and last-used timestamps
- remembered authentication method and trusted-until timestamp
- social provider identity references
- moderation audit records

## 3. Browser device storage

Current customer storefront storage:

| Key                                   | Technology     | Data / purpose                                                                       |
| ------------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| `ysabelle:guest-cart:v1`              | localStorage   | guest cart products and quantities; cleared after merge/sign-in or manual cart clear |
| `ysabelle:storefront:recent-searches` | localStorage   | up to five recent search terms; customer can clear them                              |
| `ysabelle:pending-favorite`           | localStorage   | pending product favorite intent before sign-in                                       |
| `ysabelle-store-entrance-entered`     | sessionStorage | prevents the entrance experience repeating in the same tab session                   |
| `ysabelle:privacy-notice-version`     | localStorage   | records that the informational privacy notice for the current version was dismissed  |

The storefront code audited for this baseline does not initialize Google Analytics, gtag, Meta Pixel, or another advertising / behavioral analytics tracker.

## 4. Orders, delivery and commerce

Current customer order records include:

- customer account reference
- customer name, email and phone
- order and delivery ticket numbers
- cart/order items
- payment method and status
- delivery status
- courier provider/reference when present
- delivery notes
- delivery timestamps
- amounts
- order notes
- delivery address snapshot

Saved delivery address fields include:

- address lines
- barangay
- city / municipality
- province / region
- postal code
- country

## 5. Payments

The PayMongo integration currently:

- creates/reuses checkout sessions
- sends billing name and email when present
- sends order line items
- sends order reference
- sends internal order and customer-account references in checkout metadata
- stores PayMongo checkout/payment identifiers and status for reconciliation

The application does not contain a Ysabelle-hosted card form that stores full card numbers or CVVs. Payment credentials are entered with the payment provider.

At the audited revision, the PayMongo service is restricted to test secret keys. Production privacy copy must be rechecked when live payment credentials/configuration are enabled.

## 6. Social sign-in

Configured integrations can include:

### Google

Current OAuth scope:

- `openid`
- `email`
- `profile`

The application validates the Google subject, verified email, and name needed for account creation/linking.

### Facebook

Current OAuth request:

- `public_profile`
- `email`

The application uses provider subject, name and email needed for account creation/linking.

## 7. Email delivery

Customer identity/security emails may be sent through:

- Resend in configured production flows
- Gmail SMTP in configured development flows

Email purposes implemented:

- registration verification
- authentication
- password setup
- password recovery
- session security verification

Do not claim a production provider is active unless production configuration confirms it.

## 8. Reviews and moderation

Current review data includes:

- reviewer display name
- rating
- comment
- product reference
- customer account reference when available
- verified order reference when available
- visibility/moderation status
- moderation reason, moderator and timestamp

Customer moderation audit records keep:

- actor
- customer/review reference
- action
- previous/next state
- reason
- timestamp

## 9. Customer support

Support ticket data includes:

- customer name
- email
- optional phone
- category and subject
- support message body
- optional linked order
- ticket reference
- Gmail message/thread identifiers when Gmail support is configured
- delivery status/error metadata
- created/read/replied/resolved/closed timestamps

The support UI instructs customers not to send passwords, OTPs, full card numbers or CVVs.

Privacy-rights requests currently use the existing support workflow. Public guidance instructs the requester to choose Account or Other and place `Privacy Request` in the subject.

## 10. Forecasting and AI decision assistance

The forecasting subsystem is product/sales/inventory focused.

The optional AI recommender evidence is currently limited to product/inventory evidence such as:

- product name
- SKU
- sellable stock
- incoming stock
- expiry-risk quantity
- recommendation/risk level
- recommended quantity
- deterministic rationale

When configured, this evidence may be sent to Cloudflare AI or Groq. Customer account identity is not part of the current recommender evidence contract.

The current forecasting/recommender flow is therefore not described as customer profiling or customer eligibility scoring.

## 11. Public processors / external service categories currently reflected

The public privacy page names integrations that are present in repository code and can process customer-related data when enabled:

- PayMongo — checkout/payment processing
- Google — social sign-in and Gmail support mailbox
- Facebook — social sign-in
- Resend — identity/security email delivery

Cloudflare AI / Groq are described only in the automated inventory decision section because their current evidence contract contains product/inventory evidence rather than customer account data.

## 12. Lawful-purpose baseline

The public notice does not force one lawful basis onto every operation.

Depending on the actual activity, processing may rely on:

- steps requested before a transaction / performance of a transaction
- legal obligations
- legitimate interests, including account security, moderation and abuse prevention
- consent where consent is legally required for a separate optional purpose

A privacy notice is not treated as a blanket agreement.

## 13. Retention status

Repository code enforces short lifetimes for several security grants and session/browser credentials, as documented above.

The application does **not** currently encode one blanket deletion period for all account, order, review, support, and moderation records. The public notice therefore does not invent a fixed period.

### Pre-deployment governance action

Before production sign-off, the business owner / privacy lead should approve a written retention schedule for:

- customer accounts after closure/deletion request
- orders and payment-reconciliation records
- saved addresses vs order address snapshots
- reviews/moderation audits
- customer-support tickets and Gmail copies
- security/audit records

The approved periods should be checked against applicable accounting, tax, consumer, legal-claim, and privacy requirements before they are converted into automated deletion/anonymization rules.

## 14. Privacy UI behavior

Implemented direction:

- no forced `I agree` checkbox for the general privacy notice
- no fake Accept/Reject advertising-cookie choice while no such tracker is configured
- versioned informational notice
- dedicated `/privacy` page
- detailed cookies/device-storage sheet
- persistent footer links to privacy and privacy-request support
- responsive and reduced-motion-aware UI

If optional analytics, advertising or another consent-dependent tracker is introduced later:

1. update this inventory;
2. determine the lawful basis;
3. add an actual preference category;
4. prevent initialization before the required choice;
5. version the privacy notice/policy;
6. add automated tests proving rejected/disabled optional processing does not execute.
