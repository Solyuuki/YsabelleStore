import type { CustomerSocialAuthProvider } from "@/services/customerSocialAuthService";

type CustomerSocialAuthButtonsProps = {
  busyProvider: CustomerSocialAuthProvider | null;
  onStart: (provider: CustomerSocialAuthProvider) => void;
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M21.6 12.23c0-.71-.06-1.23-.2-1.78H12v3.38h5.52a4.71 4.71 0 0 1-2.05 3.09l-.02.11 2.98 2.31.21.02c1.93-1.78 2.96-4.4 2.96-7.13Z" fill="currentColor" />
      <path d="M12 22c2.7 0 4.96-.89 6.61-2.42l-3.15-2.44c-.84.57-1.96.97-3.46.97-2.6 0-4.8-1.76-5.59-4.19l-.11.01-3.1 2.4-.04.1A10 10 0 0 0 12 22Z" fill="currentColor" opacity=".82" />
      <path d="M6.41 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.31.32-1.92v-.12L3.26 7.52l-.1.05A10 10 0 0 0 2 12c0 1.6.38 3.11 1.16 4.43l3.25-2.51Z" fill="currentColor" opacity=".62" />
      <path d="M12 5.89c1.88 0 3.15.81 3.88 1.49l2.8-2.74C16.97 3.04 14.7 2 12 2a10 10 0 0 0-8.84 5.57l3.24 2.51C7.2 7.65 9.4 5.89 12 5.89Z" fill="currentColor" opacity=".72" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M13.45 21v-8h2.68l.4-3.12h-3.08V7.89c0-.9.25-1.52 1.55-1.52h1.65V3.58c-.29-.04-1.27-.12-2.42-.12-2.4 0-4.04 1.46-4.04 4.15v2.27H7.48V13h2.71v8h3.26Z" fill="currentColor" />
    </svg>
  );
}

export function CustomerSocialAuthButtons({
  busyProvider,
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
        <span className="customer-social-auth__mark"><GoogleMark /></span>
        <span>{busyProvider === "google" ? "Opening Google..." : "Continue with Google"}</span>
      </button>

      <button
        className="customer-social-auth__button customer-social-auth__button--facebook"
        disabled={busyProvider !== null}
        onClick={() => onStart("facebook")}
        type="button"
      >
        <span className="customer-social-auth__mark"><FacebookMark /></span>
        <span>{busyProvider === "facebook" ? "Opening Facebook..." : "Continue with Facebook"}</span>
      </button>
    </div>
  );
}
