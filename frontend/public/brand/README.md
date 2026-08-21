# Ysabelle Store brand assets

The approved source artwork is the textless cart-and-`Y` mark selected in the August 21, 2026 logo review. The uploaded source SHA-256 is `44fb993b2b3b39cc8d7926636710758fc8e75f697f73842d82f6ba2954aaa66f`.

No replacement artwork is generated in this directory. The committed files are deterministic square, transparent, size-specific exports or compatibility aliases of that approved image:

- `ysabelle-store-mark.png`: canonical browser, Electron, and Windows application mark.
- `ysabelle-store-mark-256.png`: responsive source used by the shared React brand component.
- `ysabelle-store-mark-128.png`: responsive source for compact customer branding.
- `ysabelle-store-logo.png`: compatibility alias containing the same approved textless artwork.
- `apple-touch-icon.png`: mobile bookmark/home-screen export.
- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`, and `favicon.ico`: retained compatibility exports; the current browser configuration intentionally uses the canonical full mark so the tab matches the approved navbar and footer identity.

Header, footer, Discover welcome, and live-catalog identity all use the shared `YsabelleBrandMark` image component. The original Store SVG remains underneath as an error fallback. A failed asset request must never produce a blank white circle.

Electron development uses the canonical repository image through `BrowserWindow.icon`, while Windows packaging uses the same approved mark through `electron-builder`.
