# Storefront global search

## Decision

The customer-facing search control is a single global component in the customer header. It is
available throughout the storefront shell and delegates full-result navigation to the existing
`/shop?search=` contract. Product suggestions use the same approved storefront-products API as
the Shop page; no client-side catalog copy or alternate search index is introduced.

`@base-ui/react` 1.7.0 provides the Autocomplete primitive. It was chosen instead of custom
combobox ARIA because it supplies an established, accessible input/list/popup interaction model,
keyboard navigation, and anchored portal positioning while leaving YsabelleStore's visual system
in CSS. Base UI documents its async-search pattern and is released under the MIT License.

- Documentation: https://base-ui.com/react/components/autocomplete
- Source and license: https://github.com/mui/base-ui

## Behavioral contract

- Suggestions call `/api/storefront/products` after a 200 ms debounce, use `pageSize=6`, and
  cancel an in-flight request whenever the normalized query changes or the component unmounts.
- A submitted free-form query navigates to Shop. Selecting a product navigates to its real product
  route. Both actions update the local recent-search history only after an intentional action.
- Recent searches use the `ysabelle:storefront:recent-searches` local-storage key. Values are
  whitespace-normalized, case-insensitively deduplicated MRU entries, capped at five, and tolerate
  malformed or unavailable browser storage without preventing search.
- Empty, loading, error, and no-result states remain usable: pressing Enter always runs the
  server-backed full Shop search. The popup is dismissed by Escape through the Base UI primitive.

## Scope boundaries

The component does not change product, inventory, category, forecast, or order data. The Shop
toolbar remains an in-context filter control; the duplicate Home hero search is intentionally
removed so the header is the only global entry point.
