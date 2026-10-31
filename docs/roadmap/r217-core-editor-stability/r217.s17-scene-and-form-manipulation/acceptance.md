# R217.S17 — acceptance record: Scene and form manipulation

**Slice:** R217.S17 · **Status:** accepted 2026-10-31; routine closeout on
[PR #239](https://github.com/Biskiq/spatial-sketch-editor/pull/239) · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

## Acceptance — 2026-10-31

Owner combined acceptance-and-closeout instruction. The accepted implementation revision is
`28143cce1d7eb8b014d53564edfbc1a2c5144f16`; closeout changes no production code. It removes the
temporary `.s17-*` browser runners and records this evidence.

**Owner ruling — no additional review round.** After the delivered P2 repairs the owner directed
that no further independent review round be opened unless a new material defect appeared. The
waived prerequisite is the independent re-review of this revision only; no acceptance criterion,
verification row, integration route or S11 evidence requirement is waived. The fresh Sol review of
the pre-fix candidate found two P2 defects — the remounted Place chooser could show a native
primitive while a remembered catalogue model stayed armed, and model proxy ghosts ignored approved
contact. Both were repaired at `d0b4fa53`, and regression tests plus the final browser matrix cover
the repaired behaviour. No post-fix clean review verdict is claimed; the register records
`owner-override: no additional review round`.

**Owner amendment.** S11 remains the final integration check after S25. It is not an S17 merge
prerequisite; its schedule and required integrated, coarse-pointer, native-touch and Safari
evidence are unchanged.

## Delivered

Selected Scene primitives, catalogue models, approved creator models and native forms can be moved
from their bodies in Plan and 3D. The grab offset is preserved, manipulation marks remain separately
hittable at calibrated screen size, and the shared 4 CSS px click tolerance keeps a click from
starting or previewing a drag. Placement and manipulation previews follow the pointer. Plan ghosts
use the accepted footprint; 3D uses the object or form ghost at the candidate pose with unlit,
outlined, non-picking geometry. Off-floor placements and releases refuse without writing.

The Place chooser re-synchronises from an armed remembered catalogue model after remount. Model
ghosts use the approved contact and candidate scale, so they seat on the floor instead of floating.
Only the verified salon chair (`paris-salon-chair`) is admitted from the catalogue, using retained
r186 GLTFLoader + Meshopt measurement: contact −5.2503e−12 m and an outward-rounded 0.643 × 0.537 m
footprint after applying the 0.92 default scale once. Unverified catalogue models remain excluded.

The mixed fixture carries a 3 × 2 room with a door and window, plinth, 0.9 m low Wall, 0.75 m table,
native box, catalogue chair, an unverified model, an approved creator model, and rectangular,
concave and tilted native forms. Browser seeding saves it through the project API and approves the
creator model through the real staging/upload/approval routes.

The owner's 2026-10-31 criterion revision keeps the landed upright-only planner boundary:
rectangular and concave upright forms owe the full journey; the tilted form owes explicit Move,
Place, Turn and Duplicate refusals with unchanged source and history. S17 adds no non-upright
planner support and claims no agreement for the tilted Size ghost.

## Final-revision verification

- `npm run check` passed with 0 errors and 0 warnings.
- The declared affected-subsystem tier passed: 11 files / 190 tests — candidate ghosts, Scene
  Compose, Scene editing surface, Scene operation acceptance, object cards, native-form marks and
  Paper agreement, Stage facade, the S17 mixed fixture, catalogue model verification and
  object-definition policy.
- The whole architecture lane passed: 23 files / 194 tests, including the documentation gate. The
  only S16 edit is the authorized evidence-pointer correction.
- Real Chromium pointer journeys ran against a disposable API-seeded mixed project at 1440 × 900.
  Every successful subject row completed pointer Place, body Move, live Turn, live Size, Duplicate,
  an off-floor refusal and five Undo operations back to no history:

| Subject | Plan | 3D |
| --- | --- | --- |
| Native primitive | passed (`X 2.5→2`, yaw 0→−180°, size 1→1.08636) | passed (`X 2.5→2`, yaw 0→−179.99998°, size 1→1.09866) |
| Catalogue salon chair | passed (`X 2→1.5`, `Z 1→1.5`, yaw 0→−180°, size 1→1.14590) | passed (`X 2.5→2`, yaw 0→−180°, size 1→1.15864) |
| Approved creator model | passed (`Z 0.5→1`, yaw 0→−180°, size 1→1.15044) | passed (`X 2.5→2`, yaw 0→−180°, size 1→1.17072) |
| Upright rectangular form | passed (`X 2.5→2`, yaw 0→−180°, size 0.7→0.82213) | passed (`X 2.5→2`, `Z 1→1.5`, yaw 0→−180°, size 0.7→0.84901) |
| Upright concave form | passed (`X 2.5→2`, yaw 0→−180°, size 0.7→0.82213) | passed (`X 2.5→2`, `Z 1→1.5`, yaw 0→−180°, size 0.7→0.84901) |

  The catalogue chair's saved entity retained `assetId: paris-salon-chair`. Live Turn and Size were
  driven by pointer drags, not typed or synthetic values. A near-edge Duplicate can legitimately
  refuse the +0.5 m copy; the runner therefore proves Duplicate by a new selected identity rather
  than by assuming a particular room edge.

- **Tilted fixture refusals, Plan and 3D.** Selecting `s17-tilted-form` exposes Move, Turn and the
  Scale disclosure. A body press refused, and both the Turn mark and the Card Move, Turn, Place on
  floor and Duplicate commands returned the planner's `unsupported-transform` refusal:
  *"Entity \"s17-tilted-form\" is not a truthful upright floor object, so this operation cannot own
  its transform."* The authored X/Z/yaw/width, selection and entity count were unchanged, and Undo
  was unavailable before and after in both readings.
- **Scaled-object ghost correctness, Plan.** After Size raised the native box from 1 to 1.097152322,
  a live Move preview's subject footprint area grew by 1.20374× — the same factor as the size change
  squared. A live Turn preview at 51.8° showed the enlarged, rotated candidate. Cancelling both with
  Escape left the accepted pose and size byte-identical.
- **Scaled-object ghost correctness, 3D.** After the same Size change, a live Move preview read
  `X 1.500 · Z 0.000 m` and the enlarged outlined ghost was visible away from the accepted body; a
  live Turn preview at 50.3° showed the enlarged rotated ghost against the accepted 0° body. The
  accepted pose and size were unchanged after cancelling both.
- **Layout widths.** 1440 × 900, 1280 × 800, 1180 × 820 and 820 × 1180 all rendered without document
  overflow; the stage, overlay, 2D/3D reading controls, selected-subject Card and Move mark stayed
  inside the viewport, and the Card fields were operable.

Local scratch logs and screenshots are the evidence above; archived copies are listed in the
[evidence manifest](../../../archive/roadmap/r217-core-editor-stability/r217.s17-scene-and-form-manipulation/evidence/CLOSED.md).
They are local implementation evidence, not S11 integrated, coarse-pointer, native-touch or Safari
evidence.

## Residuals and follow-up

- **S11 carries** the integrated journeys and the manual-owed coarse-pointer, native-touch and Safari
  rows. S11 remains scheduled after S25 and does not block S17's merge.
- **Recorded UX gap, not implemented in S17:** shape creation is still more complex than the target,
  advanced working-plane controls remain visible, and Pen/wireframe presentation needs visual
  polish. These are owner-directed separate follow-up work, not S17 defects; S17 deliberately does
  not redesign the UI.
- Tilted-form Size ghost agreement remains unresolved and unclaimed; the tilted planner boundary is
  unchanged.
- The architecture lane's single authorized S16 edit is the evidence-pointer correction; no other
  S16 behavior or acceptance changed.
