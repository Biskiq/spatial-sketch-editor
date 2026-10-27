# T2.P02.S03 — acceptance record: Integrated final gate

**Slice:** T2.P02.S03 · **Status:** gate re-run at `8cb97fe8` on 2026-10-27 — **NOT ACCEPTED: the
Stage first-load hard budget misses by 22.4 KiB, and the formal pass-scoped performance rows are not
discharged** · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Phase:** [T2.P02](../README.md) · **Declared** `FINAL PHASE GATE` artifact of T2.P02

**History:** the failed gate at `a025e2dd` is preserved in [disposition.md](./disposition.md); the
first and intermediate recoveries are in [recovery.md](./recovery.md) and
[recovery-head.md](./recovery-head.md). This record now carries **one** verdict at one revision. No
earlier finding below is reused as a current result.

**Verdict:** every product behaviour line passes at `8cb97fe8`, including the integrated empty-project
journey. The gate still cannot accept: delivery is a deterministic hard miss against the ratified
≤400 KiB budget, and the hard performance rows require pass-scoped evidence the current per-flow
reports cannot supply. Both are owner rulings, not defects this slice may absorb. The phase stays
`active`; `slice-closeout` is not authorized.

## Verdict summary

| Line | Result at `8cb97fe8` |
| --- | --- |
| Complete repository verification contract | **passed** — 215 files / 2,662 tests plus arch, heavy, checks, API and build (table below) |
| Import one own GLB with its maps, review, confirm scale/pivot/footprint, approve, place | **passed** |
| Move and turn the placed model | **passed** through Arrange's typed writer (pointer drag is not asserted by this gate) |
| Resize, duplicate and delete the placed model | **passed** — the placement leaves the model canonically selected; Compose enables all three; the journey asserts resize 1.5, Undo/Redo, a duplicate sharing one asset, and delete leaving the original |
| The same journey from an empty project | **passed** — owner-ruled draw-then-place: guidance is shown, the approved model survives the drawing task, and placement stores 1 room / 1 resource / 1 entity |
| Two instances share one immutable revision with independent identity | **passed** (through "Place another") |
| Save and reopen in a fresh session; stored revision verified against its pins | **passed** |
| Preview shows the placed mapped derivative | **passed** (pixel differential; mapped texture arrives in 256 ms) |
| Owner-accepted bounds install nothing; retained revision survives | **passed** |
| Strict refusal of old-number formats and part fields; `/p` catalogue-only | **passed by the suite** |
| Integrated performance recheck | **not discharged** — F5 long tasks clean; F6/F9/F13 not measured as defined; GPU blocked; no pass-scoped manifest |
| Delivery: Stage route first-load JS | **hard miss** — 422.4 KiB br against ≤400 KiB |

## Tested revision and environment

```text
revision          8cb97fe8 (product, tests and harness at one revision)
branch            t2/p02-s03-integrated-final-gate, base integrated main e1870769 (#204),
                  including the T1 #201 merge ce159a1e
consumed gates    F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1,
                  T1.viewport-projection@1 — all accepted
prerequisites     T2.P02.S01 accepted 2026-10-23, T2.P02.S02 accepted 2026-10-24
machine           MacBook Air M2 (Mac14,2), Apple M2, 16 GiB, macOS 15.8.2,
                  battery power, Low Power Mode off (recorded in each run's machine facts)
browser           Google Chrome 156.0.8078.48 through Playwright's channel:'chrome';
                  1920x1080 CSS at DPR 1, reduced motion no-preference
backend           in-process API, dedicated Postgres database biskiq_s03_final_head,
                  in-memory object store — no R2 credentials or production service touched
operator          the agent; owner attribution is outstanding
```

The supervisor serves the ordinary production build and runs migrations; it never builds. The
commands and env are the ones documented in [perf/README.md](../../../../../apps/editor/perf/README.md).

Raw artifacts: [evidence/2026-10-27-head/8cb97fe8](./evidence/2026-10-27-head/8cb97fe8). The earlier
head's artifacts remain beside it for provenance.

## Repository contract (exhaustive)

Run from the repository root at `8cb97fe8`, each command with its own exit status. Later commits on
this branch are documentation and evidence only.

| Command | Result |
| --- | --- |
| `npm test` | 215 files / 2,662 tests passed, exit 0 |
| `npm run test:arch` | 22 files / 180 tests passed, exit 0 |
| `npm run test:heavy` | 11 files / 138 tests passed, exit 0 |
| `npm run check` | 0 errors, 0 warnings, exit 0 |
| `npm run check:api`, `check:project-model`, `check:layout-core`, `check:camera-core` | 0 errors each, exit 0 |
| `npm run build` | editor 7.77 s, API 4.30 s, exit 0 |
| `npm run test:api` | 14 suites / 114 tests, 114 pass, **0 skipped**, exit 0 |
| `npm run perf:bundle` | exit 0; Stage route below |

The API lane used the task-private local database, not the Compose stack (Docker was not running).
All suites ran with zero skips.

## Integrated creator journey (branded Chrome)

Three acceptance tests, **3/3 passed in 45.7 s**. The flow drives the shipped creator surface against
the supervisor's real API, Postgres and object store; every assertion is a visible outcome or a
stored consequence.

| Step | Observed | Result |
| --- | --- | --- |
| Starter gallery, Save, Library Import with maps | 1 node, 1 mesh, 12 triangles, 2 textures; footprint 2.000 × 2.000 m, contact 0.000 m, height 2.000 m; "Textures capped at 2048 px: 1 reduced" | passed |
| Confirm scale 1, accept bottom-centre pivot, approve, place | one accepted placement; 34,377 model-colour pixels in the editor 3D reading (first pixels at 186 ms) | passed |
| Canonical selection after placement | `ENTITY · SCENE … Kind model Name Gate model` | passed |
| Move and turn | typed X 1.25, Z −0.5, yaw 0.5; stored entity shows exactly those values | passed |
| Resize | Compose opens on the model with Resize enabled; `{ scale: 1.5, position: [1.25, 0, −0.5] }`; Undo restores 1, Redo re-installs 1.5 | passed |
| Duplicate | two entities, both scale 1.5, distinct ids, one shared asset | passed |
| Delete | one entity remains — the original, not the copy | passed |
| Second instance of the same approved model | "Place another" → floor click; two entities share one `assetId` and one resource entry | passed |
| Save and reopen in a fresh session | fresh context + cold cache; two models render (153,450 pixels; 210 ms to first model pixels); no page errors | passed |
| Preview of the mapped derivative | 157,270 model-colour pixels; 1,070,505 non-blank canvas pixels; mapped texture arrives 256 ms after the first canvas shot; the empty-room control stores 1 room / 0 resources / 0 entities, paints 180,321 pixels, and reports 0 model pixels; no errors on any page | passed |
| Retention and pins | resource `contentRevision` = `pin.hash` = `sha256-66ced4f5…`; derivative fetched after Save hashes to the pin and matches `pin.size` (1,201,064 B); source manifest hash, ingest digest, recipe `creator-import@1` and floor placement retained | passed |

`journey.json` records `errors: []`, `reopenErrors: []` and `controlErrors: []`; all three are
asserted, not merely recorded. Pixels: [with model](./evidence/2026-10-27-head/8cb97fe8/acceptance/s03-preview-with-model.png),
[stage placed](./evidence/2026-10-27-head/8cb97fe8/acceptance/s03-stage-placed.png),
[stage reopened](./evidence/2026-10-27-head/8cb97fe8/acceptance/s03-stage-reopened.png).

## The journey from an empty project (owner ruling: draw, then place)

The owner ruled that drawing the enclosure first satisfies the scope line, provided the guidance is
clear. The third acceptance test asserts the whole leg:

```text
approve in an empty project → Place shows:
  "No Room floor yet. This model stays ready: draw an enclosure with Ink, then reopen Place object."
draw Ink enclosure → Select → frame/select the floor → reopen Place object → place
stored: { rooms: 1, resources: 1, entities: 1 }        (asserted)
selectionAfterPlacement: the model entity             (asserted)
errors: []
```

The guidance is product copy rendered by the Place instrument for every no-floor task, with separate
model and primitive wording. The project-scoped approval survives the drawing task and the rebind.

## Bounds, refusals and retention

| Case | Observed | Result |
| --- | --- | --- |
| Source set over 50 MiB | local refusal before upload: "The source set is 52428801 bytes; a creator import is limited to 52428800 bytes."; no report, no resource | passed |
| Malformed container | "The source could not be read: Invalid glTF 2.0 binary."; no report, no resource | passed |
| Cancelled after review | no resource and no entity stored | passed |
| Project replaced after review | both projects store 0 resources | passed |
| Staged expiry (24 h), 50/25 MiB API bounds, stale pins, foreign locators | `model-resources.test.mjs` in the zero-skip API run | passed by suite |
| Old-number formats, part fields, `/p` catalogue isolation | codec, parity, admission and visitor-boundary suites in the full run | passed by suite |

## Performance recheck (designated M2, branded Chrome)

**No row below is pass-scoped acceptance evidence, and none is recorded as a pass.**

The owner authorized the formal M2 evaluation under the prescribed methodology. The import/placement,
Save and repeated place/undo flows ran with the **acceptance** sample plan (10 measured runs per row,
60 inputs per drag, every cache state) and now record `machine.powerState`, the revision and the plan.
They remain per-flow reports: `perf/lib/report.ts` writes `acceptanceEvidence: false` and
`passScoped: false` by design, and only a bench manifest can certify a pass. No manifest exists for
these flows, and the operator was the agent.

| Row | Measured at `8cb97fe8` | Budget | What it supports |
| --- | --- | --- | --- |
| F5 admission long tasks, S and M, all cache states | 0 ms summed and longest in **60 admission windows** | none > 50 ms, none > 100 ms | clean observation; needs a pass-scoped record |
| F5 chosen → placed p95, S cold / M cold | 773 ms / 1,364 ms | Target ≤ 2 s / ≤ 5 s | observed; fixtures are 12 triangles / ≈9k triangles, not the 5/25 MiB budget files |
| F6 floor click → accepted p95, S cold / M cold | 46.6 ms / 48.9 ms | completion p95 ≤ 33 / ≤ 50 ms | **not the contract's flow** (input-to-matching-preview is unmeasured); S exceeds its bound even as a proxy |
| F9 local status p95 | 0.5 / 0.3 / 0.3 ms | presented feedback p95 ≤ 100 ms | **not established**: DOM timestamps, not presentation |
| F9 durable receipt p95 (loopback N1) | 124.1 ms, 44,367 B wire | target formula | observed; no service baseline |
| F13 heap growth, ten place/undo cycles | 2.75 MiB (9.45 → 12.20 MiB) | ≤ 5 MiB | partial: one warm context, Undo not Delete, no GPU/geometry clauses |
| GPU memory at M | not measurable — Chromium exposes no per-page GPU allocation | ≤ 384 MiB hard | **blocked** |
| Stage route first-load JS | **422.4 KiB br** (1758.7 raw, 501.2 gzip); all 428.5 | ≤ 400 KiB hard | **hard miss, 22.4 KiB** |

F2/F3/F4/F7/F8, F13's cold/repeat-use ten-cycle rows, the worker-thread split, Draco/KTX2, a real
>50 MiB decode, real R2 and worker-boundary timing remain unrun under the formal method.

## Delivery

```text
Stage route /project/[projectId]/spatial, cold first load, production build
  JS  422.4 KiB br   budget ≤400 KiB br (hard)   MISS 22.4 KiB
```

The miss is deterministic build bytes, not a statistical claim. The owner ruling of 2026-10-27
retained the 400 KiB requirement and asked for meaningful optimisation plus an evidence-backed
amendment if the threshold proves unjustified. Two lazy splits removed 34.3 KiB from `7d1212b6`;
the remaining route is attributed in [recovery-head.md](./recovery-head.md#4-delivery-budget). The
[amendment proposal](./delivery-budget-proposal.md) is the open ruling.

## Carried S02 owner-run rows — disposition

| S02 row | S03 disposition |
| --- | --- |
| 1. Shell observations (offline retry, narrow desktop, reduced motion, keyboard-only transforms, accessible name/focus return, lens park/Resume) | **unrun** (owner-run); cancel, refusal text, Preview enter/exit and focus return on the exercised paths were run |
| 2. Preview pixels of an approved mapped derivative | **run** — 157,270 model pixels against a 0-pixel control; owner confirmation outstanding |
| 3. Reference-machine F5/F6/F13 budgets, worker split, GPU at M | **measured, not discharged** — see the performance table; GPU blocked |
| 4. Draco-compressed and KTX2 sources | **unrun** |
| 5. Derivative above 25 MiB; a real 50 MiB+ source | **partially run** — 51 MiB declared set refuses locally; 50/25 MiB API bounds pass; no real >50 MiB decode |
| 6. Real R2 or a deployed object store | **unrun** — in-memory store |
| 7. Worker-message timing and cancellation | **unrun** as timing; cancellation-before-derivative is covered by `scene-import-ingest.test.ts` |

Rows 1, 4, 6 and 7 stay with the owner and are named as unrun, never waived.

## Product follow-up (recorded, not a gate claim)

A placed model has no named row in the Index subject region (`subjectRowsNamingTheModel: 0`), so after
deselection it is reachable through Arrange's chooser and the card, not by its own subject row. The
pointer path selects it immediately after placement; the diagnostic spec records both facts.

## What this record does not claim

No acceptance, no phase close, no readiness, no gate state, no publication or T4 work, and no
production deployment. The harness adds an on-demand acceptance flow only: no `npm test` lane, no CI
job, no timing gate. Historical failed-gate evidence remains in the disposition and recovery records.

## Required owner decisions

1. **Stage first-load budget.** Rule on the [amendment proposal](./delivery-budget-proposal.md):
   accept a 425 KiB bound (22.4 KiB measured, 2.6 KiB headroom), adopt 450 KiB for planning, or keep
   400 KiB and authorize another reduction pass. Until then the hard row misses and the gate cannot
   accept.
2. **Formal performance discharge.** Decide how S03's hard performance rows are discharged: authorize
   a pass-scoped bench/operator with a manifest; authorize F6's sequenced-drag flow and F9's
   presented-feedback measurement as method repairs; extend F13 to its cold/repeat-use ten-cycle
   rows; and record a disposition for GPU memory, which the browser exposes no per-page figure for.
3. **Owner-run rows.** Complete or dispose of the shell observations, Draco/KTX2 sources, a real R2
   bucket and a real >50 MiB source (carried S02 rows 1, 4, 6, 7).
4. **Product follow-up.** Decide whether a placed model needs its own Index subject row for
   reselection after deselection; it is not required by the gate's wording and is recorded here.

The empty-project line is **ruled** (draw-then-place with guidance), and the manipulation finding is
**repaired and demonstrated**; neither remains a product decision.

## Evidence files

```text
evidence/2026-10-27-head/8cb97fe8/acceptance/s03-journey-evidence.json   journey, pixels, pins, selection
evidence/2026-10-27-head/8cb97fe8/acceptance/s03-empty-project-evidence.json  guidance, draw, place, storage
evidence/2026-10-27-head/8cb97fe8/acceptance/s03-refusal-evidence.json   oversize, malformed, cancelled, replaced
evidence/2026-10-27-head/8cb97fe8/acceptance/s03-machine-facts.json      machine, power, browser, start/end
evidence/2026-10-27-head/8cb97fe8/acceptance/*.png                       stage placed/reopened, Preview, control
evidence/2026-10-27-head/8cb97fe8/diagnostics/                           observation-only gap record
evidence/2026-10-27-head/8cb97fe8/perf-import/                           F5/F6 and F13 reports, machine facts
evidence/2026-10-27-head/8cb97fe8/perf-f9/                               F9 Save report
evidence/2026-10-27-head/8cb97fe8/stage-route-bundle.txt                  perf:bundle route load sets
```
