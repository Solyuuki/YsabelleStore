export type LegacyCategoryCoverSource = {
  alt: string;
  category: string;
  imageUrl: string;
  slug: string;
};

export const LEGACY_CATEGORY_COVER_SOURCES = [
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
    alt: "Baking ingredients arranged for dessert preparation",
    category: "Baking & Dessert",
    imageUrl:
      "https://res.cloudinary.com/gnqoa3sp/image/upload/v1788803114/baking-dessert-pexels-8456734.webp",
    slug: "baking-dessert"
  },
  {
    alt: "Packaged crackers, chips, and snacks arranged on a grocery shelf",
    category: "Snacks & Confectionery",
    imageUrl: "/images/discover/essentials/snacks-retail-display.webp",
    slug: "snacks-confectionery"
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
    imageUrl:
      "https://res.cloudinary.com/gnqoa3sp/image/upload/v1788803157/condiments-cooking-pexels-531446.webp",
    slug: "condiments-cooking"
  },
  {
    alt: "Coffee maker, milk jug, coffee cup, and roasted coffee beans on a dark studio surface",
    category: "Coffee & Milk",
    imageUrl:
      "https://res.cloudinary.com/gnqoa3sp/image/upload/v1788805764/coffee-milk-premium-pexels-16444396.webp",
    slug: "coffee-milk"
  }
] as const satisfies readonly LegacyCategoryCoverSource[];
