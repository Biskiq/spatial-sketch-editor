# T1.P02.S02 — Draw, close, divide and delete: implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records scope and recovery.
STATUS:    ACCEPTED (`owner-override`, 2026-10-27) and SHIPPED on PR #201; P1 merge `ce159a1e`.
SOURCE:    PR #201 product and harness revision 64b9435d; documentation head 36c18db9.
CONSUMES:  F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES:  F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1,
           F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1,
           T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
NOT:       a new capability outcome, final-gate result, phase closure, track completion or
           architecture verdict.
```

## Delivered

The slice lands native straight-Wall drawing through the existing planner/acceptance authority:
deliberate Junction or Wall-interior connection, enclosure closure, Room division and Wall deletion,
with Plan/3D agreement, chain Undo/Redo and Save/reload identity preservation. One bounded
`layout-core` policy refuses an unconnected crossing, an unconnected interior contact and a nested
ring without a shared Junction, in words and with zero partial source.

The bounded shell cutover lands with it: the bottom dock over declarations, one lower column, the Card
as the sole ordinary Layout writer and home of scoped actions, Head Find, palette-first Escape, and
the Ink hit test that makes Junction-over-Wall-interior-over-free-point targeting exact. The retired
Dimensions task is replaced by Card fields and the selected subject's own actions.

M4 (Junction commit-time identity) is re-armed by the rewired Junction commits; the closeout records
the status in the architecture-cycle mechanism register.

## Acceptance contract

| Concern | Accepted proof |
| --- | --- |
| Creator path | Empty and starter draw/close/divide/delete; Plan/3D agree; keyboard and Card precision; Save/reload identities |
| Policy refusal | Crossing without Junction, collinear overlap, disconnected nested ring and invalid numeric input refuse with repair text and no partial source |
| Identity and scope | Delete/recreate, Undo then different edit, Redo and reload/edit do not reuse IDs; registered planners receive capture/level and stay inside F4 Layout scope |
| Session and input | Junction requalification; pointer/typed coordinates agree; finish/backtrack/cancel, palette-first Esc, tool switch and execution lifecycle leave no hidden proposal |
| Deletion | Hosted Openings retire in the same undo step; Room reconciliation holds; Camera/Experience retain deleted IDs with diagnostics and no retarget |
| Shell | Select/Ink and contributions work with nothing selected; no duplicate Dimensions path; lower column and Card do not overlap or move Camera |
| Boundaries | Single compiler, one selection/session, visitor isolation, no editor helper in visitor chunks |

The browser journey and automated gate are recorded in the
[acceptance record](./acceptance.md). The owner-run formal performance family was deferred on
2026-10-27 and is assigned to S04; the Stage route's 456.0 KiB br against the ≤400 KiB hard budget is
recorded there as an explicit known miss. No performance row is a pass.

## Boundaries

In scope: straight Walls, deliberate topological connection, enclosure/division/deletion, the
bounded dock/Card cutover and the measurement harness migration. Excluded: the Opening creation
family (S03), curves/circles, levels, structures, datums, overheads, attachments, face-frame
providers and new compound cross-domain operations. Authorization and any performance-semantics
ruling remain owner-only.

## Recovery

```text
git show 36c18db9:docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/implementation-plan.md
anchor  36c18db9
tag     closed/T1.P02.S02 → 36c18db9 (pushed)
merge   ce159a1e (verified ancestor; P1 merge commit)
```

P1 recovery requires a merge commit; `ce159a1e` preserves the anchor.
