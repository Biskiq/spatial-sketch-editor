# T2.P02.S03 — recovery at `b9ba493b`

```text
AUTHORITY: NONE — the acceptance record still owns the gate verdict. This artifact records repairs
and a revision-specific re-run, not acceptance, not a phase close and not merge authorization.
STATUS:    RECOVERY IMPLEMENTED AND RE-RUN. T2.P02.S03 remains **NOT ACCEPTED**. The creator-model
           manipulation row and the empty-project row are reachable and asserted; the Stage delivery
           budget still misses, and the formal pass-scoped performance rows remain unresolved.
REVISION:  b9ba493b — product, tests and harness at one revision. Base is integrated main through
           e1870769 / #204, including the T1 #201 merge ce159a1e. The earlier 8cb97fe8 artifacts are
           retained beside this revision's evidence.
PR:        #199, branch t2/p02-s03-integrated-final-gate. Not merged.
HISTORY:   the failed gate at a025e2dd, the first recovery at 7d1212b6 and the intermediate heads
           ea42c745 and 8cb97fe8 are preserved unchanged. This record is a new revision with new
           evidence, never a reinterpretation of them.
```

## 1. Repairs since `ea42c745`

The intermediate head closed the product gaps the first recovery exposed: a pointer placement leaves
its new model selected, Compose Resize/Duplicate/Delete commit, typed Place installs the armed model,
and an empty project reaches placement after Ink draws a floor. The independent review of `ea42c745`
found two narrower defects, both repaired here.

| Defect | Repair | Owning seam |
| --- | --- | --- |
| The shared `VisitorEntities` fetched `AssetModel` at idle, so the **public preview** route's first-load graph and first model presentation changed without T3 review. | The entity grouping/material loop is one shared component (`VisitorEntityGroups`); the visitor wraps it with the static renderer it always had, and only the editor Stage's `StageEntities` supplies an idle-time lazy renderer with a bounded retry. The public graph is restored; the Stage split is kept. | `visitor/VisitorEntityGroups.svelte`, `visitor/VisitorEntities.svelte`, `stage/shell/StageEntities.svelte`, `stage/shell/StageCanvas.svelte` |
| Choosing a native primitive cleared the session's armed model but not the project-scoped pending arm. Reopening Place then re-applied a model the creator had explicitly replaced. | `choosePrimitive` consumes the project arm and forwards the primitive in one place, used by the Place instrument's selector. The clear is unconditional even when the panel's session is briefly absent, and two focused unit tests prove the arm is gone in both cases. | `scene/import/definitions.ts`, `SceneTransformInstrument.svelte`, `scene-import-arm.test.ts` |
| The acceptance spec header still described selection, Compose and the empty project as diagnostics that could not fail the gate. | The header now states they are asserted acceptance rows; the diagnostic spec remains observation-only. | `perf/flows/s03-own-model-acceptance.spec.ts` |

No acceptance condition, budget, sample plan or historical artifact was changed.

## 2. Repository verification contract at `b9ba493b`

Run from the repository root, each command with its own exit status. The working tree held exactly
this revision; later commits are documentation and evidence only, which no lane collects.

| Command | Result |
| --- | --- |
| `npm test` | **215 files / 2,663 tests passed**, exit 0 |
| `npm run test:arch` (whole lane, never path-gated) | **22 files / 180 tests passed**, exit 0 |
| `npm run test:heavy` | **11 files / 138 tests passed**, exit 0 |
| `npm run check` (`svelte-check`) | 0 errors, 0 warnings, exit 0 |
| `npm run check:api`, `check:project-model`, `check:layout-core`, `check:camera-core` | 0 errors each, exit 0 |
| `npm run build` | editor built in 6.86 s; API in 3.73 s, exit 0 |
| `npm run test:api` (DB-backed) | **14 suites / 114 tests, 114 pass, 0 skipped, 0 failed**, exit 0 |
| `npm run perf:bundle` | exit 0; Stage route numbers below |

The API run targets the task-private local database `biskiq_s03_final_head` (migrated with the
repository's own migration command), not the Compose stack. Docker was not running on this machine;
the suites still ran with zero skips.

## 3. Browser evidence at `b9ba493b`

All runs are branded Google Chrome 156.0.8078.48 through the S03 supervisor, the ordinary production
build, the in-process API, the dedicated Postgres database and the in-memory object store. The
machine is the designated MacBook Air M2 (Mac14,2), 16 GiB, macOS 15.8.2, **on battery**, Low Power
Mode off, recorded in each run's machine facts.

```text
acceptance   3/3 tests, 45.8 s — perf/flows/s03-own-model-acceptance.spec.ts
diagnostics  3/3 tests, 39.6 s — perf/flows/s03-diagnostics.spec.ts (never gate rows)
```

The integrated journey records and asserts:

- `selectionAfterPlacement` names the new **model** entity (`Kind model`, `Name Gate model`), not the room floor;
- `afterResize` `{ scale: 1.5, position: [1.25, 0, -0.5] }`, then Undo restores scale 1 and Redo re-installs 1.5;
- `afterDuplicate` two entities, both scale 1.5, one shared asset, distinct ids; `afterDeleteModel` leaves the original;
- the typed path moves/turns the same model to the recorded coordinates;
- `stagePlacedWaitedMs` 162 ms for the first mapped model pixels; `previewTextureWaitedMs` 222 ms; no page errors.

The empty-project acceptance row records and asserts:

```text
guidance without a floor: "No Room floor yet. This model stays ready: draw an enclosure with Ink,
then reopen Place object." (asserted)
draw Ink enclosure → Select → frame/select the floor → reopen Place object → place
stored: { rooms: 1, resources: 1, entities: 1 } (asserted)
selectionAfterPlacement: the model entity (asserted)
errors: []
```

The retained diagnostics agree: a pointer placement now names the model at 0, 200, 1 000 and 3 000 ms,
Compose opens on it with Resize/Duplicate/Delete enabled, and the typed-vs-pointer comparison matches.
The one recorded follow-up is unchanged: the model still has **no named row in the Index subject
region** (`subjectRowsNamingTheModel: 0`), so after deselection it is reachable through Arrange's
chooser and the card, not by its own subject row. The empty-project diagnostic still places without
drawing a floor, so it records the expected refusal; the acceptance spec is the draw-then-place proof.

Raw artifacts: [evidence/2026-10-27-head/b9ba493b](./evidence/2026-10-27-head/b9ba493b)
(`acceptance/`, `diagnostics/`, `perf-import/`, `perf-f9/`, the bundle command log, each run's raw
log and machine facts). The earlier `8cb97fe8` directory remains beside it.

## 4. Delivery budget

```text
Stage route /project/[projectId]/spatial, cold first load, production build
  JS  422.3 KiB br (1758.7 KiB raw, 501.2 KiB gzip)   previously 456.7 KiB br at 7d1212b6
  all 428.4 KiB br (JS + CSS)
budget ≤400 KiB br JS (hard) — a 22.3 KiB deterministic miss
```

The two lazy splits (Import procedure, Stage model renderer) remove 34.4 KiB br from the route's
first-load set. The table below is an **approximate attribution from the earlier chunk analysis**,
not a load-set diff in the committed bundle artifact (the report has route totals and the emitted
but unloaded list; incomplete source maps prevent package attribution). Its 422.5 KiB sum differs
from the current 422.3 by rounding/revision:

| Chunk content | br |
| --- | --- |
| `three` core (the one Canvas serves Plan and 3D) | 152.1 KiB |
| Stage route, shell, adapters, project-model | 126.2 KiB |
| layout-core + camera-core (compile and projection needed for the first frame) | 58.8 KiB |
| museum renderers, materials and scene-instance painting | 30.2 KiB |
| Svelte runtime, Threlte canvas, and the remaining small chunks | 55.2 KiB |

No further removed chunk is a single optional capability: the Experience lens and task instruments
are reachable on the first screen, and the model renderer and Import are already out. The
[budget amendment proposal](./delivery-budget-proposal.md) asks the owner for a ruling; this record
does not waive the row.

## 5. Formal performance measurements at `b9ba493b`

The owner authorized a formal M2 evaluation under the prescribed methodology. The import/placement
and Save flows were re-run with the **acceptance** sample plan (10 measured runs per row, 60 inputs
per drag, every cache state) on branded Chrome, on battery with Low Power Mode off, and each report
now records `machine.powerState`, the revision and the plan. They are **per-flow reports**: by
harness design they are never pass-scoped (`acceptanceEvidence: false`, `passScoped: false`), and no
bench manifest exists for these flows. None of the rows below is recorded as a pass.

| Row | Measured at `b9ba493b` | Budget | What it supports |
| --- | --- | --- | --- |
| F5 admission long tasks, S and M, all cache states | summed and longest long-task time **0 ms in all 60 admission windows** | none > 50 ms, none > 100 ms | clean observation; the clause still needs a pass-scoped record |
| F5 chosen → placed p95, S cold / M cold | 809 ms / 1,368 ms | Target ≤ 2 s / ≤ 5 s (p95) | observed; the workloads are 12-triangle and ≈9k-triangle fixtures, not the 5/25 MiB budget files, and the end mark is the accepted ledger entry |
| F6 floor click → accepted p95, S cold / M cold | 50.6 ms / 47.6 ms (M warm 59.2, repeat 57.0) | completion p95 ≤ 33 / ≤ 50 ms | **not the contract's flow**: armed→accepted, not the sequenced drag's input-to-matching-preview; S exceeds its bound even as a proxy, and M's warm/repeat proxies exceed 50 ms |
| F9 Save local status p95 | 0.5 ms (cold) / 0.3 ms (warm and repeat) | presented local feedback p95 ≤ 100 ms | **not established**: DOM-update timestamps, not presentation |
| F9 durable receipt p95 (loopback N1) | 124.1 ms, 44,367 B wire | target formula | observed; loopback only, no service baseline |
| F13 heap growth over ten place/undo cycles | 2.66 MiB | ≤ 5 MiB | partial: one repeat-use context with ten cycles, Undo rather than Delete, no cold/repeat-use pair and no geometry/texture/live-context clauses |
| GPU memory at M | not measurable — Chromium exposes no per-page GPU allocation | ≤ 384 MiB hard | blocked (unchanged from S02) |
| Stage route first-load JS (br, cold) | **422.3 KiB** | ≤ 400 KiB hard | hard miss |

F2/F3/F4/F7/F8, F13's cold/repeat-use ten-cycle rows, the worker-thread split, Draco/KTX2, a real
>50 MiB decode, real R2 and worker-boundary timing remain unrun under the formal method.

## 6. What still blocks acceptance

```text
1. Stage first-load budget. 422.3 KiB br against ≤400 KiB — a 22.3 KiB hard miss. The owner must
   rule on the evidence-backed amendment; this record does not assume it.
2. Formal pass scope. S03's hard performance rows are defined by the pass-scoped bench method with
   a declared operator; the current evidence is per-flow, agent-run and has no manifest. F6's
   sequenced-drag flow, F9's presented feedback, F13's cold/repeat-use ten-cycle rows and GPU memory
   are not measured as defined.
3. Owner rows. Shell observations (offline retry, narrow desktop, reduced motion, keyboard-only
   transforms, accessible name/focus return), Draco/KTX2, a real R2 bucket and a real >50 MiB source
   remain owner-run/unrun. None is recorded as passed.
4. Product follow-up. A placed model has no named Index subject row; selection after deselection is
   through Arrange's chooser or the card. Recorded, not a gate claim.
```

No row above is recorded as a pass. The gate stays `NOT ACCEPTED`; T2.P02 stays active and is not
closable. Ordinary `slice-closeout` is not authorized by this record.

## 7. Next legal action

```text
1. Owner rules on the delivery budget (proposal: 422.3 ≤ 425, or the 450 planning alternative).
2. Owner rules how the formal performance rows are discharged (pass-scoped bench, operator, F6/F9
   method repairs, F13 coverage, GPU disposition), or records dispositions for the unrun rows.
3. Only after both rulings: re-run the affected rows, record a new verdict, then consider
   slice-closeout and merge authorization.
```
