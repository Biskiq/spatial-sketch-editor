# T5.P01.S02 — Shape reading and sizing: implementation plan (outline)

**Slice:** T5.P01.S02 · **Status:** proposed — an outline. It is completed and approved after
`T5.P01.S01` is accepted and T1 agrees the Ink reading seam (decision D5 in the
[record](../../../../reference/decisions/t5-object-focus-planning-2026-10-27.md#owner-decisions)) ·
**Phase:** [T5.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:**
[T5](../../README.md) · **Runbook:** [T5 operations](../../../../operations/t5-expressive-geometry/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t5.p01.s03-integrated-final-gate/acceptance.md
```

## Outcome

The creator draws a closed outline with Ink in World, reads it as a **Shape**, pulls its depth along
a ray or types it, and creates a native object. They size a selected form per axis with rays or
exact Card values. This is the phase's creator entry point.

## Scope to complete before approval

1. **Ink reading seam (T1-reviewed).** Ink stays one Pen. Today it is the Layout adapter's task and
   reads strokes as Walls. The seam lets more than one domain offer a reading of the same stroke:
   Layout keeps Wall; Scene adds Shape. The seam is a declared host capability that adapters
   require or refuse, owns no document state, and keeps PLATE's temporary-reading grammar. Its
   exact shape is agreed with T1 before this plan is approved; T1 may deliver it first instead.
2. **Shape reading.** A closed stroke reads as a Shape on the floor (`plan`) or on an upright sheet
   (`elevation`, with the sheet's yaw), through `WorkingPlane`. Shape kinds Line, Box, Round and
   Sketch convert a stroke into outline anchors (straight or smooth). Conversion is session work and
   may use any arithmetic; only the stored outline is canonical. Live validity uses geometry-core's
   `validateProfile`, and an invalid outline shows its reason in words and offers no Create.
3. **Wall faces.** Drawing on a Wall face uses the face's frame for the upright sheet. It is in
   scope only if T1's Wall face-frame query has landed when this plan is approved; otherwise it
   moves to a later slice and the creator aligns an upright sheet by hand.
4. **Depth and Create.** A depth ray from the outline, a typed depth, Flip side for upright
   outlines, and Create, which issues one `create-form` intent. The preview body equals the created
   body. Cancel, refusal and stale state add no history.
5. **Sizing.** Per-axis size rays on a selected form, and Width, Depth and Height Card writers, each
   issuing `set-form-size`. The Card is the one writer for exact values.
6. **Defaults.** The default material and the creator-visible name pattern follow the native
   primitives' conventions.
7. **Design loop.** PLATE's feature design loop (draft → review → build → real-browser observation →
   revise) for the reading, rays, Card facts, refusals, keyboard paths, narrow and short shells, and
   reduced motion, with any departure from the shell contract named for owner review
   ([PLATE](../../../../reference/design-system/editor-shell-and-visual-system.md#product-convergence-destination)).

## Out of scope

Object Focus; outline revision after creation; shaping; wall-mounted forms at height; attachments;
any F4, Head, Save or Camera change.

## Evidence to plan

- Responsiveness of live reading, drag, Create, size and Undo is an M/L spot check when one of the
  [spot-check triggers](../../../../reference/decisions/performance-spot-check-2026-10-28.md) applies.
  The comprehensive matrix and the S-tier drag quotas are suspended. `grid-M` / `grid-L` do not
  measure a form-heavy Scene; a form workload is a separate investigation when forms are what changed.
  Stage first-load growth stays the historical ≤ 25 KiB br delivery row, checked with `npm run perf:bundle`
  when delivery is the question.
- Agent E2E journeys: draw, read, pull depth, create on each surface; size by ray and by Card;
  refusals; Undo, Save, reload; Preview.
- Reviews: T1 for the seam and any Stage host change; T2 for Scene adapter and intent changes.

## Stop conditions

The seam cannot be agreed with T1; a second selection, history or writer appears necessary; an
F4, Head or Save change appears necessary. A slow interaction found by an authorized spot check is
recorded on that check; it does not revive the suspended comprehensive benchmark.
