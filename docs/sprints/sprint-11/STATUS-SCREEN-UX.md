# Sprint 11 Status Screen UX

## Purpose

Sprint 11 uses one Ysabelle Store full-screen status system with three page families instead of one
repeated composition for every failure state:

- authentication and permission states: HTTP 401 and HTTP 403;
- navigation states: HTTP 404;
- system and reliability states: HTTP 503, backend unreachable, database unavailable, offline, and
  repeated/system-wide timeout.

The status handling logic is shared, while the visual treatment remains state-specific enough to avoid
copy-paste pages.

## UI foundation

The presentation layer adapts complete open-source error-page patterns instead of composing every
screen from low-level primitives.

Primary layout references:

- OrbynAdmin ErrorState patterns: https://github.com/masondevx/orbynadmin
- shadcn-admin error-page family: https://github.com/satnaing/shadcn-admin

Status illustrations use one locally vendored unDraw family:

- source mirror: https://github.com/cuuupid/undraw-illustrations
- official unDraw license: https://undraw.co/license

The SVG assets are bundled locally so offline, backend-unreachable, and service-unavailable screens do
not depend on a third-party CDN. Their primary purple accent is reskinned to Ysabelle Indigo
`#625BFF`.

Ysabelle Store palette remains:

- Blue: `#008CFF`
- Indigo: `#625BFF`
- Violet: `#A83CF0`
- Magenta: `#F43F8C`
- Navy: `#101426`
- Surface: `#F7F9FF`
- White: `#FFFFFF`

The official Ysabelle full logo lockup is used in the page header. The background keeps a restrained
animated Ysabelle aurora and faint grid. Status illustrations use slow float/halo motion and stop when
`prefers-reduced-motion` is enabled. No new runtime animation dependency is introduced.

## Full-screen status matrix

| Condition                  | Status label | Page family        | Illustration    |
| -------------------------- | ------------ | ------------------ | --------------- |
| Protected session expired  | 401          | Auth / permission  | Login/session   |
| Route authorization denied | 403          | Auth / permission  | Security/access |
| Missing internal route     | 404          | Navigation         | Lost/navigation |
| Missing storefront route   | 404          | Navigation         | Lost/navigation |
| Service unavailable        | 503          | System/reliability | Maintenance     |
| Backend unreachable        | SERVICE      | System/reliability | Server status   |
| Database unavailable       | DATABASE     | System/reliability | No data         |
| Device offline             | OFFLINE      | System/reliability | Connectivity    |
| Repeated/system timeout    | TIMEOUT      | System/reliability | Time management |

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
- disables decorative motion for reduced-motion users;
- preserves transaction/write gating during reliability failures;
- does not treat a failed request as successful;
- avoids showing a session-expired screen for normal guest storefront session probes;
- keeps all status illustrations inside the frontend bundle for failure-path reliability.

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
10. Focus, keyboard navigation, reduced-motion, illustration motion, and recovery CTA behavior.

Automated checks remain necessary but do not replace the manual visual QA above.
