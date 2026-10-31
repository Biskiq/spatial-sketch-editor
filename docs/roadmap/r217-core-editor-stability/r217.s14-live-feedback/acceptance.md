# R217.S14 — acceptance record: Live feedback

**AUTHORITY: NONE.** R217.S14 is shipped. The phase [slice register](../README.md#slice-register)
owns status. **Accepted 2026-10-30** after a fresh independent review returned **CLEAN** at
`66753654`; five non-blocking P3 corrections (two stale comments, one strengthened test, the
capture revision and one review note) were applied after that verdict without changing behaviour,
and no P0–P2 finding remains. **Plan:** closed stub
[implementation-plan.md](./implementation-plan.md) · **Phase:** [R217](../README.md) · **Integration
route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

## Implementation

Layout's snap policy is one small module, `adapters/layout/snap.ts`, beside `precision.ts`. It
selects which existing resolver an operation may ask and computes no geometry: Ink Wall points use
`resolveLayoutSnap` with Junction, Wall span, orthogonal guide and the fixed 0.5 m grid
(`extension-guide` has no candidates and stays unused); Opening slide and width edges use the
`resolveOpeningDragSnap` family. The Opening frame keeps the compiled segment id and room but the
**authored** start/end, so a sampled or room-qualified span cannot move the measured offset. A width
snaps in 0.1 m steps; Wall points and slides in 0.5 m. One word per family — `Junction`, `Aligned`,
`Grid`, `Wall`, `Opening` — names the winner, and Alt / Snap held suppresses every row through the
one shared drafting state. Neither `StageDraftingState` nor the increment gained a second owner.

`StageAdapterBinding` gained one optional `candidatePreview(context)` beside `overlay` and
`graphics`. `candidatePreviews()` in `stage-facade.ts` projects every world point once through the
accepted evaluation and returns viewport CSS with per-candidate bounds; `StageOverlay.svelte` draws
fills, edges, labels and the winning snap tag as SVG in both readings. Subject uses selection ink,
affected a neutral outline, refused a thin neutral dash. Nothing is serialized, admitted to history
or persisted.

`adapters/layout/candidate-preview.ts` builds the preview from the planner's own candidate document:
`compileWallFirstLayoutGeometry` → `evaluateLayoutPlan` → the existing `buildPaperPlan` drawing,
filtered to the changed Wall and Opening ids. It is not a second solve. Every point is flattened to
the level **datum**, not the Paper cut elevation, so Plan reads identically and 3D shows the
candidate's footprint on the mat. No Layout candidate mesh was added; Scene and form ghosts keep
their meshes. A refused candidate publishes only its reason, and the refusal tag hard-wraps an
overlong id inside the Stage.

The Wall chain, existing Wall marks, Box and Opening placement/slide/width publish through that
contribution. Wall-reading hover now advances the chain it previously skipped. A null datum-plane
point withdraws every preview document, neighbour list and snap, so a candidate cannot outlive the
pointer's plane. `paperSheetRectFor` unions `candidateBounds` into the work before rounding, so
Paper's bounded sheet grows to include a live candidate without reframing the Camera. The option is
threaded route → `StageCanvas.svelte` → `StageGrid.svelte`.

The Stage contribution contract in `docs/reference/architecture.md` now describes
`candidatePreview`, the one projection and the datum rule; the T1 baton records the slice. No
persisted format, planner, gate or new snap geometry changed.

## Verification

Tier: `affected-subsystem`; the integrated result remains owed to
[R217.S11](../r217.s11-integrated-final-gate/implementation-plan.md).

- `npm test`: **250 files / 3,209 tests passed**.
- `npm run test:arch`: **23 files / 194 tests passed**.
- `npm run check`: **0 errors, 0 warnings**.
- `npm run build`: **passed** (Vite SSR and client bundles emitted).
- `layout-candidate-preview.test.ts` pins marker invariance under a nonzero Stage rect and offset;
  the null-plane withdrawal (after proving a candidate existed); preview polygons and segments
  equal to the drawing release compiles; every point on the datum rather than the cut; Box, Opening
  placement and Opening slide agreement; refusal geometry absent with its reason; the grid winner
  and Alt suppression; the orthogonal `Aligned` winner; and the selected Opening slide.
- `layout-snap-policy.test.ts` pins the authored-span Opening frame in both reversed and
  room-qualified cases and the one-word family map, including the fail-closed unknown kind.
- `layout-wall-manipulation.test.ts` and `stage-grid.test.ts` pin the Wall-mark preview glue and the
  sheet growth from a candidate extent. `spatial-route-gesture.test.ts` covers the shell wiring the
  candidate bounds travel through.

Browser, Chromium at **1440 × 900, 1280 × 800, 1180 × 820 and 820 × 1180** on the local editor,
starter **Enclosed room**, DPR 1, real pointer input:

- Ink Wall over the grid showed the live leg under the pointer with `Length 2.236 m · angle 26.6°`
  and the `Grid` tag, unchanged when the Index was collapsed, so the marker is in Stage space, not
  Index-relative space.
- A Box whose ring crossed a Room without a shared Junction published no geometry and its refusal
  sentence; a legal Box published four ghost Walls, the grid snap and the consequence label.
- In 3D the live Box candidate read as a flat footprint on the datum mat, not a slice at the Paper
  cut.
- Opening placement on a selected Wall showed the edge-positioned ghost and `Width 0.900 m` without
  centre-snapping. Sliding the Opening held it on the 3.0 m centre with a `Grid` tag and live
  `Offset 2.550 m`; release committed once (`2.55`) and one Undo restored `2.357493857`.
- At every required width the live length/angle/snap tags, palette, ruler, dock, Height Sheet and
  Stage did not collide, including the portrait shell.
- Snap words, the refusal wrap and the datum-plane withdrawal on the final revision are pinned by
  the tests above rather than by a second capture pass; the later `66753654` overlay-space fix
  changes no captured candidate, refusal or width state.

Captures and byte hashes are in the [archived evidence manifest](../../../archive/roadmap/r217-core-editor-stability/r217.s14-live-feedback/evidence/2026-10-30-browser/CLOSED.md).

## Evidence limits

One Chromium session with a fine pointer at the four required widths; native touch, coarse-pointer
marks, Safari and the integrated R217 journeys remain S11's. The captures were taken at `90ceaf9b`;
the final `66753654` revision corrects overlay-marker space and off-plane withdrawal, both proved by
tests. Mid-drag frames are settled endpoints; animation continuity is not a captured claim.
Parallel-Wall alignment, new snap targets, the Ink palette redesign (S23) and Shaded Plan are out of
scope, and S15 owns Wall length/rigid-move snapping. The Opening refusal marker's no-ghost
`press.css` fallback is correct by inspection and is not directly covered; the refusal test
exercises the projected start and the refusal words.

## Residuals

No known defect for this slice. No waiver or deferred acceptance item is carried by this record.
The owner's hands-on Wall-feel check follows R217.S15.

## Closeout preservation — R217.S14 (2026-10-30)

```text
prose compacted:                 1   approved plan -> stub at its own path
reference promotions:            1   the Stage contribution contract in docs/reference/architecture.md
renderable evidence archived:    13 files / 1,290,321 bytes
evidence stubs / manifests:      1   archive CLOSED.md + live evidence pointer
transient artifacts removed:     2   reviewer diff dumps in the repository root
historical anchor:               7167cdd4 · tag closed/r217.s14 (pushed to origin)
new live -> archive prose links: 0   evidence links point at the manifest
manual-owed verification rows:   0
remaining deferred items:        0 known defects; S11 integrated journeys only
permanent stubs added:           1   the closed plan
```

P1 merge required (PR #233). After merge, verify the historical anchor is an ancestor of `main`,
inspect the recovery path with `git show <anchor>:<path>`, and confirm the tag target retains the
anchor. The branch head is deliberately not pinned here because this PR's merge will change it.
