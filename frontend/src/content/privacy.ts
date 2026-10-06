export const PRIVACY_NOTICE_VERSION = "2026-10-07-v1";
export const PRIVACY_LAST_UPDATED = "October 7, 2026";

export type PrivacyStorageItem = {
  name: string;
  category: "Essential security" | "Remembered sign-in" | "Device convenience";
  purpose: string;
  duration: string;
  technology: "Cookie" | "Local storage" | "Session storage";
};

export const PRIVACY_STORAGE_ITEMS: PrivacyStorageItem[] = [
  {
    name: "ysabelle_customer_session",
    category: "Essential security",
    purpose:
      "Keeps a customer signed in and lets the backend authenticate protected customer requests.",
    duration: "Up to 7 days, or until the session is revoked or cleared.",
    technology: "Cookie"
  },
  {
    name: "Registration, recovery, password-setup, session-security and social sign-in grants",
    category: "Essential security",
    purpose:
      "Short-lived, HttpOnly security state used to complete verification, account recovery, password setup, session revocation, or social sign-in safely.",
    duration: "Generally up to 10 minutes.",
    technology: "Cookie"
  },
  {
    name: "ysabelle_customer_remembered_browser",
    category: "Remembered sign-in",
    purpose:
      "Identifies a browser for the remembered-account / Quick Sign feature. The browser credential is hashed before it is matched to remembered-account records.",
    duration:
      "Browser cookie up to 365 days; remembered trust is valid for up to 30 days and can be revoked.",
    technology: "Cookie"
  },
  {
    name: "ysabelle:guest-cart:v1",
    category: "Device convenience",
    purpose:
      "Keeps a guest shopping cart on the current device. When a customer signs in, the guest cart can be merged into the account cart and the device copy is cleared.",
    duration: "Until the cart is cleared, merged after sign-in, or browser storage is removed.",
    technology: "Local storage"
  },
  {
    name: "ysabelle:storefront:recent-searches",
    category: "Device convenience",
    purpose:
      "Keeps up to five recent storefront search terms on the current device for faster repeat searching.",
    duration: "Until cleared by the customer or browser storage is removed.",
    technology: "Local storage"
  },
  {
    name: "ysabelle:pending-favorite",
    category: "Device convenience",
    purpose: "Temporarily remembers a product the customer tried to favorite before signing in.",
    duration: "Until the favorite is completed after sign-in or browser storage is removed.",
    technology: "Local storage"
  },
  {
    name: "ysabelle-store-entrance-entered",
    category: "Device convenience",
    purpose:
      "Prevents the storefront entrance experience from repeating within the same tab session.",
    duration: "For the current browser tab/session.",
    technology: "Session storage"
  }
];

export const PRIVACY_DATA_GROUPS = [
  {
    title: "Account and identity information",
    details:
      "Name, username, email address, phone number, verification timestamps, account status, and social sign-in identifiers when Google or Facebook sign-in is used.",
    purpose:
      "Create and manage the customer account, verify identity, support sign-in and recovery, and protect account access."
  },
  {
    title: "Shopping, order and delivery information",
    details:
      "Cart items, favorites, order items, order number, contact details, delivery address, delivery notes, order/payment/delivery status, and order history.",
    purpose:
      "Operate the storefront, fulfill purchases, deliver orders, reconcile payment status, and provide order history and support."
  },
  {
    title: "Payment-related records",
    details:
      "Payment method and status, PayMongo checkout/session identifiers, payment identifiers, amounts and payment timestamps. Full card numbers and CVVs are not collected by Ysabelle Store forms.",
    purpose:
      "Start and reconcile payment checkout, prevent duplicate processing, and maintain transaction records."
  },
  {
    title: "Reviews, moderation and support",
    details:
      "Review display name, rating, comment, verified-order reference, moderation status/reason, support contact details, support messages, ticket references, and linked order references.",
    purpose:
      "Publish and moderate customer feedback, respond to support requests, prevent abuse, and keep an auditable history of moderation actions."
  },
  {
    title: "Authentication and security records",
    details:
      "Hashed passwords or tokens, customer sessions, expiration/revocation/last-used timestamps, remembered-browser records, recovery and verification state, and security-action records.",
    purpose:
      "Authenticate customers, detect invalid or expired credentials, recover accounts, revoke sessions, and reduce unauthorized access."
  }
] as const;

export const PRIVACY_SERVICE_PROVIDERS = [
  {
    name: "PayMongo",
    use: "Payment checkout when enabled. The integration sends billing name/email, order line items, an order reference, and internal order/customer references needed to create or reconcile checkout."
  },
  {
    name: "Google",
    use: "Google customer sign-in when enabled, and Gmail-based customer-support mailbox synchronization when configured."
  },
  {
    name: "Facebook",
    use: "Facebook customer sign-in when enabled."
  },
  {
    name: "Resend",
    use: "Production delivery of customer verification, sign-in, password setup/recovery, and session-security emails when configured."
  }
] as const;

export const PRIVACY_RIGHTS = [
  "Be informed about how personal data is processed.",
  "Request access to personal data held about you.",
  "Request correction of inaccurate or incomplete personal data.",
  "Object to processing in circumstances recognized by law.",
  "Request erasure or blocking where the legal requirements are met.",
  "Exercise data portability where applicable.",
  "Seek damages or file a complaint when rights under the Data Privacy Act are violated."
] as const;
