# T2.P02.S03 — recovery attempt at `7d1212b6`

```text
AUTHORITY: NONE — the acceptance record still owns the gate verdict. This artifact records a repair
and re-run, not acceptance, not a phase close and not merge authorization.
STATUS:    RECOVERY IMPLEMENTED AND RE-RUN. T2.P02.S03 remains **NOT ACCEPTED**. The manipulation
           row and the empty-project leg are now demonstrably reachable; the Stage delivery budget
           still hard-misses and the formal owner-run performance rows are still unrun.
REVISION:  product and harness 7d1212b6, on the integrated base (main through e1870769 / #204,
           including the T1 #201 merge ce159a1e).
BASE:      origin/main e1870769 at merge time; main later advanced to b7e13fb0 (docs only).
PR:        #199, branch t2/p02-s03-integrated-final-gate. Not merged.
HISTORY:   the failed-gate record for a025e2dd and its evidence at ../evidence/2026-10-27 are
           preserved unchanged. This is a new revision with new evidence, never a reinterpretation
           of the old one.
```

## 1. Repairs

| Defect | Repair | Owning seam |
| --- | --- | --- |
| Compose disabled Resize and Duplicate for every placed creator model (“needs a verified contact”) | The approved resource's recorded `contactMinY` is read from the accepted envelope and supplied to `sceneComposeSupport`, in both the Compose instrument and the Card's Scale fact | `scene/placement.ts`, `SceneTransformInstrument.svelte`, `scene.adapter.ts` |
| Clicking `Resize…` opened and immediately cancelled the proposal | The opening control suppresses mouse focus; the replacement scale field receives focus; the transition's focusout is exempt while focus is handed over. Genuine blur still cancels synchronously | `SceneTransformInstrument.svelte` |
| An empty project's Place instrument refused a floor click silently | The instrument states that no Room floor exists yet and that Ink must draw an enclosure first; the Stage's empty-baseline note says the same | `SceneTransformInstrument.svelte`, `spatial/+page.svelte` |
| Import hashing pulled the glTF-Transform pipeline into the Stage route's first load | SHA-256 identity moved to `import/digest.ts`; only the worker imports `ingest.ts` | `import/digest.ts`, `import/ingest.ts`, `import/session.ts` |

The empty-project interpretation is **draw the enclosure, then import and place**. The guidance
says exactly that, and the evidence below proves the resulting journey persists a Room, one
resource and one entity. Whether the plan's “from an empty project” line is satisfied by that
journey remains an owner decision.

## 2. Evidence at `7d1212b6`

All runs used branded Google Chrome 156.0.8078.48 through the S03 supervisor, the ordinary
production build, the in-process API, a dedicated Postgres database (`biskiq_s03_recovery`) and
the in-memory object store. The machine is the designated MacBook Air M2 (Mac14,2), 16 GiB,
macOS 15.8.2, on AC power, Low Power Mode off.

```text
acceptance  2/2 tests, 38.3 s — perf/flows/s03-own-model-acceptance.spec.ts
diagnostics 4/4 tests, 46.3 s — perf/flows/s03-diagnostics.spec.ts
```

The acceptance journey now records and asserts:

- `afterResize`  `{ scale: 1.5, position: [1.25, 0, -0.5] }`
- `afterDuplicate` two entities, both scale 1.5, one shared `assetId`
- `afterDeleteModel` one entity remains
- no page errors in the journey pages (`errors: []`)

The added diagnostic records the truthful empty-project path:

```text
draw Ink enclosure → import/review/approve → place on the new floor
stored: { rooms: 1, resources: 1, entities: 1 }
guidance without a floor: "No Room floor yet — draw an enclosure with Ink, then click the floor…"
guidance after drawing:   the no-floor sentence is gone
```

The pre-repair empty-project diagnostic is retained beside it: same import, no floor, placement
refused, nothing stored, now with an explicit explanation instead of silence.

Raw artifacts live in [evidence/2026-10-27-recovery/7d1212b6](./evidence/2026-10-27-recovery/7d1212b6):
`journey.json`, `refusals.json`, the four diagnostic JSONs, `machine-facts.json`, the screenshots
and the bundle excerpts.

## 3. Verification contract

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings |
| `npx tsc --noEmit` (apps/editor) | exit 0 |
| `npm run build` | succeeded |
| `npm run test:arch` | 22 files / 180 tests, exit 0 |
| `npm run test:full` | 214 files / 2,655 tests, exit 0 |
| `npm run test:api` (dedicated DB) | 114 tests, 114 pass, 0 skipped, exit 0 |
| `check:api`, `check:project-model`, `check:layout-core`, `check:camera-core` | exit 0 each |
| `npm run perf:bundle` | exit 0; Stage route **456.7 KiB br JS** |

The focused regressions added or extended are
`tests/lib/authoring/scene-compose-instrument.test.ts` (approved-contact capability, focus
handoff, selection-change cancel, retired-service reporting) and the existing
`scene-instrument-focus.test.ts` (genuine blur still cancels synchronously).

## 4. What still blocks acceptance

```text
1. Stage first-load budget. 456.7 KiB br against the ≤400 KiB hard budget — a 56.7 KiB hard miss.
   Attribution at this revision (sourcemap build, per-package br): three(core) 155.9 KiB,
   layout-core 70.3 KiB, project-model 48.5 KiB, editor adapters 29.9 KiB, editor stage 21.9 KiB,
   svelte 20.3 KiB, three addons 18.5 KiB. The Stage is one persistent Canvas for Plan and 3D by
   architecture, so lazy-loading three would remove the Plan reading, not spare capability.
   The digest split removes the glTF pipeline from the route but does not move the total below
   the budget. This needs an owner disposition or a separate delivery-budget programme; it is not
   waivable by a failed final gate.
2. Formal performance rows. F3/F4/F8 at S/M, per-move evaluation, F2 open, F13 leak cycles, F6 as
   defined, shell observations, Draco/KTX2, real >50 MiB decode, real R2, worker-boundary timing
   and GPU memory were not run under the contract's formal method at this revision. The operator
   was the agent, no pass-scoped bench manifest exists and the hard rows require the owner as
   operator. These remain unrun, not passed.
3. Empty-project interpretation. The journey is now reachable as draw-then-place; the owner must
   confirm that this satisfies the plan's line or amend the line.
4. The remaining F6/method and budget decisions listed in the disposition are unchanged.
```

No row above is recorded as a pass. The gate stays `NOT ACCEPTED`; T2.P02 stays active and is not
closable. Ordinary `slice-closeout` is not authorized by this record.

## 5. Next legal action

```text
1. Independent re-review of 7d1212b6 and this evidence set.
2. Owner disposition of the ≤400 KiB budget and the formal performance rows at this revision.
3. If both are discharged positively, re-run the gate under the formal method and record a new
   acceptance verdict. Only then can slice-closeout or a merge be considered.
```
