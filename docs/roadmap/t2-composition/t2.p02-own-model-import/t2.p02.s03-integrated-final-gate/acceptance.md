# T2.P02.S03 — acceptance record: Integrated final gate

**Slice:** T2.P02.S03 · **Status:** gate executed 2026-10-27 — **NOT ACCEPTED: two required rows are
blocked, one required scope line is unreachable, one hard delivery row misses** · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:** [T2.P02](../README.md) ·
**Declared** `FINAL PHASE GATE` artifact of T2.P02

This record exists so the gate's result is reviewable. It claims **no acceptance verdict**, no phase
close, no track completion and no gate state. The phase stays `active` and cannot become `closable`
from this result: the creator journey the phase promises ("places, moves, turns, resizes, duplicates
and deletes it") is not reachable end to end in the shipped product, the plan's "from an empty
project" line cannot be completed at all, and the delivery budget misses. All three are owner
decisions, not defects this slice may absorb.

## Verdict summary

| Line | Result |
| --- | --- |
| Complete repository verification contract | **passed** (see table) |
| Import one own GLB with its maps, review, confirm scale/pivot/footprint, approve, place | **passed** |
| Move and turn the placed model | **passed through Arrange's typed writer; blocked as a pointer gesture** |
| Resize, duplicate and delete the placed model | **blocked** — Compose has no subject to act on (the three commands themselves are proven reachable on the typed placement of a native primitive) |
| The same journey from an empty project | **import, review and approve passed; placement is impossible** — an empty project has no Room floor, and the refusal is silent |
| Two instances share one immutable revision with independent identity | **passed** (through "Place another") |
| Save and reopen in a fresh session; stored revision verified against its pins | **passed** |
| Preview shows the placed mapped derivative | **passed** (pixel differential) |
| Owner-accepted bounds install nothing; retained revision survives | **passed** |
| Strict refusal of old-number formats and part fields; `/p` catalogue-only | **passed by the suite**: `model-resource-admission.test.ts` "refuses the old resources and Scene format numbers without migrating them" and "refuses an unknown model key and a part field on the model detail"; visitor isolation suites for `/p` |
| Integrated performance recheck | **partial**: F5, F13, F9 hard rows pass; F6 undecided; GPU row blocked; Stage first-load JS **hard miss** |

## Tested revision and environment

```text
branch            t2/p02-s03-integrated-final-gate, from origin/main 9e0fcb50 (PR #198 merge)
verification tree the product code of 9e0fcb50, unchanged: the contract ran on the working tree
                  that became 3c641c3e, whose only additions are the perf harness (outside every
                  Vitest lane), the evidence and later documentation
consumed gates    F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
                  all `accepted`; every Requires scope `active` at this trusted base
prerequisites     T2.P02.S01 accepted (owner-override 2026-10-23), T2.P02.S02 accepted 2026-10-24
harness           perf/run-s03-own-model-qa.mjs + perf/flows/s03-own-model-acceptance.spec.ts
                  (three tests) and perf/flows/s03-selection-probe.spec.ts; outside every Vitest
                  lane. After the last harness edit: 3/3 acceptance tests passed in 23.7 s and
                  `npm run check` reported 0 errors, 0 warnings
machine           MacBook Air M2 (Mac14,2), Apple M2, 16 GiB, macOS 15.8.2, battery, Low Power Mode off
                  — the designated reference machine (batch E, E6)
browser           Google Chrome 156.0.8078.48 (branded `chrome` project), 1920×1080 CSS at DPR 1,
                  reduced motion `no-preference`, N1 network emulation for the measured rows
backend           in-process API (`createApp`), private Postgres database `biskiq_s03_gate`
                  (local PostgreSQL on 127.0.0.1:5432, migrations applied by the run), in-memory
                  object store (`apps/api/tests/test-support.mjs`) — no R2 credentials or bucket touched
```

Raw artifacts: [evidence/2026-10-27](./evidence/2026-10-27) (`journey.json`, `refusals.json`,
`empty-project.json`, `selection-probe.json`, `machine-facts.json`, `f5f6-import-chrome.json`,
`f13-import-chrome.json`, `f9-save-chrome.json`, five screenshots and the bundle excerpt).
`journey.json` records `errors: []` and `reopenErrors: []` for the two browser lifetimes it drove.

## Repository contract (exhaustive)

Run from the repository root on `3c641c3e`, each command with its own exit status.

| Command | Result |
| --- | --- |
| `npm test` | 210 files / 2,620 tests passed, exit 0 |
| `npm run test:arch` (whole lane, never path-gated) | 22 files / 180 tests passed, exit 0 |
| `npm run test:heavy` | 11 files / 138 tests passed, exit 0 |
| `npm run check` (`svelte-check`) | 0 errors, 0 warnings, exit 0 |
| `npm run check:api`, `check:project-model`, `check:layout-core`, `check:camera-core` | 0 errors each, exit 0 |
| `npm run build` | built in 7.88 s, exit 0 |
| `npm run perf:bundle` | exit 0; Stage route numbers below |
| `npm run test:api` (DB-backed, `DATABASE_URL` = private `biskiq_s03_gate`) | 114 tests, 114 pass, **0 skipped**, exit 0 |

The API run targets a task-private local database, not the Compose stack (`npm run test:api:stack`):
the Docker daemon was not running on this machine. That is a recorded deviation from S02's DB target,
not a skipped check — the same suites ran with zero skips.

## Integrated creator journey (branded Chrome, one application lifetime per leg)

These legs are on-demand Playwright flows (`perf/flows/s03-own-model-acceptance.spec.ts`: the starter
journey, the empty-project leg and the refusal leg; three tests, 3 passed, 23.7 s) driven by
`perf/run-s03-own-model-qa.mjs`; the full evidence is in `journey.json`, `empty-project.json` and
`refusals.json`.

| Step | Observed | Result |
| --- | --- | --- |
| Starter gallery, Save, Library Import with maps | report: 1 node, 1 mesh, 12 triangles, 2 textures; footprint 2.000 × 2.000 m, contact 0.000 m, height 2.000 m; "Textures capped at 2048 px: 1 reduced"; 0 animations / 0 variants reported, not admitted | passed |
| Confirm scale 1 and bottom-centre pivot, approve, place | one accepted placement; model renders in the editor 3D reading (34,377 model-colour pixels) | passed |
| Canonical selection after placement | `Selected subject` names the **room floor**, not the new model — recorded in `journey.json` as `selectionAfterPlacement` | **finding** |
| Move and turn | Arrange's own entity chooser lists `Gate model · model`; typed X 1.25, Z −0.5 and yaw 0.5 commit as accepted results; stored entity shows exactly those values | passed (typed path) |
| Move/turn by pointer drag | Arrange claims no press: its pointer intent requires a canonical Scene-entity selection, which placement never established | **blocked** |
| Resize / Duplicate / Delete | Compose opens with `no entity`; `Resize…`, `Duplicate` and `Delete` are all `disabled` (`journey.json` → `compose`) | **blocked** (the commands themselves are proven on a typed native placement — see the finding below) |
| Second instance of the same approved model | Import → "Place another" → floor click; stored Scene holds two entities (`entity-55aeca7f…`, `entity-ff154e67…`) with one `assetId` (`model-9b50197b…`) and one `resources` entry | passed |
| Save and reopen in a fresh session | fresh context + cold cache; two models render (80,910 model-colour pixels); no page errors | passed |
| Preview of the mapped derivative | two green checkered instances visible in the visitor canvas (74,328 model-colour pixels); empty-room control Preview in the same build reports **0** | passed |
| Preview texture arrival | the mapped derivative lands **155 ms** after the first painted frame (`previewTextureWaitedMs`); the row waits for mapped pixels rather than asserting a single frame (an earlier run shot the untextured fallback and read 0) | observed |
| Retention and pins | resource `contentRevision` = `pin.hash` = `sha256-66ced4f5…`; dependency-lock entry names the same subject and hash; the derivative fetched by hash hashes to that pin and matches `pin.size` (1,201,064 B); recipe `creator-import@1@1`, source manifest hash, ingest report digest and floor placement retained; no `componentId`, `partId`, `parts`, `clips` or `variants` on the entity or resource | passed |

The two Preview images are the pixel evidence:
[with model](./evidence/2026-10-27/preview-with-model.png) and
[control](./evidence/2026-10-27/preview-control.png). The Stage before and after the fresh-session
reopen are [stage-placed.png](./evidence/2026-10-27/stage-placed.png) and
[stage-reopened.png](./evidence/2026-10-27/stage-reopened.png).

## The journey from an empty project — placement is unreachable

The plan records acceptance "from an empty project and from the starter". The starter leg is the
journey above. The empty leg was driven as its own browser lifetime (`empty-project.json`):

| Step | Observed | Result |
| --- | --- | --- |
| Begin empty, Save | the Stage opens on the product's own empty baseline, with the rail text "Empty baseline — no enclosure drawn yet. Start from the … Nothing selectable there." | passed |
| Library Import, review report | identical report to the starter leg: 1 node, 1 mesh, 12 triangles, 2 textures, 2.000 × 2.000 m footprint, contact 0.000 m, height 2.000 m | passed |
| Approve and place | the Place instrument opens with its Place row; the floor click installs nothing and the instrument's `p.feedback` stays **empty** | **blocked** |
| Save after the refused placement | 0 model resources, 0 Scene entities stored | passed (nothing installed) |

The cause is structural, not a regression: `bootEmpty` builds `createEmptyWallFirstLayoutDocument()`, so
the project has no enclosure and therefore no compiled Room floor, and `pointerPlaceSupport` requires
exactly one eligible floor before it will show or commit a candidate. An imported model is placeable
only by a floor click, so in an empty project it cannot be placed at all until a room is drawn — the
T1 drawing journey, which this slice does not own and did not drive.

[empty-project-stage.png](./evidence/2026-10-27/empty-project-stage.png) is that state. The rail does
warn that no enclosure is drawn, but the Place instrument itself offers a Place row and a click target
and says nothing when the click is refused — a creator reading only the instrument is told nothing.
This is recorded as an unreachable scope line and an owner decision, not repaired here.

## Bounds, refusals and retention

| Case | Observed | Result |
| --- | --- | --- |
| Source set over 50 MiB (51 MiB chosen by path) | local refusal before any upload: "The source set is 52428801 bytes; a creator import is limited to 52428800 bytes."; no report, no resource | passed |
| Malformed container | "The source could not be read: Invalid glTF 2.0 binary."; no report, no resource | passed |
| Cancelled after review | report withdrawn; no resource and no entity stored | passed |
| Project replaced after review | first project: 0 model resources, 0 Scene entities; replacement project: 0 model resources | passed |
| Staged expiry (24 h) | not waited in the browser; covered by `apps/api/tests/model-resources.test.mjs` ("staging past its 24 hour expiry refuses further uploads and is deleted with its bytes") in the zero-skip API run | passed by suite |
| 50 MiB source / 25 MiB derivative bounds at the API | `apps/api/tests/model-resources.test.mjs` ("the declaration enforces the owner-accepted 50 MiB / 25 MiB bounds", "streams a source at 50 MiB and a derivative at 25 MiB") | passed by suite |
| Stale pin, foreign-project locator, second upload | `model-resources.test.mjs` Save-admission refusal cases in the same run | passed by suite |
| Old-number Scene/resources units, part fields | `scene-codec.test.ts` (stale legacy fields), `project-format-visitor-parity.test.ts`, `model-resource-admission.test.ts`, `visitor/*` isolation and `preview-surface-boundary` in the full suite | passed by suite |
| Visitor `/p` stays catalogue-only | `visitor-public-route.test.ts`, `visitor-identity-isolation.test.ts`, `preview-surface-closure.test.ts` in the full suite | passed by suite |

## Performance recheck (integrated, designated M2, branded Chrome)

Method: the harness's `PERF_PROFILE=milestone` plan (three independent runs per decision row, one
discarded warm-up, the S06 decision-driven rule the baton assigns to this gate). These are
agent-executed measurements on the designated machine; **owner attribution and the formal ten-run
statistics an eventual acceptance needs are still outstanding.**

| Row | Measured | Budget | Result |
| --- | --- | --- | --- |
| F5 admission long tasks, S and M, cold/warm/repeat-use | 0 tasks over 50 ms in every row (longest 0 ms) | 0 > 50 ms, none > 100 ms | **pass** |
| F5 chosen → placed, S cold / M cold | 697 ms / 1,350 ms (warm 610 / 1,139 ms) | Target ≤ 2 s for 5 MiB, ≤ 5 s for 25 MiB | observed; generated S/M workload, not a decided target |
| F5 heap delta after GC | +0.05 to +0.18 MiB | — | observed |
| F6 floor click → accepted, p95 S cold / M cold | 34.4 ms / 46.3 ms | completion p95 ≤ 33 / ≤ 50 ms | S **undecided** (≈1.04 × bound), M inside; the flow is one floor click, not F6's sequenced drag |
| F9 Save local feedback p95, all cache states | 0.29–0.5 ms | ≤ 100 ms | **pass** |
| F9 durable receipt p95 (loopback N1) | 119–125 ms, 44,367 B wire | target formula | observed; loopback only, no service baseline |
| F13 heap growth over ten place/undo cycles | 2.64 MiB (9.51 → 12.16 MiB) | ≤ 5 MiB | **pass** |
| GPU memory at M | not measurable — Chromium exposes no per-page GPU allocation | ≤ 384 MiB hard | **blocked** (unchanged from S02) |
| Stage route first-load JS (br, cold) | **447.0 KiB** JS of 452.7 KiB total | ≤ 400 KiB hard | **hard miss** |

The Stage-route miss is not caused by this slice: `3c641c3e` changes no product code, so its delta
against `9e0fcb50` is zero and the hard budget was already exceeded at the trusted base. It is
recorded rather than absorbed because a final gate "cannot defer an earlier hard miss"; resolving it
means bundle attribution/reduction work in the owning code, outside S03's verification scope.

## Blocking finding — a pointer placement does not leave its new entity selected

```text
reproduce   starter → Library Import (any GLB) → Approve and place → floor click
observe     Selected subject card = the room floor; Index → Resize opens Compose
            showing `Compose no entity`, with Resize…, Duplicate and Delete disabled
also        Arrange's pointer drag never starts for the model (its press requires a
            canonical Scene-entity selection); Esc closes the open task first, and a
            second Esc clears the selection
evidence    evidence/2026-10-27/journey.json → selectionAfterPlacement, compose
            evidence/2026-10-27/selection-probe.json
```

The shipped `scene.adapter.ts` states the intent plainly: "the newly created entity becomes the
selection canonically, at the post-accept revision", set through `sceneEntityReference` on the
placement-committed listener. `SceneTransformInstrument` gates the three Compose commands on exactly
that selection (`primary.domain === 'scene' && primary.subject.kind === 'entity'`).

`perf/flows/s03-selection-probe.spec.ts` isolates the gap. Both legs place a native `box`, so the
import path is out of the comparison:

| Leg | Placement | Selected subject after the accepted install | Compose |
| --- | --- | --- | --- |
| typed X/Z + `Place` | accepted | `ENTITY · SCENE entity-0daa7437…` | opens on that entity, `Resize…` enabled |
| floor click | accepted | `ROOM · INCLUDED room.5:4:face31:…` at 0, 200, 1 000 and 3 000 ms | not reached |

The typed leg is asserted in the probe as the positive control, so the Compose surface and the
completion writer are both proven working. Only the pointer leg loses the selection. A creator model
has **no typed path at all** — the instrument's own text says "an imported model is placed by clicking
its floor position; these typed fields place a native primitive" — so for models the pointer path is
the only path, and it is the one that does not deliver the completion.

Two candidate causes, neither confirmed here: the same click's Layout pick runs after the asynchronous
install and overwrites the Scene selection; or the completion's reference is refused by admission
against a Scene revision the install has already replaced. Deciding between them and fixing it is a
product change, outside a verification gate's scope — the owner already recorded the gap on 2026-10-24
("a placed creator model is not canonically selected by any reachable UI path … kept unfixed as a
T1/T2 follow-up"). S03 must not absorb it, and did not.

No other reachable path selects it either. `journey.json` → `indexAfterPlacement` records what the
Index offers once the model is placed: no subject region at all, and nine task rows
(`Dimensions`, `Experience authoring`, `Resize`, `Duplicate`, `Delete`, `Arrange`, `Place plinth`,
`Place object`, `Import model…`) — nothing that names the entity, so there is no row to click. The
only surface that names it is Arrange's own dropdown, which sets the instrument's local field rather
than the canonical selection. That is also why the subject never becomes the entity rather than
flickering to it, and why the Compose commands stay disabled.

Consequence for the plan's required lines: resize, duplicate and delete cannot be accepted for a
creator model from this gate; pointer move/turn cannot be accepted either. The planner behaviour
behind them remains covered by `scene-operation-planners.test.ts` and
`scene-operation-acceptance.test.ts` in the passed suite — unit evidence, not an accepted creator path.

## Carried S02 owner-run rows — disposition

| S02 row | S03 disposition |
| --- | --- |
| 1. Shell observations (focus, pickers, cancel, offline retry, keyboard-only, refusal text, narrow desktop, reduced motion, lens park/Resume, Preview exit, accessible name/focus return) | **partially run**: cancel after review, local refusal text, Preview enter/exit, and the placement/Arrange focus path were exercised; offline approval + retry, narrow desktop, reduced motion on, lens park/Resume, keyboard-only transforms and the accessible-name/focus-return checks remain **unrun** (owner-run) |
| 2. Preview pixels of an approved mapped derivative | **run** — 74,328 model-colour pixels against a 0-pixel empty-room control; owner confirmation of the visual result outstanding |
| 3. Reference-machine F5/F6/F13 budgets, worker-thread split, GPU memory at M | **run in part** on the designated M2 (F5, F13 pass; F6 undecided; worker-thread split not recorded); **GPU memory blocked** by the browser API |
| 4. Draco-compressed and KTX2 (`KHR_texture_basisu`) sources | **unrun** |
| 5. Derivative above 25 MiB refused; a real 50 MiB+ source | **partially run**: the editor refuses a 51 MiB declared set before upload, and the API streams 50 MiB/25 MiB bounds in the zero-skip suite; a real >50 MiB source actually decoded was not produced |
| 6. Real R2 or a deployed object store | **unrun** — in-memory object store, as recorded |
| 7. Worker-message timing and cancellation across the worker boundary | **unrun** as timing; cancellation-before-derivative remains covered by `scene-import-ingest.test.ts` |

Rows 1, 4, 6 and 7 stay with the owner and are named as unrun, never waived.

## What this record does not claim

No acceptance, no phase close, no readiness, no gate state, no C3 re-acceptance (project deletion
stays with T3.P04.S01), no publication or T4 work, and no production deployment. The harness adds an
on-demand acceptance flow only: no `npm test` lane, no CI job, no timing gate. The selection probe is
a scoping tool, not a row: it asserts only its positive control and records the pointer leg.

## Required owner decisions

1. **Pointer placement selection.** Authorize the product change that makes a pointer placement leave
   its new entity canonically selected (the typed path already does), then re-run this gate's
   manipulation lines; or amend T2.P02's outcome so resize/duplicate/delete are not part of it. The
   probe above narrows the defect to the pointer completion; fixing it is an adapter or host change,
   not an in-slice repair.
2. **Stage first-load budget.** Decide how the 447.0 KiB br Stage route is resolved against the
   ≤ 400 KiB hard budget (attribution and reduction work in the owning code), or record an owner
   disposition for the row.
3. **F6 method.** Authorize the contract's run extension to ten measured runs for the placement
   completion row, with the sequenced drag F6 defines rather than a single floor click.
4. **Owner-run rows.** Complete rows 1, 4, 6, 7 and the GPU-memory measurement, or record a
   disposition for each.
5. **The empty-project line.** Decide whether "from an empty project" means *draw an enclosure, then
   import and place* (a T1 drawing journey this gate did not drive) or a starter-only journey, and
   whether the Place instrument should say why a click installs nothing when no floor supports it.

## Evidence files

```text
evidence/2026-10-27/journey.json                 browser journey, pixels, pins, compose finding
evidence/2026-10-27/refusals.json                oversize, malformed, cancelled, project-replaced
evidence/2026-10-27/empty-project.json           the empty-project leg: report, refusal, storage
evidence/2026-10-27/selection-probe.json         typed vs pointer placement, selected subject
evidence/2026-10-27/machine-facts.json           M2, macOS, power, Chrome version, start and end
evidence/2026-10-27/f5f6-import-chrome.json      F5/F6 milestone rows
evidence/2026-10-27/f13-import-chrome.json       F13 place/undo cycles
evidence/2026-10-27/f9-save-chrome.json          F9 Save rows
evidence/2026-10-27/stage-route-bundle.txt       perf:bundle route load sets
evidence/2026-10-27/stage-placed.png             editor 3D after placement
evidence/2026-10-27/stage-reopened.png           fresh-session reopen
evidence/2026-10-27/preview-with-model.png       Preview with two instances
evidence/2026-10-27/preview-control.png          empty-room control Preview
evidence/2026-10-27/empty-project-stage.png      the empty baseline with the Place instrument
```
