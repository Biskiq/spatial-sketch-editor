# P23 / P24 addendum — unified Plan / 3D semantic authoring

**R9 closeout (2026-09-10):** [Minimum freeze](../p24-scene-staging/reconciliation/2026-09-10-P24-R9-minimum-freeze.md) is the current inclusion/maturity/operation/acceptance authority; [P24.0–P24.5 child briefs](../p24-scene-staging/slices/2026-09-10-P24-minimum-child-plans.md) are implementation-ready for owner review. Earlier draft/pending-minimum wording below is superseded by R9. Source rechecks are closed as planning evidence; implementation and runtime ship gates remain open. P24 remains proposed; execution waits for the accepted P23 minimum and approval.


**Date:** 2026-09-09  
**Status:** ratified directional addendum  
**Applies to:** P23 Layout Depth + P24 Scene / Staging Depth  
**Owner decision:** [`../archive/plans/2026-09-09-scope-decision-unified-plan-3d-semantic-authoring.md`](../../archive/plans/2026-09-09-scope-decision-unified-plan-3d-semantic-authoring.md)  
**Pascal harvest:** CLOSED — [`../p24-scene-staging/research/Pascal-editor-harvest.md`](../p24-scene-staging/research/Pascal-editor-harvest.md), pinned `32c3c8a24dae17c55beaabf45029148900a3b409`  
**P24 reconciliation sequence:** [`2026-09-09-P24-reconciliation-sequence.md`](../p24-scene-staging/2026-09-09-P24-reconciliation-sequence.md)

This addendum is the active planning pointer for the 2026-09-09 unified-view ratification. It does not renumber P23/P24 or change tracker status.

## Ratified cross-cutting rule

> **Plan and 3D are complementary Spatial authoring lenses. They have equal access to shared semantic operations where the representation supports those operations truthfully. The target entity's owning document determines the mutation domain.**

Plan remains intentionally 2.5D. Equal access does not imply identical tools.

Committed canonical selection **must survive** Plan ↔ 3D switching while the selected entity still exists. A Plan-ineligible entity may lose manipulation handles without losing canonical selection.

An unfinished placement/transform gesture cancels on view switch with no history result unless a future explicitly specified cross-view continuation flow exists. View switching never silently commits.

## Target ownership and current wall-first Layout

The following is the **ratified P23 wall-first Layout foundation**, now the
current editable structure after the Foundation Gate shipped. Legacy
Room-owned/Room-local behavior remains only as a compatibility read path for
recognized legacy Projects:

```text
LayoutDocument
├─ Floors
│  ├─ Junctions
│  ├─ Walls
│  ├─ Openings → Wall
│  └─ Rooms → persistent semantics over derived faces
└─ LayoutObjects → document-level / project-world-local

SceneDocument
├─ Scene entities / clusters / materials / lights
└─ Camera-authored records currently persist here
```

`Camera` is a semantic subsystem/workspace authority, not a proposed third document.

## Entity-driven mutation ownership

Examples:

```text
Plan Wall drag
→ target = Wall
→ LayoutDocument operation

Arrange LayoutObject drag
→ target = LayoutObject
→ LayoutDocument operation

Arrange Scene asset drag
→ target = SceneEntity
→ SceneDocument operation
```

Do not derive mutation ownership from `Plan`, `3D`, `Layout`, `Arrange`, `Build`, or `Stage` labels alone.

## P23 implications

P23 remains top-level `approved`; its child plans remain `implementation-ready` subject to their documented dependencies.

**P23 proceeds independently of P24 reconciliation and independently of the Pascal study.** The Pascal harvest is closed and is not a P23 execution gate. P23 agents should start from the P23 umbrella/child plan and the existing H1/H2/H3/H5 evidence; only read the completed Pascal harvest when the touched slice materially overlaps one of its bounded findings.

Useful optional Pascal mappings:

```text
P23.1
→ preview/commit lifecycle and transform-preservation counter-cases

P23.2
→ snap-priority/radius counter-cases; Museum H2 remains authority

P23.3
→ opening move/resize interaction shapes; clamp behavior is a Museum rejection fixture

P23.6
→ floorplan affordance/presentation study only

P23.8
→ candidate-plan/adversarial topology fixtures; Museum H3/H5 remain authority

P23.9
→ transient draft/preview/history lifecycle fixtures
```

P23.0/F0 does not need to wait for or reread Pascal unless an implementation issue touches one of those exact seams.

P23's wall-first architecture is not reopened by this addendum. The direction instead constrains/refines implementation:

- P23.1 — direct manipulation should be semantic-operation based rather than Plan-only state;
- P23.2 — snapping/guides may extend existing candidate infrastructure where current operations require it; do not build a new generic snap framework for hypothetical future clients;
- P23.3 — Opening operations remain Layout-owned regardless of whether a later affordance exists in Plan or 3D;
- P23.6 — establish one coherent Plan drafting grammar that future Scene proxies can join;
- P23.8/P23.9 — transient previews/commits should remain compatible with a shared semantic-operation model.

The shared Plan substrate should **extend existing infrastructure only under concrete current-operation pressure**. This addendum does not authorize a universal command bus, generic capability registry, mirrored Plan state, or new general framework.

## P24 implications

P24 remains `proposed` / research-reconciliation; its minimum is still unfrozen.

The active planning sequence is now [`2026-09-09-P24-reconciliation-sequence.md`](../p24-scene-staging/2026-09-09-P24-reconciliation-sequence.md). P24 research/planning may proceed in parallel with P23 implementation, but P24 implementation still depends on the accepted P23 minimum. Any P24 seam marked as changed by P23 must receive a targeted post-F0 recheck before an implementation-ready P24 child plan freezes. P23.1 shipped via PR #9 (`d5ec0df`) and P23.2 via PR #13 (`a369a15`); P23.9 is the current P23 slice.

Conceptually describe P24B's destination as **Rich Scene / Staging Authoring**, with 3D as the richest representation but not the only authoring client.

### P24A direction

P24A owns supply-side Plan representation and eligibility metadata:

```text
AssetDefinition
├─ 3D representation
├─ PlanProxy / AssetFootprint
├─ Plan eligibility
├─ normalized pivot
├─ grounding/contact offset
└─ placement-surface metadata

SceneEntity
├─ asset reference
└─ canonical authored transform
```

PlanProxy belongs to the asset definition. Do not persist a second per-instance proxy copy in `SceneEntity`.

A misleading Plan representation is not acceptable. Tilted, wall-mounted, hanging or otherwise unsuitable assets may be explicitly Plan-ineligible.

### P24B B2 direction

Study/freeze shared Plan/3D placement semantics here:

- both views create the same canonical target Scene entity when placing a Scene asset;
- Plan authors only supported floor-plane components such as X/Z/yaw;
- Plan preserves Y/elevation, pitch, roll and scale unless an explicit operation says otherwise;
- Plan placement height resolves from explicit active floor/support elevation + asset grounding offset;
- ambiguous stacked/support surfaces require a choice; never silently default to world `Y = 0`.

### P24B B5 direction

Study/freeze cross-view interaction presentation here:

- proxy/ghost presentation;
- committed selection continuity;
- Plan-ineligible-but-selected treatment;
- unfinished-gesture cancellation on view switch;
- cross-view discoverability and visual polish.

These are directional ownership assignments, **not automatic P24 minimum ship gates**. B0–B5 reconciliation still decides the minimum and B6 remains the implementation-brief gate.

## Pascal evidence boundary — closed

The Pascal direct study is complete. Use [`Pascal-editor-harvest.md`](../p24-scene-staging/research/Pascal-editor-harvest.md) as a bounded evidence artifact when a P23/P24 capability overlaps it.

Closure facts:

- pinned revision `32c3c8a24dae17c55beaabf45029148900a3b409`;
- root MIT license verified at that revision for the cited files; dependency/asset licenses were not audited;
- static source/test inspection only; upstream tests were not executed;
- findings are classified `PORT | ADAPT | STUDY | REJECT` against Museum contracts;
- Pascal does not become architecture authority;
- its generic scene/node/state/history architecture is not imported by default;
- a discovered Museum architectural limitation still requires a separate architecture review/owner decision.

Pascal is now optional evidence for P23 refinement and an input to P24 reconciliation, never a planning or execution gate by itself.
