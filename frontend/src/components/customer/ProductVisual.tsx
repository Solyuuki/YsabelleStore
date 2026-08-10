import { ProductImage } from "./ProductImage";

function hash(value: string) {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
}

export function ProductVisual({
  category,
  imageUrl,
  name,
  large = false
}: {
  category: string;
  imageUrl?: string | null;
  name: string;
  large?: boolean;
}) {
  const productHash = hash(`${category}-${name}`);

  return (
    <div
      className={`customer-product-visual ${large ? "customer-product-visual--large" : ""}`}
      data-image-kind={imageUrl ? "product" : "fallback"}
      data-product-variant={(productHash % 4) + 1}
    >
      <span aria-hidden="true" className="customer-product-visual__halo" />
      <ProductImage
        alt={`${name} product photo`}
        className="customer-product-visual__image"
        imageUrl={imageUrl}
      />
      <span className="customer-product-visual__category">{category}</span>
    </div>
  );
}
