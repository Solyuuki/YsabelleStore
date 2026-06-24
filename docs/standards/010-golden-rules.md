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

