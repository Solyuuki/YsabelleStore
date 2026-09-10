# YsabelleStore Auth Access and Customer Login Design

## Decision

Implement authentication work in this order:

1. Separate public customer navigation from the internal Staff/Owner entry.
2. Upgrade the customer credential model and customer login/register flow.
3. Use the accepted customer auth visual language to re-theme the Staff/Owner login without removing any internal auth capability.
4. Add Quick Sign In providers as independent integrations: Google, then Facebook, then Phone OTP.
5. Extend customer profile/security and shipping-address verification when the delivery workflow is implemented.

The separation work comes first because it is small, testable, and removes the current public Staff/Owner discovery path without touching the mature internal authentication engine. The customer authentication upgrade comes second because it changes persistence, validation, services, forms, and account data.

## Current Architecture

### Customer realm

- Public routes: `/`, `/shop`, `/login`, `/register`, `/account`, cart and checkout routes.
- Frontend state: `CustomerAuthProvider`.
- Backend routes: `/api/customer-auth/*` and `/api/customer-account/*`.
- Persistence: `CustomerAccount` and `CustomerSession`.
- Session mechanism: HttpOnly customer session cookie.
- Current credentials: email + password; phone is optional profile data.

### Internal realm

- Entry route: `/staff-login`.
- Frontend state: `AuthProvider`.
- Backend routes: `/api/auth/*`.
- Persistence: `User` and `TrustedDevice`.
- Session mechanism: internal JWT plus separate trusted-device token.
- Roles: `OWNER` and `STAFF` with route-level authorization.
- Existing capabilities to preserve: known accounts, trusted-device continuation, forget device, use another account, password login, health status, role-based dashboard routing, owner-managed staff account creation, and rate limiting.

## Target Access Boundary

The e-commerce storefront must not advertise or link to internal Staff/Owner access. `CustomerHeader`, customer login/register pages, customer mobile navigation, and future public footer/navigation must not expose `/staff-login` or equivalent admin copy.

The direct internal route remains valid for authorized store users. In local development it remains accessible directly at `/staff-login`. Production deployment can later map the internal entry to a dedicated admin host, LAN entry, or Electron/desktop shortcut without changing the underlying internal auth engine.

Route hiding is not treated as a security control. Internal security continues to rely on authentication, rate limiting, trusted-device lifecycle, JWT validation, account status, and OWNER/STAFF authorization.

## Customer Credential Direction

The first functional customer-auth upgrade uses one identifier field:

`Username, email or mobile number`

and a password field.

Registration will collect:

- full name;
- unique username;
- email address;
- optional mobile number initially;
- password;
- confirm password on the client.

Email remains required in this phase so existing account recovery and customer identity assumptions do not need to become nullable at the same time. Mobile numbers become normalized and unique when present so they can safely act as login identifiers. Phone verification is not required to browse, create an account, or place pickup orders.

Customer login resolution must never reveal whether a submitted identifier matched a username, email, or phone number. Invalid credentials return one generic response.

## Quick Sign In Direction

Quick Sign In is a later subsystem, not decorative UI. No Google, Facebook, or Phone OTP button should be rendered as a fake/nonfunctional control.

Providers will be introduced independently after the baseline identifier/password flow is accepted:

1. Google customer sign-in/account linking.
2. Facebook customer sign-in/account linking.
3. Phone OTP sign-in with rate limiting, expiry, replay resistance, and a selected SMS provider.

Provider identities must belong to the customer realm only. They must never authenticate `User` OWNER/STAFF accounts.

## Verification Direction

No government-ID/KYC flow is required for ordinary grocery retail.

Contact verification is separate from identity verification:

- email verification can be added as an account-security signal;
- phone verification can be required before the first delivery/shipping order if delivery requires a reachable contact;
- pickup and ordinary browsing should remain low-friction.

Verified/unverified state belongs in Account Security/Profile, not as a storefront-wide blocker.

## Shared Brand, Separate Purpose

Customer and internal login experiences should look like one YsabelleStore product family: same logo, typography, purple/blue/pink palette, spacing system, radius language, focus states, and motion principles.

They should not be identical in content:

- Customer login is retail-friendly and optimized for account creation and quick sign-in.
- Staff/Owner login is operational and preserves known accounts, trusted-device status, internal health information, and OWNER/STAFF access semantics.
- Green/amber/red remain semantic status colors only; emerald must no longer be the internal product's primary brand identity.

## Non-Goals

- Do not merge `CustomerAccount` and `User`.
- Do not replace the Staff/Owner auth engine with customer auth.
- Do not use a secret URL or query-string key as the primary admin security control.
- Do not remove trusted-device, known-account, role authorization, or owner-managed staff creation.
- Do not add nonfunctional social-login buttons.
- Do not implement shipping-address storage in the same change as login separation.

## Acceptance Order

### Gate 1 — Public/Internal separation

- No public customer UI links to `/staff-login`.
- Direct `/staff-login` still works.
- Unauthenticated internal routes still redirect to `/staff-login`.
- Existing OWNER/STAFF auth and trusted-device behavior remains unchanged.

### Gate 2 — Customer credential baseline

- Customer can register with name, username, email, optional phone, and password.
- Customer can sign in with username, email, or normalized phone plus password.
- Existing session cookie behavior is preserved.
- Generic invalid-credential behavior prevents identifier enumeration.
- New customer login/register UI matches the storefront brand and has no Staff/Owner entry.

### Gate 3 — Internal visual alignment

- Staff/Owner page uses the shared Ysabelle brand palette and auth-shell language.
- Known accounts, trusted devices, health state, validation, role badges, and internal redirects remain functional.

### Gate 4 — Quick Sign In

Each provider is accepted separately with backend tests, frontend tests, failure-state handling, account-linking rules, and manual QA before the next provider is added.
