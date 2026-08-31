import { ArrowLeft, Mail, Trash2, UserRoundCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  continueCustomerRememberedAccount,
  forgetCustomerRememberedAccount,
  requestCustomerRememberedVerification,
  verifyCustomerRememberedVerification,
  type CustomerRememberedAccount
} from "@/services/customerAuthService";
import "@/styles/customer-known-accounts.css";

function formatTrust(account: CustomerRememberedAccount) {
  if (!account.trusted) return "Verification required";
  const deadline = new Date(account.trustedUntil);
  if (Number.isNaN(deadline.getTime())) return "Trusted on this device";
  return `Trusted until ${deadline.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}`;
}

export function CustomerKnownAccounts({
  accounts,
  maxAccounts,
  onAccountsChange,
  onAuthenticated,
  onUseAnotherAccount
}: {
  accounts: CustomerRememberedAccount[];
  maxAccounts: number;
  onAccountsChange: (accounts: CustomerRememberedAccount[]) => void;
  onAuthenticated: () => Promise<void> | void;
  onUseAnotherAccount: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [verificationAccount, setVerificationAccount] =
    useState<CustomerRememberedAccount | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleContinue(account: CustomerRememberedAccount) {
    setBusyId(account.id);
    setError(null);
    try {
      const result = await continueCustomerRememberedAccount(account.id);
      if (result.status === "authenticated") {
        await onAuthenticated();
        return;
      }

      await requestCustomerRememberedVerification(account.id);
      setVerificationAccount(result.account);
      setVerificationCode("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to continue with this known account."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleForget(account: CustomerRememberedAccount) {
    setBusyId(account.id);
    setError(null);
    try {
      await forgetCustomerRememberedAccount(account.id);
      const next = accounts.filter((candidate) => candidate.id !== account.id);
      onAccountsChange(next);
      if (verificationAccount?.id === account.id) {
        setVerificationAccount(null);
        setVerificationCode("");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to forget this account."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verificationAccount) return;
    setError(null);
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setBusyId(verificationAccount.id);
    try {
      await verifyCustomerRememberedVerification({
        rememberedAccountId: verificationAccount.id,
        verificationCode
      });
      await onAuthenticated();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to verify this known account."
      );
    } finally {
      setBusyId(null);
    }
  }

  if (verificationAccount) {
    return (
      <section className="customer-known-accounts customer-known-accounts--verify">
        <div className="customer-known-accounts__heading">
          <span className="customer-known-accounts__heading-icon" aria-hidden="true">
            <Mail size={19} />
          </span>
          <div>
            <p className="customer-eyebrow">Known account</p>
            <h2>Verification required</h2>
            <p>
              Enter the code sent to <strong>{verificationAccount.maskedIdentifier}</strong> to
              renew this device for 30 days.
            </p>
          </div>
        </div>

        {error ? (
          <div className="customer-auth-alert" role="alert">
            {error}
          </div>
        ) : null}

        <form className="customer-mobile-auth__form" onSubmit={handleVerification} noValidate>
          <label className="customer-auth-field" htmlFor="customer-known-account-code">
            <span>Verification code</span>
            <input
              autoComplete="one-time-code"
              id="customer-known-account-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              type="text"
              value={verificationCode}
            />
          </label>
          <button
            className="customer-auth-submit"
            disabled={busyId === verificationAccount.id}
            type="submit"
          >
            {busyId === verificationAccount.id ? "Verifying..." : "Verify and continue"}
          </button>
        </form>

        <button
          className="customer-mobile-auth__back"
          disabled={busyId !== null}
          onClick={() => {
            setVerificationAccount(null);
            setVerificationCode("");
            setError(null);
          }}
          type="button"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to known accounts
        </button>
      </section>
    );
  }

  return (
    <section className="customer-known-accounts" aria-label="Known accounts">
      <div className="customer-known-accounts__heading">
        <span className="customer-known-accounts__heading-icon" aria-hidden="true">
          <UserRoundCheck size={20} />
        </span>
        <div>
          <p className="customer-eyebrow">Quick sign in</p>
          <h2>Known accounts</h2>
          <p>
            Continue on this browser without another code while its 30-day trust is active. {" "}
            {accounts.length}/{maxAccounts} slots used.
          </p>
        </div>
      </div>

      {error ? (
        <div className="customer-auth-alert" role="alert">
          {error}
        </div>
      ) : null}

      <div className="customer-known-accounts__list">
        {accounts.map((account) => (
          <article className="customer-known-account" key={account.id}>
            <span className="customer-known-account__icon" aria-hidden="true">
              <Mail size={19} />
            </span>
            <div className="customer-known-account__identity">
              <strong>{account.name}</strong>
              <span>{account.maskedIdentifier}</span>
              <small className={account.trusted ? undefined : "is-expired"}>
                {formatTrust(account)}
              </small>
            </div>
            <div className="customer-known-account__actions">
              <button
                className="customer-known-account__continue"
                disabled={busyId !== null}
                onClick={() => void handleContinue(account)}
                type="button"
              >
                {busyId === account.id ? "Opening..." : "Continue"}
              </button>
              <button
                aria-label={`Forget ${account.name}`}
                className="customer-known-account__forget"
                disabled={busyId !== null}
                onClick={() => void handleForget(account)}
                title="Forget this account"
                type="button"
              >
                <Trash2 aria-hidden="true" size={16} />
                <span>Forget</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      <button
        className="customer-known-accounts__other"
        onClick={onUseAnotherAccount}
        type="button"
      >
        Use another account
      </button>
    </section>
  );
}
