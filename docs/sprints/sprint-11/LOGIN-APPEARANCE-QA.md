# Sprint 11 — Retail Sign-In Appearance QA

## Scope

The Known Accounts and password sign-in screens share the existing retail
appearance preference with the Owner and Staff workstation. The customer
storefront keeps its independent theme preference.

Dark login reuses `--storefront-galaxy-background` and
`StorefrontGalaxyArtwork` from Trending through Everyday Essentials. The
full-viewport CSS palette does not tile or cap at 1600px; its proportional
vector artwork is decorative and fades into the same footer background.

## Manual QA checklist

1. Open `/staff-login` in Light Mode. Confirm the accessible Light/Dark switch
   appears above the account panel, without overlapping the account cards.
2. Use the switch to select Dark. Confirm the track and moon indicator move,
   the login background uses the shared Storefront Trending → Everyday
   Essentials galaxy palette and SVG artwork, and all account names, badges,
   helper text, inputs, and actions remain readable.
3. Refresh the page. Dark must remain selected without a Light Mode flash.
4. Continue with a trusted Owner account or sign in with a password. Dashboard,
   sidebar, and Settings must open in the selected Dark Mode.
5. Change the retail appearance from Owner Settings to Light. Return to the
   login screen using the normal logout flow. The switch must read Light.
6. Repeat with a Staff account. The preference is local to this workstation,
   not tied to a remembered account or transferred to the storefront.
7. With the retail preference set to Dark, visit the customer storefront.
   Verify its independent preference is unchanged.
8. Test keyboard Tab/Space operation, visible focus, and narrow layouts.
   Reduced-motion preferences must suppress switch motion.
9. Verify receipt-print and protected About scenes keep their existing
   presentation and no stretched texture, repeated SVG, side gutters, or
   horizontal seams appear at different viewports (especially ultrawide screens).

## Automated evidence

- `scripts/test/retail-auth-appearance.test.mjs` validates accessible switch
  wiring, saved preference handoff, shared galaxy background reuse, and
  non-repeating proportional SVG artwork.
- The frontend build and dark-mode contract jobs must pass on the same commit.
- Final release acceptance requires the entire repository CI to pass.

No database migration, permissions change, or per-account theme storage is
introduced by this feature.
