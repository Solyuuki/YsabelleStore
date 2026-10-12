# Sprint 12 — Mobile Development Mode

From the repository root, use `npm run dev:mob`.

## Concurrent development modes

- If `npm run dev` (Electron + web) or `npm run dev:web` is already running, the mobile launcher reuses the existing frontend, backend, and development database. It never creates a second backend or database.
- If the standard stack is not running, the mobile launcher runs the same `predev:web` checks and starts a single owned web/backend stack. When stopped it shuts down only the stack it started.
- If only the **healthy, verified YsabelleStore backend** is running on 3001, the launcher reuses it and starts just the independent mobile preview on 5174. It does not require the desktop frontend on 5173.
- If the backend is missing while 5173 is occupied, or an unexpected service owns a required port, startup fails safely instead of stealing/terminating a port.
- The mobile frontend is an additional Vite instance at port **5174**, with strict port enforcement. It proxies `/api` to the existing local API at port 3001.
- `dev` and `dev:web` remain their normal stack launch modes; you do not need to run both.

## Preview URLs

- Desktop phone-sized preview: `http://localhost:5174/mobile-preview.html`
- Direct browser app: `http://localhost:5174/`
- Actual Android/iPhone on the same trusted Wi-Fi: `http://<PC-LAN-IP>:5174/`
- The terminal prints detected private IPv4 candidates. Try the IP for your active Wi-Fi/LAN adapter.
- The preview defaults to **Welcome**, reproducing the Storefront entrance at `/?preview=welcome` in mobile development mode (including after Get Started). The preview-only query does not change desktop or production storefront behavior.
- The toolbar offers Welcome, Storefront, Retail POS and Dashboard, highlights the selected view, and saves it in the preview URL hash (e.g. `mobile-preview.html#pos`) so reloads and browser back/forward restore the selection. **Open full page** follows the selected view.
- The toolbar also offers multiple phone and tablet viewport widths and portrait/landscape rotation.
- To suppress automatic browser launch, use `npm run dev:mob -- --no-open`.
- Run fast regression checks with `npm run test:mobile`.

## Adaptive customer Storefront (Sprint 12)

The mobile preview now reuses the live Storefront, not a separately cloned UI.
At the preview toolbar choose **Welcome** and **Get Started** to inspect the customer homepage.
The **Storefront** button opens the product catalog directly.

- **Category card density:** Phone portrait retains two columns, but every category card has a 4:3 image, fixed three-line title region, consistent body height, and uniform **Browse products** action. Desktop retains normal descriptions. Internal `Reviewed category for source-mapped...` notes are replaced with neutral customer copy instead of being rendered raw. Browser QA waits for real category cards and fails on mismatched card/image heights, missing mobile actions or visible raw descriptions; it measures untransformed element heights to ignore reveal animations.
- Small portrait phones (320–430 CSS px) use compact two-column category/catalog/product grids and a **five-slot bottom dock**: Home, Shop, **More**, Cart, Account. The center More button opens an accessible floating menu above the bottom dock for About Us, Customer Support and Shopping Guide; cart count and account authorization still come from existing state.
- **Portrait is vertically scrollable only:** Trending, Best Sellers and Everyday Essentials product rails become normal two-column grids; category filters wrap rather than forming a horizontal scroller. Rail arrows are hidden only when the entire grid is visible.
- Mobile sizing is centralized in `frontend/src/styles/customer-mobile-tokens.css` (12–16px gutters, 8–12px card gaps, 20–30px section spacing and bottom dock clearance), imported before `customer-adaptive-mobile.css`. Phone sizing scales from the 320px baseline; no per-device visual redesign.
- Portrait widths 600–700px can show three columns without changing the Storefront design language; regular portrait phones keep two columns. Interactive quantity/CTA controls retain their 44px+ touch target dimensions.
- Landscape phones use a compact navigation row beneath the header, adaptive photo proportions and no horizontally scrolling category sidebar.
- The redundant legacy hamburger/mobile-panel has been removed from the Storefront header. The responsive dock is the only mobile navigation (portrait/landscape/tablet), while the existing desktop link navigation remains unchanged.
- At the 320px portrait baseline the five dock slots use minmax(0,1fr), no width-growing labels, and a 42–44px center action; the header/search and dock are width-constrained to the viewport rather than allowed to create horizontal overflow.
- Tablets use the compact navigation row and three-column category grid; desktop keeps its original full Storefront navigation.
- The Shop category navigation is collapsed by default on mobile and expands into a wrapping grid with a 44px minimum interactive target instead of a horizontal scroller.
- The new layout styles are in `frontend/src/styles/customer-adaptive-mobile.css` and are imported last so they do not override desktop theme rules outside responsive breakpoints.
- The established Storefront routes, category/product source, visual assets, owner/staff POS screens and backend remain unchanged.
- Run `npm run test:mobile` to check mobile preview navigation and Storefront responsive contracts.

**Manual visual QA still required:** use the preview's 320 × 640, 390 × 844, 640 × 320, and 768 × 1024 options, switch light/dark modes, inspect both Home and Shop, and verify there is no body-wide horizontal overflow or clipped buttons. Real phone testing is still required for soft keyboards, touch behavior and safe areas.

## Compact phone header search

At portrait and short-landscape phone widths (up to 700 CSS px), global search no longer occupies a permanent second row of the sticky header. The header shows a 44px search icon; tapping it opens a temporary search field beneath the header with Base UI's existing catalog autocomplete. The suggestion popup is capped at 19rem / the available viewport height, with independently scrollable results. Close it with the header icon, Escape, or by tapping outside. Shop routes keep their existing in-page catalog search and filter controls; the desktop global search remains unchanged.

The Playwright QA now checks that the compact header stays within 110px before search opens, that the suggestions popup is no taller than 310px, and that it stays within the viewport and above the portrait bottom navigation. These checks run on the five portrait phone sizes and write `*-search.png` screenshots.

## Compact Shop filters

On phones up to 700 CSS px, the Shop category chooser is one 44px-tall row when collapsed; the selected category name is shown on its toggle instead of a second always-visible "All categories" tile. Opening it reveals the existing category navigation choices. The Shop search and the **Availability** native select share a single horizontal row: the search expands, while the select uses an accessible 44px filter-icon target. A small indicator appears whenever In stock or Out of stock is selected. The outer toolbar and collapsed-category panel borders/padding are removed in mobile layouts; the result heading follows with a smaller gap. The search debounce, query parameters, pagination reset and availability API semantics are unchanged.

This is phone-only. Wider tablet/desktop controls retain their text dropdown. The mobile select stays a real keyboard-accessible native `select`, not a custom nonfunctional icon; focused and active states have contrasting light/dark-mode colors. Confirm at 320px, 390px and 430px, including search text overflow, category expansion, changing availability, Clear filters and dark mode.

## Compact product-card purchase controls

At 320–430 CSS px in portrait, the **Home and Shop** product cards retain a two-column grid but use concise, readable merchandising. A short badge label (Trending, Best seller, or Low stock) is reserved its own space beside a 44px favorite hit target with a visually smaller 34px heart circle; no text or overlay collision is permitted. Product titles are clamped at two lines and review counts are visually hidden on phones, while the full rating summary is preserved in accessible text. Pricing, stock messages, favorite state, whole-unit quantity changes, and the existing `addItem(product, selectedQuantity)` behavior remain unchanged.

The quantity picker and purple **cart icon + Add** button now sit **side by side in a single 44px-tall row**, including 320px phone cards. Both columns shrink with the available card width; quantity +/- hit areas remain at least 24px wide and 44px tall, and the full heart/favorite hit target remains 44px square. Desktop continues to display full badge and **Add to cart** labels. Out-of-stock messages remain descriptive rather than being shrunk to an unreadable pill.

`npm run qa:mobile` now checks actual badged card/favorite geometry, clipping of short badge text, title clamping, mobile rating density, cart-action geometry, and 44px favorite/quantity touch targets on both Home and Shop in each phone portrait viewport. It waits for real product cards to load before measuring, instead of silently passing an empty/skeleton layout. Confirm the visual details in screenshots and on a physical touchscreen before calling the design production-ready.

## Automated browser QA (Playwright)

Use the **existing** `npm run dev:mob` stack with the backend ready, then open a second terminal in the repository root:

```powershell
npm run qa:mobile:setup
npm run qa:mobile
```

Setup is a one-time install of the **isolated** `tools/mobile-qa` Playwright dependency. The runner prefers Chrome already installed on Windows; if Chrome is missing, from `tools/mobile-qa` run `npx playwright install chromium` once. It does not change the root package lock, backend, or runtime mode.

The `qa:mobile` command checks both **Home** and **Shop** on widths **320, 360, 375, 390, 430, 640 landscape, 768 tablet, and 1280 desktop**. For Home, it sets the existing entrance-completed session key inside its own isolated Playwright context, then waits for `.customer-home`; this tests the real storefront content rather than mistaking the Welcome screen for a missing navbar. It checks document scroll width, key visible element bounds, five nav slots, absence of the old hamburger, and whether the modal **More** card has real margins and remains above the bottom dock in portrait. The More panel uses `ResizeObserver` and the actual fixed dock's viewport position for its bottom clearance on portrait phones, rather than assuming the dock is always 76px high. The runner also validates menu destinations, Escape dismissal and writes screenshots to `tools/mobile-qa/screenshots/` (gitignored). It exits nonzero if any automated check fails.

You can point it at another local dev server using `MOBILE_QA_URL`, for example in PowerShell:

```powershell
$env:MOBILE_QA_URL = "http://127.0.0.1:5174"
npm run qa:mobile
```

The overflow audit treats clipped, scrollable Home product carousels on **landscape, tablet and desktop** as intentional: a card parked beyond the visible carousel region is not a page-overflow error as long as its containing rail stays within the viewport. **Portrait phone rails are never exempt:** any horizontally overflowing product rail fails QA. Document-wide width overflow and other unconstrained elements always fail.

This is **local browser automation**, not a claim that iOS Safari, camera, soft-keyboard or physical-device interactions are already verified. Keep manual QA for those behaviors. `npm run test:mobile` remains the faster dependency-free source contract test.

## Customer favorites and mobile preview origin

Authenticated Favorites PUT/DELETE requests require an approved `Origin` even when the customer session cookie is valid. Port 5174 uses the same backend as the normal storefront but has a distinct browser Origin. In non-production mode, the backend explicitly allows local `localhost:5174`, `127.0.0.1:5174`, and port 5174 on this host's **actual private LAN interface IPv4 addresses**, without enabling wildcard CORS or bypassing customer authentication. Production continues to use only its configured CORS origins.

**After pulling a change to `backend/src/config/env.ts`, restart the running backend** before starting mobile QA. `npm run dev:mob` intentionally reuses a healthy existing backend and does not restart it for you. The mobile launcher performs an unauthenticated Favorites DELETE origin probe (which must receive HTTP 401 from the authentication middleware); a 403 `CUSTOMER_AUTH_ORIGIN_REJECTED` gives a backend-restart diagnostic instead of reporting the preview as fully ready.

A real guest tapping Favorite is redirected to customer Login; an expired session detected by the mutation is refreshed and sent to Login. A blocked Origin or server error stays an error and is **not** misrepresented as a logout or an internet connection problem. Use an authenticated customer session to manually verify both Save and Remove actions on Home, Shop, and Account Favorites.

## Validate local connectivity

Use `npm run runtime:report` to inspect the configured frontend, backend and database target; it checks the live health endpoint when the services are running.

On the host PC, verify `http://localhost:3001/api/ready`.
On a phone, verify `http://<PC-LAN-IP>:5174/api/ready`; it should reach the same backend through the Vite proxy. The database must be connected for readiness.

## Security and limitations

- **Development-only LAN preview.** Port 5174 listens on all interfaces. Use on a trusted private network; keep your firewall enabled and do not port-forward or publish this preview on the internet.
- Never open database port 3306 to phones. Login/authorization checks continue to run on the existing backend.
- Real-device tests require the host PC and backend to be online. This is not an offline MPOS app.
- The desktop embedded iframe preview changes layout dimensions, but does not emulate iOS Safari, mobile keyboard behavior or touch hardware. Test critical flows on real phones.
- Phone camera APIs generally require an HTTPS secure context; that is a separate setup after mobile appearance QA.
- `dev:mob` does not change the production/storefront hosting architecture, installer database rules or any sales/inventory authority.
