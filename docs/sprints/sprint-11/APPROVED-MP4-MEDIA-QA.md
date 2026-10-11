# Sprint 11 â€” Approved MP4 Media Release QA

## Approval and distribution

- The Storefront entrance, About light hero, About dark hero, and About delivery originals were verified against their earlier approved checksums.
- The About catalog and About sales/inventory visuals were explicitly confirmed as the final approved videos during the Sprint 11 release review.
- All six release binaries were sourced from the reviewed `YsabelleStore-Sprint11-MP4-20261011-235315.zip` package and byte-verified before import.
- Approval is a content decision; SHA-256 is the ongoing immutable file-integrity baseline.

## Immutable media inventory

| Section                   | Runtime path                                                   | Size (bytes) | Approved SHA-256                                                   |
| ------------------------- | -------------------------------------------------------------- | -----------: | ------------------------------------------------------------------ |
| Storefront entrance       | `frontend/public/media/store-entrance.mp4`                     |      5417920 | `53360d489f4303761658cc62cc5984f4ea43116b470ae7e63d263c48497e4df3` |
| About light hero          | `frontend/public/media/about-origin-motion-6738635d.mp4`       |      2554527 | `6738635db4cf22b744aba5ced30bc4a9533245e0f02352df406381d21487dad9` |
| About dark hero           | `frontend/public/media/about-dark-galaxy-loop.mp4`             |      1874307 | `98a57e742f134f27e6c6d11c3cb5c2b7b29c8a3d504bba1d9cb910539438fe17` |
| About catalog             | `frontend/public/media/gemini_generated_video_a80f6413.mp4`    |      2222820 | `209a7f908eeb1ac746f32c96479b7b4ac87a7f47bf52d430bc090ba9be9ec529` |
| About sales and inventory | `frontend/public/media/gemini_generated_video_2e78399f.mp4`    |      1312552 | `8e3d44f9436288961a729ff57a39ebf2edcf9073558931837f2f59f16359accc` |
| About delivery            | `frontend/public/media/about-delivery-operations-83b7547e.mp4` |      3374456 | `83b7547e99884795c14c5590400e09205c084eeca201c9c227da56b012745c6c` |

## Release acceptance

- Verify each runtime file exists with the exact SHA-256 above on clean checkout/build.
- Confirm all six videos load in Storefront / About (light and dark) with no missing media requests.
- Verify fallback and reduced-motion states separately; a fallback is not evidence that an MP4 is present.
- Do not promote to main until the new Sprint 11 head is green and staging points to that new head.
- Do not modify existing MySQL data, migration state, OAuth secrets, or local `.env` as part of media publishing.
