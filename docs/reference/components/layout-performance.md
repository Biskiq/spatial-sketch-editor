# Layout performance rules

Apply this reference when changing Layout editing, acceptance, Undo/Redo, Open, or
Stage rendering. [Browser performance and delivery](./performance.md) owns metric
definitions, budgets and measurement policy. [F.4](../composition-execution.md#f4-compound-acceptance)
owns accepted edits and history.

## Rules for the editing path

| Path | Rule |
| --- | --- |
| **Pointer move → preview** | Capture the accepted baseline and affected set once. Draw transient geometry from Layout's proposal math. Reuse unchanged samples and use bounded canonical checks for live refusals. Treat unchecked proposals as pending. Keep full validation, Room reconciliation, document capture and history off the per-move path. Where the canonical candidate Paper needs compilation, compile and build Paper once per **distinct candidate** through the canonical read (one whole compile per distinct candidate; an Opening Repeat proposal instead reads the planner's own delta back through the project compile context), then reuse it while unchanged; never compile on an idle tick. Use the same snapped intent for preview and release. E4/G1 step 1 landed this: a still pointer builds at most once, compiles at most once for the candidate and does no work after its first tick (`layout-candidate-memo`); the changed-wall Paper step (G1 step 2) is declined pending a measurement. |
| **Release → accepted edit** | Submit one exact intent to F.4. Validate through the canonical planner, certify the affected extent when supported and fall back to the full path when the proof is inconclusive. Share unchanged source and compiled roots and reuse the accepted result through admission. A valid release writes one history entry. Cancellation or refusal writes none. |
| **Undo/Redo** | Restore the qualified immutable source and its retained geometry roots when they match. Update changed render entries and release replaced resources. Avoid revalidating, recompiling or rehashing a matching historical root. |
| **Open → usable Stage** | Validate and prepare the envelope once, then pass the qualified result to admission. Retain meshes by compiled identity, install changes in place, invalidate shadows only when their inputs change, and stop drawing at rest. Track admission and the first matching nonempty Stage presentation separately. Cold Open still has whole-project and render setup costs. |
| **Pan, pick and refresh** | Keep the evaluated Plan when its real inputs stay the same. Use a spatial pick index and maintain changed Plan sources from a certified compiler delta. Count work where it happens, including a lazy rebuild on the first pick after Open or commit. |

Keep deterministic checks at the **mounted gesture boundary**. Drive real pointer
moves, assert that the preview changes without a full compile or history write,
then check that release installs the same proposal once and that Escape restores
the accepted view. A large compile fixture checks the compiler, so it cannot
detect a Stage adapter calling it on every sample. When an owner-triggered
investigation measures responsiveness, separate pointer-to-preview, release-to-presentation,
Open-to-presentation, and the first pick after an edit. Follow the existing
[test policy](../../../apps/editor/tests/README.md#correctness-tests-vs-performance-benchmarks).

**Regression example.** The later Wall adapter (`1fb51ed8`) and Room drag
(`d32e3bcb`) invoked full planners on pointer moves. Both could produce correct
geometry and pass compiler tests while making the Stage choppy. Review the
call sites that drive the interaction whenever a planner is wired into a gesture.

## What the earlier work established

- **P23B before S06.** Gesture-scoped topology verdicts and sample reuse kept work on
  the affected geometry. The accepted edit path reused its geometry through
  installation. Git anchor `6ad23856`. PR #115 later retired that browser recorder
  and reuse ratchet, so its historical results do not cover a newly wired adapter.
- **S06 Bench 1** at `1c5e530c` isolated the cost of compiling and rebuilding representation
  per pointer move, duplicate work on commit, and cold Open dominated by Stage mount.
  [Bench 1 characterization](../../archive/roadmap/closed-phases/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/characterization.md)
- **Bench 2** was diagnostic. The optimization work indexed geometry joins and topology
  pairs, retained compiler and mesh results, shared the validated envelope across
  acceptance, and stopped unnecessary shadow and idle draws. Git anchors `9d2a594d`,
  `91df34e0`, `8fc7bb31`, `6e4df860`, and `fef72f4e`.
  [Bench 2 and its review handoff](../../archive/roadmap/closed-phases/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/review-handoff.md#bench-23-strategy-implemented-diagnostic-bench-2-2026-10-26)
- **The S06 milestone replaced formal Bench 3.** The frozen candidate `d89554b1`
  included persistent source and historical roots, spatial picking, and incremental
  Plan maintenance. The accepted milestone was AC-qualified. Cold Open, full
  serialization and hashing, draw submission, and first-pick rebuilds retained
  costs. The later M/L spot check separately measured admission and matching
  presentation. A 1,000-Room compile or a milestone result does not certify current
  1,000-Room drag feel.
  [S06 acceptance and attribution](../../archive/roadmap/closed-phases/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md) ·
  [Corrected M/L spot check](../../archive/research/performance-spot-check/README.md)
