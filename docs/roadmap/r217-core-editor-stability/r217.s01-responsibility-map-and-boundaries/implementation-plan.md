# R217.S01 — Responsibility map and boundaries: implementation plan

**Slice:** R217.S01 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2, T3, T5 · **Runbook:** [T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

Every later R217 slice can point at one written statement of who owns editor interaction and each
package. The arch lane fails when that statement is broken. No product behaviour changes.

## 2. Why this is the smallest sensible slice

Most package boundaries are already enforced. This slice fills only the gaps found at `c13a949d`
and writes the interaction ownership that S03 and S07 change:

| Existing guard | Already enforces | Gap S01 closes |
| --- | --- | --- |
| `apps/editor/tests/lib/geometry-core/geometry-core-boundary.test.ts` | `geometry-core` imports only `earcut`, `robust-predicates` and relative modules | — |
| `apps/editor/tests/lib/layout/layout-geometry-boundary.test.ts` | The compiler graph is free of editor, Svelte, Three and browser imports; kernels are defined once | `layout-core` may still import `@portfolio/geometry-core`, `@portfolio/camera-core` or `@portfolio/project-model` |
| `apps/editor/tests/lib/museum/camera-core-boundary.test.ts` | Headless; no `@portfolio/project-model` import | No check against `@portfolio/layout-core` or `@portfolio/geometry-core` |
| `apps/editor/tests/lib/project-model-boundary.test.ts` | Independent of app, editor and rendering code | — |
| `apps/editor/tests/lib/authoring/editor-host-no-write.test.ts` | The route host and the modules it mounts call no forbidden write path | No check that an adapter keeps no private Undo/Redo stack |

**Deferred:** moving any helper, raycast consolidation (S03) and mark ownership (S07).

## 3. Dependencies

- `T5.P01.S03` is merged, and the consumed gates and required scopes are rechecked at this slice's
  trusted base.
- No shared-file claim: this slice edits docs and arch tests only.

## 4. Design

### 4.1 Architecture section

Add **Editor interaction authorities** to [`architecture.md`](../../../reference/architecture.md),
after §Ownership. It holds four parts.

1. **Current truth, verified at the trusted base, with evidence anchors:**
   - one selection state in `StageSession` (`apps/editor/src/lib/authoring/stage/stage-session.ts`);
   - one gesture lease at a time (`acquireGesture`), with per-lease reading-change policies;
   - live proposals (`registerProposal` / `liveProposal`) as the single source of the "Undo unavailable" reason;
   - F4 as the one chronological history;
   - click-select resolved by `StageFacade.resolveSourceHit`: adapter `hitProvider`s in registration order, then the retained Plan pick index in Layout priority;
   - a no-task press offered to `pressWhenNoTask` bindings in registration order.
2. **The R217 rule:** [coordination over domain policy](../README.md#shared-stage-interaction-coordination-over-domain-policy).
   It is marked *destination until R217.S03/S07 land*, per the landed-versus-destination rule.
3. **The package responsibility table:**

   | Package | Owns | Owning track |
   | --- | --- | --- |
   | `layout-core` | Topology, compilation, Plan representation | T1 |
   | `geometry-core` | Native form profile, extrusion, digest | T5 |
   | `camera-core` | Viewport, projection, Camera evaluation | T1 for viewport, T3 for route and motion |
   | `project-model` | Units, codecs, Scene planning and validation | T2 Scene, T3 units/F4 |

   **Moving rule:** a runtime-safe helper moves into a package only when it has a second runtime-safe consumer. Session arithmetic stays in the editor.
4. **Persistence classes:** a pointer to [R217 persistence](../README.md#persistence-history-and-session-state).
   It is not restated.

### 4.2 Arch-test additions (in the existing files)

Each addition goes into the file that already owns the concern. None is a new parallel suite.

- `layout-geometry-boundary.test.ts`: **layout-core imports no `@portfolio/*` package**. The test
  scans `packages/layout-core/src/**` import specifiers.
- `camera-core-boundary.test.ts`: widen the `project-model` refusal to **any `@portfolio/*`
  specifier**.
- `editor-host-no-write.test.ts`: **no adapter keeps a history stack**. Over
  `apps/editor/src/lib/authoring/adapters/**`, there is no module-level or binding-level array named
  or typed as an undo/redo stack, and no import of `f4/history` outside the host. This is a
  structural scan with a positive control, like the existing retirement predicate.

### 4.3 Gesture and pick inventory

S03's input, recorded in this slice's acceptance record. Each row gives file, symbol and trigger:

- every `acquireGesture` and `registerProposal` caller;
- every `pointerIntent`, `hoverIntent`, `hitProvider` and `pressWhenNoTask` declaration;
- every construction of a Three `Raycaster` or call to `pickScene`;
- every handler of `pointercancel`, `lostpointercapture`, `blur` and `visibilitychange`.

## 5. Tests and acceptance criteria

1. **New assertions pass.** Each one passes on the tree, and fails against a positive-control
   string in the same test: an import of `@portfolio/geometry-core` in a layout-core source
   string, `@portfolio/layout-core` in a camera-core string, and `const undoStack = []` in an
   adapter string.
2. **Arch lane.** `npm run test:arch` is green.
3. **Architecture section.** The anchors resolve (docs references test). T2, T3 and T5 approve their
   rows in review.
4. **Inventory.** It is complete against a repository grep recorded in the acceptance record: the
   grep's hit count equals the row count.

## 6. Reviews and stop conditions

- **Reviews:** T2 (Scene rows), T3 (F4, Camera rows), T5 (`geometry-core` row).
- **Stop and report if:** an existing package already violates a new rule. Record the violation as
  a finding with its owner. Do not weaken the test or move code in this slice.

## 7. Handoff

S03 consumes the inventory and turns the "current truth" rows into the coordinator. S07 adds the
mark rows.
