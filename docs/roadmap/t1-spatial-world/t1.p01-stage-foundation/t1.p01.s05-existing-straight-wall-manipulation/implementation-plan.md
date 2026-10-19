# T1.P01.S05 — Existing straight-Wall manipulation: implementation plan

**Slice:** T1.P01.S05 · **Status:** approved — owner-authorized 2026-10-19 as batch C · **Phase:** [T1.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) ·
**Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/implementation-plan.md
```

## Prerequisite

S04 complete and listed gates accepted. Both hold on `main` `5fee2a2d`: S04 is accepted at
`2d37adef` (PR #148), and every `Requires` scope is active. The owner authorized it on
2026-10-19 as batch C with `T2.P01.S04`
([record](../../../../reference/decisions/batch-c-authorization-2026-10-19.md)).

## Produces

Bounded direct editing in the shared Stage; this is the cycle terminal, not the phase final gate.

## Scope

Expose existing straight-Wall length/angle with explicit fixed endpoint, and rigid translation
through `planExactWallLength`, `planExactWallAngle`, `planRigidWallMove`. Shared Junctions
remain shared: preview affected neighbours/reach, and refuse candidates the canonical planner
cannot preserve. Do not author Room geometry or join coincident independent structures.
Restrict controls to supported, legible axes; numeric Dimensions remains available when an
axis cannot be picked precisely in 3D. Curved-Wall shape/translation handles are deferred;
their scalar edits from S04 remain available.

Pointer capture owns the gesture. Preview from its immutable baseline; evaluate inverse and
snap against the rendered projection and compiled query records. Snap is an explicit
transient suggestion, never a coordinate-to-connectivity shortcut. Release commits once via
the same planner/intent as typed input; Esc/lost capture/replacement cancels with none. A
reading flip continues a gesture only while its parameter mapping remains valid; otherwise
pause that writer with an explanation, preserve the proposal, and offer explicit resume or
cancel. It must not silently commit, reinterpret a delta, or discard work on a flip.

**First increment (batch C ruling C5): TD-8.** The Stage host's task-scoped services
capture a writer generation and refuse `Begin` after an accepted install while the panel stays
mounted ([TD-8](../../../../operations/tech-debt/README.md#td-8--a-tasks-scoped-services-go-stale-after-an-accepted-install-refusing-begin)).
S05's Wall handles are new task instruments that would inherit the defect, and T1 owns the host. Fix
it host-side (TD-8 option 1) with the tests the entry owes. T1 may land this as a standalone
tech-debt PR ahead of the slice if `T2.P01.S04` needs it first. The instrument never re-acquires
services from host internals.

## Acceptance criteria

Pointer and numeric paths yield the same document for the same explicit
intent; one gesture has one history result; shared-neighbour invalidity rejects atomically;
Wall/Opening/Room identities and curve data are preserved by supported operations. Plan and
3D handles/highlights resolve the same source; inactive helpers do not pick. Navigation,
reading changes, grid/snap and Esc generate no document-history entries. M1/M2/M5 get real
composed-path exposure; M4 Wall-birth/noding identity remains dormant, honestly unexposed.

## Readiness declaration

This slice is **owner-authorized** (2026-10-19, batch C). Its `Consumes` gates must be `accepted`
at its own trusted base, and S04 must be complete; both hold on `main` `5fee2a2d`, and the runbook
start step re-checks them. It is current-source work: under the current-source freeze (K6, ruling
C2), `T3.P01.S04` migrates its callers after it merges. T1.P01.S05 is the phase's configured architecture-cycle window
**terminal** exposure ([window](../README.md#bounded-architecture-cycle-window)), and closing
that window is a separate owner event, not a consequence of this plan. No implementation,
acceptance, readiness, evidence, commit or gate state is claimed by this document.
