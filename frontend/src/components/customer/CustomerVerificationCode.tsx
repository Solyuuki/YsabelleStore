import { REGEXP_ONLY_DIGITS } from "input-otp";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import "@/styles/customer-verification-code.css";

export function CustomerVerificationCode({
  autoFocus = false,
  disabled = false,
  hint,
  invalid = false,
  label = "6-digit verification code",
  onChange,
  value
}: {
  autoFocus?: boolean;
  disabled?: boolean;
  hint?: string;
  invalid?: boolean;
  label?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="customer-verification-code">
      <span className="customer-verification-code__label">{label}</span>
      <div className="customer-verification-code__shell">
        <InputOTP
          aria-invalid={invalid}
          aria-label={label}
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          className="customer-verification-code__control"
          containerClassName="customer-verification-code__container"
          disabled={disabled}
          inputMode="numeric"
          maxLength={6}
          onChange={onChange}
          pattern={REGEXP_ONLY_DIGITS}
          value={value}
        >
          <InputOTPGroup className="customer-verification-code__group">
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot
                className="customer-verification-code__slot"
                index={index}
                key={index}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {hint ? <small className="customer-verification-code__hint">{hint}</small> : null}
    </div>
  );
}
