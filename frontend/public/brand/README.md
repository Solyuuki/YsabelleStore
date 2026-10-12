# Ysabelle Store brand assets

The approved artwork is the original circular Ysabelle Store logo. Application branding must use that artwork only.

## Verified runtime assets

- `frontend/src/assets/brand/ysabelle-approved-mark-128.png` copies the approved 128px public logo, byte-for-byte.
- `frontend/src/assets/brand/ysabelle-approved-mark-180.png` copies the approved 180px Apple touch icon, byte-for-byte.
- Shared `BrandLogo` / `YsabelleBrandMark` components load these bundled, integrity-checked PNGs with a responsive `srcSet` on web and Electron.
- The existing PNG outputs retain transparent circular branding. No synthetic logo or background is added.

## Legacy asset repair backlog

The pre-existing `ysabelle-store-mark-256.png`, `ysabelle-store-mark.png`, `ysabelle-store-logo.png`, `ysabelle-logo-official.webp`, and `favicon-48x48.png` have damaged/truncated image data. They must not be selected as runtime React image sources until restored from the original approved artwork and validated. Do not claim these files are repaired by the mobile logo source change.

`favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico`, and `apple-touch-icon.png` remain existing browser assets. The legacy 48px favicon used by Windows icon preparation needs separate repair before certifying Windows packaging.

Keep shared logo wrappers transparent and circular. No generated bag icon, initials, other logo, or artificial gradient fallback is permitted.
