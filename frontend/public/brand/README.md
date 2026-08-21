# Ysabelle Store brand assets

The approved source artwork is the textless cart-and-`Y` mark selected in the August 21, 2026 logo review. No replacement artwork is introduced here.

- `ysabelle-store-mark.png`, `ysabelle-store-mark-256.png`, and `ysabelle-store-logo.png` contain the approved canonical mark used by the customer UI.
- `ysabelle-store-mark-128.png` is the compact responsive export used by the shared React brand component.
- `favicon-16x16.png`, `favicon-32x32.png`, and `favicon-48x48.png` are direct full-logo downscales of the approved canonical mark. They are not crops and do not introduce alternate artwork.
- `favicon.ico` contains those same full-logo 16 px, 32 px, and 48 px frames for browser compatibility.
- `apple-touch-icon.png` is the mobile bookmark/home-screen export.
- `electron/build/icon.ico` is the Windows-native multi-resolution application icon derived from the same approved mark. It includes 16, 32, 48, and 256 px frames for Windows taskbar, window chrome, and executable use.

Header, footer, Discover welcome, and live-catalog identity continue to use the shared `YsabelleBrandMark` image component. Functional UI icons remain separate. A failed brand-image request must never produce a blank white circle.

On Windows, Electron loads the native ICO at runtime, applies it to the `BrowserWindow`, and sets the matching AppUserModel window details. `electron-builder` also embeds the same ICO into the packaged application.
