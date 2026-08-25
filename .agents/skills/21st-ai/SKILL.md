---
name: 21st-ai
description: Use when the user explicitly wants 21st AI for UI ideation or when no suitable existing component is found and a generated visual draft would materially help choose a direction before project-native implementation.
---

# 21st AI Drafting - YsabelleStore Adapter

Use 21st AI as a design drafting surface, not as an authority over the repository.

## Rules

- Treat generated HTML/Tailwind as a visual prototype or design specification. Rebuild the chosen direction in YsabelleStore's real React/components/tokens rather than pasting a draft blindly.
- Inspect current UI and `ui-ux-pro-max` guidance before writing the generation prompt so the draft respects the existing product.
- Keep private repository data, credentials, customer data, and internal implementation details out of external prompts.
- Generation/iteration may consume provider quota or credits. Do not trigger a metered generation/iteration without explicit user approval for that external usage.
- Free retrieval of an already-created take may be used when authorized and available.
- Reject generated patterns that break accessibility, mobile behavior, content resilience, performance, or YsabelleStore brand consistency.

## Handoff

After selecting a draft:

1. Extract layout hierarchy, spacing, interaction intent, and reusable component ideas.
2. Map those ideas to existing YsabelleStore components first.
3. Use `21st-cli-use` for reusable catalog components where appropriate.
4. Implement only the approved direction and run normal frontend verification.
