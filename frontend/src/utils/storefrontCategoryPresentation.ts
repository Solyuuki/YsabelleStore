type StorefrontCategoryPresentation = {
  alt: string;
  category: string;
  imageUrl: string;
  slug: string;
};

const essentialShelfItems = [
  {
    alt: "Bottled and canned beverages arranged on a grocery shelf",
    category: "Beverages",
    imageUrl: "/images/discover/essentials/beverages-retail-display.webp",
    slug: "beverages"
  },
  {
    alt: "Unopened canned foods arranged across store shelves",
    category: "Canned Goods",
    imageUrl: "/images/discover/essentials/canned-goods-retail-display.webp",
    slug: "canned-goods"
  },
  {
    alt: "Bottled household cleaners and laundry products on a display shelf",
    category: "Household",
    imageUrl: "/images/discover/essentials/household-retail-display.webp",
    slug: "household"
  },
  {
    alt: "Packaged instant noodles and noodle cups arranged for retail",
    category: "Instant Food",
    imageUrl: "/images/discover/essentials/instant-food-retail-display.webp",
    slug: "instant-food"
  },
  {
    alt: "Packaged hair and personal care products on retail shelves",
    category: "Personal Care",
    imageUrl: "/images/discover/essentials/personal-care-retail-display.webp",
    slug: "personal-care"
  },
  {
    alt: "Packaged crackers, chips, and snacks arranged on a grocery shelf",
    category: "Snacks",
    imageUrl: "/images/discover/essentials/snacks-retail-display.webp",
    slug: "snacks"
  },
  {
    alt: "Packaged rice and grains arranged in a supermarket aisle",
    category: "Staples",
    imageUrl: "/images/discover/essentials/staples-retail-display.webp",
    slug: "staples"
  },
  {
    alt: "Non-stick cookware arranged on a kitchenware store display",
    category: "Kitchen & Dining",
    imageUrl: "/images/discover/essentials/kitchen-dining-retail-display.webp",
    slug: "kitchen-dining"
  }
] as const satisfies readonly StorefrontCategoryPresentation[];

const presentationBySlug = Object.fromEntries(
  essentialShelfItems.map(({ slug, ...presentation }) => [slug, presentation])
) as Record<string, Omit<StorefrontCategoryPresentation, "slug">>;

export function getEssentialShelfItems() {
  return essentialShelfItems;
}

export function getCategoryPresentation(slug: string) {
  return presentationBySlug[slug] ?? null;
}
