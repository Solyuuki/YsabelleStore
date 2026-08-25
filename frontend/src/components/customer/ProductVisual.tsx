import { ProductImage } from "./ProductImage";

export function ProductVisual({
  category,
  imageUrl,
  name,
  large = false,
  showCategory = true
}: {
  category: string;
  imageUrl?: string | null;
  name: string;
  large?: boolean;
  showCategory?: boolean;
}) {
  return (
    <div
      className={`customer-product-visual ${large ? "customer-product-visual--large" : ""}`}
      data-category-label={showCategory ? "visible" : "hidden"}
      data-image-kind={imageUrl ? "product" : "fallback"}
    >
      <ProductImage
        alt={`${name} product photo`}
        className="customer-product-visual__image"
        imageUrl={imageUrl}
      />
      {showCategory ? <span className="customer-product-visual__category">{category}</span> : null}
    </div>
  );
}
