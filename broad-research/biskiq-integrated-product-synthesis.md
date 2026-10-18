---
kind: integrated product research synthesis
source: "Research 6 revised synthesis, supplied 2026-10-18; editorially normalized from the supplied text"
status: "research input, not a product contract or routed authority; docs/README.md and docs/reference/ govern product truth"
contents: "6 sections, cross-study reconciliation, creator journeys, seam ledger, and design/architecture handoffs"
editorial_scope: "Markdown table repair; truncated B3 restored from earlier research discussion; limited clarity and evidence-qualification edits"
visuals: "No interactive charts or figure assets were present in this revised text export. Companion HTML is not implied by this Markdown."
---

> **Status and provenance:** This is the revised Research 6 synthesis, not a ratified architecture or a description of shipped features. The original pasted export contained malformed multi-line Markdown tables and a truncated B3 entry. This copy repairs those defects and makes bounded editorial qualifications. Specific quantitative findings remain attributable to the five underlying studies, not independently validated here. See [research sources](#research-sources-and-evidence-trail).

# Biskiq Integrated Product Synthesis and Future Capability Foundations (Revised)

## 1. Integrated Product Thesis & Evidentiary Discipline

### The Scenographic Medium and the Project as the Creator's Unit

Biskiq is a standalone, designer-first creative environment for building expressive three-dimensional spaces and publishing interactive visitor experiences. Current spatial software splits into two extremes that force creators to trade ease of use for expressive depth:

* **Template-bound virtual tour utilities** (such as Matterport, Artsteps, Kunstmatrix, and FlipHTML5 ExhVerse) allow setup in 15 to 30 minutes, but lock creators into static white-cube rooms with rigid user-interface chrome and flat 2D information pop-ups.

* **Technical 3D suites, BIM tools, and game engines** (such as Blender, Autodesk Revit, Graphisoft Archicad, and Unreal Engine) provide deep geometric and behavioral control, but require users to work directly with 6-DoF coordinate gizmos, UV unwrapping seams, mathematical view-range dialogs, and node-based visual scripting graphs.

Biskiq bridges this gap as an **intent-driven scenographic medium**. In physical exhibition design, architecture, lighting, object staging, and narrative pacing work together to shape how a visitor experiences a space. Biskiq brings this craft into a digital workflow where creators express spatial and editorial intent directly—shaping ceiling volumes, arranging collections along alignment rails, aiming lighting on subjects, and tying presentation shifts to visitor movement or spoken narration—while the engine handles manifold geometry, relative spatial anchoring, and isolated runtime execution under the hood.

To keep underlying system boundaries from burdening beginners, creators experience Biskiq at the top level as a unified **Project** rather than manually assembling separate `LayoutDocument`, `SceneDocument`, `Camera`, and `ExperienceDocument` files. This is a conceptual creator-experience principle rather than a rigid serialization invariant:

* **Flexible Authoring States**: A Project does not require both a completed `World` and an `Experience` to exist at every moment of authoring. A creator may build an unpublished architectural `World`, stage imported assets in an unplaced **Project Library / Staging Tray**, or outline an `Experience` before spatial geometry is finished.

* **Publication Requirement**: While unfinished states are valid during authoring, publishing a live release requires a valid visitor-facing `Experience`—which natively includes **self-directed free-roam exploration** with zero mandatory tour stops, guides, or timelines.

---

### Evidentiary Discipline: Separating Established Evidence from Hypotheses

To avoid overstating technical or UX certainty, consequential claims across this synthesis are categorized into five distinct evidentiary tiers:

| Evidentiary Tier | Scope & Meaning in This Synthesis | Representative Examples |
| --- | --- | --- |
| **1. Observed Evidence (Established Sources)** | Empirical measurements from peer-reviewed literature, academic workflow studies, or hardware rendering benchmarks. | Smith & Smith (2001) physical museum dwell times ($17\text{ s}$ median, $27\text{ s}$ mean, right-skewed distribution); visitor reading affinity splits ($40.4\%$ medium, $34.0\%$ low, $25.5\%$ high); AUC Rhino-to-Revit mass conversion failure rate ($79.9\%$); PushPull++ operation reduction (up to $10\times$); unculled DOM label layout bottleneck ($>50$ elements at $60\text{ fps}$). |
| **2. Reasonable Inference** | Conclusions drawn directly from primary evidence without claiming direct measurement in Biskiq. | Because visitor reading affinities vary widely and museum label density shifts by mission ($3\text{–}5$ labels per $100\text{ m}^2$ in fine art vs. $15\text{–}25$ in science museums), Biskiq must support progressive multi-tier content rather than one-size-fits-all text modals. |
| **3. Design Hypothesis (Requires Validation)** | Proposed workflows, comparative direction rankings, and onboarding timing targets that must be tested with creators. | Comparative capability scores across Directions I–IV; target onboarding milestones; whether contextual cross-domain tools cause fewer interruptions than top-level lens switches; and when creators prefer 2D Plan over 3D Perspective. |
| **4. Implementation-Dependent Assumption** | Engineering strategies whose actual performance or visual quality depends on concrete runtime and shader choices. | Using a default Room Illumination Look for low-cost baseline lighting; specific DOM pooling thresholds ($<50$ nodes) and MSDF text sprite handoffs; automatic texture compression (KTX2) and LOD generation during asset import. |
| **5. Existing Ratified Biskiq Contract** | Architectural boundaries already established as Biskiq's working foundation or ratified destination direction. | Rooms derived from walls in `LayoutDocument`; `SceneDocument` ownership of staged content; a single `Camera` authority; the `World \| Experience` dual-lens Conservatory shell; common composition/execution contracts; and immutable published releases. > **Note on Secondary Commercial Figures**: Commonly cited commercial projections—such as a 58.8% virtual dwell-time lift (which confuses physical median and mean figures), a USD 118.79B market size, a 25% engagement lift, or a 45%-to-61% comprehension jump—are secondary commercial commentary and are excluded as primary justification for Biskiq's architecture. > > |

---

### Architectural Authorities, Semantic Ownership, and Continuity Mandates

Biskiq's architecture separates **implemented foundations** (`LayoutDocument`, `SceneDocument`, and the single `Camera` authority) from **ratified destination directions** (`ExperienceDocument`, the `World | Experience` Conservatory shell, and common composition/execution contracts).

| Architectural Authority | Status | Canonical Semantic Ownership | Non-Negotiable Continuity Guarantees |
| --- | --- | --- | --- |
| **Architectural Layout (`LayoutDocument`)** | Implemented foundation; multi-level horizons & dual-skin shells in research synthesis | Owns spatial horizons, walls, openings, and vertical voids; **rooms are derived from closed wall topology**, never independent competing room-boxes. | Source-to-derived provenance for walls, derived rooms, and shell faces; room-local origins; associative wall-to-ceiling trimming. |
| **Scene Composition (`SceneDocument`)** | Implemented foundation; surface stack, optics & scoped capabilities in research synthesis | Owns staged 3D objects, placements, triplanar material stacks, lighting rigs, semantic attachment pins/sockets, intrinsic object metadata, and **scoped scene capabilities (Entity Poses, Performance Clips, and Environmental Looks)**. | Explicit spatial anchoring (world, room-local, surface, or socket); deterministic operation history; zero runtime mutation of authored truth. |
| **Camera Authority (`Camera`)** | Ratified single authority | Exclusively owns viewpoint, projection state (perspective vs. orthographic), section/clipping planes, navigation modes, and motion trajectories. | Both `World` workbenches and `Experience` tours reference `Camera` Views and Routes by ID rather than duplicating camera controllers. |
| **Visitor Experience (`ExperienceDocument`)** | Ratified destination direction | Owns audience-specific interpretation, Presentations, optional Guides/Stops, Scenographic Cue Stacks, timing anchors, session state conditions, UI Component Variants, and Tri-Modal UI attachments. | Many-to-one relationship with `World` (one `World` can support multiple `Experiences`); activates `World` capabilities non-destructively. |
| **Conservatory Workspace Shell** | Ratified destination UX direction | Organizes creator interaction across **World \| Experience** lenses using four coordinated surfaces: **Stage**, **Index**, **Card**, and **Instruments**, plus task-driven projection workbenches. | *Complexity available, not obligatory*; humans and future AI agents execute changes through the same validated semantic operation bus. |
| **Visitor Execution Runtime** | Ratified isolation contract | Executes camera transitions, capability activations, ephemeral session state, and hybrid DOM/WebGL UI rendering. | Strict isolation from authoring state; exiting Visitor Preview discards ephemeral session state without altering authored properties. Biskiq evaluates product decisions against four core continuity standards: 1. **Novice Success (The Subtraction Baseline)**: A beginner can create and publish a meaningful, personally authored spatial experience within one day without encountering unrelated expert tools. Free-roam exploration (with zero Guides, Stops, or timelines) is a complete, first-class publishable outcome, and intelligent defaults must remain understandable, inspectable, and replaceable. 2. **Expert Continuity**: That same project scales progressively to multi-story split-level architecture, dual-skin roofs and ceilings, unrolled wall elevations, four-shutter optical framing, multi-part object poses, and responsive UI component variants without switching applications or abandoning earlier work. 3. **Revision Continuity**: Structural edits distinguish **spatial anchoring**, **transient placement assists**, and **persistent authored relationships**, triaging downstream impacts honestly into **`Preserved`**, **`Needs Review`**, and **`Unresolved`** outcomes rather than silently breaking or guessing creator intent. 4. **Credible Extensibility**: Foundational seams protect future capabilities—including animation, asset replacement, multi-role workflows, and bounded runtime behaviors—without prematurely building a game engine, CAD kernel, or web IDE. |

---

## 2. Cross-Research Reconciliation & Scope Boundaries

### Resolving Five Cross-Domain Architectural Contradictions

1. **Room Topology vs. Volumetric Massing (`LayoutDocument`)**:
* *The Conflict*: Study 1 proposed independent "Hollow 3D Volumetric Room-Blocks" with a CSG solver, while Study 4 proposed freestanding "Dual-Surface Parametric Shells" ($\mathcal{S} = \{\Sigma_{\text{ext}}, \Sigma_{\text{int}}, \mathcal{B}\}$) and Womp-style "Implicit SDF Goop Cutters". Independent 3D room-boxes conflict with `LayoutDocument`'s ratified rule that rooms are derived from walls, and full-building SDF evaluation rounds off crisp architectural corners and breaks planar wall UV parameterization.

* *The Resolution*: Retain wall-derived room topology via **Horizon-Anchored Wall Loops with Derived Room Envelopes**. Closed walls drawn on an **Elastic Horizon** ($Z_{\text{horizon}}$) automatically derive a room polygon with independent local vertical offsets ($\Delta Z_{\text{floor}}$ for sunken pits or raised platforms and $H_{\text{ceiling}}$ for room height) and seed a coupled **Dual-Skin Overhead Shell** ($\Sigma_{\text{ext}}, \Sigma_{\text{int}}$) bound to the wall-top boundary loop $\mathcal{B}$. Open colonnades or freestanding courtyard canopies use **Open Architectural Boundary Loops ($\mathcal{B}$)** on columns, while multi-level atriums and light shafts use **Architectural Void Prisms** (subtractive polyline/cylindrical cutters) rather than full-building SDFs.

2. **Surface Materiality (`World`) vs. Interpretive Typography (`Experience`)**:
* *The Conflict*: Study 2 placed exhibition titles and wayfinding vinyl inside `SceneDocument`'s **3-Tier Surface Stack**, whereas Study 5 assigned section text, group labels, and Dry-Transfer wall typography to `Experience`. Baking exhibition text into `SceneDocument` wall materials prevents a single `World` from hosting multiple `Experiences` (such as a curatorial tour, a student inquiry activity, or a localized language edition).

* *The Resolution*: `SceneDocument` (`World`) owns the **3-Tier Architectural Surface Stack** for physical materiality (Tier 1: World-Scale Triplanar Base; Tier 2: Procedural Relief & Trim; Tier 3: Permanent Patina & Architectural Murals), alongside each artifact's intrinsic catalog facts and a default **Spatial Attachment Socket**. `ExperienceDocument` (`Experience`) owns all audience-facing interpretive text, labels, and wayfinding, binding them non-destructively to `World` sockets or wall rails.

3. **Scoped Capabilities vs. Competing State Systems**:
* *The Conflict*: Study 2 proposed a Look-Dev State Ribbon for material/lighting moods, Study 3 proposed Object Poses and Environmental Looks, and Study 5 proposed UI component variants. Merging all of these into a single untyped state primitive obscures their differences in ownership, scope, and lifecycle.

* *The Resolution*: Align state composition directly with Biskiq's ratified common composition/execution contract through **Typed, Domain-Scoped Capabilities**:
* **Intrinsic Asset Capabilities (`SceneDocument`)**: Scoped to an individual asset or assembly, including discrete **Entity Poses** (sub-part transform/material deltas) and normalized **Performance Clips** ($t \in [0, 1]$).

* **Scoped Environmental Looks (`SceneDocument`)**: Scoped to a Zone, Room, or World, capturing lighting parameters, optical shutter masks, and atmospheric settings.

* **Interface Component Variants (`ExperienceDocument`)**: Scoped to visitor-facing UI layouts and interactive cards.

* **Presentation Activation & Ephemeral Session State (`ExperienceDocument` + Runtime)**: `Experience` controls *when* and *how* Poses, Looks, Clips, and UI Variants are activated during a visitor session without mutating base `World` data.

4. **Deterministic Placement vs. Runtime Simulation**:
* *The Conflict*: Continuous rigid-body physics in the scene editor risks disturbing settled objects and introducing cross-device floating-point drift, while permanently banning visitor-side dynamics would block future kinetic or responsive artworks.

* *The Resolution*: Separate execution across four distinct boundaries:
* **Authoring Placement**: Strictly deterministic and reversible; transient collision assist (`Multi-Drop`, surface tangency) acts only on the actively dragged selection during the gesture and commits static coordinates on release.

* **Authoring Simulation**: Bounded editor simulation (`Physics Bake Mode`) that records trajectories into deterministic, scrubbable clips.

* **Reusable Animation**: Self-contained clips invoked and scrubbed by `Experience` cues.

* **Future Runtime Behavior**: Preserve an architectural seam in the isolated runtime evaluation layer so future bounded, ephemeral reactive behaviors (such as proximity-responsive installations or kinetic sculptures) can execute without mutating authored truth or bypassing the common composition system.

5. **Representation Continuity vs. Viewport Clutter**:
* *The Conflict*: Displaying multi-floor Red/Blue plan traces, roof Spine/Eave spheres, curatorial rails, optical shutters, floor threshold rings, and 2.5D UI tethers simultaneously would crowd the viewport.

* *The Resolution*: Separate **`Camera` Authority** (which owns viewpoint, projection matrix, clipping planes, and motion interpolation) from **UX Workbench Presentation** (which governs active projection lenses, coordinate mapping, and single-domain gizmo visibility). Inactive floor traces filter out furniture and lighting icons, shell handles appear only in Shell Focus Mode, and narrative threshold rings appear only in `Experience`.

---

### Addressing Two Critical Blind Spots: Asset Readiness & Multi-Role Alignment

Beyond the five original domain studies, product synthesis must account for two practical realities of spatial creation:

1. **Real-World Asset Ingestion, Readiness & Replacement**:
* Creators frequently import unoptimized photogrammetry scans, monolithic meshes lacking articulated sub-parts, or oversized textures rather than clean, pre-segmented 3D assets. If an imported model is a single static mesh, sub-mesh articulation (`Pose-in-Place` disassembly) is impossible without external re-authoring.

* Biskiq requires an **Asset Readiness & Provenance Pipeline** that inspects imported assets, reports capability compatibility (e.g., whether movable sub-parts exist vs. a static mesh) and resource budgets, and applies replaceable engineering optimizations (such as background texture compression and LOD generation) while alerting the creator when source quality or structure requires compromise.
* Furthermore, Biskiq must distinguish four separate concepts: **imported source assets** (the raw file/resource), **reusable definitions**, **placed scene instances**, and **semantic attachment points** (user-authored pins or sockets placed on an instance's bounds or surface). Replacing a source asset with a revised or decimated mesh cannot rely on a wrapper UUID alone to guarantee geometric validity; when an asset update alters geometry or removes sub-parts referenced by pins, poses, or cues, the system flags affected attachments as `Needs Review` or `Unresolved` for explicit repair.

2. **Multi-Role Workflow Alignment Across `World | Experience`**:
* Separating `World` (spatial architecture, staging, and lighting) from `Experience` (interpretation, narrative pacing, and visitor UI) naturally mirrors how real-world teams divide work between spatial designers and curators, writers, educators, or translators.

* However, **workspace lens visibility is not a security or permissions boundary**: a creator in the `Experience` lens can still invoke contextual tools like `Pose-in-Place` or save `Camera` views that touch shared resources. While real-time multi-user collaboration and role-based access control are deferred beyond initial scope, tagging every semantic command with its owning domain authority (`Layout`, `Scene`, `Camera`, `Experience`) establishes the foundational seam needed for future role-restricted workflows.

---

### Selective Depth: What Biskiq Deliberately Refuses to Become

Maintaining a high creative ceiling without turning Biskiq into a bloated generalist suite requires explicit scope boundaries:

| Adjacent Category | What Biskiq Owns Natively (Selective Depth) | What Biskiq Imports or Integrates | Excluded from Foreseeable Native Scope |
| --- | --- | --- | --- |
| **3D Modeling & DCC** *(Blender, Maya, Rhino)*<br> | Horizon wall loops, openings, Dual-Skin roofs/ceilings, Void Prisms, and simple exhibition plinth/vitrine primitives. | Imports `.glb/.gltf` meshes, photogrammetry scans, PBR materials, and pre-authored skeletal/keyframe clips. | General polygon/vertex modeling, UV unwrapping, NURBS surface kernels, and **general-purpose SDF statue sculpting** (dropping Seam C3's liquid-clay artifact studio while preserving bounded procedural spatial shaping). |
| **BIM & Construction CAD** *(Revit, Archicad)*<br> | Multi-level Elastic Horizons, split-level floors, stairs/balustrades, and atmospheric spatial envelopes. | Imports 2D reference floor plans (SVG/DXF/images) and architectural shells for tracing or staging. | Structural engineering analysis, MEP/HVAC routing, and construction blueprint documentation. |
| **Game Engines** *(Unreal, Unity)*<br> | Scenographic zones, guided/free-roam camera choreography, declarative Cue Stacks, and session progress conditions. | Preserves an execution seam for future bounded, pre-packaged reactive behaviors in the isolated runtime layer. | General-purpose game loops, combat/inventory mechanics, multiplayer netcode, and node-based visual scripting graphs. |
| **Character & Timeline Animation** *(After Effects, C4D)*<br> | Discrete Entity Poses, smooth Pose-to-Pose transitions, and triggering/scrubbing clips via cues or transcripts. | Plays embedded GLTF animation clips authored in external tools. | Multi-track keyframe dope sheets, F-curve graph editors, and character rigging studios. |
| **Web Interface IDEs** *(Figma, Framer, Webflow)*<br> | Scenographic typography hierarchies, Tri-Modal spatial projection (`Surface`, `Tether`, `Screen`), and structured content cards. | Binds to structured datasets (CSV/JSON) and theme tokens. | Freeform CSS flexbox/grid layout engines and general vector illustration tools. |

---

### Cross-Research Reconciliation Ledger

| Research Domain & Proposal | Disposition | Reconciled Product & Architectural Path |
| --- | --- | --- |
| **Study 1: Elastic Reference Horizons & Chromatic Overlays**<br> | **Retain** | Supports multi-level alignment via Red (below), Black (active), and Blue (above) plan traces with semantic LOD filtering. |
| **Study 1: Selective Shell Clipping & Poché Caps**<br> | **Retain** | Clips upper architectural shells with dark silhouetted caps while keeping stairs, ramps, and tall installations unclipped (`Clip Participation: Exclude`). |
| **Study 1: Independent 3D Room-Boxes & CSG Solver**<br> | **Transform** | Transformed into **Wall-Derived Rooms with Local Vertical Offsets** ($\Delta Z_{\text{floor}}, H_{\text{ceiling}}$) on Elastic Horizons to preserve `LayoutDocument`'s wall-derived room invariant. |
| **Study 4: Dual-Skin Elastic Shell ($\Sigma_{\text{ext}}, \Sigma_{\text{int}}, \mathcal{B}$)**<br> | **Retain & Combine** | Integrates straight-skeleton eave/spine handles, on-surface rib lofting, and interior ceiling unzip into `LayoutDocument` room caps. |
| **Study 4: PushPull++ Stepwise Planar Adaptation**<br> | **Retain** | Maintains face planarity via triple-plane intersection and reports explicit topological split/collapse states at change points ($\tau \pm \varepsilon$). |
| **Study 4 & Study 2: Implicit SDF "Goop" Massing & Pedestal Studio**<br> | **Transform & Exclude** | Carve architectural atriums/lightwells via **Parametric Void Prisms**; **exclude** general-purpose SDF statue sculpting from foreseeable scope in favor of asset import. |
| **Study 2: Unrolled Wall & Orthographic Section Workbenches**<br> | **Retain & Combine** | Task-driven projection workbenches whose viewpoint/projection is governed by `Camera` while UX workbench state is managed by the Conservatory shell. |
| **Study 2: Surface Magnetism, Eye-Line Assists & Alignment Rails**<br> | **Transform** | Strictly separates **transient placement assists** (magnetism, eye-line snapping, `Multi-Drop`) from **persistent authored relationships** (Alignment Rails). |
| **Study 2: 3-Tier Surface Stack & Zone Separators**<br> | **Transform** | Retains Base + Relief + Patina in `SceneDocument`; moves visitor-facing interpretive wall typography to `ExperienceDocument`. |
| **Study 2: Inverse LightPaint & 4-Blade Framing Shutters**<br> | **Retain** | Click-on-subject light targeting and 4-corner shutter cropping in `SceneDocument`, paired with a low-overhead default Room Illumination Look for beginners. |
| **Study 2, 3 & 5: Look-Dev Ribbon, Poses, Looks & UI Variants**<br> | **Transform** | Replaced single monolithic state object with **Scoped Typed Capabilities** (Entity Poses, Performance Clips, Environmental Looks, and UI Variants) aligned with ratified composition contracts. |
| **Study 3: Three-Scale Choreographed Scenography & Elastic Dwell**<br> | **Retain** | Combines Zones/Stops, Vertical Cue Stacks, Transcript Pinning, Pose-in-Place, and Elastic Dwell camera hand-offs; makes Guides/Stops optional so free-roam is first-class. |
| **Study 3: Implicit Epistemic Ledger & Lookback**<br> | **Transform** | Positions implicit visit/inspection counters as an authoring shorthand over a minimal declarative session-state and idempotent cue evaluation contract. |
| **Study 5: Three-Layer Progressive Interface Escalator**<br> | **Retain & Refine** | Scales from Layer 1 Adaptive Visitor Shell to Layer 2 Tri-Modal Projection and Layer 3 reusable UI components; replaces static physical LRV assumptions with rendered-contrast verification and a 2D reader fallback. |

---

## 3. Unified Creative Capability Model & Revision Continuity

### General Creative Foundations with Scenographic Recipes

To serve exhibitions, brand showrooms, architectural presentations, and educational encounters without locking non-museum creators into curatorial jargon, Biskiq separates its capability model into three layers:

1. **General Underlying Concepts**: Core capabilities are framed around domain-inclusive intentions—**spatial containers and envelopes**, **relational surface alignment**, **contextual information attachments**, **target-linked optical lighting**, **reusable appearance and pose states**, and **event/sequence choreography**. *(Specific schema names such as `AlignmentRail`, `InfoCard`, or `CueContainer` are candidate design expressions to be finalized during architecture reconciliation.)*

2. **Approachable Studio Vocabulary**: Default creator-facing controls use plain studio terms—such as **Eye-Line Rail**, **Object Label / Info Card**, **Frame Light / Shutters**, and **Stops / Tour**—rather than academic museology terms like "Tombstone" or "Conservation Profile".

3. **Configurable Scenographic Recipes & Domain Starter Kits**: Physical exhibition heuristics—such as a $150\text{ cm}$ ($60\text{ in}$) eye-line hang height, $30^\circ\text{–}35^\circ$ lighting angles, Smithsonian word-count targets, and conservation lux/kelvin presets—are supplied as **configurable heuristics and optional Domain Starter Kits** (*Museum & Gallery*, *Product Showroom*, *Architectural Walkthrough*, *Educational Inquiry*), never as rigid, unchangeable rules.

Across all domains, instruments follow the progressive philosophy: **Intent $\rightarrow$ Inspectable Default $\rightarrow$ Direct Spatial Refinement $\rightarrow$ Precision Override**. This is a shared product principle rather than a rigid interaction sequence; different creative tasks may use different representations or instruments while ensuring every default remains transparent, inspectable, and replaceable.

---

### Distinguishing Spatial Anchoring, Transient Assists, and Persistent Relationships

A foundational flaw in many 3D tools is either failing to preserve relationships during edits or over-constraining objects when the user only wanted a quick placement helper. Biskiq explicitly separates three mechanisms:

| Mechanism Category | Definition & Creator Intent | Examples in Biskiq | Behavior Under Subsequent Revisions |
| --- | --- | --- | --- |
| **1. Spatial Anchoring** | Where an entity is positioned relative to its owning or host context (or in free-standing world/room space). | Free-standing World/Room placement $(x, y, z)$; wall/ceiling surface-relative placement; parent socket attachment. | Moves deterministically with its host room, surface, or parent socket; reports invalidation if the host surface is deleted. |
| **2. Transient Placement Assistance** | Moment-in-time snapping, collision settling, or suggested alignment active *only during the manipulation gesture*. | Magnetic surface tangency; snapping a single frame to the $150\text{ cm}$ guide line; `Multi-Drop` gravity settling; snapping a stair landing to a chromatic plan trace. | Commits a clean spatial anchor on pointer release without creating a hidden ongoing constraint between neighboring objects. |
| **3. Persistent Authored Relationships** | Explicit ongoing rules declared by the creator that actively maintain alignment, targeting, or synchronization across revisions. | Grouping items on an **Alignment Rail**; aiming a **Target-Linked Light** at an exhibit; binding walls to a **Dual-Skin Shell**; pinning a cue to a **Transcript Phrase**. | Re-evaluates deterministically when targets change and surfaces **`Preserved`**, **`Needs Review`**, or **`Unresolved`** triage when bounds or assumptions are violated. |

---

### Honest Revision Continuity and Three-Tier Validity

Preserving a technical ID or surface coordinate is not the same as preserving creative intent. Because shared `World` entities, derived topology, and multiple `Experiences` form a **cross-domain dependency graph** (rather than a simple single-pass tree), Biskiq governs revisions through two linked contracts:

#### 1. Three-Tier Revision Triage (`Preserved`, `Needs Review`, `Unresolved`)

* **Preserved (Automatic Adaptation)**: The authored relationship remains valid and unambiguous within its spatial, optical, or temporal bounds (e.g., stretching a wall redistributes a 4-painting rail cleanly with ample margin).

* **Needs Review (Non-Blocking Flag + Creator Verification)**: The technical reference survived and Biskiq applied a candidate adaptation, but a compositional, spatial, or narrative assumption changed materially (e.g., an exhibit referenced by an `Experience` Stop moves to a different floor, leaving the Stop's saved `Camera` View pointing at the old location).

* **Unresolved (Explicit Creator Decision Required)**: No uniquely valid continuation exists. Biskiq preserves all authored data in a safe holding state and requires an explicit creator choice (e.g., a wall shrinks until its rail overflows the wall boundary; a roof transformation collapses the face carrying a coffer modifier at $\tau + \varepsilon$; two merged rooms have conflicting Environmental Looks or floor heights; or a replaced voiceover audio track repeats a pinned transcript phrase twice).

#### 2. Separating Authoring Validity, Dependency Diagnostics, and Publication Validity

To keep spatial editing fluid without corrupting data or shipping broken experiences, Biskiq enforces three distinct validity checks:

1. **Authoring Validity (Gate on Immediate Commit)**: Every edit must satisfy its owning document's structural integrity and deterministic operation/history contract before committing (e.g., `LayoutDocument` rejects self-intersecting degenerate wall topology). However, a valid `World` edit is **never** blocked merely because a downstream `Experience` will require repair.

2. **Dependency Diagnostics (Non-Blocking Cross-Domain Triage)**: When a valid `World` edit commits, the dependency graph records `Needs Review` or `Unresolved` diagnostics on affected `Scene` placements, `Camera` views, or dependent `Experiences` so the creator can resolve them in context.

3. **Publication Validity (Gate on Release Compilation)**: Publishing an `Experience` compiles an **immutable versioned release snapshot** (while allowing a stable public URL to be promoted to new releases over time). Items flagged `Needs Review` do **not** block publication if the creator accepts the result; items flagged `Unresolved` (such as out-of-bounds overflowing wall placements or missing required targets) block publication only when they violate the release's validity contract.

---

### Task-Driven Representation Workbenches Under Single Camera Authority

Different spatial tasks benefit from different geometric projections: beginners often find top-down 2D Plan view far easier for room blockout, whereas lighting benefits from 3D perspective or cross-section views, and curved-wall alignment benefits from a flattened elevation. Rather than enforcing a perspective-only mandate or creating isolated studio modes, Biskiq provides **task-driven representation continuity** across four synchronized views:

* **Chromatic Horizon Plan**: Top-down orthographic view showing active walls in charcoal, lower levels in translucent red, and upper levels in dashed blue.

* **3D Selective Cutaway Stage**: Perspective/axonometric view with silhouetted poché ceiling clipping and `Clip Participation: Exclude` for multi-story stairs and tall installations.

* **Orthographic Section Workbench**: Vertical slice for adjusting dual-skin ceiling plenums ($\Sigma_{\text{ext}}, \Sigma_{\text{int}}$), sightlines, and vertical light angles.

* **Unrolled Wall Elevation Workbench**: Flattens developable curved or straight walls into an arc-length $(s, h)$ elevation for rail alignment and typography placement.

In all four views, **`Camera`** exclusively governs viewpoint, projection, and clipping planes, while the **Conservatory Shell** manages workbench UI state and gizmo filtering over the shared underlying documents.

---

## 4. Competing Integrated Product Directions & Creator Journeys

### Fair Comparison Against Steelmanned Product Philosophies

To test whether **Direction I (The Scenographic Conservatory)** genuinely earns its position as the leading synthesis, it must be evaluated against the **strongest realistic versions** (steelmanned formulations) of the competing product philosophies rather than artificially crippled strawmen. *(Note: Comparative assessments represent qualitative architectural trade-offs and design hypotheses to be tested in the UX design round, not empirical measurements.)*

| Product Direction (Steelmanned Formulation) | Core Strengths When Intelligently Integrated | Remaining Structural Trade-Offs vs. Direction I |
| --- | --- | --- |
| **Direction I: The Scenographic Conservatory (`World \| Experience` Dual-Lens Stage)** *(Leading Synthesis)* | Mirrors the true one-to-many semantic boundary between physical `World` truth and audience-specific `Experience` interpretation; keeps architecture, staging, and lighting in one tightly coupled visual loop; supports convergent entry points and task-driven workbenches. | Risk of cognitive friction when switching between `World` and `Experience` during interactive staging, or gizmo crowding if focus-mode arbitration is poorly tuned (must be validated in Tier 1 UX testing). |
| **Direction II: The Modular Creative Suite (`Architecture \| Staging \| Story \| Interface`)** *(Steelmanned with shared Camera & live selection)* | Eliminates gizmo competition by giving each discipline a dedicated toolset; provides UI designers a familiar Framer-style artboard studio while maintaining live 3D background camera synchronization. | Separates architecture, object staging, and lighting into different top-level studio tabs even though spatial creators adjust room height, exhibit placement, and lighting together as a single creative thought. |
| **Direction III: Diegetic Zero-Chrome World-Builder (Single-Lens Object-Centric Canvas)** *(Steelmanned with externalized behavior layers)* | High immediacy for single-room interactive 3D showcases and avant-garde WebGL portals; zero lens switching; preserved in Direction I as an optional **Zero-Chrome Publication Mode**. | Attaching narrative logic primarily through per-object inspectors obscures room-wide pacing and sequence choreography across larger exhibitions; pure 3D canvas text requires a hybrid semantic DOM layer for accessibility. |
| **Direction IV: Editorial & Curatorial Schema Engine (Content-First Compilation)** *(Steelmanned as a generator of editable Biskiq primitives)* | Fastest initial scaffolding from raw media collections, spreadsheets, or narrative outlines; preserved in Direction I as **Convergent Entry Scaffolding**. | If treated as the *entire* product paradigm rather than an entry workflow, schema-driven generation limits tactile spatial craft (such as sculpting volumetric compression/release or bespoke optical framing). |

### Convergent Entry Workflows Into One Canonical Project

Spatial designers, curators, and storytellers do not all begin a project by drawing architectural walls. Biskiq incorporates the strongest insight from Direction IV by supporting **multiple natural ways to begin that converge into the same canonical Project**:

* **Collection-First**: Dropping artwork images, 3D models, or a metadata table into Biskiq can either stage the items in the unplaced **Project Library** or run a **one-time editable scaffolding macro** that generates a starter room, places the works along an eye-line rail, and populates draft label sockets. Once generated, the walls, rails, and labels are ordinary editable Biskiq entities with recorded provenance—avoiding an opaque template ceiling while leaving optional persistent procedural regeneration open as a future opt-in capability.

* **Story / Interaction-First**: A creator can outline narrative chapters, inquiry goals, or interactive beats before building 3D architecture—without being forced into a linear guided tour or mandatory Stops—and then bind those beats to spaces and objects as the `World` takes shape.

* **Space-First**: A creator can sketch rooms in 2D Plan or 3D Perspective, or import a reference floor plan, and stage content directly into the architecture.

---

### Four Revised End-to-End Creator Journeys

#### 1. The First-Day Creator Journey (Subtraction Baseline & Free-Roam Publishing)

A creator with no 3D or CAD background opens Biskiq to publish an exhibition of 10 photographs and a bronze sculpture. Rather than confronting a complex tool matrix, the creator drops the 10 image files and 1 sculpture model into the starter project and selects a simple rectangular gallery layout (or sketches four walls in 2D Plan view). Because the room defaults to an inspectable **Room Illumination Look** (`Balanced Gallery Wash`), the space and walls appear evenly lit immediately—requiring zero manual spotlight placement or shutter adjustments on Day 1. The creator drags the photographs onto the main wall, where transient surface magnetism and the $150\text{ cm}$ eye-line guide assist placement, and groups four related prints onto an **Eye-Line Rail** to adjust their spacing evenly with a single handle. Clicking each artwork opens its **Info Card**, where the creator types a title, maker, date, and a short 40-word caption. Without creating a single Guide, Stop, voiceover track, or timeline cue, the creator clicks **Visitor Preview** and **Publish**: the intended Biskiq publishing flow compiles a **Free-Roam Experience** where visitors can walk or click-to-move, use supported overview navigation, and read artwork captions. Desktop, mobile, keyboard, and screen-reader usability are **target outcomes requiring runtime implementation and testing**, not demonstrated results.

#### 2. The Developing Expert Journey (Progressive Mastery in the Same Project)

Returning to the project to deepen its spatial atmosphere and add a guided narrative track, the creator switches to **Shell Focus Mode** in `World`, pitches the main gallery roof upward to open a daylight clerestory band, and uses the **Orthographic Section Workbench** to pull the entry alcove's interior ceiling liner ($\Sigma_{\text{int}}$) down to $2.55\text{ m}$ for deliberate spatial compression before the tall main hall. Selecting the curved north partition, the creator invokes the **Unrolled Wall Elevation** focus view to align a sequence of prints and section typography without perspective foreshortening. Next, to create dramatic contrast for the sculpture, the creator switches the room's look to `Warm Twilight` and picks up the `Illuminate` instrument—clicking the sculpture to aim a target-linked $30^\circ$ directional light and cropping wall spill on the adjacent canvas with four-blade **Shutter Handles**. Switching to `Experience`, the creator adds an optional 5-Stop **Elastic Guide** with a voiceover recording, uses **Pose-in-Place** on an articulated astrolabe exhibit to capture an `Exploded_Pose` capability, and highlights the spoken phrase *"beneath the outer rete ring"* in the transcript to trigger `Exploded_Pose` and a focused lighting look on cue.

#### 3. The Substantial Revision Journey (Honest Triage Across `Preserved`, `Needs Review`, and `Unresolved`)

Later, the creator restructures the building: adding an upper mezzanine Horizon (`+4.5m`) with Red/Blue plan traces, shrinking the ground-floor east wall, merging two side alcoves that had different lighting looks, moving the astrolabe upstairs, and replacing Stop 5's audio with an edited voiceover track where the narrator repeats the key phrase twice. Every valid `World` edit commits cleanly without blocking architectural flow, while Biskiq's dependency diagnostics evaluate all downstream impacts honestly:

* **Preserved**: Artworks on the curved north wall retain their relative surface anchors, and target-linked lights on that wall automatically update their aiming vectors.

* **Needs Review**: Moving the astrolabe upstairs preserves its identity, poses, and attached UI cards, but flags Stop 5's saved `Camera` View as **`Needs Review`**—allowing the creator to preview both and choose `[Move Stop Camera Upstairs to @Astrolabe]` or `[Keep Original Wide Room Shot]`.

* **Unresolved (Explicit Decision Required)**: (1) Because the shortened east wall can no longer fit all 6 paintings on its rail within minimum margins, the 2 overflowing works are flagged **`Unresolved (Out of Bounds)`**, prompting the creator to wrap them to the adjacent wall or move them to the staging tray; (2) merging the two alcoves with conflicting `Daylight` and `Chiaroscuro` looks flags the room look as **`Unresolved`**, offering a one-click option to unify the look or convert the deleted wall line into an **Invisible Zone Separator**; and (3) the duplicate phrase in the replaced audio flags the transcript anchor as **`Unresolved`** so the creator can click which spoken occurrence should fire the cue. While these edits happen in the working draft, the previously published visitor URL remains untouched on its immutable release snapshot until the creator resolves blocking issues and promotes a new release.

#### 4. The High-Ceiling Creative Horizon Journey

An experimental studio constructs a multi-story kinetic pavilion over an open plaza boundary loop ($\mathcal{B}$), lofting a multi-rib hyperbolic-paraboloid shell and suspending a multi-story installation through an atrium Void Prism (`Clip Participation: Exclude`). Using the **Action Recorder** in `World`, the creator bakes a rotational motion into a reusable **Performance Clip**, then configures `Experience` in **Zero-Chrome Mode** with scroll-driven camera choreography, non-linear session progress conditions (`When [Any 3 of 5 Installations] Inspected`), and an expanded **Inline Sync Ribbon** coordinating spatial audio, volumetric fog horizons, and lighting states—with keyboard and screen-reader access remaining a **runtime validation requirement**, not an automatic guarantee of a semantic DOM or WAI-ARIA layer.

---

## 5. Future Capability & Foundational Seam Ledger

A core responsibility of this synthesis is separating **minimum foundational guarantees** (which must be respected in Biskiq's architecture now to avoid destructive file or schema migrations later) from **candidate implementation mechanisms** (which belong to engineering and UX design).

### Category A (Foundational Guarantees), Category B (Planned Extensions), and Category C (Additive Capabilities)

| Seam ID & Area | Classification | Minimum Foundational Guarantee (Commit Conceptually Now) | Candidate Mechanisms & Deferred Implementation Choices (Do Not Prematurely Lock) |
| --- | --- | --- | --- |
| **Seam A1: Explicit Spatial Anchoring & Relative Reference Resolution** | **A: Foundational Guarantee** | Entities must support free-standing placement (world/room space) as well as explicit relative anchoring to a semantic host (room, surface, rail, or socket), resolving deterministically on revision or reporting invalidation. | Specific coordinate serialization formats, exact number of addressing modes, and UV parameterization math $(u, v, d)$ belong to architecture design. |
| **Seam A2: Source-to-Derived Topology Provenance** | **A: Foundational Guarantee** | Separate stable **source semantic identities** (authored walls, boundary loops, void prisms, shells) from **derived geometric identities** (rooms, faces, meshes); generators must record source provenance and explicitly report `Valid`, `Ambiguous (Split/Merged)`, or `Invalidated` on regeneration. | Specific face-tuple naming conventions and longest-eave UV resampling algorithms. (Note: Dual-Skin Shell geometry $\mathcal{S} = \{\Sigma_{\text{ext}}, \Sigma_{\text{int}}, \mathcal{B}\}$ is `LayoutDocument`'s room-cap model paired with A2 provenance, correcting the earlier B1/A2 cross-reference.) |
| **Seam A3: Scoped Non-Destructive Capability Evaluation** | **A: Foundational Guarantee** | Reconciled directly with Biskiq's ratified composition/execution contract: (1) preview and runtime never mutate authored `Layout`/`Scene` base truth; (2) Poses, Clips, Looks, and UI Variants are typed, scoped capabilities with explicit activation lifetimes and conflict-resolution rules; and (3) the active contributor driving any property is inspectable. | Exact mathematical evaluation stack formulas, blending curves, and global priority hierarchies across concurrent interactions. |
| **Seam A4: Definition-Instance Reuse & Sparse Overrides** | **A: Foundational Guarantee** | Reserve a conceptual seam allowing placed 3D assemblies and Experience UI structures to reference a reusable source definition with sparse property overrides without requiring destructive cloning. | Do not mandate one universal Figma-style Primary-Variant matrix across both 3D and 2D on Day 1; exact inheritance schemas belong to architecture reconciliation. |
| **Seam A5: Deterministic Semantic Operation Bus & Authority Tagging** | **A: Foundational Guarantee** | All human gizmo edits, initial entry-scaffold macros, and future AI copilot actions execute as reversible, serializable semantic operations tagged by domain authority (`Layout`, `Scene`, `Camera`, `Experience`). | External MCP agent protocol wiring, multi-user permission enforcement, and collaborative merge resolution (deferred). |
| **Seam A6: Declarative Session State & Idempotent Cue Evaluation** | **A: Foundational Guarantee** | Separate (1) authored condition declarations, (2) ephemeral runtime session state (isolated from authored documents), and (3) idempotent cue target evaluation so midpoint rehearsal (`Lookback`) can reconstruct effective state deterministically. | Implicit visit/inspection counters (`visitedCount`) are supported as an authoring shorthand over session state; exhaustive event logs and full session replay engines are optional diagnostics, not mandatory V1 overhead. |
| **Seam A7: Structured Semantic UI & Input/Accessibility Contract** | **A: Foundational Guarantee** | Visitor-facing text and UI in `ExperienceDocument` are preserved as structured semantic content (never baked irreversibly into 3D textures) with deterministic pointer/keyboard/focus arbitration between UI and `Camera`, screen-reader semantics, and legibility verification under active scene lighting. | Specific DOM node pool sizes ($<50$), CSS `translate3d` projection, MSDF sprite fallbacks, and automatic 2D accessible reader toggles are replaceable engineering strategies. |
| **Seam A8: Asset Provenance, Readiness & Attachment Separation** | **A: Foundational Guarantee** | Strictly distinguish imported source assets, reusable definitions, placed instances, and semantic attachment pins/sockets; asset updates or replacements must validate dependent poses, pins, and cues and flag mismatches for review. | Background KTX2 texture compression, automatic mesh decimation/LOD pipelines, and heuristic asset-readiness budgets. |
| **Seam B1: Multi-Rib Lofted Shells & Courtyard Gridshells** | **B: Planned Extension** | Enabled by `LayoutDocument`'s Dual-Skin Shell contract and Seam A2 source-to-derived face provenance. | Ship straight-skeleton roof/ceiling chemistry first; add cross-sectional rib lofting (Smooth Spline, Ruled Hypar, Folded Plate) as a planned extension. |
| **Seam B2: Action Recorder Puppeteering & Baked Authoring Simulation** | **B: Planned Extension** | Enabled by Seam A3 (`Performance Clips` as scoped temporal capabilities). | Ship discrete Pose-to-Pose transitions and imported GLTF clip playback first; add live puppeteering and `Physics Bake Mode` later. |
| **Seam B3: Transcript Word-Span Pinning & Inline Sync Ribbon** | **B: Planned Extension** | Experience-owned cue timing must distinguish direct offsets from transcript phrase/span anchors and explicitly report ambiguous matches after narration replacement. | Candidate timing anchors include `Offset`, `TranscriptSpan`, and `GroupTimelineOffset`; word alignment, multilingual re-anchoring, and the Inline Sync Ribbon remain deferred. |
| **Seam B4: Audience Presentation Lenses & Multi-Role Permissions** | **B: Planned Extension** | Enabled by `ExperienceDocument`'s many-to-one relationship with `World`, Seam A4 overrides, and Seam A5 operation authority tags. | Audience variant lenses (Scholar/Family/Reduced-Motion) and role-restricted "Lock World / Edit Experience" permissions. |
| **Seam B5: Bounded Runtime Behavior Hook (Reactive & Kinetic Art)** | **B: Planned Extension** | Enabled by Seam A3's isolated runtime evaluation layer and Seam A6's session state contract. | Future support for bounded, ephemeral visitor-side reactive behaviors (e.g., proximity-reactive cloth or kinetic sculptures) without mutating authored truth; controller APIs are deferred. |
| **Seam C1–C3: Surface Reliefs, 4-Blade Optical Shutters & Stage Auditor** | **C: Additive Capabilities** | Operate within existing material layer stacks, light frustum parameters, and read-only cross-document diagnostic queries. | Fluted plaster/coffer modifiers (C1), 4-corner homography shutters & video gobos (C2), and spatial audio / rendered-contrast / narrative auditor overlays (C3). *(Note: General SDF statue sculpting is excluded from scope.)* |

---

## 6. Explicit Handoffs: Product, UX Design, Architecture, and Deferred Scope

### Four-Way Responsibility Handoff Matrix

To move cleanly from product synthesis into execution without conflating settled product principles with open design or engineering work, responsibilities are partitioned across four tracks:

| Handoff Track | Decisions & Questions Assigned to This Track | Governing Guardrails |
| --- | --- | --- |
| **1. Product Synthesis Recommendations** *(Established in Research 6)* | • Retain **The Scenographic Conservatory (`World \| Experience`)** as the leading product direction.<br><br>• Frame **Project** as the creator's conceptual unit with convergent **Space-first, Collection-first, and Story/Interaction-first** entry workflows.<br><br>• Enforce the **Subtraction Baseline**: free-roam publishing requires zero Stops/Guides, and default room illumination requires zero manual light placement.<br><br>• Separate **general underlying capabilities** from **configurable scenographic recipes**.<br><br>• Distinguish **spatial anchoring**, **transient assists**, and **persistent relationships**, backed by **`Preserved` / `Needs Review` / `Unresolved`** revision triage and three-tier validity (`Authoring`, `Diagnostic`, `Publication`).<br><br>• Preserve Category A minimum guarantees while excluding general SDF modeling, BIM CAD, and game-engine scripting. | Treat these as product-level principles and continuity guarantees, not locked UI wireframes or TypeScript schemas. |
| **2. Dedicated UX Design & Prototyping Round** *(Explore & Validate Next)* | • **Interruptions per Creative Intention**: Test how `World \| Experience` handles interactive staging tasks compared to contextual cross-domain tool invocation.<br><br>• **Onboarding Entry & Representation Ergonomics**: Test a unified welcoming canvas vs. explicit entry pathways, and test when creators prefer 2D Plan vs. 3D Perspective vs. Unrolled Wall / Section focus views.<br><br>• **Visitor-Interface Authoring Boundary**: Determine when UI cards should be edited in-context on the `Experience` Stage vs. inside an invoked drawer or dedicated interface workspace.<br><br>• **Revision Triage & Gizmo Hygiene**: Design calm, non-blocking visual affordances for `Needs Review` and `Unresolved` states and single-domain gizmo filtering. | Evaluate using comprehension, perceived authorship, confidence to revise, and output quality—not just raw completion speed. |
| **3. Codebase-Aware Architecture Round** *(Inspect & Reconcile)* | • **Schema & Persistence Reconciliation**: Define concrete TypeScript types for Projects, unplaced staging libraries, optional relative spatial anchors, source-to-derived face provenance (`LayoutDocument`), and asset/socket identity.<br><br>• **Composition & Execution Alignment**: Reconcile scoped capabilities (Poses, Clips, Looks, UI Variants), activation lifetimes, and conflict resolution directly with Biskiq's ratified composition/execution contracts.<br><br>• **Cross-Domain Dependency Graph & Snapshot Compiler**: Design the reference graph powering non-blocking `World -> Experience` diagnostics and immutable published release snapshots.<br><br>• **Ingest & Hybrid Runtime Engineering**: Specify asset readiness diagnostics, DOM/WebGL input arbitration, and rendered contrast verification. | Inspect existing repository contracts before introducing new data structures; never introduce duplicate camera or state authorities. |
| **4. Deferred Scope** *(Keep Possible, Do Not Build Now)* | • Bounded runtime reactive behaviors (kinetic/cloth visitor-side simulation in the isolated runtime layer).<br><br>• Multi-user real-time collaboration, role-based access permissions, and review/approval workflows.<br><br>• Opt-in persistent procedural layout regeneration on collection updates.<br><br>• AI Curatorial Copilot / MCP agent workflows and automated multilingual audio re-anchoring. | Preserve the Category A/B extension seams to reduce the risk of destructive migrations later, but invest zero implementation effort now. |

---

### Reprioritized Two-Tier UX Experiment Portfolio

Rather than testing complex multi-feature showcases all at once, the UX design round is organized into **Tier 1 (High-Risk Direction-Falsifying Experiments)** that test assumptions capable of changing the product direction, followed by **Tier 2 (Ergonomic & Representation Tuning Experiments)**:

| Priority & Experiment | Core Question Under Test | Alternatives Compared | Evaluation Metrics & Direction-Changing Criteria |
| --- | --- | --- | --- |
| **Tier 1.1: Convergent Entry & Subtraction-Baseline Onboarding** | Can a novice begin naturally from **Collection**, **Story/Interaction**, or **Space** and reach a personally authored, publishable result without encountering expert tools? | **A**: Unified starter canvas with optional media drop, room sketch (Plan/3D), or beat outline.<br><br>**B**: Explicit upfront workflow/persona chooser.<br><br>**C**: Space-first architectural blockout only. | **Metrics**: Perceived authorship, conceptual comprehension, confidence to customize defaults, and completeness of published result.<br><br>**Impact**: Determines whether entry scaffolding is a unified canvas action (A) or distinct guided flows (B). |
| **Tier 1.2: `World \| Experience` Comprehension & Interruption Cost** | Do creators understand what belongs in `World` vs. `Experience`, and how many interruptions occur when expressing one cross-domain creative intention? | **A**: Dual-Lens (`World \| Experience`) with contextual `Pose-in-Place`.<br><br>**B**: Steelmanned 4-Studio Suite with shared camera & contextual tool invocation.<br><br>**C**: Single-lens object inspector. | **Metrics**: Interruptions per task, distinction between base truth vs. activated Pose/Look, and error recovery.<br><br>**Impact**: Distinguishes failure to discover a tool from failure to grasp the `World \| Experience` boundary, governing how cross-domain instruments are invoked. |
| **Tier 1.3: Honest Revision Triage (`Preserved` / `Needs Review` / `Unresolved`)** | When structural edits alter or invalidate spatial and narrative relationships, do creators understand, trust, and smoothly resolve the resulting triage states? | **A**: Explicit 3-tier triage (`Preserved`, `Needs Review`, `Unresolved`) with choice prompts.<br><br>**B**: Silent automatic geometric re-projection.<br><br>**C**: Blocking modal warnings before `World` edits commit. | **Metrics**: Creator trust, detection of unintended visual changes, and repair accuracy across wall overflow, room merge, and moved exhibit cases.<br><br>**Impact**: Tunes which edge cases trigger `Needs Review` vs. `Unresolved` and when diagnostics surface. |
| **Tier 2.1: Task-Driven Representations (Plan, 3D, Section, Unrolled Wall)** | When do creators prefer working in 2D Plan, 3D Perspective, Orthographic Section, or Unrolled Wall—and when are transitions helpful vs. disorienting? | **A**: Task-driven contextual focus pills (`Flatten Wall`, `Slice Section`, `Plan View`).<br><br>**B**: Persistent multi-viewport split screen.<br><br>**C**: Direct 3D perspective manipulation only. | **Metrics**: Spatial orientation continuity, wall-hang alignment accuracy, and multi-story stair/void alignment confidence. |
| **Tier 2.2: Contextual Stage UI vs. Dedicated Interface Workspace** | Where does in-context 3D Stage UI editing reach its limit compared to an invoked drawer or dedicated Interface Studio? | **A**: Pure in-context Stage UI editing.<br><br>**B**: Contextual Stage + invoked Component Studio Drawer.<br><br>**C**: Dedicated Interface Studio workspace. | **Metrics**: Sightline/occlusion accuracy on first preview, cognitive load when editing multi-variant cards, and responsive layout reliability. |
| **Tier 2.3: Real-Device Legibility, Non-Pointer Traversal & Audio Pinning** | Do hybrid DOM/WebGL interfaces, rendered lighting contrast checks, and transcript-pinned cues hold up across mobile touch, keyboard, and screen readers? | **A**: Rendered contrast verification + 2D Accessible Reader fallback + Transcript word pinning.<br><br>**B**: Static albedo LRV check + manual timestamp timeline. | **Metrics**: Screen-reader usability, keyboard focus continuity, legibility under dramatic lighting looks, and audio-swap recovery time. |

---

## Research sources and evidence trail

The five original research studies are the primary evidence base for this cross-domain synthesis. Each linked Markdown file contains its own sources and claims; the accompanying HTML is a **visual/interactive research companion**, not a substitute for the complete written study. Individual external empirical figures in this synthesis are **not** independently reverified by this editorial pass.

1. [Multi-level spatial representation and authoring UX](./multi-level-spatial-authoring-ux.md) ([interactive companion](./multi-level-spatial-authoring-ux.html)).
2. [Creative scene composition, surface authoring and look development](./creative-scene-composition-ux.md) ([interactive companion](./creative-scene-composition-ux.html)).
3. [Interactive experience authoring and spatial storytelling](./spatial-storytelling-ux.md) ([interactive companion](./spatial-storytelling-ux.html)).
4. [Expressive roofs, ceilings and volumetric spatial authoring](./expressive-roof-volume-authoring-ux.md) ([interactive companion](./expressive-roof-volume-authoring-ux.html)).
5. [Visitor-interface capabilities, interactive content and spatial web authoring](./spatial-interface-authoring-ux.md) ([interactive companion](./spatial-interface-authoring-ux.html)).

Two other references explicitly present in the source research trail:

- [OpenUSD: Introduction to USD](https://openusd.org/release/intro.html).
- [Native3D: End-to-End 3D Scene Generation via Unified Mesh-Texture Modeling (CVPR 2026)](https://openaccess.thecvf.com/content/CVPR2026F/papers/Liu_Native3D_End-to-End_3D_Scene_Generation_via_Unified_Mesh-Texture_Modeling_and_CVPRF_2026_paper.pdf).

**Editorial note:** The B3 row was visibly cut off after `Offset | TranscriptSpan |` in the supplied revised export. The restored row summarizes the same cue-timing extension described in the earlier synthesis and peer-discussion materials; it does not prescribe a final persisted schema. The original HTML widgets and page figures were not supplied in this revised text export and have not been recreated in this Markdown-only artifact.