# Customer Verified Identity + Quick Sign Design

Date: 2026-08-31
Branch: `m1/v0.9/feat/customer-mobile-otp`
Status: Approved direction, implementation pending

## Goal

Make customer registration establish trusted email/mobile identities once, then reuse those identities for low-friction passwordless Quick Sign login.

## Registration behavior

- Email remains required.
- A new customer cannot be created until the submitted email is verified by a registration-purpose email OTP.
- Mobile remains optional.
- If a mobile number is supplied, it must be verified by a registration-purpose mobile OTP before it can be attached to the account.
- If the verified email or mobile value changes before account creation, its verification is invalidated and the replacement value must be verified again.
- Registration still collects the existing required profile fields: name, username, email, password, and optional mobile.
- Successful account creation records verification state for the verified identities.

## Register UI

The normal form keeps Email and PH mobile fields.

Below the form, Quick Sign options use the same visual family as Login:

- Continue with Google
- Continue with Email OTP
- Continue with Mobile OTP

For registration, Email OTP and Mobile OTP do not create an incomplete account. They verify the corresponding identity and return to the form with that value prefilled and marked `Verified`.

Email verification is required before `Create Account` can succeed. Mobile verification is required only when a mobile number is present.

## Login behavior

The Login Quick Sign area offers:

- Continue with Google
- Continue with Email OTP
- Continue with Mobile OTP

Email Quick Sign sends an authentication-purpose OTP only for an ACTIVE customer account whose email is eligible for Quick Sign. Mobile Quick Sign does the same for the linked mobile identity.

Successful OTP verification creates the normal customer session through the existing customer-session mechanism. Password login remains available using username, email, or mobile plus password.

## OTP purpose isolation

One token, one purpose. The following purposes remain cryptographically and logically separate:

- password recovery email OTP
- registration email verification OTP
- email Quick Sign authentication OTP
- registration mobile verification OTP
- mobile Quick Sign authentication OTP

Low-level mechanics may be shared (6 digits, hashing/HMAC, expiry, max attempts, cooldown, rate limiting, single use), but challenges/grants must not cross purposes.

## Persistence

Add explicit customer identity verification state, preferably timestamp fields such as:

- `emailVerifiedAt`
- `phoneVerifiedAt`

Add dedicated email OTP challenge persistence for registration verification and email authentication rather than reusing recovery tokens or mobile challenge rows.

The existing dedicated mobile registration/auth challenge separation remains intact.

## Legacy accounts

Do not silently mark historical email/mobile values as verified if they were never proven by OTP/social-provider evidence. Password login must continue to work for legacy accounts. Quick Sign eligibility for legacy identities must not weaken account ownership guarantees.

## Delivery

- Email OTP may reuse the existing transactional email delivery infrastructure, but with dedicated templates/content and purpose-specific challenge handling.
- Mobile OTP remains development-terminal delivery until a real production SMS provider is configured; production must continue to fail closed rather than pretend an SMS was sent.

## Security requirements

- Generic request responses for unknown/ineligible identities to resist account enumeration.
- OTPs stored hashed/HMACed, never plaintext.
- Short expiry, single use, resend cooldown, wrong-attempt ceiling, IP/private-identity rate limits.
- Verification grants bound to the exact registration intent and normalized identity.
- Changing an identity invalidates the previous verification state in the registration UI.
- OWNER/STAFF authentication remains isolated from customer authentication.

## Acceptance criteria

1. New registration requires verified email.
2. Optional mobile must be verified when supplied.
3. Register offers Google, Email OTP, and Mobile OTP quick actions.
4. Verified email/mobile return to the form and display a verified state.
5. Login offers Google, Email OTP, and Mobile OTP Quick Sign.
6. Email Quick Sign logs into the matching eligible ACTIVE customer after OTP verification.
7. Mobile Quick Sign continues to log into the matching eligible ACTIVE customer after OTP verification.
8. Recovery OTP cannot log in; registration OTP cannot log in; auth OTP cannot reset passwords or verify a different registration identity.
9. Password login remains available.
10. Auth/security changes receive Tier 3 verification near completion; manual QA can begin as soon as a functional QA-ready head is available.
