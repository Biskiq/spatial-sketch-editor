# T1.P01.S04 — Existing Layout precision: implementation plan

**Slice:** T1.P01.S04 · **Status:** approved — owner-authorized 2026-10-17 as batch B ([record](../../../../reference/decisions/batch-b-authorization-2026-10-17.md)); implementation in progress, unaccepted · **Phase:** [T1.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, F4.intent-acceptance@1:conditional-save-current-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/implementation-plan.md
```

The integration route is the phase's exhaustive final gate; a narrowed tier never stands in for it.

## Prerequisite

S02/S03 providers accepted at trusted base. Under owner
rulings D1/D2 of 2026-10-17 ([record](../../../../reference/decisions/next-batch-authorization-2026-10-17.md)),
that means `T1.P01.S07` shipped and `viewport-projection-v1` accepted through it, both at this slice's
trusted base. Both hold on `main` since PR #137 (`viewport-projection-v1` accepted at `ab8504aa`),
verified at authorization ([batch B record](../../../../reference/decisions/batch-b-authorization-2026-10-17.md)); the runbook start step re-checks them
at this slice's own trusted base. **Produces:** useful scalar authoring/source download
and deferred shell discovery depth; re-arms M1 and M2. No schema change.

**Host↔F4 wiring is consumed, not built here (ruling D2, 2026-10-17, [record](../../../../reference/decisions/next-batch-authorization-2026-10-17.md)).**
`T1.P01.S07` owns the accepted install, host Undo/Redo commands, replacement baseline, selection
requalification, Camera-output rebase, adapter re-binding and the AM-5 adapter contribution points.
This slice registers its Dimensions instrument, Card name writer, capability-Find entries and
Place → Layout plinth item through those contribution points, as a Layout adapter, and edits no host
core, route or shell module. A needed change there is a stop-and-report to the S07 owner.

**Head Save integration is in scope (ruling D3, 2026-10-17; assignment origin: decision 1 of the
[2026-10-16 S02 pair record](../../../../reference/decisions/s02-pair-authorization-2026-10-16.md)).**
This slice mounts `T3.P01.S02`'s framework-free client Save state and commands in the PLATE Head. That
includes unsaved-work signalling at project exit and replacement, resuming a pending sign-in draft, and
routing *Reload remote* through the host's replacement guard. T3 owns the protocol, the server and the
state machine; this slice builds none of them. `F4.intent-acceptance@1:conditional-save-current-v1`
(accepted since PR #133) joined this plan's `Requires` and the register row at this slice's
authorization (batch B ruling B1), since a scope is fixed then and never mid-slice. This slice is the Head's sole writer
while it runs, and it must be accepted before `T2.P01.S04` starts.

## Scope

Card name, where the current kind supports one, is its sole writable fact, delegated through
canonical metadata planning; unnamed kinds retain read-only identity. Settled
measure facts open one Dimensions instrument. Expose Wall height/thickness and existing
Opening offset/width/height/sill using retained precision/Opening planners; show measured values
and floor/host datum. Do not expose independent arch rise, Wall roles, profile conversion or
Floor storey height. Preserve current curves and Opening host identity. Other measures remain
read-only with a clear unavailable operation. Capability Find contains supported operations,
not subjects; keep fixed semantic order and rail family homes, with unavailable families
explicit rather than inert controls pretending to work.

Admit one **Place → Layout plinth** item using the retained `layoutArchitecturalPreset`,
`layoutPresetPlacement` and `planCommitLayoutObjectPreset` semantics. It creates an ordinary
Layout box, not a Scene entity or a new preset schema. Working-plane X/Z plus the explicitly
selected current floor datum resolve the world-local center Y (floor + half height); no Room
containment or inferred support. Offer the same typed X/Z placement through its Instrument,
then dimensions through the existing Layout-object transform planner. A height edit declares
whether it keeps the bottom on the selected datum; retaining bottom is one explicit dimensions
plus position plan, never a persistent support constraint or two history steps. Capture the object ID
before evaluation under F.4; if the retained planner cannot consume that captured ID, add a
bounded explicit-ID input rather than accepting hidden allocation. No Scene Place item is
implemented until T2 supplies its adapter. Columns/platforms, arbitrary asset placement,
attachments and multi-support placement are deferred.

## Acceptance criteria

Valid scalar edits compile and update Plan/3D coherently once with one undo;
invalid dimensions, host overrun/overlap and a Wall shortened below an Opening reject locally
with the original typed proposal/reason, accepted geometry and selection intact. Blank,
non-finite and invalid step-base input never become zero or false `:invalid` states (TD-2).
Precision preserves full typed values rather than saving rounded display values. Enter accepts,
Esc cancels and blur does not commit. Document Undo is unavailable during a live proposal with
a reason. Call-site proof fails if a UI writer bypasses the Layout planner or shared acceptance.
Cloud Save is enabled only under the Head Save integration above; downloaded JSON round-trips through the current strict codec and
contains no generated geometry, selection, tool, history or renderer state.
Empty boot → plinth placement → dimension edit → Undo/Redo → source reopen must work in both
readings with the same captured identity and floor-resolved Y. Invalid/stale placement creates
no object/history; replacement clears its ghost. This is the phase's smallest greenfield edit.

## Readiness declaration

This slice is **approved** (owner-authorized 2026-10-17 as batch B, [record](../../../../reference/decisions/batch-b-authorization-2026-10-17.md)); implementation
started 2026-10-17 through the T1 runbook start step on the merged batch base. No acceptance,
readiness, revision or evidence is claimed here. The two composition-root obligations this slice's
first implementation pass reported — no Card name-writer point, and no route mount for the
T3.P01.S02 Save state — are resolved under the owner's [narrow host-integration
exception](../../../../reference/decisions/t1-s04-host-integration-2026-10-17.md): the Card delegates
its one name writer to canonical Layout planning, the route builds the epoch's Save state and passes
it to the Head, and a live Layout proposal holds the host gesture lease so Undo reports
`live-proposal`. It consumes
`F1.reference@1`, `F4.intent-acceptance@1` and `T1.viewport-projection@1` and requires the
accepted capabilities `F1.reference@1:references-v1` and
`F4.intent-acceptance@1:local-single-domain-v1`, `F4.intent-acceptance@1:conditional-save-current-v1` and
`T1.viewport-projection@1:viewport-projection-v1`; the S02 viewport provider and the S03
local-acceptance provider must be accepted at this slice's trusted base before it is eligible.
It is one of the phase's three listed cycle-window exposures. The window has been open since
`T1.P01.S02` opened it on 2026-10-16, so this slice's start records no new opening (batch B ruling
B4); its exposure row and mechanism verdicts are recorded at its closeout. Nothing here marks any gate `implemented` or `accepted`.
