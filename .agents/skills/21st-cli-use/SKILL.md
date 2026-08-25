---
name: 21st-cli-use
description: Use when a YsabelleStore frontend task needs a new React/shadcn UI component, theme reference, or reusable interface pattern and an existing 21st.dev catalog item may be preferable to hand-writing it.
---

# 21st.dev Component Sourcing - YsabelleStore Adapter

Search before hand-writing commodity UI. YsabelleStore already has `frontend/components.json`, so 21st/shadcn-compatible components may be useful when they fit the existing stack and brand.

## Workflow

1. Inspect the repository for an existing component first.
2. If no suitable local component exists, search the 21st catalog using the CLI from the frontend workspace, for example:
   `npx @21st-dev/cli search "<component intent>" --limit 10`
3. Inspect the candidate's code, dependencies, accessibility, license/source terms, and visual fit before installing.
4. Prefer a close reusable component over a fresh custom implementation when adaptation is smaller and safer.
5. Install only the selected component and only the dependencies it actually requires.
6. Adapt styling to YsabelleStore tokens and established component conventions; do not import a foreign theme wholesale.
7. Run the affected frontend verification after installation/adaptation.

## Guardrails

- Do not publish YsabelleStore components, themes, templates, or private design information to 21st.dev unless the user explicitly asks for that external side effect.
- Do not paste API keys into source, prompts, logs, commits, or screenshots. Use the provider's supported local credential/env flow.
- Do not use paid or metered generation merely because it is available; use `21st-ai` for that path.
- Do not overwrite an existing shared component without inspecting all call sites.
- Do not add a component just because it looks attractive; it must fit the actual task, accessibility requirements, responsive behavior, and project architecture.

## Selection criteria

Prefer candidates that are React-compatible, Tailwind/shadcn-friendly, accessible, keyboard-safe, dependency-light, responsive, and easy to restyle with existing Ysabelle tokens.

If no candidate is a good fit, hand-write the smallest project-native component instead of forcing a registry component.
