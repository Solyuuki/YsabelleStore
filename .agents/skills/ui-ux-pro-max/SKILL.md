---
name: ui-ux-pro-max
description: Use when designing, building, reviewing, or fixing YsabelleStore interfaces, including pages, components, responsive layout, accessibility, typography, color, interaction, product imagery, and visual consistency.
---

# UI/UX Pro Max - YsabelleStore Adapter

Use production UI/UX reasoning while treating the existing YsabelleStore design system and current source as authoritative. This is a portable project adapter inspired by UI UX Pro Max practices; it intentionally avoids depending on a large vendored design database.

## Priorities

Apply in this order:
1. Accessibility and keyboard/touch usability.
2. Correct interaction and loading/error feedback.
3. Responsive layout and content resilience.
4. Existing Ysabelle brand/design-system consistency.
5. Performance and layout stability.
6. Typography, spacing, density, and visual polish.
7. Motion only when it improves comprehension or feedback.

## Repository-first rules

- Inspect the current component, nearby styles, design tokens, and existing reusable UI before proposing new patterns.
- Preserve the approved Ysabelle blue/purple/pink identity and existing brand assets unless the task explicitly changes branding.
- Reuse the project's existing React, Tailwind, shadcn/Base UI, Radix, Lucide, GSAP, and charting stack before adding dependencies.
- Do not replace stable working UI solely to match a trend or external example.
- Do not change backend/business logic during a visual-only task.

## Production UI checks

- Body text should remain readable at browser zoom and narrow widths; avoid clipping and fragile fixed heights.
- Interactive targets should be comfortably touchable, keyboard reachable, and visibly focused.
- Meaning must not depend on color alone.
- Reserve media space to avoid layout shift; lazy-load non-critical images where appropriate.
- Prefer semantic design tokens over scattered raw colors.
- Use consistent spacing and component states: default, hover, focus, active, disabled, loading, error, empty.
- Respect `prefers-reduced-motion` for non-essential motion.

## Product image normalization

For product cards and PDP/product-detail views:
- Use a stable aspect-ratio media frame.
- Keep the full product visible with `object-fit: contain` unless deliberate cropping is approved.
- Center the subject and enforce consistent visual padding.
- Cap rendered size with `max-width`/`max-height`; do not enlarge a small source until it becomes visibly pixelated.
- Preserve aspect ratio; never stretch to fill.
- Use separate thumbnail/card/detail variants when the asset pipeline supports them.
- Low-resolution sources should render smaller rather than be aggressively upscaled.
- Keep layout behavior generic; do not hard-code per-product dimensions unless the data model explicitly supports image focal metadata.

## Decision rule

Before hand-writing a new visual component, use `21st-cli-use` when a reusable catalog component could reasonably exist. For custom animation work, use `motion-dev-animations` only after checking the repository's existing animation approach.

## Verification

For a UI change, verify the affected component/page at representative mobile, tablet, and desktop widths; check focus/keyboard behavior; check overflow and long text; and run the affected frontend lint/typecheck/build required by `ysabelle-context`.
