# T3.P02.S02 — acceptance record: Integrated final gate

**Slice:** T3.P02.S02 · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Implementation review:** [implementation-review.md](./implementation-review.md) · **Phase:** [T3.P02](../README.md) ·
**Hand-off:** [handoff.md](./handoff.md) ·
**Declared** `FINAL PHASE GATE` artifact of T3.P02

```text
STATUS:   ACCEPTED 2026-10-24 as owner-override (not reviewed) at merged revision 335820d6; SHIPPED by
          slice-closeout (see Closeout); performance and unrun rows DEFERRED by owner ruling (2026-10-24)
REVISION: merge bf6b2e1f (origin/main 0b96c577 merged into the branch) plus the round-4 fix commit 335820d6;
          the gate ran on that working tree
CLAIMS:   only the rows below, at that revision, on this machine
DOES NOT: close P02 or P03, claim the owner's reference-machine rows, or claim any deferred row as passing
```

Authorization: [post-Batch-E owner release](../../../../reference/decisions/post-batch-e-authorization-2026-10-23.md).
This record is written before the owner's acceptance by explicit instruction ("stop for my
acceptance"). It therefore records evidence and gaps and **claims no acceptance**.

**Owner request (2026-10-23): do not re-run the F10/F13 perf pass.** The round-4 fixes sit after the
performance measurement, so the performance rows stay recorded at `f6de016d` and are **not**
re-measured. The round-4 F5 spec change is not run either. See the
[owner ruling (2026-10-24)](#owner-ruling--performance-and-unrun-rows-deferred-2026-10-24).

## Independent review

Independent, read-only review passes read the change as one diff: two for the slice, then two more
(taken from opposite directions) for the warm-Preview entry, each re-reviewing the previous fix. Findings
and resolutions are recorded in the [implementation review](./implementation-review.md).
Round 4 is the owner's acceptance-review pass; its findings F1–F5 and their resolutions are in the
[implementation review, round 4](./implementation-review.md).

Round 4 found: a hidden warm Preview surface kept rendering and running (F1, fixed and now asserted by a
browser zero-draw check); the Guide key hid the Presentation's facts and its hint was false (F2, fixed,
with a browser assertion); refusal contracts claimed but untested (F3, fixed, four unit contracts plus
one more); the branch was not gated on then-current main (F4, merged and gated); and the performance
workload was not the labelled fixture (F5, the spec now seeds fixtures; the recorded rows are relabelled).

## Environment

```text
machine    MacBook Air M2, 8 cores, 16 GiB, Darwin 24.6.0, node v26.7.0
browser    Chromium 153.0.8010.12 (Playwright project `chromium`)
power      battery, discharging, agent-run — the owner-operated reference pass is still owed
network    N1 (broadband; CDP 40 ms / 2.5 Mbps down / 625 kbps up)
viewport   1920×1080 CSS at DPR 1 (journeys add a 900×700 reduced-motion row)
fixtures   starter "Enclosed room" gallery in the journeys; seeded S and M fixtures in the F10 spec (F5)
reduced    default no-preference; one journey row sets prefers-reduced-motion: reduce
input      fine pointer, mouse; keyboard only for the documented continue key
```

## Verification record

Merged revision `bf6b2e1f` plus the round-4 fix commit (one working tree). The full-suite run and the
lanes below were run sequentially, one heavy lane at a time, each after the host 1-minute load dropped
to 16 or below. Load was about 58 during the first `npm test`.

| Check | Command | Result at the merged revision |
| --- | --- | --- |
| Editor type/diagnostics | `npm run check` | 1825 files, 0 errors, 0 warnings (run twice: once in the gate, once after the F5 spec edit) |
| Complete editor suite | `npm test` | 185 files; **2403 passed, 2 failed** of 2405, exit 1. Both failures are 5 000 ms test timeouts under host load ~58: `tests/docs/documentation-references.test.ts` and `tests/lib/layout/p23b11-correspondence-reference.test.ts` (P23B.11 S2 nonce locality). Both were rerun **in isolation** and pass: documentation references **25/25**, P23B.11 **36/36**. No timeout, test or lane was changed. The full suite was not re-run as a whole. |
| Architecture lane (unconditional) | `npm run test:arch` | 22 files, **178 tests passed**, exit 0 |
| Heavy correctness lane | `npm run test:heavy` | 9 files, **125 tests passed**, exit 0 |
| Root build | `npm run build` | succeeded, exit 0 |
| Shared package checks | `npm run check:project-model`, `check:camera-core`, `check:layout-core` | all exit 0 |
| API type check | `npm run check:api` | exit 0 (tsc, no errors) |
| DB-backed API suites | `npm run test:api:stack` (see DB target) | 12 suites, **95 tests, 95 passed, 0 failed, 0 skipped, 0 todo** (counts summed from the node test summary lines, exit 0) |
| Integrated journeys | `npx playwright test --config perf/playwright.config.ts integrated-journeys --project=chromium` (against the documented preview on 127.0.0.1:4173) | **6 passed**, 49.2 s, exit 0 |
| Focused unit: first Guide | `npx vitest run tests/lib/experience/first-guide.test.ts` | 12 passed (7 existing and 5 new refusal contracts) |
| Focused unit: visitor director | `npx vitest run tests/lib/visitor/visitor-camera-director.test.ts` | 9 passed (7 existing and 2 new inactive-director contracts) |
| Preview lifecycle (F10/F13) | `npx playwright test --config perf/playwright.config.ts preview-lifecycle --list` | lists 6 tests after the F5 change; **not run** (owner request: no perf pass) |

**DB target and cleanup.** The API run used a lane-owned Compose stack, `BISKIQ_STACK=biskiq-t3`,
`BISKIQ_DB_PORT=5435`, `BISKIQ_API_PORT=8789` (Postgres 16-alpine, container `biskiq-t3-db-1`, the
stack's own volume `biskiq-t3_pgdata`). `/health/ready` returned 200 before the suite ran. The stack was
torn down with `npm run stack:reset` (`docker compose down --volumes`) and a check then found zero
`biskiq-t3` containers and zero `biskiq-t3` volumes. The `biskiq`, `biskiq-t1` and `biskiq-t2` stacks
were never started, reset or migrated.

**Two earlier API attempts, recorded.** The first `stack:up` failed because the migrate container
refused to start: `R2_OBJECT_NAMESPACE is required`. This worktree's git-ignored `.env` predated that
key, so the documented example value `R2_OBJECT_NAMESPACE=local` (from `.env.example`) was appended to
it. A runner bug in that first attempt reported the API lane as green although the suite never ran; the
count above is from the clean rerun, read from the suite's own summary lines.

**Full-suite note (reported, not waived).** The two timeouts above are host-load sensitive and were run
in isolation as stated. The earlier round-3 record also noted two flakes under load; this run's failures
are the same class.

## Acceptance matrix

Rows follow the integrated acceptance matrix of the [plan](./implementation-plan.md), a closed stub whose text is preserved at its recovery anchor. "Browser" means a
Playwright journey on the shipped route at the merged revision. Rows marked **deferred by owner ruling**
are named in the [owner ruling](#owner-ruling--performance-and-unrun-rows-deferred-2026-10-24); they are
not claimed as passing.

| Journey / invariant | Result at the merged revision |
| --- | --- |
| Empty Experience → Capture → Guide-free Presentation → Preview → return | **Met (browser + unit).** Journey 1: one accepted result; no Guide/Stop; visitor lists the Presentation; Preview mounts no authoring surface, dock, Head, Index or Stage actions; accepted-result count unchanged while previewing; exit returns (`outcome: returned`) with the Presentation still selected and one Undo removing exactly the capture. Camera ticket laws in `preview-handover.test.ts`. |
| First Guide from capture; from existing Presentation or Stop | **Met for creation, Undo/Redo, entry and refusals; Save/reload not exercised in a browser.** `first-guide.test.ts` (12 contracts) + journeys 2–3: one accepted install, explicit entry Guide, one-step Undo removes all four units, Redo replays ids. Refusals (planner-rejected with the planner's reason and no history or source change): second Guide, missing Default View, duplicate captured identity, orphan Stop, a continuation to a Stop the Experience does not carry, a negative hold, a first Guide when a Guide exists, a capture naming both an existing and a first Guide, and a first Guide with an earlier Stop to follow. |
| One Presentation reused at two distinct Stops | **Met (browser + unit).** Journey 3: two Stops over one Presentation, holds 0 s/2 s stay occurrence-local, reorder keeps identities; the card proves one View and the Camera unit is byte-identical in the planner test. |
| Cut Guide and supported existing Travel | **Cut met (unit and browser). The Travel/unsupported-reach browser rows are deferred by owner ruling.** `travel-gap.test.ts` proves Cut never creates topology and an unsupported Travel is reported, not silently converted; browser journeys use Cut only. |
| Presentation detour during a Guide; repeated Stop visit | **Interpreter-level only. The browser rows are deferred by owner ruling.** `experience-runtime.test.ts` covers suspension at the left Stop, explicit Resume, Continue not resuming, and a fresh occurrence on a repeated Stop. |
| Two Experiences over one world | **Partially met; the partial row is deferred by owner ruling.** Journey 4: switching keeps identity and Preview lowers the focused Experience. "Explains shared-Camera reach" is not exercised. |
| Capture/Update/Exit; Ask Rule; paused editing; lens wiring | **Capture/Update/Exit and lens wiring met (browser).** Journey 6 now also proves that closing the Guide key leaves the Presentations column and its facts in the lens, with the closed hint. **Ask Rule and Experience paused editing: deferred by owner ruling** (no Ask Rule implementation exists in `src/`; paused editing has only Layout-level tests). |
| History, conditional Save/conflict, download/reload remote | **Partly met outside a browser.** One history across domains and no-entry refusals are covered by the experience suites and journeys; `save-state.test.ts`, `head-save-journey.test.ts` and the DB-backed Save suites cover conditional Save/conflict with 0 skips. **The browser Save/download/reload journey: deferred by owner ruling.** |
| Ownership races and teardown | **Met (unit + browser).** `preview-handover.test.ts` proves unowned-output refusal, repeated entry, source-change abandonment, and stale cancel/return cannot reclaim or clear a newer owner; journey 1 proves Preview writes no source; the host re-acquires on a refused return. **Hidden warm surface (round-4 F1): met in the browser.** After a Preview exit, the hidden visitor canvas issues **zero** WebGL draw calls over 1 s after two rendering opportunities (journey 2), and a re-entry draws again (the same journey's positive control). While hidden, the director is inactive and does not tick the run (`visitor-camera-director.test.ts`). **The Preview-then-source-replacement probe: deferred by owner ruling** (the replacement path is covered by review and by `spatial-route-source-replacement.test.ts` for the Stage; the warm-surface drop on replacement is code-reviewed, not browser-proven). |
| Dense discovery/orientation (20/50 Views, 15/30 Stops) | **Deferred by owner ruling.** No such fixtures exist in the tree; this is not a product limit claim. |
| Accessibility/isolation | **Partly met.** Arch suites prove visitor/public/Preview chunk boundaries and editor-free visitor modules; journey 1 proves no authoring chrome mounts in Preview; journey 5 proves 900×700 + reduced-motion entry, the documented continue key and exit. Round-4 F2: the Guide key now scopes to the Guides column; Presentation facts stay visible and the closed hint is truthful (journey 6). **Presentation/Stop facts stay in the Experience lens inspector, not the host Card: the host `EditorCard` has no Experience contribution seam.** That is a deferred T1 seam, reported to T1; it is not claimed as Card-hosted. **Touch/coarse-pointer and DOM reach/Info-without-raycast rows: deferred by owner ruling.** |

## Performance evidence (pre-flight, not hard-gate)

Harness `.perf` (owner-ratified on-demand workflow), one browser, 1 warm-up + 10 runs per cache state,
Chromium only, commit `f6de016d` recorded in each report. Raw JSON stays outside Git. No number below is a
reference-machine result. **These rows predate the round-3 and round-4 fixes and were not re-measured**, by
owner request.

**Workload label correction (round 4, F5).** The F10 rows below were measured on the starter
"Enclosed room" gallery for **both** "S" and "M". The spec's `startExperienceProject(page, size)` used
`size` only in the project id, so the M rows measured the same scene as S. The rows are therefore relabelled
as the **starter enclosure workload**, for S and for M. **No M-workload F10 measurement exists.** The spec
now seeds its S and M workloads through `fixtureProject()` (the source-JSON path the drag flows use), so a
future run will measure what its label says; that spec change was not run by this slice (owner request).

```text
F10  press → first rendering opportunity of the run (median / p95, 10 runs per row)
  starter enclosure, labelled "S"  cold 67.7 / 113.0 ms · warm 52.7 / 71.8 ms · repeat-use 55.0 / 173.7 ms
  starter enclosure, labelled "M"  cold 71.9 / 88.6 ms  · warm 44.0 / 54.8 ms · repeat-use 46.7 / 57.4 ms
  (both rows are the starter scene; neither is an M-workload measurement)
F10  capture-accepted → preview:entered (same runs, the whole capture/bind/entry path)
  starter enclosure, labelled "S" 1122 / 1141 / 1157 ms · labelled "M" 1227 / 986 / 1102 ms
F13  10 enter/exit cycles, one application lifetime, repeat-use
     entry heap 9.54 MiB · final 11.71 MiB · post-GC growth 2.16 MiB (≤ 5 MiB hard) ·
     dwell median 1 206 ms · exactly one visitor surface per cycle, hidden between them ·
     no page errors, no THREE/shader console errors
```

**What the entry row now says.** Entering Preview no longer builds the surface: the chunk, renderer
and scene are built when the Experience lens opens and are hidden, inert and on-demand between sessions,
keyed to the entry's Camera epoch. The press path therefore no longer creates the chunk, renderer or scene;
it starts the run and, when the entry's read differs from the one the surface was built from, re-adapts the
room and wall shells. Round 4 (F1) also stops the hidden surface from ticking or requesting frames; that is
the inactive-surface path after the `f6de016d` measurement, so it is not re-measured. The starter repeat-use
medians (55.0 ms, 46.7 ms) sit at or 5 ms above the ≤ 50 ms repeat-entry ambition; they are starter-workload
numbers, and no statement about the M project is made from them. The first-entry medians (67.7 / 71.9 ms)
are inside the ≤ 300 ms cold target on the starter workload. The floor is the measurement, not the work: the
mark is taken at the second rendering opportunity after the run starts, which is 33 ms at 60 Hz.

**The hard row is still not a traced frame.** The
[performance contract](../../../../reference/components/performance.md) hard row is "Preview entry
first frame" with a trace/first-frame attribution; this harness ends at a rendering opportunity. Capture/bind
result completion ≤ 100 ms is not measured at all. **Both remain recorded gaps, deferred by the owner ruling.**

**No before/after delta is claimed.** The harness gained its press → frame row with this change, so it has no
pre-change measurement of the same row. The Stage initial-load delta is likewise not claimed.

## Owner ruling — performance and unrun rows deferred (2026-10-24)

The owner ruled on the performance gate and the unrun rows: **"mark the performance deferred"**, and then
the unrun rows: defer all of them. This section records that ruling; it is the owner's decision, not a
claim of passing.

**Scope A — performance (deferred):**
- the F10 hard row (traced Preview first frame) and capture/bind result completion ≤ 100 ms;
- the absent M-workload F10 rows (the F10 rows are starter-workload only, per the F5 label correction);
- the F13 re-measure at the final revision;
- the owner reference-machine run and the H0 trace-method ruling;
- the Stage initial-load delta.

**Scope B — unrun rows (deferred):**
- the browser Preview-then-source-replacement probe (unit-covered only);
- dense 20/50-View and 15/30-Stop fixtures (none exist);
- touch/coarse pointer;
- DOM reach / Info without raycast;
- Experience paused editing;
- Ask Rule (no implementation exists);
- a browser Save/download/reload journey;
- the partial Two-Experiences "explains shared-Camera reach" row;
- the Travel/detour browser rows.

**Terms:**
- every item above is **deferred, not claimed and not waived as passing**;
- the existing performance rows stay as pre-flight evidence at `f6de016d`, labelled as above;
- the follow-up is a separate performance/scale exploration — new L/XL/realistic-L fixtures, per-phase
  profiling of the S→M project-open slope, and a contract tier amendment — **outside this slice**;
- because a gate row is deferred, **the slice can only be accepted as `owner-override`, not `reviewed`**.

## T1 review of the host patch (2026-10-24)

The plan requires T1 review of the bounded host patch before merge. Reviewed at `335820d6` as one diff
against `main` `0b96c577`: `routes/project/[projectId]/spatial/+page.svelte`,
`authoring/stage/camera-session.ts` and the `.lens-surface` placement.

- `CameraSession` gains `handOffToPreview` / `returnFromPreview` / `cancelPreview` / `previewTicket`.
  They mirror the landed `replaceInspection` / `returnInspection` / `cancelInspection` over the same F3
  `replaceCameraOutput` / `returnCameraOutput` / `cancelCameraOutput` calls. The output identity,
  session epoch and source revision are unchanged, and a source rebase clears both claims. This adds
  no host authority, no general shell API and no facade-contract change. **Approved.**
- Host wiring has three parts:
  - Preview entry resolves first, loads the chunk second and moves ownership last, rechecking the
    session token and facade after the await;
  - a refused return re-acquires the inspection claim;
  - the Head and Index are unmounted while Preview owns the output, and the Stage measure loop is
    guarded.

  This reads correctly, and no Stage intent can present against an output the Stage does not hold.
  **Approved.**
- The warm surface lifetime is dropped with its source on `activate`, and after round 4 it is idle while
  hidden (zero WebGL draws, browser-asserted). **Approved.**
- **Deferred T1 seam:** the host `EditorCard` exposes no Experience contribution seam, so Presentation
  and Stop facts stay in the Experience lens inspector. That is recorded, not built here.
- **Shared-file note:** PR #185 (T2.P02.S02) also edits `+page.svelte` and `VisitorPreviewSurface.svelte`.
  Whichever merges second merges `main` and reruns its gate.

## Acceptance (2026-10-24)

**Accepted as `owner-override`** at `335820d6` (merge `bf6b2e1f` of `main` `0b96c577` plus the round-4 fix).
The owner delegated acceptance, closeout and merge after re-review ("you authorize the close out and merge
after re-review and acceptable state"). The acceptance-review re-review (round 4) found F1–F5 resolved. The
evidence:

- F1 is asserted by the zero-draw journey with its positive control;
- F2 by the Guide-key journey;
- F3 by five refusal contracts;
- F4 by the merged-tree gate above;
- F5 by the corrected spec and relabelled rows.

`owner-override`, not `reviewed`, because the gate rows in the
[owner ruling](#owner-ruling--performance-and-unrun-rows-deferred-2026-10-24) are deferred rather than
met. Two further points on the full suite:

- it ran at 2403/2405, and both failures were 5 s timeouts under host load ≈ 58 that pass in isolation
  (25/25, 36/36). That is accepted on the same basis the owner ruled for T1.P02.S05 on 2026-10-23
  (affected files passing alone; no full-suite rerun), and is recorded here rather than claimed as a
  clean run;
- every other lane passed at this revision, including `test:api` 95/95 with 0 skips.

Accepting this record makes P02 **closable**, not closed.

## Owner disposition required

1. Accept or reject this record as the phase's final-gate evidence. **Accepted as `owner-override`**
   (2026-10-24) — see [Acceptance](#acceptance-2026-10-24).
2. Performance: **deferred by the [owner ruling (2026-10-24)](#owner-ruling--performance-and-unrun-rows-deferred-2026-10-24),
   Scope A.** No performance row is claimed as passing.
3. Unrun rows: **deferred by the same owner ruling, Scope B.** Also recorded for the owner's
   awareness: ordinary Presentation and Stop facts stay in the Experience lens inspector, because the
   host Card has no Experience contribution seam; this is a deferred T1 seam and is not claimed as
   Card-hosted (see [implementation review](./implementation-review.md)).

## Dependencies and shared files

No new dependency, no API route and no format change. `packages/project-model/src/units/planning.ts` is
additive (new `experience-guide-create` planner, new `firstGuide` capture payload) and touches no T2 staging
grant. The Stage host patch is the bounded Capture/Guide dock, the Preview handover/return wiring, the
Preview chrome guard and the warm visitor surface (built at lens open, hidden between sessions, run identity
by Camera epoch). The visitor surface and Camera director gain an epoch prop and an `active` flag (round 4),
which is the only change to the visitor files. Perf work changes the F10/F13 flow rows, and round 4 changes the
F10 spec's workload setup; neither adds a shared harness, fixture or lane file.

## Closeout (2026-10-24)

`slice-closeout` ran on this record as the phase's declared FINAL PHASE GATE. The slice is shipped and
T3.P02 is **closable, not closed**. No phase-close, track-completion or cycle event was created, P03 and
P04 are untouched, and the phase close remains an owner-invoked request.

What the closeout did, with no re-run of any check:

- the implementation plan, implementation review and hand-off were compacted to closed stubs
  (`AUTHORITY: NONE`) with exact Git recovery; this record stays live as the gate artifact;
- the phase README's S02 row is `shipped` and its PHASE CLOSE block reads `closable`;
- the T3 baton was rewritten (ACTIVE none); the T3 track README's Capture/Preview current-state cell and
  the roadmap README T3 row now match S02's acceptance;
- `docs/reference/components/camera-tour.md` records the landed Preview handover and warm surface.

Deferred residuals are named in the [owner ruling](#owner-ruling--performance-and-unrun-rows-deferred-2026-10-24)
and carried by the phase README and the T3 baton: 5 performance items (Scope A) and 9 unrun rows (Scope B).
None is claimed as passing.

```text
CLOSEOUT PRESERVATION — T3.P02.S02 (2026-10-24)
prose compacted:                 3   stubs at their own paths (implementation-plan, implementation-review, handoff)
reference promotions:            1   landed Preview handover and warm-surface behaviour → reference/components/camera-tour.md
renderable evidence archived:    0 files
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchor:               335820d6060302cac1e78b9c08c75f25f7605201 · tag closed/T3.P02.S02 (local only, not pushed)
                                 plan's last commit 6d87e25b is an ancestor of the tag
new live → archive prose links:  0
manual-owed verification rows:   deferred by owner ruling (Scope B); none claimed as passing
remaining deferred items:        5 performance (Scope A) + 9 unrun (Scope B)
permanent stubs added:           3
post-merge anchor verification:  PENDING — after the P1 merge commit of PR 184 on main:
                                   git merge-base --is-ancestor 335820d6060302cac1e78b9c08c75f25f7605201 main && echo "anchor reachable"
                                   git show 335820d6060302cac1e78b9c08c75f25f7605201:<stub path> | head -3
```

Closeout ran the documentation gate only (links, written paths and anchors). It is not a product lane and does
not replace the verification recorded above.
