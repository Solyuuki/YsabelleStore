# Ysabelle Store brand assets

The approved source artwork is the textless cart-and-`Y` mark selected in the August 21, 2026 logo review. The uploaded source SHA-256 is `44fb993b2b3b39cc8d7926636710758fc8e75f697f73842d82f6ba2954aaa66f`.

No new artwork is generated in this directory. The committed files are deterministic square, transparent, size-specific exports or literal crops of that approved image:

- `ysabelle-store-mark.png` and `ysabelle-store-mark-256.png`: canonical web and Electron mark.
- `ysabelle-store-mark-128.png`: responsive source for compact customer branding.
- `favicon-16x16.png`: literal `Y`-focused crop of the approved mark for the smallest browser-tab slot (`x=355..905`, `y=450..1000` on the square source).
- `favicon-32x32.png`: literal cart-and-`Y` crop for medium-density tabs (`x=230..1030`, `y=360..1160`).
- `favicon-48x48.png`: full approved textless mark.
- `favicon.ico`: multi-size container holding those same 16px, 32px, and 48px exports.
- `apple-touch-icon.png`: mobile bookmark/home-screen export.
- `ysabelle-store-logo.png`: compatibility alias containing the same approved textless artwork, so stale references cannot show the superseded wordmark logo.

Header and footer branding use a real `<img>` element with an underlying Store-icon fallback. Legacy Discover markup keeps the same fallback beneath the approved image. A failed asset request must never produce a blank white circle.
