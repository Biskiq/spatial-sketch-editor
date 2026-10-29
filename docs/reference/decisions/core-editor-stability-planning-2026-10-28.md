# Core Editor Stability planning — owner rulings, 2026-10-28

**Status:** owner rulings given 2026-10-28 on the planning PR
([#217](https://github.com/Biskiq/spatial-sketch-editor/pull/217)). They take effect when the owner
merges that PR. This record is provenance; each ruling lives in the section it governs.

## What the owner decided

| # | Ruling | Folded into |
| --- | --- | --- |
| D1 | Shell coherence becomes a Core Editor Stability criterion | [Milestone criteria](../../roadmap/core-editor-stability.md#criteria-proposed), the "Shell coherence" row |
| D2 | Build the Height Sheet (the slicer control) as a functional foundation. Plan cut height is enough for v1, and fuller section behaviour remains future scope | [R217 Height Sheet foundation](../../roadmap/r217-core-editor-stability/README.md#height-sheet-foundation-and-the-slice-seam) |
| D3 | The dock set for this phase is Select, Ink (Line, Box), Measure, Eraser (one subject per click) and the Library | [R217 scope rulings](../../roadmap/r217-core-editor-stability/README.md#scope-rulings) |
| D4 | The work lives in a shared repository phase, not a track phase, because every current track phase is closed and the work crosses track boundaries. T1, T2, T3 and T5 keep ownership and review of their concerns | [Track register](../../roadmap/README.md#track-register), the R217 row; [R217 ownership](../../roadmap/r217-core-editor-stability/README.md#ownership-and-review) |
| D5 | Paper is the default 2D appearance; shaded Plan remains a viewing preference | [R217 scope rulings](../../roadmap/r217-core-editor-stability/README.md#scope-rulings) |

The owner also required four revisions, and all are in the phase README:

1. Cover the Head, collapsible Index, contextual Card and responsive shell composition explicitly.
2. Keep domain-specific hit, occlusion and refusal policies beneath the shared Stage interaction
   coordination.
3. Reconcile the Height Sheet foundation with Slice being excluded, so the future extension seam is
   clear.
4. Add coarse-pointer and touch input, and interrupted-gesture recovery, to acceptance. Distinguish
   source persistence from Undo history, which is not persisted.

## Effect of merging the planning PR

- **R217 — Core Editor Stability** is registered as a repository phase, `approved`, with eleven
  slices whose plans are approved.
- The milestone definition gains the Shell coherence row. Its other criteria keep their
  existing status.
- The gates test discovers every repository phase from the track register, so R217's slice
  register is validated like any phase's.

## What it does not do

It releases no slice and writes no row to [the release list](../../roadmap/now.md). Each slice
starts only from a later owner release. It creates no gate, gate version, persisted format,
milestone acceptance plan or acceptance workspace, and it closes no track or phase. The
[production hold](../../roadmap/README.md#production-implementation-hold) still covers every scope
the release list omits.
