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
- The toolbar offers multiple phone and tablet presets. **Phones (320–430px presets) are portrait-only**, so Rotate is disabled; **Tablet (768 × 1024) supports both portrait and landscape**. Switching from a rotated tablet back to any phone automatically resets the phone preview to portrait. The footer reports the orientation policy.
- To suppress automatic browser launch, use `npm run dev:mob -- --no-open`.
- Run fast regression checks with `npm run test:mobile`.

## Phone portrait-only vs. tablet rotation

Phone landscape is disabled in the `mobile-preview.html` simulator for every phone preset and cannot be enabled by switching from a rotated tablet. Only explicit `data-orientation="both"` tablet presets enable the Rotate control. This is a **viewport QA policy**, not a browser permission or hardware lock.

On direct Android/iOS browsers, browser tabs do not reliably support `ScreenOrientation.lock("portrait")`. Instead, `frontend/index.html` and `frontend/src/styles/global.css` provide a full-screen, accessible **Rotate your phone upright** notice at touch-device landscape widths up to 1180px with a short side no greater than 500px. Portrait phones see no notice; typical tablets have a taller landscape viewport and remain usable in both orientations. Mouse-driven desktop windows are not restricted. The notice does not change authentication, the actual screen orientation, or persisted preferences.

`npm run test:mobile` checks both the preview rotation behavior via an executable DOM stub and the CSS/HTML orientation contract. `npm run qa:mobile` checks the rotation notice in the touch-enabled 640 × 320 phone-landscape fixture and ensures it stays hidden on both 768 × 1024 and 1024 × 768 tablets. For physical iOS/Android QA, rotate a real phone and tablet; some browsers show transient system scrollbars or UI chrome independent of the app.

## Frontend Node test runner compatibility

The mobile API proxy decision in `frontend/src/config/runtime.ts` reads Vite's
`import.meta.env` only when that object exists. Native Node/TSX frontend
contract tests do not inject the Vite environment; the runtime therefore
falls back to the validated `frontendEnv.VITE_API_BASE_URL` instead of throwing
at module import. The mobile development browser still uses its own origin
when `DEV` and `VITE_MOBILE_PREVIEW=1` are present. The
`scripts/test/mobile-preview.test.mjs` suite checks both the guarded
source contract and an actual native Node ESM import of the runtime module
with a stubbed environment schema. No authentication, API permission, or
production base URL is changed.

To verify after pulling, run `npm run test:mobile` and
`npm run test --workspace @ysabellestore/frontend`. The latter is the full
frontend contract suite; the former tests Node/Vite compatibility separately.

## Logo-free HTTP status pages

Sprint 12 removes the oversized Ysabelle Store logo header from the shared full-screen `StatusScreen` component. HTTP **401 session expired**, **403 access denied**, **404 not found**, and the existing **503/system reliability states** now present only the dedicated status illustration, code, explanation, and recovery actions. All status variants share the same logo-free layout, so desktop and mobile use balanced vertical padding after the old top header is removed. Regular storefront, customer authentication forms, and store navigation retain their existing branding.

Regression contracts: `scripts/http-status-fullscreen-ui-test.ts` rejects branded status headers, and `scripts/test/status-screen-appearance.test.mjs` verifies the shared portal/theme/focus behavior, dark-mode readability, and logo-free rendering. Retest 401, 403, 404, and 503 in light/dark mode and on mobile/desktop; source tests do not replace live screenshots or end-to-end session expiry.

## Adaptive customer Storefront (Sprint 12)

The mobile preview now reuses the live Storefront, not a separately cloned UI.
At the preview toolbar choose **Welcome** and **Get Started** to inspect the customer homepage.
The **Storefront** button opens the product catalog directly.

- **Category card density:** Phone portrait retains two columns, but every category card has a 4:3 image, fixed three-line title region, consistent body height, and uniform **Browse products** action. Desktop retains normal descriptions. Internal `Reviewed category for source-mapped...` notes are replaced with neutral customer copy instead of being rendered raw. Browser QA waits for real category cards and fails on mismatched card/image heights, missing mobile actions or visible raw descriptions; it measures untransformed element heights to ignore reveal animations.
- Small portrait phones (320–430 CSS px) use compact two-column category/catalog/product grids and a **five-slot bottom dock**: Home, Shop, **More**, Cart, Account. The center More button opens an accessible floating menu above the bottom dock for About Us, Customer Support and Shopping Guide; cart count and account authorization still come from existing state.
- **Portrait is vertically scrollable only:** Trending, Best Sellers and Everyday Essentials product rails become normal two-column grids; category filters wrap rather than forming a horizontal scroller. Rail arrows are hidden only when the entire grid is visible.
- Mobile sizing is centralized in `frontend/src/styles/customer-mobile-tokens.css` (12–16px gutters, 8–12px card gaps, 20–30px section spacing and bottom dock clearance), imported before `customer-adaptive-mobile.css`. Phone sizing scales from the 320px baseline; no per-device visual redesign.
- Portrait widths 600–700px can show three columns without changing the Storefront design language; regular portrait phones keep two columns. Interactive quantity/CTA controls retain their 44px+ touch target dimensions.
- **Phone landscape is no longer a supported browsing mode:** the preview prevents it, and real small touch phones display a portrait-only rotation notice in landscape. Tablet portrait and landscape remain supported. Existing short-landscape responsive CSS remains as a fallback for other browser contexts; the guard is not an operating-system rotation lock.
- The redundant legacy hamburger/mobile-panel has been removed from the Storefront header. The responsive dock is the only mobile navigation (portrait/landscape/tablet), while the existing desktop link navigation remains unchanged.
- At the 320px portrait baseline the five dock slots use minmax(0,1fr), no width-growing labels, and a 42–44px center action; the header/search and dock are width-constrained to the viewport rather than allowed to create horizontal overflow.
- Tablets use the compact navigation row and three-column category grid; desktop keeps its original full Storefront navigation.
- The Shop category navigation is collapsed by default on mobile and expands into a wrapping grid with a 44px minimum interactive target instead of a horizontal scroller.
- The new layout styles are in `frontend/src/styles/customer-adaptive-mobile.css` and are imported last so they do not override desktop theme rules outside responsive breakpoints.
- The established Storefront routes, category/product source, visual assets, owner/staff POS screens and backend remain unchanged.
- Run `npm run test:mobile` to check mobile preview navigation and Storefront responsive contracts.

**Manual visual QA still required:** use the preview's 320 × 640 and 390 × 844 phone presets in portrait. Check that Rotate is disabled. Select Tablet 768 × 1024, rotate to 1024 × 768 and back, then change to a phone preset and verify auto-reset to portrait. On a physical phone in landscape, confirm the accessible rotate-upright notice; it disappears when returned to portrait. On tablet landscape, the notice stays hidden. Switch light/dark modes and inspect Home and Shop for overflow and clipped controls. Real device tests are required because ordinary browsers cannot guarantee OS-level orientation locking.

## Compact phone header search

At portrait and short-landscape phone widths (up to 700 CSS px), global search no longer occupies a permanent second row of the sticky header. The header shows a 44px search icon; tapping it opens a temporary search field beneath the header with Base UI's existing catalog autocomplete. The suggestion popup is capped at 19rem / the available viewport height, with independently scrollable results. Close it with the header icon, Escape (handled at the document capture phase to avoid autocomplete interception), or by tapping outside. Shop routes keep their existing in-page catalog search and filter controls; the desktop global search remains unchanged.

The Playwright QA now checks that the compact header stays within 110px before search opens, that the suggestions popup is no taller than 310px, and that it stays within the viewport and above the portrait bottom navigation. These checks run on the five portrait phone sizes and write `*-search.png` screenshots.

## Compact Shop filters

On phones up to 700 CSS px, the Shop category chooser is one 44px-tall row when collapsed; the selected category name is shown on its toggle instead of a second always-visible "All categories" tile. Opening it reveals a **responsive, max-height category menu**: narrow phones show one full-width readable item per row instead of squeezing long names into two columns, and auto-fit adds columns only once each can be at least 14rem wide. The expanded category list scrolls internally (max 48dvh / 20rem), retains a sticky category toggle, and closes automatically after a category is selected. Category counts stay aligned and long category labels can wrap without clipping. The Shop search and the **Availability** native select share a single horizontal row: the search expands and a 44px filter icon opens a right-aligned, width-constrained three-option panel that stays inside the mobile viewport and flips above the trigger when the bottom dock leaves insufficient space. A small indicator appears whenever In stock or Out of stock is selected. The outer toolbar and collapsed-category panel borders/padding are removed in mobile layouts; the result heading follows with a smaller gap. The search debounce, query parameters, pagination reset and availability API semantics are unchanged.

This is phone-only. Wider tablet/desktop controls retain their text dropdown. The desktop/tablet control retains its native `select`. The phone uses an accessible toggle with labeled 44px option buttons, selected-state feedback, Escape/outside-click dismissal, and keyboard focus return. The dropdown panel has explicit light/dark-mode styling and the Shop search input is forced transparent inside its rounded outer shell to prevent an extra dark rectangle. Confirm at 320px, 390px and 430px, including search text overflow, expanded category scroll and collapsed selection, changing availability, Clear filters and dark mode. `npm run qa:mobile` also measures single-column layout, category tap height, expanded menu max-height, label overflow, and collapse on selection in its portrait browser runs.

## Compact cart with multiple products

The phone Cart view no longer uses the <=520px single-column item layout with a full-width 150–160px minimum image. At <=700px, each cart line becomes a **compact two-row grid**: a contained 76–100px product thumbnail beside category, product title, per-unit price and accessible Remove action; below is a shared 44px quantity control row with the live line total aligned to the opposite edge. The existing design materials, light/dark colors, item identity, pricing and backend cart synchronization are unchanged. Long names can occupy two lines and the line total uses tabular numerals. Remove and quantity controls retain 44px-high touch targets.

For baskets with many products, **existing pagination of five distinct product lines per page** is preserved; the page can still scroll vertically to the current order summary and checkout action. There is no new nested scroll container, horizontal carousel, duplicated/sticky checkout button or aggressive image cropping. The cart item count and subtotal still use the complete basket across all pages, not only the current five items.

`npm run test:mobile` guards item layout and preservation of pagination/order calculations. `npm run qa:mobile` uses an **isolated guest browser context** to add three products (or six if enough are available) from Shop, measure the resulting Cart rows, verify that images/actions/line totals fit, check the summary, verify five-per-page pagination and backfill on removal when six items exist, exercise quantity increase where stock allows, and save `*-cart.png` screenshots at 320–430px portrait sizes. Recheck the cart at 320px/390px and with more than five products, plus light/dark mode. The source regression check and simulated guest browser checks do not replace real signed-in sync and checkout QA.

## Phone Account tabs without horizontal scrolling

The **My Account → Orders / Favorites / Profile / Security** navigation previously used a horizontal overflow rail at `<=640px`, leading to a visible scrollbar and a partially clipped Security tab on 320px portrait phones. Sprint 12 replaces **only this phone navigation** with a fluid **two-column, two-row CSS grid**. All four options stay visible with evenly sized minimum 44px tap targets, small 16px icons, readable captions and the existing branded selected-state gradient. The whole Account rail, Sign out button and account content remain unchanged; 641px+ tablet/desktop tab presentations are preserved.

Implementation is in `frontend/src/styles/customer-account-premium.css`; the existing React `role="tablist"`, `role="tab"`, `aria-selected` and tab switching code are unchanged. No nested horizontal scrollbar or carousel is introduced. `npm run test:mobile` checks the CSS scope, grid, four panel IDs and selection callbacks. `npm run qa:mobile` mounts a hidden Account navigation fixture using live styles and verifies four tabs form two complete rows with no clipping/scrollbar and sufficient target dimensions on phone portrait viewports. Follow with visual and interaction checks on the actual signed-in Account at 320, 390 and 430px, in both light and dark modes.

## Account active delivery card — dark-mode contrast

The **My Account → Orders → Active orders** tracking card has a coordinated dark color system, fixing the previous combination of pale payment/total/date tiles and dark order numbers, addresses and pending timeline labels inside a dark outer card. Sprint 12 scopes these rules to `:root.dark .customer-app .customer-account-page-v2 #orders-panel .customer-account-order-v2--active` in `theme-storefront-contrast.css`. Summary tiles now use the bounded midnight surface `#2b3b55` with bright labels `#c6d3e7` and values `#f3f6ff`; ticket number, order ID and address use light ink. The stepper uses dark numbered pending markers, legible pending/current/completed labels, and high-contrast timestamps. Awaiting-payment and delivered/failed/cancelled status badges retain their distinct meanings with appropriate dark-only colors.

The companion payment gate and confirm-receipt area receive dark surfaces and legible copy. **The original light-mode cards remain unchanged**, as do the five delivery statuses, actual timeline events, full amounts, customer delivery confirmation and PayMongo logic. The fix works across phone, tablet and desktop because it is not behind a mobile breakpoint.

`npm run test:mobile` now checks that the account dark rules cover the order identifier, three overview tiles, address, pending/current stepper and payment/confirmation states; expected text colors exceed a calculated **7:1 contrast** against their dark surfaces. `npm run qa:mobile` mounts a hidden fixture using the real loaded CSS on Shop QA viewports to verify the computed **dark** text/surface contrast is at least 4.5:1 and tiles differ from the retained light-mode appearance. This fixture does not use a customer's orders; inspect a signed-in account with a real pending order in light and dark mode before release.

## Order Success delivery tracking readability

The **Delivery tracking starts here** information panel on the Order Success page had light-mode slate text (`#58627a`, `#737c92`) on a dark graphite (`#1b2638`) surface. The parent panel had dark contrast tokens, but its inner `span` and `small` elements retained the lighter-theme styles. Sprint 12 sets dedicated dark-only heading `#eef3ff`, instruction `#d5e0f2`, and courier-note `#bfcfe7` colors. The small courier note also uses `#5d667b` in light mode for readable contrast against `#f2f7ff`.

The heading, description and footnote use modestly larger shared typography (0.84/0.78/0.74rem) and 1.55 line height for wrapped supporting text. This applies at **phone, tablet and desktop widths**; the card surface, icon, borders, actions, order-state labels and tracking business logic remain unchanged. The mobile regression test checks the actual Order Success markup and >=7:1 text contrast against the dark panel. The Playwright mobile QA additionally mounts an inert visual fixture with loaded storefront CSS and checks the rendered light/dark text contrast (>=4.5:1) and text size across phone, tablet and desktop Storefront viewports. Authenticated order-success visual QA is still required after pulling.

## Checkout dark-mode background continuity

The desktop/mobile Checkout route must use the **same approved galaxy canvas** as the dark Storefront's Cart, Account and Trending → Essentials sections. Sprint 12 removes `.customer-checkout-page` from the legacy `ys-dark-midnight-velvet.svg` **cover-sized shader** group in `theme-storefront.css`, and adds a dedicated dark-only Checkout background in `theme-storefront-contrast.css` using `var(--storefront-galaxy-background)` with `background-size: auto`, top-center positioning, no repetition, a deep-midnight `#101827` base and a smooth vertical fade to that base. No stretched background texture, independent purple/angular shader, or pseudo-element artwork is introduced.

This change affects **only the Checkout page canvas in dark mode**, not card surfaces, headings, inputs, PayMongo/COD behavior, account data, policy spacing, or the top/bottom navigation. Light-mode Checkout retains its previous background. `scripts/test/storefront-checkout-dark-contrast.test.mjs` verifies the legacy shader no longer targets Checkout and the exact Cart galaxy contract is retained. `npm run qa:mobile` evaluates the *computed* Checkout background with a hidden, non-interactive fixture at all portrait-phone, tablet and desktop Storefront QA viewports; it rejects `cover` and the legacy shader, verifies the deep-midnight base, and ensures light mode differs without submitting an order. Verify the actual dark-mode `/checkout` on desktop and 320–430px phones before merging.

## Checkout content density refinement

Sprint 12 preserves the **existing customer topbar and five-action bottom dock** and changes **only the phone Checkout content**. At <=700px in portrait, the Checkout container has consistent 12–16px horizontal gutters; form section cards have 14–16px padding and a roughly 18–22px vertical section rhythm. Two-column fields become one fluid column. Labels and descriptions use a more legible mobile type scale, and input controls remain at least 48px tall with a **16px input font** to avoid mobile Safari focus-zoom. The saved-contact/address preference rows lose their *extra nested frame* while keeping checkbox state, its full touch area and legible helper text. Saved-address and saved-phone cards remain bounded.

Payment-method radio cards retain the branded selected/unselected design, accessibility and payment flow; only padding, media/icon width and text wrapping are refined so the cards are not cramped on narrow screens. Order notes are still optional and editable (no unrequested accordion state). The final summary uses the same full-basket totals, COD/PayMongo status, customer acknowledgement, policy action and button with more usable text width and consistent card spacing. The previously fixed **16px structural delivery-to-policy gap** remains unchanged. Tablet/desktop layouts and dark/light theme palettes are preserved.

Regression: `npm run test:mobile` checks the CSS layout contract and existing Checkout controls, validation and payment branches. `npm run qa:mobile` measures a hidden Checkout fixture using live computed styles for screen gutters, section widths/padding, 48px field size, two readable payment options, full-width summary containment and horizontal overflow at the five phone portrait sizes. This test **does not submit orders** or exercise authenticated customer checkout; complete real-device/form QA still needs to validate address input, stored details, notes, validation errors, PayMongo test checkout and COD flows with a signed-in account.

## Checkout confirmation breathing room

**Sprint 12 follow-up: fixed the actual text-to-button spacing root cause.** The delivery-status description and the **Order cancellation policy** trigger are now siblings inside a dedicated `.customer-checkout-policy-group`, rather than independent direct children of the order summary. The group is explicitly a single-column grid with **16px row gap** and reset paragraph margin/padding, so even the generic `.customer-order-summary > div` flex styling and the global `margin-top: 1rem !important` helper style cannot collapse or defeat the separation. On mobile, the explanation retains readable 1.65 line height. The consent panel and PayMongo/COD action keep their previous spacing, surfaces, validation, and original payment behavior.

`npm run test:mobile` now requires the actual grouped JSX and CSS contract; `npm run qa:mobile` mounts a non-interactive checkout-summary geometry fixture in the loaded storefront stylesheet at 320–430px and **measures the rendered text-to-button gap** (minimum 14px, expected 16px), button hit height, and horizontal containment, without requiring a signed-in checkout session. After pulling, recheck the real checkout UI with PayMongo and COD, including light/dark mode and long wrapped explanation text. The synthetic geometry check does not replace actual authenticated checkout UI testing.

## Mobile review rating filters

The product-detail **All / 5 / 4 / 3 / 2 / 1 star** filters now display as a bounded **three-column by two-row** grid at phone widths up to 520px. Each option retains a 44px minimum touch height, a dynamic review count, and its original `aria-pressed` selection/filter behavior; compact `5 ★` labels replace `5 Star` only in this phone layout. Horizontal scrolling and visible scrollbars are removed **only for rating filters**. Tablet/desktop retains the existing text labels and wrapping behavior. The mobile browser QA checks all six buttons fit in exactly two rows without horizontal clipping at portrait phone viewports and confirms switching from five-star back to all reviews.

## Compact related-products carousel and mobile scrollbars

The **More from this category** rail on product detail now displays two bounded product cards side-by-side on portrait phones, instead of using the former nearly full-screen-width `78vw` cards. The card image stays in a contained 4:3 media slot; titles, ratings, prices, quantity selectors and the icon + Add button are compact and remain inside each card. The horizontal carousel keeps its existing `scroll-snap` behavior, touch swipe and smooth navigation; the user can still browse all recommendations. **On portrait phones, both carousel arrows are centered in a dedicated navigation row below the product cards** instead of using the old absolute-positioned left/right overlays. Each arrow has a 44px touch target and remains within the rail shell. The navigation row is omitted naturally when the related rail has no overflow. The phone-specific layout does not change the desktop carousel or the Home/Shop portrait two-column grids.

At phone-portrait widths, the **storefront document's browser scrollbar is hidden visually** in supporting engines (`scrollbar-width: none` and the WebKit equivalent). This does **not** disable document scrolling, sideways carousel gestures, the browser's keyboard navigation or internal scrollable category menus. Desktop scrollbar presentation is unchanged. Real mobile browsers commonly use unobtrusive transient scroll indicators rather than a permanently prominent desktop scrollbar.

QA: Verify two complete recommendation cards at 320px, 390px and 430px, ensure product images and cart controls stay inside the cards, confirm **both arrows are centered below the cards without obscuring any text or cart actions**, tap both arrow controls, swipe left/right, confirm the rest of the page still scrolls vertically, and test favorites and cart actions. `tools/mobile-qa/run.mjs` checks card width, media height, snap/swipe capability and document scrollbar styling where related products are present. These are browser-rendering checks, not a substitute for real iOS/Android touch testing.

## Mobile product detail and verified reviews

Product detail on phones now uses a capped, proportional image panel instead of a 380–430px minimum-height panel. Product pack-size variants form a full-width scroll-snapped two-up rail with no space-consuming mobile arrow columns. **The thumbnail image row is 100px tall, not 70px**: the visual frame and low-resolution/tall image rules now use scoped `object-fit: contain` and bounded image dimensions, keeping the entire bottle/package inside each thumbnail rather than clipping its base. The rail retains real radio controls and keyboard navigation. A visible swipe hint appears only when the options overflow. The native browser tooltip from the complete variant name was removed because it obscured neighboring options.

Being **signed in** does not make a customer eligible to publish a review. The existing backend security requirement remains unchanged: a `CustomerOrderStatus.COMPLETED` customer order associated with **the same customer account** must contain **the exact product ID** being reviewed. Guest orders, POS sales, different pack-size product IDs, pending and otherwise unmatched orders do not automatically qualify. The mobile review composer makes this distinction explicit and links to the account's Order History, without weakening verified-purchase review protection. Rating/comment drafts are locally preserved as they are written. The disabled Publish button is labeled "Purchase required" until eligible; review-context network failures offer "Retry verification" instead of falsely claiming no order exists.

Verify on the mobile preview at 320px, 390px and 430px: product hero height and image containment, pack-size swipe/selection, correct navigation on size change, review state for a signed-in non-purchaser, successful eligibility after a completed signed-in order, guest sign-in prompt, and light/dark color contrast. No physical-device or authenticated database transaction was performed by the source-contract tests.

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
