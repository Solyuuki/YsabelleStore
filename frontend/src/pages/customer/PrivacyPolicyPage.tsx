import type { ReactNode } from "react";
import {
  BadgeCheck,
  Clock3,
  Cookie,
  Database,
  ExternalLink,
  KeyRound,
  Landmark,
  LockKeyhole,
  Mail,
  MapPin,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRoundCheck,
  type LucideIcon
} from "lucide-react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import {
  PRIVACY_DATA_GROUPS,
  PRIVACY_LAST_UPDATED,
  PRIVACY_RIGHTS,
  PRIVACY_SERVICE_PROVIDERS,
  PRIVACY_STORAGE_ITEMS
} from "@/content/privacy";

const TABLE_OF_CONTENTS = [
  ["overview", "Overview"],
  ["data-we-process", "Data we process"],
  ["why-and-basis", "Why we process it"],
  ["payments-providers", "Payments & providers"],
  ["cookies-storage", "Cookies & storage"],
  ["automated-systems", "Forecasting & automation"],
  ["retention-security", "Retention & security"],
  ["your-rights", "Your rights"],
  ["contact", "Contact & complaints"]
] as const;

export function PrivacyPolicyPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className="customer-privacy-page">
      <div className="customer-privacy-hero">
        <div className="customer-container customer-privacy-hero__grid">
          <div>
            <div className="customer-privacy-hero__law">
              <Landmark aria-hidden="true" size={16} />
              Philippines · Data Privacy Act of 2012 (Republic Act No. 10173)
            </div>
            <p className="customer-eyebrow">Privacy policy</p>
            <h1>Clear privacy, based on how Ysabelle Store actually works.</h1>
            <p className="customer-privacy-hero__lead">
              This notice explains the personal data used by the current Ysabelle Store customer
              system, why it is needed, the service providers involved, the storage used on your
              device, and the rights available to you under Philippine privacy law.
            </p>
            <div className="customer-privacy-hero__meta">
              <span>
                <Clock3 aria-hidden="true" size={16} />
                Last updated {PRIVACY_LAST_UPDATED}
              </span>
              <span>
                <ShieldCheck aria-hidden="true" size={16} />
                No advertising tracker configured
              </span>
            </div>
          </div>

          <aside className="customer-privacy-hero__summary" aria-label="Privacy summary">
            <div className="customer-privacy-hero__summary-icon">
              <LockKeyhole aria-hidden="true" size={24} />
            </div>
            <p className="customer-kicker">At a glance</p>
            <strong>We collect data to run the store, fulfill orders, and protect accounts.</strong>
            <ul>
              <li>Full card numbers and CVVs are not collected by Ysabelle Store forms.</li>
              <li>
                The current storefront does not initialize advertising or behavioral analytics.
              </li>
              <li>
                Inventory forecasting is not customer profiling in the current implementation.
              </li>
            </ul>
          </aside>
        </div>
      </div>

      <div className="customer-container customer-privacy-layout">
        <aside className="customer-privacy-toc" aria-label="Privacy policy sections">
          <span>On this page</span>
          <nav>
            {TABLE_OF_CONTENTS.map(([id, label]) => (
              <a href={`#${id}`} key={id}>
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="customer-privacy-document">
          <PolicySection
            icon={BadgeCheck}
            id="overview"
            title="1. Who is responsible for your information?"
          >
            <p>
              Ysabelle&apos;s Store operates this customer storefront and acts as the personal
              information controller for personal data processed through the store unless another
              organization is independently responsible for data you provide directly to it.
            </p>
            <div className="customer-privacy-callout">
              <MapPin aria-hidden="true" size={18} />
              <div>
                <strong>Ysabelle&apos;s Store</strong>
                <p>110 A. Mabini Street, Pasig City, Metro Manila, Philippines</p>
              </div>
            </div>
            <p>
              This notice is written with the Philippine Data Privacy Act of 2012 and applicable
              National Privacy Commission rules as its primary legal framework. Processing must
              follow transparency, legitimate purpose, proportionality, and applicable lawful
              processing criteria.
            </p>
          </PolicySection>

          <PolicySection icon={Database} id="data-we-process" title="2. Personal data we process">
            <p>
              The categories below reflect the customer-facing data fields and workflows present in
              the current system. We do not add categories here simply because they are common on
              other websites.
            </p>
            <div className="customer-privacy-data-grid">
              {PRIVACY_DATA_GROUPS.map((group) => (
                <article key={group.title}>
                  <h3>{group.title}</h3>
                  <p>{group.details}</p>
                  <small>{group.purpose}</small>
                </article>
              ))}
            </div>
            <div className="customer-privacy-callout customer-privacy-callout--quiet">
              <KeyRound aria-hidden="true" size={18} />
              <div>
                <strong>Authentication secrets are handled differently.</strong>
                <p>
                  Passwords are stored as password hashes. Session and security credentials are
                  stored or compared as tokens/hashes where the relevant workflow requires them.
                  Support instructions explicitly tell customers not to send passwords, OTPs, CVVs,
                  or full card numbers.
                </p>
              </div>
            </div>
          </PolicySection>

          <PolicySection icon={Scale} id="why-and-basis" title="3. Why we process data">
            <p>
              We process personal data only for identified store, account, security, support, and
              transaction purposes. Depending on the activity, the applicable basis may include
              steps requested before a transaction, performance of a customer transaction,
              compliance with legal obligations, legitimate interests such as account security and
              abuse prevention, or consent where Philippine law requires consent.
            </p>
            <div className="customer-privacy-purpose-list">
              <Purpose
                label="Account services"
                text="Register customers, sign them in, verify email, recover access, remember a browser when requested, and manage sessions."
              />
              <Purpose
                label="Commerce"
                text="Maintain carts and favorites, create orders, fulfill delivery, show order history, and reconcile payment status."
              />
              <Purpose
                label="Security & moderation"
                text="Revoke sessions, investigate account or review abuse, enforce moderation decisions, and keep moderation audit records."
              />
              <Purpose
                label="Customer support"
                text="Receive a support request, link a verified order where possible, maintain the ticket conversation, and reply through the configured support mailbox."
              />
            </div>
            <p>
              This privacy notice does not impose a blanket consent requirement. Where consent is
              actually required for a separate optional activity, it must be requested specifically
              for that activity rather than being bundled into general store access.
            </p>
          </PolicySection>

          <PolicySection
            icon={ShoppingBag}
            id="payments-providers"
            title="4. Payments and service providers"
          >
            <p>
              Some store functions rely on service providers. We send only the information needed
              for the relevant function and do not describe a provider as active unless the related
              integration is configured.
            </p>
            <div className="customer-privacy-provider-list">
              {PRIVACY_SERVICE_PROVIDERS.map((provider) => (
                <article key={provider.name}>
                  <strong>{provider.name}</strong>
                  <p>{provider.use}</p>
                </article>
              ))}
            </div>
            <div className="customer-privacy-callout">
              <ShoppingBag aria-hidden="true" size={18} />
              <div>
                <strong>PayMongo checkout</strong>
                <p>
                  When PayMongo checkout is enabled, Ysabelle Store sends billing name/email, order
                  line items, an order reference, and internal order/customer references needed for
                  checkout and payment reconciliation. Card or e-wallet credentials are entered with
                  the payment provider rather than into a Ysabelle Store card form.
                </p>
              </div>
            </div>
            <p>
              Google or Facebook may independently process information under their own terms when
              you choose social sign-in. Customer-support messages may also pass through the
              configured Gmail support mailbox, and identity/security emails may be delivered
              through Resend when configured.
            </p>
          </PolicySection>

          <PolicySection icon={Cookie} id="cookies-storage" title="5. Cookies and device storage">
            <p>
              The current storefront uses service, security, and convenience storage. It does not
              initialize an advertising pixel or behavioral analytics tracker. Because these current
              mechanisms support requested store features rather than advertising, the storefront
              presents an informational privacy notice instead of a fake advertising consent choice.
            </p>
            <div
              className="customer-privacy-storage-table"
              role="table"
              aria-label="Storage details"
            >
              {PRIVACY_STORAGE_ITEMS.map((item) => (
                <article key={item.name} role="row">
                  <div>
                    <span>{item.category}</span>
                    <small>{item.technology}</small>
                  </div>
                  <strong>{item.name}</strong>
                  <p>{item.purpose}</p>
                  <p className="customer-privacy-storage-table__duration">{item.duration}</p>
                </article>
              ))}
            </div>
            <p>
              If Ysabelle Store later adds optional analytics, marketing, or similar tracking that
              requires consent, those technologies should remain disabled until the appropriate
              choice is provided and recorded.
            </p>
          </PolicySection>

          <PolicySection
            icon={Sparkles}
            id="automated-systems"
            title="6. Forecasting and automated systems"
          >
            <p>
              The current forecasting and inventory recommender operate on product, sales,
              inventory, replenishment, and expiry-risk evidence. Their purpose is to support stock
              and replenishment decisions for the store.
            </p>
            <div className="customer-privacy-callout customer-privacy-callout--quiet">
              <UserRoundCheck aria-hidden="true" size={18} />
              <div>
                <strong>No customer scoring or eligibility decision is made by this system.</strong>
                <p>
                  The current recommender evidence sent to an optional Cloudflare AI or Groq
                  decision-assistance provider contains product/inventory evidence such as SKU,
                  stock, risk level, and recommended quantity, not customer account identity.
                </p>
              </div>
            </div>
          </PolicySection>

          <PolicySection
            icon={ShieldCheck}
            id="retention-security"
            title="7. Retention and security"
          >
            <p>
              We keep personal data only for as long as necessary for the declared purpose, account
              and transaction operations, security, legitimate business needs, legal claims, or
              periods required by applicable law. Retention therefore differs by record type rather
              than using one blanket period for every record.
            </p>
            <p>
              Short-lived verification/security grants generally expire within 10 minutes. Customer
              session cookies are configured for up to 7 days. Remembered-browser credentials can
              remain on the browser for up to 365 days, while remembered trust is valid for up to 30
              days and can be revoked.
            </p>
            <p>
              The system uses measures including HttpOnly cookies for customer authentication
              credentials, SameSite restrictions, Secure cookies in production, hashed passwords or
              tokens where applicable, expiration/revocation checks, role/access controls, and audit
              records for moderation actions. No internet service can promise absolute security, so
              access should remain limited to what is operationally necessary.
            </p>
          </PolicySection>

          <PolicySection icon={Scale} id="your-rights" title="8. Your data privacy rights">
            <p>
              Under the Philippine Data Privacy Act, data subjects have rights relating to their
              personal data. Depending on the circumstances and legal requirements, these include:
            </p>
            <ul className="customer-privacy-rights">
              {PRIVACY_RIGHTS.map((right) => (
                <li key={right}>
                  <BadgeCheck aria-hidden="true" size={17} />
                  <span>{right}</span>
                </li>
              ))}
            </ul>
            <p>
              A request may require reasonable identity verification before personal data is
              disclosed, corrected, blocked, erased, or transferred. Some records may need to be
              retained when required for an ongoing transaction, security investigation, legal
              claim, or legal obligation.
            </p>
          </PolicySection>

          <PolicySection icon={Mail} id="contact" title="9. Privacy requests and complaints">
            <p>
              For access, correction, objection, deletion/blocking, portability, or another privacy
              concern, use the Ysabelle Store Customer Support page and put
              <strong> “Privacy Request”</strong> in the subject. Do not send passwords, OTPs, CVVs,
              or full card numbers.
            </p>
            <div className="customer-privacy-contact-actions">
              <CustomerLink className="customer-button" href="/support" navigate={navigate}>
                Contact Customer Support
              </CustomerLink>
              <a
                className="customer-button customer-button--secondary"
                href="https://privacy.gov.ph/data-subject-rights/"
                rel="noreferrer"
                target="_blank"
              >
                National Privacy Commission
                <ExternalLink aria-hidden="true" size={15} />
              </a>
            </div>
            <p>
              You may also raise a complaint with the National Privacy Commission when you believe
              rights under Philippine data privacy law have been violated.
            </p>
          </PolicySection>
        </article>
      </div>
    </section>
  );
}

function PolicySection({
  children,
  icon: Icon,
  id,
  title
}: {
  children: ReactNode;
  icon: LucideIcon;
  id: string;
  title: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="customer-privacy-section" id={id}>
      <div className="customer-privacy-section__heading">
        <span aria-hidden="true">
          <Icon size={20} />
        </span>
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      <div className="customer-privacy-section__body">{children}</div>
    </section>
  );
}

function Purpose({ label, text }: { label: string; text: string }) {
  return (
    <article>
      <strong>{label}</strong>
      <p>{text}</p>
    </article>
  );
}
