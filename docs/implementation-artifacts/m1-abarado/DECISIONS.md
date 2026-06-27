# m1 Decisions

## Sprint 1 Frontend Shell

| Decision ID | Date       | Area    | Decision                                                                 | Reason                                                                                           |
| ----------- | ---------- | ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| DEC-M1-001  | 2026-06-27 | Routing | Use a minimal browser history route foundation for Sprint 1 shell routes | The project does not currently include `react-router-dom`, and Sprint 1 forbids package installs |
| DEC-M1-002  | 2026-06-27 | UI      | Use local shadcn-style Button, Card, and Badge primitives                | The repo is shadcn/ui-ready but had no generated primitives yet                                  |
| DEC-M1-003  | 2026-06-27 | UX      | Keep the shell desktop-first with a 1024px minimum width                 | The target runtime is a Windows Electron desktop app, not a mobile web app                       |
| DEC-M1-004  | 2026-06-27 | Scope   | Keep all modules static and business-logic-free                          | Sprint 1 M1 scope is navigation, layout, and UI foundation only                                  |
