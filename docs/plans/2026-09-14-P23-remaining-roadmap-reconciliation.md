# P23 remaining roadmap — credible wall-first architectural Plan editor

**Status:** proposed umbrella reconciliation for owner review; no remaining child
slice is implementation-ready.

**Parent:** [P23 — Layout Depth umbrella](2026-09-07-P23-layout-depth-minimum-build.md)

**Baseline:** reconciliation landed on `main` at `c401e2f` (P23.6e merged
through PR #47; independent wall-engine fixes merged through PR #48).

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
- **Major dependencies:** P23.10 gesture lifecycle and canonical direct selection;
  landed curve evaluation/sampling evidence; P23.2 snap
  queries, P23.3 Openings, P23.8 Room identity/reconciliation, canonical compiler
  and mesh adapters.
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
- **Scope:** A single display-identity contract across Plan, Navigator, search and
  Inspector: authored names where product-useful (Rooms already; Walls and
  Openings gain bounded optional naming), stable compact references for unnamed
  Walls/Openings/Junctions, raw canonical IDs available as secondary/debug detail,
  and deterministic rename/split/Undo/Redo behavior. Compact references are never
  document-order ordinals. The future child plan must choose either persisted
  presentation metadata or a deterministic derivative of canonical IDs.
  Junctions receive references, not mandatory authored names.
- **Major dependencies:** P23.6d Room metadata; merged P23.6e relationship-aware
  Navigator/search; P23.10 subdivision semantics; P23.11 final Wall vocabulary.
- **GitHub issues absorbed or explicitly deferred:** No current issue fully owns
  this gap. Resolves P23.6e's documented unavailable short-reference gate.
  Explicitly defers a general tagging/taxonomy system and building/storey/zone IA.
- **Key architecture invariants:** Display name/reference is never canonical
  identity or connectivity; canonical IDs remain the only identity/connectivity
  authority. Compact references never depend on document order. Whether persisted
  presentation metadata or ID-derived, they remain stable and collision-safe;
  naming is Layout metadata only; rename is one deterministic Layout transaction;
  Room identity remains reconciliation-owned.
- **Clear non-goals:** Renumbering canonical IDs, document-order display ordinals,
  order-derived identity, naming every Junction, aliases across documents, BIM
  classification, tags, localization infrastructure, hierarchy ownership changes.
- **Exit criteria:** Every Wall, Opening, Junction and Room has a concise,
  accessible, unambiguous label everywhere it appears; names and references are
  searchable and stable across reorder, deletion, insertion, split, Save/Load and
  Undo/Redo; renaming never changes topology, selection identity or Scene/Camera;
  the child plan explicitly ratifies persisted-metadata or canonical-ID-derived
  reference semantics before implementation.
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
  or other absent architectural meaning.
- **Major dependencies:** P23.10 direct manipulation, P23.11 curves, P23.12 final
  labels, landed P23.6 drafting primitives, P23.2 snaps and P23.3 Openings.
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

### P23.14 — Build shell, Navigator and Inspector finish

- **Purpose / product outcome:** Make the complete Layout workflow coherent and
  keyboard-usable across toolbar, Hierarchy/Navigator, Inspector, context menus,
  status and Document controls.
- **Scope:** Bounded polish of the Scene Plan Build journey: consistent selected
  headers/names/references and property grouping, clear enabled/disabled reasons,
  action and destructive-action placement, focus continuity between Plan,
  Navigator and Inspector, accessible tablists/context menus/Document and Project
  Row popovers, semantic color-token cleanup, and status-hint contrast. Preserve
  P23.6e page/history/reveal state and canonical selection routing.
- **Major dependencies:** Merged P23.6e Navigator; P23.12 naming; P23.13 final
  Plan affordances; existing shell and Inspector contracts.
- **GitHub issues absorbed or explicitly deferred:** Absorbs #34, #35, #38, #39,
  #40 and #41. Defers #32 and #36 (3D utility popovers), #37 (Material Choice,
  aligned with later material work), and #28 (multi-select). #31, #33 and #44
  remain unrelated to this slice.
- **Key architecture invariants:** One canonical Layout selection and shared
  history; Navigator state remains UI-only and never mutates documents; shell
  domains/views do not leak; accessibility work changes semantics/focus, not
  Camera graph/motion, persistence or authored ownership; visitor bundles import
  no editor shell code.
- **Clear non-goals:** Wholesale shell redesign, asset-library redesign, Camera
  sidebar redesign, 3D control-popover remediation, material authoring, auth or
  persistence changes, multi-selection, new editor-local entity truth.
- **Exit criteria:** The core Build loop is usable by pointer and keyboard;
  relevant popovers/menus/tabs enter, navigate, dismiss and restore focus
  correctly; P23.6e page/search/filter/reveal state survives shell changes;
  Inspector fields/actions are comprehensible and use canonical tokens; a focused
  Scene Plan accessibility pass has no known blocking violations in the included
  surfaces.
- **Ordering rationale:** It follows final Plan and naming decisions so shell
  polish can integrate the real end-state controls once; it remains separate from
  Plan rendering and domain semantics to keep the change bounded.

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
- **Major dependencies:** Every landed P23 slice plus P23.10–P23.15. P23.16 is
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
P23.6e merged baseline
  → P23.10 Direct Wall and Junction editing
  → P23.11 Canonical curved Walls and render-safe validation
  → P23.12 Architectural names and stable display identity
  → P23.13 Architectural Plan drafting finish
  → P23.14 Build shell, Navigator and Inspector finish
  → P23.15 Junction-correct wall-first 3D
  → P23.16 Final whole-product integration and P23 closeout gate
```

P23.12 may be researched while P23.10/P23.11 proceed, and issue-only shell work
inside P23.14 may be prepared in parallel, but acceptance follows the order above.
P23.16 is both numerically and dependency-last, eliminating the former backward
jump from P23.15 to P23.7.

## Issue disposition

| Issue | Disposition | P23 owner / rationale |
|---|---|---|
| #6 — Bézier commit/render validation gap | include in P23 | P23.11 adopts the validation failure class for canonical curved Walls only; legacy Room-owned curves remain internal-dependency smoke, not a product editing contract. |
| #26 — retire legacy Room-owned Layout stack | defer post-P23 | Explicit architecture-debt cleanup after P23; closeout performs smoke only and adds no compatibility behavior. |
| #28 — Layout Room multi-select | defer post-P23 | A credible minimum needs reliable single-target editing, not selection sets; connected-group Room move already covers the contiguous-unit case. |
| #29 — direct Wall/Junction manipulation + vertex insertion | include in P23 | P23.10; this is now required for the revised good-enough editor outcome. |
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
   fixes that had been split from P23.6e.
3. The former P23.7, now P23.16, is not implementation-ready and is not the next
   implementation slice. It is blocked by P23.10–P23.15 and must own integration/
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
   fell back to formatted raw IDs. P23.12 now closes that product-facing identity
   gap without changing canonical IDs. Its future child plan must choose persisted
   presentation metadata or a deterministic canonical-ID derivative; document-
   order ordinals are prohibited.
10. `Shell-scene-workspaces.md` still says Room drag makes Room-local Scene
    content follow. That is compatibility-path prose; canonical wall-first Scene
    and Camera placement is world-local and must not move implicitly.
11. Canonical wall-first 3D Wall/Opening picking/highlighting remains a real
    deferral. Junction-correct rendering in P23.15 must not be misreported as
    completion of 3D picking.

## Recommended names and numbers

Use P23.10–P23.15 for the new prerequisite slices and renumber the former P23.7
as P23.16, the final gate:

| Number | Recommended name |
|---|---|
| P23.10 | Direct Wall and Junction editing |
| P23.11 | Canonical curved Walls and render-safe validation |
| P23.12 | Architectural names and stable display identity |
| P23.13 | Architectural Plan drafting finish |
| P23.14 | Build shell, Navigator and Inspector finish |
| P23.15 | Junction-correct wall-first 3D |
| P23.16 | Final whole-product integration and P23 closeout gate |

The numbers preserve every landed child ID, avoid reusing the already-shipped
P23.6 family, and make numeric order match dependency order. P23.7 remains only
the historical identity of the superseded closeout draft.
