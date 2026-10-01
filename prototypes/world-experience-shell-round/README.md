# World | Experience shell round — accepted unified shell design package

**Audience:** agents + humans.
**Hub:** [`../README.md`](../README.md) (prototype family) · [`../../docs/README.md`](../../docs/README.md) (documentation router).

**Status:** **finalized / frozen World design, promoted into durable destination
shell design alongside V2 Experience** (PR #111, 2026-10-01). The independent design
round is complete: its
[final synthesis](./design/design-synthesis.md) and canonical
[visual QA package](./QA-package/) are the durable outputs. The commissioning
briefs and the copied designer-input rasters are retired to Git history. The
direction is accepted; the shell itself is **not implemented** — the editor still
runs the landed PLATE chrome until an explicit production cutover, and the
spatial-authoring prototype still runs its predecessor shell until the bounded
adoption PR.

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
  This package retains the final design record and specimens; the next bounded
  prototype PR adopts the World expression.
- Preserves accepted **V2 Experience semantics**
  ([final V2 synthesis](../integrated-experience-authoring/design/Prototype-V2-final-synthesis.md))
  and **P26 journeys A–F, capabilities and interaction laws**
  ([Spatial Authoring Prototype](../spatial-authoring/README.md)).
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
- Design inputs are retained at their canonical sources, not duplicated here:
  the four V2 boards in
  [`../integrated-experience-authoring/Design-QAs/`](../integrated-experience-authoring/Design-QAs/),
  and the six P26 references under
  [`../../docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/`](../../docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/)
  and [`../spatial-authoring/screens/`](../spatial-authoring/screens/).

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

Bounded successor PR #112: adopt the frozen shell into
[`../spatial-authoring/`](../spatial-authoring/README.md), preserving P26
journeys A–F and behavioral laws, then run executable/visual QA. That PR is
prototype adoption — not production T1 implementation and not an F substitute.
The [implementation plan](../../docs/roadmap/p26-spatial-depth/design/world-authoring-prototype/implementation-plan.md)
is written for review; no prototype implementation or evidence retirement has
started. Its next boundary is #113: Experience V2 executable adoption and actual
World ↔ Experience continuity, with the production gates unchanged.
