# T5 — Expressive geometry

T5 grows from native shapes into revisable objects, assemblies and geometric refinement.
Basic shape creation, direct manipulation and independent My Objects copies are already landed.

**One direction:** the [umbrella plan](./umbrella-plan.md) replaces the earlier native-form plan
and PR #266's experimental C1–C6 sequence. Its [Studio journey specification](./object-studio-design.md)
is the UX part of that same plan, not an alternative architecture.

**Start after #266 is approved:** `studio.dual-entry` — World-origin and standalone Studio over
the existing Scene, Camera, history and Save. The plan gives implementation seams, acceptance cases
and the owner UX decision required before implementation. Geometry research, assemblies and a new
source format are not prerequisites for this first capability.

This is planned work, not a claim of implementation or owner acceptance. The plan's
[owner decisions](./umbrella-plan.md#owner-decisions) distinguish the choice needed for the first
capability from choices needed only by later consumers. Claims, flags and review follow the
[workflow](../../workflow.md); maturity and health come from `npm run status`.

Durable authority remains in the [North Star](../../reference/north-star.md),
[architecture](../../reference/architecture.md), [composition interfaces](../../reference/composition-execution.md),
[Scene](../../reference/components/scene-content.md), [assets](../../reference/components/assets.md),
[persistence](../../reference/components/persistence.md) and
[approved shell](../../reference/design-system/editor-shell-and-visual-system.md).
Implementation promotes enduring rules into those references and removes completed planning text;
it does not create another authority or a closeout document.

[Reconciliation and research evidence](../../../broad-research/native-modeling-freedom/PROPOSAL.md)
preserves alternatives, technical cautions and links to the original studies and prototypes.
