import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  MapPin,
  PackageCheck,
  ScanBarcode,
  Store
} from "lucide-react";

import { CustomerLink } from "@/components/customer/CustomerLink";

export function AboutPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="customer-page customer-about-page">
      <section className="customer-about-hero">
        <div className="customer-container">
          <p className="customer-kicker">About Ysabelle&apos;s Store</p>
          <h1>
            A local grocery store,
            <br />
            <em>growing thoughtfully.</em>
          </h1>
          <p>
            Everyday grocery and household essentials in Pasig City, with a direction toward smarter
            retail operations and easier shopping.
          </p>
          <CustomerLink className="customer-button" href="/discover" navigate={navigate}>
            Discover the story <ArrowRight aria-hidden="true" size={18} />
          </CustomerLink>
        </div>
      </section>
      <section className="customer-section">
        <div className="customer-container customer-about-facts">
          <article>
            <CalendarDays aria-hidden="true" />
            <strong>2019</strong>
            <span>Established</span>
          </article>
          <article>
            <PackageCheck aria-hidden="true" />
            <strong>300+</strong>
            <span>Products</span>
          </article>
          <article>
            <MapPin aria-hidden="true" />
            <strong>Pasig City</strong>
            <span>Metro Manila</span>
          </article>
        </div>
      </section>
      <section className="customer-section customer-about-story">
        <div className="customer-container customer-about-story__grid">
          <div>
            <p className="customer-kicker">Everyday essentials</p>
            <h2>Built around the things people need.</h2>
          </div>
          <div>
            <p>
              Ysabelle&apos;s Store is a grocery and retail store offering beverages, canned goods,
              snacks, instant noodles, toiletries, household products, and other everyday
              essentials.
            </p>
            <p>
              The store&apos;s catalog now includes more than 300 products, organized to make daily
              shopping easier to navigate.
            </p>
          </div>
        </div>
      </section>
      <section className="customer-section">
        <div className="customer-container customer-modernization">
          <div className="customer-modernization__copy">
            <p className="customer-kicker">Growing smarter</p>
            <h2>From manual monitoring toward data-driven retail.</h2>
            <p>
              Inventory was historically monitored manually. YsabelleStore supports the move toward
              connected barcode sales, inventory visibility, demand forecasting, and informed
              restocking.
            </p>
          </div>
          <div className="customer-modernization__flow" aria-label="Retail modernization flow">
            <span>
              <ScanBarcode aria-hidden="true" /> Barcode
            </span>
            <i>→</i>
            <span>
              <Boxes aria-hidden="true" /> Inventory
            </span>
            <i>→</i>
            <span>
              <BarChart3 aria-hidden="true" /> Forecast
            </span>
            <i>→</i>
            <span>
              <Store aria-hidden="true" /> Store
            </span>
          </div>
        </div>
      </section>
      <section className="customer-section customer-visit">
        <div className="customer-container customer-visit__card">
          <div>
            <MapPin aria-hidden="true" />
            <p className="customer-kicker">Visit the store</p>
            <h2>110 A. Mabini Street</h2>
            <p>Pasig City, Metro Manila</p>
          </div>
          <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
            Shop groceries <ArrowRight aria-hidden="true" size={18} />
          </CustomerLink>
        </div>
      </section>
    </div>
  );
}
