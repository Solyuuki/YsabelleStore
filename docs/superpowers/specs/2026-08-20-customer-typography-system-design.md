# Customer Typography and Alignment System Design

Date: 2026-08-20
Branch: `m1/v0.5/feat/about-story-storefront-handoff`
Scope: customer-facing YsabelleStore storefront only

## Goal

Create a coherent, production-grade typography and text-alignment system across the customer-facing storefront without redesigning the product or changing business behavior. The result must remain readable and visually stable across wide desktop, laptop, tablet, mobile, intermediate viewport widths, and loading/empty/error/populated states.

The governing principles are: clarity over decoration, consistency over novelty, hierarchy over visual competition, reuse over duplication, structure over manual positioning, accessibility over aesthetic tricks, and responsive behavior over single-screenshot perfection.

## Current Root Causes

The storefront currently has two overlapping typography systems. `global.css` defines general `--type-*`, leading, tracking, and font-family tokens, while `customer.css` defines a second `--customer-type-*` scale and then mixes both systems in customer components. This makes equivalent roles drift in size and line-height.

Several customer/story sections also introduce one-off `clamp()` values rather than using a small semantic hierarchy. Some editorial story headings use large viewport-driven sizes, narrow max-widths, `white-space` constraints, or decorative italic modifiers. Those choices can produce awkward multi-line wrapping, text/card competition, and inconsistent posture at intermediate widths.

The About storefront handoff has already accumulated a separate layout override file to correct collision and responsive sizing. That isolation is useful, but future work must avoid adding more emergency overrides on top of conflicting base rules.

## Typography Architecture

### Canonical primitives

`global.css` remains the canonical source for generic typography primitives:

- font families
- base display/H1/H2/H3/H4/body/label/button/nav/caption sizes
- leading
- tracking
- reusable generic type utility classes

These primitives continue to support the whole application and must not be changed in ways that unexpectedly redesign staff/admin screens.

### Customer semantic aliases

`customer.css` remains the storefront boundary and exposes customer semantic aliases. The aliases should derive from the canonical primitives when the role matches rather than maintaining an independent competing scale.

Customer roles are:

- marketing/display headline
- page H1
- section H2
- card/product H3
- large body/lead
- normal body
- supporting/small body
- label/eyebrow
- navigation
- button/control text
- caption/status/metadata

A storefront-specific display role may remain for editorial story scenes, but it must be bounded and responsive rather than an unrestricted viewport-sized exception.

### Font-family policy

- Body, navigation, controls, forms, metadata, and dense commerce UI use the existing sans stack.
- Marketing/display headings may use the existing serif display stack where the current visual identity intentionally uses it.
- One semantic heading must not mix upright and italic posture merely for decoration.
- Accent can come from color or gradient without making a line look like a different typeface.

## Hierarchy and Sizing Policy

Equivalent roles should use equivalent sizing and leading across customer pages. Page H1, section H2, product/card H3, body, supporting text, labels, and controls must not each invent new size formulas unless content density genuinely requires a documented exception.

Large display text must be constrained so it does not squeeze functional UI, collide with adjacent cards, or produce ugly three-to-five-line headings at intermediate widths. Responsive typography should rely on a small number of meaningful `clamp()` values tied to semantic roles, supported by sensible container widths and grid tracks.

The design must not create breakpoints for every verification width. Existing breakpoints should be simplified where possible and only new breakpoints with real layout meaning should be added.

## Wrapping and Text Measure

- Customer paragraphs keep readable measures and `text-wrap: pretty` where supported.
- Customer headings keep balanced wrapping where appropriate.
- Multi-word display headings must not depend on global `white-space: nowrap`.
- Grid/Flex text children must be able to shrink with `min-width: 0` where necessary.
- Large headings should use content widths that allow intentional two- or three-line compositions without colliding with adjacent commerce UI.
- Numeric/editorial motifs such as a large year may keep nowrap when the content is deliberately a single visual token and does not affect reading order.

## Alignment Policy

Readable customer content defaults to left alignment. Center alignment is reserved for components that genuinely benefit from it, such as compact empty/loading states or intentionally centered standalone panels.

Text, icons, labels, buttons, and neighboring content should share real layout alignment lines through Grid/Flex, container width, padding, gap, `align-items`, `justify-content`, and `justify-self`. Arbitrary negative margins, manual translations, or magic horizontal offsets must not be introduced to imitate alignment.

## Story / Discover Treatment

The story experience may remain more editorial than the catalog, but it must still use the same semantic principles.

Existing decorative modifiers that italicize only one line of a single heading should be removed or neutralized unless there is a clear semantic reason. Color/gradient accents may remain.

Extremely large story text should be capped and reviewed for intermediate widths. The goal is not to flatten the story into standard ecommerce typography; the goal is to keep its identity while removing fragile sizing, awkward wrapping, and mixed-posture treatments.

## About Storefront Handoff

The approved heading is:

- `From Local`
- `to Smart Retail`

Both lines are one heading and therefore use the same display family, compatible weight, and upright posture. The second line may retain its gradient accent.

The section must preserve:

- one clear primary `Shop the live catalog` CTA
- storefront search
- cart access
- product links
- Quick Add
- Retry Connection only for actual request errors
- existing catalog loading/error behavior
- existing GSAP/reduced-motion behavior

The section must not reintroduce a duplicate generic `Open catalog` CTA.

The two-column desktop composition must prevent heading/card collision through proper grid sizing and bounded typography, not transforms or manual offsets. Tablet/mobile behavior remains intentionally single-column where already designed that way.

## Bad-Design Anti-Patterns to Prevent

The implementation must actively avoid:

- competing primary CTAs
- duplicate links/actions with the same intent and destination
- duplicate information used only to fill space
- random italic/upright switching
- unrelated font sizes for equivalent roles
- oversized poster-like headings that push commerce functionality aside
- awkward orphan lines and uncontrolled wrapping
- alignment by arbitrary offsets
- CSS patch stacking and escalating specificity
- inconsistent spacing between equivalent components
- false affordances
- contradictory loading/empty/error messaging
- decoration that reduces readability
- accessibility regressions
- desktop-only design followed by mechanical mobile stacking
- unnecessary UI novelty
- destructive consistency that removes meaningful hierarchy

## Files and Boundaries

Expected primary implementation files:

- `frontend/src/styles/global.css`
- `frontend/src/styles/customer.css`
- `frontend/src/styles/about-storefront-handoff.css`
- `frontend/src/styles/about-storefront-handoff-layout.css`
- focused guardrail tests under `scripts/test/`

Customer TSX files should only be changed if a semantic class or markup correction is required to express the typography role cleanly. Unrelated component refactors are out of scope.

Explicitly out of scope:

- backend behavior
- API contracts
- database/Prisma
- SARIMA/forecasting
- inventory logic
- authentication/authorization
- supplier workflows
- checkout business rules
- cart calculations
- product availability rules
- staff/admin behavior
- Electron behavior

Routes, search, catalog fetching, product links, cart behavior, Quick Add, loading/error logic, accessibility behavior, and motion behavior must be preserved.

## Implementation Strategy

1. Add regression tests first for the intended typography system and known anti-patterns.
2. Normalize customer semantic typography aliases so they derive from the canonical global system where roles match.
3. Replace high-impact one-off customer heading/body sizes with semantic aliases where safe.
4. Remove decorative mixed-posture styling from story headings while preserving color/gradient identity.
5. Simplify responsive story/About sizing and wrapping rules; fix root layout relationships rather than adding manual offsets.
6. Review the diff for duplicate declarations, conflicting media queries, and accidental scope expansion.
7. Run focused guardrails, frontend typecheck, lint, and build.
8. Perform visual verification at representative widths and content states before declaring the task complete.

## Verification

Code verification should include, where available:

- focused About/storefront regression tests
- `npm run test:guardrails`
- `npm run typecheck --workspace frontend`
- `npm run lint --workspace frontend`
- `npm run build --workspace frontend`

Representative visual verification widths are approximately 1440+, 1280, 1100, 1024, 900, 768, 640, 430, and 375 pixels. These are test widths, not mandatory CSS breakpoints.

Visual review must inspect hierarchy, wrapping, line length, spacing, font/posture consistency, CTA hierarchy, text/card alignment, and loading/empty/error/populated states. Compilation alone is not evidence of acceptable design.

## Completion Criteria

The work is complete only when:

- equivalent customer typography roles are consistent
- no new duplicate CTA or duplicated design logic is introduced
- the approved About heading is upright and visually coherent
- headings do not collide with adjacent cards or clip at common intermediate widths
- customer text alignment follows deliberate layout relationships
- responsive behavior remains intentional across desktop/tablet/mobile
- accessibility and functional behavior are preserved
- relevant checks pass, or any unverified checks are reported explicitly
- the final diff contains no unrelated subsystem changes

Before completion, perform a self-critique: did the implementation introduce any duplicate CTA, inconsistent font treatment, unnecessary override, awkward wrap, fragile breakpoint, or manual alignment hack? If yes, correct it before reporting completion.
