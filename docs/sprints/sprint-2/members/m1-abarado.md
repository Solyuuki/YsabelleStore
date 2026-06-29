# m1 - Abarado

## Role

Full-stack Authentication Lead / Integration Lead.

## Sprint Focus

Make the login page and authentication flow work end-to-end through planning, integration coordination, and frontend auth behavior.

## Assigned Scope

| Area                     | Scope                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| Login UI                 | Plan real login page integration                                  |
| Auth state               | Plan Auth Context and `useAuth`                                   |
| API integration          | Plan frontend calls to backend auth APIs                          |
| Protected routes         | Plan authenticated and role-aware route behavior                  |
| Logout                   | Plan logout behavior and session cleanup                          |
| Mock session UI          | Plan removal or replacement of fake session and hardcoded user UI |
| Integration coordination | Coordinate frontend-backend authentication flow                   |

## Assigned Tasks

| Task | Description                                 |
| ---- | ------------------------------------------- |
| 1    | Plan the real Login Page integration        |
| 2    | Plan Auth Context / `useAuth`               |
| 3    | Plan frontend calls to backend auth APIs    |
| 4    | Plan protected route behavior               |
| 5    | Plan logout behavior                        |
| 6    | Plan removal/replacement of mock session UI |
| 7    | Preserve Sprint 1 UI style where possible   |
| 8    | Coordinate frontend-backend integration     |

## Expected Output

| Output                            | Description                                         |
| --------------------------------- | --------------------------------------------------- |
| Login UI plan                     | Login form, validation, loading, and error behavior |
| Auth state plan                   | Session loading, current user, and logout state     |
| Protected routes plan             | Dashboard and owner/staff route behavior            |
| Frontend-backend integration plan | API call flow for login, logout, and session checks |

## Dependencies

| Dependency        | Reason                                             |
| ----------------- | -------------------------------------------------- |
| Backend auth API  | Frontend login and session flow needs API contract |
| Prisma user data  | Displayed user state must come from database       |
| Sprint 1 UI shell | Auth UI must preserve existing visual foundation   |

## Validation Responsibility

| Validation Area | Responsibility                                                  |
| --------------- | --------------------------------------------------------------- |
| Frontend        | Login UI, auth state, protected routes, and logout smoke review |
| Integration     | Confirm frontend calls align with backend auth responses        |
| Regression      | Confirm Sprint 1 UI shell is not unintentionally redesigned     |

## Risks / Notes

| Risk or Note                       | Mitigation                                           |
| ---------------------------------- | ---------------------------------------------------- |
| UI remains mock-auth based         | Replace hardcoded session text with backend state    |
| Protected routes only hide UI      | Coordinate with m2 so backend middleware also exists |
| Sprint 1 visual style is disrupted | Reuse existing layout and shared UI components       |

## Status

| Item           | Status                                |
| -------------- | ------------------------------------- |
| Sprint 2 role  | Planned                               |
| Implementation | Not started in this planning document |
