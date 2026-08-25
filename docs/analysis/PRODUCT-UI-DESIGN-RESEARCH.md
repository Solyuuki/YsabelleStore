# Product UI Design Research

Reviewed: 2026-08-14

## Decision

The Shop and Home product presentation continues to use YsabelleStore's shared semantic React
components and customer design tokens. No new runtime dependency or third-party component source
was added. The existing `ProductCard` → `ProductVisual` → `ProductImage` composition already gives
the project the right maintainable boundary; this pass refines that boundary using native HTML,
CSS, and deterministic local image metadata.

## Evaluated foundations

| Source                                                                      | License/status                                                                           | Decision                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Base UI](https://base-ui.com/)                                             | MIT; actively maintained, unstyled React primitives following ARIA patterns and WCAG 2.2 | Retained as the project's primary headless primitive option. A product card does not require a complex primitive, so adding Base UI markup here would provide no accessibility or bundle benefit. |
| [Radix Primitives](https://github.com/radix-ui/primitives)                  | MIT; accessible low-level React primitives                                               | Retained for the existing dialog/slot uses. Rejected for the card itself because native links, buttons, labels, and inputs are the correct primitives.                                            |
| [shadcn/ui](https://github.com/shadcn-ui/ui)                                | MIT                                                                                      | Not adopted. It would duplicate the existing primitive/style layer and introduce a recognizable generic card treatment without solving product-image quality.                                     |
| [Spree Storefront](https://github.com/spree/storefront)                     | MIT; current React 19 commerce reference                                                 | Used only as an architecture reference for typed, reusable product-grid composition and performance discipline. No source was copied.                                                             |
| [Medusa Next.js Starter](https://github.com/medusajs/nextjs-starter-medusa) | MIT, but deprecated in favor of a newer starter                                          | Not adopted because its Next.js/server architecture does not fit this Vite/Electron application and the referenced starter is deprecated.                                                         |
| [Shopify Dawn](https://github.com/Shopify/dawn)                             | Source-available license restricted to themes interoperating with Shopify                | Rejected for adaptation. Its HTML-first and performance principles are informative, but its code was not copied or incorporated.                                                                  |
| [Saleor Storefront](https://github.com/saleor/storefront)                   | FSL-1.1-ALv2 with future Apache-2.0 conversion                                           | Rejected for source adaptation because it is not currently a straightforward permissive-license fit.                                                                                              |

The existing GSAP dependency remains limited to story/discovery motion. Product-card feedback uses
small CSS transitions because importing an animation runtime for hover and focus treatment would be
disproportionate.

## Standards and implementation guidance

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) informed minimum target sizing, semantic controls,
  visible focus, and status communication.
- [W3C Focus Appearance guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
  informed the card and control focus perimeter.
- [MDN `object-fit`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) supports preserving
  full package geometry with `contain` rather than cropping.
- [web.dev responsive image guidance](https://web.dev/learn/design/responsive-images/) informed
  intrinsic dimensions, reserved media aspect ratios, lazy loading, and asynchronous decoding.

## Adapted design principles

- Keep product identity, price, stock, and action in a predictable retail scan order.
- Reserve media geometry before image decode to avoid layout shift.
- Cap low-resolution assets at their intrinsic pixel dimensions instead of enlarging them to fill
  the stage.
- Classify image shape from intrinsic dimensions rather than product names.
- Render deterministic transparent product cutouts on a neutral UI-owned media surface, with a fine
  stage border and restrained grounding shadow. The source background is removed locally through the
  documented edge-connected process rather than hidden with blend modes or matching CSS colors.
- Prefer native semantic controls, large targets, short compositor-friendly transitions, and a
  complete reduced-motion fallback.

No third-party notice file was required because no new third-party code or package was incorporated.
