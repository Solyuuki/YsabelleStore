import { ArrowLeft, Mail, MoreVertical, Trash2, UserRoundCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import {
  continueCustomerRememberedAccount,
  forgetCustomerRememberedAccount,
  requestCustomerRememberedVerification,
  verifyCustomerRememberedVerification,
  type CustomerRememberedAccount
} from "@/services/customerAuthService";
import "@/styles/customer-known-accounts.css";

const TRUST_DAY_MS = 24 * 60 * 60 * 1000;

function formatTrust(account: CustomerRememberedAccount) {
  if (!account.trusted) return "Verification required";
  const deadline = new Date(account.trustedUntil).getTime();
  if (Number.isNaN(deadline)) return "Verification required";
  const daysRemaining = Math.ceil((deadline - Date.now()) / TRUST_DAY_MS);
  if (daysRemaining <= 0) return "Verification required";
  return daysRemaining === 1 ? "1 day left" : `${daysRemaining} days left`;
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [verificationAccount, setVerificationAccount] = useState<CustomerRememberedAccount | null>(
    null
  );
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;

    function closeMenuOnOutsidePress(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-known-account-menu]")) {
        setOpenMenuId(null);
      }
    }

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenuId(null);
    }

    document.addEventListener("pointerdown", closeMenuOnOutsidePress);
    document.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsidePress);
      document.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [openMenuId]);

  async function handleContinue(account: CustomerRememberedAccount) {
    setOpenMenuId(null);
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
    setOpenMenuId(null);
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
        caughtError instanceof Error ? caughtError.message : "Unable to forget this account."
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
        caughtError instanceof Error ? caughtError.message : "Unable to verify this known account."
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
          Back to saved email accounts
        </button>
      </section>
    );
  }

  return (
    <section className="customer-known-accounts" aria-label="Saved email accounts">
      <div className="customer-known-accounts__heading">
        <span className="customer-known-accounts__heading-icon" aria-hidden="true">
          <UserRoundCheck size={20} />
        </span>
        <div className="customer-known-accounts__heading-copy">
          <p className="customer-eyebrow">Email Quick Sign</p>
          <div className="customer-known-accounts__title-row">
            <h2>Saved email accounts</h2>
            <span
              aria-label={`${accounts.length} of ${maxAccounts} saved email accounts`}
              className="customer-known-accounts__capacity"
            >
              {accounts.length}/{maxAccounts}
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="customer-auth-alert" role="alert">
          {error}
        </div>
      ) : null}

      <div className="customer-known-accounts__list">
        {accounts.map((account) => {
          const menuId = `customer-known-account-menu-${account.id}`;
          const menuOpen = openMenuId === account.id;

          return (
            <article className="customer-known-account" key={account.id}>
              <button
                aria-label={`Continue with ${account.name}`}
                className="customer-known-account__select"
                disabled={busyId !== null}
                onClick={() => void handleContinue(account)}
                type="button"
              >
                <span className="customer-known-account__icon" aria-hidden="true">
                  <Mail size={19} />
                </span>
                <span className="customer-known-account__identity">
                  <strong>{account.name}</strong>
                  <span>{account.maskedIdentifier}</span>
                  <small className={account.trusted ? undefined : "is-expired"}>
                    {busyId === account.id ? "Opening..." : formatTrust(account)}
                  </small>
                </span>
              </button>

              <div className="customer-known-account__menu-wrap" data-known-account-menu>
                <button
                  aria-controls={menuId}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label={`More options for ${account.name}`}
                  className="customer-known-account__menu-trigger"
                  disabled={busyId !== null}
                  onClick={() => setOpenMenuId((current) => (current === account.id ? null : account.id))}
                  type="button"
                >
                  <MoreVertical aria-hidden="true" size={19} />
                </button>

                {menuOpen ? (
                  <div className="customer-known-account__menu" id={menuId} role="menu">
                    <button
                      className="customer-known-account__menu-item"
                      disabled={busyId !== null}
                      onClick={() => void handleForget(account)}
                      role="menuitem"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                      <span>Forget</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <button
        className="customer-known-accounts__other"
        onClick={onUseAnotherAccount}
        type="button"
      >
        Use another email
      </button>
    </section>
  );
}
