# `studio.profile-revision` — implementation plan

**Capability:** [`studio.profile-revision`](../../../../capabilities.json) · T5, order 2.
**Authority:** [T5 umbrella](../umbrella-plan.md#profile-revision) and
[Object Studio journeys](../object-studio-design.md#shared-surfaces-and-progressive-tools).
This plan records only this PR's concrete implementation; it changes no contract, format or UX.
**Tier:** 1 — shared shell surface (Card action, contributed task/instrument) with a new Scene intent,
no persisted-format change and no new dependency.

## Goal

A creator selects an eligible native form in Object Studio, chooses **Edit outline**, changes the
existing outline anchors (drag or typed U/V), toggles their existing smooth flag, and changes the
extrusion extent. **Apply** installs the whole revision as one F4 result; **Discard** restores the
accepted body. Key count/order, `nextKey`, plane, orientation and whole-form scale do not change;
the saved source reopens and evaluates afterwards.

## Design

- **Source stays form source.** The landed `SceneFormSource` already stores plane, keyed outline,
  extent, scale and `nextKey`. This capability adds no field, payload version or second source.
- **One new Scene intent, `set-form-profile`.** It carries the target entity id, the complete
  replacement outline (existing keys only), the new extent and an optional support choice. F4's
  envelope carries the captured expected revision. The planner validates the whole candidate with
  the existing profile/extrusion evaluator and current limits, then preserves the resting elevation
  exactly as `set-form-size` does (elevation forms use evaluated contact; plan forms contact 0; a
  lifted form keeps its declared lift).
- **Key identity is compared, never allocated.** The planner refuses a different key count or a
  different key at any position. Add/remove/reorder and plane changes are later work.
- **One pending task, one Card.** `Edit outline` opens a contributed task; the instrument is the
  task's one Card. Preview and Apply run the same planner. Apply is the only commit; blur does
  nothing; Discard and task close write no source.
- **The generator's plane is the reading.** A plan form enters the Camera's Plan reading
  (orthographic). Camera has no elevation reading; an elevation form uses Camera's `face` intent to
  look along the generator plane's normal and frame the profile. No second camera, orbit controller
  or pose interpolation is added.
- **One writer per fact.** While the task is open, the object Card omits the Size field that names
  the extent axis (Height for a plan form, Depth for an elevation form); the instrument's extent
  field is that fact's only writer and converts physical metres through the current scale.
- **No new identity.** The entity id, outline keys, `nextKey`, plane, rotation and `form.scale` are
  untouched; `position[1]` may change only to preserve contact/lift.

## Scope

In:

- `packages/project-model`: `set-form-profile` operation, strict payload reader, planner dispatch,
  scope grant.
- `apps/editor`: contributed task kind and instrument, Card action, profile-revision session,
  Stage pointer drag on the generator plane, candidate ghost/preview, Book the read into F4, the
  object Card's writer omission, and the Studio scope's per-action admission.
- Tests: planner, acceptance (install/Undo/Redo/reopen), adapter journey, Paper agreement, Studio
  action admission.

Out (explicitly later capabilities): add/remove/reorder anchors, plane change, holes, operations,
solid kernels, new Camera readings, new persisted fields, new dependencies, assembly/parts.

## Specification

### Scene operation

`set-form-profile` payload: `{ entityId, outline: [{ key, u, v, smooth }], extent, choice? }`.

Refusals: `missing-target`, `unsupported-transform` (not a form), `invalid-value` (key count/order,
profile codec issue, non-finite/out-of-range extent, evaluation failure), `no-op`, and the support
refusals every floor operation already returns.

Candidate: same entity id; `form.generator.outline` and `form.generator.extent` replaced;
`form.scale`, `form.nextKey`, `form.generator.plane`, `rotation`, `position[0]`, `position[2]` and
`name` exact; `position[1] = support.elevation + lift − scaleY × newContact`. Record scope grants
`form.generator` and `position[1]` only. Correspondence `preserved`.

### Reading and interaction

- `Edit outline` is a Card action on the scoped native form in Object Studio. It opens
  `scene-profile-revision` (task kind `revise-form-profile`).
- Plan form → `set-reading: plan` through the binding's Camera intent. Elevation form → `face` on
  the form's world bounds along the plane normal. Both requests are dated through the existing
  reduced-motion reading policy.
- Drag: pressing within 14 CSS px (22 coarse) of a projected anchor acquires one gesture with
  `cancel-on-reading-change`, intersects the form's own profile plane through Camera, converts to
  local `(u, v)` and updates that anchor in the draft (1 mm quantization). No source write.
- Typed U/V and the smooth toggle update the same draft. The extent field shows the physical
  extrusion dimension (`extent × scale[axis]`) and writes `extent`.
- The draft is a registered proposal until Apply/Discard/task close, so the existing Undo/Redo
  policy names it first.
- Apply re-plans the current draft, then submits one captured F4 intent. Installed → task ends and
  the source is the revision. Refused → the task stays open with the planner's words.
- Discard, Escape and task replacement restore the accepted body and write nothing.

## Checks

- `tests/lib/project-model/scene-operation-planners.test.ts`: concave and smooth revision; both
  planes; lifted support; key/nextKey/plane/scale preservation; crossed, collinear, minimum-edge,
  topology and extent refusals; no-op; determinism.
- `tests/lib/authoring/scene-operation-acceptance.test.ts`: one install, one history entry, Undo
  restores exact source and Redo restores the revision; serialize/re-admit the revised source
  (cold reopen) and evaluate it.
- `tests/lib/authoring/profile-revision.test.ts`: task/Card action, Plan reading, drag preview with
  no write before Apply, Apply, repeated revision, Discard, elevation/lifted support, invalid draft
  refusal, object Card's extent writer unmounted while open.
- `tests/lib/authoring/native-form-paper-agreement.test.ts`: revised source drives one fresh
  footprint and Paper drawing agreement.
- `tests/lib/authoring/studio-model.test.ts` / `studio-facade-scope.test.ts`: the root admits
  `Edit outline` while Duplicate/Delete stay refused.
- Type checks: editor `npm run check`, `npm run check:project-model`, `npm run check:geometry-core`
  (unchanged package, run because the planner consumes it); affected test files; `npm run test:arch`.
- Focused browser QA in the running editor: open a form in Studio, Edit outline, drag and type an
  anchor, Apply, Undo/Redo, reopen; capture console errors and targeted evidence.

## Flags

None. No capability label carries `needs-decision`, `needs-ux`, `needs-research`, `ambiguous` or
`bug` for this row.

## Risks

- **Camera reading for elevation forms.** The approved design says "the generator's plane as an
  orthographic reading"; the Camera exposes only 3D and Plan. This plan uses Camera's `face` intent
  for elevation forms instead of adding a third reading. Reversible; no Camera contract changes.
- **Root Card actions.** Studio's scope currently refuses every Card action on the scoped root.
  The scope gains the action id so `Edit outline` is admitted while Duplicate/Delete remain
  refused; the existing tests pin both directions.
- **Drag precision.** Local profile coordinates are quantized to 1 mm to keep canonical bytes
  stable; the profile codec still owns validity and refuses a drag that crosses or collapses.
- **Large outlines.** The instrument renders one row per existing anchor (3–256 by the landed
  limit); no virtualization is added and no new count limit is claimed.
