# T1.P02.S06 — characterization from Bench 1

**Status:** optimize step, characterization (plan C, sequence step 3), 2026-10-25. It reads
[Bench 1](./acceptance.md#bench-1-results-owner-directed-counted-under-a7) (`1c5e530c`, owner-counted
under A.7) and the [plan](./implementation-plan.md)'s matrix and budgets
([performance contract](../../../../reference/components/performance.md#budgets)). Times are Bench 1
medians over 10 measured runs per cache state, cold unless stated. Rows marked *probe* are agent
Node diagnostics outside any pass: estimate, not evidence. No change has landed yet.

## 1. Budget position (p95, three cache states)

| Row (contract) | S | M | L |
| --- | --- | --- | --- |
| F2 open ≤ 300 / 800 ms / 2.0 s (Hard S/M, Target L) | 144 ms ✓ | 524 ms ✓ | 5,216 ms ✗ Target |
| F3 input → matching preview ≤ 33 / 50 / 100 ms (Hard) | 16 ms ✓ | 48 ms ✓ (4 % margin) | 216–233 ms ✗ |
| F4 commit ≤ 100 / 100 / 200 ms (Hard) | 41–56 ms ✓ | 163–174 ms ✗ | 717–784 ms ✗ |
| F8 Undo/Redo ≤ 100 / 100 / 200 ms (Hard) | 31 ms ✓ | 112 ms ✗ | 637–671 ms ✗ |
| F7 orbit frame p95/p99 ≤ 16.7/25, 16.7/33, 33/50 ms | 16.7/16.8 ✓ | 16.7/16.8 ✓ | 16.7/16.8 ✓ |

Hard misses: F4 and F8 at M and L, F3 at L. F7 meets every row.

## 2. Where the time goes

**F3, one pointer move** (input → matching preview 31 ms at M, 164 ms at L). Each move runs the
whole-document planner and one full compile.

| Stage per move | M | L | M → L (N × 3.7) |
| --- | --- | --- | --- |
| Full compile | 24 ms | 118 ms | × 4.9 (exponent ≈ 1.2) |
| of which room-geometry-compile | 16 ms | 84 ms | × 5.1 |
| Topology checks (pre + post) | 2.2 ms | 27 ms | × 12.2 (exponent ≈ 1.9: quadratic) |
| Structural checks, opening set, faces, Junctions | ≈ 2 ms | ≈ 9 ms | ≈ × 4 |
| Attributed / measured | ≈ 28 / 31 ms | ≈ 155 / 164 ms | |

At L the compile alone exceeds the 100 ms row; at M the move is 4 % under its row. H1's prediction
(whole-document evaluation misses the per-edit row) is confirmed at L.

**F4 commit** (139 ms at M, 636 ms at L) and **F8 Undo** (96 / 519 ms):

| Stage per command | F4 at M | F4 at L | F8 at M | F8 at L |
| --- | --- | --- | --- | --- |
| Compiles | 2 → 47 ms | 2 → 238 ms | 1 → 22 ms | 1 → 125 ms |
| Layout representation (2 builds) | 49 ms | 167 ms | 47 ms | 164 ms |
| Admission runtime | 24 ms | 123 ms | 23 ms | 127 ms |
| Admission freeze, digest, serialize, validate | 14 ms | 53 ms | 14 ms | 55 ms |
| Standalone Wall build | 10 ms | 35 ms | 10 ms | 34 ms |
| Attributed / measured | ≈ 144 / 139 ms | ≈ 616 / 636 ms | ≈ 116 / 96 ms | ≈ 505 / 519 ms |

Every accepted result compiles twice (planner, then admission) and builds the representation
twice. Undo recompiles and re-admits a snapshot it already admitted once.

**F2 open.** Admission takes 36 / 70 / 219 ms (S / M / L). The rest, admission → first
architectural frame, is 107 / 450 / 4,971 ms. At L the traced window is one 4.9 s main-thread task
(script 5,010 ms, GC 95 ms, style and layout 42 ms). This is the Stage mount: Svelte inserting each
mesh component's anchors into the `<canvas>` subtree (decision package F9: 86 % of the XL open's
self time, × 4.4 per doubling). It is the plan's "unattributed ~400 ms of the M open" (H8).

**F7 and idle.** CPU inside `render()` is 1.0 / 2.2 / 7.0 ms against GPU 2.0 / 2.1 / 3.4 ms per
frame. The Stage renders every frame at rest (121 of 121 in the idle window). One frame's draws fall
into 7 merge bins at every grid tier (2,269 draws at L).

**Memory and ownership.** Each accepted commit leaves about 1.3 more live geometries per mesh
(+2,968 at L, never released), while materials and meshes stay constant. F13 retains 0.27 / 1.3 /
6 MiB per accepted edit; the warm and repeat-use heap growth over 10 cycles (0.4–1.8 MiB) meets the
≤ 5 MiB row, and the cold rows (10.7–14.2 MiB) include first-load growth.

## 3. Superlinear terms, named

| Term | Evidence | Matrix row |
| --- | --- | --- |
| Cache keys that re-serialize nested keys | *Probe:* a grid-L compile takes 160 ms in Node, 65 ms of it in `JSON.stringify` (69 k calls, 97 M characters). Room and Wall keys embed `segmentDependencyKey` and whole opening lists, re-escaped at each level | H3 / D.1 (repeated work inside the compile) |
| Room × Opening and Wall × Opening joins | 82 k and 176 k pair visits per compile at L; C10 commit 4.7 M and 10.9 M | H3 |
| Topology Junction × Junction and Wall × Wall loops | Exponent ≈ 1.9 per move; 10.7 M Wall × Wall pairs per drag run at L | H3 (indexed), H1 (swept bounds) |
| Linear Junction lookups | 34.6 M `lookup:junctions` per drag run at L | H3 (identity index) |
| Stage mount DOM insertion | 4.9 s of the 5.2 s L open; × 4.4 per doubling | H4 (retained, imperative representation), H8 |

## 4. Refit and order of work

The plan's order stands (D: H3, then H2, then H4 with H1, then H5, then H9). Hand calculations
below scale Bench 1's stage time by the predicted change in counts; each is a prediction, confirmed
only by Bench 2.

1. **D.1 / H3 — repeated work inside the compile.** Build each cache key once from its parts and
   reference nested keys without re-escaping; index the Room × Opening, Wall × Opening and face ×
   Room joins and the Junction lookups; put the topology pair loops behind a box index. If key
   building drops to near zero and the joins become linear, the L compile goes from 118 ms to
   about 60–70 ms (the probe's 40 % key share plus the join share). Cache-key values must stay
   equal-iff-equal for every consumer; any change to their values needs the consumer inventory.
2. **D.1 / H2 — one compile and one representation build per accepted result.** F4 at L:
   238 → 119 ms of compile and 167 → 84 ms of representation, about −200 ms. Undo reuses the
   admitted snapshot it restores: about −250 ms at L.
3. **D.2 / H4 — retained representation.** Per-entity meshes rebuilt only where output changed,
   created imperatively under one component rather than one Svelte component per mesh. This
   targets both the per-commit representation cost and the Stage mount (the 4.9 s L open), and
   releases the geometries each commit leaves behind.
4. **D.3 / H1 — incremental evaluation** for the drag preview and F4. With D.1 alone the L move is
   still about 70 ms of compile plus checks; the per-edit M row (≤ 8 ms) needs k-bounded
   evaluation.
5. **D.4 / H5, D.6 / H9** as planned. H9 (shadow pass only on change) and render-on-demand at rest
   are flat savings; CPU submission exceeds GPU from M upward, so batching (H6) stays an owner
   proposal (F) with the 7-bin evidence.

**Predicted position after D.1–D.3 (hand calculation, not evidence).** F3 at L ≈ 30–50 ms;
F4 at M ≈ 60–80 ms and at L ≈ 150–200 ms; F8 at M ≈ 40–60 ms and at L ≈ 120–180 ms. Each figure is
re-derived from the D.5 count oracles as the changes land.
