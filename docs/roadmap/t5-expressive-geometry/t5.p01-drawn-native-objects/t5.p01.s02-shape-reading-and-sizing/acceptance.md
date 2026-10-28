# T5.P01.S02 — acceptance record — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records acceptance, evidence,
           residuals and exact recovery. T5.P01 remains active; S03 is its outstanding final gate.
STATUS:    accepted by reviewed evidence 2026-10-28; shipped through PR #215 by P1 merge commit.
SOURCE:    product head e28ed2e4f65c382af863fd9ac32b586db7f910ec; trusted main 85e675a6a47243808069b6d91d635fcfd55c43d3.
TIER:      architecture-integration; final-head repository and Chromium evidence recorded below.
DECISION:  owner released S02 and authorized acceptance, routine closeout and P1 merge on 2026-10-28,
           conditional on clean reviews and satisfied repository gates.
NOT:       S03 acceptance, S04 release, phase closure, T5 completion or a performance pass.
ANCHOR:    a6ef05b4e5d30fc2ce9711140057b6e38d201741 (full acceptance, plan and final review bodies).
```

## Delivered

One Ink task contributes Layout Wall/Opening and Scene Shape readings through adapter-owned sessions. Shape creation supports floor and hand-aligned upright sheets, ray or typed depth, and the existing `create-form` planner. Selected forms support per-axis ray sizing and exact Card values through `set-form-size`. Preview, Undo/Redo, save/reload and identity behavior were exercised. No planner, codec, format, F4, Head, Save, Camera or new gate/capability entry changed.

## Evidence

T1 and T2 independently returned **PASS** at the product head; no implementation finding remains. At `e28ed2e4f65c382af863fd9ac32b586db7f910ec`: full `npm test` passed (229 files / 2,907 tests); arch passed (23 / 188); root check had 0 errors and 0 warnings; root build and Layout, project-model, Camera and API checks/builds passed; DB-backed API passed 6 / 0 skipped. Chromium passed 3 specs and 21 scenario rows, with one intentional Preview-availability not-run. The documentation gate passed 2 files / 56 tests after closeout.

- [Final-head raw logs, browser JSON, machine facts and SHA-256 manifest](./evidence/2026-10-28/final-head-e28ed2e4/README.md)
- [Earlier diagnostic browser JSON](./evidence/2026-10-28/ux-review/t5-p01-s02-ux-evidence.json)
- [Archived byte-identical screenshots and hashes](../../../../archive/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s02-shape-reading-and-sizing/evidence/2026-10-28/CLOSED.md)

The Preview-availability not-run row is intentional: Preview requires an Experience, which a separate journey created before exercising Preview. No performance benchmark was run or authorized. Suspended performance rows remain unmeasured, never passes.

## Entry points

```text
implementation  apps/editor/src/lib/authoring/stage/stage-facade.ts
                apps/editor/src/lib/authoring/adapters/layout.adapter.ts
                apps/editor/src/lib/authoring/adapters/scene.adapter.ts
                apps/editor/src/lib/authoring/adapters/scene/shape/
validation      apps/editor/tests/lib/authoring/shape-outline.test.ts
                apps/editor/tests/lib/authoring/shape-reading-adapter.test.ts
                apps/editor/tests/lib/authoring/shape-palette.test.ts
regressions     apps/editor/tests/lib/authoring/stage-facade.test.ts
                apps/editor/tests/lib/authoring/stage-host-acceptance.test.ts
                apps/editor/tests/lib/authoring/stage-session.test.ts
```

## Residuals and ownership

- Wall-face drawing waits for T1's face-frame query; S02 uses the approved hand-aligned upright sheet.
- T5.P01.S03 remains the outstanding exhaustive final gate, including browser matrix and suspended, unmeasured performance rows. S04 remains separately proposed and unreleased.
- Preserve the existing side-quad texture seam carryover. T4 still owns the visitor `/p` first-load target.

## Recovery

```text
git show a6ef05b4e5d30fc2ce9711140057b6e38d201741:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s02-shape-reading-and-sizing/acceptance.md
git show a6ef05b4e5d30fc2ce9711140057b6e38d201741:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s02-shape-reading-and-sizing/implementation-plan.md
git show a6ef05b4e5d30fc2ce9711140057b6e38d201741:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s02-shape-reading-and-sizing/boundary-review.md
anchor  a6ef05b4e5d30fc2ce9711140057b6e38d201741 · tag closed/T5.P01.S02 (push after P1 merge)
merge   PR #215 — P1 merge commit; no squash or rebase
```

## Preservation report

```text
CLOSEOUT PRESERVATION — T5.P01.S02 (2026-10-28)
prose compacted:                 3   acceptance, implementation plan and final boundary review → stubs
reference promotions:            0   durable conclusions already have their owning references
renderable evidence archived:   31 files / 4,028,434 bytes (3.84 MiB), byte-identical copies
evidence stubs / manifests:      1   CLOSED.md at the archived screenshot bundle
transient artifacts removed:     0
historical anchor:               a6ef05b4e5d30fc2ce9711140057b6e38d201741 · tag closed/T5.P01.S02 (push after P1 merge)
new live → archive prose links:  0
manual-owed verification rows:   0   one intentional Preview-availability not-run; no performance pass claimed
remaining deferred items:        5   Wall-face query; S03 exhaustive gate/browser/performance obligations;
                                     side-quad texture seam; T4 visitor first-load target; S04 unreleased
permanent stubs added:            3   (owner-ratified hybrid-preservation cost)
```
