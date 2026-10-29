# R217.S09 — Native form marks: implementation plan

**Slice:** R217.S09 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T5 ·
**Reviewers:** T2 (Scene adapter files), T1 (mark layer) · **Runbook:**
[T5 operations](../../../operations/t5-expressive-geometry/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

A selected native form shows the same marks as other objects:

- a move track and a turn ring;
- a scale point that reveals **three** size rays (Width, Height, Depth), because forms size per axis.

Its Card fields and its marks write the same facts.

## 2. Why this is the smallest sensible slice

- **Existing measurement and planner:** per-axis sizing already exists as T5 session arithmetic with
  its own planner (`apps/editor/src/lib/authoring/adapters/scene/shape/form-size.ts` → `set-form-size`;
  `apps/editor/src/lib/authoring/adapters/scene/shape/ray.ts` for closest-approach measurement).
- **Existing Card fields:** `FormCardFields.svelte`.
- **What changes:** only how the three size "knobs" are drawn and pressed. They become S07
  descriptors, and the measurement stays T5's.

**Deferred:** Object Focus, outline editing, sections, shaping and anchors (T5.P02).

## 3. Dependencies

- R217.S08 merged; it is the shared `scene.adapter.ts` writer.
- **Claims:** `scene.adapter.ts` (form branch), `form-size.ts` and `FormCardFields.svelte`.

## 4. Design

### 4.1 Descriptors for a selected form

| Descriptor | Kind | Fact | Planner | Reveal |
| --- | --- | --- | --- | --- |
| Move | track, as S08 | position | `place-on-floor` | always |
| Turn | ring, as S08 | yaw | `set-yaw` | always |
| Scale point | point | — | — | always |
| Width / Height / Depth | ray along the form's local X / Y / Z from its centre | scale[axis] | `set-form-size` | on-scale-point |

- **Measurement.** The descriptor's drag still calls `axisTravelFromRay` and the existing
  `FormSizeMeasurement`. The host draws; T5 measures.
- **Labels and refusals.** Tags read `Width {value} m`, `Height {value} m · base stays` and
  `Depth {value} m`. Refusals keep the form policy's words: extent 1 mm–100 m, scale [0.01, 100].
- **Overlap.** Rays that overlap at a small projected size follow S07's density rule. Same-class
  overlap resolves by T5's descriptor order: Height, then Width, then Depth.

### 4.2 Removal

- The no-task `pointerIntent` knob recognition and the `scene-form-size-*` overlay markers are
  removed. The refusal and preview text moves to the mark tag.
- The form `scene-form-delete` overlay is removed. Delete stays a Card action.

## 5. Tests and acceptance criteria

1. **One entry per release.** Each axis ray makes one F4 entry on a valid release and none on an
   invalid one (extends `shape-reading-adapter.test.ts` or the T5 form-size tests).
2. **Plan follows 3D.** After a Width change, the form's Plan footprint (S04) equals the footprint
   derived from its new evaluation; there is no stale silhouette.
3. **Same fact.** The mark, the typed value and `FormCardFields` give identical `form.scale` and
   identical refusal.
4. **Coarse pointer.** Each ray is pressable through a 44 px area, and overlapping rays resolve by
   T5's order.
5. **Regression.** T5.P01's journeys pass (draw → size → Save → reopen; My Objects insert), and the
   golden digests are unchanged.
6. **No leftovers.** No `scene-form-size-*` overlay ids remain.

## 6. Reviews and stop conditions

- **Reviews:** T2 for shared adapter files; T1 for descriptor use.
- **Stop and report if:**
  - sizing needs a new planner or a form-policy change;
  - S08's object descriptors and form descriptors cannot share Move and Turn without a Scene planner
    change.

## 7. Handoff

T5.P02 Object Focus inherits the descriptor contract for its outline and section marks.
