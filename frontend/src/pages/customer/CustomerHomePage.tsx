import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  MapPin,
  Search,
  ShoppingBasket,
  Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { ProductCard } from "@/components/customer/ProductCard";
import { fetchStorefrontCategories, fetchStorefrontProducts } from "@/services/storefrontService";
import type { StorefrontCategory, StorefrontProduct } from "@/types/storefront";

export function CustomerHomePage({ navigate }: { navigate: (path: string) => void }) {
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchStorefrontCategories(controller.signal),
      fetchStorefrontProducts({ availability: "in-stock", pageSize: 8 }, controller.signal)
    ])
      .then(([nextCategories, result]) => {
        setCategories(nextCategories);
        setProducts(result.items);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "The shop could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <section className="customer-hero">
        <div className="customer-container customer-hero__grid">
          <div className="customer-hero__copy customer-reveal is-visible">
            <p className="customer-kicker">
              <span /> Local grocery shopping in Pasig City
            </p>
            <h1>
              Everyday essentials, <em>made easier.</em>
            </h1>
            <p className="customer-hero__lead">
              Shop groceries and household essentials from Ysabelle&apos;s Store.
            </p>
            <div className="customer-hero__actions">
              <CustomerLink
                className="customer-button"
                data-tour="start-shopping"
                href="/shop"
                navigate={navigate}
              >
                Shop groceries <ArrowRight aria-hidden="true" size={18} />
              </CustomerLink>
              <CustomerLink
                className="customer-button customer-button--secondary"
                href="/about"
                navigate={navigate}
              >
                <Sparkles aria-hidden="true" size={17} /> Discover Ysabelle
              </CustomerLink>
            </div>
            <div className="customer-hero__trust">
              <span>
                <BadgeCheck aria-hidden="true" /> 300+ products
              </span>
              <span>
                <Clock3 aria-hidden="true" /> Established 2019
              </span>
              <span>
                <MapPin aria-hidden="true" /> Pasig City
              </span>
            </div>
          </div>

          <div aria-hidden="true" className="customer-hero__market">
            <div className="customer-hero__sun" />
            <div className="customer-hero__basket">
              <ShoppingBasket size={76} />
              <span className="market-item market-item--one">Drinks</span>
              <span className="market-item market-item--two">Snacks</span>
              <span className="market-item market-item--three">Home</span>
            </div>
            <div className="customer-hero__search-card">
              <Search size={18} /> Find what you need
            </div>
            <div className="customer-hero__note">
              Freshly organized
              <br />
              <strong>for your everyday list</strong>
            </div>
          </div>
        </div>
      </section>

      <section
        className="customer-section customer-categories"
        data-tour="categories"
        id="categories"
      >
        <div className="customer-container">
          <div className="customer-section-heading">
            <div>
              <p className="customer-kicker">Shop your way</p>
              <h2>Start with a category</h2>
            </div>
            <CustomerLink href="/shop" navigate={navigate}>
              View all <ArrowRight aria-hidden="true" size={16} />
            </CustomerLink>
          </div>
          {categories.length ? (
            <div className="customer-category-grid">
              {categories.slice(0, 8).map((category, index) => (
                <CustomerLink
                  className={`customer-category-card customer-category-card--${(index % 4) + 1}`}
                  href={`/shop/category/${category.slug}`}
                  key={category.id}
                  navigate={navigate}
                >
                  <span className="customer-category-card__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{category.name}</strong>
                  <small>
                    {category.productCount} product{category.productCount === 1 ? "" : "s"}
                  </small>
                  <ArrowRight aria-hidden="true" size={17} />
                </CustomerLink>
              ))}
            </div>
          ) : (
            <HomeLoading message={error || "Loading categories..."} />
          )}
        </div>
      </section>

      <section className="customer-section customer-featured">
        <div className="customer-container">
          <div className="customer-section-heading">
            <div>
              <p className="customer-kicker">Easy picks</p>
              <h2>Everyday essentials</h2>
              <p>Current products available from the store catalog.</p>
            </div>
            <CustomerLink href="/shop" navigate={navigate}>
              Shop all <ArrowRight aria-hidden="true" size={16} />
            </CustomerLink>
          </div>
          {products.length ? (
            <div className="customer-product-grid">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  navigate={navigate}
                  product={product}
                  tourTarget={index === 0}
                />
              ))}
            </div>
          ) : (
            <HomeLoading message={error || "Loading products..."} />
          )}
        </div>
      </section>

      <section className="customer-section customer-pickup-band" data-tour="checkout">
        <div className="customer-container customer-pickup-band__inner">
          <div>
            <p className="customer-kicker">Simple checkout</p>
            <h2>Order online, pick up at the store.</h2>
            <p>Review your list, send your pickup request, and pay cash when you collect it.</p>
          </div>
          <CustomerLink
            className="customer-button customer-button--light"
            href="/shop"
            navigate={navigate}
          >
            Build your basket <ArrowRight aria-hidden="true" size={18} />
          </CustomerLink>
        </div>
      </section>
    </>
  );
}

function HomeLoading({ message }: { message: string }) {
  return (
    <div className="customer-inline-state" role="status">
      {message}
    </div>
  );
}
