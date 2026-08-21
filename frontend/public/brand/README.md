# Ysabelle Store brand assets

The source of truth is the 500×500 RGBA PNG supplied by Ysabelle Store. Its SHA-256 is `f2ee9b4fb0184df39eabcbef116a70cc74db3100c9910a448e5e74b5df7e0be3`.

- `ysabelle-store-logo.png` is a web export of the supplied artwork for the larger About/Discover placement. It was resized only; no artwork was redrawn or generated.
- `ysabelle-store-mark.png` is a literal crop of the supplied artwork (`x=110..390`, `y=40..320`) for the header, footer, and Electron window icon. It was resized only; no artwork was redrawn or generated.
- `favicon-16x16.png` and `favicon-32x32.png` use the same literal crop with transparent padding and a rounded mask so the existing cart-and-`Y` mark remains recognizable in browser tabs.

The original Store icons remain beneath the web artwork as a non-blank fallback if an asset request fails. Update the cache version in `frontend/index.html` and `frontend/src/styles/brand.css` whenever an approved brand asset changes.

Do not replace these files with generated approximations.
