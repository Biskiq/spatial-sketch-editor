# R217.S03 — acceptance record: Stage interaction coordination

**Slice:** R217.S03 · **Status:** dedicated cross-domain review recorded; one P2 corrected; no acceptance recorded · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

The owner released S03 for implementation on 2026-10-28. A dedicated independent
cross-domain review on 2026-10-29 returned changes required with one P2, now
corrected; acceptance remains outstanding. The active investigation and the depth
policy ruling are recorded in the [T1 checkpoint](../../../operations/checkpoints/r217-s03.md).


## Owner ruling — 2026-10-29

For 3D cross-domain arbitration, a genuine finite forward ray–surface intersection
outranks a tolerance-only winner. Layout retains its 8 px eligibility and reports
`depthMeters: null` when the ray misses its finite pick surface; its interaction
`worldPoint` remains independent and must not be projected to fabricate a depth.
Finite depths use nearest distance and the planned tie rules; two null depths use
CSS distance then adapter ID. A sole tolerance winner remains selectable. This
clarifies cross-domain arbitration without changing domain priorities or occlusion.
At the ruling, the 400-sample differential and review evidence remained outstanding;
both are recorded below.


### Differential fixture investigation

The first Scene fixture omitted the Layout subtree registered by StageCanvas. At
3D CSS `[544, 450]`, its old picker chose `catalogue` and the new resolver chose
`wall-chain-3.r217-scene` interval `[5, 5.25]` (Wall depth 2.36878 m, model
depth 4.01730 m). This was a fixture artifact: after registering the canonical
Wall and Layout-object representations and the room floor/ceiling and ground
meshes, the PR #220 baseline and the new resolver both select that Wall, and the
Scene provider yields to the rendered Wall. The corrected 400-sample grid in
each reading for each of the three fixtures has zero winner differences. No
policy exception or domain-priority change is claimed. An independent reviewer
reproduced that corrected 2,400-sample baseline against the actual pre-S03
`8c2c86e6` code with zero baseline mismatch. Full acceptance remains outstanding.

## Verification prepared for review

Implementation commit `a78c8057fe5c9776a734c4301d9d5ae91183eb19` was prepared on
trusted `main` `8c2c86e638e65a4a0500fa1e3e15b647932549f7`; implementation tree
`9a77306fb5ff6fb6010976c55075c24885f87ec0`. The slice is now rebased onto `main`
`71100651` (S02, PR #221) and carries the correction for the review's one P2. The
full-suite and package evidence below belongs to that pre-integration tree; the
corrected, integrated tree is covered by the focused checks in the review section.

- Corrected recorded differential: all 400 samples for each of the starter, L and
  Scene fixtures in each reading match the full pre-S03 hit, and hover equals click.
  The Scene fixture exercises catalogue, primitive and native form hits and uses the
  same compiled Layout renderers as StageCanvas. The transient missing-registration
  scenario is a separate regression, not an acceptance exception.
- `npm test`: 235 files, 2,976 tests passed, including heavy correctness;
  `npm run test:arch`: 23 files, 191 tests passed; `npm run check`: zero errors and
  warnings; editor build passed. Layout, project-model, Camera, geometry-core and
  API type checks passed.
- `npm run test:api` used an isolated local Postgres database on the local Compose
  server: 122 tests passed, zero skipped. No production or shared project database
  was used. `git diff --check 8c2c86e6` passed before packaging.
- Mounted route tests cover Wall, Scene and navigation cancellation; second-pointer
  handoff, Ink-chain survival, live Undo reason, accepted-source Save, and hover.
  The review's interruption coverage for an in-progress Shape depth press is
  recorded in the review section below.

## Independent cross-domain review — 2026-10-29

Per the latest owner direction, one dedicated independent cross-domain review
replaces the repeated T2/T3/T5 review cycle and the personal full-change review for
this slice. Verdict: **changes required**, one P2. No other P0–P2 issue in picking,
Camera, keyboard, Experience, Undo/Save or ownership was established, and no
unresolved domain-policy decision remains: the finite-depth versus tolerance-only
ruling is implemented and tested.

- **P2 — an interrupted Shape depth press retained its candidate.** Window `blur`, a
  hidden page, `pointercancel`, lost capture and a second pointer reached the route's
  cancel path, and a reading flip reached the adapter's evaluation-mismatch path;
  none discarded what the partial drag had measured, so Create could commit it. The
  adapter now captures `depth`, `depthText`, `depthValid` and the refusal at pointer
  down, restores them and refreshes the candidate on `cancel` and on the mismatch a
  reading flip produces, and keeps the pulled depth on a normal pointer up. The open
  outline and proposal are preserved.
- Focused regression coverage: `shape-reading-adapter.test.ts` ("discards an
  interrupted depth press and keeps a completed one") and the mounted
  `spatial-route-gesture.test.ts` interruption cases, which assert the actual
  post-interruption Create extent. Both fail against the pre-correction adapter;
  the mounted case retains `1.8611111111111112` m.
- Focused verification of the correction: the eight affected suites pass (165
  tests), including `shape-reading-adapter.test.ts` (19) and
  `spatial-route-gesture.test.ts` (46); `npm run check` reports zero errors and
  warnings. The reviewed, unchanged branch had passed 9 focused suites / 113 tests,
  and a temporary merged-source snapshot passed 8 suites / 146 tests (gestures,
  Save/resume, replacement, differential, shell, native forms, Scene, Preview
  handover).
- Verification gap: real-browser multi-touch capture ordering is covered only by
  jsdom stubs; no browser capture trace was taken.

S02 shipped on `main` in PR #221 (`71100651`). S03 is rebased onto that integrated
tree, which is the tree the focused review checks above ran against. The full merge
gate and final integrated-tree verification still precede acceptance; per the owner's
direction they were not rerun for this routine correction, which is covered by the
focused regression checks instead.
