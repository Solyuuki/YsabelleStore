import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [routeIndex, supportRoutes, supportService, customerApp, supportPage, footer] =
  await Promise.all([
    readFile(new URL("../../backend/src/routes/index.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../backend/src/routes/customerSupport.routes.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../../backend/src/services/customerSupportService.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../../frontend/src/app/CustomerApp.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../../frontend/src/pages/customer/CustomerSupportPage.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../../frontend/src/components/customer/CustomerFooter.tsx", import.meta.url),
      "utf8"
    )
  ]);

test("customer support API is mounted and creates ticket references", () => {
  assert.match(routeIndex, /router\.use\("\/customer-support", customerSupportRouter\)/);
  assert.match(supportRoutes, /customerSupportRouter\.post\(\s*"\/tickets"/);
  assert.match(supportRoutes, /optionalCustomerAuth/);
  assert.match(supportRoutes, /CUSTOMER_SUPPORT_RATE_LIMITED/);
  assert.match(supportService, /YS-CS-/);
  assert.match(supportService, /senderType: "CUSTOMER"/);
  assert.match(supportService, /senderType: "SYSTEM"/);
});

test("customer storefront exposes the support page, form, FAQ and footer entry", () => {
  assert.match(customerApp, /pathname === "\/support"/);
  assert.match(customerApp, /CustomerSupportPage/);
  assert.match(supportPage, /Submit support request/);
  assert.match(supportPage, /Frequently asked questions/);
  assert.match(supportPage, /customer-support-field-tooltip/);
  assert.match(supportPage, /Locked while signed in\. Change your name in My Account\./);
  assert.match(supportPage, /Verified account email\. It identifies your ticket/);
  assert.match(supportPage, /customer\.defaultContactPhone \?\? customer\.phone \?\? ""/);
  assert.match(supportPage, /Uses your saved contact mobile/);
  assert.match(supportPage, /createdTicket\.ticketNumber/);
  assert.match(footer, /href="\/support"/);
  assert.match(footer, /Customer Support/);
});

test("dark support reuses approved storefront art and keeps every support label legible", async () => {
  const [darkCss, sharedArt] = await Promise.all([
    readFile(
      new URL("../../frontend/src/styles/theme-storefront-contrast.css", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL(
        "../../frontend/src/components/customer/StorefrontGalaxyArtwork.tsx",
        import.meta.url
      ),
      "utf8"
    )
  ]);
  const darkStyles = darkCss.replace(/\s+/g, " ");
  assert.match(
    supportPage,
    /className="customer-support-page__artwork"[\s\S]*?<StorefrontGalaxyArtwork className="customer-support-page__cosmos"/,
    "Support body must reuse the approved shared constellation SVG."
  );
  assert.match(sharedArt, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(supportPage, /<CategoryRetailBackdrop \/>/);
  assert.match(
    darkStyles,
    /:root\.dark \.customer-app \.customer-support-page\s*\{[^}]*var\(--storefront-galaxy-background\) !important;/,
    "Support body must reuse the storefront galaxy CSS token."
  );
  assert.match(
    darkStyles,
    /\.customer-support-page\s*\{[^}]*#101827 100%/,
    "Support page must fade to the shared footer surface."
  );
  assert.match(
    darkStyles,
    /\.customer-support-hero\s*\{[^}]*background:\s*var\(--storefront-category-background\) !important;/,
    "Support heading reuses the approved Shop by Category backdrop."
  );
  assert.match(
    darkStyles,
    /\.customer-support-hero::after\s*\{[^}]*display:\s*none;/,
    "Legacy support curves must not be rendered over the approved hero."
  );
  assert.match(
    darkStyles,
    /\.customer-support-section-heading > span\s*\{[^}]*color:\s*#e5edfb;/,
    "Support operations badge must have readable ink on a dark background."
  );
  assert.match(
    darkStyles,
    /\.customer-support-faq summary\s*\{[^}]*color:\s*#e3eaf9;/,
    "All support FAQ questions must use readable text, including collapsed rows."
  );
  assert.match(darkStyles, /\.customer-support-faq summary:focus-visible\s*\{[^}]*outline:/);
  assert.match(darkStyles, /\.customer-support-page__artwork\s*\{[^}]*display:\s*none;/);
  assert.match(supportPage, /FAQS\.map\(\(faq\) =>/);
  assert.match(supportPage, /onSubmit=\{\(event\) => void handleSubmit\(event\)\}/);
});
