# R217.S01 — Responsibility map and boundaries: implementation plan

**Slice:** R217.S01 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T1 · **Reviewers:** T2, T3, T5 ·
**Runbook:** [T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Writes down who owns each part of editor interaction and each package, and makes the arch lane
enforce it. No product behaviour changes.

## Prerequisite

`T5.P01.S03` is accepted and merged, and every consumed gate and required scope is rechecked at this
slice's trusted base.

## Scope

1. **Editor interaction authorities** section in
   [`architecture.md`](../../../reference/architecture.md):
   - the [coordination over domain policy](../README.md#shared-stage-interaction-coordination-over-domain-policy) table;
   - F4 as the one history;
   - Camera as the one projection;
   - the [persistence classes](../README.md#persistence-history-and-session-state).

   It describes current truth and marks the destination rows as R217 destination until their
   slices land.
2. **Package responsibility table** in the same section:

   | Package | Owns |
   | --- | --- |
   | `layout-core` | Architectural topology, compilation, Plan representation |
   | `geometry-core` | Native form profile, extrusion, digest |
   | `camera-core` | Viewport, projection, Camera evaluation |
   | `project-model` | Units, codecs, Scene planning and validation |
   | editor `authoring/*` | Session, adapters, Stage host |

   Each row names its owning track. **Moving rule:** a helper moves into a package only when a second runtime-safe consumer exists; session arithmetic stays in the editor.
3. **Arch tests** in the arch lane:
   - **Package dependency direction.** `layout-core` and `geometry-core` never import each other; `camera-core` imports no `@portfolio` package; no package imports `apps/`.
   - **History.** No adapter keeps an Undo or Redo stack, and no adapter installs source outside F4 acceptance. This extends the existing no-write call-site proof rather than duplicating it.
   - **Picking.** Only the Stage host and listed domain pick providers construct a Three `Raycaster`. The current users form an explicit allow-list that S03 empties.
4. **Gesture and interruption inventory** in this slice's acceptance record: every place that
   starts, cancels or refuses a gesture, or blocks Undo, today. It is S03's input.

## Not in scope

Moving code, a new package, or changes to adapters' behaviour.

## Acceptance criteria

1. The arch lane is green, with the raycast allow-list explicit and every entry named to S03.
2. Each new test fails on a seeded violation: a cross import, an adapter undo stack, an unlisted
   raycaster.
3. T2, T3 and T5 review the architecture section for their rows.
4. The gesture inventory names file, symbol and trigger for each entry.

## Verification

`npm run test:arch`, the docs tests, `npm run check`, then the complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
