# T3.P02.S02 — acceptance record: Integrated final gate

**Slice:** T3.P02.S02 · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Implementation review:** [implementation-review.md](./implementation-review.md) · **Phase:** [T3.P02](../README.md) ·
**Declared** `FINAL PHASE GATE` artifact of T3.P02

```text
STATUS:   evidence recorded; independent review passed at 6df26f3e; owner acceptance PENDING
REVISION: 6df26f3e (implementation 44990fad · Preview-chrome fix 035965e8 · journey spec 6df26f3e)
CLAIMS:   only the rows below, at that revision, on this machine
DOES NOT: mark the slice shipped, close P02/P03, or claim the owner's reference-machine rows
```

Authorization: [post-Batch-E owner release](../../../../reference/decisions/post-batch-e-authorization-2026-10-23.md).
This record is written before the owner's acceptance by explicit instruction ("stop for my
acceptance"). It therefore records evidence and outstanding gaps and **claims no acceptance**.

## Independent review

Two independent, read-only review passes read the change as one diff; the second re-reviewed the
first's fixes. Findings and resolutions are recorded in the
[implementation review](./implementation-review.md#independent-review). No finding remains open:
the orphan-Stop refusal, the duplicate Capture control, the `openPreview` catch scope, the mounted
authoring chrome during Preview and the refused-return recovery were all fixed in this revision;
the two journey-spec overclaims were narrowed to what the assertions prove.

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

Run at revision `6df26f3e` unless stated. Full-lane runs were repeated after the last production edit.

| Check | Command | Result |
| --- | --- | --- |
| Editor type/diagnostics | `npm run check` | 0 errors, 0 warnings |
| Complete editor suite | `npm test` | 185 files, 2 396 tests passed (see load note) |
| Architecture lane (unconditional) | `npm run test:arch` | 22 files, 176 tests passed |
| Heavy correctness lane | `npm run test:heavy` | 9 files, 125 tests passed |
| Root build | `npm run build` | succeeded; spatial route server entry 665.98 kB |
| Shared package checks | `npm run check:project-model`, `check:camera-core`, `check:layout-core` | all clean |
| API type check | `npm run check:api` | clean |
| DB-backed API suites | `npm run test:api` | **95 tests, 12 reports, 0 failures, 0 skips** |
| Bundle provenance / lazy delivery | `BUNDLE_PROVENANCE=1 npx vite build --sourcemap` + `node perf/bundle-report.mjs --provenance … --forbid '/project/[projectId]/spatial=src/lib/visitor/VisitorPreviewSurface' --forbid '/p/[publicationId]=src/lib/authoring/'` | exit 0; both forbids 0 hits; spatial first-load 31 files, 1 735 264 B raw / 488 653 B gzip / 413 693 B br |
| Bundle-report self-test | `node --test apps/editor/perf/bundle-report.test.mjs` | 2 passed |
| Integrated journeys | `npx playwright test --config perf/playwright.config.ts integrated-journeys --project=chromium` | 5 passed |
| F10 + F13 | `npx playwright test --config perf/playwright.config.ts preview-lifecycle --project=chromium` | 3 passed, 9.7 min, exit 0 |

**DB target and cleanup.** Docker was unavailable on this host, so the API run used a **lane-owned**
local PostgreSQL 17 cluster at `/tmp/biskiq-t3-pg` on port 5435 (database `biskiq`, role `biskiq`),
migrated from this revision and removed afterwards. The shared Compose stack was never started,
reset or migrated.

**Full-suite note (reported, not waived).** After the final production edit, two full-suite runs
failed only `P23B.11 S2 — nonce locality of the frozen row` at its fixed 5 000 ms timeout (5 046 ms
and 5 380 ms) while host load average was ≈ 58 from unrelated processes; that contract passes alone
in 1.5 s, and its 36 tests pass when the file runs on its own. No lane, test or timeout was
changed. A third complete run on the quiet host passed: **185 files, 2 396 tests**, followed by the
whole arch lane (22 files, 176 tests). The flake is environmental and is recorded rather than
hidden; a PR gate on a loaded machine may see it again for the same reason.

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
| Ownership races and teardown | **Met (unit + browser).** `preview-handover.test.ts` proves unowned-output refusal, repeated entry, source-change abandonment, and stale cancel/return cannot reclaim or clear a newer owner; journey 1 proves Preview writes no source; the host re-acquires on a refused return. |
| Dense discovery/orientation (20/50 Views, 15/30 Stops) | **Unrun.** No such fixtures exist in the tree; this is not a product limit claim. |
| Accessibility/isolation | **Partly met.** Arch suites prove visitor/public/Preview chunk boundaries and editor-free visitor modules; journey 1 proves no authoring chrome mounts in Preview; journey 5 proves 900×700 + reduced-motion entry, the documented continue key and exit. **Touch/coarse-pointer and DOM reach/Info-without-raycast rows are unrun.** |

## Performance evidence (pre-flight, not hard-gate)

Harness `.perf` (owner-ratified on-demand workflow), one browser, 1 warm-up + 10 runs per cache state,
Chromium only, commit `6df26f3e` recorded in each report. Raw JSON stays outside Git in
`/tmp/t3-perf-full/`; no number below is a reference-machine result.

```text
F10 S  cold 1491 ms · warm 1283 ms · repeat-use 1033 ms   (median capture-accepted → preview:entered)
F10 M  cold 1887 ms · warm 1301 ms · repeat-use 1224 ms
F13    10 enter/exit cycles, one application lifetime, repeat-use
       entry heap 9.10 MiB · final 10.96 MiB · post-GC growth 1.86 MiB (≤ 5 MiB hard) ·
       dwell median 1 628 ms · realm (performance.timeOrigin) unchanged · Stage canvas 1 ·
       no page errors, no THREE/shader console errors
```

**F10 does not measure the contract's hard row.** The emitted metric starts at the accepted
capture/bind mark and ends at the Preview entry mark; the
[performance contract](../../../../reference/components/performance.md) hard row is "Preview entry
first frame" (≤ 300 ms repeat / ≤ 800 ms first use) plus capture/bind result completion ≤ 100 ms.
This harness has no trace/first-frame attribution for that row, and the plan forbids relabelling
H0/S01 tooling as this slice's benchmark. **The hard F10 row is therefore a recorded gap, not a
pass**, and requires the owner's reference-machine run and the trace-method ruling.

The Stage initial-load **delta** is likewise not claimed: the provenance build records the spatial
route's first-load set at this revision (31 files; 477 KiB gzip), but no same-configuration baseline
exists to subtract, and S01 recorded none.

## Owner disposition required

1. Accept or reject this record as the phase's final-gate evidence (the slice is **not** accepted
   here; registers and baton are untouched and closeout has not run).
2. Decide the F10 hard-row gap: an owner-operated reference run with a method that attributes the
   first presented frame (and the standing H0 trace-method ruling), or an explicit written
   disposition.
3. Rule on the unrun matrix rows above (dense 20/50-View and 15/30-Stop fixtures, touch/coarse
   pointer, DOM reach/Info without raycast, Experience paused editing, Ask Rule, a browser
   Save/download/reload journey). None is claimed as passing.

## Dependencies and shared files

No new dependency, no API route and no format change. `packages/project-model/src/units/planning.ts`
is additive (new `experience-guide-create` planner, new `firstGuide` capture payload) and touches no
T2 staging grant. The Stage host patch is the bounded Capture/Guide dock, the Preview handover/return
wiring and the Preview chrome guard; it changes no facade contract and is offered for T1 review. New
perf work is a new flow file only — no shared harness, fixture or lane file changed.

## Closeout

Not performed. This is the phase's declared final gate, so an accepted record would make P02
**closable**, not closed; P02, P03 and the track registers are unchanged, and no phase-close,
track-completion or cycle event is created here.
