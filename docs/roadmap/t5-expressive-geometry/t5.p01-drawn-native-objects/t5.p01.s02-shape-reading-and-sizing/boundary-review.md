# T5.P01.S02 — coordinator T1/T2 boundary review

## Final re-review — 2026-10-28

**T1: PASS. T2: PASS. No open implementation findings.**

Reviewed and tested product head: `e28ed2e4f65c382af863fd9ac32b586db7f910ec`.
Trusted integrated main: `85e675a6a47243808069b6d91d635fcfd55c43d3`, preserved by merge
`687c04dec87e4f76e283a68e68a819b39831de4f`. Binary diff SHA-256 against that base:
`32a6cbaed443711949393487326e4a13842853d126e6c112acbf80a5f4bac99e`.
Reviewer: cross-track coordinator, without subagents. The fixes chat implemented and validated;
the coordinator independently reviewed the repair and final integration.

R1 is **resolved**. Settled Plan Height uses an explicit screen handle shared by overlay and
hit testing. Press captures the starting height and projection scale; move computes a full
per-axis source scale through the existing planner. 3D and the other axes retain their world-ray
behavior. Preview follows the candidate, release installs one history result, and cancel, occupied
lease refusal and source replacement preserve the existing Stage/F4 ownership. No new writer,
selection, history, Camera or authored format appears. The PR #214 integration retains its host,
Canvas, route, acceptance and harness changes alongside the Ink and task-owner fixes.

Coordinator verification: independently reran Shape outline, reading adapter, palette, Stage
facade, Stage acceptance host and Stage session: **6 files / 95 tests passed**. Inspected the
revision-stamped browser evidence and Plan Height screenshot, and the repair chat's command logs:
full editor correctness **229 files / 2,907 tests passed**; arch **23 / 188**; root check **0/0**;
root build passed; Layout/project-model/Camera package checks passed; API check/build passed;
DB-backed API **6 passed / 0 skipped**; integrated Chromium **3 specs passed**, with **21 passed
scenario rows and one intentional Preview-availability not-run**. Those results are for this
product revision and do not accept S03's exhaustive final gate. The raw evidence and command logs are now durably preserved with SHA-256 hashes in the S02
[evidence folder](./evidence/2026-10-28/final-head-e28ed2e4/README.md); the source run folder was
`/tmp/t5-p01-s02-validation.Cnv145`.

The implementation/integration review is clean. **The owner release-list gate remains unresolved**:
S02 is absent from `docs/roadmap/now.md` and its phase register remains proposed. Conditional
acceptance/closeout/merge authorization is recorded in the coordinator chat, but release must be
resolved explicitly before acceptance, compaction or merge. A new Luna/high closeout chat must
handle mechanical closeout after gates are satisfied; the fixes chat must not be reused.

The following initial review is retained as history; its blocked verdict is superseded by the
final re-review above. S03, S04 and suspended unmeasured performance carryovers remain unchanged.

## Initial review — superseded

Date: 2026-10-28. Reviewer: cross-track coordinator, without subagents.
Reviewed PR #215 head: `119b53057339218cdfb164e137553ee121b85a92`.
Product/test identity: unchanged since `86595afe`; subsequent changes are documentation and
browser artifacts. This review does not accept the slice or authorize merge.

## T1 — Stage, Ink and gesture ownership

**Verdict: PASS at the reviewed head, subject to integration revalidation.**

The declared `ink-readings-v1` capability contributes ordered domain-owned sessions to one Ink
task. Layout delegates pointer, hover, command keys, overlay and ghost phases; Scene owns Shape
meaning. No second accepted document, selection, history, renderer or Camera is introduced.
The shared Canvas renders the planner candidate's authored form through the existing evaluator.
The accepted-install task-owner fix clears the stale contributed owner, and task opening ends
no-task direct manipulation through `taskClosed`. The existing real-host regression proves lease
release and no scale/history commit on task takeover. Reading switches protect live Shape input;
cancel, task closure and binding disposal release the contributed session's leases.
The Card reopening patch keys on domain/subject identity, preserving same-subject dismissal.

## T2 — Scene adapter and intents

**Verdict: BLOCKED — finding R1.**

The Scene adapter uses existing `create-form` and `set-form-size` planners through the existing F4
host. Preview and commit share operation semantics, authored source stays in Scene, and the Card
remains the exact-value writer. No planner, codec, unit-format, Head or Save change is introduced.
The canonical-winding, scaled-resize baseline, typed-depth validity/recovery, upright Flip and
upright-in-Plan depth corrections are present with regressions. This does not clear the sizing
correctness finding below.

### R1 [P2] — advertised Height size ray cannot resize in Plan

Location: `apps/editor/src/lib/authoring/adapters/scene.adapter.ts:504`–`529` (ray calculation at
512–517); `scene/shape/ray.ts:30`–`31` explains the parallel-axis refusal.

Create and select a floor form, settle the Camera in Plan, and drag the advertised
`scene-form-size-1` Height marker upward by 80 CSS pixels. The down event is claimed, but the
vertical world sizing axis is parallel to the Plan camera ray. `axisTravelFromRay` returns null,
so no preview is produced and releasing the handle leaves `form.scale[1]` equal to 1. The UI
instead says to drag outward. The Shape-creation depth fix already handles this projection case,
but per-axis sizing does not. Provide a usable, consistently drawn/hit-tested Plan sizing gesture
for Height, retain one `set-form-size` history result, and cover cancel/refusal/stale transitions.
Preserve world-axis sizing for the axes that have real projected travel and for upright forms.

Evidence: a temporary regression using the production Layout/Scene adapters and F4 host explicitly
settled `reading: plan`, verified the marker and claimed press, observed no ghost, released the
pointer and failed `expect(form.scale[1]).toBeGreaterThan(1)` with actual value 1. The reproduction
is `/tmp/pr215-plan-height-probe.test.ts` in the coordinator's local session; fold its useful case
into the owned suite rather than committing the copied fixture wholesale.

## Verification and merge gates

- Independently reran the three existing Shape suites: **3 files / 25 tests passed**. The new
  boundary probe fails as described. No benchmark or browser launch was initiated by this review.
- Recorded S02 evidence: check/build clean, fast 193/2573, arch 23/188, affected 11/196, focused
  3/25 and Chromium 3 specs with 19 passed scenario rows and one deliberate Preview-unavailable
  row. Product/test identity matches `86595afe`; this is evidence for that base only.
- Fetched `origin/main` at `85e675a6a47243808069b6d91d635fcfd55c43d3` (PR #214). It changes
  shared `stage-facade`, `StageCanvas`, host acceptance, route and test/harness configuration.
  Integrate the current main and validate the complete declared gate on the resulting diff;
  an earlier feature-base run is not final integration evidence.
- The release list on both reviewed head and fetched main contains only T5.P01.S01. S02 is
  absent and remains proposed in its phase register. The user's conditional acceptance/closeout/
  merge authorization is recorded in the coordinator chat; a satisfied release gate is not yet
  evidenced. Do not invent or backdate release provenance, mark S02 shipped, compact its full
  evidence, or merge while R1/review/integration/release gates remain open.
- Apply the repository slice-closeout procedure only after clean re-review and resolved gates.
  Preserve P1 merge-commit ancestry, recovery anchors and tags; never squash or rebase-merge away
  preservation anchors. Mechanical closeout itself must change no product code.

## Preserved carryovers

T5.P01.S03 remains the outstanding exhaustive integrated final gate, including the non-V8 digest,
full browser/epoch matrix, cold reopen, My Objects cross-project journey, and owner walkthrough.
S04 remains separately unreleased. Wall-face drawing waits for T1's face-frame query. Suspended
performance rows remain unmeasured historical carryovers, never passes or mandatory benchmark runs.
No T5.P01 phase completion or closure is claimed.
