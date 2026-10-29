# T5.P01.S03 — acceptance record: Integrated final gate

```text
AUTHORITY: NONE — the phase README owns slice status and order; this record owns the final-gate
           verdict, evidence and residuals. T5.P01 is CLOSABLE, not closed.
STATUS:    ACCEPTED 2026-10-28 under the owner's release and final-gate direction. Routine closeout
           is recorded; the slice requires its P1 merge (PR #218, no squash or rebase). T5.P01 stays
           in-progress until a separate owner phase-close instruction.
SOURCE:    trusted base c13a949d (PR #216 merge); tested final product/test revision
           9bcbd7ebe4142d59d2b82d6ef428e7ffdcbfde4c; documentation and evidence follow.
TIER:      exhaustive. This is T5.P01's declared FINAL PHASE GATE and the integration route of
           S01, S02 and S04.
DECISION:  the owner released S03, directed execution of its approved exhaustive plan, authorized
           one perf:spot checkpoint, and directed that a pass mark the gate accepted and T5.P01
           closable. No phase closure, track completion, deployment or performance pass is claimed.
NOT:       T5.P01 closure, T5 completion, a performance pass, a Wall-face delivery or a reopening
           of settled S01/S02/S04 implementation.
```

## Delivered

The integrated gate proved drawn native objects end to end on the merged tree, with no product
feature added. It re-proved the behavior independently of the contributing slices' own acceptance
evidence; no separate GitHub reviewer verdict is claimed. From an empty project: a Room was closed and reversed through Undo/Redo; floor
rectangle, floor triangle and upright-sheet elevation forms were drawn, read and created with
typed depth; Move, Turn, Size per axis, Duplicate and Delete each produced one exact history entry;
no-op, self-crossing, cancelled-depth and out-of-range-depth paths added none; the rectangle was
saved to My Objects; Experience and Capture were created; Save and cold reopen preserved every
entity and golden form digest; Plan and 3D produced identical rendered geometry and every form was
picked in Plan; Preview reproduced the same geometry without changing source; Scene format 3 and a
malformed form were refused without changing the project.

The two-project owner journey then inserted the saved item into a starter project as an editable
copy with the exact authored source and no item reference, reversed the insertion exactly, created
a second independent copy, refined one copy without changing the item or project A, saved and
cold-reopened project B, deleted project A while the item and B's copies survived, and removed the
item while B's copies stayed editable and B still saved.

## Evidence

**Repository contract at `9bcbd7eb`** (raw logs and the full bundle are linked below):

```text
test:full                232 files / 2,938 tests passed, 0 skipped
test:fast                198 files / 2,612 tests passed
test:heavy                11 files /   138 tests passed
test:arch                 23 files /   188 tests passed (unconditional)
check                     0 errors / 0 warnings
check:geometry-core       clean
check:layout-core         clean
check:project-model       clean
check:camera-core         clean
check:api                 clean
test:api (real Postgres)  6 passed / 0 failed / 0 skipped
build (editor)            succeeded
build:api                 succeeded
```

**Browser acceptance at `9bcbd7eb`:** 3 Chromium journeys / **27 of 27 scenario rows passed**, with
revision, `1440x900` viewport and reduced-motion state recorded on every row. The starter journey
used reduced motion; the other two used the normal setting. Playwright Chromium
`153.0.8010.12`; real API and PostgreSQL. The cold-release refusal is carried by the
unconditional suite (`visitor-cold-runtime.test.ts`: native form refused in a cold release and in
release composition), alongside the format and malformed-form refusals in the browser journey.

**Golden digest parity at `9bcbd7eb`:** the 48 valid corpus forms produce one identical pin and all
27 invalid profiles return the same typed refusals in V8 (`Node v26.7.0`), JavaScriptCore
(WebKit 26.6) and SpiderMonkey (Firefox 155.0). No golden mismatch.

```text
pin 9679388d3437d929db09ac0de1267bd920a89a707f582bfd53386e4a1cd892e3  (all three engines)
```

**Performance recheck:** one authorized `npm run perf:spot` ran at `9bcbd7eb` with verified runner
and preview provenance. It produced `not-usable` for both M and L. Raw numbers and the load
context are in the evidence bundle; the run began at load average 9.10 on the 8-core M2 and the
harness cannot attribute that load. No second session was permitted for an over-threshold result.
This is **measured, unfavorable evidence, not a performance pass**; the comprehensive matrix stays
suspended and every unmeasured row stays unmeasured.

### Links

- [Evidence bundle and contract/browser/spot details](./evidence/2026-10-28/9bcbd7eb/README.md)
- [Browser JSON](./evidence/2026-10-28/9bcbd7eb/browser/t5-p01-s03-integrated-evidence.json)
- [Digest parity JSON](./evidence/2026-10-28/9bcbd7eb/digest-parity.json)
- [Raw spot JSON](./evidence/2026-10-28/9bcbd7eb/perf/spot-9bcbd7eb.json)
- [SHA-256 manifest](./evidence/2026-10-28/9bcbd7eb/SHA256SUMS)
- [Archived screenshots — 18 files / 2,579,018 bytes](../../../../archive/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/evidence/2026-10-28/9bcbd7eb/CLOSED.md)
- [Integration harness](../../../../../apps/editor/perf/flows/t5-p01-s03-integrated-final-gate.spec.ts)
- [Digest parity runner](../../../../../apps/editor/perf/digest-parity.mjs)

## Coverage against the approved scope

| Scope item | Result |
| --- | --- |
| Draw/read/depth/create on floor and upright sheet | Passed: floor rectangle, floor triangle, upright elevation form |
| Wall-face creation | Not delivered by S02; waits for T1's face-frame query. Not claimed |
| Place, turn, size per axis, duplicate, delete | Passed with exact Undo/Redo; all three bodies accept the shared operations |
| Refused, cancelled, stale and no-op edits add no history | Passed for no-op, self-crossing, depth cancel and depth range; stale paths remain covered by the unconditional planners/acceptance suites |
| Save + cold reopen with identical golden digests | Passed for project A, project B and the starter |
| Two-project My Objects reuse and independence | Passed end to end, including delete A / remove item survival |
| Plan, 3D and Preview agreement | Passed: identical world matrices, Plan picking, Preview does not write |
| Format 3 and malformed-form refusal | Passed; project unchanged |
| Cold-release refusal of forms | Passed in the unconditional suite |
| V8 and non-V8 golden parity | Passed in V8, WebKit and Firefox |
| Owner walkthrough: three objects, one reused through My Objects | Passed |

## Entry points

```text
implementation  packages/geometry-core/src
                packages/project-model/src/scene*.ts, scene-codec, scene-planning
                apps/editor/src/lib/authoring/adapters/scene
                apps/editor/src/lib/authoring/adapters/scene/library
                apps/api/src/form-library.ts
validation      apps/editor/perf/flows/t5-p01-s03-integrated-final-gate.spec.ts
                apps/editor/perf/digest-parity.mjs
regressions     apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts
                apps/editor/tests/lib/content/form-evaluation.test.ts
                apps/editor/tests/lib/geometry-core/**
                apps/editor/tests/lib/authoring/scene-operation-acceptance.test.ts
                apps/api/tests/form-library.test.mjs
```

The delivered behavior and its narrower evidence remain owned by the S01, S02 and S04 acceptance
records. This gate reuses their evidence and does not rewrite it.

## Residuals and ownership

- **T5.P01 phase close:** not authorized here. The next decision is the owner's separate
  phase-close instruction.
- **Wall-face placements:** wait for T1's face-frame query; the approved upright-sheet route is
  what S02 delivered and this gate exercised.
- **S04 residual edges:** Save abort/cancel, API-level oversize, CORS `Expose-Headers`, a
  concurrent 1,000-item lock stress and a stacked-floor support fixture remain unexercised. They
  are not claimed by this gate.
- **Performance:** the one authorized spot measured `not-usable` M/L under load; the comprehensive
  matrix is suspended, and no unmeasured row is a pass.
- **Preserve:** the side-quad texture seam; T4 owns the visitor `/p` first-load target.

## Recovery

```text
full plan        git show c13a949d:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/implementation-plan.md
policy           docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/acceptance.md (this live final-gate artifact)
anchor           c13a949d — full approved plan body on main
merge            PR #218 — P1 merge commit required for this slice; no squash or rebase
tag              closed/T5.P01.S03 after the P1 merge, on the commit carrying this acceptance body
```

The gate artifact stays live while it is the phase-close evidence. The plan is compacted to the
stub at its own path; the acceptance record is not stubbed.

## Preservation report

```text
CLOSEOUT PRESERVATION — T5.P01.S03 (2026-10-28)
prose compacted:                 1   implementation plan → stub at its own path
reference promotions:            0   no new durable reference conclusion beyond the acceptance record
renderable evidence archived:    18 files / 2,579,018 bytes (2.46 MiB), byte-identical copies
evidence stubs / manifests:      1   archive CLOSED.md plus live SHA256SUMS
transient artifacts removed:     0
historical anchor:               c13a949d · full plan body; final-gate acceptance stays live
new live → archive prose links:  0
manual-owed verification rows:   2   M/L spot labels (not a performance pass) and the suspended matrix
remaining deferred items:        4   owner phase close; Wall-face query; S04 residual edges; T4 visitor target
permanent stubs added:           1   implementation plan (owner-ratified hybrid-preservation cost)
```
