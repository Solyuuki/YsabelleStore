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
    alt: "Fresh bread loaves arranged on a bakery retail display",
    category: "Bread & Bakery",
    imageUrl: "/images/discover/essentials/bread-bakery-retail-display.webp",
    slug: "bread-bakery"
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
  },
  {
    alt: "Packaged crackers, chips, and snacks arranged on a grocery shelf",
    category: "Snacks & Confectionery",
    imageUrl: "/images/discover/essentials/snacks-retail-display.webp",
    slug: "snacks-confectionery"
  },
  {
    alt: "Baking ingredients arranged for dessert preparation",
    category: "Baking & Dessert",
    imageUrl: "https://res.cloudinary.com/gnqoa3sp/image/upload/v1788803114/baking-dessert-pexels-8456734.webp",
    slug: "baking-dessert"
  },
  {
    alt: "Packaged hair and personal care products on retail shelves",
    category: "Personal Care & Hygiene",
    imageUrl: "/images/discover/essentials/personal-care-retail-display.webp",
    slug: "personal-care-hygiene"
  },
  {
    alt: "Bottled and canned beverages arranged on a grocery shelf",
    category: "Juice, Tea, Soda & Water",
    imageUrl: "/images/discover/essentials/beverages-retail-display.webp",
    slug: "juice-tea-soda-water"
  },
  {
    alt: "Cooking spices and condiments arranged on a kitchen table",
    category: "Condiments & Cooking",
    imageUrl: "https://res.cloudinary.com/gnqoa3sp/image/upload/v1788803157/condiments-cooking-pexels-531446.webp",
    slug: "condiments-cooking"
  },
  {
    alt: "Packaged coffee products arranged across supermarket shelves",
    category: "Coffee & Milk",
    imageUrl: "https://res.cloudinary.com/gnqoa3sp/image/upload/v1788805225/coffee-milk-pexels-8766369.webp",
    slug: "coffee-milk"
  }
] as const satisfies readonly StorefrontCategoryPresentation[];

const presentationBySlug = Object.fromEntries(
  essentialShelfItems.map(({ slug, ...presentation }) => [slug, presentation])
) as Record<string, Omit<StorefrontCategoryPresentation, "slug">>;

export function getEssentialShelfItems() {
  return essentialShelfItems.slice(0, 8);
}

export function getCategoryPresentation(slug: string) {
  return presentationBySlug[slug] ?? null;
}
