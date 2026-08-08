import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Boxes,
  MapPin,
  Package,
  RefreshCw,
  ScanBarcode,
  ShoppingBasket,
  Store
} from "lucide-react";
import { useEffect } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";

const essentialCategories = [
  "Beverages",
  "Snacks",
  "Instant Food",
  "Canned Goods",
  "Personal Care",
  "Household",
  "Kitchen & Dining"
];

export function DiscoverPage({ navigate }: { navigate: (path: string) => void }) {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-story-reveal]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        }),
      { threshold: 0.18 }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="customer-discover">
      <section className="discover-scene discover-welcome" id="discover-welcome">
        <div aria-hidden="true" className="discover-orbit discover-orbit--one" />
        <div aria-hidden="true" className="discover-orbit discover-orbit--two" />
        <div className="customer-container discover-welcome__content" data-story-reveal>
          <span className="discover-chapter">01 · Welcome</span>
          <div className="discover-brand-mark">
            <Store aria-hidden="true" />
          </div>
          <h1>Ysabelle&apos;s Store</h1>
          <p>Everyday essentials, closer to home.</p>
          <strong>Established 2019</strong>
          <a className="discover-continue" href="#discover-beginning">
            Continue <ArrowDown aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="discover-scene discover-beginning" id="discover-beginning">
        <div className="customer-container discover-beginning__grid">
          <div className="discover-year" data-story-reveal>
            2019
          </div>
          <div data-story-reveal>
            <span className="discover-chapter">02 · Our beginning</span>
            <h2>Where our story begins.</h2>
            <p>
              Ysabelle&apos;s Store is a local grocery retail store serving everyday consumer needs.
            </p>
          </div>
        </div>
      </section>

      <section className="discover-scene discover-essentials">
        <div className="customer-container">
          <div className="discover-heading" data-story-reveal>
            <span className="discover-chapter">03 · Everyday essentials</span>
            <h2>
              <strong>300+</strong> everyday products
            </h2>
            <p>Familiar essentials, brought together for easier discovery.</p>
          </div>
          <div className="discover-category-cloud" data-story-reveal>
            {essentialCategories.map((category, index) => (
              <span
                className={`discover-category-chip discover-category-chip--${(index % 4) + 1}`}
                key={category}
              >
                <Package aria-hidden="true" />
                {category}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="discover-scene discover-location">
        <div className="customer-container discover-location__grid">
          <div
            className="discover-map"
            data-story-reveal
            aria-label="Map-inspired illustration marking the store in Pasig City"
            role="img"
          >
            <span className="discover-map__road discover-map__road--one" />
            <span className="discover-map__road discover-map__road--two" />
            <span className="discover-map__river" />
            <span className="discover-map__pin">
              <MapPin aria-hidden="true" />
            </span>
            <small>Pasig City</small>
          </div>
          <div data-story-reveal>
            <span className="discover-chapter">04 · Our location</span>
            <h2>Serving Pasig City.</h2>
            <address>
              110 A. Mabini Street
              <br />
              <strong>Pasig City, Metro Manila</strong>
            </address>
          </div>
        </div>
      </section>

      <section className="discover-scene discover-smarter">
        <div className="customer-container">
          <div className="discover-heading" data-story-reveal>
            <span className="discover-chapter">05 · Growing smarter</span>
            <h2>
              From manual monitoring
              <br />
              toward connected retail.
            </h2>
            <p>Moving toward smarter, data-driven inventory operations.</p>
          </div>
          <div className="discover-operations" data-story-reveal>
            <Operation icon={ScanBarcode} label="Barcode" />
            <i>→</i>
            <Operation icon={Boxes} label="Inventory" />
            <i>→</i>
            <Operation icon={ShoppingBasket} label="Sales" />
            <i>→</i>
            <Operation icon={BarChart3} label="Forecast" />
            <i>→</i>
            <Operation icon={RefreshCw} label="Restocking" />
          </div>
        </div>
      </section>

      <section className="discover-scene discover-shop">
        <div className="customer-container discover-shop__grid">
          <div data-story-reveal>
            <span className="discover-chapter">06 · Shop with Ysabelle</span>
            <h2>Your everyday essentials, easier to discover.</h2>
            <p>Search the real store catalog, explore categories, and build your pickup order.</p>
            <CustomerLink
              className="customer-button customer-button--light"
              href="/shop"
              navigate={navigate}
            >
              Start shopping <ArrowRight aria-hidden="true" size={18} />
            </CustomerLink>
          </div>
          <div aria-hidden="true" className="discover-shop__preview" data-story-reveal>
            <div className="discover-shop__search">Search groceries...</div>
            <div className="discover-shop__cards">
              <span>
                <Package />
                Beverages
              </span>
              <span>
                <Package />
                Snacks
              </span>
              <span>
                <Package />
                Household
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Operation({ icon: Icon, label }: { icon: typeof ScanBarcode; label: string }) {
  return (
    <span>
      <Icon aria-hidden="true" />
      <strong>{label}</strong>
    </span>
  );
}
