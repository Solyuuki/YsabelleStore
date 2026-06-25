# API Checklist

## Purpose

This checklist helps confirm that API contract work is complete before implementation begins.

## Scope

- Route documentation
- DTO documentation
- Validation documentation
- Response and error alignment
- Versioning and status code review

## Checklist

- [ ] Route documented
- [ ] DTO documented
- [ ] Validation documented
- [ ] Response follows standard
- [ ] Error follows standard
- [ ] Status code correct
- [ ] Version correct
- [ ] Documentation updated
- [ ] Tests planned

## Validation Matrix

| Check                 | Pass Means                       | Fail Means                         |
| --------------------- | -------------------------------- | ---------------------------------- |
| Route documented      | Route path and purpose are clear | Route contract needs work          |
| DTO documented        | Transport shape is clear         | Input/output ownership is unclear  |
| Validation documented | Required checks are listed       | Invalid data handling is unclear   |
| Response standard     | Success payload is stable        | Client contract may break          |
| Error standard        | Failure payload is stable        | Error handling may be inconsistent |
| Status code           | Correct HTTP code is chosen      | Response semantics are unclear     |
| Version               | Route version is explicit        | Client compatibility risk exists   |
| Documentation updated | Docs match current contract      | Contract drift may occur           |
| Tests planned         | Verification work is identified  | Contract behavior may go untested  |

## Future Implementation Notes

- Treat checklist completion as a prerequisite to endpoint work.
- Keep checklist updates synchronized with contract changes.
- Use this checklist during PR review for new API work.

## Validation Checklist

- [x] Route readiness checks are documented
- [x] Validation matrix is included
- [x] Tests are planned, not implemented
- [x] No API code is added
