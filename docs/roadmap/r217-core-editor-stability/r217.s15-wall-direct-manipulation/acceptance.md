# R217.S15 — acceptance record: Wall direct manipulation

**AUTHORITY: NONE.** R217.S15 is shipped. The phase [slice register](../README.md#slice-register)
owns status. **Accepted 2026-10-30** after a fresh independent review returned **CLEAN** at
`d3932ca8`; the later `78670c68` correction retires a retained refusal on task, selection and content
transitions and strengthens its own tests without changing the reviewed contract, and no P0–P2
finding remains. **Plan:** closed stub [implementation-plan.md](./implementation-plan.md) · **Phase:**
[R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/implementation-plan.md)

## Implementation

One press rule serves the selected Wall. `pointerIntent` resolves the pick once with purpose
`select` and claims the press only when the winner is that Wall; an end mark names its Junction
point, the body and two-way grip name a signed distance on the Wall normal, and the free-end ray
keeps the length ray. The normal projection feeds the unchanged `planRigidWallMove`, the point feeds
`planExactJunctionMove`, and the ray keeps `planExactWallLength`. No planner, persisted format or
snap geometry changed. A press within the existing 4 CSS px click tolerance stays a click and writes
nothing.

`adapters/layout/wall-gesture.ts` is still the only pointer-to-parameter authority.
`pointerWallRequest` returns a new `{ kind: 'junction', junctionId, point }` request beside the
existing move/length/angle kinds, so a shared Junction moves every incident Wall through the same
planner. The length ray preserves its sign across the fixed endpoint and is refused rather than
mirrored.

Snapping reuses the one policy module. Junction drags take `orthogonal-guide` from the Wall's other
end and then the fixed 0.5 m grid; body moves round the normal distance to 0.5 m once the point
leaves rest; the length ray rounds to 0.5 m. Alt during the drag suspends all three. The value tag
and snap name come from the existing mark layer.

Numeric entry extends the ratified lifecycle: a point opens X then Z, Tab reaches each axis, and
Enter commits the axes that were typed while an untouched axis keeps its current value. Typing
freezes the pointer proposal; the eventual pointer-up is consumed; the first Escape restores the
pointer value and the second cancels. A refused release leaves the document and history untouched
and keeps its human sentence at the last pointer until the next press.

`adapters/layout/refusals.ts` is the single Wall refusal vocabulary, imported by both the Stage tag
and the Card error. Raw planner codes, ids and messages no longer reach either surface. The Card
gained Start/End X/Z under one disclosure through the same Junction planner. The route adds a
`move` cursor over that selected body and keeps `grab` elsewhere; the mark-press flag keeps a tap on
an edit mark a command instead of clearing the live gesture.

Curved Walls with no straight frame keep the Card path only: no body claim and no edit marks. The
delivered contract is in
[`docs/reference/architecture.md`](../../../reference/architecture.md#editor-interaction-authorities)
and the Wall row of the
[spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md).

## Verification

Tier: `affected-subsystem`; the integrated result remains owed to
[R217.S11](../r217.s11-integrated-final-gate/implementation-plan.md).

- `npm test`: **251 files / 3,233 tests passed**.
- `npm run test:arch`: **23 files / 194 tests passed**.
- `npm run check`: **0 errors, 0 warnings**.
- `npm run build`: **passed** (Vite SSR and client bundles emitted).
- `layout-wall-manipulation.test.ts` (48 tests) pins the rigid body translation, the shared-Junction
  point, the length ray, both snap gates and Alt, the one-release-one-Undo path, click tolerance,
  the refused release and its retained reason, typed Junction X alone, X-then-Z with Tab, the numeric
  body distance, and a curved Wall with no frame.
- `layout-precision-adapter.test.ts`, `layout-candidate-preview.test.ts`,
  `layout-card-junction-fields.test.ts` and `spatial-route-gesture.test.ts` pin the adapter bindings,
  candidate marks, the Card disclosure and the route's press, cursor and keyboard wiring.

Browser, Chromium at **1440 × 900, 1280 × 800, 1180 × 820 and 820 × 1180** on the local editor,
starter **Enclosed room**, DPR 1, real CDP mouse press/move/release and real key events, revision
`462b80cc`:

- Selected Wall in Plan: gold body, shared start/end points, two-way grip and the Card disclosure.
- Body drag: the moved Wall and both reshaped neighbours previewed over the accepted plan with
  `Move 0.50 m` and `Grid`; release moved both Junctions once, kept all four Wall ids and produced
  one Undo; one Undo restored the authored plan.
- Shared Junction drag: `Length 6.50 m · 0° · 2 Walls`, both incident Walls following; release and
  Undo matched.
- Length-ray drag: `Length 8.00 m` with the other end fixed; release committed once.
- Numeric entry during a body drag: `Distance 1.25` replaced the pointer value and Enter committed
  it once without moving the pointer further.
- Card Start/End X/Z: End X `7.5` produced Length `7.5` through the same planner.
- 3D body and Junction drags: the candidate is the flat footprint at the datum, never an extruded
  ghost; release refreshed the Wall meshes.
- Body dragged across the Room: candidate withdrawn, thin neutral dashed reach and
  `This would break a Room.`; release wrote nothing.
- A press/release within tolerance on the selected body wrote no history; an empty-stage drag
  panned the Camera and wrote no history; computed cursor read `move` over the selected body and
  `grab` over empty Stage.
- All four required widths held the shell, palette, Card and Stage; at 820 × 1180 the floating Card
  covers the tag's right edge, as it already does for other Stage tags in that constrained shell.

Captures and byte hashes are in the
[archived evidence manifest](../../../archive/roadmap/r217-core-editor-stability/r217.s15-wall-direct-manipulation/evidence/2026-10-30-browser/CLOSED.md).
The later correction (`d3932ca8`, `78670c68`) adds the retained refusal lifetime and its tests; it
changes no captured candidate, value or width state.

## Evidence limits

One Chromium session with a fine pointer at the four required widths. Coarse-pointer marks are
pinned numerically in `layout-wall-manipulation.test.ts` and their browser journey stays S11's; native
touch, Safari, authenticated save/reload and the integrated R217 journeys also remain S11's. The
revision that adds the retained refusal tag after release is proved by the test above, not by a
second capture pass. Mid-drag frames are settled endpoints; animation continuity is not claimed.
Opening-over-host selection, hovered-Junction drag and Opening body drag are R217.S16; Junction merge,
the angle ring and height/thickness grips are out of scope.

## Owner checkpoint

The integrator pauses after this merge so the owner can try the Wall drag in Plan and 3D and judge
whether the datum-footprint preview is sufficient. O2 can be revisited cheaply at that check; a
full-mesh candidate preview is a material change this slice did not build.

## Residuals

No known defect for this slice. No waiver or deferred acceptance item is carried by this record.

## Closeout preservation — R217.S15 (2026-10-30)

```text
prose compacted:                 1   approved plan -> stub at its own path
reference promotions:            1   the Wall direct-manipulation contract in docs/reference/architecture.md
renderable evidence archived:    21 files / 2,885,827 bytes
evidence stubs / manifests:      1   archive CLOSED.md + live evidence pointer
transient artifacts removed:     0   probe captures were removed before the manifest
historical anchor:               78670c68 · tag closed/r217.s15 (pushed to origin)
new live -> archive prose links: 0   evidence links point at the manifest
manual-owed verification rows:   coarse pointer, native touch and Safari, carried by S11
remaining deferred items:        S16 Opening/Junction-hover scope and S11 integrated journeys only
permanent stubs added:           1   the closed plan
```
