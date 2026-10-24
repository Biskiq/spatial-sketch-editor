# T3.P02.S02 — acceptance record: Integrated final gate

**Slice:** T3.P02.S02 · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Implementation review:** [implementation-review.md](./implementation-review.md) · **Phase:** [T3.P02](../README.md) ·
**Hand-off:** [handoff.md](./handoff.md) ·
**Declared** `FINAL PHASE GATE` artifact of T3.P02

```text
STATUS:   evidence recorded; independent review passed at 6df26f3e; owner acceptance PENDING
REVISION: f6de016d measured (implementation 44990fad · Preview-chrome fix 035965e8 ·
          journey spec 6df26f3e · warm-Preview entry f6de016d) + review fix fffe1c5a verified,
          not re-measured by owner request
CLAIMS:   only the rows below, at that revision, on this machine
DOES NOT: mark the slice shipped, close P02/P03, or claim the owner's reference-machine rows
```

Authorization: [post-Batch-E owner release](../../../../reference/decisions/post-batch-e-authorization-2026-10-23.md).
This record is written before the owner's acceptance by explicit instruction ("stop for my
acceptance"). It therefore records evidence and outstanding gaps and **claims no acceptance**.

**Owner request (2026-10-23): do not re-run the F10/F13 perf pass.** The review fixes below landed
after the perf measurement, so the performance rows are recorded at `f6de016d` and are **not**
re-measured at the review-fix revision. In place of a re-measure the owner asked for a self review
and sanity check: the correctness lanes were re-run after the fixes (type check, full suite, arch,
heavy, integrated journeys), the fix was read hunk by hunk, and the two perf rows that a stopped
run had already produced after the fixes are noted below as partial-only evidence, never as the
record's numbers.

## Independent review

Independent, read-only review passes read the change as one diff: two for the slice, then two more
(taken from opposite directions) for the warm-Preview entry, each re-reviewing the previous fix.
Findings and resolutions are recorded in the [implementation review](./implementation-review.md#independent-review).
No finding remains open. The slice round fixed the orphan-Stop refusal, the duplicate Capture control,
the `openPreview` catch scope, the mounted authoring chrome during Preview and the refused-return
recovery, and narrowed two journey-spec overclaims. The warm-entry round found a real one: a source
replacement kept the old warm surface — and its replaced scene, geometry and program — alive behind
the editor, and an in-flight warm-up could install a replaced snapshot's read. `activate` now drops
the surface with the source and `warmPreview` rechecks the session and the snapshot after its import.
Focus-on-return, one stale spec comment and one overstated sentence in this record were also fixed.

## Environment

```text
machine    MacBook Air M2, 8 cores, 16 GiB, Darwin 24.6.0, node v26.7.0
browser    Chromium 153.0.8010.12 (Playwright project `chromium`)
power      battery, discharging, agent-run — the owner-operated reference pass is still owed
network    N1 (broadband; CDP 40 ms / 2.5 Mbps down / 625 kbps up)
viewport   1920×1080 CSS at DPR 1 (journeys add a 900×700 reduced-motion row)
fixtures   starter "Enclosed room" gallery; no seeded authored project
reduced    default no-preference; one journey row sets prefers-reduced-motion: reduce
input      fine pointer, mouse; keyboard only for the documented continue key
```

## Verification record

Run at revision `f6de016d` for the F10/F13 rows, and re-run after the review-fix commit for every
correctness lane below (type check, full suite, heavy, integrated journeys), so the fixes are covered
even though the perf rows are not re-measured. The earlier `6df26f3e` rows were re-established rather
than carried over. The arch lane passes; its documentation-references contract has a 5 s timeout and
failed three times while unrelated host load averaged 70, then passed 56/56 in 4.1 s with a raised
timeout and reported no broken links — a host-load artifact, recorded rather than hidden.

| Check | Command | Result |
| --- | --- | --- |
| Editor type/diagnostics | `npm run check` | 0 errors, 0 warnings |
| Complete editor suite | `npm test` | 185 files, 2 396 tests passed, exit 0 |
| Architecture lane (unconditional) | `npm run test:arch` | 22 files, 176 tests passed |
| Heavy correctness lane | `npm run test:heavy` | 9 files, 125 tests passed |
| Root build | `npm run build` | succeeded |
| Shared package checks | `npm run check:project-model`, `check:camera-core`, `check:layout-core` | all clean |
| API type check | `npm run check:api` | clean |
| DB-backed API suites | `npm run test:api` | **95 tests, 0 failures, 0 skips**, exit 0 |
| Bundle provenance / lazy delivery | `BUNDLE_PROVENANCE=1 npx vite build --sourcemap` + `node perf/bundle-report.mjs --provenance … --forbid '/project/[projectId]/spatial=src/lib/visitor/VisitorPreviewSurface' --forbid '/p/[publicationId]=src/lib/authoring/'` | exit 0; both forbids 0 hits; spatial first-load 31 files, 1 735 264 B raw / 488 653 B gzip / 413 693 B br |
| Bundle-report self-test | `node --test apps/editor/perf/bundle-report.test.mjs` | 2 passed |
| Integrated journeys | `npx playwright test --config perf/playwright.config.ts integrated-journeys --project=chromium` | 5 passed, 48.6 s, exit 0 |
| F10 + F13 | `npx playwright test --config perf/playwright.config.ts preview-lifecycle --project=chromium` | 3 passed, 10.2 min, exit 0 |

**DB target and cleanup.** Docker was unavailable on this host, so the API run used a **lane-owned**
local PostgreSQL 17 cluster at `/tmp/biskiq-t3-pg` on port 5435 (database `biskiq`, role `biskiq`),
migrated from this revision and removed afterwards. The shared Compose stack was never started,
reset or migrated.

**Full-suite note (reported, not waived).** Two host-load-sensitive contracts were observed failing
only while the suite shared the machine with a Playwright perf run:
`P23B.11 S2 — nonce locality of the frozen row` at its fixed 5 000 ms timeout (5 046 ms and 5 380 ms
at load average ≈ 58) and `scene-editing-surface › keeps typed Place armed …` with the harness's own
"the fixture did not settle" after 355 ms. Both pass on their own (P23B.11 in 1.5 s; the scene file
41/41 tests, twice, back to back). No lane, test, timeout or assertion was changed, and the quiet-host
run at this revision passed the whole suite: **185 files, 2 396 tests**, with the arch lane (22 files,
176 tests) and heavy lane (9 files, 125 tests) green beside it. The flakes are environmental and are
recorded rather than hidden; a PR gate on a loaded machine may see them again for the same reason.

## Acceptance matrix

Rows follow the [plan](./implementation-plan.md#integrated-acceptance-matrix). "Browser" means a
Playwright journey on the shipped route at this revision. Unrun rows are not implied by a unit test.

| Journey / invariant | Result at this revision |
| --- | --- |
| Empty Experience → Capture → Guide-free Presentation → Preview → return | **Met (browser + unit).** Journey 1: one accepted result; no Guide/Stop; visitor lists the Presentation; Preview mounts no authoring surface, dock, Head, Index or Stage actions; accepted-result count unchanged while previewing; exit returns (`outcome: returned`) with the Presentation still selected and one Undo removing exactly the capture. Camera ticket laws in `preview-handover.test.ts`. |
| First Guide from capture; from existing Presentation or Stop | **Met for creation, Undo/Redo and entry; Save/reload not exercised in a browser.** `first-guide.test.ts` (7 contracts) + journeys 2–3: one accepted install, explicit entry Guide, one-step Undo removes all four units, Redo replays ids, second Guide refused, missing Default View / duplicate id / orphan Stop refused with no history. |
| One Presentation reused at two distinct Stops | **Met (browser + unit).** Journey 3: two stops over one Presentation, holds 0 s/2 s stay occurrence-local, reorder keeps identities; card proves one View and the Camera unit is byte-identical in the planner test. |
| Cut Guide and supported existing Travel | **Cut met; Travel/unsupported-reach browser row unrun.** Interpreter and `travel-gap.test.ts` prove Cut never creates topology and an unsupported Travel is reported, not silently converted; browser journeys use Cut only. |
| Presentation detour during a Guide; repeated Stop visit | **Interpreter-level only; browser row unrun.** `experience-runtime.test.ts` (suspends at the left Stop, explicit Resume, Continue does not resume, repeated stop gets a fresh occurrence). |
| Two Experiences over one world | **Partially met.** Journey 4: switching keeps identity and Preview lowers the focused Experience; "explains shared-Camera reach" is not exercised. |
| Capture/Update/Exit; Ask Rule; paused editing; lens wiring | **Capture/Update/Exit and lens wiring met (browser). Ask Rule and Experience paused editing unrun** — no Ask Rule implementation exists in `src/`, and paused editing has only Layout-level tests. Post-fix lens wiring: dock exists only in the Experience lens, no Preview entry from another lens. |
| History, conditional Save/conflict, download/reload remote | **Partly met outside a browser.** One history across domains and no-entry refusals are covered by the experience suites and journeys; `save-state.test.ts`, `head-save-journey.test.ts` (DOM mount, conflict + reload) and the DB-backed Save suites cover conditional Save/conflict with 0 skips. A browser download → reload-remote journey was **not** run. |
| Ownership races and teardown | **Met (unit + browser).** `preview-handover.test.ts` proves unowned-output refusal, repeated entry, source-change abandonment, and stale cancel/return cannot reclaim or clear a newer owner; journey 1 proves Preview writes no source; the host re-acquires on a refused return. The kept-warm surface holds no claim once returned: it is hidden, inert and on-demand, and F13 asserts exactly one such surface per cycle rather than a new one per entry. **The plan's "exit after source/project replacement" probe is unrun in a browser**: the host's replacement path is covered by review and by `spatial-route-source-replacement.test.ts` for the Stage, but no journey enters Preview and then replaces the source. The warm-surface drop on replacement is therefore code-reviewed, not browser-proven. |
| Dense discovery/orientation (20/50 Views, 15/30 Stops) | **Unrun.** No such fixtures exist in the tree; this is not a product limit claim. |
| Accessibility/isolation | **Partly met.** Arch suites prove visitor/public/Preview chunk boundaries and editor-free visitor modules; journey 1 proves no authoring chrome mounts in Preview; journey 5 proves 900×700 + reduced-motion entry, the documented continue key and exit. **Touch/coarse-pointer and DOM reach/Info-without-raycast rows are unrun.** |

## Performance evidence (pre-flight, not hard-gate)

Harness `.perf` (owner-ratified on-demand workflow), one browser, 1 warm-up + 10 runs per cache state,
Chromium only, commit `f6de016d` recorded in each report. Raw JSON stays outside Git (the run wrote to
the harness's temp results directory); no number below is a reference-machine result. **These rows
predate the review-fix commit** and were not re-measured, by owner request; the review fixes sit on
the warm-up and replacement paths those rows exercise, so the numbers describe `f6de016d` exactly and
are carried forward as such, not as measurements of the newer commit. A stopped run did produce two
post-fix rows — S first entry 47.8 ms, S warm 44.7 ms — but two rows are not evidence and are not
used here.

```text
F10  press → first rendering opportunity of the run (median / p95, 10 runs per row)
  S  cold 67.7 / 113.0 ms · warm 52.7 / 71.8 ms · repeat-use 55.0 / 173.7 ms
  M  cold 71.9 / 88.6 ms  · warm 44.0 / 54.8 ms · repeat-use 46.7 / 57.4 ms
F10  capture-accepted → preview:entered (same runs, the whole capture/bind/entry path)
  S  1122 / 1141 / 1157 ms · M  1227 / 986 / 1102 ms
F13  10 enter/exit cycles, one application lifetime, repeat-use
     entry heap 9.54 MiB · final 11.71 MiB · post-GC growth 2.16 MiB (≤ 5 MiB hard) ·
     dwell median 1 206 ms · exactly one visitor surface per cycle, hidden between them ·
     no page errors, no THREE/shader console errors
```

**What the entry row now says.** Entering Preview no longer builds the surface: the chunk, renderer
and scene are built when the Experience lens opens and are hidden, inert and on-demand between
sessions, keyed to the entry's Camera epoch. The press path therefore no longer creates the chunk,
renderer or scene; it starts the run and, when the entry's read differs from the one the surface was
built from (as the F10 rows' own capture makes it), re-adapts the room and wall shells. The row above
is what that costs on this host. Against the ambition for a warm Preview (≤ 50 ms repeat entry,
≤ 300 ms cold entry) the M repeat-use row meets it (46.7 ms), the S repeat-use row is 5 ms outside it
(55.0 ms median, one 264 ms outlier in the ten samples), and both first-entry rows are well inside the
300 ms cold target (67.7 / 71.9 ms). The floor is the measurement, not the work: the mark is taken at
the second rendering opportunity after the run starts, which is 33 ms at 60 Hz, so a repeat entry
cannot read below that on this harness even with zero work.

**The hard row is still not a traced frame.** The
[performance contract](../../../../reference/components/performance.md) hard row is "Preview entry
first frame" with a trace/first-frame attribution; this harness ends at a rendering opportunity, so
the row above is evidence *towards* the budget, not the contract's own method. Capture/bind result
completion ≤ 100 ms is not measured at all. **Both remain recorded gaps, not passes**, and require
the owner's reference-machine run and the standing trace-method ruling; no number here is relabelled
as the H0 trace row.

**No before/after delta is claimed.** The harness gained its press → frame row with this change, so it
has no pre-change measurement of the same row; the improvement is the current measurement plus the
code fact that the press path no longer creates the surface, not a measured comparison.

The Stage initial-load **delta** is likewise not claimed: the provenance build records the spatial
route's first-load set at this revision (31 files; 477 KiB gzip), but no same-configuration baseline
exists to subtract, and S01 recorded none.

## Owner disposition required

1. Accept or reject this record as the phase's final-gate evidence (the slice is **not** accepted
   here; registers and baton are untouched and closeout has not run).
2. Decide the F10 hard-row gap: the entry row is now measured as a rendering opportunity
   (55 / 47 ms repeat-use, 68 / 72 ms cold) but not as a traced first frame, and capture/bind result
   completion is still unmeasured. Either an owner-operated reference run with a method that
   attributes the first presented frame (and the standing H0 trace-method ruling), or an explicit
   written disposition.
3. Rule on the unrun matrix rows above (the Preview-then-replacement probe, dense 20/50-View and
   15/30-Stop fixtures, touch/coarse pointer, DOM reach/Info without raycast, Experience paused
   editing, Ask Rule, a browser Save/download/reload journey). None is claimed as passing.

## Dependencies and shared files

No new dependency, no API route and no format change. `packages/project-model/src/units/planning.ts`
is additive (new `experience-guide-create` planner, new `firstGuide` capture payload) and touches no
T2 staging grant. The Stage host patch is the bounded Capture/Guide dock, the Preview handover/return
wiring, the Preview chrome guard and the warm visitor surface (built at lens open, hidden between
sessions, run identity by Camera epoch); it changes no facade contract, adds no host authority, and
is offered for T1 review. The visitor surface and Camera director gain only an epoch prop and activity
flag. Perf work changes the F10/F13 flow rows and adds no shared harness, fixture or lane file.

## Closeout

Not performed. This is the phase's declared final gate, so an accepted record would make P02
**closable**, not closed; P02, P03 and the track registers are unchanged, and no phase-close,
track-completion or cycle event is created here.
