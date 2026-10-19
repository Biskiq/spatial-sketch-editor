# T2.P01.S03 renderer exception — 2026-10-17

**Owner decision.** Narrowly supersedes one clause of the [T2 host-seam
exception](./t2-s03-host-seams-2026-10-17.md) — the one that withheld "a 3D candidate mesh" until
renderer work was separately authorized. The owner directed that the slice's remaining acceptance
obligations (a minimum 3D candidate body and drawn-geometry support evidence) be completed, and that a
narrowly scoped renderer exception be recorded if one was required. It is. No other authorization is
reopened, no product scope changes, and no capability, gate or acceptance state is granted.

**Context.** The host-seam exception gave T2 three additive host hooks and explicitly excluded a 3D
candidate. Its consequence was disclosed in review: the candidate existed only as a CSS overlay label,
and support was a datum-plane intersection, so a Wall or plinth between the pointer and the floor could
be mistaken for floor support. Both are plan requirements, not embellishments: the plan says "Both views
display the same prepared candidate; a 3D surface hit resolves back to compiled Layout evidence. A wall,
plinth or another object's mesh cannot be mistaken for floor support."

## What this authorizes

`T2.P01.S03` may make exactly these additive renderer/host changes:

1. **A proposed-pose contribution.** `StageGhostMesh` plus an optional binding
   `ghosts(context): readonly StageGhostMesh[]`, aggregated by `StageFacade.ghosts()`. A ghost carries a
   pose and an extent only — no geometry, material, camera or scene.
2. **One render block in the one Canvas.** `stage/shell/StageCanvas.svelte` gains a `ghosts` prop and
   draws each ghost as a translucent child mesh of the existing `<Canvas>`.
3. **The route read.** The spatial route re-reads `stage.ghosts()` in the same `refresh()` that reads
   `overlays()` and passes it to `StageCanvas`.
4. **The support test, adapter-local.** The Scene adapter resolves the pointer ray against occluders
   derived from the admitted snapshot's compiled Layout (the compiled solid wall spans the shared
   wall-mesh builder draws, plus compiled Layout objects) and the resolved Scene's primitive entities. It
   adds no host service and no renderer state.

## What it does not authorize

- A second Canvas, renderer, scene, camera or animation loop; any change to `StageCamera`,
  `VisitorLayoutShell`, `VisitorEntities` or the visitor surface; post-processing, custom materials,
  asset loading or model geometry.
- A second support authority or a persisted support constraint. The occluders are read from the same
  admitted snapshot the hit path already reads; nothing is written to Layout or Scene by the test.
- A ghost for shapes with no verified extent (model entities) — inventing one would be a false preview.
- Any capability, gate, acceptance, readiness, merge or closeout record.

## Boundaries carried forward

- The one Canvas remains the only renderer, and the candidate is the object's own body at the captured
  pose — the same pose the planner would commit, never a post-preview correction.
- Occlusion is conservative: anything drawn nearer than the datum refuses the floor point. A model
  entity contributes no occluder (no verified dimensions in this slice), so a model can fail to block a
  floor point but can never fabricate one. That limit is stated in the slice evidence.
- The T1 host surface stays T1's: this exception adds a prop and a render block, and touches no Save,
  Card-name or Layout-proposal behaviour.
- The combined tree's merge gate still runs at each merge; the second merger resolves shared files.
