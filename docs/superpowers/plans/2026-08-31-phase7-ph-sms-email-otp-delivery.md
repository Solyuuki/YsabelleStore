# Phase 7 Email OTP Delivery Plan

> **Status:** Updated after the approved removal of Mobile OTP from the Phase 7 feature.

## Goal

Keep customer authentication deployment-ready without a paid SMS dependency. Phase 7 now uses Email OTP through Resend, Google sign-in, and the existing username/password flow. A customer phone number may still be stored as optional account data, but it is not an authentication or verification method.

## Current Scope

- Email registration verification through Resend.
- Email Quick Sign through Resend.
- Google sign-in and registration.
- Existing username/password authentication.
- Remembered-account Quick Sign for Email OTP only.
- Optional Philippine mobile number as ordinary customer profile data.

## Removed Scope

The following items are intentionally removed from Phase 7:

- Mobile Quick Sign.
- Mobile registration OTP verification.
- Semaphore SMS delivery.
- `SEMAPHORE_API_KEY` and `SEMAPHORE_SENDER_NAME` deployment requirements.
- Mobile OTP request and verification endpoints.
- Mobile OTP delivery and provider tests.

## Security Constraints

- Never expose or log OTP values, provider API keys, session tokens, or raw provider responses.
- Preserve generic anti-enumeration responses for Email OTP request endpoints.
- Preserve the existing OTP expiry, one-time use, failed-attempt protection, and customer session boundaries.
- Real secrets remain outside source control.
- Tests must not perform real Resend network calls.
- Historical remembered-account rows using the retired `MOBILE` method must not be offered or accepted for authentication.

## Verification

Before Phase 7 is considered ready for manual QA, verify:

1. Backend, frontend, and Electron workspace builds pass.
2. Repository formatting, linting, typechecking, tests, and guardrails pass.
3. Customer auth UI does not expose Mobile Quick Sign or Mobile OTP registration.
4. Email OTP registration and Email Quick Sign remain functional.
5. Google sign-in and username/password sign-in remain functional.
6. Remembered accounts use Email verification only.
7. No Semaphore configuration is required for local or production authentication.

## Manual QA Focus

- New email registration OTP.
- Email Quick Sign.
- Wrong, expired, and replayed Email OTP codes.
- Existing and unknown email anti-enumeration behavior.
- Google sign-in.
- Username/password sign-in.
- Logout and remembered-account behavior.
- Registration with and without the optional phone field.

Do not merge this branch until the normal review and approval process explicitly authorizes it.
