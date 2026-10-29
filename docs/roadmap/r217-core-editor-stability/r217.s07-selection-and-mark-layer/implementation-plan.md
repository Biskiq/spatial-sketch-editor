# R217.S07 — Selection, hover and the mark layer: implementation plan

**Slice:** R217.S07 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T1 · **Reviewers:** T2 and T5
(descriptor contract), T3 (Experience-lens selection echo) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Makes selection, hover and dragging legible, with one mark language drawn by the Stage and
admitted by each domain
([grammar §Rays and points](../../../reference/design-system/spatial-instrument-grammar.md#rays-and-points),
[PLATE §Spatial mark language](../../../reference/design-system/editor-shell-and-visual-system.md#spatial-mark-language)).
Layout migrates onto it here; Scene objects and forms follow in S08 and S09.

## Prerequisite

R217.S03 is accepted. S04 lands first if both are ready, so Plan selection ink is drawn on Paper.

## Scope

1. **Selection.**
   - A gold contour with a quiet tint in 3D, and contrast-safe gold ink on Paper.
   - It is derived from the one selection state and echoed in the Index row and the Card identity.
   - The gold dot and the grey markers in `StageOverlay.svelte` are retired.
2. **Hover.**
   - A restrained edge or tint below selection, never gold, from S03's hover state, in both readings.
   - On `hover: none` devices, hover is replaced by press feedback.
   - Keyboard focus keeps its own non-hue cue.
3. **Mark layer.**
   - The host draws, in the one Canvas, the dashed white ray with a dark halo, the open arrowhead, the anchor point (gold while held), the rotation ring and the live value tag (dark, mono, shown only on hover or drag).
   - Marks follow the grammar's density rule: none stack into unreachable targets at overview zoom.
4. **Handle descriptors.** A domain contributes marks as data:
   - kind (ray, point, ring, track);
   - anchor and axis;
   - the fact the mark addresses;
   - the planner a drag calls;
   - the tag's verb template.

   The host never creates a descriptor. A descriptor without a domain planner is refused at
   registration (affordance admission).
5. **Mark tier.** Marks of the selected subject fill S03's reserved tier above world geometry. Hit
   areas grow to 44 × 44 px on a coarse pointer, while marks stay visually small. Overlapping marks
   of one class are disambiguated by the owning domain.
6. **Layout marks** migrate onto descriptors, and their adapter-local knob drawing and drag state are
   removed in the same PR:
   - Wall end points, with Junction preservation;
   - Wall length and angle;
   - Wall move;
   - Opening position and width.

   Wall thickness stays a Card field under More.
7. **Precision ladder:**
   - a valid release commits one Undo step, and an invalid release cancels with none;
   - typing digits at the gesture turns the tag into numeric entry; Esc restores and then cancels; blur never commits;
   - the Card field writes the same fact with the same refusal.

## Not in scope

Scene object and form marks (S08, S09), the Eraser's red dashes (S10), multi-select, and
Experience-lens Camera marks (unchanged).

## Shared-file claims

`StageCanvas.svelte`, `StageOverlay.svelte`, the selection session, `layout.adapter.ts` and the
Layout adapter's gesture and precision modules.

## Acceptance criteria

1. **Admission:** no mark is drawn without a domain planner. A seeded descriptor without one is refused.
2. **Colour roles:** hover is never gold, and selection appears in Stage, Index and Card on the same identity.
3. **Layout marks:**
   - a valid release produces one F4 entry and an invalid release none;
   - Junction identity is preserved across an end drag;
   - mark and Card produce the same fact and refusal text.
4. **Typing at the gesture** follows the precision ladder, with a test for Esc, then Esc, then blur.
5. **Coarse pointer:** under emulation, every Layout mark is reachable with a 44 px target and no mis-pick into navigation.
6. **No leftovers:** the adapter-local Layout knob code is gone, with no duplicate path.

## Verification

Affected Stage and Layout adapter contracts and the heavy Layout planner contracts; then the
complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
