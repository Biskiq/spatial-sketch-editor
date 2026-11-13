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
  prepared and rendered once, then released.

Counts are read through `installPerfWorkObserver`'s `__BISKIQ_PERF_WORK__.counts` and the
`paper:plan` representation stats. The mounted call-site tests in
`tests/lib/authoring/stage-counting.test.ts` assert the same names through the real callers.

## Fixture content

| Fixture | Walls | Rooms | Openings | Scene entities | Distinct looks | Textured primitives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `grid-M` | 112 | 49 | 112 | 0 | — | 0 |
| `grid-L` | 420 | 196 | 420 | 0 | — | 0 |
| `counting-scene` | 112 | 49 | 0 | 277 | 3 | 49 |

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
| `material:resolve` per full Scene material resolution | 0 (no Scene entities) | 0 (no Scene entities) | 277 | counted |
| `material:resolve` per accepted edit | unmeasured | unmeasured | unmeasured | **unmeasured** |
| `texture:variant-acquire` per Scene mount | 0 | 0 | 554 calls, 4 distinct variants | counted |
| `texture:variant-dispose` on full release | 0 | 0 | 4 | counted |
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
