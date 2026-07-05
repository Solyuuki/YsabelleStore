# m1 Sprint Planning

## Sprint Scope

| Sprint   | Version | Goal                                                                           | Status |
| -------- | ------- | ------------------------------------------------------------------------------ | ------ |
| Sprint 0 | v0.1    | Establish repository foundation and documentation governance                   | Done   |
| Sprint 1 | v0.2    | Prepare frontend and Electron application shell                                | Done   |
| Sprint 2 | v0.3    | Build authentication, RBAC, setup validation, and artifact evidence foundation | Active |

## Planned Tasks

| Task ID              | Sprint   | Description                                            | Status      |
| -------------------- | -------- | ------------------------------------------------------ | ----------- |
| YSB-M1-DOC-001       | Sprint 0 | Create repository standards and workflow documentation | Done        |
| YSB-M1-GOV-001       | Sprint 0 | Add PR template and branch validation workflow         | Done        |
| YSB-M1-UI-001        | Sprint 1 | Scaffold React TypeScript frontend structure           | Done        |
| YSB-M1-ELC-001       | Sprint 1 | Scaffold Electron main and preload structure           | Done        |
| YSB-M1-S2-AUTH-001   | Sprint 2 | Verify and document auth fullstack flow foundation     | Verified    |
| YSB-M1-S2-USERS-001  | Sprint 2 | Verify and document owner-controlled account creation  | Verified    |
| YSB-M1-S2-DOCKER-001 | Sprint 2 | Verify and document Docker MySQL development setup     | Done        |
| YSB-M1-S2-HEALTH-001 | Sprint 2 | Add and document project healthcheck command           | Implemented |
| YSB-M1-S2-AUTO-001   | Sprint 2 | Add implementation artifact automation                 | Implemented |

## Sprint Acceptance Criteria

| Criterion                           | Evidence                                                            |
| ----------------------------------- | ------------------------------------------------------------------- |
| Standards are complete              | Required standards files exist and are readable                     |
| Workflow is enforceable             | GitHub branch validation workflow exists                            |
| Member artifacts are ready          | m1, m2, and m3 folders include reporting files                      |
| No unrelated app code is introduced | Repository foundation remains documentation-focused                 |
| Sprint 2 evidence is synchronized   | M1 artifacts record source, setup, validation, and blocker evidence |
| Future artifact drift is guarded    | `npm run artifacts:check` runs before commit                        |
