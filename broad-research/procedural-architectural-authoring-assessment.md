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
verification notes this report relies on. It was written against PR #166 at `444fab56`
and revised after peer review of `ab939664`. The revision reconciles it with T1's planning
evidence on closed circles (D8), Wall tops and ceilings (§3, D2), and automatic following
(D3), and with F.1 binding durability. It also restates the reaction tiers and treats the E5
timing figure as a diagnostic.
**Labels used throughout:** **[Current]** is shipped code. **[Ratified]** is a destination
contract that is not yet built. **[Research]** is a PR #166 proposal. **[Rec]** is this
review's recommendation.

---

## 1. Executive verdict

**The research mostly adds new gestures and derived evaluators. It also points to several
substantial Layout extensions, most of them already anticipated. It does not justify
reconsidering Wall ownership.**

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
- What Biskiq needs is not a building mass but several separate Layout extensions, each a
  substantial cutover in its own right:
  - **horizontal and overhead elements** (slab, ceiling, roof, canopy), which do not exist
    today;
  - **vertical references** (levels or structure frames, and Wall base/top references),
    because today there is one Floor datum, a constant Wall height and Wall bottoms fixed
    to the Floor;
  - **Wall top profiles** and the **single-Wall closed circle**, which T1's planning
    evidence already carries as accepted outcomes awaiting a representation (§2–§3, D8).

  The ratified record already reserves the first two as open Layout decisions
  ("slab/ceiling ownership", "host-topology expansion versus isolated structures").
  Independent ceiling intent is already accepted T1 planning vocabulary (CeilingRegions,
  D2), not a new proposal. The research makes these extensions urgent for P3; it does not
  create them, and nothing here bundles them into one cutover.
- The research's own target architecture is a `BuildingMassNode` owning walls and roof,
  plus a planar cell complex with per-edge "wall closure state", plus derived Tier-1
  chemistry. Adopting it as canonical source would be a regression for Biskiq:
  - It creates a second wall authority, since free walls still need `SpineCurveNode`.
  - It keys anchors by index (`edge_or_facet_idx`), which F.1 forbids.
  - It fabricates edges for open sides.
  - It lets proximity become topology, contradicting north-star's "proximity may suggest;
    never becomes implicit topology".
- **Consequence:** moderate for the foundations, substantial for Layout's scope. It
  overturns no foundation, but it brings forward decisions P3 must face: roof/slab
  ownership, the vertical reference model with one authoritative Wall top, the identity of
  a Wall under T-noding, and the policy for retaining building intent. The D8 closed-circle
  representation also stays on that list.
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
| Curved centerline | [Current] `cubic-chain` with identified knots that carry no connectivity; one open Wall can be one long curve. The codec rejects start = end, so *today* a closed loop needs ≥ 2 Walls | Freehand spine with arc-length LUT | **Keep representation for open curves, evolve gesture; closed circles follow D8** | Open strokes need a stroke→cubic-chain fitting planner (decimate, smooth, fit). Closed circles are not a gesture question: T1's accepted D8 outcome is **one** self-connected Wall enclosing one Room, with identity kept through hosted Openings, radius editing and unfolding. The multi-Wall ring stays valid architecture but does not meet that outcome | The start = end refusal is today's codec limit, not the destination. The representation is still open (P7-gated): a closed-circle centerline variant with one seam Junction, or a bounded cubic alternative | Medium: closed circles need a Layout cutover |
| Wall splitting under T/X noding | [Current] a split keeps `W` for A→X and mints a new ID for X→B; Openings rebase; Room boundaries rewritten | The creator still sees "one wall" | **Reconsider (evidence-gated)** | A T-join halves the creator's Wall. A binding to `W` still resolves after the split, but now to the A→X half: valid identity, changed meaning. Options: (a) keep splitting and add a derived *continuity run* for **selection only**; (b) *hosted Junction stations* (a Junction at offset s on an unsplit Wall), with splitting derived for face extraction; (c) an authored grouping identity. A derived run cannot be a durable binding target under F.1, since derived fragments "are not valid durable substitutes for source identity". Durable bindings need (b), (c) or explicit F.1 repair | (b) changes Room boundary refs to (wallId, interval). Unknown which identity creators and Presentations need. → **E1** | (a) low, but selection only; (b) high: a Layout cutover; (c) medium |
| Wall vertical model | [Current] constant `height`; bottom = `floor.elevation`; Room ceiling = max boundary height | Z_min / Z_max per mass; gable fill; H(s) | **Evolve** | Needs a **base reference** (level or structure datum + offset) and **one authoritative top definition**. T1 already retains level/slope/gable Wall tops measured along the Wall (planning evidence §3), with level as today's scalar case. A roof-driven top is a candidate *variant* of that same definition, not a second writer: D4 rules out competing height/profile writers. Free-form H(s) for decorative tops is out of scope | The encoding is open: §3 asserts none. Shared walls between split levels are the hard case → **E4** | Medium–high: a Layout cutover |
| Floor datum / levels | [Current] one Floor. [Ratified] levels, structures, level-qualified F.1 refs | Per-mass Z bounds; no levels | **Evolve** | A whole-building Z_min drag = translating a *structure frame*; a floor-level change = moving a *level datum*. Neither is an edit to Wall height | Prior multi-level research proposes "elastic horizons". Plausible as working planes, but Room-owned volumes conflict with derived Rooms | High: RR-1 |
| Rooms (derived faces + persistent identity) | [Current] P23.8 reconciliation; safe components only | Authored cells (half-edge complex) | **Keep** | The current graph already *is* a planar arrangement with derived faces. Authoring cells duplicates the Walls | Strong | — |
| Semantic Space / Building / open Space | [Ratified] Space, Site, Building, Level, Zone; Room is one kind of Space; schema not ratified | Wall closure state (colonnade, railing) on cell edges | **Evolve; reject the closure-state edge** | Open Spaces need a semantic boundary that is not a Wall: an authored region, or one derived from an overhead footprint. Never an invisible Wall | Schema unratified; P3 can demo with an authored region | Medium |
| Openings | [Current] hosted, meter offsets, analytic sections | Openings generated by path×wall chemistry | **Keep; reactions become proposals** | A generated archway that vanishes when a path moves cannot be a durable Experience target | Strong (F.1) | — |
| Roof / overhead | [Current] none; flat Room ceiling polygon only | Box-warp + WSS; roof params on mass | **Evolve: new Layout element family** (see §4) | Must cover multi-Room roofs, canopies with no walls, overhang beyond the footprint, and curved supports | → **E3** | High: RR-2 |
| Ceiling | [Current] flat, derived per Room. [Accepted T1 planning vocabulary] independent Layout-owned CeilingRegions with closure vs suspended intent (§3, D2) | Shell offset of the roof | **Keep the accepted direction** | Independent ceiling intent is already accepted, so it is not this report's proposal. The generated per-Room ceiling stays a fallback only for uncovered enclosure (D2). A ceiling that *follows* the roof is a skeleton problem (see the miter note), so roof-following ceilings belong behind the first flat/shed/gable family | Open per D2: Floor-relative vs world-fixed overhead under datum change, coverage. Accepted planning evidence, not yet a ratified contract | Medium |
| Slab / mezzanine | [Current] Room floor polygon at the datum | Cell floor at Z_min | **Evolve (same family as roof)** | A mezzanine is a partial slab not bounded by Walls, so it cannot be Room-derived | → **E4** | Medium |
| Building gestures (rectangle, circle, polygon, side pull) | [Current] the rectangle/polygon helper compiles to Walls in one transaction | Mass handles A–F | **Evolve** | Bake into canonical Walls on creation. Rectangle and polygon handles are *recognized* from current geometry, not stored. A side pull = translate a Wall along its normal while adjacent Walls extend along their own lines. Circles are the exception: D8's single Wall keeps radius/diameter editing, and if the closed-circle variant is chosen the radius is authored on that Wall, not recognized | Recognition ambiguity after free edits → **E2** | Medium (planners) |
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
  - Walls gain base references and one authoritative top definition.
- **Strengths:** one authority and one compiler; free and curved Walls come for free;
  durable identity for Experience binding; the existing reconciliation and Junction kernel
  are reused.
- **Failure modes:** after free edits, recognized handles can become ambiguous (is this
  still a rectangle?). Roof boundaries anchored to Junctions can re-fit unpredictably after
  noding or splits, and anchoring is a form of automatic following that T1's D3 currently
  disfavours. Gestures carry more planner logic.
- **Compatibility:** several separate, substantial Layout cutovers (levels, surface
  elements, Wall vertical references, the D8 closed circle), each needing its own plan.
  The ratified ownership is intact.

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
- Rectangle and polygon "building" gestures that bake Walls. A circle gesture targets D8's
  single self-connected Wall once its representation lands; until then the multi-Wall ring
  is only an interim stand-in and does not meet the accepted outcome.
- Recognized-shape handles: a side pull (translate a Wall along its normal while its
  neighbours extend). A circle's radius/diameter is edited on its one Wall (D8).
- Inference guides (parallel, perpendicular, equal height) as suggestions.
- Reactions shown as live previews with hysteresis and accepted on release as one
  transaction:
  1. **Derived automatically (pure geometry):** Junction *geometry resolution* (miter,
     bevel, trim, partition) for connectivity that is already declared; opening sections;
     Wall tops evaluated from their one authoritative top definition; any decoration; Plan
     representation. Nothing in this tier creates or changes topology.
  2. **Accept explicitly:** new Junction connectivity of any kind (joining, noding),
     creating or removing an Opening (a path or Wall crossing), merging roofs or
     structures, columns that affect navigation, and moving authored Opening offsets
     (chimney/window "reflow" is a display adaptation unless accepted). Room splits and
     merges are not a separate acceptance. They are previewed consequences of an accepted
     topology change, reconciled inside the same transaction, and an ambiguous
     reconciliation rejects the whole operation (P23.8).
  3. **Ephemeral suggestions:** snaps, guides, would-be archways, merge ghosts.
  Accepted reactions mint IDs once. Derived reactions never mint authored IDs; they emit
  generation-qualified fragments only. Undo and Redo restore the authored snapshot and
  never re-run semantic decisions (Room matching, reaction acceptance). Pure geometry,
  tier 1 included, is re-evaluated from the restored snapshot.

**May need a canonical cutover.** Each is a separate, substantial Layout extension with its
own owner decision and plan, not one bundled change:
1. **Surface-element family** in Layout (slab / ceiling / roof / canopy). Ceilings extend
   the already-accepted CeilingRegion intent (D2) rather than introducing it.
   - Boundary: polygon or curve vertices, each free or Junction-anchored, with an optional
     overhang offset. Junction anchoring is a challenger. D3 currently prefers explicit
     one-shot fits with previews and "no automatic following", and anchoring is
     automatic following by reference. E3 decides between them.
   - Vertical reference: level or structure datum + offset; a roof's eave height is its
     own parameter, initialized from the supporting Walls.
   - Profile family: flat/shed/gable first (the accepted overhead vocabulary);
     rectangular/circular analytic with ridge fraction, per-end hip/gable/half-hip and
     curvature (the corrected Method A) next; general polygon via a weighted skeleton only
     after the robustness proof.
   - Explicit *support relations* to Walls and columns. A supported Wall's top becomes a
     variant of its one authoritative top definition, never a second writer.

   Alternatives to compare in P3: Room-owned roof (rejected for multi-Room roofs and
   canopies) and a universal dual-skin shell (too general for the first family).
2. **Vertical reference model:** levels (named datums, possibly per structure) and
   structure frames. Wall base = a level reference; Wall top = one authoritative definition
   (level, slope or gable profile, or a supported surface).
3. **Closed circles:** the D8 single self-connected Wall (closed-circle centerline with one
   seam Junction, or the bounded cubic alternative).
4. **Wall identity under T-noding:** a split plus a derived continuity run (selection
   only), hosted Junction stations, or an authored grouping identity.
5. **Retained intent:** none by default. Reusable Structure definitions with a
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
| **E1** Continuous curve then topology | Stroke a 25 m curved Wall (one cubic chain); bind a Stop to it; T-join a second Wall at mid-span; X-cross a third; undo/redo; move the T-Junction along the Wall | Two things measured **separately**: (1) *selection continuity*, whether the creator expects one wall or three and whether a derived run satisfies that; (2) *binding durability*, what the Stop resolves to under F.1 after each step (a valid ID with changed meaning, explicit repair, or intact). Also Wall IDs before/after, Opening rebasing, reconciliation outcome | (1) can pass with a derived run while (2) fails. If Presentations need "the wall" intact across T-joins, the run is insufficient → hosted Junction stations or an authored grouping identity (a cutover) |
| **E2** Whole-building resize then individual edits | Rectangle gesture → 4 Walls + roof; side-pull east; angle one Wall 10°; curve another; side-pull again. Separately, a D8 circle (single Wall, or the interim multi-Wall ring as control) → radius drag → push one arc out | Whether recognized handles still exist and behave; surprises per edit; comparison with a retained-generator variant (C) on the same script; whether the circle stays one Wall with its Room and Openings | Recognized handles disappear or misbehave in common cases and creators expect the building to "remember" → adopt C for definitions |
| **E3** Roof over enclosed and open architecture | Hip/gable/curved roof over a 2-Room enclosure with a partition; move a boundary Wall; split a Room under the roof; a canopy on four columns with no Walls; an overhang past the footprint; a roof over a curved Wall; a calm flat ceiling (CeilingRegion) under a steep roof | Junction-anchored boundary vs D3's explicit one-shot "fit to Walls" with preview: predictability after noding and splits; Wall-top agreement; how legible the distinct ceiling is | Anchored boundaries re-fit unpredictably → keep D3's one-shot fit. The ceiling result shapes only the priority of roof-following ceilings; independent ceiling intent is already accepted |
| **E4** Height and elevation across levels | Two structures; raise one as a whole (frame translate); raise one Space's floor (split level); insert a mezzanine slab in a double-height Space; a Wall shared by Spaces at different floor heights; an eave across Walls of unequal height | Number of base references a shared Wall needs; what the creator expects to move; Plan/Section legibility | Shared Walls need several base references or per-segment bases → Walls need vertical segmentation (a larger cutover), or volume-first Spaces gain ground |
| **E5** (cheap) Reaction acceptance & cost | Path-through-Wall preview with a 25°/15° hysteresis band, accepted on release; undo; a Stop bound to the archway; drag a Wall in a 200-Wall document | Flicker count; one history entry; binding survival; compile ms/frame on a mid-range laptop | Exploratory diagnostic only. No frame budget is ratified, and ~8 ms (half a 60 Hz frame) is a working reference, not an acceptance threshold. Compile time well above it during drag is a signal to prototype memoization or a preview lane; adopting either is an owner decision |

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
- RR-2: surface-element family vs alternatives, including Junction anchoring vs D3's
  one-shot fit.
- RR-1: the vertical reference model and the one authoritative Wall top definition.
- The D8 closed-circle representation (already P7-gated).
- The T-noding identity policy.
- Retained intent (none vs definitions).
- Whether procedural decoration is in product scope.
- D2's open points: Floor-relative vs world-fixed overhead, and coverage. Whether
  independent ceilings exist is already settled by accepted planning vocabulary.

**Technical alternatives to keep alive**
- Roof profiles: analytic rectangular/circular first; weighted skeleton gated on
  robustness. Use the corrected Method A form (1 − w)(1 + c·w), or Φ(u; c), noting its C⁰
  rate change.
- Ceiling offset: plane-arrangement offset, not per-vertex Σn̂/‖Σn̂‖².
- Detail (if any): CPU layout + `InstancedMesh`, seeded by fixed-width slots from an
  anchored end.

**Evidence gates:** E1–E5 above. The research's performance figures (32 B, 15×, < 0.3 ms,
> 240 FPS) are hypotheses, and so is this report's E5 reference figure. None may be carried
into acceptance criteria.

**Where a durable reconciliation would go, if the owner wants one:** this report is
research input next to the study it assesses. A later decision-input note would sit beside
[T1's planning evidence](../docs/roadmap/t1-spatial-world/planning-evidence.md) (evidence,
not authority) and should be written *after* P3's experiments. A record in
[`docs/reference/decisions/`](../docs/reference/decisions/) follows only if the owner ratifies
RR-1 or RR-2 ([research triggers](./post-p01-roadmaps/README.md)). Nothing here promotes these
recommendations into `docs/reference/` or the T1 roadmap.
