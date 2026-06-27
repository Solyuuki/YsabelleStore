# m1 Decisions

## Sprint 1 Frontend Shell

| Decision ID | Date       | Area    | Decision                                                                 | Reason                                                                                                      |
| ----------- | ---------- | ------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| DEC-M1-001  | 2026-06-27 | Routing | Use a minimal browser history route foundation for Sprint 1 shell routes | The project does not currently include `react-router-dom`, and Sprint 1 forbids package installs            |
| DEC-M1-002  | 2026-06-27 | UI      | Use local shadcn-style Button, Card, and Badge primitives                | The repo is shadcn/ui-ready but had no generated primitives yet                                             |
| DEC-M1-003  | 2026-06-27 | UX      | Keep the shell desktop-first with a 1024px minimum width                 | The target runtime is a Windows Electron desktop app, not a mobile web app                                  |
| DEC-M1-004  | 2026-06-27 | Scope   | Keep all modules static and business-logic-free                          | Sprint 1 M1 scope is navigation, layout, and UI foundation only                                             |
| DEC-M1-005  | 2026-06-27 | UX      | Use clamp-based desktop scaling for the Welcome screen                   | The Welcome view needed to feel balanced from 1366px through fullscreen desktop sizes                       |
| DEC-M1-006  | 2026-06-27 | Motion  | Limit ambient animation to the Welcome screen only                       | Operational modules must remain static, fast, and work-focused                                              |
| DEC-M1-007  | 2026-06-27 | UX      | Restore the Welcome footer as a translucent status strip                 | The Welcome screen needs visible version, secure state, and system status without adding a heavy footer bar |
