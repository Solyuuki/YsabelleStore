# Customer Identifier Login Design

## Decision

Phase 2 upgrades the customer credential baseline from email-only login to one password-based identifier field that accepts a username, email address, or Philippine mobile number while preserving all Phase 1 customer-auth security and privacy controls.

The customer and internal OWNER/STAFF authentication realms remain separate. This phase does not change the internal `/api/auth/*` engine, trusted-device flow, role model, or `/staff-login` behavior.

## Scope

Phase 2 includes:

- a nullable unique customer username for backward compatibility;
- a canonical nullable unique Philippine mobile login identity;
- required username for all new customer registrations;
- email remaining required for all customer accounts;
- optional Philippine mobile number at registration;
- one customer login request field named `identifier`;
- login by username, email, or normalized Philippine mobile number;
- privacy-safe uniqueness handling for username, email, and mobile;
- identifier-aware HMAC-backed auth rate-limit keys;
- backward-compatible migration and legacy-phone backfill behavior;
- minimal frontend form/type/service changes needed for the new credential contract.

Phase 2 does not include the final customer login/register redesign, account/profile redesign, social login, phone OTP, email verification, phone verification, shipping addresses, cross-tab logout synchronization, or any change to Staff/Owner authentication behavior.

## Current Baseline

The current `CustomerAccount` persistence contract contains required unique `email`, optional non-unique `phone`, password hash, status, sessions, and orders. There is no username or canonical mobile-login column.

The current customer login API validates `email + password`, the customer auth service resolves accounts by email, and the identifier rate limiter derives its private key from normalized email only.

Phase 1 security behavior is already established and must remain intact:

- exact generic invalid-login message `Invalid credentials.`;
- equivalent expensive password verification for missing/inactive accounts;
- current versioned scrypt password hashing with opportunistic legacy upgrade;
- layered IP and private HMAC identity rate limiting;
- signed registration intent with minimum age and expiry;
- Origin enforcement on state-changing browser auth requests;
- `Cache-Control: no-store` and `Pragma: no-cache` on sensitive customer routes;
- HttpOnly, SameSite=Lax customer session cookie with Secure in production;
- hashed session tokens in persistence with revocation support;
- metadata-only auth request logging;
- privacy-safe registration conflict behavior.

## Persistence Model

`CustomerAccount` will gain two nullable unique columns:

```text
username          String?  unique
phoneNormalized   String?  unique
```

Conceptually the model becomes:

```text
id
name
username          nullable for legacy accounts, unique when present
email             required, unique
phone             optional profile/contact value
phoneNormalized   optional canonical PH mobile login identity, unique when present
passwordHash
status
createdAt
updatedAt
sessions
orders
```

### Username nullability

Existing customer accounts are not assigned generated usernames. `username = null` is valid for legacy accounts.

All new registrations require a username. Existing customers can claim a username later through the Profile/Account Security work; that flow is intentionally outside Phase 2.

### Phone storage

For new registrations, when a valid Philippine mobile number is supplied, the canonical value is stored in both `phone` and `phoneNormalized` so profile display data and login identity remain consistent for newly created accounts.

For legacy accounts, the original `phone` value must not be destructively rewritten during migration. A controlled backfill may populate `phoneNormalized` only when the existing value is a valid Philippine mobile number and its canonical value is unambiguous and unique among legacy records.

Malformed or duplicate legacy phone values remain with `phoneNormalized = null`; those accounts continue to support email login and are not silently assigned a mobile login identity.

## Philippine Mobile Normalization

Phase 2 supports Philippine mobile numbers only.

Accepted canonical-equivalent examples:

```text
09171234567
639171234567
+639171234567
0917 123 4567
0917-123-4567
(+63) 917 123 4567
```

Before structural validation, ordinary presentation characters such as spaces, hyphens, and parentheses may be removed.

A valid number must resolve to exactly the Philippine mobile canonical form:

```text
+639XXXXXXXXX
```

Examples:

```text
09171234567    -> +639171234567
639171234567   -> +639171234567
+639171234567  -> +639171234567
```

Non-Philippine phone formats are rejected in Phase 2.

The normalization helper must return one canonical value for all equivalent input forms so persistence uniqueness, login resolution, and rate limiting use the same identity.

## Username Policy

New customer usernames must satisfy all of the following:

- length: 3 through 30 characters;
- normalized and matched case-insensitively in lowercase;
- allowed characters: ASCII letters `a-z`, digits `0-9`, underscore `_`, period `.`;
- first character must be a letter or digit;
- cannot contain `@`, `+`, whitespace, or other punctuation;
- cannot consist entirely of digits;
- cannot claim a reserved customer-auth name.

Reserved usernames are:

```text
admin
owner
staff
support
ysabelle
ysabellestore
```

Examples of valid usernames:

```text
qa_customer
maria.santos
juan2026
```

Examples that must not be accepted as usernames:

```text
09171234567
maria@gmail.com
+639171234567
admin
```

## Registration Contract

A new customer registration accepts:

```text
name
username
email
phone?         optional Philippine mobile number
password
```

Confirm-password remains a frontend-only validation field and is never transmitted or stored.

Registration normalization rules:

- `name`: trim using existing bounds;
- `username`: trim, lowercase, validate against the username policy;
- `email`: trim, lowercase, validate as email, preserve existing maximum length;
- `phone`: optional; normalize to canonical Philippine mobile format when present;
- `password`: preserve the existing password validation and Phase 1 hashing behavior.

All new customer registrations require a username even though the database column remains nullable for legacy compatibility.

### Registration uniqueness privacy

Username, email, or mobile uniqueness conflicts must return the same generic account-creation response:

```text
HTTP 409
code: CUSTOMER_ACCOUNT_CONFLICT
message: Unable to create customer account with the supplied details.
```

The application must not expose which identifier is already registered.

The same response applies both to pre-create conflict detection and database uniqueness races such as Prisma `P2002`.

## Login Contract

The customer login request changes from:

```text
email
password
```

to:

```text
identifier
password
```

The frontend field label is:

```text
Username, email or mobile number
```

### Identifier classification

Login classification is deterministic:

1. If the submitted value contains `@`, treat it only as an email candidate and normalize it to lowercase.
2. Otherwise, if it is structurally a Philippine mobile-number candidate, normalize it to canonical `+639XXXXXXXXX` form and resolve against `phoneNormalized`.
3. Otherwise, normalize it to lowercase and treat it as a username candidate.

A value must not be allowed to fall through from one identity class to another after a class-specific lookup fails. For example, an email-looking value must not later be interpreted as a username.

Malformed, missing, nonexistent, inactive, or wrong-password credentials all resolve to the same generic login failure.

### Login privacy

Every invalid customer password-login outcome must preserve the exact Phase 1 response:

```text
HTTP 401
code: INVALID_CUSTOMER_CREDENTIALS
message: Invalid credentials.
```

The response must never reveal whether the submitted identifier was recognized as a username, email, or mobile number, whether an account exists, or whether the account is inactive.

The Phase 1 dummy current-password-hash work path remains required for missing and inactive account resolution.

Successful login preserves the existing customer session creation, hashed-session-token persistence, absolute session lifetime, cookie behavior, and opportunistic password-hash upgrade.

## Safe Customer Shape

Authenticated customer responses may include:

```text
id
name
username        string | null
email
phone           string | null
status
```

`phoneNormalized`, `passwordHash`, session token hashes, and raw session tokens are never exposed in ordinary customer JSON payloads.

## Identifier-Aware Rate Limiting

Phase 1 rate-limit thresholds remain unchanged unless a test demonstrates that contract changes require another explicit design decision.

Login identifier rate limiting changes from email-only normalization to identity-class-aware canonicalization:

- email variants differing only by case share one private limiter key;
- username variants differing only by case share one private limiter key;
- all accepted equivalent representations of the same Philippine mobile number share one private limiter key.

Raw username, email, mobile, password, OTP, cookie, or session-token values must never become rate-limiter storage keys. Canonical identifiers feed the existing private HMAC-SHA256 key derivation.

### Registration identity throttling

Registration keeps the Phase 1 IP limiter and applies private identity throttling to each supplied unique customer identity independently:

- normalized username;
- normalized email;
- normalized mobile when present.

Changing a username must not bypass repeated-registration protection for the same email or mobile number, and changing an email must not bypass protection for the same username.

No permanent account lockout is introduced.

## Migration Strategy

The Prisma migration is additive and backward-compatible.

It adds nullable columns and unique indexes for:

```text
username
phone_normalized
```

It does not make `username` `NOT NULL`.

### Legacy mobile backfill

A controlled backfill examines customer rows with a non-null legacy `phone` value.

For each row:

1. attempt Philippine mobile normalization;
2. group successful candidates by canonical number;
3. populate `phoneNormalized` only for canonical values that belong to exactly one legacy account;
4. leave malformed and duplicate candidates with `phoneNormalized = null`;
5. never mutate the original legacy `phone` field during this backfill.

The backfill reports metadata-only counts such as total scanned, normalized, duplicate, and invalid records. It must not print raw customer phone numbers or other customer secrets.

A unique database index on `phone_normalized` becomes the authoritative concurrency guard after the safe backfill state exists.

## Frontend Functional Scope

Phase 2 changes functionality only; final visual design remains in Phase 3 and Phase 4.

### Login

Replace the email-specific field contract with:

```text
Username, email or mobile number
Password
```

The frontend submits `{ identifier, password }` and does not locally display account-existence-specific errors.

### Registration

The functional form includes:

```text
Full name
Username
Email
PH mobile number (optional)
Password
Confirm password
```

Confirm password is checked client-side only.

The existing signed registration-intent prewarm and minimum-age behavior remains in use.

### Account/customer types

Customer frontend types add:

```text
username: string | null
```

The existing account page may display or tolerate this field functionally, but the rejected account-page composition is not redesigned in Phase 2.

## Internal Auth Isolation

No Phase 2 customer identifier may authenticate a `User` OWNER or STAFF record.

No customer username, customer email, customer mobile number, customer cookie, or customer session token changes the internal auth realm.

The following remain unchanged in Phase 2:

- `/staff-login` direct entry;
- `/api/auth/*` behavior;
- internal JWT behavior;
- trusted-device flow;
- OWNER/STAFF role authorization;
- known-account behavior;
- owner-managed Staff creation.

## Security Invariants

Phase 2 is accepted only if all of these remain true:

1. Username, email, and mobile identifier lookup never leaks account existence.
2. Missing and inactive-account login still performs equivalent expensive password verification before the generic failure.
3. Password hashes continue using the approved Phase 1 current scrypt profile and opportunistic upgrade behavior.
4. Login and registration remain protected by layered IP and private HMAC identity rate limiting.
5. Raw customer identifiers or secrets are never stored as limiter keys or emitted in auth logs.
6. Customer auth and account responses remain no-store/no-cache.
7. Customer session cookies, database token hashing, expiry, and revocation remain unchanged.
8. Browser state-changing customer auth remains Origin-checked.
9. Registration still requires a valid signed registration intent.
10. Username/email/mobile uniqueness races return the generic registration conflict.
11. `phoneNormalized`, password hashes, and session-token hashes are never exposed in safe customer payloads.
12. Staff/Owner auth remains unaffected.

## Acceptance Gate

### Persistence and migration

- Prisma schema validates with nullable unique `username` and `phoneNormalized`.
- Existing username-null customers remain valid.
- Migration applies without inventing usernames for legacy customers.
- Safe legacy-phone backfill populates only valid unique PH identities and reports counts without raw values.
- Duplicate or malformed legacy phones remain email-only rather than receiving ambiguous mobile identity.

### Registration

- A new customer can register with name, username, email, password, and no phone.
- A new customer can register with an optional accepted PH phone representation.
- New registrations cannot omit username.
- Username policy and reserved-name rules are enforced.
- Username matching is case-insensitive.
- Equivalent phone formats store the same canonical mobile identity.
- Duplicate username, email, or mobile returns only `CUSTOMER_ACCOUNT_CONFLICT` with the generic message.
- Concurrent uniqueness races remain generic.

### Login

- A new customer can sign in using username and password.
- The same customer can sign in using email and password.
- A customer with canonical mobile identity can sign in using `09...`, `63...`, or `+63...` equivalent forms.
- Case variants of email and username resolve to the same account.
- A legacy `username = null` customer retains email login.
- A safely backfilled legacy mobile identity can be used for login.
- Malformed, nonexistent, inactive, and wrong-password attempts return exactly `Invalid credentials.`.
- Email-looking input never falls through to username lookup.
- Mobile-looking input never leaks whether a phone exists.

### Security regression

- Phase 1 password-security tests remain green.
- Phase 1 registration-intent tests remain green.
- Phase 1 Origin/cache tests remain green.
- Phase 1 privacy tests remain green.
- Phase 1 rate-limit thresholds remain enforced.
- Canonically equivalent identifiers share their HMAC limiter bucket.
- Staff/Owner auth separation tests remain green.

### Frontend contract

- Login submits `identifier + password`.
- Registration submits required username and optional PH mobile number.
- Confirm password is never transmitted.
- Customer type accepts `username: string | null`.
- No fake Google, Facebook, or phone-OTP controls are introduced.

### Repository gate

After focused tests are green, run the full approved auth/security regression set plus:

- repository typecheck;
- lint;
- production build;
- Prisma validation and migration verification;
- security dependency audit;
- manual customer registration/login tests by all supported identifiers;
- manual Staff/Owner isolation regression.

No Phase 2 completion claim is allowed without fresh verification evidence from this gate.
