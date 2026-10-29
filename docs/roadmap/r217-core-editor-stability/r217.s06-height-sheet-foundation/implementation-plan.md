# R217.S06 — Height Sheet foundation: implementation plan

**Slice:** R217.S06 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T1 · **Reviewers:** T2 (Scene
found-surface query) · **Runbook:** [T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Builds the Height Sheet as a functional foundation. Its one v1 consumer is the Plan cut, and it
leaves a consumer seam for a later Slice
([phase seam](../README.md#height-sheet-foundation-and-the-slice-seam)).

## Prerequisite

R217.S05 is accepted, because the Sheet sits with the drafting furniture.

## Scope

1. **Sheet height fact.** The host holds one session height, in metres above the floor datum, and
   publishes it to consumers registered by role. It is view state: never source, history, Save or
   dirty.
2. **v1 consumer: the Plan cut.** The Sheet height becomes `cutHeightMeters` in `planParameters`.
   Its default is the current 1.2 m calibration, so a fresh session draws as today. Moving the Sheet
   re-evaluates Plan, and Walls and objects move between the cut and projected streams.
3. **Control.**
   - A thin vertical slider docked on the right, able to swap sides, in the World lens only. It is hidden in Experience.
   - **Ticks:** the floor datum is long and authored. Found surfaces are short, from owner queries: Layout plinth tops and Scene floor-standing tops, read-only. Pins are round and session-only, placed from the knob.
   - Labels show on hover or drag; the snap name shows while dragging; the Sheet snaps to ticks.
   - A one-time hint appears after the first raised surface exists.
4. **3D expression.** The Sheet plane is drawn as a quiet neutral tint. It is never yellow (that is
   Slice inspection), never gold (that is selection), and has no cut-away, pill or Put back.
5. **Access.**
   - A `slider` role. The arrow keys step by the snap increment; Page Up and Page Down jump between ticks; Home returns to the datum.
   - A 44 × 44 px knob on a coarse pointer. The touch path for labels is "shown while dragging".
6. **Extension seam, documented in code and in the phase README.**
   - The consumer interface (role, subscribe, current height) and the tick-source interface (owner, kind, heights) are the only ways in.
   - The S11 review checks that a test consumer can register without editing the Sheet.

## Not in scope (the Slice boundary)

Slice and its yellow inspection; 3D cut-away; Section and Face; Ink or placement at height; Level
ticks or creation; persisted pins; the Experience-lens working height. Each later arrives as a
consumer or tick source with its own domain admission.

## Acceptance criteria

1. **Cut height:** dragging the Sheet changes the Plan cut, and a seeded Wall shorter than the cut moves from cut to projected and back.
2. **No source effect:** the Sheet, its pins and its height create no history entry, no dirty state and nothing in Save. Pins are gone after reload.
3. **Ticks:** they come only from owner queries and session pins, and a test fails if the Sheet computes a found surface itself.
4. **Seam:** a test-only consumer registers and receives height changes with no Sheet edit.
5. **Access:** keyboard-only and coarse-pointer use pass, and the Sheet is absent in Experience.

## Verification

Affected Stage and Plan representation contracts; then the complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
