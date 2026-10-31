# R217.S17 — acceptance record: Scene and form manipulation

**Slice:** R217.S17 · **Status:** [implementation PR #239](https://github.com/Biskiq/spatial-sketch-editor/pull/239) in review; no acceptance recorded · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

This record documents the implementation candidate and its current evidence. It does not accept
the slice or the R217 integrated gate.

## Owner amendment — 2026-10-31

S11 is the final integration check **after S25**. The owner explicitly clarified that S11 is
not an S17 merge prerequisite; its schedule and required evidence remain unchanged. Generic
one-slice merge-gate wording must not move S11 ahead of S17 or prevent S17's routine closeout.
S17 must satisfy its own approved criteria and verification before the parent starts a fresh
Luna 6 medium chat for closeout through merge. No re-review or polling is requested.

The owner also authorized the single relative-link correction in S16's evidence pointer so the
architecture lane can run clean. This changes no S16 acceptance or product behavior and authorizes
no other S16 edits.

## Implemented

Selected Scene objects and native forms can be moved from their bodies in Plan and 3D. Placement
and manipulation previews follow the pointer; Plan ghosts use the same projected footprints as
accepted placement. Manipulation mark priority, form sizing, and pointer placement refusal were
updated with focused regression coverage. The browser seed creates the mixed fixture and approves
its creator model through the real import routes, using measured importer output for normalization.

The owner's 2026-10-31 criterion revision keeps the landed upright-only planner boundary.
Rectangular and concave upright forms owe the full successful journey; the tilted fixture owes
explicit Move, Place, Turn and Duplicate refusals with unchanged source/history. Tilted Size
ghost agreement is not claimed. The mixed-fixture regression confirms all four planner refusals
and unchanged authored Scene data.

The fresh Sol review at the pre-fix PR candidate identified two P2 defects: a remounted Place
chooser could display a native primitive while a remembered catalogue model remained armed, and
model proxy ghosts could float because they ignored the approved floor contact. The current
candidate synchronizes the chooser from the armed catalogue model, carries approved contact into
model Place/Move/Size ghosts, and seats each proxy at the candidate scale. Regression coverage
checks remount-and-replace behavior and nonzero model contact. The owner instructed no re-review;
these repairs are not described as a new clean review verdict.

## Verification evidence

- `npm run check` passed with 0 errors and 0 warnings.
- After the delivered P2 repairs, the current affected-subsystem run passed 11 files / 156 tests:
  candidate ghosts, Scene Compose, Scene editing, Scene operation acceptance, object cards,
  native-form marks and Paper agreement, Stage facade, the S17 mixed fixture, catalogue model
  verification, and object-definition policy.
- `npm run test:arch` still fails at the same pre-existing S16 documentation link: 22 / 23 files
  and 193 / 194 tests passed. No S16 file was changed.
- The independent review found a P2 click-tolerance defect in both body-drag paths. Revision
  `b48545e58f4b9a6005487e65838b5f286691b4dd` captures the press CSS, uses the shared Stage drag
  boundary for preview and release, and clears the candidate when the pointer returns within click
  range. New object and form regressions cover sub-threshold jitter and return-to-click release.
- `npx vitest run tests/lib/authoring/scene/object-definition-policy.test.ts` passed: 1 file,
  9 tests.
- Browser work against a disposable API-seeded mixed project confirmed primitive body Move,
  Turn, Size, Duplicate and Undo; live Plan pointer placement, an off-floor refused candidate, and
  Undo of a valid placement; native-form Turn and Size in Plan and 3D; and approved-model body
  Move, Turn, Size, Duplicate and Undo in Plan and 3D. The live approved-model footprint came from
  measured importer geometry. The disposable project was deleted after the checks.

Independent re-review on 2026-10-31 of PR #239 at tip `38639c0e` confirmed the body-click fix at
`b48545e5` and found no actionable P0–P2 regressions. It also exercised pointer-up within click
range after a prior drag for both body paths. This closes the review finding; the slice remains
unaccepted while its browser matrix, catalogue row and S11 integration evidence remain unresolved.

## Unresolved criteria and integration

The current working candidate admits the salon chair (`paris-salon-chair`) after retained r186
GLTFLoader + Meshopt measurement: contact −5.2503e−12 m and an outward-rounded 0.643 × 0.537 m
footprint after applying its 0.92 default scale once. The model-verification test retains this
measurement. Place exposes admitted catalogue models through the existing placement session;
unverified models remain excluded. Its complete browser interaction row is still owed.

The resumed 2026-10-31 Chromium run at 1440×900 completed the primitive **Plan** sequence on
HEAD `5e4a1e19` plus the checkpoint's production diff: pointer Place, body Move (X 2.5 → 2 m),
live Turn (0 → −179.99995°), live Size (1 → 1.12954), Duplicate with a distinct selected identity,
off-floor refusal, then five Undo operations back to no history. Plan candidate polygons were
observed during Place, Move, Turn and Size. Local scratch evidence is
`/tmp/s17-plan-primitive-resume.log` and `/tmp/s17-native-box-*-preview.png`; it is not archived
S11 evidence. The runner checks Duplicate's new identity because a near-edge placement can
legitimately refuse the +0.5 m X/Z copy.

An additional resumed Chromium run confirmed 3D pointer Place for both a native box and the
verified `paris-salon-chair`; the saved chair entity retained the expected `assetId`. For the
native box, the 3D run also confirmed body Move, live Turn and live Size. The accepted placement
was near the Room edge, so its +0.5 m Duplicate was refused; this does not complete the 3D row.
These runs are local implementation evidence, not archived S11 evidence.

The S11 integrated gate also remains outstanding. Browser evidence above is implementation
evidence, not slice acceptance. The complete per-subject Place, body Move, Turn, Size, Duplicate
and Undo matrix has not been recorded in both Plan and 3D. The verified catalogue chair's
manipulation row and the upright native-form and approved creator-model matrices remain owed.
Required S11 integrated, coarse-pointer, native-touch and Safari evidence is also not claimed
here.
