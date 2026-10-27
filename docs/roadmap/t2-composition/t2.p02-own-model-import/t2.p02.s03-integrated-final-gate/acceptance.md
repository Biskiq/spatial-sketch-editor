# T2.P02.S03 — acceptance record: Integrated final gate

**Slice:** T2.P02.S03 · **Status:** **accepted by owner ruling 2026-10-27 at `b9ba493b`**; the Stage
first-load hard budget is amended to **≤425 KiB br JS** (422.3 measured, 2.7 KiB headroom), and the
unverified formal performance rows are **deferred to named owners, never recorded as passes** ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Phase:** [T2.P02](../README.md) · **Declared** `FINAL PHASE GATE` artifact of T2.P02

**History:** the failed gate at `a025e2dd` is preserved in [disposition.md](./disposition.md); the
first and intermediate recoveries are in [recovery.md](./recovery.md) and
[recovery-head.md](./recovery-head.md). This record now carries **one** verdict at one revision. No
earlier finding below is reused as a current result.

**Verdict (owner ruling, 2026-10-27):** every product behaviour line passes at `b9ba493b`, including
the integrated empty-project journey. The owner **accepted the gate**, amended the Stage first-load
hard budget from ≤400 to ≤425 KiB br (422.3 measured, 2.7 KiB headroom), and deferred the formal
pass-scoped performance rows to named follow-up owners. Deferral is not a pass: no performance row
is recorded or waived as a pass. The same owner direction closes `T2.P02`; the phase README carries
the `PHASE CLOSE` block.

## Verdict summary

| Line | Result at `b9ba493b` |
| --- | --- |
| Complete repository verification contract | **passed** — 215 files / 2,663 tests plus arch, heavy, checks, API and build (table below) |
| Import one own GLB with its maps, review, confirm scale/pivot/footprint, approve, place | **passed** |
| Move and turn the placed model | **passed** through Arrange's typed writer (pointer drag is not asserted by this gate) |
| Resize, duplicate and delete the placed model | **passed** — the placement leaves the model canonically selected; Compose enables all three; the journey asserts resize 1.5, Undo/Redo, a duplicate sharing one asset, and delete leaving the original |
| The same journey from an empty project | **passed** — owner-ruled draw-then-place: guidance is shown, the approved model survives the drawing task, and placement stores 1 room / 1 resource / 1 entity |
| Two instances share one immutable revision with independent identity | **passed** (through "Place another") |
| Save and reopen in a fresh session; stored revision verified against its pins | **passed** |
| Preview shows the placed mapped derivative | **passed** (pixel differential; mapped texture arrives in 256 ms) |
| Owner-accepted bounds install nothing; retained revision survives | **passed** |
| Strict refusal of old-number formats and part fields; `/p` catalogue-only | **passed by the suite** |
| Integrated performance recheck | **deferred, not discharged** — F5 long tasks clean; F6/F9/F13 not measured as defined; GPU blocked; no pass-scoped manifest; owner deferred the rows to named follow-up owners |
| Delivery: Stage route first-load JS | **passed under the owner-amended ≤425 KiB budget** — 422.3 KiB br, 2.7 KiB headroom (the former ≤400 row missed by 22.3 KiB and remains history) |

## Tested revision and environment

```text
revision          b9ba493b (product, tests and harness at one revision)
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
operator          the agent; the owner accepted the product and dispositioned the performance rows
                  on 2026-10-27 (not a pass-scoped owner-run bench)
```

The supervisor serves the ordinary production build and runs migrations; it never builds. The
commands and env are the ones documented in [perf/README.md](../../../../../apps/editor/perf/README.md).

Raw artifacts: [evidence/2026-10-27-head/b9ba493b](./evidence/2026-10-27-head/b9ba493b), including
raw logs for each run. The earlier `8cb97fe8` and `ea42c745` artifacts remain beside it for
provenance.

## Repository contract (exhaustive)

Run from the repository root at `b9ba493b`, each command with its own exit status. Later commits on
this branch are documentation and evidence only; the raw summary is
[contract-summary.txt](./evidence/2026-10-27-head/b9ba493b/contract-summary.txt).

| Command | Result |
| --- | --- |
| `npm test` | 215 files / 2,663 tests passed, exit 0 |
| `npm run test:arch` | 22 files / 180 tests passed, exit 0 |
| `npm run test:heavy` | 11 files / 138 tests passed, exit 0 |
| `npm run check` | 0 errors, 0 warnings, exit 0 |
| `npm run check:api`, `check:project-model`, `check:layout-core`, `check:camera-core` | 0 errors each, exit 0 |
| `npm run build` | editor 6.86 s, API 3.73 s, exit 0 |
| `npm run test:api` | 14 suites / 114 tests, 114 pass, **0 skipped**, exit 0 |
| `npm run perf:bundle` | exit 0; Stage route below |

The API lane used the task-private local database, not the Compose stack (Docker was not running).
All suites ran with zero skips.

## Integrated creator journey (branded Chrome)

Three acceptance tests, **3/3 passed in 45.8 s**. The flow drives the shipped creator surface against
the supervisor's real API, Postgres and object store; every assertion is a visible outcome or a
stored consequence.

| Step | Observed | Result |
| --- | --- | --- |
| Starter gallery, Save, Library Import with maps | 1 node, 1 mesh, 12 triangles, 2 textures; footprint 2.000 × 2.000 m, contact 0.000 m, height 2.000 m; "Textures capped at 2048 px: 1 reduced" | passed |
| Confirm scale 1, accept bottom-centre pivot, approve, place | one accepted placement; 34,377 model-colour pixels in the editor 3D reading (first pixels at 162 ms) | passed |
| Canonical selection after placement | `ENTITY · SCENE … Kind model Name Gate model` | passed |
| Move and turn | typed X 1.25, Z −0.5, yaw 0.5; stored entity shows exactly those values | passed |
| Resize | Compose opens on the model with Resize enabled; `{ scale: 1.5, position: [1.25, 0, −0.5] }`; Undo restores 1, Redo re-installs 1.5 | passed |
| Duplicate | two entities, both scale 1.5, distinct ids, one shared asset | passed |
| Delete | one entity remains — the original, not the copy | passed |
| Second instance of the same approved model | "Place another" → floor click; two entities share one `assetId` and one resource entry | passed |
| Save and reopen in a fresh session | fresh context + cold cache; two models render (153,450 pixels; 210 ms to first model pixels); no page errors | passed |
| Preview of the mapped derivative | 157,270 model-colour pixels; 1,070,505 non-blank canvas pixels; mapped texture arrives 222 ms after the first canvas shot; the empty-room control stores 1 room / 0 resources / 0 entities, paints 180,321 pixels, and reports 0 model pixels; no errors on any page | passed |
| Retention and pins | resource `contentRevision` = `pin.hash` = `sha256-66ced4f5…`; derivative fetched after Save hashes to the pin and matches `pin.size` (1,201,064 B); source manifest hash, ingest digest, recipe `creator-import@1` and floor placement retained | passed (the stored revision is still served after Save; **no retention or GC test was run**) |

`journey.json` records `errors: []`, `reopenErrors: []` and `controlErrors: []`; all three are
asserted, not merely recorded. Pixels: [with model](./evidence/2026-10-27-head/b9ba493b/acceptance/s03-preview-with-model.png),
[stage placed](./evidence/2026-10-27-head/b9ba493b/acceptance/s03-stage-placed.png),
[stage reopened](./evidence/2026-10-27-head/b9ba493b/acceptance/s03-stage-reopened.png).

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

**The Stage byte count is a deterministic build measurement and passes only under the owner-amended
≤425 KiB row. No formal performance row below is pass-scoped acceptance evidence, and none is
recorded as a pass.**

The owner authorized the formal M2 evaluation under the prescribed methodology. The F5/F6 import and
F9 Save flows ran with the **acceptance** sample plan (10 measured runs per row, every cache state);
F13 ran its single repeat-use ten-cycle row. Every report now records `machine.powerState`, the
revision and the plan.
They remain per-flow reports: `perf/lib/report.ts` writes `acceptanceEvidence: false` and
`passScoped: false` by design, and only a bench manifest can certify a pass. No manifest exists for
these flows, and the operator was the agent.

| Row | Measured at `b9ba493b` | Budget | What it supports |
| --- | --- | --- | --- |
| F5 admission long tasks, S and M, all cache states | 0 ms summed and longest in **60 admission windows** | none > 50 ms, none > 100 ms | clean observation; needs a pass-scoped record |
| F5 chosen → placed p95, S cold / M cold | 809 ms / 1,368 ms | Target ≤ 2 s / ≤ 5 s | observed; fixtures are 12 triangles / ≈9k triangles, not the 5/25 MiB budget files |
| F6 floor click → accepted p95, S cold / M cold | 50.6 ms / 47.6 ms (M warm 59.2, repeat 57.0) | completion p95 ≤ 33 / ≤ 50 ms | **not the contract's flow** (input-to-matching-preview is unmeasured); S exceeds its bound even as a proxy, and M's warm/repeat proxies exceed 50 ms |
| F9 local status p95 | 0.5 / 0.3 / 0.3 ms | presented feedback p95 ≤ 100 ms | **not established**: DOM timestamps, not presentation |
| F9 durable receipt p95 (loopback N1) | 124.1 ms, 44,367 B wire | target formula | observed; no service baseline |
| F13 heap growth, ten place/undo cycles | 2.66 MiB | ≤ 5 MiB | partial: one repeat-use context, Undo not Delete, no cold/repeat-use pair, no GPU/geometry clauses |
| GPU memory at M | not measurable — Chromium exposes no per-page GPU allocation | ≤ 384 MiB hard | **blocked** |
| Stage route first-load JS | **422.3 KiB br** (1758.7 raw, 501.2 gzip); all 428.4 | ≤ 425 KiB hard (owner-amended 2026-10-27; was 400) | **passes, 2.7 KiB headroom** |

**Owner disposition (2026-10-27).** The formal rows above — F5 formal pass-scoped admission long
tasks, F5 chosen → placed on the budget workloads, F6 as defined, F9 presented feedback and durable
receipt, F13 cold/repeat-use cycles, GPU memory at M — and the unrun F2/F3/F4/F7/F8, worker-thread
split and real-workload rows are **deferred, not passed**, to the **T2 performance follow-up (T2
track)**. Shell observations, Draco/KTX2 sources, a real R2 bucket, a real >50 MiB decode and
worker-boundary timing are **deferred to the repository owner (owner-run), tracked by T2**. The
product follow-ups below are **deferred to the T2 track**. No row is recorded or waived as a pass;
the durable provenance is the
[decision record](../../../../reference/decisions/t2-s03-acceptance-and-budget-amendment-2026-10-27.md).

F2/F3/F4/F7/F8, F13's cold/repeat-use ten-cycle rows, the worker-thread split, Draco/KTX2, a real
>50 MiB decode, real R2 and worker-boundary timing remain unrun under the formal method; deferral
does not make them evidence.

## Delivery

```text
Stage route /project/[projectId]/spatial, cold first load, production build
  JS  422.3 KiB br   budget ≤425 KiB br (hard, owner-amended 2026-10-27)   PASS, 2.7 KiB headroom
```

The former ≤400 KiB row missed by 22.3 KiB and remains recorded as history at that revision. The
owner amended the hard row to ≤425 KiB br after two lazy splits removed 34.4 KiB from `7d1212b6`;
the remaining route is attributed in [recovery-head.md](./recovery-head.md#4-delivery-budget). The
[amendment proposal](./delivery-budget-proposal.md) is ruled, and the amendment is live in
[performance.md](../../../../reference/components/performance.md). It is not retroactive:
`T1.P02.S02`'s 456.0 KiB br at `64b9435d` remains a recorded miss at that revision and is carried to
`T1.P02.S04`.

## Carried S02 owner-run rows — disposition

| S02 row | S03 disposition |
| --- | --- |
| 1. Shell observations (offline retry, narrow desktop, reduced motion, keyboard-only transforms, accessible name/focus return, lens park/Resume) | **deferred to the owner-run follow-up** (repository owner, tracked by T2); cancel, refusal text, Preview enter/exit and focus return on the exercised paths were run |
| 2. Preview pixels of an approved mapped derivative | **run and accepted with this gate** — 157,270 model pixels against a 0-pixel control |
| 3. Reference-machine F5/F6/F13 budgets, worker split, GPU at M | **measured, not discharged; deferred** to the T2 performance follow-up (T2 track) — see the performance table; GPU blocked |
| 4. Draco-compressed and KTX2 sources | **deferred to the owner-run follow-up** (repository owner, tracked by T2) |
| 5. Derivative above 25 MiB; a real 50 MiB+ source | **partially run** — 51 MiB declared set refuses locally; 50/25 MiB API bounds pass; the real >50 MiB decode is **deferred to the owner-run follow-up** |
| 6. Real R2 or a deployed object store | **deferred to the owner-run follow-up** — in-memory store used |
| 7. Worker-message timing and cancellation | **timing deferred to the owner-run follow-up**; cancellation-before-derivative is covered by `scene-import-ingest.test.ts` |

The owner deferred the unrun rows to the named owners above; none is recorded as a pass or waived as
one. The acceptance prerequisite is dispositioned, not the measurement.

## Product follow-up (deferred to the T2 track, not a gate claim)

A placed model has no named row in the Index subject region (`subjectRowsNamingTheModel: 0`), so after
deselection it is reachable through Arrange's chooser and the card, not by its own subject row. The
pointer path selects it immediately after placement; the diagnostic spec records both facts.

Pointer move/turn of a model is still typed-only: the gate asserts the typed writer, not a pointer
drag. The owner accepted the gate with both follow-ups **deferred to the T2 track**; neither is a
pass claim.

## What this record does not claim

This record claims the owner's acceptance of T2.P02.S03 and the phase close recorded in the phase
README. It does not claim that any deferred performance row passed, T2 track completion, readiness, a
gate version, publication or T4 work, or production deployment. The harness adds an on-demand
acceptance flow only: no `npm test` lane, no CI job, no timing gate. Historical failed-gate evidence
remains in the disposition and recovery records.

## Owner rulings and follow-up ownership (2026-10-27)

| Decision | Ruling |
| --- | --- |
| Stage first-load budget | Amend the hard row from ≤400 to **≤425 KiB br JS**; 422.3 passes with 2.7 KiB headroom; the 25 KiB per-slice growth rule is unchanged and the amendment is not retroactive |
| Formal performance rows | **Deferred, not passed** — F5/F6/F9/F13/GPU formal pass-scoped rows, F2/F3/F4/F7/F8, the worker-thread split and real-workload rows → **T2 performance follow-up (T2 track)** |
| Owner-run rows | **Deferred** — shell observations, Draco/KTX2, real R2, the real >50 MiB decode and worker-boundary timing → **repository owner (owner-run), tracked by T2** |
| Product follow-ups | **Deferred** — the placed model's own Index subject row and the pointer move/turn decision → **T2 track** |
| Empty-project line | **Ruled** — draw-then-place with the guidance the acceptance row asserts |
| Manipulation finding | **Repaired and demonstrated**; accepted with this gate |
| Phase close | The owner directed `T2.P02` to close; the final gate is accepted 2026-10-27 and the phase README carries `PHASE CLOSE — Stage: closed` |

No row above is recorded or waived as a pass. The durable provenance is the
[decision record](../../../../reference/decisions/t2-s03-acceptance-and-budget-amendment-2026-10-27.md).

## Evidence files

```text
evidence/2026-10-27-head/b9ba493b/acceptance/s03-journey-evidence.json   journey, pixels, pins, selection
evidence/2026-10-27-head/b9ba493b/acceptance/s03-empty-project-evidence.json  guidance, draw, place, storage
evidence/2026-10-27-head/b9ba493b/acceptance/s03-refusal-evidence.json   oversize, malformed, cancelled, replaced
evidence/2026-10-27-head/b9ba493b/acceptance/s03-machine-facts.json      machine, power, browser, start/end
evidence/2026-10-27-head/b9ba493b/acceptance/run.log                     raw Playwright run
evidence/2026-10-27-head/b9ba493b/acceptance/*.png                     stage placed/reopened, Preview, control
evidence/2026-10-27-head/b9ba493b/diagnostics/                           observation-only gap record
evidence/2026-10-27-head/b9ba493b/perf-import/                           F5/F6, F13 reports, run log, machine facts
evidence/2026-10-27-head/b9ba493b/perf-f9/                               F9 Save report and run log
evidence/2026-10-27-head/b9ba493b/bundle-command.log                     perf:bundle route totals
evidence/2026-10-27-head/b9ba493b/contract-summary.txt                   every contract command and its exit
```
