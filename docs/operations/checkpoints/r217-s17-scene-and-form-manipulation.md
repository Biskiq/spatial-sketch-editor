# R217.S17 — checkpoint

IDENTITY: T1 · R217 · R217.S17
RESUME ROUTE: `docs/operations/t1-spatial-world/current.md` → [S17 implementation plan](../../roadmap/r217-core-editor-stability/r217.s17-scene-and-form-manipulation/implementation-plan.md) and [S17 acceptance record](../../roadmap/r217-core-editor-stability/r217.s17-scene-and-form-manipulation/acceptance.md)
TYPE: implementation · browser verification · PR review · slice closeout
STATUS: paused
GOAL: Finish approved S17 and the delivered P0–P2 repairs, verify the complete criteria, update PR #239, then hand routine closeout through merge to a fresh Luna 6 medium chat only as the final step. The owner prohibits re-review and polling.

CONSTRAINTS:
- Keep implementation within S17. API and Postgres are available, so the approved-model row cannot use the unavailable-service exception.
- Do not claim S17 acceptance while the approved Plan/3D matrix is incomplete.
- Owner amendment 2026-10-31: S11 is the final integration check after S25, not an S17 merge prerequisite. Preserve that schedule and all S11 evidence requirements. S17 own criteria and verification still precede final Luna closeout dispatch.
- The Sol findings were delivered. Fix and verify them without re-review, per the owner; do not poll review or closeout chats.
- The owner authorized one S16 edit only: fix its evidence pointer from ../../../archive to ../../../../archive. No S16 behavior or acceptance changes.
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
- Branch `codex/r217-s17-scene-and-form-manipulation` is based on `origin/main` `8a0474cf87a1e022c91f1705619fbbb19deb3ab3`. Catalogue admission is committed at `afb41b4f`; the delivered P2 repairs and current verification record are committed and pushed at `d0b4fa53`. PR #239 remains open against `main`.
- The current candidate admits only the salon chair (`paris-salon-chair`) after retained r186 GLTFLoader + Meshopt measurement. Contact is −5.2503e−12 m; outward-rounded footprint is 0.643 × 0.537 m after applying the 0.92 default scale once. The grandfather clock remains unverified and excluded.
- `npm run check` passed with 0 errors and 0 warnings. The current focused suite passed 3 files / 79 tests: Scene editing surface, catalogue model verification and object-definition policy.
- `npm run test:arch` had 22/23 files and 193/194 tests pass. Its only failure is the pre-existing S16 evidence pointer resolving under `docs/roadmap/archive/` instead of `docs/archive/`; no S16 file is in the S17 diff.
- A 1440×900 Chromium run completed the primitive Plan sequence: pointer Place; body Move from X 2.5 to 2 m; live Turn from 0 to −179.99995°; live Size from 1 to 1.12954; Duplicate with a distinct selected identity; off-floor refusal; and five Undo operations back to no history.
- Additional 3D browser evidence confirms native-box pointer Place, body Move, live Turn and live Size. Duplicate from the accepted right-edge placement was refused. A 3D pointer Place of the verified salon chair was saved and the project document retained `assetId: paris-salon-chair`.
- Earlier local evidence records partial native-form Turn/Size and approved creator-model Move/Turn/Size/Duplicate/Undo journeys in Plan and 3D. These do not satisfy the current complete per-subject matrix.
- The delivered Sol review thread is `01a19315-f6ee-7302-9eea-e42341a82c8d` (gpt-6.1-sol, high). It sent the two actionable P2 findings to parent task `Continue S17 checkpoints` (`01a19308-fbf9-7df0-bf33-2b12f72330a7`). The owner prohibits re-review; no post-fix clean verdict is claimed.
- Luna thread `01a19316-769d-76d3-8c39-dedb5d4563e6` was dispatched before implementation and acceptance verification finished. Do not poll or reuse it; the owner-directed post-acceptance closeout requires a new Luna thread.
- PR #239 body describes the verified chair, the P2 fixes, current verification and outstanding gates. GitHub reports the PR open with a clean merge state and no review decision; that does not satisfy S11.

EVIDENCE:
- PR #239: https://github.com/Biskiq/spatial-sketch-editor/pull/239
- Commits: `afb41b4f8fa44cb99ed60613b9c6b239e3e8e197` (verified chair metadata), `d0b4fa53` (P2 repairs and verification update).
- The S17 acceptance record is the current index for the local browser evidence and incomplete matrix.
- Earlier completed runs cleaned their disposable projects. The interrupted matrix run has unconfirmed cleanup. Scratch runners were recovered locally; see CURRENT before reuse.

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
- Parent chat owns coordination. No new review or premature closeout dispatch is authorized. Existing review and closeout chats are idle; use a **fresh Luna 6 medium chat only after S17 is clean**, and do not poll it.
- HEAD is `e516464b`; `d0b4fa53` contains the delivered model-contact/chooser repairs and primitive Move/Turn scale correction. The working tree adds visible unlit/outlined 3D ghosts (`StageCanvas.svelte`, `StageFormGhost.svelte`, new `StagePrimitiveGhost.svelte`) and tests for the owner's two ghost reports.
- Frozen candidate verification passed: `npm run check` (0 errors / 0 warnings), affected-subsystem 11 files / 190 tests. The authorized S16 pointer fix clears the architecture lane: 23 files / 194 tests. Logs: `/tmp/s17-final-candidate-check.log`, `/tmp/s17-final-candidate-tests.log`, `/tmp/s17-authorized-link-arch.log`.
- Active owned browser run: functions exec session `83596`, OS Node PID 38214 when checked, `apps/editor/tests/e2e/.s17-resume-run.ts`, output `/tmp/s17-final-browser-matrix.log`, disposable project `67713044-dbfb-416e-a61e-8986e64154e8`. Let it finish or explicitly clean that exact project if interrupted; do not start a competing browser. Source is frozen during this run.
- Current run has passed primitive 3D, catalogue 3D and approved creator-model Plan with Place, Move, Turn, Size, Duplicate, off-floor refusal and five Undo steps. Approved creator-model 3D is in progress; upright rectangular/concave forms in both readings follow. Read final results, not partial live captures, before claiming a row.
- The new post-Size Turn capture `/tmp/s17-primitive-3d-sized-turn-preview.png` visibly shows the enlarged ghost at −135° against the accepted −180° body. The post-Size Move capture hit an occluder, so a clear-target Move preview remains owed for that owner report despite green direct/adapter scale regressions.
- Earlier primitive Plan and catalogue Plan sequences passed all five actions and Undo; catalogue Plan also verified its arm through a Plan/3D flip. Those predate the new outline renderer and are implementation evidence, not final-scope acceptance.
- Remaining browser checks: complete the running subject matrix, tilted-form refusal in Plan/3D, four declared viewport sizes, and a valid post-Size Move ghost. Complete the automated implementation gate before final handoff; do not run S11 early.
- Owner amendment is recorded in S17 acceptance: **S11 stays after S25 and is not an S17 merge prerequisite**. Scheduling and S11 evidence remain unchanged. S16 mutation is limited to the one authorized link correction.
- Recovered scratch runners remain local and untracked. Preserve recovery copies outside the worktree before final commit rather than deleting the recovered work. Old failed/interrupted logs are not acceptance; current run cleans its exact project and any library items it creates.

VERIFICATION:
- Tier: S17 affected-subsystem. After the P2 repairs, `npm run check` passed with 0 errors / 0 warnings and the affected-subsystem run passed 11 files / 156 tests. The architecture lane was rerun and remains 22/23 files and 193/194 tests due to the unrelated S16 path.
- S11 remains due after S25; the owner explicitly clarified it is not an S17 pre-merge gate. The new renderer/scale fixes passed 11 files / 190 tests and `npm run check` with zero diagnostics; current browser verification remains in progress.

NEXT:
1. Finish S17 browser journeys from the recovered runner; choose visible supported targets and assert actual accepted changes, not only candidates.
2. Record current evidence and fix remaining in-scope defects. Honor the owner's no-re-review instruction; do not create another review chat.
3. Only after implementation and required verification are clean, create a fresh Luna 6 medium chat for routine closeout through merge, carrying any unresolved repository gate honestly; do not poll it.

OPEN:
- S17 acceptance matrix is incomplete.
- No S11 scheduling change is pending: retain its registered final integration slot after S25. Do not resurrect the superseded S17/S11 merge blocker.
