import {
  CheckCircle2,
  CircleHelp,
  Clock3,
  Headphones,
  LockKeyhole,
  MessageSquareText,
  PackageSearch,
  ShieldCheck
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { submitCustomerSupportTicket } from "@/services/customerSupportService";
import type {
  CustomerSupportCategory,
  CustomerSupportTicketCreated
} from "@/types/customerSupport";

const CATEGORY_OPTIONS: Array<{ value: CustomerSupportCategory; label: string }> = [
  { value: "ORDER", label: "Order" },
  { value: "PAYMENT", label: "Payment" },
  { value: "PRODUCT", label: "Product" },
  { value: "PICKUP_DELIVERY", label: "Pickup or delivery" },
  { value: "ACCOUNT", label: "Account" },
  { value: "RETURN_REFUND", label: "Return or refund" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "OTHER", label: "Other" }
];

const FAQS = [
  {
    question: "Do I need an account to contact support?",
    answer:
      "No. You can send a support request as a guest. If you are signed in, your verified account contact details are attached automatically."
  },
  {
    question: "Should I include my order number?",
    answer:
      "Include it when your concern is about an order, payment, pickup, delivery, return, or refund. This helps the support team connect your request to the right purchase."
  },
  {
    question: "What should I avoid sending?",
    answer:
      "Do not include passwords, one-time passwords, full card details, or other authentication secrets. Support does not need them to review your request."
  },
  {
    question: "How do I follow up on my request?",
    answer:
      "Keep the YS-CS ticket reference shown after submission. That reference identifies your support conversation for future follow-up."
  },
  {
    question: "Can I report product or account issues here?",
    answer:
      "Yes. Choose the closest category and describe what happened, what you expected, and any safe details that can help reproduce or verify the issue."
  },
  {
    question: "How do I make a privacy request?",
    answer:
      "Choose Account or Other, use “Privacy Request” in the subject, and describe whether you want access, correction, objection, deletion or blocking, portability, or another privacy review. We may verify your identity before acting on a request."
  }
] as const;

function errorMessage(reason: unknown) {
  return reason instanceof Error && reason.message
    ? reason.message
    : "Your support request could not be submitted. Please try again.";
}

export function CustomerSupportPage({ navigate }: { navigate: (path: string) => void }) {
  const { customer, status } = useCustomerAuth();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [category, setCategory] = useState<CustomerSupportCategory>("ORDER");
  const [orderNumber, setOrderNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [createdTicket, setCreatedTicket] = useState<CustomerSupportTicketCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const signedIn = status === "authenticated" && Boolean(customer);

  useEffect(() => {
    if (!customer) return;
    setCustomerName(customer.name);
    setCustomerEmail(customer.email);
    setCustomerPhone(customer.phone ?? "");
  }, [customer]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (customerName.trim().length < 2) {
      setSubmitError("Enter your name.");
      return;
    }
    if (!customerEmail.trim()) {
      setSubmitError("Enter a valid email address.");
      return;
    }
    if (subject.trim().length < 4) {
      setSubmitError("Enter a subject with at least 4 characters.");
      return;
    }
    if (message.trim().length < 10) {
      setSubmitError("Tell us a little more about the concern.");
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await submitCustomerSupportTicket({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || undefined,
        category,
        orderNumber: orderNumber.trim() || undefined,
        subject: subject.trim(),
        message: message.trim()
      });
      setCreatedTicket(ticket);
      setOrderNumber("");
      setSubject("");
      setMessage("");
    } catch (reason) {
      setSubmitError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  function startAnotherRequest() {
    setCreatedTicket(null);
    setSubmitError(null);
    setCategory("ORDER");
  }

  return (
    <section className="customer-support-page">
      <div className="customer-support-hero">
        <div className="customer-container customer-support-hero__grid">
          <div>
            <p className="customer-eyebrow">Customer support</p>
            <h1>Tell us what happened. We&apos;ll keep it organized.</h1>
            <p className="customer-support-hero__lead">
              Send one clear request and receive a ticket reference you can keep for follow-up.
              Order numbers are optional, but useful for purchase-related concerns.
            </p>
            <div className="customer-support-hero__signals" aria-label="Support safeguards">
              <span>
                <ShieldCheck aria-hidden="true" size={17} />
                Structured request
              </span>
              <span>
                <LockKeyhole aria-hidden="true" size={17} />
                No passwords or OTPs
              </span>
              <span>
                <MessageSquareText aria-hidden="true" size={17} />
                Trackable ticket reference
              </span>
            </div>
          </div>

          <aside className="customer-support-hero__card">
            <Headphones aria-hidden="true" size={28} />
            <p className="customer-kicker">Support workflow</p>
            <strong>One request, one reference.</strong>
            <p>
              After submission, you&apos;ll receive a reference such as <span>YS-CS-000124</span>.
              Keep it with your concern details.
            </p>
          </aside>
        </div>
      </div>

      <div className="customer-container customer-support-grid">
        <section className="customer-support-form-card" aria-labelledby="support-form-title">
          {createdTicket ? (
            <div className="customer-support-success" role="status">
              <span className="customer-support-success__icon">
                <CheckCircle2 aria-hidden="true" size={28} />
              </span>
              <p className="customer-eyebrow">Request received</p>
              <h2 id="support-form-title">Your support ticket is ready.</h2>
              <p>
                Keep this reference for follow-up. Your request has been recorded for the support
                team.
              </p>
              <div className="customer-support-reference">
                <span>Ticket reference</span>
                <strong>{createdTicket.ticketNumber}</strong>
              </div>
              <div className="customer-support-success__actions">
                <button className="customer-button" onClick={startAnotherRequest} type="button">
                  Send another request
                </button>
                <button
                  className="customer-button customer-button--secondary"
                  onClick={() => navigate("/shop")}
                  type="button"
                >
                  Continue shopping
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="customer-support-section-heading">
                <div>
                  <p className="customer-eyebrow">Contact support</p>
                  <h2 id="support-form-title">How can we help?</h2>
                </div>
                <span>
                  <Clock3 aria-hidden="true" size={16} />
                  Reviewed during store operations
                </span>
              </div>

              {signedIn ? (
                <div className="customer-support-account-note">
                  <ShieldCheck aria-hidden="true" size={18} />
                  <span>
                    Signed in as <strong>{customer?.email}</strong>. Your verified account contact
                    details will be used for this ticket.
                  </span>
                </div>
              ) : null}

              <form
                className="customer-support-form"
                onSubmit={(event) => void handleSubmit(event)}
              >
                <div className="customer-support-form__two-column">
                  <label>
                    <span>Name</span>
                    <div
                      aria-describedby={signedIn ? "support-name-locked-help" : undefined}
                      className={
                        signedIn
                          ? "customer-support-input-shell customer-support-input-shell--locked"
                          : "customer-support-input-shell"
                      }
                      tabIndex={signedIn ? 0 : undefined}
                    >
                      <input
                        autoComplete="name"
                        disabled={signedIn}
                        maxLength={120}
                        onChange={(event) => setCustomerName(event.target.value)}
                        required
                        value={customerName}
                      />
                      {signedIn ? (
                        <>
                          <LockKeyhole
                            aria-hidden="true"
                            className="customer-support-input-lock"
                            size={15}
                          />
                          <span
                            className="customer-support-field-tooltip"
                            id="support-name-locked-help"
                            role="tooltip"
                          >
                            Locked while signed in. Change your name in My Account.
                          </span>
                        </>
                      ) : null}
                    </div>
                  </label>
                  <label>
                    <span>Email</span>
                    <div
                      aria-describedby={signedIn ? "support-email-locked-help" : undefined}
                      className={
                        signedIn
                          ? "customer-support-input-shell customer-support-input-shell--locked"
                          : "customer-support-input-shell"
                      }
                      tabIndex={signedIn ? 0 : undefined}
                    >
                      <input
                        autoComplete="email"
                        disabled={signedIn}
                        maxLength={191}
                        onChange={(event) => setCustomerEmail(event.target.value)}
                        required
                        type="email"
                        value={customerEmail}
                      />
                      {signedIn ? (
                        <>
                          <LockKeyhole
                            aria-hidden="true"
                            className="customer-support-input-lock"
                            size={15}
                          />
                          <span
                            className="customer-support-field-tooltip"
                            id="support-email-locked-help"
                            role="tooltip"
                          >
                            Verified account email. It identifies your ticket and cannot be changed here.
                          </span>
                        </>
                      ) : null}
                    </div>
                  </label>
                </div>

                <div className="customer-support-form__two-column">
                  <label>
                    <span>
                      Phone <small>optional</small>
                    </span>
                    <div
                      aria-describedby={signedIn ? "support-phone-locked-help" : undefined}
                      className={
                        signedIn
                          ? "customer-support-input-shell customer-support-input-shell--locked"
                          : "customer-support-input-shell"
                      }
                      tabIndex={signedIn ? 0 : undefined}
                    >
                      <input
                        autoComplete="tel"
                        disabled={signedIn}
                        maxLength={40}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        type="tel"
                        value={customerPhone}
                      />
                      {signedIn ? (
                        <>
                          <LockKeyhole
                            aria-hidden="true"
                            className="customer-support-input-lock"
                            size={15}
                          />
                          <span
                            className="customer-support-field-tooltip"
                            id="support-phone-locked-help"
                            role="tooltip"
                          >
                            Uses your account phone. Update contact details in My Account.
                          </span>
                        </>
                      ) : null}
                    </div>
                  </label>
                  <label>
                    <span>Concern type</span>
                    <select
                      onChange={(event) =>
                        setCategory(event.target.value as CustomerSupportCategory)
                      }
                      value={category}
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  <span>
                    Order number <small>optional</small>
                  </span>
                  <input
                    autoCapitalize="characters"
                    maxLength={80}
                    onChange={(event) => setOrderNumber(event.target.value)}
                    placeholder="Example: YS-20260930-ABC123"
                    value={orderNumber}
                  />
                </label>

                <label>
                  <span>Subject</span>
                  <input
                    maxLength={160}
                    minLength={4}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Short summary of the concern"
                    required
                    value={subject}
                  />
                </label>

                <label>
                  <span>Message</span>
                  <textarea
                    maxLength={5000}
                    minLength={10}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe what happened and include any safe details that may help us review it."
                    required
                    rows={7}
                    value={message}
                  />
                  <small className="customer-support-character-count">
                    {message.length.toLocaleString()} / 5,000
                  </small>
                </label>

                <div className="customer-support-safety-note">
                  <LockKeyhole aria-hidden="true" size={18} />
                  <span>
                    Never send your password, OTP, full card number, CVV, or other sign-in secrets.
                  </span>
                </div>

                {submitError ? (
                  <p className="customer-support-error" role="alert">
                    {submitError}
                  </p>
                ) : null}

                <button className="customer-button customer-support-submit" disabled={submitting}>
                  {submitting ? "Submitting request..." : "Submit support request"}
                </button>
              </form>
            </>
          )}
        </section>

        <aside className="customer-support-sidebar">
          <div className="customer-support-info-card">
            <PackageSearch aria-hidden="true" size={22} />
            <h2>For order concerns</h2>
            <p>
              Include the order number shown in your order history or confirmation when available.
              It helps connect the ticket to the correct purchase without exposing payment secrets.
            </p>
            <button
              className="customer-support-text-action"
              onClick={() => navigate(signedIn ? "/account" : "/login?returnTo=%2Faccount")}
              type="button"
            >
              {signedIn ? "Open my orders" : "Sign in to view orders"}
            </button>
          </div>

          <div className="customer-support-info-card customer-support-info-card--soft">
            <CircleHelp aria-hidden="true" size={22} />
            <h2>Give useful details</h2>
            <p>
              Mention what you were trying to do, what happened, and what you expected. Avoid
              sensitive authentication or payment information.
            </p>
          </div>
        </aside>
      </div>

      <div className="customer-container customer-support-faq">
        <div className="customer-support-faq__heading">
          <p className="customer-eyebrow">Frequently asked questions</p>
          <h2>Before you send a request</h2>
          <p>Quick answers for common support questions.</p>
        </div>
        <div className="customer-support-faq__list">
          {FAQS.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
