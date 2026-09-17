# Third-Party License Evidence

This directory stores **verified license evidence for material third-party components** used by YsabelleStore. It is intentionally separate from any root project license because YsabelleStore's own source code is not automatically relicensed under the licenses of its dependencies.

## Policy

| Rule                 | Requirement                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Authoritative source | Verify licenses from the dependency's official repository/release, package metadata, or other authoritative upstream source. |
| Exact version        | Prefer evidence tied to the exact resolved version used in the lockfile/distributable.                                       |
| Preserve notices     | Retain copyright and permission notices when the applicable license requires it.                                             |
| No invented metadata | Do not guess a license/version when the committed source does not establish it.                                              |
| Release review       | Re-run license/SBOM review against the exact release artifact before public/commercial distribution.                         |
| Project ownership    | A third-party license notice does not change the ownership/license status of YsabelleStore-authored code.                    |

## Verified Evidence Currently Stored

| Component    | Version | License | Evidence File                                        |
| ------------ | ------: | ------- | ---------------------------------------------------- |
| Tailwind CSS |  3.4.19 | MIT     | [`TAILWIND-CSS-LICENSE.md`](TAILWIND-CSS-LICENSE.md) |

## Related Registers

- [`../../THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)
- [`../../SYSTEM_TECHNOLOGY_REGISTER.md`](../../SYSTEM_TECHNOLOGY_REGISTER.md)
- [`../compliance/SOFTWARE-COMPONENT-INVENTORY.md`](../compliance/SOFTWARE-COMPONENT-INVENTORY.md)
- [`../compliance/OPEN-SOURCE-ATTRIBUTION.md`](../compliance/OPEN-SOURCE-ATTRIBUTION.md)

Additional material license texts should be added only after exact-version verification.
