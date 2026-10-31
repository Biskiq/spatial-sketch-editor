# R217.S17 — acceptance record (closed)

**AUTHORITY: NONE.** R217.S17 shipped 2026-10-31 via
[PR #239](https://github.com/Biskiq/spatial-sketch-editor/pull/239). The phase
[slice register](../README.md#slice-register) owns status;
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns integrated campaign acceptance.

## Delivered

Selected Scene primitives, catalogue models, approved creator models and native forms can be moved
from their bodies in Plan and 3D, with the grab offset preserved and manipulation marks separately
hittable at calibrated screen size. The shared 4 CSS px click tolerance keeps a click from starting
or previewing a drag. Placement and manipulation previews follow the pointer; Plan ghosts use the
accepted footprint and 3D uses unlit, outlined, non-picking ghosts at the candidate pose. Off-floor
placements and releases refuse without writing.

The Place chooser re-synchronises from a remembered catalogue model after remount, and model ghosts
use approved contact and candidate scale. Only the verified salon chair (`paris-salon-chair`) is
admitted from the catalogue: contact −5.2503e−12 m and an outward-rounded 0.643 × 0.537 m footprint
after the 0.92 default scale once. Unverified models remain excluded. The mixed fixture carries the
room, Layout subjects, Scene objects, native forms and approved creator model used by S11.

The owner's 2026-10-31 criterion revision keeps the landed upright-only planner boundary:
rectangular and concave upright forms carry the full journey; the tilted form owes explicit Move,
Place, Turn and Duplicate refusals with unchanged source and history. No non-upright planner support
was added, and tilted Size ghost agreement is not claimed.

## Acceptance and verification

Owner combined acceptance-and-closeout instruction: 2026-10-31. Accepted implementation revision
`28143cce1d7eb8b014d53564edfbc1a2c5144f16`; closeout revision
`a5099cdcc33f2da3848cc677d8d813d599c2bc5e`. Closeout changed no production code.

**Owner-override: no additional review round.** The waived prerequisite is the independent
re-review of this revision only; no acceptance criterion, verification row or S11 requirement was
waived. The fresh Sol review of the pre-fix candidate found two P2 defects — a remounted Place
chooser could display a native primitive while a remembered catalogue model stayed armed, and model
proxy ghosts ignored approved contact. Both were repaired at `d0b4fa53` and covered by regressions
and the final browser matrix. No post-fix clean verdict is claimed.

Recorded at the tested revision: `npm run check` passed with 0 errors / 0 warnings; the declared
affected-subsystem tier passed 11 files / 190 tests; the whole architecture lane passed 23 files /
194 tests. Real Chromium pointer journeys at 1440 × 900 completed the full Place, body Move, live
Turn, live Size, Duplicate, off-floor refusal and five-Undo row for the native primitive, catalogue
salon chair, approved creator model, upright rectangular form and upright concave form in both Plan
and 3D. The catalogue chair retained `assetId: paris-salon-chair`. The tilted fixture refused body
Move, Turn, Place and Duplicate with `unsupported-transform` in both readings, changing neither the
authored fields nor Undo availability. Post-Size Move and Turn ghosts were verified live in Plan
(area growth 1.20374×; Turn 51.8°) and 3D (Move `X 1.500 · Z 0.000 m`; Turn 50.3°) without changing
the accepted pose. All four declared widths — 1440 × 900, 1280 × 800, 1180 × 820 and 820 × 1180 —
rendered without document overflow, keeping the stage, Card and Move mark inside the viewport.

Exact journey values, refusal words and screenshot references are recoverable at the acceptance
anchor below; archived screenshots are listed in the
[evidence manifest](../../../archive/roadmap/r217-core-editor-stability/r217.s17-scene-and-form-manipulation/evidence/CLOSED.md).

S11 still owes the integrated journeys plus coarse-pointer, native-touch and Safari evidence. S11
remains scheduled after S25 and is not an S17 merge prerequisite. The owner-directed UX gap —
shape-creation simplification, hiding advanced working-plane controls and Pen/wireframe visual
polish — was recorded and deliberately not implemented in S17.

P1 merge commit: `a9a383c6f284792016154f1db3ca20a713470d0a` (PR #239; merge commit method).

## Recovery and preservation report — 2026-10-31

```text
prose compacted:                 2   approved plan and acceptance record -> stubs at their own paths
reference promotions:           0   landed contracts already describe the behaviour; no new reference truth
renderable evidence archived:   39 files / 5,269,288 bytes
evidence stubs / manifests:     1   docs/archive/roadmap/r217-core-editor-stability/r217.s17-scene-and-form-manipulation/evidence/CLOSED.md
transient artifacts removed:    6   five .s17-* scratch runners and the S17 checkpoint
historical anchors:              plan afb41b4f8fa44cb99ed60613b9c6b239e3e8e197; acceptance a5099cdcc33f2da3848cc677d8d813d599c2bc5e; tag closed/r217.s17 (pushed to origin)
new live -> archive prose links: 0
manual-owed verification rows:  4   coarse pointer, native touch, Safari, integrated journeys (S11)
remaining deferred items:       3   S11 rows; S17 UX gap; tilted Size ghost
permanent stubs added:          2   approved plan and acceptance record
```
