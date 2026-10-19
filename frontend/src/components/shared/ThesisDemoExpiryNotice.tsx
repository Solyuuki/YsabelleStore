const NOTICE =
  "THESIS DEMO: Some expiry dates are generated for academic presentation (2028–2029), not manufacturer-verified. Refer to the real package label before selling.";

export function ThesisDemoExpiryNotice() {
  return <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{NOTICE}</p>;
}
