import { ArrowLeft, CheckCircle2, MapPin, ShoppingBasket } from "lucide-react";
import { useEffect, useState } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency, formatUnit } from "@/components/customer/ProductCard";
import { ProductVisual } from "@/components/customer/ProductVisual";
import { QuantityControl } from "@/components/customer/QuantityControl";
import { useCart } from "@/context/CartContext";
import { fetchStorefrontProduct } from "@/services/storefrontService";
import type { StorefrontProduct } from "@/types/storefront";

export function ProductDetailPage({
  productId,
  navigate
}: {
  productId: string;
  navigate: (path: string) => void;
}) {
  const { addItem } = useCart();
  const [product, setProduct] = useState<StorefrontProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchStorefrontProduct(productId, controller.signal)
      .then(setProduct)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Product could not be loaded.");
      });
    return () => controller.abort();
  }, [productId]);

  if (error)
    return (
      <div className="customer-page customer-container">
        <div className="customer-empty-state">
          <h1>Product unavailable</h1>
          <p>{error}</p>
          <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
            Back to shop
          </CustomerLink>
        </div>
      </div>
    );
  if (!product)
    return (
      <div className="customer-page customer-container">
        <div className="customer-inline-state">Loading product...</div>
      </div>
    );
  const outOfStock = product.availableStock <= 0;

  return (
    <div className="customer-page customer-product-page">
      <div className="customer-container">
        <CustomerLink
          className="customer-back-link"
          href={`/shop/category/${product.category.slug}`}
          navigate={navigate}
        >
          <ArrowLeft aria-hidden="true" size={17} /> Back to {product.category.name}
        </CustomerLink>
        <section className="customer-product-detail">
          <ProductVisual
            category={product.category.name}
            imageUrl={product.imageUrl}
            large
            name={product.name}
          />
          <div className="customer-product-detail__copy">
            <p className="customer-kicker">{product.category.name}</p>
            <h1>{product.name}</h1>
            <p className="customer-product-detail__description">
              {product.description || "An everyday essential from Ysabelle's Store."}
            </p>
            <div className="customer-product-detail__price">
              <strong>{formatCurrency(product.sellingPrice)}</strong>
              <span>per {formatUnit(product.unit)}</span>
            </div>
            <p className={`customer-stock customer-stock--${product.stockStatus.toLowerCase()}`}>
              {outOfStock
                ? "Currently out of stock"
                : product.stockStatus === "LOW_STOCK"
                  ? `Only ${product.availableStock} left in stock`
                  : `${product.availableStock} available`}
            </p>
            {!outOfStock ? (
              <div className="customer-product-detail__buy">
                <QuantityControl
                  label={`Quantity for ${product.name}`}
                  max={product.availableStock}
                  onChange={setQuantity}
                  value={quantity}
                />
                <button
                  className="customer-button"
                  onClick={() => addItem(product, quantity)}
                  type="button"
                >
                  <ShoppingBasket aria-hidden="true" size={19} /> Add to cart
                </button>
              </div>
            ) : null}
            <div className="customer-product-detail__notes">
              <span>
                <CheckCircle2 aria-hidden="true" size={18} /> Price and stock checked from the store
                catalog
              </span>
              <span>
                <MapPin aria-hidden="true" size={18} /> Pickup at 110 A. Mabini Street, Pasig City
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
