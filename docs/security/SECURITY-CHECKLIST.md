# Security Checklist

Use this checklist before releasing any security-sensitive YsabelleStore work.

## Repository Security

- [x] `npm audit --audit-level=high` reports 0 high vulnerabilities
- [x] `npm audit --audit-level=high` reports 0 critical vulnerabilities
- [x] Environment variable examples contain no real secrets
- [x] `JWT_SECRET` is not hardcoded in source files
- [x] Security docs define local-first standards

## Backend Security

- [x] Security headers middleware is registered
- [x] Central error middleware returns safe JSON responses
- [x] Unknown routes return predictable JSON errors
- [x] JSON body size has a configured limit
- [ ] Password hashing is implemented before authentication release
- [ ] Protected routes are implemented before business module release
- [ ] JWT verification is implemented before protected APIs release

## Frontend Security

- [x] API base URL comes from Vite environment validation
- [ ] Protected route handling exists before business pages release
- [ ] Token storage strategy is reviewed before authentication release
- [ ] UI validation complements backend validation before feature release

## Import Security

- [ ] File extension validation exists before import release
- [ ] File size validation exists before import release
- [ ] Required columns are documented per import type before import release
- [ ] Negative stocks and invalid dates are rejected before import release
- [ ] Preview-before-commit exists before import release

## Database and Audit Security

- [ ] User model includes safe password hash storage before auth release
- [ ] Business-changing actions create audit events before release
- [ ] Database credentials are local and environment-driven
- [ ] Backups and exports have local handling guidance before deployment
