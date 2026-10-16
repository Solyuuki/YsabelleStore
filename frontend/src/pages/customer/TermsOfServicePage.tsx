import { useState, type ReactNode } from "react";
import {
  BadgeCheck,
  BookOpen,
  ChevronDown,
  Clock3,
  CreditCard,
  FileCheck2,
  HeartHandshake,
  Landmark,
  LockKeyhole,
  Mail,
  PackageCheck,
  RefreshCcw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRoundCheck,
  type LucideIcon
} from "lucide-react";

import { CategoryRetailBackdrop } from "@/components/customer/CategoryRetailBackdrop";
import { CustomerLink } from "@/components/customer/CustomerLink";
import { StorefrontGalaxyArtwork } from "@/components/customer/StorefrontGalaxyArtwork";

type Term = {
  id: string;
  label: string;
  icon: LucideIcon;
  paragraphs: readonly string[];
};

const TERMS: readonly Term[] = [
  {
    id: "scope",
    label: "Using Ysabelle Store",
    icon: BookOpen,
    paragraphs: [
      "These Terms of Service explain the conditions for browsing Ysabelle Store, creating a customer account, placing orders, and using related support services.",
      "By using the storefront or placing an order, you agree to follow these terms and the applicable policies displayed during checkout. If you disagree, please do not place an order. Nothing here limits rights that cannot legally be waived under Philippine law."
    ]
  },
  {
    id: "accounts",
    label: "Customer accounts and security",
    icon: UserRoundCheck,
    paragraphs: [
      "Provide accurate account and contact information, use an email address you control, and keep your sign-in credentials and verification codes private. You are responsible for activity authorized through your account.",
      "Contact Customer Support promptly if you suspect unauthorized access. Accounts may be restricted when reasonably necessary to protect customers, prevent fraud, or address misuse. If you are a minor, use the service with a parent or guardian where required by law."
    ]
  },
  {
    id: "catalog",
    label: "Products and availability",
    icon: ShoppingBag,
    paragraphs: [
      "Product images, descriptions, package sizes, prices, and availability are provided to help you shop. We work to keep this information accurate, but errors or stock changes may occur.",
      "A product appearing in the catalog does not guarantee it is still available when an order is reviewed. If a listing or stock detail is incorrect, we may contact you to confirm an adjustment or cancellation before fulfillment."
    ]
  },
  {
    id: "pricing",
    label: "Pricing and payment",
    icon: CreditCard,
    paragraphs: [
      "Review the final price, applicable charges, delivery fees, and available payment methods shown during checkout before confirming an order. Prices may change before an order is confirmed.",
      "Use only payment methods that you are authorized to use. Where an external payment service such as PayMongo is offered, its own terms and security procedures also apply. Ysabelle Store does not ask customers to send full card numbers, CVVs, or one-time codes through support."
    ]
  },
  {
    id: "orders",
    label: "Orders and confirmation",
    icon: FileCheck2,
    paragraphs: [
      "Submitting an order sends a request for processing; it does not guarantee fulfillment. Confirmation and order status depend on stock availability, valid order details, payment status, and applicable store review.",
      "Check the order summary and provide complete, accurate contact information. Retain the order number or confirmation details so the team can identify the purchase when you request support."
    ]
  },
  {
    id: "cancellation",
    label: "Order changes and cancellation",
    icon: RefreshCcw,
    paragraphs: [
      "Cancellation or changes depend on the order's current processing and fulfillment stage. Review the order cancellation policy presented during checkout for the applicable conditions.",
      "If an item cannot be supplied, or a delivery arrangement cannot be completed, the store may contact you about an appropriate adjustment, cancellation, or refund. Applicable consumer rights remain in effect."
    ]
  },
  {
    id: "delivery",
    label: "Delivery and fulfillment",
    icon: Truck,
    paragraphs: [
      "Available delivery or pickup choices, charges, and service-area limitations are presented as part of ordering when offered. Delivery times are estimates and can change due to availability, weather, courier capacity, or other operational conditions.",
      "Make sure recipient, phone, and address details are correct. If you encounter a delivery concern, contact support with the order reference rather than sharing payment credentials."
    ]
  },
  {
    id: "returns",
    label: "Product concerns and refunds",
    icon: PackageCheck,
    paragraphs: [
      "If an item is missing, damaged, defective, incorrect, or otherwise raises a concern, report it through Customer Support with the order reference and relevant details. The team will review the concern and explain the available resolution.",
      "Returns, replacements, and refunds are handled according to applicable Philippine consumer protection laws and relevant store policies. These terms do not exclude statutory remedies."
    ]
  },
  {
    id: "conduct",
    label: "Fair and secure use",
    icon: ShieldCheck,
    paragraphs: [
      "Do not attempt to access another person's account, bypass security controls, interfere with the website, submit fraudulent orders or claims, or misuse verification and recovery features.",
      "We may investigate and reasonably restrict harmful or unlawful behavior to protect customers, staff, and store operations."
    ]
  },
  {
    id: "feedback",
    label: "Reviews and customer support",
    icon: HeartHandshake,
    paragraphs: [
      "Keep reviews, messages, and support requests accurate and respectful. Customer feedback may be reviewed or moderated to prevent spam, impersonation, abusive material, or other policy violations.",
      "Support messages may be retained with the related ticket or order so the team can respond and maintain an auditable history. Do not include passwords, OTPs, full card numbers, or other authentication secrets."
    ]
  },
  {
    id: "privacy",
    label: "Privacy and external services",
    icon: LockKeyhole,
    paragraphs: [
      "Our Privacy Policy describes what customer information is processed, for what purposes, and how to exercise your rights under Philippine privacy law.",
      "Some features use external providers for sign-in, payment processing, or transactional email delivery. Those providers may have additional terms and privacy practices for the services they operate."
    ]
  },
  {
    id: "availability",
    label: "Store content and availability",
    icon: Scale,
    paragraphs: [
      "The Ysabelle Store name, original site content, and visual materials are owned by the store or their respective rights holders. You may use the website for lawful personal shopping, not for unauthorized copying or commercial exploitation.",
      "Service interruptions, maintenance, and technical issues may affect access from time to time. We aim to keep the storefront reliable, but cannot promise uninterrupted availability. Any limitation of responsibility applies only to the extent permitted by law."
    ]
  },
  {
    id: "contact",
    label: "Changes, questions and contact",
    icon: Mail,
    paragraphs: [
      "We may update these terms to reflect changes in store operations, features, or legal requirements. Material changes should be communicated appropriately, and the published version will display an updated date.",
      "For questions about these terms or an order, use the official Customer Support page. Ysabelle's Store is based at 110 A. Mabini Street, Pasig City, Metro Manila, Philippines."
    ]
  }
];

export function TermsOfServicePage({ navigate }: { navigate: (path: string) => void }) {
  const [tocOpen, setTocOpen] = useState(false);

  return (
    <section className="customer-privacy-page customer-terms-page">
      <div className="customer-privacy-hero">
        <CategoryRetailBackdrop />
        <div className="customer-container customer-privacy-hero__grid">
          <div>
            <div className="customer-privacy-hero__law">
              <Landmark aria-hidden="true" size={16} />
              Philippines · Customer terms and conditions
            </div>
            <p className="customer-eyebrow">Clear shopping terms</p>
            <h1>Terms of Service</h1>
            <p className="customer-privacy-hero__lead">
              A clear guide to shopping, accounts, orders, payments, delivery, and support at
              Ysabelle Store.
            </p>
            <div className="customer-privacy-hero__meta">
              <span>
                <Clock3 aria-hidden="true" size={16} />
                Last updated October 16, 2026
              </span>
              <span>
                <BadgeCheck aria-hidden="true" size={16} />
                Your consumer rights remain protected
              </span>
            </div>
          </div>

          <aside className="customer-privacy-hero__summary" aria-label="Terms summary">
            <div aria-hidden="true" className="customer-privacy-hero__summary-icon">
              <FileCheck2 size={24} />
            </div>
            <p className="customer-kicker">At a glance</p>
            <strong>Shop with clear expectations from checkout to support.</strong>
            <ul>
              <li>Review item details and payment totals before placing an order.</li>
              <li>Keep your account and verification codes secure.</li>
              <li>Contact support if an order or product needs attention.</li>
            </ul>
          </aside>
        </div>
      </div>

      <div className="customer-privacy-body">
        <div aria-hidden="true" className="customer-privacy-body__artwork">
          <StorefrontGalaxyArtwork className="customer-privacy-body__cosmos" />
        </div>
        <div className="customer-container customer-privacy-layout">
          <aside
            aria-label="Terms of Service sections"
            className="customer-privacy-toc"
            data-mobile-open={tocOpen}
          >
            <span className="customer-privacy-toc__eyebrow">On this page</span>
            <button
              aria-controls="customer-terms-toc-links"
              aria-expanded={tocOpen}
              className="customer-privacy-toc__toggle"
              onClick={() => setTocOpen((open) => !open)}
              type="button"
            >
              <span>On this page</span>
              <ChevronDown aria-hidden="true" size={18} />
            </button>
            <nav id="customer-terms-toc-links">
              {TERMS.map((item) => (
                <a href={"#" + item.id} key={item.id} onClick={() => setTocOpen(false)}>
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="customer-privacy-document">
            {TERMS.map((item, index) => (
              <TermsSection
                icon={item.icon}
                id={item.id}
                key={item.id}
                title={String(index + 1) + ". " + item.label}
              >
                {item.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
                {item.id === "privacy" ? (
                  <p>
                    Read our{" "}
                    <CustomerLink href="/privacy" navigate={navigate}>
                      Privacy Policy
                    </CustomerLink>{" "}
                    for additional information.
                  </p>
                ) : null}
                {item.id === "contact" ? (
                  <div className="customer-privacy-contact-actions">
                    <CustomerLink className="customer-button" href="/support" navigate={navigate}>
                      Contact Customer Support
                    </CustomerLink>
                    <CustomerLink
                      className="customer-button customer-button--secondary"
                      href="/privacy"
                      navigate={navigate}
                    >
                      Read Privacy Policy
                    </CustomerLink>
                  </div>
                ) : null}
              </TermsSection>
            ))}
          </article>
        </div>
      </div>
    </section>
  );
}

function TermsSection({
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
    <section aria-labelledby={id + "-title"} className="customer-privacy-section" id={id}>
      <div className="customer-privacy-section__heading">
        <span aria-hidden="true">
          <Icon size={20} />
        </span>
        <h2 id={id + "-title"}>{title}</h2>
      </div>
      <div className="customer-privacy-section__body">{children}</div>
    </section>
  );
}
