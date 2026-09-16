import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ShoppingBasket, Trash2 } from "lucide-react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency, formatUnit } from "@/components/customer/ProductCard";
import { ProductVisual } from "@/components/customer/ProductVisual";
import { QuantityControl } from "@/components/customer/QuantityControl";
import { AppPagination } from "@/components/shared/AppPagination";
import { useCart } from "@/context/CartContext";
import "@/styles/customer-cart-premium.css";

const CART_PAGE_SIZE = 5;

export function CartPage({ navigate }: { navigate: (path: string) => void }) {
  const { items, itemCount, subtotal, removeItem, updateQuantity } = useCart();
  const [page, setPage] = useState(1);
  const cartItemsRef = useRef<HTMLElement>(null);
  const totalPages = Math.max(1, Math.ceil(items.length / CART_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * CART_PAGE_SIZE;
    return items.slice(start, start + CART_PAGE_SIZE);
  }, [currentPage, items]);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  function handlePageChange(nextPage: number) {
    setPage(nextPage);

    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      cartItemsRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start"
      });
    });
  }

  return (
    <div className="customer-page customer-cart-page">
      <div className="customer-container">
        <div className="customer-page-heading">
          <p className="customer-kicker">Your grocery list</p>
          <h1>Shopping Cart</h1>
          <p>
            {itemCount
              ? `${itemCount} item${itemCount === 1 ? "" : "s"} ready to review.`
              : "Your cart is ready for everyday essentials."}
          </p>
        </div>
        {!items.length ? (
          <div className="customer-empty-state customer-empty-state--cart">
            <ShoppingBasket aria-hidden="true" size={42} />
            <h2>Your Cart Is Empty</h2>
            <p>Browse groceries and add the everyday items you need.</p>
            <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
              Start shopping <ArrowRight aria-hidden="true" size={18} />
            </CustomerLink>
          </div>
        ) : (
          <div className="customer-cart-layout">
            <section aria-label="Cart items" className="customer-cart-items" ref={cartItemsRef}>
              <div className="customer-cart-list">
                {paginatedItems.map(({ product, quantity }) => (
                  <article className="customer-cart-item" key={product.id}>
                    <ProductVisual
                      category={product.category.name}
                      imageUrl={product.imageUrl}
                      name={product.name}
                    />
                    <div className="customer-cart-item__info">
                      <p className="customer-eyebrow">{product.category.name}</p>
                      <CustomerLink href={`/product/${product.id}`} navigate={navigate}>
                        <h2>{product.name}</h2>
                      </CustomerLink>
                      <p>
                        {formatCurrency(product.sellingPrice)} per {formatUnit(product.unit)}
                      </p>
                      <button onClick={() => removeItem(product.id)} type="button">
                        <Trash2 aria-hidden="true" size={15} /> Remove
                      </button>
                    </div>
                    <div className="customer-cart-item__quantity">
                      <QuantityControl
                        label={`Quantity for ${product.name}`}
                        max={product.availableStock}
                        onChange={(value) => updateQuantity(product.id, value)}
                        value={quantity}
                      />
                      <strong>{formatCurrency(Number(product.sellingPrice) * quantity)}</strong>
                    </div>
                  </article>
                ))}
              </div>

              {items.length > CART_PAGE_SIZE ? (
                <AppPagination
                  className="customer-cart-pagination"
                  itemLabel="cart items"
                  onPageChange={handlePageChange}
                  page={currentPage}
                  pageSize={CART_PAGE_SIZE}
                  totalItems={items.length}
                  totalPages={totalPages}
                />
              ) : null}

              <div className="customer-cart-actions">
                <CustomerLink className="customer-continue-link" href="/shop" navigate={navigate}>
                  Continue shopping
                </CustomerLink>
              </div>
            </section>
            <aside className="customer-order-summary">
              <p className="customer-kicker">Order summary</p>
              <h2>Review Your Total</h2>
              <div>
                <span>Items ({itemCount})</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <div className="customer-order-summary__total">
                <span>Total</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <p>Final stock availability is checked when you place your pickup order.</p>
              <CustomerLink
                className="customer-button customer-button--full"
                href="/checkout"
                navigate={navigate}
              >
                Proceed to checkout <ArrowRight aria-hidden="true" size={18} />
              </CustomerLink>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
