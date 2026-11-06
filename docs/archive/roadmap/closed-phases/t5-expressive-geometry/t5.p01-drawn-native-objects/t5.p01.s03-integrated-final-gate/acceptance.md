# T5.P01.S03 — acceptance record: Integrated final gate — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns lifecycle; this stub records the accepted gate, the
           owner-ratified phase close, evidence, residuals and exact recovery.
STATUS:    ACCEPTED 2026-10-28 at 9bcbd7eb; shipped through PR #218 (P1 merge 25e1bd8f).
           T5.P01 closed 2026-10-28 by owner ruling. T5 remains approved and is not complete.
SOURCE:    trusted base c13a949d (PR #216 merge); tested product/test revision
           9bcbd7ebe4142d59d2b82d6ef428e7ffdcbfde4c.
TIER:      exhaustive; the declared FINAL PHASE GATE of T5.P01.
DECISION:  the owner released S03, authorized one perf:spot checkpoint, accepted the passed gate,
           then directed the raw evidence and capture scripts to be pruned and invoked the phase
           close. No track completion, deployment or performance pass is claimed.
NOT:       T5 completion, a performance pass, a Wall-face delivery or a reopening of settled
           S01/S02/S04 implementation.
ANCHOR:    da091a7f (full acceptance body) · 574a823b (raw evidence) · c13a949d (full plan).
```

## Delivered

The integrated gate proved drawn native objects end to end. From an empty project: Room close with
Undo/Redo; floor rectangle, floor triangle and upright-sheet elevation forms created with typed
depth; Move, Turn, Size per axis, Duplicate and Delete each one exact history entry; no-op,
self-crossing, cancelled-depth and out-of-range-depth refusals adding none; Save to My Objects;
Experience and Capture; Save and cold reopen with identical entities and golden digests;
Plan/3D/Preview agreement; Scene format 3 and malformed-form refusal.

The two-project journey inserted the saved item into a starter as an editable copy with the exact
source and no item reference, reversed it exactly, made a second independent copy, refined one copy
without changing the item or project A, saved and cold-reopened B, deleted A while the item and B's
copies survived, and removed the item while B's copies stayed editable and B still saved.

## Evidence

**Repository contract at `9bcbd7eb`:** `test:full` 232 files / 2,938 tests (0 skipped); `test:fast`
198 / 2,612; `test:heavy` 11 / 138; `test:arch` 23 / 188; root `check` 0 errors / 0 warnings;
geometry-core, layout-core, project-model and camera-core checks clean; `check:api` clean; DB-backed
`test:api` 6 passed / 0 skipped; editor and API builds succeeded.

**Browser acceptance:** 3 Chromium journeys / **27 of 27 rows passed** at 1440x900, with the starter
journey in reduced motion. The unconditional suite carries the cold-release form refusal.

**Golden parity:** one identical pin in V8 (Node v26.7.0), JavaScriptCore (WebKit 26.6) and
SpiderMonkey (Firefox 155.0); 48 valid forms, 27 typed refusals, zero golden mismatches. Pin
`9679388d3437d929db09ac0de1267bd920a89a707f582bfd53386e4a1cd892e3`.

**Performance recheck:** one authorized spot produced `not-usable` M and L with verified
provenance, beginning at load average 9.10 on the 8-core M2. The harness cannot attribute that load
and no second session was permitted. This is measured, unfavorable evidence, **not a performance
pass**; the comprehensive matrix stays suspended and unmeasured rows stay unmeasured.

**Retained evidence:** no raw evidence remains live. The 18 browser screenshots (2,579,018 bytes),
raw JSON/data, logs, manifest, evidence index and capture scripts were pruned from the final tree at
owner direction; recover them from Git at `574a823b` and `9bcbd7eb`.

```text
screenshots     git show 574a823b:docs/archive/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/evidence/2026-10-28/9bcbd7eb/CLOSED.md
raw evidence    git show 574a823b:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/evidence/2026-10-28/9bcbd7eb/browser/t5-p01-s03-integrated-evidence.json
harness         git show 9bcbd7eb:apps/editor/perf/flows/t5-p01-s03-integrated-final-gate.spec.ts
```

## Entry points

```text
implementation  packages/geometry-core/src
                packages/project-model/src/scene*.ts, scene-codec, scene-planning
                apps/editor/src/lib/authoring/adapters/scene
                apps/editor/src/lib/authoring/adapters/scene/library
                apps/api/src/form-library.ts
regressions     apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts
                apps/editor/tests/lib/content/form-evaluation.test.ts
                apps/editor/tests/lib/geometry-core/**
                apps/editor/tests/lib/authoring/scene-operation-acceptance.test.ts
                apps/api/tests/form-library.test.mjs
```

The delivered behavior and narrower evidence remain owned by the S01, S02 and S04 acceptance stubs.

## Residuals and ownership

- **Wall-face placements:** wait for T1's face-frame query; the delivered upright route is the
  approved hand-aligned sheet.
- **S04 residual edges:** Save abort/cancel, API-level oversize, CORS `Expose-Headers`, a concurrent
  1,000-item lock stress and a stacked-floor support fixture remain unexercised. Not claimed.
- **Performance:** the spot labels are unfavorable and environment-limited; the comprehensive
  matrix is suspended, and no unmeasured row is a pass.
- **Pruned evidence:** use the Git anchors below; this stub is not a raw-data store.
- **Preserve:** the side-quad texture seam; T4 owns the visitor `/p` first-load target.
- **T5:** no successor phase is registered. Next is owner T5 planning/authorization.

## Recovery

```text
full plan        git show c13a949d:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/implementation-plan.md
full gate body   git show da091a7f:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/acceptance.md
raw evidence     git show 574a823b:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/evidence/2026-10-28/9bcbd7eb/browser/t5-p01-s03-integrated-evidence.json
screenshots      git show 574a823b:docs/archive/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/evidence/2026-10-28/9bcbd7eb/CLOSED.md
capture harness  git show 9bcbd7eb:apps/editor/perf/flows/t5-p01-s03-integrated-final-gate.spec.ts
                 git show 9bcbd7eb:apps/editor/perf/digest-parity.mjs
merge            PR #218 — P1 merge 25e1bd8f (no squash or rebase)
phase close      owner ruling 2026-10-28; PHASE CLOSE block in the phase README
tags             closed/T5.P01.S03 → da091a7f (last full acceptance body)
                 closed/T5.P01 → the phase-close P1 merge commit
```

## Preservation report

```text
PHASE-CLOSE PRESERVATION — T5.P01 (2026-10-28)
prose compacted:                 1   final-gate acceptance → this closed stub; plan already stubbed
reference promotions:            0   no new durable reference conclusion
renderable evidence archived:    0   18 screenshots (2,579,018 bytes) pruned at owner direction
evidence stubs / manifests:      0   archive CLOSED.md pruned with the screenshots
transient artifacts removed:     18 screenshots + 1 archive manifest; raw JSON/data, logs and capture
                                     scripts were already pruned in S03 close
historical anchor:               da091a7f full gate · 574a823b raw evidence · c13a949d plan
new live → archive prose links:  0
manual-owed verification rows:   2   M/L spot labels (not a performance pass) and the suspended matrix
remaining deferred items:        3   Wall-face query; S04 residual edges; T4 visitor target
permanent stubs added:           1   final-gate acceptance (owner-ratified hybrid-preservation cost)
phase state:                     PHASE CLOSE closed ✓ · track phase row shipped ✓ · baton no active T5 phase ✓
```
