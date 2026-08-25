import { MapPin } from "lucide-react";

import { CustomerLink } from "./CustomerLink";
import { YsabelleBrandMark } from "./YsabelleBrandMark";

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
        <div className="customer-footer__brand-column">
          <div className="customer-brand customer-brand--footer">
            <YsabelleBrandMark />
            <span>
              <strong>Ysabelle</strong>
              <small>Store</small>
            </span>
          </div>
          <p>Everyday essentials, closer to home.</p>
        </div>
        <div className="customer-footer__explore-column">
          <h2>Explore</h2>
          <CustomerLink href="/shop" navigate={navigate}>
            Shop groceries
          </CustomerLink>
          <CustomerLink href="/about" navigate={navigate}>
            About Ysabelle
          </CustomerLink>
          <button onClick={onStartGuide} type="button">
            Shopping Guide
          </button>
        </div>
        <div className="customer-footer__visit-column">
          <h2>Visit us</h2>
          <p className="customer-footer__location">
            <MapPin aria-hidden="true" size={18} />
            <span>
              110 A. Mabini Street
              <br />
              Pasig City, Metro Manila
            </span>
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
