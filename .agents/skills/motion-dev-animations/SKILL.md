---
name: motion-dev-animations
description: Use when a YsabelleStore UI task explicitly involves animation, motion, scroll effects, parallax, entrances, hover/tap feedback, page transitions, or layout animation and the animation approach must be chosen or reviewed.
---

# Motion.dev Animation Guidance - YsabelleStore Adapter

Design motion to be purposeful, smooth, accessible, and cheap to render. This project already uses GSAP, so repository precedent takes priority over introducing another animation runtime.

## Library choice

- For existing Discover/About scrollytelling and GSAP-driven flows, keep GSAP. Do not migrate them to Motion.dev unless the user explicitly requests a migration.
- For simple hover/focus/press transitions, prefer CSS when it is sufficient.
- Use Motion.dev only when it is already present in the relevant package or the user explicitly approves adding it for a concrete benefit.
- Never add Motion.dev only to reproduce behavior already handled cleanly by CSS or GSAP.

## Performance and accessibility

- Prefer `transform` and `opacity` for animated properties.
- Avoid width/height/top/left animation when transforms can express the effect.
- Respect `prefers-reduced-motion` and provide a stable non-animated state.
- Do not hijack wheel/touch scrolling or globally disable normal scrolling.
- Avoid layout shifts and animation-driven content clipping.
- Keep interactive state semantically correct even if an animation is interrupted.
- Profile visually expensive scroll effects and reduce work on mobile.

## Motion design

Use motion to communicate hierarchy, state change, continuity, or feedback. Keep decorative motion restrained. Use consistent easing/timing within a flow instead of assigning arbitrary values per element.

## Verification

Check reduced-motion behavior, keyboard/touch interaction, no new overflow or scroll traps, no obvious jank on the target page, and the normal frontend checks required by `ysabelle-context`.
