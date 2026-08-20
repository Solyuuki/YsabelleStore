import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Check,
  Package,
  Search,
  ShoppingBasket,
  ShoppingCart,
  Store
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import { ProductVisual } from "@/components/customer/ProductVisual";
import { useCart } from "@/context/CartContext";
import { fetchStorefrontProducts } from "@/services/storefrontService";
import type { StorefrontProduct } from "@/types/storefront";

gsap.registerPlugin(ScrollTrigger);

type CatalogStatus = "error" | "loading" | "ready";

const handoffSignals = ["Live catalog", "Current stock", "Pickup ready"] as const;

export function AboutStorefrontHandoff({ navigate }: { navigate: (path: string) => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [catalogError, setCatalogError] = useState("");
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const { addItem } = useCart();

  useEffect(() => {
    const controller = new AbortController();

    setProducts([]);
    setCatalogError("");
    setCatalogStatus("loading");

    fetchStorefrontProducts(
      {
        availability: "in-stock",
        page: 1,
        pageSize: 3
      },
      controller.signal
    )
      .then(({ items }) => {
        if (controller.signal.aborted) return;

        const availableProducts = items
          .filter((product) => product.availableStock > 0)
          .slice(0, 3);

        setProducts(availableProducts);
        setCatalogStatus("ready");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;

        setCatalogError(
          reason instanceof Error ? reason.message : "The live catalog could not be reached."
        );
        setCatalogStatus("error");
      });

    return () => controller.abort();
  }, [catalogReloadKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const copy = Array.from(root.querySelectorAll<HTMLElement>("[data-handoff-copy]"));
        const proofs = Array.from(root.querySelectorAll<HTMLElement>("[data-handoff-proof]"));
        const store = root.querySelector<HTMLElement>("[data-handoff-store]");
        const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-handoff-card]"));

        if (!copy.length || !proofs.length || !store) return;

        gsap.set(copy, { autoAlpha: 0, x: -28, y: 12 });
        gsap.set(proofs, { autoAlpha: 0, scale: 0.92, y: 10 });
        gsap.set(store, { autoAlpha: 0, rotateY: -4, scale: 0.965, x: 34, y: 28 });
        if (cards.length) gsap.set(cards, { autoAlpha: 0, scale: 0.96, y: 18 });

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top 78%",
            end: "top 24%",
            invalidateOnRefresh: true,
            scrub: 0.55
          }
        });

        timeline
          .to(copy, {
            autoAlpha: 1,
            duration: 0.34,
            ease: "power2.out",
            stagger: 0.055,
            x: 0,
            y: 0
          })
          .to(
            proofs,
            {
              autoAlpha: 1,
              duration: 0.2,
              ease: "power2.out",
              scale: 1,
              stagger: 0.04,
              y: 0
            },
            0.18
          )
          .to(
            store,
            {
              autoAlpha: 1,
              duration: 0.42,
              ease: "power2.out",
              rotateY: 0,
              scale: 1,
              x: 0,
              y: 0
            },
            0.16
          );

        if (cards.length) {
          timeline.to(
            cards,
            {
              autoAlpha: 1,
              duration: 0.24,
              ease: "power2.out",
              scale: 1,
              stagger: 0.05,
              y: 0
            },
            0.48
          );
        }
      }, root);

      return () => context.revert();
    });

    return () => media.revert();
  }, [products.length]);

  return (
    <section
      className="story-scene story-shop story-shop--refined"
      id="discover-shop"
      ref={rootRef}
    >
      <div aria-hidden="true" className="story-shop__atmosphere">
        <span className="story-shop__glow story-shop__glow--blue" />
        <span className="story-shop__glow story-shop__glow--violet" />
        <span className="story-shop__grid" />
      </div>

      <div className="customer-container story-shop__stage">
        <div className="story-shop__copy">
          <span className="story-kicker" data-handoff-copy>
            06 / Shop with Ysabelle
          </span>
          <h2 className="story-display-safe" data-handoff-copy>
            <span className="story-mask">
              <span className="story-mask__line">From Local Roots</span>
            </span>
            <span className="story-mask">
              <span className="story-mask__line story-mask__line--sky">
                to Smarter Retail.
              </span>
            </span>
          </h2>
          <p data-handoff-copy>
            The same neighborhood essentials are now easier to discover, verify, and prepare for
            pickup through the live YsabelleStore catalog.
          </p>

          <ul aria-label="Storefront capabilities" className="story-shop__proofs">
            {handoffSignals.map((signal) => (
              <li data-handoff-proof key={signal}>
                <Check aria-hidden="true" />
                {signal}
              </li>
            ))}
          </ul>

          <CustomerLink
            className="customer-button customer-button--light story-shop__primary-action"
            data-handoff-copy
            href="/shop"
            navigate={navigate}
          >
            Shop the live catalog <ArrowRight aria-hidden="true" size={18} />
          </CustomerLink>
        </div>

        <div className="story-live-store story-live-store--refined" data-handoff-store>
          <div className="story-live-store__bar">
            <span>
              <Store aria-hidden="true" />
              <span className="story-live-store__identity">
                <strong>Ysabelle&apos;s Store</strong>
                <small>Live catalog</small>
              </span>
            </span>
            <CustomerLink
              aria-label="Open cart"
              className="story-live-store__cart"
              href="/cart"
              navigate={navigate}
            >
              <ShoppingCart aria-hidden="true" />
            </CustomerLink>
          </div>

          <CustomerLink className="story-live-store__search" href="/shop" navigate={navigate}>
            <Search aria-hidden="true" />
            Search products and categories
            <ArrowRight aria-hidden="true" />
          </CustomerLink>

          <div className="story-live-store__signals" aria-label="Live storefront status">
            <span>
              <i aria-hidden="true" /> Current stock
            </span>
            <span>Pickup ready</span>
          </div>

          {catalogStatus === "ready" && products.length ? (
            <div className="story-live-store__products">
              {products.map((product) => (
                <article className="story-live-product" data-handoff-card key={product.id}>
                  <CustomerLink
                    aria-label={`View ${product.name}`}
                    href={`/product/${product.id}`}
                    navigate={navigate}
                  >
                    <ProductVisual
                      category={product.category.name}
                      imageUrl={product.imageUrl}
                      name={product.name}
                      showCategory={false}
                    />
                  </CustomerLink>
                  <div className="story-live-product__body">
                    <small>{product.category.name}</small>
                    <CustomerLink href={`/product/${product.id}`} navigate={navigate}>
                      <h3>{product.name}</h3>
                    </CustomerLink>
                    <strong>{formatCurrency(product.sellingPrice)}</strong>
                    <span
                      className={`story-live-product__stock story-live-product__stock--${product.stockStatus.toLowerCase()}`}
                    >
                      {product.stockStatus === "LOW_STOCK"
                        ? `Only ${product.availableStock} left`
                        : "In stock"}
                    </span>
                    <button onClick={() => addItem(product, 1)} type="button">
                      <ShoppingBasket aria-hidden="true" />
                      Quick add
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="story-live-store__unavailable" role="status">
              <Package aria-hidden="true" />
              <div>
                <strong>
                  {catalogStatus === "loading"
                    ? "Preparing the live shelf"
                    : catalogStatus === "error"
                      ? "Live catalog preview unavailable"
                      : "The live shelf is being restocked"}
                </strong>
                <p>
                  {catalogStatus === "loading"
                    ? "Checking current stock before products appear here."
                    : catalogStatus === "error"
                      ? catalogError
                      : "Open the full catalog to browse every currently listed product."}
                </p>
                {catalogStatus === "error" ? (
                  <button
                    onClick={() => setCatalogReloadKey((current) => current + 1)}
                    type="button"
                  >
                    Retry connection
                  </button>
                ) : (
                  <CustomerLink href="/shop" navigate={navigate}>
                    Open catalog <ArrowRight aria-hidden="true" />
                  </CustomerLink>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <span aria-hidden="true" className="story-shop__handoff" />
    </section>
  );
}
