import { MapPin, Store } from "lucide-react";

import { CustomerLink } from "./CustomerLink";

export function CustomerFooter({
  navigate,
  onStartGuide
}: {
  navigate: (path: string) => void;
  onStartGuide: () => void;
}) {
  return (
    <footer className="customer-footer">
      <div className="customer-container customer-footer__grid">
        <div>
          <div className="customer-brand customer-brand--footer">
            <span className="customer-brand__mark">
              <Store aria-hidden="true" size={22} />
            </span>
            <span>
              <strong>Ysabelle</strong>
              <small>Store</small>
            </span>
          </div>
          <p>Everyday essentials, closer to home.</p>
        </div>
        <div>
          <h2>Explore</h2>
          <CustomerLink href="/shop" navigate={navigate}>
            Shop groceries
          </CustomerLink>
          <CustomerLink href="/discover" navigate={navigate}>
            Discover Ysabelle
          </CustomerLink>
          <CustomerLink href="/about" navigate={navigate}>
            About the store
          </CustomerLink>
          <button onClick={onStartGuide} type="button">
            Shopping Guide
          </button>
        </div>
        <div>
          <h2>Visit us</h2>
          <p className="customer-footer__location">
            <MapPin aria-hidden="true" size={18} /> 110 A. Mabini Street
            <br />
            Pasig City, Metro Manila
          </p>
          <CustomerLink className="customer-footer__staff" href="/staff-login" navigate={navigate}>
            Staff / Owner Login
          </CustomerLink>
        </div>
      </div>
      <div className="customer-container customer-footer__bottom">
        <span>Ysabelle&apos;s Store</span>
        <span>Established 2019</span>
      </div>
    </footer>
  );
}
