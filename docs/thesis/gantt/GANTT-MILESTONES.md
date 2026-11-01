# Gantt milestone view (source-backed draft)

This is an **initial evidence timeline**, not a finished duration-based thesis Gantt. Every diamond is a dated commit checkpoint on the corresponding sprint branch. A diamond **does not claim sprint completion**. See [Implementation Evidence Register](IMPLEMENTATION-EVIDENCE.md) for implementation-specific commits nested within each sprint.

```mermaid
gantt
    title YsabelleStore — Observed Sprint Branch Checkpoints (2026)
    dateFormat YYYY-MM-DD
    axisFormat %b %d
    section Sprint 01
    Branch checkpoint S01 :milestone, b1, 2026-06-29, 0d
    section Sprint 02
    Branch checkpoint S02 :milestone, b2, 2026-07-05, 0d
    section Sprint 03
    Branch checkpoint S03 :milestone, b3, 2026-07-16, 0d
    section Sprint 04
    Branch checkpoint S04 :milestone, b4, 2026-08-18, 0d
    section Sprint 05
    Branch checkpoint S05 :milestone, b5, 2026-08-24, 0d
    section Sprint 06
    Branch checkpoint S06 :milestone, b6, 2026-08-24, 0d
    section Sprint 07
    Branch checkpoint S07 :milestone, b7, 2026-08-24, 0d
    section Sprint 08
    Branch checkpoint S08 :milestone, b8, 2026-08-25, 0d
    section Sprint 09
    Branch checkpoint S09 :milestone, b9, 2026-08-26, 0d
    section Sprint 10
    Branch checkpoint S10 :milestone, b10, 2026-09-17, 0d
    section Sprint 11
    Branch checkpoint S11 :milestone, b11, 2026-10-11, 0d
    section Sprint 12
    Branch checkpoint S12 :milestone, b12, 2026-10-15, 0d
    section Sprint 13
    Branch checkpoint S13 :milestone, b13, 2026-10-31, 0d
``

## Checkpoint evidence links

| Sprint | Dated branch checkpoint (UTC) | Evidence commit | Interpretation |
| --- | --- | --- | --- |
| 1 | 2026-06-29 | [`1a67bfc57f`](https://github.com/Solyuuki/YsabelleStore/commit/1a67bfc57f226ce2713f5c809081fd4062f7ebb5) | Branch checkpoint, not confirmed sprint end |
| 2 | 2026-07-05 | [`f911ab5baa`](https://github.com/Solyuuki/YsabelleStore/commit/f911ab5baa24a381b53ad7ef153d7626980b38bd) | Branch checkpoint, not confirmed sprint end |
| 3 | 2026-07-16 | [`2bba2089d0`](https://github.com/Solyuuki/YsabelleStore/commit/2bba2089d09d213e94501e0bd8ef0b05c57aef3a) | Branch checkpoint, not confirmed sprint end |
| 4 | 2026-08-18 | [`22b578ab7c`](https://github.com/Solyuuki/YsabelleStore/commit/22b578ab7c87a227ce153b34aa9fac96648ec797) | Branch checkpoint, not confirmed sprint end |
| 5 | 2026-08-24 | [`72d35fb32a`](https://github.com/Solyuuki/YsabelleStore/commit/72d35fb32a08c652ed4f3e059f497463c5d3d48f) | Branch checkpoint, not confirmed sprint end |
| 6 | 2026-08-24 | [`32477d66dc`](https://github.com/Solyuuki/YsabelleStore/commit/32477d66dc7066ddfe41fe2a70695ce0b15d9d62) | Branch checkpoint, not confirmed sprint end |
| 7 | 2026-08-24 | [`aab18da8d1`](https://github.com/Solyuuki/YsabelleStore/commit/aab18da8d1fb9b408222dab3ee1a3c2624643dfb) | Branch checkpoint, not confirmed sprint end |
| 8 | 2026-08-25 | [`af344a000c`](https://github.com/Solyuuki/YsabelleStore/commit/af344a000c4e82ed0b8826fbfd4c95ef2c16c4bc) | Branch checkpoint, not confirmed sprint end |
| 9 | 2026-08-26 | [`eb3aa57fef`](https://github.com/Solyuuki/YsabelleStore/commit/eb3aa57fef60bb45572fc28a6ceaf5dda96d10c0) | Branch checkpoint, not confirmed sprint end |
| 10 | 2026-09-17 | [`d80d864fe8`](https://github.com/Solyuuki/YsabelleStore/commit/d80d864fe810afe7d79b7f34b610174085efe859) | Branch checkpoint, not confirmed sprint end |
| 11 | 2026-10-11 | [`1885ff51ea`](https://github.com/Solyuuki/YsabelleStore/commit/1885ff51eac0bb86281d94949002e3bc40d1800a) | Branch checkpoint, not confirmed sprint end |
| 12 | 2026-10-15 | [`30614b4483`](https://github.com/Solyuuki/YsabelleStore/commit/30614b44831a022da30acf245374159968dd6144) | Branch checkpoint, not confirmed sprint end |
| 13 | 2026-10-31 | [`53b29e23f8`](https://github.com/Solyuuki/YsabelleStore/commit/53b29e23f80864f539a43f91c02e42b80659ca21) | Branch checkpoint, not confirmed sprint end |

## Before converting to duration bars

Task-level start and end dates must be justified from task-specific progress records, commits and reviews. For unverified ranges, label the bars **inferred activity window** rather than planned duration, and do not show them as definitively completed. GitHub commit dates are points in time, not reliable effort or work-hour measures.
