# P26 — Architectural Spatial Depth: Design-Research Synthesis

> **Superseded direction (2026-09-24):** the accepted Continuous Spatial Authoring prototype and [P26 umbrella](../../2026-09-24-P26-continuous-spatial-authoring-umbrella.md) now own experience direction and proposed phase scope. This document is supporting provenance, not a competing design authority. Its separate Plan / orthographic / 3D role restrictions and any REGISTER/SVG presentation assumptions are superseded; independently accepted domain decisions are retained explicitly in the umbrella. Earlier authority/status wording below describes this artifact's original research/assignment role.


**Status:** supporting research synthesis; the umbrella above supersedes its experience framing. Originally prepared for external P26 designers. Sits above three evidence records: Phase-1 deep research (`deep-research-P26-phase-1.md`), FreeCAD harvest (`P26-phase2-freecad-section-orthographic-harvest.md`), Bonsai harvest (`P26-phase2-bonsai-view-identity-rcp-harvest.md`). Those remain the evidence; this document is the conclusion.

**What this document is:** the evidence-backed product/design direction, what is provisional, and what belongs to designers. **What it is not:** an implementation plan, a schema, or UI polish.

---

## 1. What P26 now is

> **P26 makes Layout genuinely spatial: one canonical wall-first model acquires controlled vertical structure plus a precise orthographic surface for authoring it — Plan stays horizontal authority, contextual Orthographic (Section, Wall Elevation, Ceiling Focus) becomes the vertical precision instrument, 3D proves the space. All edit one `LayoutDocument`.**

Capability boundaries against neighbors:

```text
P23 → architectural Plan + topology + drafting.
     Walls/Junctions, semantic Rooms, hosted Openings, curves,
     topology-aware direct edit, snap/guides, identity, one compiler,
     deterministic history. Single-target; flat-ish world.

P26 → vertical/spatial architectural authoring.
     Wall-top profiles, Opening sill/head/arch authoring, Column/Platform
     extents, independent CeilingRegions (flat/shed/gable), contextual
     Section + Wall Elevation + Ceiling Focus instruments, shared ortho
     derivation/selection/snap, datum-safe numerics. No Levels, no sheets,
     no families, no documentation system.

P24 → staging / Scene objects / materials / lighting inside P26's space.
     Plinths, props, artwork holders, material/light authoring.
     Must not re-own architecture P26 defines.

P25 → visitor experience over the compiled result.
```

P26 absorbs neither neighbor: it adds no staging/material/light semantics (P24) and no visitor routing (P25), and it must not become full BIM (no IFC classification, phases, assemblies, schedules, structure, families, MEP, sheets — rejected in Phase-1 §12, unchallenged by either harvest).

The chain still holds: **P23 credible Plan+topology → P26 vertical form + orthographic precision → P24 staging/material/light → P25 visitor.** Both harvests ratified the load-bearing architectural bet underneath it — one canonical model with derived, non-authoritative orthographic views — in two independent mature codebases.

---

## 2. Orthographic product model

### Synthesized conclusion

**`Orthographic` is one shared instrument family over one shared derivation core, parameterized by an explicit view kind plus a small per-kind policy record. It is not a set of peer workspaces, and it is not orientation-only.**

The two harvests appeared to pull in opposite directions and instead converge:

- **FreeCAD:** one `SectionPlane` class, zero form enums — Sections, Elevations, Plans, RCPs all fall out of placement orientation through one `getSectionData → getCutShapes → getSVG` chain. Lesson: *the cut kernel needs no form parameter.*
- **Bonsai:** explicit `TargetView` enum (IFC `IfcGeometricProjectionEnum`, narrowed to 5 drawing kinds) fanning to ~12 branch sites — yet the cut/HLR core is view-blind (`auto-section`/`auto-elevation` hardcoded `False`; Section and Elevation take the identical branch). Lesson: *kinds exist and the cut core still ignores them; kinds parameterize camera, context set, mirror, and reference policy.*

Resolved: **FreeCAD proves the core can be kind-agnostic; Bonsai proves the product still needs explicit kind because policy is not fully encoded by orientation.** The one policy bit that settles it is RCP's `svg-mirror-y`: a mirrored serialized output is not derivable from a camera matrix (winding/text implications differ), so Bonsai carries both a negated matrix *and* a mirror flag. An orientation-only model silently drops that bit. Therefore:

```text
common core:  membership → derivation → typed primitives → render/interact
per-kind policy: camera derivation, context/scope rule, mirror flag,
                 epsilon offset, hint domain, reference harvesting
explicit kind (instrument state, transient-first): PLAN | SECTION | WALL_ELEVATION | REFLECTED (ceiling focus)
```

### Resolved positions

- **No permanent peer workspaces.** Model A (four peers) stays rejected: it implies a view manager, documentation lifecycle, and CAD-doc drift for zero architectural gain. Both harvests show views as lightweight states over one model (FreeCAD: properties on one object; Bonsai: pset + transient camera props).
- **One shared instrument family: yes.** Wall Elevation needs no dedicated generation path in either codebase (FreeCAD: no elevation code exists; Bonsai: section/elevation share the identical branch). It is a constrained section.
- **View kind explicit: yes** (Bonsai correction to FreeCAD's emergent orientation). Kind is explicit instrument state — it may live transiently in workspace state, a pinned-view record may persist it later, and it must never enter `LayoutDocument` architectural truth. Matrices/cameras derive from kind — the dependency runs kind→matrix, not matrix→kind. Bonsai proves kind should be explicit; it does not obligate Museum to persist it in the document.
- **Wall Elevation is not its own geometry system.** It is a wall-face-constrained section with shallow depth. The only legitimately per-kind code is reference/scope policy.
- **RCP is not a top-level mode.** It is a horizontal instrument with flipped policy (see §8). No peer workspace, no separate truth.

---

## 3. Canonical architecture → orthographic derivation contract

Research-level pipeline, now evidence-backed end to end:

```text
LayoutDocument (canonical truth)
  → compiler: canonical compiled architectural solids + hosted relations
  → MEMBERSHIP: single scope+range evaluation → (included[], excludedWithReason[])
  → DERIVATION: cut + project per source → typed primitives, each tagged
  → renderer / handles / snap / temp dims (read-only consumers)
  → user gesture → canonical intent → validation → one Layout transaction
```

Stage contracts (both harvests agree on the shape; both harvests' failures define the strictness):

| Stage | Canonical? | May persist? | Rules |
|---|---|---|---|
| `LayoutDocument` + compiled solids | **yes — the only truth** | yes (document + history) | Hosting/subtraction resolved here, once (FreeCAD `processSubShapes` direction; Bonsai kernel subtract). Sections consume solids, never re-subtract. |
| Instrument definition (kind, plane, span, depth, crop, scope) | no — editor state | at most the definition, transient-first, pinnable later | Never the output. Bonsai's pset↔props drift is the warning against dual bookkeeping. |
| Membership outcome | no — derived per (instrument, source versions) | cached, keyed thus | **Single evaluation stage.** FreeCAD's dropped-`Depth` and Bonsai's four disagreeing filters are the two negative precedents that jointly require this. |
| Typed primitives (`cut / projected / hidden / symbol`) | no | cached at source granularity | Split in data at derivation, styled at render (FreeCAD §5). Per-primitive canonical identity mandatory (§4). Merge prohibited on selectable streams unless membership records kept. |
| Rendered pixels / SVG / temp dims / guides | no | editor/session state **outside the canonical document** (Bonsai placement, structurally non-authoritative — preferred over FreeCAD's in-document `Symbol`) | Read-only. Never an input to architecture. |
| Mutation intents | — | transient until committed | Only path from any surface back to truth. One pipeline for Plan/Section/Elevation/3D/Inspector (Bonsai gizmo→op→IFC is the mechanism precedent). |

What must never become truth: derived primitives, merged linework, fills/poche, overlay batches, SVG output, snap candidates, temp dimensions, cached membership, pinned-view records (views may persist as *records*, never as geometry).

---

## 4. Identity contract

Both predecessors preserve identity a long way downstream and both break it at a **merge/flatten** stage. The contract below is the union of their success patterns plus guards at their exact failure points.

### Evidence-backed rules

1. **Every selectable derived primitive carries canonical source identity.** FreeCAD threads `(object, solids)` through booleans then flattens at `makeCompound`→HLR; Bonsai threads `element.id()` through 3D caches and `ifc:guid` through SVG until shapely-merge demotes 1:1→1:N. The loss point is never derivation — it is always a later flatten. So: project **per source**, tag `{sourceId, stream, subRef?}` on every primitive *including outlines*, and treat any stage that combines sources as an identity checkpoint.
2. **No section-local entity identity.** Both codebases agree without exception: FreeCAD links (`Objects` list, `Source`/`Base` back-links), Bonsai keys (`ifc_definition_id`, `element.id()`), zero proxy ids. Phase-1's constraint stands ratified.
3. **Merge/simplification cannot destroy membership information.** Neither predecessor has identity-preserving merge; both merge destructively (FreeCAD compounds, Bonsai shapely unions + single-buffer cut batches). Rule for P26 v1: **no merging on selectable streams**; merging allowed only in export paths and only with membership records. This is a hard constraint precisely because no implementation precedent shows a safe middle ground.
4. **Selection state belongs to canonical entities, not a view.** FreeCAD's tree selection is view-independent; Bonsai's camera-gated isolation can orphan selection across view switches — the failure to avoid. Persist selection as entity-key sets; view transitions may change handles, never identity (Phase-1 `O-7K3M` rule, now doubly evidenced).
5. **Entities outside depth/crop stay identified, with a reason.** Both predecessors drop out-of-view entities silently (FreeCAD: absent, no recourse; Bonsai: frustum-culled, unhittable). The single membership stage (§3) must emit **reason codes** (`outside-depth`, `outside-span`, `outside-crop`, `filtered-type`, `no-meaningful-projection`), and at least depth/crop exclusions surface Phase-1's `outside current section depth [Reveal]` affordance. Silent exclusion is the shared failure; reasoned exclusion is the synthesis.
6. **Opening interaction resolves from hosted semantic relations, not boolean faces.** Strongest cross-harvest agreement in the synthesis: FreeCAD bakes holes into `Wall.Shape` (identity gone from faces); Bonsai subtracts in-kernel *and* excludes openings from linework — yet keeps full identity one graph walk away (`HasOpenings`/`FillsVoids`, 15+ call sites). If openings are selectable/hoverable in Section/Elevation, derivation must **emit opening primitives from the host→opening relation explicitly**. No face-classification fallback exists in either codebase; do not design one.

### The five proposed constraints — assessed

| Proposed hard constraint | Verdict |
|---|---|
| Every selectable derived primitive carries canonical source identity. | **Adopt.** Both harvests show it is achievable; both show exactly where it breaks. |
| No section-local entity identity. | **Adopt.** Unanimous precedent. |
| Merge/simplification cannot destroy membership information. | **Adopt** (as v1 prohibition + records-on-export; no safe-merge precedent exists). |
| Selection state belongs to canonical entities, not a view. | **Adopt.** Bonsai's orphaning is the negative proof. |
| Opening interaction resolves from hosted semantic relations, not boolean faces. | **Adopt.** Unanimous; the only surviving opening-identity channel in either codebase. |

---

## 5. Hit / resolve / intent model

Bonsai's `tool/raycast.py` (1674 lines, zero IFC references) is the pattern: **hit knows geometry; resolve knows semantics; intents mutate.** Synthesized path:

```text
pointer
  → HIT: raycast over derived primitives → {primitive, sourceId, stream, point}
      (model-ignorant; one narrow waist; clipped geometry attributes to host)
  → RESOLVE: sourceId → canonical entity → entity semantics
      (openings via host→opening relation walk, never via faces;
       outside-view ids resolve to reason codes, not misses)
  → INTENT: gesture + entity + view context → canonical LayoutIntent
      (same intent constructors as Plan/3D/Inspector emit)
  → VALIDATE → one Layout transaction or nothing (P23 rule, unchanged)
```

Why projection geometry must not contain mutation logic: both harvests keep derived layers strictly read-only (FreeCAD: no drawing→model path exists; Bonsai: decorators never write, gizmos mediate ops back to IFC). Editing *through* a derived view is safe if and only if handles/gizmos translate gestures into canonical intents — the handle is a translator, never an author. This is also what makes per-view DOF safe (Vectorworks precedent from Phase-1): different views expose different handles, but all handles emit the same intent types.

Research guidance, not code: keep three call-boundaries (`hit()`, `resolve()`, `intend()`) with the middle one owning all semantic relations (hosting, ceiling-fit, containment). Snap is a fourth, model-ignorant service feeding `hit()` — reuse P23's engine, per Bonsai's one-snap-module precedent; no second vertical snap system.

---

## 6. Section instrument

Phase-1's `SectionInstrument` sketch survives with three harvest-driven amendments: **kind becomes explicit instrument state, depth becomes a derivation parameter, and exclusion becomes reasoned.**

```ts
// Research-level sketch (not implementation schema).
type OrthographicInstrument = {
  kind: 'section' | 'wall-elevation' | 'reflected';  // explicit instrument state (transient-first); Bonsai §3
  origin: Vec2; tangent: Vec2; lookSide: 'left' | 'right';
  span: { start: number; end: number };
  depth: { kind: 'cut-only' } | { kind: 'finite'; meters: number };
  // ^ required derivation parameter with finite default — never optional
  //   state consumers may ignore (FreeCAD negative precedent).
  verticalCrop?: { minY: number; maxY: number };
  scope?: { /* explicit inclusion; default = layout-wide */ };
};
```

Resolved positions:

- **Transient-first, pinnable later: ratified.** FreeCAD persists the definition (fine) and the output (avoid); Bonsai persists drawings + transient camera with documented drift (avoid the duality). P26: definition transient in workspace state → optional pinned view *records* (not geometry) → named views/sheets only if documentation ever becomes a goal (much later, Phase-1 Model E trajectory).
- **Plane/span/look:** `origin/tangent/lookSide` retained over FreeCAD's quaternion (UX-hostile, rotate-button workaround) — convert to matrix at derivation. Creation gesture (line-first vs drag-volume) stays designer territory; both harvests are silent (FreeCAD: selection-wrapped factory, no picking at all).
- **Finite depth + lateral crop + vertical crop:** all implementable as range operations on one derivation, no second truth (FreeCAD's `getCutVolume` proves the geometry; Bonsai's frustum proves the membership side). Default **finite** (multi-room readability; both harvests' unlimited defaults produce clutter, and neither defends them).
- **Cut-only:** no first-class implementation precedent in either harvest (only Archicad/Rhino zero-depth conventions from Phase-1). Semantics settled at research level — minimal far depth / kept-stream suppression — but interaction (toggle? zero-handle? mode?) is designer territory.
- **Reveal:** required affordance for depth/crop exclusions (fills both predecessors' silent-drop gap); exact interaction designer territory.
- **Source scope:** explicit scope with layout-wide default; scope-excluded entities are reason-coded, not vanished.
- **Fit/recenter:** pure functions of (scope, placement) with rotation-pinned tests (FreeCAD pattern, minus its X-only margin bug — use per-axis/max-dimension margin).

Still product-design decisions: default finite depth value, cut-only gesture, crop presentation (instrument chrome vs session pagination — FreeCAD's cropless section suggests crop may live in the view session, flagged but unresolved), transient-vs-recent-list, whether the cut line persists visibly in Plan after exit.

---

## 7. Wall Elevation

**Resolved direction: Wall Elevation is a constrained Section whose constraining plane is derived from the wall each rebuild — not a frozen arbitrary plane, not a separate system.**

Evidence stack: FreeCAD contains zero elevation-specific code (a constrained section needs none); Bonsai routes section/elevation through the identical branch with differences arriving only via camera params. Therefore:

- Definition: `wallId + side + horizontal extent + vertical crop + shallow background depth` (Phase-1, unchanged).
- **Wall-derived plane (refinement):** the face plane + depth derive from the wall's current geometry at each rebuild, so wall moves/curves carry the elevation along. Neither predecessor implements auto-follow (both freeze placement) — the architecture is precedented, the follow-behavior is new, and its UX (what "follow" means for curved walls, what happens when the wall is deleted) is designer territory.
- Entry: `select Wall → Open Elevation`; `select Opening → host Wall's Elevation`; `select Room → Interior Elevations` chooser over boundary walls (Model D as convenience workflow, ratified; Room stays navigation context, never owner — both harvests' containment evidence supports derivable-not-owned relations).
- Handles: opening width/sill/head/arch-rise, wall-top profile points; exact values in Inspector. Shared selection identity with Plan/Section/3D (§4). Non-represented geometry (walls too oblique to the plane) is rejected/redirected with a reason — never faked from oblique projection (Phase-1 rule, unchallenged).
- Still open UX: entry affordance (double-click vs menu vs Inspector vs floating action), return navigation design (must excel — the known weakness of contextual models), auto-follow edge semantics.

---

## 8. Ceiling / RCP / Ceiling Focus

Ownership and presentation are separate questions. The harvests answer them separately.

### Architectural model: first-class `CeilingRegion` — RATIFIED WITH REFINEMENT

```text
Ceiling ownership:
RATIFIED WITH REFINEMENT

Independent Layout-owned CeilingRegion is the selected P26 model.
Harvest evidence found no need for Room ownership or Level/CellComplex dependency.
Exact topology and spanning behavior remains implementation-reconciliation territory.
```

Phase-1 option D (independent region/surface; Room may seed/overlap, never owns) stands as the selected model. Deliberately a different evidence category than identity/shared-core/Levels: FreeCAD+Bonsai **directly demonstrate** the latter, while for ceilings they **support compatibility** — no Room-ownership requirement, no Level/CellComplex dependency found — without proving every multi-room topology resolves by footprint overlap alone:

- Bonsai's containment model shows room-free elements are normal: containment is a 0..1 scheduling/FM link, geometry resolves through placement chains, and sections operate storey-free. The harvests provide no evidence that a `CeilingRegion` must be Room-owned or require volumetric CellComplex topology. An independent Layout-owned region remains the best-supported bounded model. Multi-room spanning is a design assumption to validate during implementation reconciliation — not a reason to introduce volumetric topology now, and not a claim the harvests mathematically prove.
- Neither codebase gives ceilings view-level special treatment (Bonsai: zero `Covering`/CEILING branches in view code; FreeCAD: roofs consumed as generic solids), which confirms the ceiling needs no companion view machinery to function — it is authored as geometry, consumed generically.
- Profiles flat/shed/gable stand; freeform mesh, roof assemblies, overhangs/fascia/drainage stay out (unchanged rejection).
- The one un-harvested challenge (Homemaker CellComplex: does robust spanning need volumetric topology?) was assessed in the Bonsai harvest's close-out: containment evidence plus baked-solid sections already support the lightweight region; a full harvest is stood down unless design-phase work specifically doubts spanning. Not a blocker.

### Viewing/editing: lightweight reflected policy — RATIFIED with exact deltas

Bonsai's RCP is the dispositive evidence: **same pipeline and context set as Plan, plus Z-negated camera, `svg-mirror-y`-style mirror policy, ∓epsilon offset, explicit cut height (`storey.Z + 1.6 m`-pattern), zero ceiling-typed logic.** Therefore P26 needs:

- No permanent RCP workspace, no dedicated Ceiling mode, no RCP nomenclature for a non-CAD audience (Phase-1's "Ceiling Focus / reflected Plan overlay" wording holds).
- A `reflected` instrument kind reusing Plan scope at an explicit height with mirror policy — cheap enough that its P26-vs-follow-up scoping is a cost/benefit call, not an architecture call. Recommendation: include the *viewing* policy in P26 (it falls out of the shared core) while scoping *which ceiling handles* it exposes as designer territory.
- Cut height is an explicit instrument parameter with a sensible default, never derived from ceiling geometry (Bonsai reads no ceiling elevation for its cut).

---

## 9. Wall, Opening, Column, Platform vertical semantics

### Wall

- *Phase-1:* constant → bounded piecewise-linear top (`WallTopPoint {distanceAlongWall, y}`, arc-length on curves); forms constant/slope/gable; no arbitrary sketch.
- *Harvest:* FreeCAD walls are single-`Height` scalars sectioned generically; nothing contradicts profiles, and generic consumption means profiles need no section-side support. (SH3D endpoint-interpolation check stood down: piecewise-linear from the start already covers the two-elevation case as its degenerate form.)
- *Direction:* piecewise-linear top profile as the vocabulary; slope authored once on the object, consumed generically downstream (Roof-slope pattern from FreeCAD).
- *Uncertainty:* `fit-to-overhead` (`topMode: profile | fit-to-ceiling`) stays **provisional** — Revit-attach precedent only, acyclic direction specified (`ceiling → optional wall-top fit`), attached-state display and P26 inclusion undecided; needs layout-core reconciliation, flagged since Phase-1.

### Opening

- *Phase-1:* host+offset+width/height/sill + arch vocabulary exists; P26 adds authoring (width/sill/head/arch-rise handles + exact Inspector), no door families/jambs/catalogs.
- *Harvest:* both codebases resolve opening identity beside geometry (baked voids; relation graphs), never from faces. Handles operate on hosted params; derivation emits opening primitives from relations (§4.6).
- *Direction:* unchanged; plus the identity rule — opening handles bind the opening entity (keyed with host context where intents need it), never a wall-face region.
- *Uncertainty:* minimal per-primitive identity shape (opening id alone vs host+opening) for intent resolution — architecture decision at design time.

### Column

- *Phase-1:* footprint + base + height/top; Plan footprint, Section/3D height; Layout-owned when support/spatial-boundary, Scene-owned when decorative prop; meaning decides.
- *Harvest:* neutral (no column-specific view evidence either way — consistent with kind-agnostic consumption).
- *Direction:* unchanged. Ownership rule stands as stated.

### Platform

- *Phase-1:* footprint + base + thickness/top; Plan shape, Section rise/thickness, 3D manipulation; Layout-owned when it changes walking surface/room volume, Scene (P24) when artwork holder/plinth.
- *Harvest:* neutral on semantics; Bonsai's slab-join default (Wall+Slab merged linework) is a cautionary tale for identity — platforms must stay separately keyed through derivation even if their outlines ever merge visually.
- *Direction:* unchanged. No new entity systems invented.

---

## 10. Multi-room architecture and future Levels

**Phase-1's "reserve datum-safe vertical semantics now, defer Levels" is RATIFIED — now doubly evidenced, upgrade to invariant.**

- FreeCAD sections operate on raw boxes; placements and one scalar height suffice. No storey concept participates.
- Bonsai sections build cursor-direct with `svg-without-storeys=True`; placement resolves via `PlacementRelTo` chains with zero Storey involvement; containment is scheduling/FM metadata; plan/RCP use Storey purely as datum-with-fallback.
- Shared walls stay single entities with per-side overhead conditions (`Wall physical top + Ceiling A + Ceiling B`, never `roomA.wallHeight`) — Phase-1 §8.4 stands; multi-room Sections are controlled by finite span + finite depth + optional crop, with `CUT strongest / NEAR / FAR / OUTSIDE hidden` hierarchy as visual principle (fading specifics: designer territory, no implementation precedent).
- CeilingRegions spanning rooms need no topology beyond footprint overlap (see §8).

What "reserved" means conceptually (not schema): every architectural entity carries absolute vertical numerics (base elevation / sill-relative-to-host-base / profile elevations) whose meaning never depends on an implicit `y0 = 0` or on a Level container existing; a future Level is a named datum (id + elevation) plus an optional containment link that references — never restructures — those numerics. No `verticalReference` final shape is adopted here.

---

## 11. Architecture transforms / multi-select

Phase-1's recommendation stands **unchanged** (neither harvest studied transforms; commercial precedent from Phase-1 §7 is unchallenged and no new evidence cuts either way):

- **In P26 if vertical tools require it:** same-property batch edit only (multi-wall height, multi-opening head align, multi-column height, multi-ceiling props). Bounded, no topology seam.
- **Safe later wholes (no seam):** translate/rotate/mirror of the entire Layout.
- **Later dedicated capability, not P26:** proportional Room resize, partial rotate/mirror, topology-creating transforms, auto-split at boundaries, `Disjoin`-style identity-breaking moves. The Room-stretch policy question (shared wall moves? neighbor shrinks? connectors? refuse?) is policy design with deterministic-transaction semantics — its own track.
- Rationale preserved: Room-region transform entangles shared-Wall ownership, Junction creation, host preservation, lineage, Undo determinism, and curves — a solver disguised as a feature. P26 must not smuggle it inside "spatial depth."

---

## 12. Visual and interaction language

Evidence-backed principles (precedent in hand) vs designer territory (no implementation precedent anywhere harvested):

**Principles (adopt):**

- Cut hierarchy `CUT > NEAR > FAR > passive > hidden-absent`; cut strongest with light neutral poche; projected thinner; selected = P23 blue, hover softer, no section-red (Phase-1 §9 + FreeCAD stream separation giving it a data basis).
- Poche = flat fills per source; no hatch engine (FreeCAD: commented-out pattern stub, bool-only `ShowFill`; Bonsai: fills as derived surfaces). Legibility does not need patterns at P26 scale.
- Active precision only around the target: handles + temp dims + one accepted snap + guide + proposal; scaffolding hides on commit (BricsCAD selection-dims precedent via Phase-1; Bonsai overlay/gizmo split gives it an architecture: ephemeral layers, explicit invalidation on camera/selection/edit/undo).
- Snap reuses P23's engine and winner-takes-all grammar; vertical candidates (datum, tops, heads/sills, ceiling surface, intersections, increment) join the existing candidate set — no second engine (Bonsai's single snap module strengthens this from precedent to near-invariant).
- Invalid = proposal → validate → refuse-with-reason, no auto-repair (P23 rule; Phase-1's topology-repair rejection stands).
- Plan shows quiet cut line + arrow at rest, span/depth chrome only when selected (Archicad screen-only-range precedent); semantic zoom sheds dims → secondary edges → labels → handles, cut silhouette last.
- Scene content in ortho views is passive context, never hit-authoritative (Phase-1 rule; neither harvest contradicts).

**Designer territory (no implementation precedent — say so in briefs):** far-field fading/gradation (both codebases do exclusion-only; commercial tools do it, neither harvest shows how); gable/shed ridge-eave handle grammar; cut-only interaction; Reveal affordance design; temp-dim placement/collision/typing rules; ceiling line language; Room fill/label treatment in Section; 3D handle subset boundaries (gizmo-forest avoidance).

---

## 13. What the harvests changed

### Strengthened

- Contextual-instrument model (Model B) over peer workspaces and saved-views-day-one.
- One shared Section/Elevation derivation core; Wall Elevation as constrained section.
- Non-authoritative derivation (Bonsai makes it structural: baked output outside the document).
- No-Levels direction (both codebases section without storeys).
- Single intent pipeline (Bonsai's gizmo→op→IFC supplies the missing mechanism).
- Snap-engine reuse (Bonsai's centralized snap module).
- Rejections: separate section geometry/elevation docs, Scene-owned architecture, room-owned ceilings, auto-repair, full BIM/roof/families/sheets.

### Refined

- Orientation-only unification → **explicit kind + per-kind policy** (mirror bit, epsilon offset, context set, hint domain). Bonsai's mirror flag is the precise correction. Kind is explicit instrument state (transient-first, pinnable later) — never `LayoutDocument` truth.
- Ceiling ownership → **independent Layout-owned `CeilingRegion` as the selected model (RATIFIED WITH REFINEMENT).** Harvests found no Room-ownership requirement and no Level/CellComplex dependency (containment evidence + zero view-side ceiling logic) — compatibility-grade evidence, not direct demonstration; exact topology and spanning behavior stays reconciliation territory (§8).
- Depth as instrument state → **depth as required derivation parameter** with finite default (FreeCAD's silent drop is the negative proof).
- View-independent selection → **per-primitive identity through projection + reason-coded exclusion + Reveal** (both harvests' loss maps).
- Wall Elevation definition → **wall-derived, auto-following plane** (architecture precedented; follow-UX new).
- Intent pipeline → **hit/resolve/intent separation** with model-ignorant hit stage.
- RCP overlay → **exact delta list** (negation + mirror + offset + shared contexts + explicit height).
- Fit/recenter → adopt minus the X-only margin bug.
- `OrthographicRenderModel` pivot reworded: **per-source derivation is cheap; cache at source granularity** (FreeCAD caches per-face OCC cost; Museum's unit is the source).

### Weakened (still standing, lower confidence or narrower scope)

- `CutMargin`-style epsilons as visible state (renderer tolerance, keep hidden).
- Poche richness assumption (flat fills suffice; patterns deferred indefinitely).
- Immediate need for any merging/simplification in the instrument (both merges destroy identity; default to none).

### Rejected (by harvest evidence)

- **Orientation alone suffices for RCP** — contradicted in one bit (serialization mirror).
- **Openings recoverable from faces** — contradicted as geometry hope (both codebases); supported as relation-graph walk. Design must not include face-classification fallback.
- **Authored per-view geometry buckets** (new rejection from Bonsai §9): priority-resolved multi-rep elements with no consistency validation are a second-truth machine. P26 keeps one canonical geometry; symbols/overlays derive.

### New constraints discovered

Explicit kind+policy record; depth-as-parameter; single membership stage with reason codes; merge prohibition/membership records; per-primitive identity incl. outlines; relation-based opening emission; baked-output-outside-document; hit/resolve/intend boundaries; three-layer annotation/instrumentation split with invalidation points; explicit cut heights with datum fallback; epsilon confinement.

---

## 14. Evidence-backed P26 invariants

Hard constraints for designers. Each is supported by Museum architecture plus at least one harvest or unchallenged Phase-1 precedent. Provisional product choices are excluded.

```text
P26-I1  One canonical Layout truth. LayoutDocument owns all architecture;
        Scene owns staging; one compiler feeds Plan/Ortho/3D/visitor.
        (P23 architecture; both harvests' one-model derivations.)

P26-I2  Orthographic outputs are derived and non-authoritative, persisted
        at most as editor/view state outside the canonical document.
        No surface writes architecture except through canonical intents.
        (FreeCAD one-way links; Bonsai file-outside-model + write-back allowlist.)

P26-I3  One shared orthographic core parameterized by explicit view
        kind (instrument state, not document truth) + per-kind policy
        (camera derivation, scope rule, mirror, offset, hint domain).
        No per-form geometry pipeline; no orientation-only
        inference where policy bits (mirror) are not matrix-derivable.
        (FreeCAD kind-agnostic core + Bonsai kind-policy fan-out, synthesized.)

P26-I4  Every selectable derived primitive carries canonical source identity;
        no section-local entity ids. Identity is threaded through projection,
        not merely preserved at derivation. (Both harvests' loss maps.)

P26-I5  No destructive merge/simplification on selectable streams without
        membership records. Default v1: no merging in the editing instrument.
        (No safe-merge precedent exists in either codebase.)

P26-I6  One shared hit → resolve → intent path for all surfaces. Hit is
        model-ignorant; resolve owns semantic relations; intents validate
        into exactly one Layout transaction or nothing. (Bonsai raycast split;
        P23 transaction rule.)

P26-I7  Openings keep semantic identity outside the wall mesh. Opening
        interaction resolves via host→opening relations; derivation emits
        opening primitives from those relations. Faces are never classified.
        (Unanimous cross-harvest agreement.)

P26-I8  Levels are not a prerequisite for any P26 view or edit. Entities
        carry datum-capable absolute vertical numerics; a future Level is a
        named datum + optional link, never a geometric precondition.
        (Storey-free sections in both codebases; placement/containment split.)

P26-I9  Ceilings are Layout architecture beside Rooms, never Room metadata,
        never Scene geometry. Rooms seed/overlap ceilings; ownership never
        flows through Rooms. Independent CeilingRegion is the selected model;
        exact spanning topology stays reconciliation territory.
        (Phase-1 ownership analysis; harvests support compatibility — no
        Room/Level dependency found.)

P26-I10 Plan remains the primary horizontal authoring surface for
        footprint/topology operations and Section placement. Orthographic
        surfaces expose vertical precision; 3D exposes bounded spatial
        manipulation. Surfaces own nothing — all mutations still target
        LayoutDocument ownership.
        (Cross-tool conclusion, Phase-1 §3; both harvests' view-as-state models.)

P26-I11 Orthographic membership is evaluated exactly once from instrument
        scope + span + depth + crop. Every downstream consumer receives
        the same included set and reason-coded exclusions. Renderers, hit
        testing, snapping, and overlays may not independently reinterpret
        view membership. (Strongest negative precedent of Phase 2:
        FreeCAD's depth dropped by one consumer; Bonsai's four overlapping
        inclusion mechanisms.)
```

---

## 15. Design decisions now ready for external proposal

Open territory inside the invariants above. Research cannot and should not settle these — brief them as design problems with fixed boundaries:

1. Workspace/navigation presentation (`Plan|3D + Open Section` vs `Plan|Ortho|3D` vs breadcrumb takeover) and entering/exiting Wall Elevation without expert-only hiding.
2. Section creation gesture (line-first vs drag-volume), default finite depth value, direction affordance, crop presentation, cut-only toggle, post-exit Plan residue, transient-vs-recent-list.
3. Depth/crop handles and the Reveal interaction for reason-coded exclusions.
4. Cut-only mode semantics + interaction (no precedent; prototype).
5. Ceiling Focus presentation (overlay vs mode styling; no RCP nomenclature needed) and whether it ships in P26 or follows.
6. Wall top-profile handle grammar (incl. profile-point editing, distinct from generic TransformControls).
7. Opening sill/head/width/arch-rise handle grammar + temp-dim placement, typing, collision, keyboard traversal.
8. Shed/gable ridge/eave/slope interaction in Section and Plan (ridge line drawing, direction display, endpoint handles).
9. `Fit Wall to Ceiling` inclusion, attached-state display, and cycle-avoidance UX (provisional feature; needs layout-core reconciliation first).
10. Far-field fading design (no implementation precedent; commercial-reference only).
11. Temp dimension system rules across ortho views (which appear, typed input, selected-vs-hover).
12. 3D direct-edit subset boundaries (likely Wall/Column/Platform/Ceiling coarse handles; Opening detail to Elevation) avoiding gizmo forest.
13. Ceiling authoring entries (from-Room / multi-room / sketched — subset for v1?), defaults, overlap behavior.
14. Same-property batch-edit scope (if any) with explicit non-creep into Room transforms.

---

## 16. What not to research further right now

- **Homemaker full harvest: stood down.** Would test whether multi-room ceilings need CellComplex topology. Bonsai containment + FreeCAD baked-solid evidence already supports the lightweight region; a full harvest risks re-opening a decided model direction. *Trigger for a targeted 1–2h read only:* design-phase work specifically doubts room-free spanning — then read `GetTraces()/GetHulls()` room-free composition, nothing else.
- **Sweet Home 3D harvest: stood down.** Endpoint-height interpolation is subsumed by piecewise-linear profiles (two elevations = degenerate profile). *Trigger:* none foreseen; Plan-first height UX is designer territory, not precedent territory.
- **Blueprint3D harvest: stood down** (Phase-1 already rated it study-only; nothing in either harvest creates a browser-stack question it could answer). *Trigger:* implementation-phase Three.js feed questions, post-architecture.
- **Additional section-engine research: stood down.** Cut/project/derive is precedented twice over with failure maps; remaining unknowns (cut-only, cueing, safe merge) are decisions and prototypes, not findings.
- **Additional RCP research: stood down.** Bonsai answered it completely (delta list + zero ceiling-typed logic + explicit heights).

General rule: the evidence phase is closed. Every §15 item is a prototype-and-judge question; further precedent-hunting has negative expected value against design time.

---

## 17. Updated candidate product model

Model B, confirmed with Ceiling Focus promoted to a named third ortho context (cheap per §8 — same core, reflected policy):

```text
Layout
├─ Plan
│    job: footprint/topology authority; section placement; region footprints.
│    edits: Walls/Junctions/Rooms/Openings-horizontal/Column-footprints/
│           Platform+Ceiling footprints.
│    passive: selected-target vertical indicators only (2.8 m ↕ style).
│    must not own: vertical dimensions, ceilings, section internals.
│
├─ Orthographic (contextual instrument family; transient-first, pinnable later)
│   ├─ Section
│   │    job: cross-space vertical precision — heights, sills/heads, platforms,
│   │         columns, ceilings, overhead profiles, adjacent rooms in one surface.
│   │    edits: wall-top profiles, opening vertical geometry, extents, ceiling
│   │           elevation/slope/ridge, platform/column verticals.
│   │    passive: beyond-depth context (faded or hidden by policy), Scene ghosts.
│   │    must not own: any architecture; output persists at most as view record.
│   ├─ Wall Elevation
│   │    job: wall-local precision for one wall face + its openings.
│   │    edits: opening width/sill/head/arch, wall-top profile along the wall.
│   │    passive: shallow background depth; Room chooser as entry only.
│   │    must not own: the wall (references it; follows it), Room geometry.
│   └─ Ceiling Focus
│        job: reflected horizontal view for ceiling authoring/verification.
│        edits (designer-scoped): ceiling elevation/slope/ridge; Wall-fit attach.
│        passive: floor architecture faded beneath.
│        must not own: RCP bureaucracy — no sheets, no callouts, no peer status.
│
└─ 3D
     job: spatial proof + bounded coarse manipulation.
     edits (bounded): wall/column/platform/ceiling coarse handles; no opening detail.
     passive: full compiled scene as verification.
     must not own: precision (redirects to Orthographic), Scene staging semantics.
```

All surfaces emit the same intent types into one pipeline (§5); selection identity is view-independent (§4); all geometry derives from one Layout truth (§3).

---

## 18. Updated research-level conceptual types

Minimal contract sketches for designer–architect communication. Not implementation schema; field details (units, ids, defaults) are design-phase work.

```ts
// ── View kind is explicit instrument state, transient-first (Bonsai correction to orientation-only). Pinned-view records may persist it later; it never enters LayoutDocument truth. ──
type OrthographicViewKind = 'section' | 'wall-elevation' | 'reflected';

// ── Per-kind policy: the bits a matrix cannot carry. ──
type OrthographicKindPolicy = {
  mirrorY: boolean;            // RCP serialization mirror (Bonsai svg-mirror-y)
  epsilonOffsetMm: number;     // plan-family Z-fighting guard (±2 mm precedent)
  scopeRule: 'layout-wide' | 'wall-face' | 'plan-same-as-plan';
  hintDomain: 'arbitrary-line' | 'wall-ref' | 'storey-or-origin';
  referencePolicy: 'none' | 'adjacent-rooms' | 'cross-sections';
};

// ── Instrument: transient editor state (pinnable later as a record). ──
type OrthographicInstrument = {
  kind: OrthographicViewKind;
  origin: Vec2; tangent: Vec2; lookSide: 'left' | 'right';
  span: { start: number; end: number };
  depth: { kind: 'cut-only' } | { kind: 'finite'; meters: number };
  // ^ required derivation parameter, finite default (FreeCAD lesson).
  verticalCrop?: { minY: number; maxY: number };
  wallRef?: { wallId: LayoutWallId; side: WallSide };  // elevation only; derived plane
  ceilingFocusHeight?: number;                         // reflected only; explicit
};

// ── Single membership stage output: reasoned, never silent. ──
type ExclusionReason =
  | 'outside-depth' | 'outside-span' | 'outside-crop'
  | 'filtered-type' | 'no-meaningful-projection' | 'out-of-scope';

type OrthographicMembership = {
  included: LayoutEntityId[];
  excluded: Array<{ id: LayoutEntityId; reason: ExclusionReason }>;
};

// ── Typed primitive: identity threaded through projection (both loss maps). ──
type OrthographicStream = 'cut' | 'projected' | 'hidden' | 'symbol';

type OrthographicPrimitive = {
  sourceId: LayoutEntityId;   // canonical; never a view-local proxy (P26-I4)
  stream: OrthographicStream;
  subRef?: string;            // face/edge/opening-role qualifier
  depthMeters?: number;       // preserved per-primitive iff fading is ever wanted
};

// ── Mutation path: hit is ignorant, resolve owns relations, intent is canonical. ──
type OrthographicHit = { primitive: OrthographicPrimitive; point: Vec3 };
type LayoutIntent =
  | SetWallTopProfile | SetOpeningVerticalGeometry | SetColumnVerticalExtent
  | SetPlatformElevation | SetCeilingProfile;   // same constructors all surfaces emit
```

---

## 19. Final recommendation

**1. What P26 should become.** The spatial-depth slice of Layout: five bounded vocabularies (wall-top profiles, opening vertical authoring, independent flat/shed/gable `CeilingRegion`s, column extents, platform extents) plus one shared contextual orthographic instrument family (Section, Wall Elevation, Ceiling Focus) over a single membership→derivation→typed-primitive pipeline with per-primitive canonical identity, reasoned exclusion with Reveal, and a hit→resolve→intent path feeding one Layout transaction pipeline. Transient-first, pinnable later, datum-safe throughout.

**2. What P26 should explicitly not become.** Peer CAD workspaces; a documentation/sheet system; full Levels; roof systems; family editors; freeform solid modeling; authored per-view geometry; Room transforms smuggled in as selection features; Scene-owned architecture; a second snap/selection/identity regime per view; silent culling anywhere.

**3. What research considers settled.** Model B product shape; shared kind-agnostic core with explicit kind+policy (kind = instrument state, not document truth); derived-non-authoritative outputs kept outside the canonical document; per-primitive identity without proxy ids; relation-based opening identity; no-merge-without-records; single membership evaluation (P26-I11); datum reservation with deferred Levels; independent CeilingRegion as the selected model (compatibility-grade evidence — §8, §13); RCP-as-reflected-policy with exact deltas; three-layer annotation/instrumentation split. (§14 invariants.)

**4. What remains designer territory.** Everything in §15 — navigation/return design, creation gestures, handle grammars, temp dims, cut-only and Reveal interactions, Ceiling Focus scoping/presentation, fading aesthetics, batch-edit scope, `Fit-to-Ceiling` inclusion, 3D handle subset. The architecture bounds these; it does not answer them.

**5. Is another external/code research phase needed before design? No.** Two independent mature implementations converged on the architecture and mapped each other's failure modes; the residual gaps are interaction designs to prototype, guarded by the invariants above. Stand down H3–H5 except for the single triggered Homemaker read named in §16. A designer can proceed from this synthesis plus the three evidence records without re-litigating precedent.

---

## Appendix — artifact map

| Artifact | Role | Key evidentiary contribution |
|---|---|---|
| Phase-1 `deep-research-P26-phase-1.md` | Product precedent + direction | Model B, vocabularies, ownership rules, transform deferral, datum reservation, candidate harvests H1–H5 |
| FreeCAD `P26-phase2-freecad-section-orthographic-harvest.md` (FreeCAD `main @ 3f5a2ae6b`, LGPL-2.1) | Derivation architecture | Instrument-over-model split; typed streams; depth-as-parameter lesson; per-source projection; generic solid consumption; flatten-loss map; fit/recenter pattern |
| Bonsai `P26-phase2-bonsai-view-identity-rcp-harvest.md` (IfcOpenShell `v0.9.0 @ 998060b6`; Bonsai GPL-3.0 / lib LGPL-3.0) | View policy + identity + RCP | Explicit kind+policy (+mirror bit); RCP delta list; int-key/guid threading; hit/resolve split; 3-layer annotation split; relation-graph openings; storey-free sections; multi-rep hazard |
| This synthesis | Design-research contract | Ratify/refine/reject verdicts (§13); invariants P26-I1–I11 (§14); designer brief list (§15); research stand-down (§16) |
