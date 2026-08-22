# Customer Authentication Design

## Goal

Add a production-ready public customer account system to YsabelleStore while preserving the existing guest storefront and keeping customer authentication strictly isolated from OWNER/STAFF internal access.

## Approved Product Model

YsabelleStore will support both:

- Guest shopping and guest checkout.
- Optional customer accounts for customers who want saved identity and account-linked order history.

Customer accounts are public e-commerce identities. They are not internal system users and must never inherit OWNER or STAFF privileges.

## Current Baseline

The current Sprint 7 baseline already has:

- Internal OWNER/STAFF authentication and protected internal routes.
- A public customer storefront with Home, Shop, Product Detail, Cart, Checkout, and Order Success routes.
- Guest checkout that accepts customer contact details and creates a pickup order.

The baseline does not have:

- Customer registration.
- Customer sign-in/sign-out.
- Customer sessions.
- Customer account/profile UI.
- Account-linked order history.
- Customer-specific authorization middleware.
- A customer identity relationship on storefront orders.

## Architecture

### Identity separation

Keep internal and public identities separated by trust boundary.

Internal identity remains responsible for OWNER/STAFF application access. Public customer identity is a separate account model and authentication path used only by the storefront.

A customer credential must never be accepted by internal OWNER/STAFF authorization middleware. Internal JWT/session handling and customer JWT/session handling may reuse low-level cryptographic utilities where appropriate, but their claims, guards, routes, and authorization rules must remain distinguishable and independently testable.

### Customer account model

Introduce a dedicated customer account entity with at least:

- stable account id
- normalized unique email
- password hash
- display/full name
- optional phone
- active/disabled status
- created/updated timestamps

Storefront orders should gain an optional customer-account relationship. The relationship is nullable so guest orders continue to work.

Do not migrate guest orders into accounts automatically unless a deterministic, explicitly approved linking rule exists. Historical guest orders remain guest orders by default.

### Customer authentication API

Add a customer-specific authentication surface, separate from internal `/api/auth` behavior. The exact route prefix should follow existing repository conventions, with intended capabilities equivalent to:

- register
- login
- me/session restore
- logout

Authentication errors exposed to public clients must avoid account enumeration. Invalid email and invalid password should produce the same public credential error.

Registration must reject duplicate normalized email addresses without leaking internal details.

### Session model

Use a customer-specific authenticated session/token that can be validated independently from internal OWNER/STAFF sessions.

Requirements:

- finite expiry
- server-side validation of customer active status
- invalid/expired session rejection
- logout behavior with a clear documented guarantee
- no customer token accepted by internal role middleware
- no internal token accepted as a customer account session unless explicitly intended and tested

The implementation plan must inspect the current deployment/runtime constraints before locking the browser storage mechanism. Existing localStorage usage for internal auth must not be copied automatically without a security decision.

### Storefront behavior

Guest behavior remains supported:

`Browse -> Cart -> Guest Checkout -> Order Success`

Authenticated behavior becomes:

`Register/Login -> Browse -> Cart -> Checkout -> Account-linked Order -> Order History -> Logout -> Login -> Order History`

An authenticated checkout should use the authenticated account identity as the authoritative account owner while still allowing order-specific contact information where the current checkout requires it.

### Customer account UI

Add storefront-native customer authentication and account UI that matches the existing Ysabelle visual system.

Expected surfaces:

- customer Sign In page
- customer Create Account page
- authenticated account/profile page
- order history section
- account entry in the customer header
- logout action
- session-expired feedback

Guest header should expose Sign In/Create Account entry points without removing Cart or public storefront navigation. Authenticated header should expose My Account instead.

All owned UI states must cover:

- loading
- disabled/submitting
- validation errors
- authentication errors
- empty order history
- keyboard/focus behavior
- mobile and desktop layouts

## Authorization and Data Access Rules

These invariants are mandatory:

1. A customer cannot access OWNER/STAFF-only APIs or internal application routes.
2. OWNER/STAFF role checks cannot be satisfied using a customer credential.
3. Customer A cannot read Customer B's account or order history.
4. Guest storefront browsing remains public.
5. Guest checkout remains supported.
6. Account-linked order history returns only orders owned by the authenticated customer.
7. Disabled customers cannot establish or continue an authenticated customer session.
8. Server authorization is authoritative; frontend route guards are UX only.

## Security Requirements

Sprint 7 authentication work is high risk and must include:

- real login throttling/rate limiting for public customer auth
- normalized credential errors to reduce account enumeration
- strong password hashing using the repository-approved password hashing implementation or a justified successor
- finite session expiration
- safe logout/session invalidation semantics
- request validation for all public auth inputs
- authorization tests for horizontal access control
- explicit protection against customer-to-staff/owner privilege escalation
- review of browser token/session storage before finalization

MFA, social login, passwordless login, saved payment methods, and online payment integration are out of scope unless separately approved.

## Phase Plan

### Phase 1 - Consumer Auth Foundation

Implement and test the customer account schema, registration, login, logout, session restoration, customer authentication middleware, and strict separation from internal OWNER/STAFF authentication.

Exit criteria:

- registration works
- duplicate normalized email is rejected
- login succeeds with valid credentials
- invalid credentials return a generic public error
- disabled account is rejected
- invalid/expired session is rejected
- customer session restoration works
- customer credential cannot authorize internal OWNER/STAFF routes
- internal OWNER/STAFF login remains unchanged

### Phase 2 - Consumer Authentication UI

Implement Sign In/Create Account UI and authenticated header/account entry using repository-native components and responsive/accessibility requirements.

Exit criteria:

- guest can reach Sign In/Create Account
- login/register states are complete
- successful login updates storefront state without breaking cart/navigation
- logout returns the user to guest state
- mobile/desktop and keyboard/focus behavior are verified
- frontend lint/typecheck/build checks pass

### Phase 3 - E-commerce Account Integration

Link authenticated orders to customer accounts and add profile/order-history behavior while retaining guest checkout.

Exit criteria:

- guest checkout still works
- authenticated checkout creates an account-linked order
- customer can see only their own orders
- Customer A cannot read Customer B's orders
- session restore preserves access to account history
- logout removes authenticated account access while leaving public storefront usable

### Phase 4 - Security and Final Verification

Perform final auth hardening and branch-diff review, including login throttling, session handling, authorization isolation, regression coverage, and full required verification.

Exit criteria:

- targeted auth tests pass
- integration tests pass
- frontend tests/checks pass
- backend tests/checks pass
- repository-required Tier 3/high-risk verification passes
- security review finds no unresolved Critical or Important Sprint 7 auth issue
- final implementation is reviewed against this design before merge

## Testing Strategy

Use test-driven development for behavior changes: write the failing test, verify the expected failure, implement the smallest change, verify green, and refactor only while tests remain green.

Required regression coverage includes:

- normalized duplicate-email registration
- invalid email vs wrong password do not reveal which field/account is valid
- disabled-account login/session rejection
- customer session expiration
- logout/session invalidation semantics
- customer credential rejected by internal authorization
- internal credential does not accidentally become a customer identity
- guest checkout regression
- account-linked checkout
- order-history ownership isolation
- unauthenticated order-history rejection
- Customer A cannot retrieve Customer B data

## UI Skills and Repository Rules

For customer auth UI work:

- use `ysabelle-context` for repository-first discovery and verification
- use `ysabelle-ui-orchestrator` for frontend coordination
- use `ui-ux-pro-max` for accessibility, responsive behavior, hierarchy, and visual consistency
- inspect existing components first
- use `21st-cli-use` only when a strong reusable component is preferable to a project-native implementation
- do not use `21st-ai` unless an external generation step is separately approved

Preserve the current Ysabelle blue/purple/pink brand direction and do not introduce a second visual system.

## Non-goals

This Sprint 7 feature does not include:

- forcing all shoppers to create accounts
- replacing the internal OWNER/STAFF auth system
- merging CUSTOMER into internal role authorization
- social OAuth login
- MFA
- saved cards/payment credentials
- online payment gateway integration
- automatic claiming of historical guest orders

## Completion Definition

The feature is complete only when the full flow is verified with fresh evidence:

`Register -> Login -> Shop -> Cart -> Checkout -> Account-linked Order -> Order History -> Logout -> Login -> Order History`

while the existing guest flow remains functional and a customer credential cannot cross the internal OWNER/STAFF trust boundary.
