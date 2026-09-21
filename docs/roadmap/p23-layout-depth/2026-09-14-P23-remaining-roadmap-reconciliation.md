# P23 remaining roadmap — credible wall-first architectural Plan editor

**Status:** active umbrella reconciliation. P23.10 delivered through PR #49,
P23.11 through PR #51 and P23.12 through PR #55 (plus PR #56 anchor-release
fix); P23.13–P23.16 remain prerequisite/final-gate work and are not implementation-ready
until their child plans are reconciled against the landed baseline.

**Parent:** [P23 — Layout Depth umbrella](2026-09-07-P23-layout-depth-minimum-build.md)

**Baseline:** `main` at `c2a2404` after PR #55 (P23.12), PR #56
(anchor-release fix), PR #54 (text-selection/fast-drag fix) and PR #51 (P23.11).

**Authority:** this document supersedes the previous remaining-scope, ordering,
deferral and closeout-readiness statements in the P23 umbrella and the former
P23.7 plan, now renumbered P23.16. Landed P23 plans remain the record of
delivered behavior.

## Product boundary

P23 now closes on a **credible good-enough 2D architectural Layout editor**,
not only a wall-first foundation. A creator must be able to sketch, select,
identify, directly reshape, curve, open, inspect and understand a small plan in
one coherent workflow, then trust the same result in 3D, Save/Load, Preview and
Publish.

The boundary is deliberately below full CAD/BIM. P23 does not add multi-select,
constraint solving, construction documents, arbitrary curve intersections,
general solid modeling, assemblies, storey/building/site semantics, or a second
geometry/selection/history system.

## Proposed remaining slices

### P23.10 — Direct Wall and Junction editing

**Status:** delivered through PR #49 on 2026-09-14. Retained here as the landed
prerequisite contract for P23.11–P23.16.

- **Purpose / product outcome:** Make the canonical architecture feel directly
  editable: a creator can manipulate the Wall or Junction they selected instead
  of relying on Inspector-only numeric commands.
- **Scope:** Single-target Plan manipulation of canonical Junctions and straight
  Walls: Junction move, rigid Wall move, unambiguous endpoint/length reshape, and
  Add Junction/Add Vertex subdivision. Direct and numeric paths must converge on
  the same candidate, topology, Room reconciliation, Opening/portal validation,
  selection and history semantics.
- **Major dependencies:** Landed P23.1 precision operations, P23.2 snapping,
  P23.3 Opening fit, P23.6 canonical selection/presentation, P23.8 topology and
  Room reconciliation, P23.6c deletion, P23.6e Navigator projection.
- **GitHub issues absorbed or explicitly deferred:** Absorbs #29 in full for the
  straight-Wall minimum. Explicitly defers #28 (Room/mixed multi-select) and all
  curve-handle behavior to P23.11.
- **Key architecture invariants:** Junction IDs remain the only connectivity
  truth; Walls/Rooms/Openings retain canonical ownership; every gesture derives
  from an immutable baseline and produces one Layout history result or none;
  SceneDocument and Camera data never move implicitly; one topology/compiler/
  reconciliation/selection path.
- **Clear non-goals:** Multi-selection, marquee selection, general constraints,
  automatic detachment, Room-owned vertices, curve editing, automatic repair,
  new Scene/Camera manipulation.
- **Exit criteria:** A selected Junction and straight Wall can be moved and
  reshaped predictably; a selected Wall can be subdivided into one new Junction
  and deterministic fragments; shared Rooms and hosted Openings remain coherent
  or the entire operation rejects; Undo/Redo restores exact identities and
  coordinates; keyboard/numeric and pointer results agree.
- **Ordering rationale:** This closes the largest interaction gap first and
  establishes the reusable direct-manipulation lifecycle before curve handles
  and final drafting polish depend on it.

### P23.11 — Canonical curved Walls and render-safe validation

- **Purpose / product outcome:** Deliver a bounded, trustworthy Bézier/curved
  Wall workflow on canonical Walls, with validation that prevents accepted edits
  from becoming unrenderable.
- **Scope:** One canonical curve representation on a Wall with explicit endpoint
  Junctions; bounded create/convert, select, add/move/delete curve-control UX;
  curved boundary participation for supported closed loops; arc-length-aware
  Opening placement/editing; shared Plan/3D/visitor sampling; commit-time
  centerline, offset-clearance, Opening-fit and mesh-preflight validation.
  Straight/curve and curve/curve crossings that require unsupported noding must
  reject clearly rather than flatten or silently miscompile. Legacy Room-owned
  curve editing is not in scope; retained legacy data receives only the existing
  internal-dependency load/render smoke at P23.16.
- **Major dependencies:** Landed P23.10 gesture lifecycle and canonical direct
  selection; landed curve evaluation/sampling evidence; P23.2 snap queries,
  P23.3 Openings, P23.8 Room identity/reconciliation, canonical compiler and mesh
  adapters.
- **GitHub issues absorbed or explicitly deferred:** Uses #6's commit-versus-render
  failure class to define canonical curved-Wall validation. It does not absorb or
  expand the issue's legacy Room-owned editing surface into a P23 product
  contract. Explicitly defers general curve intersection/noding, tangent
  constraint networks, NURBS, offset/trim/fillet operations and unrestricted
  curved topology.
- **Key architecture invariants:** Curve data is authored on canonical Walls;
  endpoint connectivity is still Junction-ID equality; consumers use one curve
  evaluator/compiler output; Rooms stay persistent semantic faces; invalid
  candidates never enter history; no flatten-on-save or consumer-local resampling;
  the legacy adapter never becomes a curve-authoring authority.
- **Clear non-goals:** Full spline/CAD tooling, arbitrary self-intersecting curves,
  curve Boolean repair, general curved-wall joins at crossings, construction-line
  networks, legacy Room-owned curve authoring/editing, or compatibility expansion
  beyond named internal-dependency smoke.
- **Exit criteria:** A creator can author and refine a supported curved Wall in
  Plan; supported curved enclosures preserve Room identity; hosted Openings track
  the curved host; accepted edits render coherently in Plan and 3D while the #6
  failure class rejects before commit with a useful diagnostic; Save/Load and
  Undo/Redo preserve exact canonical data.
- **Ordering rationale:** It builds on the straight direct-manipulation contract
  and must precede naming, final Plan polish and 3D junction work so those slices
  handle the final Wall vocabulary once.

### P23.12 — Architectural names and stable display identity

- **Purpose / product outcome:** Let creators recognize and retrieve architecture
  without reading raw internal IDs, while preserving exact canonical identity.
- **Current repository fact / starting point:** canonical Room naming is already
  complete enough to reuse, not redesign. `LayoutWallFirstRoom.name` is persisted,
  P23.6d `planRoomMetadataUpdate` owns the mutation, and the selected canonical
  Room Inspector already exposes an editable **Name** field through the guarded
  Layout transaction path. Canonical `LayoutWall`, `LayoutWallOpening` and
  `LayoutJunction` currently have no `name` field. P23.12 must therefore preserve
  the existing Room rename path rather than create a second one, while adding only
  the missing Wall/Opening naming capability and reference presentation.
- **Scope:** Define one display-identity contract consumed by Plan, Navigator,
  search and Inspector. Rooms keep their existing authored `name`. Walls and
  Openings gain bounded optional authored naming as Layout metadata, with one
  canonical metadata planner/adapter/transaction path and editable **Name** fields
  in the selected Wall/Opening Inspector panels. Junctions do **not** gain authored
  names in the P23 minimum; they receive stable compact references only. Unnamed
  Walls/Openings/Junctions receive stable compact references, raw canonical IDs
  remain available as secondary/debug detail, and rename/split/Undo/Redo behavior
  is deterministic. The future child plan must choose the stable compact-reference
  mechanism (persisted presentation metadata or a deterministic collision-safe
  derivative of canonical IDs); references are never document-order ordinals.
- **Presentation contract:** authored name is the primary human label where one
  exists; the stable compact reference remains available as an unambiguous
  secondary identity. Unnamed architecture uses the compact reference as the
  primary label. Search indexes authored names, compact references and raw
  canonical IDs. Navigator/search/Plan are consumers of this identity contract,
  not rename authorities; the bounded P23 minimum keeps rename mutation in the
  canonical Inspector instead of adding inline Navigator editing or a second
  context-menu mutation path. P23.13 owns final Plan label placement/collision;
  P23.14 owns final shell/Navigator density and styling.
- **Major dependencies:** P23.6d Room metadata; merged P23.6e relationship-aware
  Navigator/search; landed P23.10 subdivision semantics; P23.11 final Wall
  vocabulary.
- **GitHub issues absorbed or explicitly deferred:** No current issue fully owns
  this gap. Resolves P23.6e's documented unavailable short-reference gate and the
  real-browser raw-ID legibility problem it leaves in the narrow Navigator rail
  (supported range 240–300 px).
  Explicitly defers a general tagging/taxonomy system and building/storey/zone IA.
- **Key architecture invariants:** Display name/reference is never canonical
  identity or connectivity; canonical IDs remain the only identity/connectivity
  authority. Compact references never depend on document order. Whether persisted
  presentation metadata or ID-derived, they remain stable and collision-safe;
  naming is Layout metadata only; rename is one deterministic Layout transaction;
  the existing Room rename path remains the only Room-name mutation authority;
  Room identity remains reconciliation-owned.
- **Clear non-goals:** Renumbering canonical IDs, document-order display ordinals,
  order-derived identity, mandatory or authored Junction naming, a second Room
  naming field/path, inline Navigator rename as a competing mutation authority,
  aliases across documents, BIM classification, tags, localization infrastructure,
  or hierarchy ownership changes.
- **Exit criteria:** Every Wall, Opening, Junction and Room has a concise,
  accessible, unambiguous label everywhere it appears. Room rename continues to
  work through its existing Inspector/metadata path; selected Walls and Openings
  expose bounded optional Name editing through canonical Layout transactions;
  Junctions use compact references without gaining authored-name semantics. Names
  and references are searchable and stable across reorder, deletion, insertion,
  split, Save/Load and Undo/Redo; renaming never changes topology, selection
  identity or Scene/Camera; the child plan explicitly ratifies the compact-
  reference mechanism before implementation.
- **Ordering rationale:** Identity presentation depends on final split/curve
  semantics and should land before visual and shell polish so those surfaces do
  not polish raw-ID placeholders.

### P23.13 — Architectural Plan drafting finish

- **Purpose / product outcome:** Make the 2D Layout surface read and behave like a
  credible small architectural plan rather than a debug visualization of the
  wall engine.
- **Scope:** Final visual/interaction pass over the existing SVG Plan authority:
  coherent wall thickness/joins/caps, boundary-versus-nonboundary distinction,
  legible authored Door/Window cuts with neutral technical-plan symbols, Room
  name/reference and derived area presentation, dimensions, zoom-stable line
  weights and handles, selection/
  hover precedence, direct-edit and curve affordances, snap/draft/invalid
  feedback, label collision/suppression, empty and dense-plan states, and
  representative-theme/zoom review. Opening symbols represent only authored
  semantics; they never infer swing, handing, inward/outward direction, leaf type
  or other absent architectural meaning. All architecture labels consume the
  P23.12 display-identity contract rather than formatting raw canonical IDs in the
  renderer.
- **Door swing deferral / research-ratification note (2026-09-15):** Current
  wall-first code evidence indicates that future authored Door swing semantics
  can remain deferred without prerequisite architecture work. `LayoutWallOpening`
  is hosted by stable `wallId`, its `offset` is measured from the canonical Wall
  start, and compiled Opening geometry already exposes the local tangent, normal
  and yaw needed to derive a future swing glyph. P23.13 should therefore keep Door
  treatment neutral and must not fabricate swing from Room side, traversal order
  or visual convention alone. If the P23.13 architectural precedent research
  ratifies adding swing later, the likely bounded model is optional Door-only
  metadata such as `swing: { hinge: 'start' | 'end'; side: 'left' | 'right';
  angle?: number }`, with `hinge` and `side` defined in the canonical Wall-local
  frame rather than world X/Z or Room-relative traversal. The Plan glyph remains
  derived compiler/render-model output, never SVG-owned geometry or topology.
  For curved Walls, hinge position must be evaluated at the Opening edge's
  arc-length position (`offset` or `offset + width`), not approximated as center
  `± width / 2 * tangent`; the Door leaf remains rigid/straight and its swing is
  circular about that hinge-local frame. This note records a provisional
  architecture hypothesis for research ratification, not P23.13 implementation
  scope: research may refine or reject the visual convention or data semantics.
- **Major dependencies:** Landed P23.10 direct manipulation, P23.11 curves,
  P23.12 final labels, landed P23.6 drafting primitives, P23.2 snaps and P23.3
  Openings.
- **GitHub issues absorbed or explicitly deferred:** No open issue wholly owns
  this pass. #34 is grouped with P23.14 because it is shell/status accessibility,
  not Plan geometry. Explicitly defers print sheets, scale bars, dimension chains,
  annotation authoring, DXF/PDF export and construction-document standards.
- **Key architecture invariants:** `CompiledLayoutGeometry → PlanRenderModel →`
  SVG remains the only Plan path; no SVG-owned geometry/topology/selection state;
  all labels/areas are derived or canonical metadata; Door/Window symbols derive
  only from authored Opening semantics; Scene footprints remain passive in Layout
  mode; Camera Plan reuses architectural context without gaining Layout authority.
- **Clear non-goals:** New topology algorithms, renderer replacement, Canvas/WebGL
  Plan, invented Door swing/handing/direction/leaf semantics, general annotation
  system, print layout, full accessibility remediation outside the Scene Plan
  Build journey, visual redesign of the whole application.
- **Exit criteria:** Representative small, angled, shared-wall, curved and dense
  plans are legible at supported zooms; Walls/Openings/Rooms/Junctions and active
  editing state are visually distinguishable; Door/Window treatment stays neutral
  unless authored data supplies additional semantics; labels do not obscure core
  geometry; no accepted geometry is invisible; Plan interaction remains
  deterministic.
- **Ordering rationale:** This is intentionally late: visual polish must evaluate
  the complete direct-edit, curve and identity vocabulary instead of being redone
  after each capability lands.

### P23.14 — Editor Shell & Visual System Foundation

> **Scope change (owner review, 2026-09-17).** This slice was registered on
> 2026-09-14 as *"Build shell, Navigator and Inspector finish"* with bounded polish
> scope, and **wholesale shell redesign** was listed as a non-goal. That framing is
> superseded. P23.14 is now the slice that establishes the shell's visual system and
> interaction grammar. The previously bounded work is **retained inside** the larger
> outcome (not dropped), and the old non-goal is replaced by a narrower boundary:
> product/domain architecture, document ownership, selection/history authority,
> navigation and camera systems, visitor runtime, and future P24/P26 capability
> semantics stay out of scope. Slice design context (archived; P23.14 closed
> 2026-09-21): [`shell-design-context.md`](../../archive/roadmap/p23/p23.14-shell-visual-system/context/shell-design-context.md).

- **Purpose / product outcome:** Establish one coherent, extensible editor-shell
  **visual system and interaction grammar** — across Scene/Camera, Plan/3D,
  Navigator/hierarchy, Inspector, workspace ribbon and toolbars, Timeline, status
  surfaces, menus and popovers, overlays, and focus/selection/error states — with a
  high enough ceiling that future P24, P26 and later capability can normally enter
  through the same language without a new shell redesign. The complete Layout
  workflow stays coherent and keyboard-usable across toolbar, Hierarchy/Navigator,
  Inspector, context menus, status and Document controls.
- **Scope:** The shell may substantially revise shell presentation, hierarchy, layout
  composition, control grouping, density, typography, iconography, surfaces, borders
  and elevation, visual state treatment, panel composition, timeline integration, and
  the canvas/chrome relationship — plus the reusable grammar other surfaces inherit:
  property-section and property-row grammar, toolbar groups, segmented selectors,
  mode/tool treatment, panel headers, status/warning/refusal treatments, contextual
  instrument framing, selection/focus/hover/disabled states, hierarchy rows,
  menu/popover grammar, Timeline shell grammar, and the spacing/type/icon/token
  systems. **Architecture and ownership contracts are preserved**: domain/view
  authority, one selection authority and one history stack, document ownership,
  navigation and camera systems, visitor isolation. **Retained bounded work**
  (formerly the whole slice): consistent selected headers/names/references and
  property grouping, clear enabled/disabled reasons,
  action and destructive-action placement, focus continuity between Plan,
  Navigator and Inspector, accessible tablists/context menus/Document and Project
  Row popovers, semantic color-token cleanup, and status-hint contrast. Preserve
  P23.6e page/history/reveal state and canonical selection routing. Reconcile the
  real-browser P23.6e density issue exposed by expanded Room Wall rows: today each
  Wall can render a non-selectable `Ends <junction> · <junction>` relation row.
  After P23.12 compact references land, evaluate the final rail across its
  supported **240–300 px range, including the 240 px minimum**, with the
  **preferred default of removing that `Ends` row from
  normal Room Wall disclosures**. A Wall disclosure should normally show hosted
  Openings; `Boundary Junctions (n)` remains the Room-context Junction inventory
  and the global Junctions page remains the architecture-wide index. Do not solve
  the density/affordance problem by making `Ends` another Junction-selection
  surface. If final usability review retains the relation, it must use compact
  references and unmistakable non-entity metadata styling.
- **Future-feature boundary:** P23.14 builds the visual operating system, not
  speculative future functionality. It may establish the grammar P24/P26 capabilities
  will inhabit and must leave each a clear extension path, but it does **not**
  implement P24 multi-selection capability, material/light/environment workflows or
  placement/support semantics, and does not implement P26 Section, Wall Elevation,
  Ceiling Focus or crop/depth/reveal behavior — no fake mixed-value UI, no placeholder
  Section controls, no unused Reveal affordances shipped to claim readiness. A later
  feature may introduce a genuinely new primitive, but that requires explicit
  justification rather than creating a parallel UI language by default.
- **Major dependencies:** Merged P23.6e Navigator; P23.12 naming; P23.13 final
  Plan affordances; existing shell and Inspector contracts; the P23.14 shell design
  context referenced above.
- **GitHub issues absorbed or explicitly deferred:** Absorbs #34, #35, #38, #39,
  #40 and #41. Also owns the bounded P23.6e Navigator-density follow-up above;
  this is presentation/IA polish, not a new topology or selection feature. Defers
  #32 and #36 (3D utility popovers), #37 (Material Choice, aligned with later
  material work), and #28 (multi-select). #31, #33 and #44 remain unrelated to
  this slice.
- **Key architecture invariants:** One canonical Layout selection and shared
  history; Navigator state remains UI-only and never mutates documents; shell
  domains/views do not leak; a Junction may have several factual relationship
  representations but Wall accordions do not become a second Junction-selection
  authority; accessibility work changes semantics/focus, not Camera graph/motion,
  persistence or authored ownership; visitor bundles import no editor shell code.
- **Clear non-goals:** P23.14 does not redesign product or domain architecture,
  document ownership, selection/history authority, the navigation or camera systems,
  the visitor runtime, or future P24/P26 capability semantics — those contracts are
  preserved and must be *hosted*, not re-decided. Also out of scope: asset-library
  redesign, Camera sidebar redesign, 3D control-popover remediation, material
  authoring, auth or persistence changes, multi-selection *capability*, new
  editor-local entity truth, a topology-explorer tree that explodes every
  Wall/Junction relationship, P23.15's junction geometry, and speculative future view
  controls. P23.14 must make the shell *able* to host the P26 view-taxonomy answer; it
  does not decide it.
- **Exit criteria:** The core Build loop is usable by pointer and keyboard;
  relevant popovers/menus/tabs enter, navigate, dismiss and restore focus
  correctly; P23.6e page/search/filter/reveal state survives shell changes;
  Inspector fields/actions are comprehensible and use the P23.12 identity
  contract; the Navigator remains calm across the supported **240–300 px range,
  including the 240 px minimum**, with real names/references and does
  not present inert endpoint metadata as a competing selectable entity surface;
  `Boundary Junctions` and the global Junctions page remain the Junction inventory
  surfaces; a focused Scene Plan accessibility pass has no known blocking
  violations in the included surfaces. Added by the 2026-09-17 re-scope:
  - the shell reads as **one system** across Scene/Camera and Plan/3D — same
    primitives, same state semantics, same selection identity, differentiated only
    where domain ownership genuinely differs;
  - the selected shell grammar demonstrates a **credible extension path** for the
    P24/P26-sensitive content classes named in the design context, **without
    pre-implementing them** — a new state or action enters through that grammar
    instead of creating a parallel one;
  - **one deterministic selection authority** survives the shell change (Layout stays
    single-target; an ordered selection set with one primary/active entity must be
    able to extend it without a second selection truth);
  - P23.15's derived 3D wall/junction geometry is **not** compensated for in shell
    presentation.
- **Ordering rationale:** It follows final Plan and naming decisions so shell
  polish can integrate the real end-state controls once; it remains separate from
  Plan rendering and domain semantics to keep the change bounded. It now also sits
  immediately before P23.15 and P24, which is why it owns the visual system rather
  than local polish: those slices should **extend this grammar** instead of each
  introducing their own.

### P23.15 — Junction-correct wall-first 3D

- **Purpose / product outcome:** Ensure the architectural plan a creator authored
  produces credible connected Wall geometry in 3D, Preview and visitor output.
- **Scope:** Junction-aware wall tessellation using explicit canonical Junction
  identity for all and only Junction configurations/degrees already accepted by
  canonical P23 topology. Mixed thickness/height and straight/curved tangent cases
  supported by that accepted topology and the final P23 Wall vocabulary receive a
  deterministic miter/bevel/bridge policy, editor/visitor parity and visible-gap/
  overlap/degeneracy validation. Unsupported topology remains rejected upstream;
  rendering never broadens the valid topology set.
- **Major dependencies:** P23.11 final curved-Wall compiler shape; P23.13 final
  supported Plan fixtures; landed P23.8 topology acceptance, per-Wall height and
  canonical physical-Wall compilation.
- **GitHub issues absorbed or explicitly deferred:** Moves the existing junction-
  rendering implementation scope out of the former P23.7 into its own
  prerequisite slice.
  Canonical 3D Wall/Opening picking and highlighting remain explicitly deferred
  post-P23.
- **Key architecture invariants:** Connectivity comes only from Junction IDs,
  never coordinate proximity; the renderer consumes canonical topology validity
  and never defines or expands it; one compiler output feeds all consumers; mesh
  state is derived and never persisted; editor and visitor share visitor-safe
  geometry; no second topology or geometry compiler.
- **Clear non-goals:** Expanding canonical topology validity or Junction degree
  support, CSG, fused-building manifold, general mesh editing, proximity-derived
  welding, 3D authoring/picking/highlighting, P24 materials or lighting, broad
  mesh-system rewrite.
- **Exit criteria:** Every Junction configuration accepted by canonical P23
  topology has representative fixtures with no visible gaps, invalid overlaps or
  degenerate surfaces in editor, Preview and visitor; topology rejected upstream
  remains rejected rather than gaining a render fallback; mixed Wall cases are
  deterministic; Plan and 3D identities/geometry agree; visitor/editor isolation
  and performance remain acceptable.
- **Ordering rationale:** It must see the final straight/curved Wall vocabulary,
  but it must finish before P23.16 so the closeout gate verifies architecture
  rather than implementing it.

### P23.16 — Final whole-product integration and P23 closeout gate

- **Purpose / product outcome:** Prove that P23's complete wall-first Build
  experience is coherent, durable and safe enough to hand off to P24.
- **Scope:** Acceptance and defect-only integration across the complete authoring
  fixture: create/draw, direct edit, curve edit, name/retrieve, Rooms/Openings,
  duplicate/presets, Plan/3D, deterministic selection/history/Undo/Redo,
  Save/Load/import/export, Preview, immutable Publish/cold visitor, current
  internal legacy-dependency smoke, route/bundle isolation, documentation and
  tracker closeout.
- **Major dependencies:** Every landed P23 slice plus P23.11–P23.15. P23.16 is
  dependency-last.
- **GitHub issues absorbed or explicitly deferred:** Closes only issues assigned
  to completed prerequisite slices. Restates #26 and #28 as post-P23; restates
  deferred canonical 3D Wall/Opening picking; does not absorb unrelated #31,
  #33 or #44 or the deferred 3D/material popover issues.
- **Key architecture invariants:** Canonical Junction/Wall/Opening ownership;
  persistent semantic Rooms; separate LayoutDocument/SceneDocument; no implicit
  Scene/Camera movement; one compiler/topology/reconciliation path; deterministic
  selection/history; existing Camera graph/navigation/motion authority; strict
  visitor/editor isolation.
- **Clear non-goals:** New product capability, new schema design, topology or
  renderer architecture, general legacy migration, issue #26 retirement, P24/P25
  work, full CAD/BIM, broad accessibility sweep.
- **Exit criteria:** One representative canonical project completes the entire
  Build loop and round-trips exact identities through Undo/Redo, Save/Load,
  Preview and Publish; Plan/3D/visitor agree; architecture edits do not move
  Scene/Camera; included accessibility flows pass; internal legacy fixtures only
  smoke through the retained shared adapter; full repository checks/builds and
  visitor bundle gates pass; no prerequisite P23 issue remains open; closeout docs
  accurately record explicit post-P23 debt.
- **Ordering rationale:** A closeout gate cannot own new geometry or interaction
  architecture. Renumbering the former P23.7 as P23.16 makes both numeric and
  dependency order communicate that it is the true final integration gate.

## Final dependency-ordered P23 sequence

Delivered work remains in its landed dependency order. The remaining sequence is:

```text
P23.10 merged baseline
  → P23.11 Canonical curved Walls and render-safe validation
  → P23.12 Architectural names and stable display identity
  → P23.13 Architectural Plan drafting finish
  → P23.14 Editor Shell & Visual System Foundation
  → P23.15 Junction-correct wall-first 3D
  → P23.16 Final whole-product integration and P23 closeout gate
```

P23.12 may be researched while P23.11 proceeds, and issue-only shell work inside
P23.14 may be prepared in parallel, but acceptance follows the order above.
P23.16 is both numerically and dependency-last, eliminating the former backward
jump from P23.15 to P23.7.

## Issue disposition

| Issue | Disposition | P23 owner / rationale |
|---|---|---|
| #6 — Bézier commit/render validation gap | include in P23 | P23.11 adopts the validation failure class for canonical curved Walls only; legacy Room-owned curves remain internal-dependency smoke, not a product editing contract. |
| #26 — retire legacy Room-owned Layout stack | defer post-P23 | Explicit architecture-debt cleanup after P23; closeout performs smoke only and adds no compatibility behavior. |
| #28 — Layout Room multi-select | defer post-P23 | A credible minimum needs reliable single-target editing, not selection sets; connected-group Room move already covers the contiguous-unit case. |
| #29 — direct Wall/Junction manipulation + vertex insertion | delivered | P23.10 landed through PR #49; retained here as a prerequisite contract rather than remaining implementation scope. |
| #31 — Camera Connections list semantics | unrelated | Camera-only presentation debt; no change to the P23 Layout workflow or Camera authority. |
| #32 — accessible 3D Grid popover | defer post-P23 | Valid debt, but the control is a 3D utility outside the 2D Build accessibility boundary. |
| #33 — texture-library filtered empty state | unrelated | Asset-library/P24 supply presentation, not P23 architecture. |
| #34 — status-bar hint contrast | include in P23 | P23.14; visible throughout the Plan editing workflow. |
| #35 — canonical axis tokens in number fields | include in P23 | P23.14; directly affects Inspector consistency. |
| #36 — 3D View popover ARIA/focus | defer post-P23 | Valid global 3D-shell debt; not required to claim the 2D Plan editor minimum. |
| #37 — Material Choice dialog focus lifecycle | defer post-P23 | Align with P24 material authoring rather than expanding P23. |
| #38 — shared context-menu keyboard navigation | include in P23 | P23.14; canonical Wall/Room actions use the shared menu. |
| #39 — editor tablist keyboard behavior | include in P23 | P23.14; directly includes Hierarchy navigation and preserves P23.6e state. |
| #40 — Project Row popover coordination | include in P23 | P23.14; prevents overlapping shell controls during the Save/Document workflow. |
| #41 — Document menu focus lifecycle | include in P23 | P23.14; Save/import/export/reset are part of P23 closeout. |
| #44 — repository verification command docs | unrelated | Contributor documentation debt; useful independently, but not a P23 product exit criterion. |

GitHub currently has no issue or pull request numbered #42 or #43 in this
repository; they therefore have no disposition.

## Stale assumptions to reconcile

1. The umbrella's “minimum useful Build set” boundary is too narrow. Its former
   deferral of direct Wall/Junction manipulation and canonical curve refinement
   conflicts with the revised good-enough 2D editor outcome.
2. P23.6a–P23.6e are not future branch work. They are merged on `main` through
   PRs #27, #30, #45, #46 and #47; PR #48 separately landed the wall-engine
   fixes that had been split from P23.6e. P23.10 subsequently landed through
   PR #49, with PR #50's endpoint-noding hardening already in the merged baseline.
3. The former P23.7, now P23.16, is not implementation-ready and is not the next
   implementation slice. It is blocked by P23.11–P23.15 and must own integration/
   acceptance only.
4. Wall-first 3D junction resolution is new architecture, not closeout work. It
   moves to P23.15 so P23.16 can remain a true gate.
5. The editor no longer boots new projects into the legacy Room-owned Layout.
   `EditorApp.svelte` uses `createEmptyWallFirstProject()`, and the P23.3 boot
   regressions prove the wall-first Layout/world-local Scene pair. Legacy remains
   only for current internal dependency/read paths and Issue #26 retirement.
6. Canonical Wall/Opening/Junction selection, wall-first Opening authoring and the
   P23.6e Navigator are landed; P23.16 must verify them, not describe them as a
   future cutover.
7. The former P23.7's broad legacy migration/read/publication matrix overstates
   the pre-Compatibility-Baseline promise. The remaining gate is canonical
   current-format acceptance plus smoke for named internal legacy dependencies;
   no new legacy behavior is added.
8. The former P23.7's curve section treats fidelity-preserving legacy read as
   sufficient. P23.11 owns a bounded editable canonical wall-first curve workflow
   and imports #6's validation failure class only; it does not promote legacy
   Room-owned curve editing into the P23 product contract.
9. P23.6e documented stable short architecture references as unavailable and
   fell back to formatted raw IDs. Real-browser review now confirms that fallback
   is materially noisy in the canonical rail at its supported 240–300 px range: for
   example, the intentional
   non-selectable Wall relation row renders long endpoint labels as
   `Ends Junction Chain … · Junction Chain …`. P23.12 closes the identity/reference
   gap; P23.14 owns the final density/affordance decision and must not turn that
   relation into a second Junction-selection surface.
10. Canonical Room naming is already authored **and exposed**: current
    `LayoutWallFirstRoom.name` is persisted, P23.6d owns `planRoomMetadataUpdate`,
    and `EditorInspector.svelte` renders the selected Room's editable Name field.
    By contrast, current `LayoutWall`, `LayoutWallOpening` and `LayoutJunction`
    have no `name` field. P23.12 therefore reuses Room naming, adds bounded
    optional naming only for Walls/Openings, and keeps Junctions reference-only.
11. `Shell-scene-workspaces.md` still says Room drag makes Room-local Scene
    content follow. That is compatibility-path prose; canonical wall-first Scene
    and Camera placement is world-local and must not move implicitly.
12. Canonical wall-first 3D Wall/Opening picking/highlighting remains a real
    deferral. Junction-correct rendering in P23.15 must not be misreported as
    completion of 3D picking.

## Recommended names and numbers

Use P23.10–P23.15 for the prerequisite slices and P23.16 as the final gate.
P23.10 is now landed; the remaining implementation sequence begins at P23.11:

| Number | Recommended name |
|---|---|
| P23.10 | Direct Wall and Junction editing — delivered |
| P23.11 | Canonical curved Walls and render-safe validation |
| P23.12 | Architectural names and stable display identity |
| P23.13 | Architectural Plan drafting finish |
| P23.14 | Editor Shell & Visual System Foundation (re-scoped 2026-09-17; formerly "Build shell, Navigator and Inspector finish") |
| P23.15 | Junction-correct wall-first 3D |
| P23.16 | Final whole-product integration and P23 closeout gate |

The numbers preserve every landed child ID, avoid reusing the already-shipped
P23.6 family, and make numeric order match dependency order. P23.7 remains only
the historical identity of the superseded closeout draft.
