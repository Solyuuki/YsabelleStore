export type CatalogImageMetadata = {
  background: "light" | "transparent";
  height: number;
  width: number;
};

const catalogImageMetadata = {
  "/images/products/gardenia-enriched-white-bread-600g.webp": {
    background: "transparent",
    height: 412,
    width: 164
  },
  "/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp": {
    background: "transparent",
    height: 128,
    width: 80
  },
  "/images/products/sunsilk-anti-dandruff-silky-shampoo-sachet-13-5ml.webp": {
    background: "transparent",
    height: 68,
    width: 137
  }
} as const satisfies Record<string, CatalogImageMetadata>;

export function getCatalogImageMetadata(imageUrl: string | null) {
  if (!imageUrl) return null;
  return catalogImageMetadata[imageUrl as keyof typeof catalogImageMetadata] ?? null;
}

export function describeCatalogImage(width: number, height: number) {
  const ratio = width / height;

  return {
    resolution: Math.min(width, height) < 256 ? ("low" as const) : ("standard" as const),
    shape:
      ratio >= 1.35 ? ("wide" as const) : ratio <= 0.74 ? ("tall" as const) : ("balanced" as const)
  };
}
