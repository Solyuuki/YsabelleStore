import { Mail, Smartphone } from "lucide-react";

import type { CustomerSocialAuthProvider } from "@/services/customerSocialAuthService";

type CustomerSocialAuthButtonsProps = {
  busyProvider: CustomerSocialAuthProvider | null;
  emailHelperText?: string;
  mobileHelperText?: string;
  onEmailStart?: () => void;
  onMobileStart?: () => void;
  onStart: (provider: CustomerSocialAuthProvider) => void;
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18">
      <path
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.91-2.258c-.805.54-1.835.859-3.046.859-2.344 0-4.328-1.585-5.036-3.714H.957v2.332A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.282-1.706V4.962H.957A9 9 0 0 0 0 9c0 1.45.347 2.824.957 4.038l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.507.454 3.441 1.345l2.581-2.582C13.463.89 11.426 0 9 0A9 9 0 0 0 .957 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function CustomerSocialAuthButtons({
  busyProvider,
  emailHelperText = "Use your verified account email",
  mobileHelperText = "Use your registered PH mobile number",
  onEmailStart,
  onMobileStart,
  onStart
}: CustomerSocialAuthButtonsProps) {
  return (
    <div className="customer-social-auth" aria-label="Quick sign-in options">
      <button
        className="customer-social-auth__button customer-social-auth__button--google"
        disabled={busyProvider !== null}
        onClick={() => onStart("google")}
        type="button"
      >
        <span className="customer-social-auth__mark">
          <GoogleMark />
        </span>
        <span>{busyProvider === "google" ? "Opening Google..." : "Continue with Google"}</span>
      </button>

      {onEmailStart ? (
        <button
          className="customer-social-auth__button customer-social-auth__button--email"
          disabled={busyProvider !== null}
          onClick={onEmailStart}
          type="button"
        >
          <span className="customer-social-auth__mark customer-social-auth__mark--email">
            <Mail aria-hidden="true" size={20} />
          </span>
          <span>
            Continue with Email OTP
            <small>{emailHelperText}</small>
          </span>
        </button>
      ) : null}

      {onMobileStart ? (
        <button
          className="customer-social-auth__button customer-social-auth__button--mobile"
          disabled={busyProvider !== null}
          onClick={onMobileStart}
          type="button"
        >
          <span className="customer-social-auth__mark customer-social-auth__mark--mobile">
            <Smartphone aria-hidden="true" size={20} />
          </span>
          <span>
            Continue with Mobile OTP
            <small>{mobileHelperText}</small>
          </span>
        </button>
      ) : null}
    </div>
  );
}
