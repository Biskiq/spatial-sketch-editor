# R217.S17 — checkpoint

IDENTITY: T1 · R217 · R217.S17
RESUME ROUTE: `docs/operations/t1-spatial-world/current.md` → [S17 implementation plan](../../roadmap/r217-core-editor-stability/r217.s17-scene-and-form-manipulation/implementation-plan.md) and [S17 acceptance record](../../roadmap/r217-core-editor-stability/r217.s17-scene-and-form-manipulation/acceptance.md)
TYPE: implementation · browser verification · PR review · slice closeout
STATUS: paused
GOAL: Finish approved S17, update PR #239, obtain a fresh P0–P2 review, fix actionable findings, then close out and merge only if all repository gates permit it.

CONSTRAINTS:
- Keep implementation within S17. API and Postgres are available, so the approved-model row cannot use the unavailable-service exception.
- Do not claim S17 acceptance while the approved Plan/3D matrix is incomplete.
- The test contract requires the exhaustive S11 gate before a one-slice implementation PR merges. S11 depends on accepted S01–S10 and S12–S25 and currently has no acceptance evidence. Do not merge or waive this gate without completing it or an explicit owner ruling.
- Do not poll or wait on the fresh reviewer. The Sol review was instructed to message the parent task directly with actionable P0–P2 findings only.
- Keep S16 outside scope. Its broken architecture-test evidence link is pre-existing and must not be edited here.
- The S17 plan now records a 2026-10-31 owner ruling: full manipulation applies to upright rectangular and concave forms; the tilted fixture retains its planner refusals. Verify that behavior before claiming acceptance.

READ:
- `docs/README.md`
- `docs/operations/t1-spatial-world/current.md`
- `docs/roadmap/r217-core-editor-stability/README.md`
- `docs/roadmap/r217-core-editor-stability/r217.s17-scene-and-form-manipulation/implementation-plan.md`
- `docs/roadmap/r217-core-editor-stability/r217.s17-scene-and-form-manipulation/acceptance.md`
- `docs/roadmap/r217-core-editor-stability/r217.s11-integrated-final-gate/implementation-plan.md`
- `docs/roadmap/r217-core-editor-stability/r217.s11-integrated-final-gate/acceptance.md`
- `apps/editor/tests/README.md`
- `.agents/skills/work-checkpoint/SKILL.md`

ESTABLISHED:
- Branch `codex/r217-s17-scene-and-form-manipulation` is based on `origin/main` `8a0474cf87a1e022c91f1705619fbbb19deb3ab3`. Commit `afb41b4f8fa44cb99ed60613b9c6b239e3e8e197` is pushed; PR #239 is open against `main` at that head.
- The current candidate admits only the salon chair (`paris-salon-chair`) after retained r186 GLTFLoader + Meshopt measurement. Contact is −5.2503e−12 m; outward-rounded footprint is 0.643 × 0.537 m after applying the 0.92 default scale once. The grandfather clock remains unverified and excluded.
- `npm run check` passed with 0 errors and 0 warnings. The current focused suite passed 3 files / 79 tests: Scene editing surface, catalogue model verification and object-definition policy.
- `npm run test:arch` had 22/23 files and 193/194 tests pass. Its only failure is the pre-existing S16 evidence pointer resolving under `docs/roadmap/archive/` instead of `docs/archive/`; no S16 file is in the S17 diff.
- A 1440×900 Chromium run completed the primitive Plan sequence: pointer Place; body Move from X 2.5 to 2 m; live Turn from 0 to −179.99995°; live Size from 1 to 1.12954; Duplicate with a distinct selected identity; off-floor refusal; and five Undo operations back to no history.
- Additional 3D browser evidence confirms native-box pointer Place, body Move, live Turn and live Size. Duplicate from the accepted right-edge placement was refused. A 3D pointer Place of the verified salon chair was saved and the project document retained `assetId: paris-salon-chair`.
- Earlier local evidence records partial native-form Turn/Size and approved creator-model Move/Turn/Size/Duplicate/Undo journeys in Plan and 3D. These do not satisfy the current complete per-subject matrix.
- The fresh Sol review thread is `01a19315-f6ee-7302-9eea-e42341a82c8d` (gpt-6.1-sol, high). It was instructed to send P0–P2 findings directly to parent task `Continue S17 checkpoints` (`01a19308-fbf9-7df0-bf33-2b12f72330a7`) and not to poll or comment on the PR.
- The fresh Luna closeout gate thread is `01a19316-769d-76d3-8c39-dedb5d4563e6` (gpt-6-luna, medium). It was told not to claim acceptance or merge through the unresolved S11 gate.
- PR #239 body now describes the verified chair, current evidence and outstanding gates. GitHub reports the PR open with a clean merge state and no review decision; that does not satisfy S11.

EVIDENCE:
- PR #239: https://github.com/Biskiq/spatial-sketch-editor/pull/239
- Commit: `afb41b4f8fa44cb99ed60613b9c6b239e3e8e197`
- The S17 acceptance record is the current index for the local browser evidence and incomplete matrix.
- Disposable browser projects were deleted after runs. Scratch `.s17-*` runners were removed from the worktree.

RULED OUT:
- A Place or manipulation candidate in 3D is a WebGL ghost, not a `[data-candidate-id]` DOM node. The stage overlay task marker exposes the live candidate world position.
- A 3D duplicate from the near-edge native-box placement can be refused because the +0.5 m copy is outside the Room floor; this is not a successful Duplicate.
- Off-floor Scene Move refusal is rendered on the active Move mark; confirm refusal text and unchanged Undo availability rather than expecting a refused candidate polygon.
- The S16 architecture-test link failure is outside S17 scope.

DO NOT REPEAT:
- Do not rerun `npm run check` or the current focused 79-test suite without product-code changes.
- Do not rerun the full architecture lane without a reason; its known unrelated S16 link failure is recorded.
- Do not repeat broad 3D screen-point scans that destabilized the scratch runner. The default camera's right-side supported point is too close to the Room edge for a 3D Duplicate.
- Do not treat the partial Plan primitive or 3D Place/Move/Turn/Size evidence as full S17 acceptance or the S11 gate.

CURRENT:
- The implementation, tests and evidence updates are committed and pushed; no tracked product-code diff remains. A separate `.s17-resume-run.ts` appeared under `apps/editor/tests/e2e/` after the handoff work began. It was not created or modified in this task and is left untouched for its owner to review.
- A separate `node .../.s17-resume-run.ts` process (PID 24279 when checked) is still running in the shared worktree. It has emitted partial live screenshots for 3D catalogue, 3D primitive and Plan approved-model cases. Do not start a competing browser run or treat those files as passes; inspect the process owner's final output and cleanup after it exits.
- The complete Plan/3D matrix remains owed for the verified catalogue chair, upright native forms, approved creator model, and the tilted-form refusal criterion. The S11 integrated, coarse-pointer, native-touch and Safari evidence is also owed.
- The task was not accepted or merged. No reviewer result has been polled; the Sol and Luna threads were dispatched asynchronously.

VERIFICATION:
- Tier: S17 affected-subsystem. `npm run check` and the focused 3-file / 79-test suite passed on the implementation tree that became commit `afb41b4f`; only documentation evidence was updated after those checks. The architecture lane remains partial at 22/23 files and 193/194 tests due to the unrelated S16 path.
- Merge gate: exhaustive R217.S11 acceptance is still required and absent.

NEXT:
1. Inspect the in-flight `.s17-resume-run.ts` result after it exits; record only cases whose assertions passed and verify its disposable project/library cleanup.
2. Act only on actionable P0–P2 findings delivered directly from the Sol review; fix within S17, verify impacted behavior and push an updated PR candidate.
3. Complete the remaining S17 Plan/3D journeys, then keep PR #239 open until the exhaustive S11 gate is accepted or the owner explicitly changes the merge prerequisite.

OPEN:
- S17 acceptance matrix is incomplete.
- S11 acceptance and prerequisite slices remain unresolved; an explicit owner ruling is required if the team wants to change the merge prerequisite instead of completing that gate.
