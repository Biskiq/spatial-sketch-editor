# T5 — Expressive Geometry

**Track:** T5 · **Status:** approved — direction and first phase adopted by the T5 planning PR on
the owner's merge ([record](../../reference/decisions/t5-object-focus-planning-2026-10-27.md)); G0
direction ratified ([record](../../reference/decisions/t5-g0-ratification-2026-10-27.md)); E0
withdrawn; nothing released ([track register](../README.md#track-register)) · **Gates owned:** none ·
**Direction:** [umbrella plan](./umbrella-plan.md) · **Phase register:** below · **Operations:**
[T5 runbook](../../operations/t5-expressive-geometry/README.md)

## Mission

Develop the reusable geometric capabilities needed for Biskiq's
[creative-freedom and depth principles](../../reference/north-star.md#creative-freedom-and-depth).
The North Star owns those principles; the
[reference architecture](../../reference/architecture.md#expressive-creation-and-revision-destination)
owns integration and semantic boundaries. T5 is neither a separate modeling application nor a
mandate to implement every technique studied by G0.

T5 delivers **native forms**: Scene objects whose shape is authored source, created by drawing in
World and refined in **Object Focus**, a scope on the one Stage. The
[umbrella plan](./umbrella-plan.md) owns the architecture, capability ceiling, phase roadmap and
integration strategy.

## Bounded objectives

1. **Drawn native objects** ([T5.P01](./t5.p01-drawn-native-objects/README.md)). Native form source,
   deterministic evaluation and Scene admission; creation from an Ink outline; per-axis sizing.
2. **Object Focus** (planned as T5.P02 in the umbrella plan). Sections, outline revision and
   reach-bounded shaping inside a Focus scope, with dependable revision. Registered when the first
   P01 slice is accepted.
3. **Conditional capabilities.** Composite, generated, related and smooth forms enter only on the
   entry evidence the umbrella plan names and an owner decision.

## Concern ownership and boundaries

Existing authorities remain controlling. The reference architecture owns the durable allocation;
this table routes track responsibilities without moving them.

| Concern | Owner |
| --- | --- |
| Architectural semantics, Layout topology and canonical architectural compiler | T1 |
| Scene object form, definitions, instances and composition | T2; T5 writes native-form parts under T2 review |
| Stage host, selection and Ink | T1; T5 lands bounded seams under T1 review |
| Experience/Camera and shared acceptance/history/Save | T3 / existing F owners |
| Reusable geometric numerics (`@portfolio/geometry-core`) and the native-form capability | T5 |
| F.1–F.5 and accepted capability scopes | Existing owners; no amendment planned |
| Visitor-safe delivery and publication | T4; native editing gains no publication prerequisite |

T5 creates no competing persisted document, writer, history, acceptance authority, renderer or
Layout compiler. Dependency admission keeps the existing licensing rule.

<a id="e0-next-experimental-decision-gate"></a>

## E0: withdrawn

The owner rejected the E0 guide/arrangement experiment as insufficiently valuable for T5's
direction. The [E0 execution plan](./e0-execution-plan.md) is withdrawn and superseded by the
[umbrella plan](./umbrella-plan.md), and PR #206 closed without merge on 2026-10-27. The
[planning record](../../reference/decisions/t5-object-focus-planning-2026-10-27.md#owner-ruling-e0-withdrawn)
keeps the retrievable evidence and its one finding: relocating controls is not a creative advantage.
Contextual creation and composable relationships remain North Star principles, not T5's first
investment.

## Evidence roles

- [Umbrella plan](./umbrella-plan.md) — T5's planning direction; roadmap authority, not a reference
  contract.
- [Planning record](../../reference/decisions/t5-object-focus-planning-2026-10-27.md) — E0
  withdrawal, owner decisions and the first slice's release step.
- [E0 execution plan](./e0-execution-plan.md) — withdrawn; historical.
- [G0 ratification](../../reference/decisions/t5-g0-ratification-2026-10-27.md) — provenance and
  limits; live rules belong to the owning references it routes.
- [Original G0 commission](./g0-foundation-architecture-commission.md) and
  [original approval](../../reference/decisions/t5-g0-approval-2026-10-27.md) — historical planning
  mandate.
- [Latest reconciled proposal](./g0-reconciled-proposal/README.md),
  [first architecture proposal](./g0-architecture-proposal/README.md),
  [independent stratified-form proposal](./g0-independent-proposal/README.md) and
  [kernel assessment](./g0-architecture-proposal/kernel-evidence.md) — historical analysis; the
  umbrella plan's evidence table says what it reuses.
- [Native Form Lab](../../../prototypes/native-form-lab/README.md),
  [native object shaping](../../../prototypes/native-object-shaping/UX-SPEC.md),
  [depth research](../../../broad-research/spatial-modeling-depth-research-2026-10-25.md) and
  [Vellum](../../../prototypes/p3-vellum/DESIGN.md) — creative and technical evidence, not
  production authority.
- [S06 acceptance](../t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md)
  — measurement method and baseline; not evidence that new geometry meets browser budgets.
- [PLATE](../../reference/design-system/editor-shell-and-visual-system.md) — ratified shell
  authority; Object Focus obeys it.

## Phase register

| Phase | Status | Depends on | Workspace |
| --- | --- | --- | --- |
| T5.P01 | approved | — | [Drawn native objects](./t5.p01-drawn-native-objects/README.md) |

## Operations and authorization route

The [T5 runbook](../../operations/t5-expressive-geometry/README.md) owns procedure and its
[baton](../../operations/t5-expressive-geometry/current.md) owns current work.

```text
DIRECTION          umbrella plan (roadmap authority) under the ratified references
REGISTRATION       T5.P01 and its slice register; later phases registered on their entry evidence
RELEASE            an explicit owner release-list row per slice before production implementation
START              the runbook start step at the slice's own trusted base
CLOSE              slice-closeout; phase close is owner-invoked
```

The [production hold](../README.md#production-implementation-hold) and [release list](../now.md)
retain their authority. Registration and merging the planning PR release no production scope.
