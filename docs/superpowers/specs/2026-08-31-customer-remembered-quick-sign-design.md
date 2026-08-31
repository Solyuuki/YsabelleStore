# Customer Remembered Quick Sign Design

**Date:** 2026-08-31

## Goal

Give returning customers a Roblox/Google-style **Known accounts** experience for YsabelleStore customer login: after a successful Email OTP or Mobile OTP sign-in, the customer may trust that browser for 30 days. During the 30-day trust window, selecting the remembered account signs in without another OTP. After trust expires, the account card remains visible and selecting it sends a fresh OTP; successful verification renews trust for another 30 days.

This feature applies to **Email Quick Sign and Mobile Quick Sign only**. Google OAuth remains a separate provider flow and does not create a YsabelleStore remembered-account trust credential in this phase.

## Approved Product Behavior

### Known accounts

- Login shows a **Known accounts** section when the current browser has at least one remembered customer account.
- A browser can hold at most **3 remembered customer accounts**. There is no pagination.
- The same customer occupies one slot even if that customer has both verified email and verified mobile identities.
- Each card shows the customer display name, a masked remembered identity, the remembered method (Email or Mobile), last-used information, and trust state.
- Each card provides **Continue** and **Forget** actions.
- **Forget** removes that account from the current browser's remembered list and immediately frees one of the 3 slots.
- **Use another account** keeps the normal Google, Email, Mobile, and password sign-in paths available.

### 30-day trust

- A trust grant lasts exactly **30 days from the verification that created or renewed it**.
- Using **Continue** during the 30-day window does not silently extend the 30-day deadline.
- During the valid trust window, **Continue** creates a fresh normal customer session without sending another OTP.
- After the 30-day trust expires, the remembered card remains visible.
- Selecting an expired card automatically starts a fresh OTP challenge for that remembered method.
- Successful OTP verification renews that account's browser trust for another 30 days and signs the customer in.
- A new browser/device has no remembered trust and therefore requires normal authentication before it can be trusted.
- Clearing browser cookies/device data removes the browser's ability to use its remembered trust credential.

### Remember opt-in

- Successful Email OTP and Mobile OTP login panels include a **Remember this account for 30 days** option.
- The option is explicit and is not an OTP bypass until the OTP has already been successfully verified once on that browser.
- When the current browser already holds 3 different remembered accounts, a fourth account cannot be added until one is forgotten.
- Renewing an existing remembered account does not consume another slot.
- A slot-limit failure must not turn a successful OTP authentication into a failed login; it only prevents the new remembered slot from being created.

### Expired remembered accounts

- Expired cards are not deleted automatically.
- Expired cards show a state such as **Verification required** instead of looking currently trusted.
- `Continue` on an expired Email remembered account sends an Email OTP to the current verified account email.
- `Continue` on an expired Mobile remembered account sends a Mobile OTP to the current verified account mobile.
- The client does not need the raw remembered email/mobile value in order to trigger the OTP; the server resolves the identity from the remembered account record and current customer account.

## Security Model

### Separate browser trust from customer session

A remembered account is not a 30-day customer session. Existing customer sessions keep their current normal session lifetime. Remembered trust is a separate credential used only to create a fresh customer session after the server confirms the account's trust window is still valid.

### Opaque browser credential

- The server creates a cryptographically random browser token when the first account is remembered.
- The browser token is stored only in an **HttpOnly**, `SameSite=Lax` cookie and `Secure` in production.
- Only a SHA-256 hash of that token is stored in the database.
- The cookie identifies a remembered browser; it is never returned to frontend JavaScript.
- The database row's `trustedUntil` controls whether OTP bypass is allowed. The browser cookie itself does not extend the trust period.
- The browser credential may remain long enough to display expired Known Accounts; an expired row cannot create a session until it is reverified.

### Server-side remembered rows

Create a customer-specific table separate from the existing OWNER/STAFF `TrustedDevice` model. The internal staff trusted-device subsystem must not be reused for customer authentication.

Each remembered row stores:

- `id`
- `browserTokenHash`
- `customerAccountId`
- `authMethod` (`EMAIL` or `MOBILE`)
- `trustedUntil`
- `lastUsedAt`
- `createdAt`
- `updatedAt`

There is one visible row per `(browserTokenHash, customerAccountId)`.

### Max-three enforcement

- The server is authoritative for the 3-account limit.
- Creating a remembered row runs in a transaction and checks the count for the browser before inserting a new customer.
- Upserting an already remembered customer remains allowed at 3/3.
- The frontend also shows the current count and disables a new remember opt-in at 3/3 when the current customer is not already known.

### Existing customer status remains authoritative

The existing customer account status is separate from the remembered-trust expiry. A remembered credential never overrides normal account eligibility. A remembered Continue only creates a session for a customer account that is otherwise eligible for customer authentication.

### Password recovery

A successful password reset already revokes old customer sessions. It must also expire remembered trust for that customer without deleting Known Account cards. The cards remain visible but require a fresh OTP next time, preserving both security and the requested remembered-account UX.

### OTP purpose isolation

Remembered-account reverification uses the existing purpose-specific Email Auth or Mobile Auth OTP challenge systems. Registration OTP and Password Recovery OTP challenges cannot satisfy remembered-account verification.

## Backend API

### `GET /api/customer-auth/remembered`

Returns `[]` when the browser has no remembered-browser cookie. Otherwise returns at most 3 safe display records:

```ts
type CustomerRememberedAccount = {
  id: string;
  name: string;
  method: "EMAIL" | "MOBILE";
  maskedIdentifier: string;
  trusted: boolean;
  trustedUntil: string;
  lastUsedAt: string | null;
};
```

Raw email/mobile values and browser tokens are never returned.

### `POST /api/customer-auth/remembered/continue`

Input:

```ts
{ rememberedAccountId: string }
```

Behavior:

- Valid current trust -> create normal customer session and return customer.
- Expired trust -> return a typed `verificationRequired` response describing the remembered method and masked destination. It does not create a session.
- Unknown/mismatched remembered account -> generic invalid remembered-account response.

### `POST /api/customer-auth/remembered/request`

Input:

```ts
{ rememberedAccountId: string }
```

Only used for an expired remembered row. The server resolves the current verified Email or Mobile identity from the bound customer account and starts the corresponding Email Auth or Mobile Auth OTP flow. Response remains enumeration-safe and exposes only the already-known masked destination.

### `POST /api/customer-auth/remembered/verify`

Input:

```ts
{
  rememberedAccountId: string;
  verificationCode: string;
}
```

The server resolves the remembered method/current account identity, verifies the existing Email Auth or Mobile Auth OTP challenge, creates the normal customer session, and atomically renews `trustedUntil` to `now + 30 days`.

### `DELETE /api/customer-auth/remembered/:id`

Deletes the remembered row belonging to the current browser token and frees a slot. It does not delete or deactivate the customer account.

## Email/Mobile OTP Login Integration

The existing Email OTP and Mobile OTP verify payloads gain:

```ts
rememberFor30Days?: boolean
```

After successful OTP authentication:

- `false`/omitted -> normal session only.
- `true` -> normal session plus remembered-browser upsert with the method that established trust.
- If the same customer is already remembered, renew that row rather than creating a duplicate slot.

## Login UI

### Known Accounts first

When remembered rows exist, the login card shows:

1. **Known accounts** cards.
2. `Use another account` separator/action.
3. Existing password form and Quick Sign methods.

Trusted card:

- `Continue` -> immediate login.
- Displays trust deadline or `Trusted for this device` state.

Expired card:

- Displays `Verification required`.
- `Continue` -> send the remembered method's OTP and open a compact code-entry panel.
- Successful code -> sign in and renew 30-day trust.

### Remember option in OTP panels

Email and Mobile Quick Sign panels show:

`[ ] Remember this account for 30 days`

When browser slots are 3/3 and this account is not already known, the control is disabled and explains that a remembered account must be forgotten first.

## Registration Quick Sign Copy Cleanup

The Register page is verification-oriented rather than login-oriented.

Use these labels:

- **Continue with Google**
  - `Use your Google account for faster sign-up and sign-in.`
- **Verify Email Address**
  - `Verify the required email for your new account.`
- **Verify Mobile Number**
  - `Verify an optional PH mobile number.`

Do not show the word **OTP** in the Register page action labels. The Login page may keep **Email OTP** and **Mobile OTP** terminology because those actions are authentication methods there.

## Non-Goals

- No remembered Google OAuth credential in this phase.
- No OWNER/STAFF remembered-account reuse.
- No pagination for Known Accounts.
- No more than 3 remembered customer accounts per browser.
- No OTP bypass after the 30-day trust deadline.
- No raw auth token or browser trust token in `localStorage`.
- No automatic trust renewal merely because the customer clicked Continue.

## Acceptance Criteria

1. Browser can remember at most 3 distinct customer accounts.
2. Email OTP and Mobile OTP login can opt into 30-day remembered trust.
3. A trusted remembered card signs in without OTP during its own 30-day window.
4. Continue does not extend that deadline.
5. After expiry, the card stays visible and Continue requires a fresh purpose-correct OTP.
6. Successful expired-card OTP renews trust for another 30 days.
7. Forget removes the card and frees a slot immediately.
8. Same customer using Email and Mobile occupies one slot, not two.
9. New browser/device cannot use another browser's remembered trust.
10. Password reset expires remembered trust but leaves cards visible for later OTP reverification.
11. Frontend never receives the browser trust secret and Known Accounts APIs never expose raw remembered email/mobile values.
12. Register action labels remove `OTP` and Google receives helper copy matching the other verification actions.
13. Existing password login, Google OAuth, Email OTP, Mobile OTP, registration verification, and recovery OTP remain purpose-separated and functional.
