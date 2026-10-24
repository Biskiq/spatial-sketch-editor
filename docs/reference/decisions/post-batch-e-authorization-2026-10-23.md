# Post-Batch-E parallel batch authorization — 2026-10-23

**Status: owner-authorized.** The owner explicitly instructed: “authorize and release the
recommended parallel batch” and rescinded the previous copyleft choice: “no decision made on
this for now.” This record captures that release event; the
[next parallel batch](../../roadmap/cross-track-execution.md#next-parallel-batch) owns execution
coordination and each slice plan owns scope and evidence.

## Authorized and released scopes

Release exactly these implementation scopes, after this documentation coordination PR is
merged on `main` (coordination trusted base `93ec96cadb752dd1c24bdea3b97570763d77948b`):

| Scope | Outcome | Plan |
| --- | --- | --- |
| T1.P02.S05 | Legacy Layout retirement before native drawing | [plan](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s05-legacy-layout-retirement/implementation-plan.md) |
| T2.P02.S02 | Own-model import, review, approval, rendering and placement | [plan](../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s02-import-review-approve-place/implementation-plan.md) |
| T3.P02.S02 | First Guide, explicit Camera handover/return and exhaustive creator-loop final gate | [plan](../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/implementation-plan.md) |

The Batch E start prerequisites are shipped. Each lane rechecks exact accepted gates and active
scopes at its trusted base through its runbook, uses the reviewed shared-file ownership map,
and completes its own acceptance/closeout. The lanes may run in parallel and merge in acceptance
order as separate P1 merge commits; each later merger rebases and reruns the complete merge gate
on then-current `main`. T1's S05 must be accepted and merged before its held drawing successor
starts. Bounded host/API integration patches retain their named domain-owner review.

This owner release prunes the five shipped Batch E entries from
[the release list](../../roadmap/now.md): T3.P03.S01, T3.P03.S02, T1.P02.S01, T2.P02.S01 and
T3.P02.S01. Their historical authorization remains the
[Batch E record](./batch-e-authorization-2026-10-22.md), phase registers and acceptance records.
Pruning does not reopen, repeat or revoke shipped work.

This coordination also registers **T1.P02.S05** in T1.P02 (released above) and the
planning-only **T3.P04** project-lifecycle phase with its proposed child **T3.P04.S01**. The T3.P04
registration authorizes and releases nothing.

## Limits and evidence

All omitted implementation remains held, including T1's drawing/Opening/final-gate children,
T2's final gate, and planning-only T3.P04 project lifecycle. No additional follow-on or global
shell implementation is authorized. Round 2 remains the consuming slices' shell destination.
No gate/version changes, production deployment or F2 epoch activation, milestone acceptance,
phase closure or track completion is authorized here. P03 remains closable, not closed.
T4 planning and implementation remain frozen under R1-D until the separate milestone and
subsequent owner decisions.

The earlier owner overrides apply only to their named accepted revisions. They confer no
blanket waiver on this batch: outstanding F2/F10/F13/manual/lens/reference/trace/calibration
limitations remain explicitly assigned and unclaimed until evidenced or separately disposed.
Each plan's verification tier, complete implementation-PR merge gate and independent review
requirements remain in force.

## Licensing direction

The owner rescinds the previous copyleft choice. Project licensing is **undecided**; this is
not a choice of another license and approves no geometry library or copyleft dependency.

**Dependency admission while licensing is undecided (owner ruling, 2026-10-23):** a released lane
may add a new runtime or dev dependency only under a permissive license compatible with any
future project license (for example MIT, BSD, ISC, Apache-2.0, Zlib), recording each package,
version and license in that slice's acceptance record. A copyleft (including weak copyleft such as
LGPL or MPL), source-available or unclear license stops and reports to the owner. Any licensing selection needs its own explicit owner decision. This record changes no domain contract or implementation authority.
