---
kind: architecture assessment (review report)
status: "Research input for owner review. Not a product contract, ratification, routed authority, roadmap change or implementation authorization. docs/README.md and docs/reference/ govern product truth."
evidence_base: "PR #166 at 444fab56; country-slice @ 3f6a459; layout-core wall-first sources; the ratified decision record, north-star, architecture and composition-execution contracts; the P3 prototype proposal"
companions: "procedural-architectural-authoring-ux.md (verbatim study) and procedural-architectural-authoring-ux.html (synthesis with verification notes)"
---

# Procedural authoring vs. Biskiq's Layout foundation: architecture assessment

**Status:** review report for owner review. It is not research text, not a `reference/`
contract, not a roadmap entry and not a ratification. It assesses the
[verbatim study](./procedural-architectural-authoring-ux.md) and the
[synthesis page](./procedural-architectural-authoring-ux.html), whose Source notes carry the
verification notes this report relies on. It was written against PR #166 at `444fab56`.
**Labels used throughout:** **[Current]** is shipped code. **[Ratified]** is a destination
contract that is not yet built. **[Research]** is a PR #166 proposal. **[Rec]** is this
review's recommendation.

---

## 1. Executive verdict

**The research mostly adds new gestures and derived evaluators. It also requires one real
extension to the Layout representation. It does not justify reconsidering Wall ownership.**

- Most of what makes Tiny Glade feel easy maps onto Biskiq's wall-first kernel as *gestures
  that compile into canonical elements* plus *derived handles and detail*. Several of the
  report's headline "proposals" are already shipped in Biskiq's compiler:
  - Opening offsets are physical meters from the Wall's canonical start (the report's
    "arc-length anchor").
  - Openings are cut by analytic 1D intervals along the Wall in (s, z), with
    rounded/pointed arch profiles and no CSG.
  - UVs are metric arc length.
  - Every compiled record carries a cache key.
  - Picking runs against compiled query records with source-identity pick ranges (the
    report's "analytic proxies").
- The extension Biskiq needs is not a building mass. It needs:
  - **horizontal and overhead elements** (slab, ceiling, roof, canopy), which do not exist
    today;
  - **vertical references** (levels or structure frames, and Wall base/top references),
    because today there is one Floor datum, a constant Wall height and Wall bottoms fixed
    to the Floor.

  The ratified record already reserves both as open Layout decisions ("slab/ceiling
  ownership", "host-topology expansion versus isolated structures"). The research makes
  them urgent for P3; it does not create them.
- The research's own target architecture is a `BuildingMassNode` owning walls and roof,
  plus a planar cell complex with per-edge "wall closure state", plus derived Tier-1
  chemistry. Adopting it as canonical source would be a regression for Biskiq:
  - It creates a second wall authority, since free walls still need `SpineCurveNode`.
  - It keys anchors by index (`edge_or_facet_idx`), which F.1 forbids.
  - It fabricates edges for open sides.
  - It lets proximity become topology, contradicting north-star's "proximity may suggest;
    never becomes implicit topology".
- **Consequence:** moderate. It does not overturn any foundation. It forces four decisions
  that P3 must face: roof/slab ownership, the vertical reference model, the identity of a
  Wall under T-noding, and the policy for retaining building intent.
- **Confidence:** high (≈0.8) that the Wall stays the authored primitive. Medium (≈0.6) on
  the specific overhead representation recommended below. Low (≈0.4) that bake-on-create
  is enough for whole-building manipulation without retained intent. Experiment E2 decides
  that.

---

## 2. Keep / Evolve / Reconsider / Defer matrix

| Subsystem | Current / ratified | Research challenge | Disposition | Reasoning | Evidence & uncertainty | Cost |
|---|---|---|---|---|---|---|
| Wall as authored primitive; role derived | [Current] `LayoutWall` between two Junctions; authored `role` field. [Ratified] role derived (owner ruling 2026-10-03) | Mass-first: walls are generated from footprints | **Keep** | Free-standing, dividing and curved Walls need no Building. A mass-first model needs a second wall system for free walls anyway (`SpineCurveNode`) | Strong: the code and the report's own data model | — |
| Junction-ID connectivity, declared (never inferred) | [Current] chain planner: declared reuse; cross-component overlap stays un-noded | "Gluing": overlap ⇒ union, merged roofs | **Keep** | Visual merging can be a derived *rendering* of declared joins. Overlap alone must not mint topology | North-star §Ownership is explicit | — |
| Curved centerline | [Current] `cubic-chain` with identified knots that carry no connectivity; one Wall can be one long curve | Freehand spine with arc-length LUT | **Keep representation, evolve gesture** | Needs a stroke→cubic-chain fitting planner (decimate, smooth, fit). A closed loop must be ≥ 2 Walls, because the codec rejects start = end | Fitting quality and knot count are UX questions | Low–medium |
| Wall splitting under T/X noding | [Current] a split keeps `W` for A→X and mints a new ID for X→B; Openings rebase; Room boundaries rewritten | The creator still sees "one wall" | **Reconsider (evidence-gated)** | A T-join silently halves the creator's Wall, so a Stop or Presentation bound to "the wall" now covers half. Options: (a) keep splitting and add a derived *continuity run* for selection and binding; (b) *hosted Junction stations* (a Junction at offset s on an unsplit Wall), with splitting derived for face extraction | (b) changes Room boundary refs to (wallId, interval). Unknown whether (a) is enough. → **E1** | (a) low; (b) high: a Layout cutover |
| Wall vertical model | [Current] constant `height`; bottom = `floor.elevation`; Room ceiling = max boundary height | Z_min / Z_max per mass; gable fill; H(s) | **Evolve** | Needs a **base reference** (level or structure datum + offset) and a **top reference**: an authored height, *or* derived from a declared supported overhead element (gable fill and raking tops become derived, never authored triangles). H(s) for decorative tops is out of scope | Shared walls between split levels are the hard case → **E4** | Medium: a Layout cutover |
| Floor datum / levels | [Current] one Floor. [Ratified] levels, structures, level-qualified F.1 refs | Per-mass Z bounds; no levels | **Evolve** | A whole-building Z_min drag = translating a *structure frame*; a floor-level change = moving a *level datum*. Neither is an edit to Wall height | Prior multi-level research proposes "elastic horizons". Plausible as working planes, but Room-owned volumes conflict with derived Rooms | High: RR-1 |
| Rooms (derived faces + persistent identity) | [Current] P23.8 reconciliation; safe components only | Authored cells (half-edge complex) | **Keep** | The current graph already *is* a planar arrangement with derived faces. Authoring cells duplicates the Walls | Strong | — |
| Semantic Space / Building / open Space | [Ratified] Space, Site, Building, Level, Zone; Room is one kind of Space; schema not ratified | Wall closure state (colonnade, railing) on cell edges | **Evolve; reject the closure-state edge** | Open Spaces need a semantic boundary that is not a Wall: an authored region, or one derived from an overhead footprint. Never an invisible Wall | Schema unratified; P3 can demo with an authored region | Medium |
| Openings | [Current] hosted, meter offsets, analytic sections | Openings generated by path×wall chemistry | **Keep; reactions become proposals** | A generated archway that vanishes when a path moves cannot be a durable Experience target | Strong (F.1) | — |
| Roof / overhead | [Current] none; flat Room ceiling polygon only | Box-warp + WSS; roof params on mass | **Evolve: new Layout element family** (see §4) | Must cover multi-Room roofs, canopies with no walls, overhang beyond the footprint, and curved supports | → **E3** | High: RR-2 |
| Ceiling | [Current] flat, derived per Room | Shell offset of the roof | **Keep the default, add an optional independent ceiling** | A ceiling that follows the roof is a skeleton problem (see the miter note). A calm interior under an expressive roof is the P3 value claim | Owner question: does a separate ceiling earn its cost? | Medium |
| Slab / mezzanine | [Current] Room floor polygon at the datum | Cell floor at Z_min | **Evolve (same family as roof)** | A mezzanine is a partial slab not bounded by Walls, so it cannot be Room-derived | → **E4** | Medium |
| Building gestures (rectangle, circle, polygon, side pull) | [Current] the rectangle/polygon helper compiles to Walls in one transaction | Mass handles A–F | **Evolve** | Bake into canonical Walls on creation. Handles are *recognized* from current geometry (rectangle, circle-fit, regular polygon), not stored. A side pull = translate a Wall along its normal while adjacent Walls extend along their own lines | Recognition ambiguity after free edits → **E2** | Medium (planners) |
| Retained parametric intent | [Ratified] procedural definitions keep parameters + a correspondence policy | Persist the mass and its roof vector | **Defer, evidence-gated** | Retained generators duplicate intent and need a regeneration↔identity mapping (the Revit in-place problem). Fit for *reusable Layout definitions* (a tower type placed 3×), not for every rectangle | → **E2** | High if adopted |
| Reactive chemistry | none | Tier 0/1/2; k ≤ 2; automatic merges and reflow | **Split three ways** (see §5) | Derived geometry is safe. Semantic mutations need acceptance. Suggestions stay ephemeral | Strong; the hysteresis thresholds need tuning | Low–medium |
| Procedural detail (masonry, tiles) | none | Instanced bricks; slot hashing | **Defer / question scope** | Biskiq's audience (exhibition, pavilion, explanation) rarely needs bricks. If it ever does, it is a deterministic representation over compiled Walls (Layout-owned, runtime-safe), never authored | The research overvalues decoration relative to Biskiq's use | Medium if done |
| Compiler & invalidation | [Current] whole-document compile; cache keys computed but not memoized | Spatial hash + dirty AABB | **Evolve when measured** | Memoize per-record output by cache key and topology component (identity-scoped, not spatial). Biskiq scenes are 10²-scale, not Tiny Glade's 10⁵ | No current drag benchmark (P23B bench removed) | Low |
| Render adapter | [Current] a new `BufferGeometry` per build; pick ranges kept | Ring buffers; SSBO | **Evolve when measured** | Reuse attributes when counts are unchanged. Use `InstancedMesh` only for repeated detail | Three.js WebGL2 has no SSBOs or compute | Low |
| GPU compute / WebGPU / workers / WASM | none | Compute layout, mesh shaders | **Defer** | No measured need. A pure-TS compiler can move to a worker with generation tokens (already ratified) if a skeleton solve exceeds the frame budget | Measure before adopting | — |
| Editor/visitor parity | [Ratified] runtime-safe evaluators; release derivatives allowed | GPU-only detail | **Keep** | New evaluators (roof, slab) live in `layout-core`, runtime-safe from the first commit | — | — |

---

## 3. Competing architecture proposals

### A. Wall-first + gesture compilers + Layout surface elements ("evolve")
- **Shape:** Walls, Junctions, Openings and Rooms stay as they are.
  - High-level gestures (freehand, rectangle, circle, polygon, side pull) compile into
    canonical Walls in one F.4 transaction.
  - Handles are recognized from the current geometry.
  - New Layout *surface elements* (slab, ceiling, roof, canopy) have their own identity, a
    boundary whose vertices are either free or anchored to Junction IDs, a vertical
    reference, and a profile family.
  - Walls gain base/top references.
- **Strengths:** one authority and one compiler; free and curved Walls come for free;
  durable identity for Experience binding; the existing reconciliation and Junction kernel
  are reused.
- **Failure modes:** after free edits, recognized handles can become ambiguous (is this
  still a rectangle?). Roof boundaries anchored to Junctions can re-fit unpredictably after
  noding or splits. Gestures carry more planner logic.
- **Compatibility:** additive Layout cutovers (levels, surfaces, Wall vertical refs). The
  ratified ownership is intact.

### B. Mass-first procedural source (the report's `BuildingMassNode`)
- **Shape:** buildings are authored footprints with Z bounds and a roof vector. Walls,
  floors and roofs are generated. Interiors come from cell splits. Free walls are separate
  spine curves.
- **Strengths:** exterior sculpting, roof re-centering and whole-building resizing are
  trivial and stable.
- **Failure modes:**
  - There are two wall authorities.
  - Generated-wall identity churns when footprint edges split (the index anchors break).
  - Openings and Experience refs ride on generated walls.
  - Shared walls between adjacent buildings and at mass seams need "gluing" rules.
  - Interior Room reconciliation duplicates what cell topology already decides.
- **Compatibility:** contradicts the owner ruling that the Wall is the authored primitive.
  It needs a full Layout replacement.

### C. Hybrid: retained Structure generator with detach/override
- **Shape:** a Structure (a Layout definition instance) keeps its parameters and emits
  canonical Walls and a roof with lineage. Editing an emitted Wall either detaches it or
  records an override.
- **Strengths:** whole-structure edits survive; reusable definitions match the ratified
  "architectural definitions/instances".
- **Failure modes:** duplicated intent, override conflicts, and regeneration that must map
  back onto the same Wall IDs (correspondence policy). Creators also have to understand
  when a Wall is "still generated".
- **Compatibility:** fits north-star's procedural-definition clause, but needs a
  correspondence-policy contract (F.1 generation-qualified identity extended to *authored*
  outputs).

### D. Space-first semantic cells with derived physical elements
- **Shape:** Spaces (cells) are authored. Walls are derived as cell boundaries, with
  closure states.
- **Strengths:** interiors and adjacency are explicit; exhibition planning thinks in rooms.
- **Failure modes:** fabricated boundaries for open sides; free-standing and curved
  sculptural walls become second-class. It inverts the derived-Room model that the P23.8
  reconciliation work already proved.
- **Compatibility:** contradicts the derived-Room principle.

**Assessment:** A is the strongest baseline. C is the credible escape hatch, scoped to
*reusable definitions* if E2 shows that recognized handles fail. B and D buy exterior ease
at the cost of the identity and ownership properties Biskiq's Experience layer depends on.
A is not chosen because it changes the least. B's failures land on exactly what
differentiates Biskiq: durable semantic targets, explanation and revision.

---

## 4. Recommended direction

**Safe to keep:** Wall/Junction authority, declared connectivity, cubic-chain curves,
meter-offset hosted Openings, derived Rooms with lineage reconciliation, one canonical
compiler, runtime-safe evaluators, analytic opening sections and source-identity picking.

**Creator experience changes (no representation change needed):**
- Freehand curved Wall stroke → one Wall (stroke fitting). A self-crossing stroke is
  refused or offered as explicit noding.
- Rectangle, circle and polygon "building" gestures that bake Walls. Circles become ≥ 2
  cubic Walls.
- Recognized-shape handles: a side pull (translate a Wall along its normal while its
  neighbours extend) and a uniform radius for circle-fit enclosures.
- Inference guides (parallel, perpendicular, equal height) as suggestions.
- Reactions shown as live previews with hysteresis and accepted on release as one
  transaction:
  1. **Derived automatically:** Junction joins, opening sections, Wall-top trim or gable
     fill under a *declared* supported roof, roof re-fit to anchored Junctions, any
     decoration, Plan representation.
  2. **Accept explicitly:** creating or removing an Opening (a path or Wall crossing),
     noding, merging roofs or structures, columns that affect navigation, moving authored
     Opening offsets (chimney/window "reflow" is a display adaptation unless accepted),
     Room splits and merges.
  3. **Ephemeral suggestions:** snaps, guides, would-be archways, merge ghosts.
  Accepted reactions mint IDs once. Derived reactions never mint authored IDs; they emit
  generation-qualified fragments only. Undo restores the snapshot; it never re-runs
  chemistry.

**May need a canonical cutover (each one an owner decision):**
1. **Surface-element family** in Layout (slab / ceiling / roof / canopy):
   - Boundary: polygon or curve vertices, each free or Junction-anchored, with an optional
     overhang offset.
   - Vertical reference: level or structure datum + offset; a roof's eave height is its
     own parameter, initialized from the supporting Walls.
   - Profile family: flat; rectangular/circular analytic with ridge fraction, per-end
     hip/gable/half-hip and curvature (the corrected Method A); general polygon via a
     weighted skeleton only after the robustness proof.
   - Explicit *support relations* to Walls and columns. Walls declared as supporting
     derive their top from the roof underside.

   Alternatives to compare in P3: Room-owned roof (rejected for multi-Room roofs and
   canopies) and a universal dual-skin shell (too general for the first family).
2. **Vertical reference model:** levels (named datums, possibly per structure) and
   structure frames. Wall base = a level reference; Wall top = an authored height or a
   supported surface.
3. **T-noding identity:** split + derived continuity run (cheap), or hosted Junction
   stations (cutover).
4. **Retained intent:** none by default. Reusable Structure definitions with a
   correspondence policy only if E2 demands them.

**Not Tiny-Glade-shaped on purpose:** no automatic structure merging by overlap, no
authored state hidden in derived tiers, no GPU-first pipeline, no procedural masonry
without a product case. The weighted straight skeleton is a poor first fit for Biskiq's
curved Walls: polygonized curves produce fans of tiny facets. Curved footprints want
radial/cone/dome families or offset-curve methods, and that is itself a P3 finding to
check.

---

## 5. Critical experiments (falsification-oriented)

| ID | Scenario | Measures | Falsifies the recommendation if… |
|---|---|---|---|
| **E1** Continuous curve then topology | Stroke a 25 m curved Wall (one cubic chain); bind a Stop to it; T-join a second Wall at mid-span; X-cross a third; undo/redo; move the T-Junction along the Wall | Wall IDs before/after; what the Stop resolves to; selection expectation (one wall or three); Opening rebasing; reconciliation outcome | Creators and Experience bindings need "the wall" to persist across T-joins and the continuity run can't provide it → hosted Junction stations (a cutover) |
| **E2** Whole-building resize then individual edits | Rectangle gesture → 4 Walls + roof; side-pull east; angle one Wall 10°; curve another; side-pull again; then circle → radius drag → push one arc out | Whether recognized handles still exist and behave; surprises per edit; comparison with a retained-generator variant (C) on the same script | Recognized handles disappear or misbehave in common cases and creators expect the building to "remember" → adopt C for definitions |
| **E3** Roof over enclosed and open architecture | Hip/gable/curved roof over a 2-Room enclosure with a partition; move a boundary Wall; split a Room under the roof; a canopy on four columns with no Walls; an overhang past the footprint; a roof over a curved Wall; a calm flat ceiling under a steep roof | Anchored re-fit predictability after noding/splits; Wall-top agreement; supported vs free boundary; a ceiling distinct from the roof | Anchored boundaries re-fit unpredictably → free-polygon roof with explicit "fit to Walls" commands; or a separate ceiling adds no value → keep the Room-derived ceiling |
| **E4** Height and elevation across levels | Two structures; raise one as a whole (frame translate); raise one Space's floor (split level); insert a mezzanine slab in a double-height Space; a Wall shared by Spaces at different floor heights; an eave across Walls of unequal height | Number of base references a shared Wall needs; what the creator expects to move; Plan/Section legibility | Shared Walls need several base references or per-segment bases → Walls need vertical segmentation (a larger cutover), or volume-first Spaces gain ground |
| **E5** (cheap) Reaction acceptance & cost | Path-through-Wall preview with a 25°/15° hysteresis band, accepted on release; undo; a Stop bound to the archway; drag a Wall in a 200-Wall document | Flicker count; one history entry; binding survival; compile ms/frame on a mid-range laptop | Whole-document compile exceeds ~8 ms during drag → memoization or a preview lane becomes required, not optional |

---

## 6. P3 planning handoff (constraints, not a plan)

**Hard constraints**
- One canonical Layout compiler. Any roof, slab or ceiling evaluator lives in
  `layout-core` and is runtime-safe.
- No second wall authority. No authored "invisible Walls" for open Spaces.
- Proximity and overlap never create topology or merges without declared, accepted intent.
- Derived fragments are generation-qualified with source correspondence; they are never
  durable Experience targets.
- One gesture produces one F.4-accepted result and one undo entry. Reactions are inside it
  or ephemeral.
- Level/structure qualification of references comes before multi-level authoring
  (F.1 Layout multiplicity).
- Prototype geometry and parameterizations are evidence, not schema.

**Open decisions for the owner:**
- RR-2: surface-element family vs alternatives.
- RR-1: the vertical reference model.
- The T-noding identity policy.
- Retained intent (none vs definitions).
- Whether procedural decoration is in product scope.
- Whether a separate interior ceiling earns its cost.

**Technical alternatives to keep alive**
- Roof profiles: analytic rectangular/circular first; weighted skeleton gated on
  robustness. Use the corrected Method A form (1 − w)(1 + c·w), or Φ(u; c), noting its C⁰
  rate change.
- Ceiling offset: plane-arrangement offset, not per-vertex Σn̂/‖Σn̂‖².
- Detail (if any): CPU layout + `InstancedMesh`, seeded by fixed-width slots from an
  anchored end.

**Evidence gates:** E1–E5 above. The research's performance figures (32 B, 15×, < 0.3 ms,
> 240 FPS) are hypotheses and must not be carried into acceptance criteria.

**Where a durable reconciliation would go, if the owner wants one:** this report is
research input next to the study it assesses. A later decision-input note would sit beside
[T1's planning evidence](../docs/roadmap/t1-spatial-world/planning-evidence.md) (evidence,
not authority) and should be written *after* P3's experiments. A record in
[`docs/reference/decisions/`](../docs/reference/decisions/) follows only if the owner ratifies
RR-1 or RR-2 ([research triggers](./post-p01-roadmaps/README.md)). Nothing here promotes these
recommendations into `docs/reference/` or the T1 roadmap.
