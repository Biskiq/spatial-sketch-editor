# Implementation PRs and decisions

Part of the [T1 next-batch proposal](./README.md). Tiers follow
[`docs/workflow.md`](../../../workflow.md#risk-tiers-the-highest-applicable-tier-wins). Capability
ids marked *new* are proposed names; each implementing PR adds its own ledger row and claims it in
its title. This document claims nothing.

## PR set

### Lane A: completeness (small, independently mergeable)

| PR | Capability | Delivers | Boundary | Depends on | Tier |
| --- | --- | --- | --- | --- | --- |
| **A0** | – | Promote #287's enduring rules into the Layout contract (format 7, closed-Wall rules, periodic Openings, development map, reference surface, overlap policy). Delete the completed expressive-walls plan and its roadmap row. | Docs only. No behaviour. | – | 1 |
| **A1** | `layout.wall-split` *new* | **Split wall here** in the scoped list (Card `•••`, context menu, Find). Context menu splits at the pointer's station; the Card splits at the midpoint. Straight and curved open Walls. | One intent over `planWallSplitAtPoint`. Captured ids. No new mark, no armed mode. Closed Walls keep refusing. | – | 0 |
| **A2** | `layout.wall-join` *new* | Join two Walls at a two-Wall joint: drag the joint onto the line between its neighbours (**Remove joint**), or Eraser on the joint. Refusal words for corners, three-Wall joints and mismatched Walls. | One intent over `planDissolveJunction`. Eraser gains a joint winner in Layout's binding. One sentence added to the grammar's Wall row (Q2). | – | 1 (0 if Q2 lands Eraser-only) |
| **A3** | `layout.wall-arc` *new* | Walls plate **Arc** enabled: start, end, bulge. Tag reads rise and radius. Writes one open `cubic-chain` Wall through the existing chain commit. | `InkWallMode` gains `'arc'`. No new centerline kind; an arc is the cubic approximation the circle already uses. No tangent-continuation from the previous segment. | – | 0 |
| **A4** | `layout.room-duplicate` *new* | **Duplicate** on the Room's scoped list for an isolated Room. The copy follows the pointer as one proposal and lands free. | One intent over `planDuplicateIsolatedRoom`. A non-isolated Room refuses with words until A5. Scene objects inside are not copied. | – | 0 |
| **A5** | `layout.room-duplicate` | Duplicate any Room by copying its enclosure: every boundary Wall including shared ones, their Openings and Junctions, as a free island. Consequence line names dropped door relations. | New copy-enclosure planner beside the isolated one. Short plan as the PR's first commit. No attach on drop. | A4, Q3 | 1 |
| **A6** | `layout.wall-face` *new* | **Face this wall** enabled in the Card. Squares the Camera to the selected Wall or its unrolled sheet; Put back returns to the entry pose under the existing rule. | One `face` viewing intent in camera-core (the #287 revision 1 design). Layout supplies bounds and a look direction, never a pose. Unroll never invokes it. Short plan as first commit. | Q4 | 1 |
| **A7** | existing ids | Small parity items, one PR each, only if cheap on inspection: Pointed Opening profile in the Ink plate; fixed-end choice on Card Length; length mark on curved Walls. | Each is a single control over an existing planner. Drop any that turns out to need a design. | – | 0 |

A1–A4 touch different planners and different adapter modules and can run in parallel. All four
share `layout.adapter.ts` bindings, so whoever merges second rebases.

### Lane S: research with a decision as its exit

| PR | Delivers | Exit | Tier |
| --- | --- | --- | --- |
| **S1** | Connected-curve spike on fixtures, core only, no editor change. Measures model B: arc accuracy after exact subdivision at 1, 2 and 4 attach points; co-circular recognition tolerance; a group radius planner on a rotunda with an adjoining Room; rejoin to a closed Wall; Room identity through attach and detach. Records what model C would have to change, without building it. | A filled comparison table and a recommendation for Q6. Stop there. | 0 (proof tests only) |

### Lane D: depth (dedicated plans, then phased PRs)

| PR | Capability | Delivers | Depends on | Tier |
| --- | --- | --- | --- | --- |
| **V-plan** | `layout.overhead-region`, `layout.wall-top-profile` *new* | One technical plan for V1–V3: region encoding, closure coverage and generated fallback, relation derivation (meets / gap / intended), Wall top definition with level as the scalar case, format bumps, compiler and mesh consumption, visitor parity. Reuses the P26 contract and prototype evidence; restarts nothing. | Q7, Q8 answered in review | 2 |
| **V1** | `layout.overhead-region` | Flat regions, closure and suspended; relations readout; one-shot fit. Format bump, strict refusal of 7. | V-plan | 2 |
| **V2** | `layout.wall-top-profile` | Slope and gable Wall tops, edited on the Unroll sheet; head-fixed arch rise becomes possible. Format bump. | V1, A6 | 2 |
| **V3** | `layout.overhead-region` | Shed and gable forms; Edit shape per PLATE; fit in both directions. | V1, V2 | 2 |
| **C** | `layout.connected-curve` *new* | Connected circles under the model chosen from S1. Own plan. | S1, Q6 | 2 |
| **R** | `layout.room-unroll` *new* | **Unroll the room**: boundary Walls as one developed strip. Own plan; resolves the Layout contract's open D5. | A6, Q6 | 1–2 |

Every format change follows the standing rule: bump, strict refusal of the previous version,
fixtures regenerated, no migration.

### Explicitly not proposed

Station-hosted Junctions; named levels and multi-storey; stairs; terrain; Room rotation; general
curve crossing and noding; bending or free-forming a closed Wall; persistent fit constraints; a
Junction tool or selectable Junction subject; a "Focus" mode.

## Decisions requiring owner approval

Each has a recommendation. Lane A can start on the recommendation where the default is reversible;
that is marked.

| # | Decision | Recommendation | Blocks | Reversible default? |
| --- | --- | --- | --- | --- |
| **Q1** | Is Lane A the next batch, ahead of any depth implementation? | Yes. Depth is planned in parallel, not implemented in parallel. | Everything | – |
| **Q2** | Join gesture: extend the Wall row's bend-point removal gesture to a two-Wall joint (grammar edit), or Eraser-only? | Both. The drag is the discoverable one and matches #287; the Eraser covers already-collinear joints. | A2's grammar sentence | Yes: ship Eraser-only first |
| **Q3** | Duplicate semantics for a Room with shared Walls: copy the shared Wall into a free island and drop outside door relations? And is **Drops** an acceptable consequence word? | Yes to both. | A5 | No |
| **Q4** | Admit a `face` viewing intent to the Camera authority, as an explicit Look action that Unroll never invokes. This partly reverses #287's revision 2, which removed `face` entirely. | Yes. The entry-preservation ruling is untouched. | A6 | No |
| **Q5** | Naming: use PLATE's existing **Face** and **Unroll the room**; do not introduce "Wall Focus" or "Room Focus". | Yes. Focus already means the Height Sheet's story focus. | A6, R | Yes |
| **Q6** | Connected circles: accept that a *connected* circular enclosure is a ring of arc Walls with a derived Round reading (model B), amending the Layout contract's "one continuous canonical Wall" to apply to the isolated case. | Decide after S1, on its evidence. Lean B. | C, R | No |
| **Q7** | Layout contract D2: is an overhead region's height Floor-relative or world-fixed when the datum changes? | Floor-relative, with the measured world height always shown. One Floor exists today, so this is cheap now and expensive after levels. | V-plan | No |
| **Q8** | Layout contract D3: how is an intended gap, and a Room deliberately open to the sky, represented, given that a Room never owns a region? | An authored closure region may carry **open** intent that suppresses the generated lid over its footprint; an intended gap is a flag on the relation's region side. To be confirmed in the V-plan. | V-plan | No |
| **Q9** | Verticality order: V1 flat regions before V2 Wall tops. | Yes, for the reasons in the proposal. | V-plan | Yes |
| **Q10** | Keep levels, stairs and terrain out of this T1 batch; treat a suspended region at height as the probe for mezzanine demand. | Yes. | Scope | Yes |
| **Q11** | A0 deletes a plan and edits a reference contract after the fact. Confirm that #287's promotion is owed and may land as a docs-only Tier 1 PR. | Yes. | A0 | – |

## Matters implementers can resolve

- Which fragment keeps the Wall id on split and which Wall survives a join: follow the existing
  planners; state the rule in the PR.
- Refusal wording for the split and join codes that have no editor words yet, following
  `adapters/layout/refusals.ts`.
- Arc input details: bulge snapping, typed rise or radius, minimum rise before it reads as a Line.
- Whether the Card's Split uses the midpoint or the nearest unobstructed station when an Opening
  sits at the midpoint.
- Proposal drawing for a duplicated Room (it already has the Room-move candidate channel to reuse).
- `face` transition duration and padding, within the existing `fit` rules and reduced-motion
  policy.
- Test placement and lane per [`apps/editor/tests/README.md`](../../../../apps/editor/tests/README.md).
- Capability row wording and check tags.
- Dropping any A7 item that needs more than one control over one planner.

## Verify before relying on it

These were read from code, not observed:

1. A free-standing circle inside a Room: what the outer Room's area label and floor show (no hole
   semantics exist in face extraction).
2. `planDissolveJunction` on a curved pair in the editor's preview channel: it has never had a
   caller outside tests, and its curve branch mints a knot id from occupancy rather than from the
   capture (`layout-wall-centerline.ts` documents this). A2 must thread the capture before shipping
   the curved case, or scope the first PR to straight pairs.
3. `planWallSplit` on a curved Wall carrying Openings on both sides of the cut, through Undo and
   Redo.
4. Whether the Room Card's scoped list has a non-destructive action slot today, or only the
   disabled `Soon` items.
