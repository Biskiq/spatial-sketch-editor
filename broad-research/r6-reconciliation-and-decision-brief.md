# Research 6 → Product, Architecture & Roadmap Reconciliation Brief

**Status:** Independent assessment & decision brief for owner review (not a ratification)  
**Evaluated synthesis:** [`broad-research/biskiq-integrated-product-synthesis.md`](./biskiq-integrated-product-synthesis.md) (Research 6, incorporating two peer-review rounds over Studies 1–5)  
**Repository baseline:** `26290839` (`main`, post-PR #148 / #149 / #150)  
**Normative authorities checked:** [`docs/reference/north-star.md`](../docs/reference/north-star.md), [`docs/reference/architecture.md`](../docs/reference/architecture.md), [`docs/reference/composition-execution.md`](../docs/reference/composition-execution.md) (including ratified amendments `AM-1`–`AM-8`), [`docs/reference/design-system/editor-shell-and-visual-system.md`](../docs/reference/design-system/editor-shell-and-visual-system.md) (Conservatory #114 + Paper §0.8.4), [`docs/roadmap/README.md`](../docs/roadmap/README.md), and [`docs/roadmap/core-editor-stability.md`](../docs/roadmap/core-editor-stability.md).

---

## 1. Executive Verdict

### 1.1 Headline Judgment

**Research 6 strongly reinforces Biskiq's ratified North Star, semantic authority split, Conservatory shell, and F.1–F.5 execution model—it does not warrant a paradigm shift, a fifth domain authority, or a delay to the current `Core Editor Stability` milestone.**

Roughly **80% of Research 6's conceptual architecture is already captured—and in several areas more rigorously specified—in Biskiq's ratified contracts and landed foundation code (`@portfolio/project-model`, `@portfolio/layout-core`, `@portfolio/camera-core`)**:

- **Convergent entry paths (`Space-first`, `Collection-first`, `Story/Interaction-first`)** are already ratified in [`docs/reference/north-star.md`](../docs/reference/north-star.md) (*Primary creative starting points* and *Convergent creation paths*) and structurally backed by F.2's five-unit envelope (`packages/project-model/src/units/types.ts`).
- **Two-mode `World | Experience` workspace with `Plan | Stage` sub-views** is already ratified in [`docs/reference/design-system/editor-shell-and-visual-system.md`](../docs/reference/design-system/editor-shell-and-visual-system.md) (§0.8, §0.8.1, §0.8.4) and [`docs/reference/decisions/world-experience-reconciliation-2026-09-29.md`](../docs/reference/decisions/world-experience-reconciliation-2026-09-29.md).
- **One Camera authority across Guided, Free, and Reduced-Motion profiles** is already ratified in `AM-6` and shipped in `packages/camera-core/src/experience-controllers.ts` (`T3.P01.S06`).
- **Shared Preview/Publication execution (`ExecutionProgram@1`)** with bounded declarative state, guards, lifecycle actions, and mandatory accessibility (`reducedMotion: 'required'`, `semanticDomNavigation: 'required'`) is already ratified and shipped in `packages/project-model/src/program/types.ts` (`T3.P01.S01`).
- **Deterministic room identity reconciliation (`P23.8`), wall-first topology (`formatVersion: 5`), and source-to-derived fragment provenance (`DerivedSourceRef@1`)** are already shipped in `packages/layout-core/src/layout-room-reconciliation.ts` and `packages/project-model/src/references/types.ts`.

### 1.2 What Research 6 Genuinely Contributes (The Real Product Delta)

Beneath its overlap with the North Star, Research 6 contributes **four high-value product and architectural refinements** that are either underspecified or absent in current contracts and roadmap plans:

1. **Three-tier revision outcome triage (`Preserved`, `Needs Review`, `Unresolved`):**  
   Biskiq's landed F.1/F.2/F.4 contracts (`ReferenceResolution` in `packages/project-model/src/references/types.ts`, `UnresolvedBinding` in `packages/project-model/src/units/types.ts`, and `CorrespondenceEntry` in `packages/project-model/src/f4/types.ts`) currently model a **binary** outcome: either a reference resolves (`resolved` / `preserved`) or it fails (`missing | removed | incompatible | unauthorized | repair-required`). They lack a middle tier—**`Needs Review` (Compositional Advisory)**—where the target identity and host surface *survive* a Layout or asset revision, but a spatial or framing assumption is violated (e.g., an object's footprint now overhangs a narrowed room, a wall-mounted frame overlaps a moved opening, or a Camera view's target is newly occluded by a partition wall).
2. **The Beginner Subtraction Baseline (Zero-Stop Free-Roam Experience + Default Room Illumination):**  
   Research 6 sharpens a crucial novice-success invariant: **a creator who builds or picks a space and places objects must be able to immediately Preview and Publish a complete, well-lit Free-Roam Experience without authoring a single Camera View, Presentation, Stop, Guide, or manual Light entity.** While `ExecutionProgram@1` (`packages/project-model/src/program/types.ts`) structurally permits `stops: []` and `entryStopId: null`, `T3.P02` and `T4.P01` currently center on guided Stop sequences, and `starter-gallery.ts` boots with zero illumination semantics beyond hard-coded renderer fallbacks.
3. **Explicit Three-Tier Spatial Placement & Surface Anchoring (Especially Wall-Surface Artwork):**  
   Research 6 cleanly separates **(a) Transient Placement Assists** (gesture-time snapping/clearance discarded after commit), **(b) Host-Relative Surface Anchoring** (persistent attachment to a Floor, Wall face, Ceiling, or Support surface that rides host transforms), and **(c) Persistent Spatial Relationships** (explicitly authored multi-entity rules like `AlignmentRail` or target-linked spotlights). In particular, Research 6's "First-Day Creator Journey" (10 photographs + 1 sculpture) exposes a concrete gap in `T2`: `T2.P01` and K1 (single-model GLB import) only admit **floor-supported upright 3D objects** (`PlacementSurface: 'floor'`). A spatial portfolio/exhibition tool cannot complete its canonical first-day gallery loop without **Wall-surface 2D image/frame anchoring**.
4. **Pre-Flight Asset Readiness, Physical Scale Normalization & Variant Lineage:**  
   Research 6 defines a concrete ingestion quarantine contract (`Ready`, `Needs Repair`, `Blocked`) with physical bounding-box unit inspection, pivot normalization (`bottom-center` for floor objects, `back-center` for wall works), and stable logical asset identity across source re-imports (`VariantLineage`). This directly strengthens T2's upcoming asset import phase (`K1` in [`docs/reference/decisions/next-batch-authorization-2026-10-17.md`](../docs/reference/decisions/next-batch-authorization-2026-10-17.md)).

### 1.3 Where Research 6 Conflicts with Biskiq Authority and Must Be Rejected or Corrected

Research 6 also introduces **four material drifts** from Biskiq's ratified architecture that would weaken domain separation or bloat near-term delivery if adopted as written:

1. **Reject folding `Entity Poses`, `Performance Clips`, and `Environmental Looks` into `SceneDocument`:**  
   Research 6 (§1 table, §2.3) places discrete poses, performance clips, and environmental looks inside `SceneDocument`. In Biskiq's ratified architecture (`docs/reference/north-star.md`, `docs/reference/architecture.md`, `docs/reference/composition-execution.md` §F.2/§F.3), reusable states, clips, and performances belong to **independently versioned `Typed Resources`** (`resource:<kind>`) that emit negotiated **F.3 `ChannelContribution`s**, while `Scene` (`CameraFreeSceneDocument`) owns placed instances, hierarchy, materials, lights, and baseline transforms. Keeping state/look presets in `Typed Resources` + F.3 prevents `SceneDocument` bloat and enables cross-project reuse and clean F.3 conflict arbitration.
2. **Reject replacing `Presentation` + `Stop` + `Guide` with Study 3's `Zones/Stops` + `Vertical Cue Stacks`:**  
   Research 6 (§1, §3.3, §4.4) reverts to pre-ratification Study 3 terminology (`Zones/Stops`, `Vertical Cue Stacks`, `Elastic Guide`). Biskiq explicitly resolved this in [`docs/reference/decisions/world-experience-reconciliation-2026-09-29.md`](../docs/reference/decisions/world-experience-reconciliation-2026-09-29.md) and [`docs/reference/design-system/editor-shell-and-visual-system.md`](../docs/reference/design-system/editor-shell-and-visual-system.md) (§0.8.1): **`Presentation` is the reusable visitor-facing meaning unit**, **`Stop` is an ordered occurrence in an optional `Guide`**, and **there is no standalone Cue timeline** (Camera owns progress markers; performances own their cues; Experience binds interactions).
3. **Reject an implicit runtime `Epistemic Ledger / Lookback` in favor of explicit `ProgramStateDeclaration` + `ProgramGuard`:**  
   Research 6 (§3.3) proposes an "Implicit Epistemic Ledger (Lookback)" that automatically tracks visited stops/inspected objects as implicit condition sources. `AM-6` and `ExecutionProgram@1` (`packages/project-model/src/program/types.ts`) intentionally require **explicitly declared boolean/choice state (`ProgramStateDeclaration`)** with explicit `initial` and `reset` values mutated by explicit `set-state` lifecycle actions. Implicit visit tracking is acceptable *only* if lowered deterministically into explicit `ProgramStateDeclaration` entries at compile time—never as hidden runtime memory.
4. **Defer Dual-Skin Straight-Skeleton Shells, Void Prisms, Parametric Rigs, and Multi-Asset Alignment Solvers:**  
   Research 6 bundles advanced architectural geometry (Dual-Skin overhead shells $\Sigma_{\text{ext}}, \Sigma_{\text{int}}$, straight-skeleton roof solver, Void Prisms) and parametric rigging into its synthesis. Adopting these before closing `Core Editor Stability`, straight-wall creation (`K3`), GLB/image import (`K1`), and live `ProjectEnvelope` cutover (`T3.P01.S04`) would severely delay the core creative loop.

---

## 2. Delta Matrix

| # | Research 6 Recommendation | Existing Authority & Code Evidence | Gap or Conflict Analysis | Recommended Disposition | Affected Track / Contract |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **D1** | **Convergent Entry Tri-Modal Funnel** (`Space-first`, `Collection-first`, `Story/Interaction-first`) with zero dead-ends (§1, §2.1). | Ratified in `docs/reference/north-star.md` (*Primary creative starting points*, *Convergent creation paths*); backed by F.2 `ProjectEnvelope` (`packages/project-model/src/units/types.ts`). | **Already covered conceptually; partial roadmap sequencing gap.** Current Editor UI boots only into `starter-gallery.ts` (`Space-first`). `Collection-first` (staging tray before Room) and `Story-first` (Presentation/Stop draft before Views are placed) need explicit post-stability phase homes in T2/T3. | **Already Covered (Concept) / Future Phase Consideration (UX)** | `T2` (staging tray), `T3` (draft Presentations), `docs/reference/north-star.md` |
| **D2** | **Beginner Subtraction Baseline & Publishable Free-Roam Experience** with zero authored Stops/Guides and default Room illumination (§1, §2.1, §4.6). | `ExecutionProgram@1` (`packages/project-model/src/program/types.ts`) already allows `stops: []` and `entryStopId: null`. However, `T3.P02` and `T4.P01` assume Stop-driven playback, and `starter-gallery.ts` has no default architectural illumination recipe. | **Genuine product refinement.** Today, an empty `SceneDocument` has no lights (`entities: []`), relying on editor viewport fallback lighting, and Preview/Release has no explicit "Free-Roam + ambient Presentation cards" execution profile when `guides` is empty. | **Adopt as Product & Contract Refinement** (post-`T3.P01.S04`, in `T3.P02` / `T2` lighting defaults / `T4.P01`) | `T2`, `T3.P02`, `T4.P01`, `docs/reference/components/camera-tour.md` |
| **D3** | **Two-Tier Capability Architecture:** Tier 1 Universal Creative Foundations vs. Tier 2 Scenographic Accelerator Recipes (§1, §2.2). | `docs/reference/north-star.md` (*Core creative capabilities*) already lists domain capabilities; `docs/reference/design-system/editor-shell-and-visual-system.md` (§0.8) keeps specialized tools out of primary chrome. | **Valuable product framing refinement.** Formally distinguishing *Tier 1 primitives* (surfaces, anchors, lights, views, presentations) from *Tier 2 compound macros* (Picture Wall Hang, Pedestal + Spot, Daylight Gallery Wash) prevents UI bloat while accelerating exhibition workflows. | **Adopt as Product Framing Principle** (no schema change; guides T2/T3 tool design) | `docs/reference/north-star.md`, `T2`, `T3` |
| **D4** | **Domain Ownership of States, Poses, Clips, and Environmental Looks** inside `SceneDocument` and UI Variants inside `ExperienceDocument` (§1 table, §2.3, §4.3). | `docs/reference/north-star.md` (*Ownership*), `docs/reference/architecture.md`, and `docs/reference/composition-execution.md` (§F.2, §F.3) assign reusable states, clips, and performances to **`Typed Resources`** (`units.resources`) driving **F.3 `ChannelContribution`s**. | **Architectural conflict.** Putting poses, clips, and environmental looks inside `SceneDocument` (`CameraFreeSceneDocument` in `packages/project-model/src/units/types.ts`) violates Rule 2 (distinct semantic authorities) and prevents cross-project reuse and uniform F.3 channel arbitration. | **Reject `SceneDocument` storage; Replace with `TypedResource` (`resource:state-preset`, `resource:look-preset`, `resource:clip`) + F.3 channels** | `docs/reference/composition-execution.md`, `packages/project-model/src/units/types.ts`, `T2`, `T3` |
| **D5** | **Seam A1: Three-Tier Spatial Placement** — (1) Host-Relative Anchoring, (2) Transient Placement Assists, (3) Persistent Spatial Relationships (`AlignmentRail`, target-linked lights) (§2.4, §3.1, §4.2). | `T2.P01.S01` (`packages/project-model/src/scene-planning/types.ts`) implements Floor `PlacementSurface` via read-only consultation (Transient Assist → world-local `Vec3`). F.1 `FrameReference` (`packages/project-model/src/references/types.ts`) supports `owner-frame`. `docs/reference/components/scene-content.md` names typed `Attachment` as destination. | **Genuine architectural & roadmap gap.** Current `SceneEntity` (`packages/project-model/src/scene.ts`) stores only raw world-local `position`/`rotation`/`scale`. When a Wall or Room moves in T1, placed Scene objects do **not** ride their host surface. Furthermore, `PlacementSurface: 'wall'` (needed for 2D art/frames) is currently refused (`uprightOnly: true`, `'floor'` only). | **Adopt Tiers 1 & 2 (Surface Anchoring + Transient Assists) for post-`T2.P01` roadmap; Defer Tier 3 (`AlignmentRail`)** | `T2` (next phases), `docs/reference/components/scene-content.md`, `packages/project-model/src/scene.ts` |
| **D6** | **Seam A2: Source-to-Derived Topology Provenance & Three-Tier Revision Triage (`Preserved`, `Needs Review`, `Unresolved`)** (§2.4, §3.1, §4.5). | `packages/layout-core/src/layout-room-reconciliation.ts` (`P23.8`), `DerivedSourceRef@1` (`packages/project-model/src/references/types.ts`), `UnresolvedBinding` (`packages/project-model/src/units/types.ts`), and `CorrespondenceEntry` (`packages/project-model/src/f4/types.ts`). | **Genuine missing diagnostic tier.** F.1/F.2/F.4 distinguish `resolved`/`preserved` from `failed`/`UnresolvedBinding`, but have no **`Needs Review` (Compositional Advisory)** state for when an anchor's host survives a topology edit yet violates clearance, wall bounds, or sightlines. | **Adopt `Needs Review` as a non-blocking Compositional Advisory diagnostic alongside `UnresolvedBinding`** | `docs/reference/composition-execution.md` (F.1/F.2/F.4), `T1`, `T2`, `T3` |
| **D7** | **Vertical Architecture: Elastic Horizons with per-room $\Delta Z_{\text{floor}}, H_{\text{ceiling}}$, Dual-Skin Overhead Shells ($\Sigma_{\text{ext}}, \Sigma_{\text{int}}$), and Void Prisms** (§3.1). | `packages/layout-core/src/layout-wall-first-types.ts` (`formatVersion: 5`, P23.6H/I): `LayoutWallFirstFloor` is a single horizontal datum (`elevation` only), and `LayoutWall.height` is per-wall vertical extent; Room ceiling is derived from boundary wall heights. | **Partial conflict with P23.6I; premature scope expansion.** P23.6I deliberately simplified verticality to per-Wall `height` over a Floor datum. While multi-level floors and sunken/raised room offsets ($\Delta Z_{\text{floor}}$) are valid future T1 extensions, Dual-Skin straight-skeleton roof solvers and CSG Void Prisms are heavy CAD features that would derail T1's fundamental authoring loop. | **Narrow & Defer:** Keep P23.6I wall-height model through `Core Editor Stability` and `K3`; evaluate per-room floor step $\Delta Z_{\text{floor}}$ in future T1 multi-level phase; **Defer** Dual-Skin roof solvers and Void Prisms to post-v1 horizon | `T1`, `docs/reference/components/persistence.md` |
| **D8** | **Asset Readiness Quarantine (`Ready`, `Needs Repair`, `Blocked`), Physical Scale Verification, and Variant Lineage** (§3.2, §4.1). | `packages/project-model/src/scene-planning/types.ts` (`NormalizedPlacementDefinition`, `ObjectContactProvenance`, `RenderNormalizationIdentity`) and `packages/project-model/src/units/types.ts` (`TypedResource`, `ResourcePin`). `docs/reference/components/assets.md` describes current API upload. | **Strong, compatible refinement for K1 (GLB import).** `T2.P01.S01` already separated `renderNormalization` and `contactMinY`/`footprintMeters` on the planner side! Research 6 supplies the missing **ingestion-side contract** that produces those verified metrics during user GLB/image import and preserves logical `assetId` across source file replacements. | **Adopt in T2's next phase (K1 single-model GLB import + 2D artwork import)** | `T2` (post-`T2.P01`), `docs/reference/components/assets.md` |
| **D9** | **Experience Authoring via `Zones/Stops`, `Vertical Cue Stacks`, `Elastic Guide`, and `Implicit Epistemic Ledger (Lookback)`** (§3.3, §4.4). | `docs/reference/decisions/world-experience-reconciliation-2026-09-29.md`, `docs/reference/design-system/editor-shell-and-visual-system.md` (§0.8.1), `packages/project-model/src/units/types.ts` (`ExperiencePresentation`, `ExperienceStop`, `ExperienceGuide`), and `packages/project-model/src/program/types.ts` (`ExecutionProgram`). | **Direct vocabulary & ownership conflict.** Conservatory #114 §0.8.1 and the 2026-09-29 decision record explicitly rejected a standalone Cue stack/timeline and separated `Presentation` (meaning) from `Stop` (guide occurrence). `ExecutionProgram@1` requires explicit `ProgramStateDeclaration`, not implicit runtime lookback. | **Reject vocabulary drift and standalone Cue stacks; Narrow "Lookback" to compile-time lowering into explicit `ProgramStateDeclaration`s** | `T3`, `docs/reference/design-system/editor-shell-and-visual-system.md` (§0.8.1), `docs/reference/composition-execution.md` (F.5) |
| **D10** | **Bounded 4-Step Same-Frame Cascade, Priority-Latching State Arbitration, and Parametric Procedural Rigs** (§3.2, §3.3). | F.3 (`packages/project-model/src/channels/types.ts` & `negotiate.ts`) already implements deterministic arbitration (`exclusive`, `ordered-replacement`, `union`, `camera-output`) with monotonic `runEpoch` and `ChannelDiagnostic` conflict reporting (`T1.P01.S01` / `T3.P01.S06`). | **Already solved more cleanly by F.3; procedural rigs premature.** F.3's `ChannelNegotiationOutcome` and `runEpoch` already prevent cycles and conflicts without needing a new "Priority-Latching" subsystem. Procedural kinematic rigs (`hinge`, `slider`) are future capability extensions (`resource:rig`), not core stability requirements. | **Keep F.3 Channel Arbitration as authoritative; Defer Procedural Rigs to future T2/T3 horizon** | `docs/reference/composition-execution.md` (F.3), `T2`, `T3` |

---

## 3. Track & Milestone Impact (T1–T4 & Core Editor Stability)

### 3.1 Near-Term Milestone: `Core Editor Stability` (`docs/roadmap/core-editor-stability.md`)

- **Disposition:** **No Change to Milestone Scope or Gate Requirements.**
- **Evidence & Rationale:**  
  [`docs/roadmap/core-editor-stability.md`](../docs/roadmap/core-editor-stability.md) defines a deliberately tight, high-discipline exit target:
  1. Complete `T1.P01` (`S05` straight-Wall manipulation + `S06` integrated final gate; `S01`–`S04` and `S07` are already shipped).
  2. Complete `T2.P01` (`S03` first coherent editing surface [authorized in Batch B] + `S04` bounded composition loop & final gate; `S01`–`S02` are already shipped).
  3. Complete `T3.P01.S04` (live ownership cutover from `ProjectDocument` to `ProjectEnvelope`, ratifying `T3.camera-experience-cutover@1`).
  4. Ship `T3.P02` (first capture and Cut Preview over the cut-over envelope).
  5. Complete K3 (bounded straight-Wall creation + Wall-role derived cutover) and K1 (bounded editor-side single-model GLB import).
- **Why Research 6 must not expand `Core Editor Stability`:**  
  Every genuine enhancement in Research 6 (host-relative surface anchoring, `Needs Review` compositional advisories, pre-flight asset readiness, free-roam Experience defaults) **depends on `T3.P01.S04` (`ProjectEnvelope` + `F.2`/`F.4` unit acceptance) and `T1.P01`/`T2.P01` closing first**. Injecting new schema requirements into `T1.P01.S05`, `T2.P01.S03`, or `T3.P01.S04` would invalidate already-accepted `F1`–`F4` gates and delay the foundational `ProjectEnvelope` cutover.

### 3.2 Track 1: Spatial & Architectural Authoring (`T1`)

- **No Change:**
  - `T1.P01.S05` (existing straight-Wall manipulation) and `T1.P01.S06` (final gate).
  - K3 next-phase scope: bounded straight-Wall creation (`planWallChain` / draw gesture) and derived Wall-role (`boundary` vs. `partition`) cutover.
  - Canonical wall-first format v5 (`LayoutDocumentWallFirst` in `packages/layout-core/src/layout-wall-first-types.ts`) and P23.6I wall-owned verticality (`LayoutWall.height`).
- **Priority Adjustment (Post-`T1.P01` / Post-K3):**
  - **Expose Wall Face & Room Floor `FrameResolver`s over F.1 (`FrameReference@1`):** Before T2 can anchor 2D artworks to walls or keep floor objects attached during room moves, T1 must publish deterministic F.1 `FrameResolver` implementations (`packages/project-model/src/references/types.ts`) for **Room Floor frames** and **Oriented Wall-Face frames** (`wallId` + `'forward' | 'reverse'` side + datum).
  - **Emit Geometric Bounds Change Summaries for Compositional Review (`Needs Review`):** When a Layout operation accepts in F.4, alongside `CorrespondenceEntry` (`preserved | created | retired | replaced`), T1's planner/adapter should expose which Room polygons and Wall face spans changed geometry so T2/T3 can flag hosted Scene objects or Camera views as `Needs Review`.
- **Future Phase Consideration:**
  - Multi-level Floor management (`LayoutWallFirstFloor[]`) and per-room floor step offsets ($\Delta Z_{\text{floor}}$) for sunken/raised galleries.
  - Curved-wall interactive creation/editing (the codec and geometry compiler in `layout-wall-curve-algebra.ts` and `layout-geometry-curve.ts` already exist from P23.11, awaiting Paper/Stage UI).
- **Reject / Far Horizon:**
  - Dual-Skin Overhead Shells ($\Sigma_{\text{ext}}, \Sigma_{\text{int}}$) with straight-skeleton roof solvers and Void Prisms (keep out of T1 roadmap until core architectural + exhibition loops are mature).

### 3.3 Track 2: World, Scene & Asset Composition (`T2`)

- **No Change:**
  - `T2.P01.S03` (first coherent Stage editing surface for floor-supported objects) and `T2.P01.S04` (bounded composition loop + Head Save + final gate).
- **Priority Adjustment (Shaping Post-`T2.P01` Phases):**
  - **Fold Pre-Flight Asset Readiness & Normalization into K1 (Single-Model GLB Import):** When scoping the K1 phase (`docs/reference/decisions/next-batch-authorization-2026-10-17.md`), incorporate Research 6's **Asset Readiness Quarantine (`Ready | Needs Repair | Blocked`)** directly into the editor import flow so imported GLBs produce a verified `NormalizedPlacementDefinition` (`footprintMeters`, `contactMinY`, `renderNormalization`, scale/unit check) *before* entering the Stage placement catalogue.
  - **Elevate Wall-Surface 2D Image/Frame Placement Alongside or Immediately After K1:** Research 6's canonical creator journey (10 photos + 1 sculpture) highlights that **2D wall-hung works (images/frames on `PlacementSurface: 'wall'`)** are even more fundamental to portfolio/museum creators than complex 3D GLBs. Extending `PlacementSurface` admission in `packages/project-model/src/scene-planning/types.ts` from `'floor'`-only to admit `'wall'` (with `back-center` contact provenance against T1 wall faces) should be prioritized immediately after `T2.P01` + `K1`.
  - **Adopt Host-Relative Surface Attachment (`Attachment` on `SceneEntity`) inScene v2.1 / Post-Cutover T2 Phase:** Transition from gesture-only floor consultation (`T2.P01`) to persisted host-relative `FrameReference` + surface offset on `SceneEntity` (`docs/reference/components/scene-content.md` destination contract), so moving a wall or room carries its mounted paintings and floor objects with it and flags out-of-bounds shifts as `Needs Review`.
  - **Provide a Default Room Illumination Baseline ("Balanced Gallery Wash"):** Ensure newly created spaces have a clean, shadow-coherent architectural lighting baseline without requiring novices to manually place and tune point/spot lights first.
- **Future Phase Consideration:**
  - Logical asset replacement with `VariantLineage` (updating a `TypedResource` pin while preserving `assetId` and running a footprint delta check against existing placements).
  - Tier 2 Scenographic Recipes (e.g., *Pedestal + Artwork + Target-Linked Spotlight* macro, *Wall Hang Row* assist).
  - Reusable `resource:look-preset` and `resource:state-preset` definitions contributing via F.3 channels.
- **Requires Owner Decision:**
  - Whether 2D Wall-Work / Framed-Image import & wall-surface placement (`PlacementSurface: 'wall'`) should be sequenced **inside or immediately alongside the K1 GLB import phase** (see **OD-R6-2** in §7).

### 3.4 Track 3: Camera, Experience & Shared Runtime (`T3`)

- **No Change:**
  - `T3.P01.S04` (live ownership cutover to `ProjectEnvelope`, retiring `local-single-domain-v1` and activating `unit-acceptance-v1`). All 6 preflight deliverables in `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/preflight/` remain the exact critical path.
  - `T3.P02` core objective: first View + Presentation + Stop capture and Cut Preview over `ExecutionProgram@1`.
- **Priority Adjustment (Within `T3.P02` and Subsequent T3 Phases):**
  - **Guarantee Zero-Stop Free-Roam Preview in `T3.P02`:** When `T3.P02` wires `ExecutionProgram@1` into the Editor Preview runner, explicitly support the **Subtraction Baseline**: if an Experience has `stops: []` and `entryStopId: null` (or only unbound `presentations`), Preview launches in `FreeController` mode (`packages/camera-core/src/experience-controllers.ts`) from a deterministic starting pose inside the primary Room (or first Presentation view) rather than refusing to preview.
  - **Preserve `Presentation` vs. `Stop` Separation Against Research 6 Drift:** Keep `ExperiencePresentation` (reusable meaning + view + content) distinct from `ExperienceStop` (ordered guide occurrence with `holdSeconds` and `continuation`). In Free-Roam mode, visitors can still inspect placed `ExperiencePresentation` stations without being forced onto a linear `ExperienceGuide`.
- **Future Phase Consideration:**
  - Guided Travel authoring (`kind: 'travel'` over `SceneConnection`) after Cut Preview (`T3.P02`) is proven.
  - Compile-time lowering of creator-friendly "visited / inspected" conditions into explicit `ProgramStateDeclaration` and `ProgramLifecycleAction` (`set-state` on `arrival`/`complete`) inside `ExecutionProgram@1`.
  - Sightline / occlusion check for `CameraView` (`eye` → `target` raycast against compiled Layout walls) surfacing `Needs Review` diagnostics when a Layout edit blocks a View.
- **Requires Owner Decision:**
  - Formalizing the **Zero-Stop Free-Roam Experience** contract so both Preview (`T3.P02`) and Prepared Release (`T4.P01`) treat a Guide-free world as a complete, valid Experience (see **OD-R6-3** in §7).

### 3.5 Track 4: Publication, Delivery & Release Lifecycle (`T4`)

- **No Change:**
  - Ruling **R1-D** ([`docs/reference/decisions/next-batch-authorization-2026-10-17.md`](../docs/reference/decisions/next-batch-authorization-2026-10-17.md)) remains in full force: **T4 stays deferred until `Core Editor Stability` is accepted.**
- **Priority Adjustment (When `T4.P01` Activates Post-Stability):**
  - **Three-Tier Publication Gate Alignment (`Preserved`, `Needs Review`, `Unresolved`):** When `F5.release-envelope` is drafted for `T4.P01`, align publication preflight with the three-tier diagnostic model:
    - **`Unresolved` (`UnresolvedBinding` / broken required closure):** **Hard block** on publication (already required by `AM-2` / `F.5`).
    - **`Needs Review` (Compositional Advisory — e.g., footprint overhang or occluded optional view):** **Non-blocking warning** surfaced in the Publish preflight checklist; creator can review or explicitly acknowledge and publish.
    - **`Preserved`:** Clean pass.

---

## 4. Foundational Architecture Assessment

This section evaluates Research 6's technical mechanisms against Biskiq's exact source types and contracts, separating genuine architectural gaps from already-solved or incompatible proposals.

### 4.1 Semantic Authorities & F.2 Unit Envelope (`packages/project-model/src/units/types.ts`)

- **Current Code Reality:**  
  `packages/project-model/src/units/types.ts` (lines 51–63, 291–313) defines `UNIT_DOMAINS = ['layout', 'scene', 'camera', 'experience', 'resources']` and `ProjectEnvelope` (`formatVersion: 1`).
  - `LayoutUnitPayload` = `LayoutDocumentWallFirst` (`formatVersion: 5`).
  - `CameraFreeSceneDocument` (`formatVersion: 2`) = `{ textures, materials, entities, clusters }`.
  - `CameraUnitPayload` (`formatVersion: 1`) = `{ views: CameraView[], connections: SceneConnection[] }`.
  - `ExperienceUnitPayload` (`formatVersion: 1`) = `{ experiences: Experience[] }`.
  - `ResourceUnitPayload` (`formatVersion: 1`) = `{ resources: TypedResource[] }` with `RESOURCE_KINDS = ['texture', 'asset']`.
- **Assessment of Research 6 §1 & §2.3:**  
  Research 6 proposes storing `Entity Poses`, `Performance Clips`, and `Environmental Looks` inside `SceneDocument`.
  - **Verdict:** **Incompatible with F.2/F.3 authority boundaries.** `CameraFreeSceneDocument` is intentionally a clean spatial composition document (`formatVersion: 2`). Discrete states, looks, and animation clips are reusable across scenes/experiences and act as **contributors to properties** rather than static scene entities.
  - **Correct Biskiq Architecture:** Extend `RESOURCE_KINDS` in a future resource unit version (`RESOURCE_UNIT_FORMAT_VERSION`) with typed resource kinds (`resource:look-preset`, `resource:state-preset`, `resource:clip`) as already anticipated by `packages/project-model/src/references/types.ts` (`ResourceDomain = \`resource:\${string}\``, line 30), and evaluate their activation through F.3 `ChannelContribution`s (`packages/project-model/src/channels/types.ts`).

### 4.2 Reference Resolution, Revision Continuity & `Needs Review` (`packages/project-model/src/references/types.ts`, `f4/types.ts`, `units/types.ts`)

- **Current Code Reality:**
  - `packages/project-model/src/references/types.ts` (lines 168–208) defines `REFERENCE_FAILURE_CODES = ['missing', 'removed', 'incompatible', 'unauthorized', 'repair-required']` and `ReferenceResolution = { kind: 'resolved', ... } | { kind: 'failed', code: ReferenceFailureCode, repairs: ReferenceRepairAction[] }`.
  - `packages/project-model/src/units/types.ts` (lines 90–95) defines `UnresolvedBinding = { reference: SemanticReference, domain: ReferenceDomain, status: ReferenceFailureCode, message: string }`.
  - `packages/project-model/src/f4/types.ts` (lines 126–139, 220–226) defines `CorrespondenceRelation = 'preserved' | 'created' | 'retired' | 'replaced'` and `AdmissionIssue = { path, code, message, targetId?, severity?: 'warning' | 'error' }`.
- **Assessment of Research 6 §2.4 & §4.5 (`Preserved`, `Needs Review`, `Unresolved`):**
  - **Verdict:** **Genuine missing middle layer.** Today:
    - If a Wall is deleted and a Door or Wall-mounted painting loses its host, F.1/F.2 can represent that as `failed` (`removed` / `missing`) → `UnresolvedBinding` (**`Unresolved`**).
    - If a Wall is shortened by 1 meter and its ID is `preserved` in `CorrespondenceEntry`, F.1 resolution returns `{ kind: 'resolved' }` (**`Preserved`**)—even if a painting anchored at offset $4.5\text{ m}$ now hangs $0.5\text{ m}$ past the end of the shortened $4.0\text{ m}$ wall!
  - **How to Reconcile Cleanly Without Breaking `F1.reference@1` or `F2.unit-envelope@1`:**  
    Do **not** mutate `ReferenceResolution` (because the F.1 identity *did* resolve: the Wall still exists). Instead, formalize **`CompositionalAdvisory` (`Needs Review`)** at the domain/unit validation and F.4 candidate preparation layer (`AdmissionIssue` with `severity: 'warning'` or a typed `advisories: readonly CompositionalAdvisory[]` companion to `UnresolvedBinding`), where:
    - **`Preserved`:** F.1 reference resolves AND domain geometric/framing invariants hold.
    - **`Needs Review`:** F.1 reference resolves, **but** a domain geometric, clearance, footprint-containment, or sightline invariant was invalidated by a cross-domain or host revision. Permitted in F.4 acceptance, playable in Preview, and allowed in F.5 Publication with explicit creator acknowledgment.
    - **`Unresolved`:** F.1 reference fails to resolve (`UnresolvedBinding`) or a required asset/route closure is broken. Permitted in F.4 authoring storage (so edits are never lost), **blocks** affected execution/publication under F.5 until repaired or detached.

### 4.3 Spatial Placement, Surface Anchoring & Frame References (`packages/project-model/src/scene-planning/types.ts`)

- **Current Code Reality:**
  - `packages/project-model/src/scene-planning/types.ts` (lines 44, 66–72) already declares `PlacementSurface = 'floor' | 'wall' | 'ceiling' | 'surface'`, while pinning `T2.P01` admission to `'floor'` and `uprightOnly: true`.
  - `packages/project-model/src/scene-planning/place-object.ts` and `packages/layout-core/src/layout-floor-support.ts` evaluate floor polygon containment and `contactMinY` at **planning time**, writing a static world-local `position: Vec3` and `rotation: Vec3` into `SceneEntity` (`packages/project-model/src/scene.ts`, lines 168–184).
  - `packages/project-model/src/references/types.ts` (lines 121–142) already defines `FrameReference` (`project-world` | `owner-frame`) and `FramePlacement` (`originMeters`, `yawRadians`, `datumMeters`).
- **Assessment of Research 6 Seam A1 (§2.4, §3.1, §4.2):**
  - **Verdict:** **High-value architectural alignment; confirms the exact next step for T2 + F.1.**
  - Today's `T2.P01` floor placement is what Research 6 calls a **Transient Placement Assist**: it uses Layout's floor support to compute a valid world-local `Vec3`, then forgets the host relationship once committed.
  - To achieve Research 6's **Host-Relative Spatial Anchoring** (so objects move with their room/wall and report `Needs Review` or `Unresolved` when the host changes), `SceneEntityBase` (`packages/project-model/src/scene.ts`) in a post-cutover Scene schema evolution (`SCENE_UNIT_FORMAT_VERSION = 3` or optional field in Scene 2 after `T3.P01.S04`) should carry an optional `anchor?: SurfaceAnchor` referencing an F.1 `FrameReference` (`owner: 'layout'`, e.g., a Room floor frame or oriented Wall-face frame) plus local surface parameters $(u, v, d_{\text{offset}}, \theta_{\text{local}})$ alongside its cached world-local `position`/`rotation`.
  - By caching the resolved world-local `position`/`rotation` on acceptance while retaining `anchor`, **visitor rendering remains 100% flat and zero-cost** (preserving Rule 4/6 and `CameraFreeSceneDocument` comment at line 146), while editor re-evaluation after a Layout revision can deterministically recompute world transforms or emit `Needs Review` / `Unresolved`!

### 4.4 Layout Topology & Verticality (`packages/layout-core/src/layout-wall-first-types.ts`)

- **Current Code Reality:**
  - `LayoutDocumentWallFirst` (`formatVersion: 5`, lines 278–298) has a single `floor: LayoutWallFirstFloor` (`{ id, name, elevation }`), `junctions: LayoutJunction[]`, `walls: LayoutWall[]` (each with physical `height: number` and `centerline: LayoutWallCenterline`), `rooms: LayoutWallFirstRoom[]`, `openings: LayoutWallOpening[]`, and `identity?: LayoutIdentityLedger`.
  - Room ceilings are derived per Room from boundary Wall heights (`packages/layout-core/src/layout-wall-heights.ts`).
- **Assessment of Research 6 §3.1 (Elastic Horizons, $\Delta Z_{\text{floor}}$, Dual-Skin Shells, Void Prisms):**
  - **Verdict:** **Partially conflicting with P23.6I; requires strict scoping.**
  - P23.6I explicitly rejected a Floor-level `height` scalar because wall-first architecture allows freestanding/partition walls and variable-height walls within one plan. Research 6's "Elastic Horizon" re-introduces a Storey-level default ceiling height $H_{\text{default}}$ with per-room overrides.
  - **Resolution:** Keep `LayoutWall.height` as the physical wall authority. A level-wide "Default New-Wall Height" is an authoring parameter (`plan-parameters.ts`), not a replacement for `LayoutWall.height`. If sunken/raised room floors ($\Delta Z_{\text{floor}}$) are added in a future T1 phase, add an optional `floorOffset?: number` on `LayoutWallFirstRoom` relative to `floor.elevation` rather than replacing P23.6I's wall-height model.

### 4.5 Experience, Camera & Shared Execution (`packages/project-model/src/program/types.ts`, `packages/camera-core/src/experience-controllers.ts`)

- **Current Code Reality:**
  - `packages/project-model/src/units/types.ts` (lines 180–249) defines `ExperiencePresentation`, `ExperienceStop`, `ExperienceGuide`, `ExperienceGate`, `ExperienceDetour`, and `Experience`.
  - `packages/project-model/src/program/types.ts` (lines 129–142) defines `ExecutionProgram` (`formatVersion: 1`) with `entryStopId: string | null`, `presentations`, `stops`, `state`, `localTime`, `channels`, `lifecycle`, and `profile: { reducedMotion: 'required', semanticDomNavigation: 'required' }`.
  - `packages/camera-core/src/experience-controllers.ts` (lines 156–241) implements `createGuidedController`, `createFreeController`, and `createReducedMotionController`.
- **Assessment of Research 6 §3.3 & §4.4:**
  - **Verdict:** **Biskiq's landed model is cleaner and more modular than Research 6's `Zones/Stops` + `Vertical Cue Stacks`.**
  - Notice how `packages/project-model/src/units/types.ts` (line 240) already specifies:
    > `entryGuideId: string | null; // The guide whose sequence the Experience enters by default; null iff it has no guides.`
    And `packages/project-model/src/program/types.ts` (line 126) already specifies:
    > `entryStopId is null exactly when stops is empty: an empty program is explicit rather than a program with a dangling entry.`
  - This means **F.2 and `ExecutionProgram@1` were already designed at the type level to admit a Guide-free / Zero-Stop Experience (`entryGuideId: null`, `stops: []`, `entryStopId: null`, `presentations: [...]`)!** Research 6's "Publishable Free-Roam Experience" requires **zero breaking schema changes** to `Experience` or `ExecutionProgram@1`—only runtime/preview controller wiring in `T3.P02` and `T4.P01`.

---

## 5. Independent Improvements (Stronger Alternatives)

Drawing together the best insights of Research 6 with Biskiq's landed F.1–F.5 architecture, the following **four improvements** outperform both raw Research 6 and the unamended roadmap across **Novice Success**, **Expert Continuity**, **Revision Preservation**, and **Long-Term Extensibility**:

### 5.1 Proposal I-1: Cached World Transform + Optional `SurfaceAnchor` on `SceneEntity` (Zero Visitor Overhead, Full Revision Continuity)

- **Problem:** In `T2.P01`, floor support is consulted only during the placement gesture; the resulting `SceneEntity` stores only world-local `position: Vec3` and `rotation: Vec3`. If the creator later moves a Room, shifts a Wall, or changes a Floor datum in `T1`, placed objects stay frozen at their old world coordinates—floating in mid-air or embedded inside walls. Conversely, resolving relative transforms at visitor runtime (as legacy `roomId` did before PR #115) violates Biskiq's world-local runtime simplicity.
- **Stronger Alternative:**  
  In the post-cutover Scene unit (`CameraFreeSceneDocument`), keep `position: Vec3` and `rotation: Vec3` as **authoritative runtime-final world-local coordinates** (so Visitor and Preview never compute host frame math), and add an optional authored **`anchor?: SceneSurfaceAnchor`**:
  ```ts
  export type SceneSurfaceAnchor = {
    readonly hostFrame: FrameReference; // F.1 owner-frame (e.g., Layout room floor or oriented wall face)
    readonly surface: PlacementSurface; // 'floor' | 'wall' | 'ceiling' | 'surface'
    readonly localPosition: Vec3;       // (u, v, normalOffset) in host surface frame
    readonly localYaw: number;
  };
  ```
  When a Layout intent is accepted in F.4, an editor-side reconciliation pass checks all `SceneEntity` records with an `anchor`:
  1. If `hostFrame` still resolves and the object's footprint fits within the updated surface bounds → **automatically update `position`/`rotation` in the same compound F.4 acceptance** and mark **`Preserved`**.
  2. If `hostFrame` resolves but the footprint now overhangs the shortened wall/room or collides with an opening → update `position`/`rotation` (or hold last valid world pose) and emit a **`Needs Review` (`CompositionalAdvisory`)** badge.
  3. If `hostFrame` was deleted (`removed`) → keep the last known world `position`/`rotation` so the object doesn't vanish from the stage, transition the anchor to **`Unresolved` (`UnresolvedBinding`)**, and offer one-click `Re-host` or `Detach to World`.
- **Why It Outperforms:** Gives novices and experts effortless revision survival when reshaping rooms/walls while keeping visitor runtime 100% flat, world-local, and zero-cost.

### 5.2 Proposal I-2: Prioritize 2D Wall-Work (`PlacementSurface: 'wall'`) Immediately After or Alongside K1 (Single-Model GLB)

- **Problem:** Biskiq's primary creative audiences (visual artists, photographers, exhibition designers, museum curators, spatial portfolio creators) overwhelmingly curate **2D framed works, photographs, canvases, and wall text panels** alongside 3D sculptures/furniture. Currently, `T2.P01` only admits upright floor primitives/models (`PlacementSurface: 'floor'`), and K1 is scoped solely to single-model 3D GLB import. A creator with 10 photographs cannot hang a single image on a wall!
- **Stronger Alternative:**  
  Pair T1's oriented Wall-face `FrameResolver` with a **Wall-Mounted Artwork / Plane Placement capability (`PlacementSurface: 'wall'`)** immediately following `T2.P01` (either as part of the K1 asset phase or as an immediately adjacent parallel T2 slice). An uploaded image (PNG/JPG/WebP) or plane primitive with an aspect-ratio-locked frame preset (`back-center` contact, $d_{\text{offset}}$ from wall interior face, default eye-level datum $1.50\text{ m}$) uses the exact same `NormalizedPlacementDefinition` pipeline (`packages/project-model/src/scene-planning/types.ts`) already built in `T2.P01.S01`.
- **Why It Outperforms:** Unlocks the complete "First-Day Creator Journey" (hang 10 works on gallery walls + place 1 floor sculpture) with a fraction of the engineering complexity of multi-asset 3D GLB hierarchies or procedural alignment rails.

### 5.3 Proposal I-3: First-Class Zero-Stop `ExecutionProgram@1` ("Free-Roam + Ambient Presentations") & Default Architectural Wash

- **Problem:** If a creator builds a room and places artworks in `World` mode, switching to `Experience` Preview or clicking `Publish` should never fail or show an empty black room simply because they haven't authored a linear `Guide` of `Stops` or manually placed 3D light entities.
- **Stronger Alternative:**
  1. **Default Architectural Illumination:** In Stage/Visitor rendering, when a Room or Scene has no explicit authored `SceneLightEntity` override, apply a deterministic **"Balanced Gallery Wash"** default (hemispheric sky/ground fill + soft directional sun/skylight aligned to Room enclosure bounds) rather than unlit or harsh debug lighting.
  2. **Zero-Stop Free-Roam Program Lowering:** Lower an Experience with `guides: []` / `stops: []` into a valid `ExecutionProgram@1` (`entryStopId: null`, `stops: []`, `presentations: [...]`). When Preview (`T3.P02`) or Visitor (`T4.P01`) boots an `ExecutionProgram@1` with `entryStopId: null`:
     - Camera boots in `FreeController` mode (`packages/camera-core/src/experience-controllers.ts`) at an automatically derived entry vantage (or the first `ProgramPresentation` view if one exists).
     - Any authored `ProgramPresentation`s remain clickable/discoverable in the space and accessible via `semanticDomNavigation: 'required'` (Next/Previous Presentation card in DOM order), giving visitors full accessibility and placard reading even in a pure Free-Roam gallery.
- **Why It Outperforms:** Achieves Research 6's Subtraction Baseline using **already-landed `ExecutionProgram@1` and `FreeController` types** with zero new runtime authorities.

### 5.4 Proposal I-4: Represent Environmental Looks & Entity States as Declarative F.3 Channel Presets (`resource:look-preset`, `resource:state-preset`)

- **Problem:** Research 6 proposes adding `Environmental Looks`, `Entity Poses`, and `Performance Clips` to `SceneDocument`, and `UI Component Variants` to `ExperienceDocument`, coordinated by a new "Priority-Latching State Arbitration" engine. That would duplicate F.3's channel negotiation engine (`packages/project-model/src/channels/negotiate.ts`).
- **Stronger Alternative:**  
  Model a **Look Preset** or **Entity State** as a declarative bundle of F.3 `ChannelContribution` templates stored in `units.resources` (`TypedResource`), targeting declared F.3 `ChannelFamily` properties (`scene.environment@1`, `scene.entity-transform@1`, `scene.light@1`, `experience.presentation@1`).
  - Activating a Look in `World` sets the authored baseline; activating a Look or State on a `Stop` (`onEnter` / `onArrival`) submits an F.3 `ChannelContribution` scoped to that invocation's `invocationId` and `runEpoch`.
  - F.3's existing `negotiateChannelContribution` (`packages/project-model/src/channels/negotiate.ts`) automatically arbitrates conflicts and generates creator-facing `ChannelDiagnostic` messages ("Stop 2 and Inspection both control Cabinet Door").
- **Why It Outperforms:** Eliminates an entire redundant state-arbitration subsystem proposed in Research 6 by leveraging the F.3 channel engine that Biskiq already built and tested in `T1.P01.S01` and `T3.P01.S06`.

---

## 6. Recommended Execution Sequence

### 6.1 Do Now (No Change to Active Authorizations — Finish `Core Editor Stability` Spine)

1. **Execute authorized Batch B work (`T2.P01.S03`)** — first coherent Stage editing surface for floor-supported objects (`docs/reference/decisions/batch-b-authorization-2026-10-17.md`).
2. **Complete `T3.P01.S04` preflight & authorization** — resolve the 6 preflight items in `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/preflight/`, execute live ownership cutover to `ProjectEnvelope`, and ratify `T3.camera-experience-cutover@1`.
3. **Close `T1.P01` (`S05` straight-Wall manipulation + `S06` final gate) and `T2.P01` (`S04` bounded composition loop + final gate)** — using the newly landed Head Save (`T1.P01.S04`, PR #148).

### 6.2 Immediate Post-Cutover Wave (Completing `Core Editor Stability` + High-Leverage R6 Refinements)

1. **`T3.P02` (First Capture & Cut Preview over `ExecutionProgram@1`):**
   - Include **Proposal I-3 (Zero-Stop Free-Roam Preview fallback)** so any world can be previewed immediately in `Experience` mode even before a `Guide` is sequenced.
2. **`T1` Next Phase (K3: Straight-Wall Creation + Derived Wall-Role Cutover):**
   - Include **F.1 `FrameResolver`s for Room Floor and Oriented Wall-Face frames** so T2 can anchor wall and floor works against real architectural identities.
3. **`T2` Next Phase (K1: Single-Model GLB Import + Pre-Flight Asset Readiness):**
   - Incorporate Research 6's **Pre-Flight Asset Readiness Check (`Ready | Needs Repair | Blocked`)** producing verified `NormalizedPlacementDefinition` metadata (`footprintMeters`, `contactMinY`, `renderNormalization`).
   - **Recommended addition (subject to OD-R6-2):** Pair or immediately follow K1 with **2D Wall-Work / Framed Image placement (`PlacementSurface: 'wall'`)**.

### 6.3 Parallelizable Design & Contract Work (Can Proceed Without Blocking Code Slices)

1. **Draft the `CompositionalAdvisory` (`Needs Review`) specification** as a small additive amendment (`AM-9`) to [`docs/reference/composition-execution.md`](../docs/reference/composition-execution.md) (see **OD-R6-1**), defining the exact boundary between `CorrespondenceEntry` (`Preserved`), `CompositionalAdvisory` (`Needs Review`), and `UnresolvedBinding` (`Unresolved`).
2. **Draft `F5.release-envelope` for `T4.P01`** (preparing for post-stability T4 activation under Ruling R1-D), incorporating the three-tier publication gate (`Unresolved` blocks; `Needs Review` warns with creator acknowledgment; `Preserved` passes) and Zero-Stop Free-Roam release support.

### 6.4 Await UX Evidence (Prototype / Paper Validation Before Schema Lock)

1. **`Collection-first` Staging Tray & `Story-first` Unbound Presentation Strip:** Validate the Paper/Conservatory shelf ergonomics for staging unplaced assets and unbound Presentations before adding new editor session state.
2. **Host-Relative Surface Anchor Repair Cards (`Re-host` / `Detach to World` / `Nudge into Bounds`):** Validate how `Needs Review` and `Unresolved` badges appear in the Paper Outliner and Inspector without creating visual clutter during rapid wall dragging.
3. **Tier 2 Scenographic Recipes** (e.g., *Picture Wall Hang*, *Pedestal + Spotlight*): Validate in prototype/UX testing once single floor and wall placements are solid.

### 6.5 Explicitly Deferred (Post-v1 / Horizon Capabilities)

1. **Dual-Skin Overhead Shells ($\Sigma_{\text{ext}}, \Sigma_{\text{int}}$), Straight-Skeleton Roofs, and CSG Void Prisms** (T1 horizon).
2. **Persistent Multi-Asset `AlignmentRail` Constraint Solvers** (use transient alignment assists first; defer persistent rail entities).
3. **Parametric Kinematic Rigs (`hinge`, `slider`, `turntable`) and Baked GLB Animation Clip Scrubber** (defer until `resource:state-preset` / `resource:clip` phases).
4. **3D Diegetic Mesh Callout Pins** (keep visitor cards and callouts in semantic DOM overlay per Conservatory #114 §0.8.1 and `semanticDomNavigation: 'required'`).

---

## 7. Owner Decision Requests

Only the following **five decisions** require explicit owner judgment; all other Research 6 items are resolved by existing ratifications.

### OD-R6-1: Formalize `Needs Review` (`CompositionalAdvisory`) alongside `Preserved` and `Unresolved`?

- **Context:** F.1/F.2/F.4 currently represent only binary resolution (`resolved`/`preserved` vs. `failed`/`UnresolvedBinding`). Research 6 proposes a middle tier—**`Needs Review`**—when an entity's host reference resolves after a revision, but its spatial or framing invariants (e.g., wall/floor footprint containment, opening overlap, camera sightline) are violated.
- **Options:**
  1. **(Recommended) Adopt `Needs Review` as a non-blocking `CompositionalAdvisory` diagnostic** (via `AM-9` to `docs/reference/composition-execution.md`) that never blocks F.4 acceptance or Preview, and surfaces as an acknowledgeable warning in F.5 Publication while keeping `UnresolvedBinding` as a hard F.5 blocker.
  2. **Status Quo (Binary only):** Treat footprint overhangs or sightline occlusions either as silent `Preserved` states or as hard `repair-required` failures.
- **Consequence of doing nothing:** Either creators receive zero warning when a wall edit leaves paintings hanging off a wall edge, or minor spatial overlaps are treated as broken references that block publication.

### OD-R6-2: Sequence 2D Wall-Mounted Artwork (`PlacementSurface: 'wall'`) alongside or immediately after K1 (Single-Model GLB Import)?

- **Context:** Ruling K1 (`docs/reference/decisions/next-batch-authorization-2026-10-17.md`) scopes T2's next post-`T2.P01` phase to bounded single-model 3D GLB import on floors. Research 6's canonical creator journey (10 photographs + 1 sculpture) demonstrates that wall-mounted 2D images/frames are essential for spatial portfolios and exhibitions.
- **Options:**
  1. **(Recommended) Keep `T2.P01` unchanged, and add a bounded `PlacementSurface: 'wall'` (2D image/frame on T1 Wall face) slice immediately following (or paired with) K1**, backed by T1's oriented Wall-face `FrameResolver`.
  2. **Expand K1 now** to require both 3D GLB floor import and 2D image wall placement in a single slice.
  3. **Defer wall placement** until after all 3D floor-object and lighting phases complete.
- **Consequence of doing nothing:** After `Core Editor Stability` and K1, creators will be able to place 3D GLBs on the floor, but still will not be able to hang a photograph, painting, or text panel on a gallery wall.

### OD-R6-3: Ratify the "Zero-Stop Free-Roam Experience" & Default Room Illumination Baseline?

- **Context:** Research 6 proposes that any space with placed works should be immediately previewable and publishable as a Free-Roam Experience without authoring a `Guide` or `Stops`, and should render with a balanced architectural illumination default without manual 3D light placement. `ExecutionProgram@1` already supports `stops: []` and `entryStopId: null`.
- **Options:**
  1. **(Recommended) Adopt the Subtraction Baseline for `T3.P02` and `T4.P01`:** When an Experience has `stops: []` (`entryStopId: null`), Preview (`T3.P02`) and Prepared Release (`T4.P01`) launch in `FreeController` mode with semantic DOM access to any placed `Presentation`s, and scenes with zero authored lights use a deterministic default gallery wash.
  2. **Require at least one authored `Stop` and `Guide`** before Preview or Publication is enabled.
- **Consequence of doing nothing:** Novices who build a room and place works will hit a "nothing to preview / cannot publish without a Guide" wall, violating convergent creation.

### OD-R6-4: Adopt Host-Relative `SceneSurfaceAnchor` in Post-Cutover T2 (Scene Unit v2/v3)?

- **Context:** `T2.P01` uses Floor support only as a transient placement assist, committing static world-local `Vec3` coordinates. Research 6 recommends persisting host-relative surface anchors so placed works ride Wall/Room moves and report `Needs Review` / `Unresolved` on topology edits.
- **Options:**
  1. **(Recommended) Keep `T2.P01` as world-local `Vec3` commit (no change to `T2.P01.S03`/`S04`), and schedule optional `anchor?: SceneSurfaceAnchor` (backed by F.1 `FrameReference` + cached world-local `position`/`rotation`) in the post-cutover T2 roadmap.**
  2. **Keep all Scene placements permanently as unanchored world-local coordinates** and rely solely on manual multi-select moves when walls/rooms change.
- **Consequence of doing nothing:** Resizing a room or moving a wall in T1 will leave wall-hung paintings floating in mid-air or buried inside walls, breaking iterative spatial design.

### OD-R6-5: Confirm Rejection of `SceneDocument` State/Look Storage and Standalone `Cue Stacks`?

- **Context:** Research 6 places `Entity Poses`, `Performance Clips`, and `Environmental Looks` inside `SceneDocument` and re-introduces Study 3's `Zones/Stops` + `Vertical Cue Stacks`. This conflicts with Biskiq's ratified F.2/F.3 architecture (`TypedResource` + `ChannelContribution`) and Conservatory #114 §0.8.1 (`Presentation` vs. `Stop`, no standalone Cue timeline).
- **Options:**
  1. **(Recommended) Reaffirm Biskiq's ratified boundaries:** Keep reusable states, looks, and clips in `units.resources` (`TypedResource`) evaluated via F.3 `ChannelContribution`s; keep `Presentation` vs. `Stop` vs. `Guide` in `Experience`; and require compile-time lowering of any "visited/inspected" lookback conditions into explicit `ProgramStateDeclaration`s.
  2. **Amend F.2 and Conservatory #114** to move states/looks into `SceneDocument` and add a standalone Cue stack to `Experience`.
- **Consequence of doing nothing:** Ambiguity between Research 6's tables and `docs/reference/composition-execution.md` could lead future T2/T3 slice authors to put state/look tables inside `CameraFreeSceneDocument` or re-introduce a competing timeline in Experience.
