# E0/C0 — instrumentation baseline

**Date:** 2026-11-13. **Branch:** `e0-instrumentation-characterization` (from `main` `b1a233ec`).
**Scope:** C0's baseline for the T1/T2 consolidation milestone. Every value below is either a direct
`countWork`/plan-stat output at a production call site (**counted**), or **unmeasured**. Nothing in
this table is inferred from code, an audit estimate or a frame cadence.

## How the counts were taken

The synthetic harness used the same production entry points the Stage uses, driven by a one-off
`vite-node` script (not committed) against a clean production build:

- **M / L:** the certified `grid-M` / `grid-L` workloads, opened through source admission, read in
  Plan, candidate preview ticked once, then one accepted Wall edit and one accepted Camera edit.
- **Scene:** the `counting-scene` fixture (`tests/lib/authoring/__fixtures__/counting-scene.ts`),
  prepared once. Its material and texture rows are a **synthetic sweep** of the production
  resolver/acquire functions over the fixture's renderable list; they are not a mounted Scene
  consumer measurement. Mounted per-entity material and texture work is **unmeasured**.

Counts are read through `installPerfWorkObserver`'s `__BISKIQ_PERF_WORK__.counts` and the
`paper:plan` representation stats. The mounted call-site tests in
`tests/lib/authoring/stage-counting.test.ts` assert the same names through the real callers.

## Fixture content

| Fixture | Walls | Rooms | Openings | Scene entities | Distinct looks | Textured primitives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `grid-M` | 112 | 49 | 112 | 0 | — | 0 |
| `grid-L` | 420 | 196 | 420 | 0 | — | 0 |
| `counting-scene` | 112 | 49 | 112 | 277 | 3 | 49 |

`counting-scene` is `grid-M` plus, per Room, three primitives (two sharing a look), one Form and one
textured primitive; plus 20 artworks of four sizes and 12 instances of one model. Distribution:
196 primitives, 49 Forms, 20 artworks, 12 models.

## Baseline

| Measurement | M | L | Scene | Class |
| --- | --- | --- | --- | --- |
| Frames at rest per second (`render:stage-frame`) | unmeasured | unmeasured | unmeasured | **unmeasured** |
| Compiles per preview tick | 1 compile: `compile:walls` 112, 112 openings, 49 rooms | 1 compile: `compile:walls` 420, 420 openings, 196 rooms | 1 compile: `compile:walls` 112 | counted |
| Candidate build per preview tick | `candidate:paper-build` 1, `paper:plan-build` 1 | `candidate:paper-build` 1, `paper:plan-build` 1 | not applicable (no live candidate) | counted |
| `scene:resolve` per accepted Wall edit | 1 | 1 | 1 | counted |
| `scene:resolve` per accepted Camera edit | 1 | 1 | 1 | counted |
| Paper segments after one accepted build | 3,612 | 13,692 (preparation) | 3,612 (layout) | counted |
| `paper:plan-build` / `paper:scene-build` per drawing revision | 1 / 1 | 1 / 1 | 1 / 1 | counted (mounted revision change) |
| `material:resolve` per full Scene material resolution (synthetic sweep) | 0 (no Scene entities) | 0 (no Scene entities) | 277 | counted, synthetic |
| `material:resolve` per mounted Scene render | unmeasured | unmeasured | unmeasured | **unmeasured** |
| `material:resolve` per accepted edit | unmeasured | unmeasured | unmeasured | **unmeasured** |
| `texture:variant-acquire` in the synthetic sweep | 0 | 0 | 554 calls, 4 distinct variants | counted, synthetic |
| `texture:variant-dispose` in the synthetic sweep | 0 | 0 | 4 | counted, synthetic |
| `texture:variant-acquire` / `dispose` per mounted Scene | unmeasured | unmeasured | unmeasured | **unmeasured** |
| `texture:variant-*` per accepted edit | unmeasured | unmeasured | unmeasured | **unmeasured** |
| `render:shadow-update` per accept / per second at rest | unmeasured | unmeasured | unmeasured | **unmeasured** |
| Live geometries / materials / textures | unmeasured | unmeasured | unmeasured | **unmeasured** |
| Draws per frame | unmeasured | unmeasured | unmeasured | **unmeasured** |

Notes:

- `candidate:paper-build` and `paper:plan-build` both increment for one candidate tick because the
  candidate builder calls the shared Plan builder; they are nested, not two independent builds.
- The mounted Stage test observes one `render:shadow-update` per shadow invalidation followed by a
  shadow-casting render. That is a controller-level count, not an accepted-edit or at-rest
  measurement, so the baseline row stays unmeasured.
- `render:stage-frame` counts Stage surfaces only. A Preview surface is counted separately as
  `render:preview-frame` (the one documented extra name) and is never reported as a Stage frame.
- The synthetic material/texture sweep calls the production functions once per fixture entity; a
  mounted Scene may acquire, reuse or release different numbers. No mounted value is inferred from
  the sweep. The fixture Opening inventory is asserted against `addOpenings` (112 of 112 eligible
  Walls), so the content table cannot drift silently.

## Browser evidence gap

The local production build succeeded (`npm run build`, 16.4 s) and answered on
`http://127.0.0.1:4173/` (HTTP 200). The D1-authorised `npm run perf:spot` did not produce a
measurable session in this environment:

- The first invocation failed before any session on a relative `page.goto`, a defect in the #273
  repair inside the spot runner; the absolute navigation is restored in `perf/spot.ts`.
- The bundled-Chromium invocation wrote a report with both tiers `incomplete` and zero sessions
  (load average 5.5 on an 8-core M2): M timed out after 300 s in `page.waitForFunction` during the
  post-upload Stage flow, and L's page was closed when the run was stopped. Report:
  `2026-11-13T21-14-20-592Z-spot.json` under the temporary `biskiq-spot` directory.
- Repeated headless launches (branded Chrome and bundled Chromium) hung in the same Stage flow with
  no report; the host also caps a synchronous command at 295 s. Further runs were stopped rather
  than retried, per D1's no-automatic-retry rule and the wall-clock cap.

Consequently the browser-only rows above are **unmeasured**: frames at rest, live
geometries/materials/textures, draws per frame, per-accept material/texture/shadow counts, and the
wall-clock spot baseline. They are not inferred from rAF cadence or from the audit. The deterministic
counts remain valid and are the acceptance lines E1/E4 consume.

## E5/G3 — Paper retention by responsibility

**Date:** 2026-11-13. **Branch:** `claude/e5-paper-retention` (from `main` `bc9d2662`, PR #318
merged). **Scope:** G3 step 1. Every value below is a `countWork` output at a production Paper call
site (**counted**), through the mounted `StagePaper` caller (grid-M) or through `buildPaperPlan` →
`createPaperScene` directly (grid-M and grid-L). No wall-clock share is inferred.

### Fixture content

| Fixture | Walls | Openings | Paper lines | Paper segments | Paper fills |
| --- | ---: | ---: | ---: | ---: | ---: |
| grid-M (`grid-7`) | 112 | 112 | 924 | 3,612 | 273 |
| grid-L (`grid-14`) | 420 | 420 | 3,220 | 13,692 | 1,036 |

### Counts per interaction

Both columns are increments for the interaction, measured after mount. The “before” column is the
pre-E5 caller at `main`, where `paperDrawingForSelection` produced a filtered drawing object for a
selected Opening; the “after” column is this change, which builds from the unfiltered drawing and
hides that source's instance runs.

| Interaction | Before: plan / scene | After: plan / scene | Class |
| --- | ---: | ---: | --- |
| Select an Opening | 0 / 1 | 0 / 0 | counted, mounted M |
| Deselect | 0 / 1 | 0 / 0 | counted, mounted M |
| Hover a subject | 0 / 0 | 0 / 0 | counted, mounted M |
| Pan (Camera move) | 0 / 0 | 0 / 0 | counted, mounted M: the Plan identity is retained |
| Zoom (viewport resolution) | 0 / 0 | 0 / 0 | counted, mounted M |
| Accept one Wall move (new Plan identity) | 1 / 1 | 1 / 1 | counted, mounted M |
| Initial mount | 1 / 1 | 1 / 1 | counted, mounted M |

At grid-L the same production builders give one `paper:plan-build` and one `paper:scene-build` per
drawing revision, and a selection hide/show adds neither: the L trace ran the mount build, a
`setHiddenSource(opening)` / `setHiddenSource(null)` pair, and one accepted-Plan rebuild, for
`paper:plan-build` = 2 and `paper:scene-build` = 2 over the whole sequence. M and L therefore have
the same interaction counts; only their content sizes differ.

### G3 step 2 — deferred, unmeasured

G3 step 2 (incremental Room/Wall Paper entries) is **deferred**: its gate is a trace showing Paper
is a material share of the post-commit cost for an accepted L edit, and that trace is **unmeasured**
here. The browser evidence gap above still holds (the D1-authorised spot flow did not produce a
session in this environment, and further headless launches were stopped rather than retried). The
count probe cannot attribute cost — its L run spends most of its wall clock outside Paper — so
Paper's share is neither measured nor declined; no conclusion is drawn either way. No incremental
cache, new cache key or second geometry path was added; the step-1 drawing remains the fallback and
the step-2 gate stays open for a later measured trace.
