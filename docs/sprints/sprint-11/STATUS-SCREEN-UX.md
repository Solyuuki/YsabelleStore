# Sprint 11 Status Screen UX

## Purpose

Sprint 11 uses one status-page design language with three deliberate page families instead of one
repeated composition for every failure state:

- authentication and permission states: HTTP 401 and HTTP 403;
- navigation states: HTTP 404;
- system and reliability states: HTTP 503, backend unreachable, database unavailable, offline, and
  repeated/system-wide timeout.

This preserves a consistent Ysabelle Store product language without making every screen look like a
copy with only the icon and headline changed.

## UI foundation

The presentation layer now adapts complete open-source error and maintenance page patterns rather
than composing the visual hierarchy from low-level primitives.

Primary references:

- OrbynAdmin `ErrorState` and maintenance layouts:
  https://github.com/masondevx/orbynadmin
- Shadcn Dashboard Vite error-page family:
  https://github.com/chanseek/shadcn-dashboard

Both references are MIT-licensed. The implementation keeps Ysabelle Store's own React/Vite runtime,
Button and Lucide primitives, brand mark, accessibility behavior, and reliability logic. No new
runtime dependency is introduced.

Ysabelle Store palette remains:

- Blue: `#008CFF`
- Indigo: `#625BFF`
- Violet: `#A83CF0`
- Magenta: `#F43F8C`
- Navy: `#101426`
- Surface: `#F7F9FF`
- White: `#FFFFFF`

The redesign intentionally removes the previous concentric status rings, repeated accent dots,
floating HTTP badge treatment, and generic safety cards from non-system pages. Typography, spacing,
and CTA hierarchy are inherited from the referenced full-page patterns, then reskinned to the
Ysabelle system.

## Full-screen status matrix

| Condition                  | Status label | Page family                | Presentation                       |
| -------------------------- | ------------ | -------------------------- | ---------------------------------- |
| Protected session expired  | 401          | Auth / permission          | Session expired / sign in again    |
| Route authorization denied | 403          | Auth / permission          | Access denied                      |
| Missing internal route     | 404          | Navigation                 | Large-code page-not-found layout   |
| Missing storefront route   | 404          | Navigation                 | Large-code storefront not found    |
| Service unavailable        | 503          | System / reliability       | Service unavailable / retry        |
| Backend unreachable        | SERVICE      | System / reliability       | Store service unavailable / retry  |
| Database unavailable       | DATABASE     | System / reliability       | Database safety mode / retry       |
| Device offline             | OFFLINE      | System / reliability       | Offline state / automatic recovery |
| Repeated/system timeout    | TIMEOUT      | System / reliability       | Service timeout / retry            |

## Approved notification statuses

The existing notification/toast UX remains the approved treatment for isolated request failures:

- HTTP 405
- HTTP 409
- HTTP 413
- HTTP 415
- HTTP 429
- HTTP 500
- HTTP 502
- HTTP 504

HTTP 400 and HTTP 422 remain contextual form/request feedback.

## Safety and accessibility

The canonical status screen:

- renders through a portal above the application shell;
- marks the underlying application content inert while a full-screen state is active;
- uses a lock counter so concurrent status screens cannot prematurely re-enable the background;
- moves focus to the status surface and restores prior focus when appropriate;
- supports assertive live announcements for critical states;
- respects the repository-wide reduced-motion policy;
- preserves transaction/write gating during reliability failures;
- does not treat a failed request as successful;
- avoids showing a session-expired screen for normal guest storefront session probes.

## QA requirement

Before Sprint 11 closure, manually verify desktop and responsive behavior for:

1. HTTP 401 protected-session expiry.
2. HTTP 403 internal role denial.
3. HTTP 404 internal route.
4. HTTP 404 storefront route.
5. HTTP 503 service unavailable.
6. Backend process unavailable while the frontend remains running.
7. Database readiness unavailable.
8. Browser/device offline.
9. Repeated health timeout and automatic recovery.
10. Focus, keyboard navigation, reduced-motion, and recovery CTA behavior.

Automated checks remain necessary but do not replace the manual visual QA above.
