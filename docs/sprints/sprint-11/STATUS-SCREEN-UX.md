# Sprint 11 Status Screen UX

## Purpose

Sprint 11 uses one canonical full-screen status presentation for authentication, authorization,
navigation, service availability, backend connectivity, database readiness, offline state, and
system-wide timeouts.

The goal is to keep status handling company-grade and visually uniform instead of maintaining a
different one-off layout for every error state.

## UI foundation

The status screen uses the existing Ysabelle Store reliability shell and design tokens:

- Blue: `#008CFF`
- Indigo: `#625BFF`
- Violet: `#A83CF0`
- Magenta: `#F43F8C`
- Navy: `#101426`
- Surface: `#F7F9FF`
- White: `#FFFFFF`

The content composition follows the open-code Empty-state pattern published by shadcn/ui:
icon/media, title, description, supporting content, and actions. The implementation is local to
Ysabelle Store and uses the repository's existing React, Tailwind, Button, Lucide, typography,
motion, and accessibility conventions. No new runtime dependency is introduced.

Reference:
- https://ui.shadcn.com/docs/components/base/empty
- https://ui.shadcn.com/docs

## Full-screen status matrix

| Condition | Status label | Presentation |
| --- | --- | --- |
| Protected session expired | HTTP 401 | Session expired / sign in again |
| Route authorization denied | HTTP 403 | Access denied |
| Missing internal route | HTTP 404 | Page not found |
| Missing storefront route | HTTP 404 | Page not found |
| Service unavailable | HTTP 503 | Service unavailable / retry |
| Backend unreachable | SERVICE | Store service unavailable / retry |
| Database unavailable | DATABASE | Database safety mode / retry |
| Device offline | OFFLINE | Offline state / automatic recovery |
| Repeated/system timeout | TIMEOUT | Service timeout / retry |

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
- reuses the existing reduced-motion behavior;
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
