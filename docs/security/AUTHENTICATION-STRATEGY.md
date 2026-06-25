# Authentication Strategy

This document defines the future authentication direction for YsabelleStore. It does not implement login, registration, JWT issuing, password hashing, role enforcement, or user persistence.

## Future Auth Model

| Decision          | Standard                                                      |
| ----------------- | ------------------------------------------------------------- |
| Login type        | Local username or email plus password                         |
| Password storage  | Hash passwords before authentication release                  |
| Token type        | JWT access token for local API requests                       |
| Roles             | `admin` and `user`                                            |
| Session behavior  | Short enough to reduce risk, convenient enough for store work |
| Cloud auth        | Not used                                                      |
| Third-party login | Not used                                                      |

## Planned Flow

```text
Staff opens desktop app
  -> enters local credentials
  -> backend validates password hash
  -> backend issues short local JWT
  -> frontend stores token using approved desktop storage
  -> protected API routes validate token
```

## Role Plan

| Role  | Future Responsibility  | Example Access Direction                                  |
| ----- | ---------------------- | --------------------------------------------------------- |
| Admin | Store owner or manager | User management, inventory adjustments, imports, reports  |
| User  | Store staff            | Daily sales and inventory viewing based on approved rules |

## Convenience Rules

| Rule                                                | Reason                                                   |
| --------------------------------------------------- | -------------------------------------------------------- |
| Avoid frequent forced re-login during normal shifts | Store staff need fast workflows                          |
| Require re-login for sensitive future actions       | Protects account and inventory changes                   |
| Keep account recovery local and simple              | Offline-first systems cannot depend on cloud reset flows |

## Not Implemented In This Phase

- Login endpoint
- Register endpoint
- JWT signing
- JWT verification middleware
- Password hashing code
- Role enforcement
- User database model
- Protected frontend routes
