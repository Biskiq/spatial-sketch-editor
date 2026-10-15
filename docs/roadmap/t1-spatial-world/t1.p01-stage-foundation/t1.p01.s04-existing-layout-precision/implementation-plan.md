# T1.P01.S04 — Existing Layout precision: implementation plan

**Slice:** T1.P01.S04 · **Status:** proposed — not authorized · **Phase:** [T1.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/implementation-plan.md
```

The integration route is the phase's exhaustive final gate; a narrowed tier never stands in for it.

## Prerequisite

S02/S03 providers accepted at trusted base. **Produces:** useful scalar authoring/source download
and deferred shell discovery depth; re-arms M1 and M2. No schema change.

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
Cloud Save is enabled only with the separately accepted conditional-save capability; downloaded JSON round-trips through the current strict codec and
contains no generated geometry, selection, tool, history or renderer state.
Empty boot → plinth placement → dimension edit → Undo/Redo → source reopen must work in both
readings with the same captured identity and floor-resolved Y. Invalid/stale placement creates
no object/history; replacement clears its ghost. This is the phase's smallest greenfield edit.

## Readiness declaration

This slice is **proposed and not authorized**: it holds no implementation permission, and no
implementation, acceptance, readiness, revision or evidence is claimed here. It consumes
`F1.reference@1`, `F4.intent-acceptance@1` and `T1.viewport-projection@1` and requires the
accepted capabilities `F1.reference@1:references-v1` and
`F4.intent-acceptance@1:local-single-domain-v1`; the S02 viewport provider and the S03
local-acceptance provider must be accepted at this slice's trusted base before it is eligible.
It is one of the phase's three listed cycle-window exposures, so an authorized start opens the
architecture-cycle window. Nothing here marks any gate `implemented` or `accepted`.
