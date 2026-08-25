---
name: ysabelle-ui-orchestrator
description: Use when implementing or materially revising any YsabelleStore frontend interface, especially storefront, product cards, PDP/product detail, customer navigation, dashboards, responsive layout, visual polish, or UI component architecture.
---

# Ysabelle UI Orchestrator

Coordinate UI work without letting external skills override repository truth.

**REQUIRED COMPANION:** Use `ysabelle-context` for repository-first discovery and verification.

## Order of work

1. Inspect current source, reusable components, tokens, and the nearest working pattern.
2. Apply `ui-ux-pro-max` for usability, responsive, accessibility, hierarchy, and visual-quality decisions.
3. Before creating a commodity UI component from scratch, use `21st-cli-use` to check whether a strong React/shadcn-compatible component already exists.
4. Use `21st-ai` only for an explicitly approved external drafting/generation step.
5. For animation, use `motion-dev-animations`; preserve existing GSAP flows unless there is a specific approved reason to change libraries.
6. Implement the smallest coherent project-native solution, then verify according to `ysabelle-context`.

## YsabelleStore non-negotiables

- Preserve the approved Ysabelle brand mark and blue/purple/pink visual identity unless branding is the task.
- Prefer the existing React/Tailwind/shadcn/Base UI/Radix/Lucide stack and established design tokens.
- Do not let an imported component introduce a second visual system.
- UI-only work must not silently change inventory, POS, forecasting, supplier, checkout, or other business rules.
- Customer pages must remain usable on common mobile and desktop widths.
- Product media must use consistent frames, contain the full item, preserve aspect ratio, avoid aggressive upscaling, and avoid per-product CSS hacks.

## Completion contract

A UI task is not complete merely because it renders. Verify responsive behavior, overflow/long content, keyboard/focus states, loading/empty/disabled/error states that the component owns, image behavior where relevant, reduced-motion behavior for animations, and affected lint/typecheck/build checks.
