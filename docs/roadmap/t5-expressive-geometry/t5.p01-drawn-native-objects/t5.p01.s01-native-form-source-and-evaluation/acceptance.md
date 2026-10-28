# T5.P01.S01 — acceptance record: Native form source and evaluation

**Slice:** T5.P01.S01 · **Status:** implemented on `t5/p01-s01-native-form-source`; verified at
implementation head `3e85149f`; **one hard performance row is missed** (Stage first-load JS) and is
carried to the owner; owner acceptance is pending · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[T5.P01](../README.md)

This record states what was measured and what was not. It claims no owner acceptance, merge or
capability entry.

## What landed

- `@portfolio/geometry-core` (new runtime-safe package): exact profile validation, smooth-anchor
  sampling, earcut triangulation with positive-orientation acceptance, extrusion into a closed
  regioned mesh, footprint/contact/bounds, and a stable `formMeshDigest`.
- Scene unit format 4 with the `form` entity: types, strict reader, canonical writer, unit
  validation, API envelope and fixtures; format 3 is refused with no converter.
- Scene planners `create-form` and `set-form-size`; form support in move, turn, place-on-floor,
  duplicate, delete and floor-support resolution; `resize-on-floor` refuses forms;
  `form.scale`/`position[1]` dotted record-scope grants.
- One editor evaluation cache (bounded LRU, keyed by canonical source + evaluator version), the
  `EntityForm` renderer with metre UVs and computed normals, lazy Stage/Preview dispatch, the
  evaluated XZ ring on the Plan footprint/hit seam, read-only Card bounds, Compose gating
  (Duplicate yes, uniform Resize no), and a cold-release refusal for forms.

## Merge-gate evidence

All commands ran at `3e85149f` on this machine (Apple M2, macOS 15.8.2, Node v26.7.0), not the
performance reference laptop A.

| Command | Result |
| --- | --- |
| `npm run check` (editor `svelte-check`) | exit 0 — 0 errors, 0 warnings |
| `npm run check:geometry-core` / `check:project-model` / `check:layout-core` / `check:api` | all exit 0 |
| `npm test` (`apps/editor`, full suite = fast + arch + heavy) | exit 0 — 223 files, 2 843 tests passed, 0 failed |
| `npm run build` (repo root) | exit 0 |
| `npm run test:api` (real Postgres, `biskiq`) | exit 0 — 14 files, 115 tests passed, **0 failed, 0 skipped** |

The editor suite includes the architecture lane: `geometry-core-boundary` (dependency direction and
canonical-arithmetic scan), `visitor-cold-runtime`, `preview-surface-boundary`,
`preview-surface-closure`, `visitor-identity-isolation`, the documentation reference lane and the
package-direction checks.

## Dependencies and goldens

- `robust-predicates@3.0.3` — Unlicense (public-domain dedication); `orient2d` only.
- `earcut@2.2.4` — ISC; triangulation only.
- No other runtime dependency. `packages/geometry-core/package.json` declares exactly these two.
- Golden set: 48 pinned `formMeshDigest` values (`gc1-…`) at `GEOMETRY_CORE_EVALUATOR_VERSION = 1`
  in `apps/editor/tests/lib/geometry-core/__fixtures__/goldens.ts`.
- Corpus: 48 valid sources and 27 invalid ones, one per issue code plus touching/overlapping/
  collinear-run cases. Every valid source is checked closed, edge-paired in opposite directions,
  Euler characteristic 2, **positive signed volume**, unit normals, region coverage, footprint and
  contact consistency, and its pinned digest.

## Performance

**Evaluation (pre-flight, developer machine — not reference laptop A, not the owner-run browser
workflow).** Node microbenchmark of `evaluateProfile` + `extrudeProfile`, 30 warm-up + 200 samples:

| Case | Median | p95 |
| --- | --- | --- |
| 32 all-smooth anchors (64 profile points), plan | 0.068 ms | 0.092 ms |
| 256 all-smooth anchors (512 profile points) | 0.447 ms | 0.615 ms |
| Worst simple source found: 256-anchor star, 2 048 profile points | 2.411 ms | 2.668 ms |
| `set-form-size` path on the same 2 048-point source | 2.395 ms | 2.641 ms |

All are under the per-edit ≤ 4 ms S row on this machine.

**Not measured:** commit and Undo/Redo ≤ 100 ms, the M fixture cold open with 60 forms, and any
browser/GPU row. Those rows belong to the owner-run Playwright/CDP workflow and are **carried, not
passed**.

**Delivery rows (production build, `apps/editor/perf/bundle-report.mjs`).** The true slice base was
built at `98449a44` with the same tool:

| Row | Base `98449a44` | HEAD | Budget | Disposition |
| --- | --- | --- | --- | --- |
| Stage first-load JS (br) | 422.3 KiB | **430.5 KiB** | ≤ 425 KiB **Hard** | **MISS by 5.5 KiB** |
| Visitor `/p` first-load JS (br) | 337.9 KiB | 344.5 KiB | ≤ 250 KiB target now, hard at T4 | target already missed at base; S01 adds 6.6 KiB |

The Stage growth is the slice's, not a stale base: the Scene planners registered on the Stage route
statically require the kernel (`create-form`, `set-form-size`, form contact for move/turn/place/
duplicate), so `@portfolio/geometry-core` plus `earcut` (~2.7 KiB br) and `orient2d` (~1.6 KiB br)
enter first load. The plan's §9 expected near-zero growth because "form code is lazy"; that holds
for the renderer, not for the planners. Per plan §11 this is a **hard-row miss and a stop-and-report
condition**; no byte-shaving or architecture change was made inside this slice. Owner options are
recorded in the PR: amend the row, move planner registration behind a lazy host step (T1 host
change), or split the kernel's evaluation/triangulation from validation.

## Independent review

Two independent reviewer agents reviewed the kernel/Scene/planner half and the editor/docs/evidence
half. Both returned **approve with findings**; none was a code-level blocker. Findings and
resolutions:

- Form history/Undo/Redo/Save/reopen evidence was missing → added a real F.4 coordinator journey:
  one history entry per accepted create/size, exact Undo and Redo, a refused no-op that writes
  nothing, and Save → cold reopen with identical canonical bytes and an identical mesh digest.
- Outline keys were truncated to 32 bits in the canonical result → `pointEdgeKeys`/`segmentKeys`
  are now `Float64Array`; a key above 2^32 round-trips and reaches the mesh exactly.
- Admission accepted a body the renderer could not evaluate → the reader now evaluates the admitted
  body and refuses `invalid_form_body` when the kernel refuses it (e.g. scaled dimension > 100 m).
- `materialInstanceId` was declared but refused on forms → admitted and canonically written.
- Card/Compose contact bypassed the one cache → now read from `evaluateFormMesh`.
- Form geometry was rebuilt for every unrelated accepted edit → keyed reuse on
  `formEvaluationKey`; unchanged sources keep the same buffers.
- Triangulation normalized a negative earcut triangle instead of refusing → now refuses.
- Corpus did not assert positive signed volume; the form planner had no yaw case; the create-form
  planner lacked the typed error boundary; the LRU recency claim was untested; the cold-release
  refusal was only unit-tested → all added or fixed.
- Copy/ownership comment overclaimed → the adapter now owns its index buffer.
- Plan footprint wording overclaimed a production Plan pointer-hit path → the reference now states
  the seam is exposed and unit-tested while this base has no production Plan pointer-hit consumer.

**Known limitations recorded, not waived:** the closing side quad mirrors its texture across one
quad (per-vertex arclength on a closed ring; documented at the adapter; Low); the Agent E2E row
(open a fixture with forms, select, move/turn/duplicate/delete, Undo, Save, reload, Preview) was
**not run**; T2 review of the Scene changes and T4 review of the cold-release refusal are still
owner/peer review actions.

## Criteria

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Corpus valid/invalid closure and typed refusals | met |
| 2 | Pinned goldens, determinism scan, two-library import boundary | met |
| 3 | Scene format 4 canonical read/write; format 3 and malformed forms refuse | met |
| 4 | Both planners; existing operations on forms; record scope | met |
| 5 | Undo, Redo, Save and cold reopen exact | met (host journey + digest) |
| 6 | Stage, Plan and Preview draw and select the same result | drawing met through one renderer; the Plan footprint/hit seam is proven but has no production pointer consumer in this base; 3D pointer picking of Scene entities does not exist here |
| 7 | Visitor isolation, package direction, cold-release refusal | met |
| 8 | Performance rows recorded | evaluation rows recorded pre-flight; browser/commit/Undo rows carried; **Stage hard row missed** |
| 9 | Complete merge-gate contract | met (table above; DB-backed API with zero skips) |
| 10 | Reference updates in the same PR | met |
