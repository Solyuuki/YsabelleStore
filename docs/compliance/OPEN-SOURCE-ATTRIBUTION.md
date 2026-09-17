# Open-Source Attribution

> **Baseline:** `sprint/v0.10/sprint-10`

YsabelleStore is built with open-source frameworks and libraries while retaining separate project-authored application code. This document provides a concise attribution suitable for engineering, academic and HCI documentation.

## Primary UI Library

| Field | Declaration |
| --- | --- |
| Library | Tailwind CSS |
| Declared version | `^3.4.17` in `frontend/package.json` |
| Resolved version | **3.4.19** in `package-lock.json` |
| License | MIT License |
| Copyright | Tailwind Labs, Inc. |
| Official repository | `https://github.com/tailwindlabs/tailwindcss` |
| Versioned license source | `https://github.com/tailwindlabs/tailwindcss/blob/v3.4.19/LICENSE` |
| Local evidence | `docs/licenses/TAILWIND-CSS-LICENSE.md` |
| Project use | Primary utility styling framework for the React/Vite interface |
| Library-source modification | No claim is made that YsabelleStore modifies or redistributes Tailwind's source as project-owned code; application configuration/components/styles are YsabelleStore-specific |

### MIT Obligation Summary

The MIT License permits use, copying, modification, distribution, sublicensing and sale subject to retaining the copyright and permission notice in copies or substantial portions of the licensed software. The upstream software is provided without warranty under the terms stated in the license.

## Broader Open-Source Stack

YsabelleStore also uses React, Vite, Base UI, Radix UI, Lucide, Chart.js, Recharts, Express, Prisma, Electron, Python scientific libraries, testing/quality tooling and other dependencies recorded in `THIRD_PARTY_NOTICES.md` and `SOFTWARE-COMPONENT-INVENTORY.md`.

Because licenses and resolved versions can change as lockfiles/dependencies change, this file does not duplicate unverified legal text for every transitive package. Release compliance should be generated/reviewed from the exact resolved dependency graph.

## Academic / HCI Attribution Block

The following concise statement may be reused in the project README/About page and CS114 documentation:

> **UI Library Attribution:** YsabelleStore uses Tailwind CSS 3.4.19 as its primary open-source styling framework. Tailwind CSS is developed by Tailwind Labs, Inc. and is distributed under the MIT License. YsabelleStore's application-specific components, layouts, design rules and business logic remain separate project work. The official Tailwind CSS repository and versioned MIT license are recorded in the project's third-party compliance documentation.

## Governance

Do not describe the whole YsabelleStore repository as MIT-licensed merely because Tailwind CSS is MIT-licensed. Third-party licenses govern their respective components; the project's own licensing/ownership status must be decided separately by the project owners.