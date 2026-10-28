# T2.P02.S03 — acceptance record: Integrated final gate — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records acceptance, deferrals and
           recovery. T2.P02 is closed; T2 is not complete.
STATUS:    ACCEPTED by owner ruling 2026-10-27 at b9ba493b; shipped through PR #199 under the P1
           merge rule. The Stage hard budget is amended to ≤425 KiB br JS.
SOURCE:    product, tests and harness b9ba493b; documentation head dc9a16de; trusted base e1870769
           (PR #204), including the T1 #201 merge ce159a1e.
TIER:      exhaustive; this gate is T2.P02's declared final gate.
DECISION:  ../../../../reference/decisions/t2-s03-acceptance-and-budget-amendment-2026-10-27.md
NOT:       T2 track completion, readiness, a gate version, publication/T4 work or deployment.
```

## Delivered

The integrated own-model creator journey: import one GLB with its maps, review the observed report,
confirm scale, pivot and footprint, approve, place, then move/turn, resize, duplicate and delete the
placed model. Two instances share one immutable revision with independent identity. Save/reopen in a
fresh session verifies the stored revision against its pins; Preview shows the placed mapped
derivative. The empty-project journey is owner-ruled as **draw the enclosure, then import and place**,
with explicit guidance. Oversize, malformed, cancelled, stale and project-replaced imports install
nothing; a retained revision survives while a stored version references it.

The exhaustive gate recorded the full repository contract and 3/3 branded-Chrome acceptance tests at
`b9ba493b`. The failed-gate and recovery history at earlier revisions is preserved in Git; the current
verdict is acceptance, not a reinterpretation of those runs.

## Evidence

- **Automated contract at `b9ba493b`:** `npm test` 215 files / 2,663 tests; `test:arch` 22 files /
  180 tests; `test:heavy` 11 files / 138 tests; `check` 0 errors / 0 warnings; `build` clean;
  `check:api`, `check:project-model`, `check:layout-core` and `check:camera-core` clean; `test:api`
  14 suites / 114 tests with **0 skips**; `perf:bundle` exit 0.
- **Browser acceptance at `b9ba493b`:** 3/3 tests in 45.8 s on the designated MacBook Air M2
  (16 GiB, macOS 15.8.2, battery, Low Power Mode off) in branded Google Chrome 156.0.8078.48, against
  the real in-process API, Postgres and object store. Evidence:
  [2026-10-27-head/b9ba493b](./evidence/2026-10-27-head/b9ba493b).
- **Delivery:** Stage route first-load JS **422.3 KiB br** (1,758.7 raw, 501.2 gzip; 428.4 all) passes
  the owner-amended **≤425 KiB br** hard row with **2.7 KiB headroom**. The former ≤400 row missed by
  22.3 KiB and remains history. The amendment is live in
  [performance.md](../../../../reference/components/performance.md) and is **not retroactive**:
  `T1.P02.S02`'s 456.0 KiB br at `64b9435d` remains a recorded miss at that revision.
- **Archived screenshots:** five byte-identical final PNGs, with the archive manifest at
  [CLOSED.md](../../../../archive/roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/evidence/2026-10-27-head/CLOSED.md).
  The JSON, logs and earlier revisions' artifacts remain live in the slice evidence directory.

## Deferred verification — no row is a pass

The owner deferred these families to the named owners. Deferral dispositions the acceptance
prerequisite; it does not turn an unmeasured or proxy row into evidence.

| Deferred family | Follow-up owner |
| --- | --- |
| F5 formal pass-scoped admission long tasks | T2 performance follow-up (T2 track) |
| F5 chosen → placed on the 5/25 MiB budget workloads | T2 performance follow-up (T2 track) |
| F6 as defined (sequenced drag, input-to-matching-preview and completion) | T2 performance follow-up (T2 track) |
| F9 presented local feedback and durable receipt | T2 performance follow-up (T2 track) |
| F13 cold/repeat-use ten-cycle rows, geometry/texture/live-context clauses | T2 performance follow-up (T2 track) |
| GPU memory at M | T2 performance follow-up (T2 track) |
| F2/F3/F4/F7/F8 formal method, worker-thread split and real-workload timing | T2 performance follow-up (T2 track) |
| Shell observations, Draco/KTX2, real R2, a real >50 MiB decode and worker-boundary timing | repository owner (owner-run), tracked by T2 |
| Placed model's own Index subject row | T2 track |
| Pointer move/turn decision | T2 track |

The clean F5 long-task observation and the other measured proxies stay observations. No performance
row is recorded or waived as a pass.

## Entry points

```text
implementation  apps/editor/src/lib/authoring/adapters/scene/import/{types,ingest,worker,worker-client,session,definitions}.ts
                apps/editor/src/lib/authoring/adapters/scene/import/ImportModelInstrument.svelte
                apps/editor/src/lib/authoring/adapters/scene/placement.ts
                apps/editor/src/lib/authoring/scene/model-bytes.ts
                apps/editor/src/lib/authoring/scene/plan-scene-footprint.ts
                apps/editor/src/lib/museum/assets/AssetModel.svelte
placement       packages/project-model/src/scene-planning/model-resource.ts
                packages/project-model/src/scene-planning/planners.ts
validation      apps/editor/perf/flows/s03-own-model-acceptance.spec.ts
                apps/editor/perf/flows/s03-diagnostics.spec.ts
                apps/editor/perf/run-s03-own-model-qa.mjs
regressions     apps/editor/tests/lib/authoring/scene-import-ingest.test.ts
                apps/editor/tests/lib/authoring/scene-model-render.test.ts
                apps/editor/tests/lib/authoring/scene-operation-acceptance.test.ts
                apps/editor/tests/lib/project-model/model-resource-admission.test.ts
                apps/editor/tests/lib/project-model/scene-operation-planners.test.ts
                apps/editor/tests/lib/platform/model-import-client.test.ts
                apps/api/tests/model-resources.test.mjs
```

## Residuals and ownership

- **Ten deferred verification/product families** are owned as the table above. None is a pass.
- **T1.P02.S02's performance family and 456.0 KiB br Stage miss** are historical. The 2026-10-28
  [performance-mandate suspension](../../../../reference/decisions/performance-mandate-suspension-2026-10-28.md)
  leaves the rows unmeasured, not passed, and removes any S04 performance prerequisite; this close
  neither adopts nor erases them.
- **No T2 successor is authorized.** The next T2 step is an owner planning/authorization decision for
  component identity/resolution/admission and revision correspondence, then attachment and
  materials/light depth.
- **T2.P02.S03 is one closed phase child**, not T2 chain completion and not a `TRACK COMPLETE` event.

## Recovery

```text
git show 221facc4252b680695084765a2b97f35097d7b94:docs/roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/acceptance.md
anchor  221facc4 (the full acceptance body, plan, disposition and both recoveries are present here)
 tag    closed/T2.P02.S03 → 221facc4 · closed/T2.P02 → 221facc4 (pushed after the P1 merge)
 merge  PR #199 — P1 merge commit (no squash, no rebase)
```

## Preservation report

```text
CLOSEOUT PRESERVATION — T2.P02.S03, phase-close compaction (2026-10-27)
prose compacted:                 5   acceptance, implementation plan, disposition and both recovery
                                     records → stubs at their own paths
reference promotions:            2   decision record; performance.md Stage row and amendment note
renderable evidence archived:    5 files / 853,144 bytes (833.1 KiB)   final b9ba493b PNGs,
                                     byte-identical copies
evidence stubs / manifests:      1   archive manifest at the copied bundle
transient artifacts removed:     0
historical anchor:               221facc4 · tags closed/T2.P02.S03 and closed/T2.P02 (pushed after
                                     the P1 merge) · merge PR #199
new live → archive prose links:  0
manual-owed verification rows:   10 families deferred above; no row is a pass
remaining deferred items:        10 deferred families; next T2 planning/authorization; T1.P02.S02's
                                     family stays with T1.P02.S04
permanent stubs added:           5   (the owner-ratified cost: one per closed prose artifact)
```

The plan review and the ruled budget proposal remain live as the gate's plan/evidence record. The
documentation cross-reference gate passed after the move.
