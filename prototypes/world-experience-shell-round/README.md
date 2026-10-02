# World | Experience shell round — accepted unified shell design package

**Audience:** agents + humans.
**Hub:** [`../README.md`](../README.md) (prototype family) · [`../../docs/README.md`](../../docs/README.md) (documentation router).

**Status:** **finalized / frozen World design, promoted into durable destination
shell design alongside V2 Experience** (PR #111, 2026-10-01). The independent design
round is complete: its
[final synthesis](./design/design-synthesis.md) and canonical
[visual QA package](./QA-package/) are the durable outputs. The commissioning
briefs and the copied designer-input rasters are retired to Git history. The
direction is accepted; the editor still runs the landed PLATE chrome until an explicit production cutover. The [World Authoring Prototype](../spatial-authoring/README.md) now adopts this design in place under #112; its [executable acceptance](../spatial-authoring/qa/ACCEPTANCE.md) is separate from this design freeze.

## Canonical artifacts

- [design/design-synthesis.md](./design/design-synthesis.md) — the canonical
  accepted design artifact: shared-shell landmarks, ordinary vs invoked World,
  Look vs Details, Owner/Source/Reach, repair, lens crossing, Esc ladder, narrow
  desktop, accessibility, the accepted QA index and the final product laws.
- [QA-package/](./QA-package/) — ten semantically named boards, one per
  demonstrated contract. The synthesis links each board from its QA table;
  known image-generation drift is recorded there and is **not** normative — a
  raster never outranks the written contract.
- [QA-package/ACCEPTANCE.md](./QA-package/ACCEPTANCE.md) — acceptance/closeout
  record: outcome, verification evidence at the final head, deferred questions
  and the explicit next step.

## Authority

- Finalized **successor World shell/disclosure design**, promoted alongside V2
  Experience into **PLATE §0.8–§0.8.3**, the normative destination shell authority.
  This package retains the final design record and specimens; the World executable adopts it under #112.
- Preserves accepted **V2 Experience semantics**
  ([final V2 synthesis](../integrated-experience-authoring/design/Prototype-V2-final-synthesis.md))
  and **P26 journeys A–F, capabilities and interaction laws**
  ([World Authoring Prototype](../spatial-authoring/README.md)).
- Supersedes predecessor **P26 shell/chrome/tool exposure/disclosure** where the
  synthesis explicitly covers them. P26 remains the deep World behavioral oracle.
- Does **not** supersede product/domain ownership contracts. The ratified
  destination direction ([North Star](../../docs/reference/north-star.md),
  [architecture](../../docs/reference/architecture.md),
  [F composition/execution](../../docs/reference/composition-execution.md)) and
  the component contracts remain normative wherever they disagree.
- Does **not** establish persistence, formats or implementation mechanisms. It is
  not persisted-format authority and not production implementation authority.
- Does **not** itself authorize a production cutover. The durable shell contract
  ([PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md)
  §0.8–§0.8.3) owns shared/World laws, the Experience expression and explicit
  parked-procedure return; production implementation
  remains gated by F and the re-derived track plans.

## Provenance

- Commissioned 2026-10-01 from verified `main` at `1dfeb5d7` (**Prototype clean up
  (#110)**), after the accepted V2 Experience synthesis and the accepted P26
  visual/behavioral evidence.
- Synthesized through the completed independent design round; that round's
  external designer brief and internal sourceful commission record are preserved
  in Git history (PR #111) and are not live routes.
- Accepted/frozen by [PR #111](https://github.com/Biskiq/spatial-sketch-editor/pull/111)
  on `world-workspace-redesign`.
- Design inputs are not duplicated here. The four V2 boards remain in
  [`../integrated-experience-authoring/Design-QAs/`](../integrated-experience-authoring/Design-QAs/),
  while the original six P26 input rasters are recoverable through the
  [World acceptance preservation anchor](../spatial-authoring/qa/ACCEPTANCE.md#preservation).
  Unique material evidence remains under
  [`../../docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/`](../../docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/);
  [`../spatial-authoring/screens/`](../spatial-authoring/screens/) now contains current executable specimens.

## Deferred to repository-aware reconciliation

Implementation-dependent questions this design round deliberately leaves open:

- **Stable selectable identity for internal components.** Details may expose a
  component as task focus; the design does not assume a component is a stable
  selectable entity until the underlying model establishes that identity.
- **Exact shared-source / placement-override semantics.** Source-vs-instance
  reach is a design requirement; the resolution rules behind it remain domain
  work.
- **Exact representation of temporary World reading state** (Section depth,
  Unroll curvature/side, Reveal, Lift, mirrored Look-up) travelling with canonical
  Camera/navigation history. PLATE §0.8.2 fixes the user-facing behavior: returning
  does not resume; explicit Resume revalidates the original identity/targets and
  starts from the current standpoint. The session payload/storage mechanism remains
  undesigned; that does not leave the return behavior open.
- **PLATE's own open owner calls** (§0.3, §0.7.6) remain open, including
  motion-speed control placement, keyboard-focus treatment and the mat↔paper
  transition.

## Next step

#112 World adoption is accepted: [current executable](../spatial-authoring/README.md),
[QA acceptance](../spatial-authoring/qa/ACCEPTANCE.md) and
[closed plan](../../docs/roadmap/p26-spatial-depth/design/world-authoring-prototype/implementation-plan.md).
#113 builds the finalized V2 Experience executable against the shared shell and validates actual
World ↔ Experience continuity. The World bridge is read-only; production F/T1 gates are unchanged.
The ten boards and syntheses here remain frozen design evidence, independent of executable QA.
