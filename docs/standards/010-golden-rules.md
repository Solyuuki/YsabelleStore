# AI Operating System for YsabelleStore

This file governs AI-assisted development for YsabelleStore. Any AI-generated change must follow these rules before it is accepted.

## Critical Rules Table

| Rule | Priority | Enforcement |
| --- | --- | --- |
| 100% follow project standards | Critical | Reject PR if standards are ignored |
| Never break existing functionality | Critical | Validate affected flows before completion |
| Never destabilize the codebase | Critical | Keep changes focused and reversible |
| Never rewrite unrelated modules | Critical | Reject unrelated rewrites |
| Never modify another member's assigned task without permission | Critical | Require owner approval |
| No bundle coding | Critical | One task per focused change |
| No bundle fixes | Critical | Fix only the requested or discovered blocking issue |
| Apply targeted modular changes only | High | Prefer small files and clear boundaries |
| Keep files maintainable | High | Split mixed responsibilities |
| Prefer focused modules | High | Avoid broad catch-all files |
| Avoid giant files | High | Refactor when file purpose becomes unclear |
| Fix bugs completely | High | Address root cause and validation |
| Use Rubber Duck Method for unknown bugs | High | Explain observed behavior, expectation, and evidence |
| Find root cause first | Critical | Do not patch symptoms blindly |
| Avoid assumptions | High | Inspect code and docs before editing |
| Validate implementation before completion | Critical | Run available checks and report results |
| Production-Company-Enterprise-Grade-Level quality only | Critical | Treat thesis output as evaluator-facing |
| Target 10/10 quality | High | Prefer polished, consistent, reviewable work |

## AI Work Process

| Stage | Required Behavior |
| --- | --- |
| Understand | Read the relevant standard, owner artifact, and affected files |
| Scope | Identify exact files and expected behavior |
| Implement | Make targeted modular changes |
| Validate | Run available checks or document why unavailable |
| Report | Provide summary, tests, risks, and next step |

# Development Execution Framework

This framework defines the required execution capabilities for development assistants, automation tools, and contributors working on YsabelleStore. Apply the capability that matches the task type before changing files or reporting completion.

## Execution Capabilities

| Capability | When to Apply | Required Execution Behavior |
| --- | --- | --- |
| Production-Company-Enterprise-Grade-Level Implementation | Creating full features<br>Setting up modules<br>Completing assigned tasks<br>Building project foundations<br>Updating core project workflows | Complete the task fully<br>Avoid partial implementation<br>Avoid shortcuts<br>Avoid temporary fixes<br>Maintain professional code and documentation quality<br>Validate before reporting completion<br>Respect all repository standards |
| UI Engineering Execution | Creating frontend screens<br>Building dashboard pages<br>Designing layouts<br>Creating reusable UI components<br>Improving user interface consistency | Use React, TypeScript, Tailwind CSS, and shadcn/ui<br>Use free UI references only as inspiration<br>Do not copy paid, proprietary, or restricted templates<br>Prefer clean dashboard layouts<br>Use reusable components<br>Keep spacing, typography, forms, tables, dialogs, badges, alerts, sidebars, and cards consistent<br>Prioritize accessible, simple, professional, thesis-ready UI |
| Frontend Engineering Execution | Working on React features<br>Creating frontend logic<br>Connecting UI to backend APIs<br>Managing forms, validation, state, and client-side behavior | Use strict TypeScript<br>Create modular components<br>Separate UI, hooks, services, validation, and state logic<br>Avoid duplicated logic<br>Avoid giant files<br>Validate forms using proper validation patterns<br>Keep API calls inside service modules, not raw UI components<br>Keep frontend code maintainable and predictable |
| Backend Engineering Execution | Creating Express routes<br>Creating API endpoints<br>Building business logic<br>Handling authentication<br>Processing inventory logic<br>Communicating with forecasting service | Separate routes, controllers, services, validators, and middleware<br>Do not place business logic directly inside route files<br>Validate all inputs<br>Handle errors consistently<br>Return predictable API responses<br>Avoid hardcoded credentials<br>Keep backend logic modular and testable<br>Keep business rules isolated from transport logic |
| Database and Prisma Execution | Creating Prisma models<br>Updating schema<br>Creating migrations<br>Working with MySQL<br>Creating database relations | Use safe Prisma schema changes<br>Respect existing migrations<br>Use clear model names<br>Use consistent database naming<br>Define correct relationships<br>Avoid destructive schema changes unless explicitly approved<br>Validate schema and migrations before completion<br>Keep database structure aligned with inventory, sales, batch, and forecasting data needs |
| SARIMA Forecasting Execution | Working with Python forecasting<br>Creating demand forecasting logic<br>Building forecast-driven recommendations<br>Connecting forecast output to inventory recommendations | Keep SARIMA focused on seasonal demand forecasting<br>Use historical sales data as the primary forecasting input<br>Do not use SARIMA directly to predict expiration dates<br>Compute expiry risk using current stock, expiration date, and forecasted demand<br>Keep forecasting service separate from backend business logic<br>Validate forecast outputs before using them in recommendations<br>Keep forecasting logic explainable for thesis defense |
| Electron Desktop Execution | Working on desktop app setup<br>Creating Electron main process<br>Creating preload scripts<br>Connecting renderer and backend<br>Preparing desktop packaging | Separate main process, preload, and renderer responsibilities<br>Use secure IPC patterns<br>Do not expose unsafe Node APIs to the frontend<br>Keep desktop packaging clean<br>Validate development and production behavior<br>Keep Windows `.exe` deployment in mind |
| Quality Assurance and Guardrail Execution | Completing any task<br>Preparing pull requests<br>Fixing bugs<br>Updating core modules<br>Changing workflows or standards | Run or document relevant checks<br>Verify build<br>Verify lint<br>Verify development run when applicable<br>Verify Prisma validation when applicable<br>Verify migration status when applicable<br>Do not claim success if checks were not performed<br>Clearly state when a check is not applicable |
| GitHub Pull Request Discipline Execution | Creating branches<br>Preparing commits<br>Preparing pull requests<br>Reviewing changes<br>Merging work | Follow branch format: `member/version/type/task-name`<br>Never commit directly to `main`<br>Keep pull requests small and focused<br>Document affected files<br>Respect member ownership<br>Do not include unrelated changes<br>Require review before merge<br>Prevent merge collisions through proper synchronization |
| Rubber Duck Debugging Execution | Bug is unclear<br>Error source is unknown<br>Previous fix failed<br>Multiple modules may be affected<br>The system behavior does not match expected output | Analyze before fixing<br>Scan affected files<br>Identify root cause<br>Identify blockers<br>Identify affected modules<br>Report findings before applying fixes<br>Apply targeted fixes only<br>Do not guess<br>Do not bundle unrelated fixes |
| Documentation and Reporting Execution | Completing any task<br>Updating documentation<br>Creating standards<br>Preparing implementation reports<br>Preparing sprint progress reports | Use formal tables<br>Avoid vague reports<br>Document changed files<br>Document validations<br>Document issues found<br>Document next recommended step<br>Keep reports readable and professional |
| Repository Governance Execution | Updating standards<br>Updating workflow rules<br>Updating ownership rules<br>Creating foundational project documents<br>Preparing team-level development rules | Keep standards consistent<br>Avoid duplicate rules<br>Cross-reference related standards when needed<br>Protect repository maintainability<br>Keep documentation easy for beginner developers to follow<br>Ensure rules support fast development without sacrificing quality |

## Execution Activation Matrix

| Task Type | Required Execution Capabilities |
| --- | --- |
| Full feature implementation | Production Implementation, Frontend/Backend/Database Execution as needed, QA Guardrails, PR Discipline, Documentation Reporting |
| UI screen creation | UI Engineering, Frontend Engineering, QA Guardrails, Documentation Reporting |
| Frontend feature work | Frontend Engineering, QA Guardrails, PR Discipline, Documentation Reporting |
| Backend API creation | Backend Engineering, Database and Prisma Execution, QA Guardrails, Documentation Reporting |
| Database schema update | Database and Prisma Execution, QA Guardrails, PR Discipline, Documentation Reporting |
| Forecasting module work | SARIMA Forecasting, Backend Engineering, QA Guardrails, Documentation Reporting |
| Electron desktop work | Electron Desktop, Frontend Engineering, QA Guardrails, Documentation Reporting |
| Unknown bug fixing | Rubber Duck Debugging, QA Guardrails, Documentation Reporting |
| Documentation update | Documentation Reporting, Repository Governance, QA Guardrails |
| Pull request preparation | GitHub PR Discipline, QA Guardrails, Documentation Reporting |
| Merge conflict resolution | GitHub PR Discipline, Rubber Duck Debugging, QA Guardrails, Documentation Reporting |

## Good vs Bad Execution Examples

| Scenario | Good Execution Behavior | Bad Execution Behavior |
| --- | --- | --- |
| UI task | Creates reusable shadcn/ui components with consistent layout | Creates one giant messy page |
| Frontend task | Separates components, hooks, services, and validation | Mixes API calls, UI, and state in one file |
| Backend task | Uses route-controller-service structure | Puts all business logic in one route file |
| Database task | Validates Prisma schema and migration | Changes schema destructively without checking |
| Forecasting task | Uses SARIMA for demand forecasting only | Claims SARIMA directly predicts expiration dates |
| Bug fix | Finds root cause first | Randomly changes files |
| PR task | Lists affected files and checks | Says done without validation |
| Documentation task | Uses tables, checklists, and clear rules | Creates long vague paragraphs |

## Mandatory Task Completion Report Template

| Section | Status | Details |
| --- | --- | --- |
| Task Scope | Completed/Failed | Summary |
| Execution Capabilities Applied | Completed/Failed | List of capabilities used |
| Files Changed | Completed/Failed | List of affected files |
| Validation | Passed/Failed/Not Run | Build, lint, dev, Prisma, migration checks |
| Bugs Found | None/List | Summary |
| Ownership Check | Passed/Failed | Confirm no unrelated member files were modified |
| Guardrails | Passed/Failed | Summary |
| Issues Found | None/List | Summary |
| Next Recommended Step | Pending | Recommendation |

## Mandatory Guardrail Checklist

- [ ] Task scope is fully understood
- [ ] Correct execution capabilities were applied
- [ ] Repository standards were followed
- [ ] Member ownership was respected
- [ ] No unrelated files were modified
- [ ] No bundle coding was performed
- [ ] No bundle fixes were performed
- [ ] No temporary implementation was added
- [ ] Build check was performed or marked not applicable
- [ ] Lint check was performed or marked not applicable
- [ ] Development run was performed or marked not applicable
- [ ] Prisma validation was performed or marked not applicable
- [ ] Migration check was performed or marked not applicable
- [ ] Final report was provided

## Rubber Duck Method

| Question | Required Answer |
| --- | --- |
| What is happening? | State observed failure or request clearly |
| What should happen? | State expected behavior |
| Where is the likely source? | Identify file, module, or layer |
| What evidence supports it? | Mention logs, tests, code path, or reproduction |
| What is the smallest complete fix? | Define focused correction |

## AI Completion Checklist

- [ ] Build Passed
- [ ] Lint Passed
- [ ] Ownership Respected
- [ ] Scope Respected
- [ ] No Bundle Fix
- [ ] No Unrelated Changes
- [ ] Validation Complete
- [ ] Report Generated

## Mandatory Final Report Template

| Section | Status | Details |
| --- | --- | --- |
| Summary | Completed/Failed | Brief outcome |
| Files Changed | Completed/Failed | List affected files or folders |
| Standards Followed | Completed/Failed | Naming, coding, ownership, workflow |
| Validation | Completed/Failed | Commands run and results |
| Issues Found | None/List | Risks, blockers, or failures |
| Next Recommended Step | Pending | Next task or review action |
