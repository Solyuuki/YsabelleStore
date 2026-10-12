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

- Small portrait phones (320–430 CSS px) use a compact two-column category/catalog grid and a four-item fixed bottom navigation (Home, Shop, Cart, Account). Cart quantity remains connected to the existing cart state.
- Landscape phones use a compact navigation row beneath the header, adaptive photo proportions and no horizontally scrolling category sidebar.
- Tablets use the compact navigation row and three-column category grid; desktop keeps its original full Storefront navigation.
- The Shop category navigation is collapsed by default on mobile and expands into a wrapping grid with a 44px minimum interactive target instead of a horizontal scroller.
- The new layout styles are in `frontend/src/styles/customer-adaptive-mobile.css` and are imported last so they do not override desktop theme rules outside responsive breakpoints.
- The established Storefront routes, category/product source, visual assets, owner/staff POS screens and backend remain unchanged.
- Run `npm run test:mobile` to check mobile preview navigation and Storefront responsive contracts.

**Manual visual QA still required:** use the preview's 320 × 640, 390 × 844, 640 × 320, and 768 × 1024 options, switch light/dark modes, inspect both Home and Shop, and verify there is no body-wide horizontal overflow or clipped buttons. Real phone testing is still required for soft keyboards, touch behavior and safe areas.

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
