# R217.S03 — acceptance record: Stage interaction coordination

**Slice:** R217.S03 · **Status:** implementation in review; no acceptance recorded · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

The owner released S03 for implementation on 2026-10-28. Implementation, independent reviews and acceptance remain outstanding. The active investigation and its unresolved depth policy are recorded in the [T1 checkpoint](../../../operations/checkpoints/r217-s03.md).


## Owner ruling — 2026-10-29

For 3D cross-domain arbitration, a genuine finite forward ray–surface intersection
outranks a tolerance-only winner. Layout retains its 8 px eligibility and reports
`depthMeters: null` when the ray misses its finite pick surface; its interaction
`worldPoint` remains independent and must not be projected to fabricate a depth.
Finite depths use nearest distance and the planned tie rules; two null depths use
CSS distance then adapter ID. A sole tolerance winner remains selectable. This
clarifies cross-domain arbitration without changing domain priorities or occlusion.
The 400-sample differential and review evidence remain outstanding.


### Differential fixture investigation

The first Scene fixture omitted the Layout subtree registered by StageCanvas. At
3D CSS `[544, 450]`, its old picker chose `catalogue` and the new resolver chose
`wall-chain-3.r217-scene` interval `[5, 5.25]` (Wall depth 2.36878 m, model
depth 4.01730 m). This was a fixture artifact: after registering the canonical
Wall and Layout-object representations and the room floor/ceiling and ground
meshes, the PR #220 baseline and the new resolver both select that Wall, and the
Scene provider yields to the rendered Wall. The corrected 400-sample grid in
each reading for each of the three fixtures has zero winner differences. No
policy exception or domain-priority change is claimed. Full acceptance remains
outstanding.

## Verification prepared for review

Implementation commit `a78c8057fe5c9776a734c4301d9d5ae91183eb19`, based on trusted
`main` `8c2c86e638e65a4a0500fa1e3e15b647932549f7`; implementation tree
`9a77306fb5ff6fb6010976c55075c24885f87ec0`. The implementation/test tree is
unchanged by the documentation-only follow-up.

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
  The Scene provider remains subject to T2 review, form rays to T5, and Experience
  and Undo to T3. The owner directed that agent reviewers be skipped and will review
  the full change personally; no independent review or acceptance is claimed here.

S02 PR #221 is based on the same trusted main and is unmerged. Its shell and this
slice's route-handler edits must be integrated sequentially; whichever lands later
must rebase, resolve the shared files through their owners, and rerun the full merge
gate. This evidence is not a substitute for testing that later integrated tree.
