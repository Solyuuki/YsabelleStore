# Ysabelle Store brand assets

The approved source artwork is the original circular Ysabelle Store logo. It is the only brand artwork that may represent Ysabelle Store in the application.

- `frontend/src/assets/brand/ysabelle-logo-official.webp` is the bundled canonical runtime logo used by the shared React brand component.
- `ysabelle-store-mark.png`, `ysabelle-store-mark-256.png`, and `ysabelle-store-logo.png` are canonical public exports of the same approved logo artwork.
- `ysabelle-store-mark-128.png` is the compact responsive export.
- `favicon-16x16.png`, `favicon-32x32.png`, and `favicon-48x48.png` are direct downscales of the approved logo.
- `favicon.ico` contains those same approved frames for browser compatibility.
- `apple-touch-icon.png` is the mobile bookmark/home-screen export.

All application brand placements must use the shared `BrandLogo` / `YsabelleBrandMark` components. Do not substitute a generated shopping-bag mark, initials, a Lucide icon, a gradient fallback, or other synthetic artwork. The logo artwork is already circular, so shared wrappers must remain transparent and must not add a fake colored background behind it.

For Windows packaging, `electron/scripts/prepare-windows-icon.mjs` generates `electron/build/icon.ico` immediately before development startup or packaging. `electron-builder` uses that generated ICO only to stamp the executable/installer. Runtime branding continues to use the approved logo artwork.
