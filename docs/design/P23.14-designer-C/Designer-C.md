# P23.14 — Editor Shell & Visual System Foundation: Concept Exploration

**Document type:** Concept exploration & comparative system proposal  
**Authority:** Consumes `P23.14-shell-design-context.md` (authoritative) and `P23.14-designer-brief.md` (assignment). Synthesizes precedent research from `P23.14-editor-shell-visual-system-research.md`.  
**Date:** 2026-09-17  

---

## 1. Executive Framing: The Visual Grammar of Rank

The fundamental defect of the inherited Museum Editor shell is not aesthetic exhaustion or decorative excess; it is **control-weight flatness**. The inherited two-row chrome places eight semantically disparate lifetimes into an unranked horizontal sequence:

$$\text{Project} \longleftrightarrow \text{Domain} \longleftrightarrow \text{View} \longleftrightarrow \text{Stance} \longleftrightarrow \text{Tool} \longleftrightarrow \text{Action} \longleftrightarrow \text{Selection} \longleftrightarrow \text{Transient State}$$

When `Scene | Camera` (a session-scale attention domain), `Plan | 3D` (a compile-shared view axis), `Layout | Arrange` (a workspace stance), and `Wall` (an armed drawing tool) sit as adjacent pills of near-identical contrast, the user must read every label to maintain orientation.

To build a **warm instrument, not a friendly dashboard**, and to prevent the shell from collapsing under future staging (P24) and contextual orthographic instruments (P26), all three concepts presented here enforce an invariant **Seven-Tier Semantic Rank Ladder**:

```
Tier 1: Document & Global Scope     [Project, Persistence, Save Blocker, Undo/Redo, Visitor Gate]
Tier 2: Domain Attention Axis        [Scene (World/Layout) vs Camera (Cinematic Graph)]
Tier 3: Spatial View & Instruments   [Plan | 3D  +  Contextual Instrument Slot (Section / Elevation)]
Tier 4: Workspace Operational Stance [Layout (Topology) | Arrange (Placement)]
Tier 5: Contextual Tool Armature     [Armed continuous tools vs Momentary transform actions]
Tier 6: Selection Datum & Authority  [Canonical Entity ID, Reference, Primary/Set Presentation]
Tier 7: Transient Scaffolding        [Snaps, Live Dims, Refusal Toasts, Anchored Numeric Fields]
```

### Shared Foundational Decisions Across All Three Concepts

1. **Inspector Documentation Purge:** The 6-row static summary card and multi-line wall-first tutorial prose are evicted from the top of the Inspector. The Inspector opens directly with **Tier 6 Selection Datum** (Entity Name, Canonical Reference, Primary Status). Educational scaffolding is relocated to **uncertainty boundaries** (on-demand inspection, empty states, and reason-coded refusals).
2. **One Fact, One Authoritative Home:** 
   - Grid and Snap toggles/values are evicted from the status bar and in-canvas strips; they live exclusively in the view utility cluster.
   - Status bar owns *ephemeral guidance, spatial coordinates, save state, and refusal messaging*.
   - Viewport footer counts ("1 rooms · 0 objects") are removed; this inventory is owned exclusively by the Navigator.
3. **P26 Contextual Instrument Slot:** No concept hard-codes a binary `[Plan | 3D]` switch. All three provide an explicit, nestable **Spatial Instrument Slot** with a visible return path (`Plan | 3D :: [Section Cut-A ⤺]`).
4. **P24-Ready Selection Authority:** Headers and row grammars support single-target Layout selection today, while gracefully hosting an ordered selection set with one primary entity (`3 objects selected · Primary: Plinth P-04`) and mixed-value states (`Mixed (3 values)`) tomorrow.
5. **Timeline Grid Realignment:** The Camera Timeline is integrated into the workspace grid. The collapsed 48 px mini-player is decoupled from its centered 760 px card and pinned across the viewport margins, harmonizing with the side panels and status bar.

---

# 2. Concept 1: The Curatorial Console

> **Territory Anchor:** *Technical Workbench hybridized with Studio Precision.*  
> **Target Persona:** Spatial designers and museum technologists who demand deterministic feedback, high information density, and unambiguous physical ownership.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ME] Untitled Exhibition ▾  [Local Session] [Save to Cloud ▾]  │ Spatial | Publish │ ↶ ↷  [Visitor ↗]  │
├───────────────────────────────────────────────────────┬────────────────────────────────────────────────┤
│ DOMAIN: [Scene ▾]  VIEW: [Plan | 3D : +Ortho]         │ STANCE: [Layout | Arrange]  │  [Tool Armature] │
├───────────────────┬───────────────────────────────────┴────────────────────────┬───────────────────────┤
│ NAVIGATOR (260px) │ VIEWPORT (Plan / 3D Canvas)                                │ INSPECTOR (300px)     │
│ ┌───────────────┐ │                                                            │ ┌───────────────────┐ │
│ │Search...     Q│ │                                                            │ │WALL: W-FJSK       │ │
│ ├───────────────┤ │                                                            │ │Ref: J-5AEX→J-7V24 │ │
│ │▼ ARCHITECTURE │ │                                                            │ ├───────────────────┤ │
│ │  Rooms (3)    │ │                                                            │ │▼ GEOMETRY         │ │
│ │  ► Room East  │ │                                                            │ │  Length   4.90 m  │ │
│ │  ▼ Walls (8)  │ │                                                            │ │  Thick    0.20 m  │ │
│ │   ● W-FJSK ───┼─┼───────────────[Live Dimension: 4.90 m]─────────────────────┼─►  Height   3.50 m  │ │
│ │   ○ W-992B    │ │                                                            │ ├───────────────────┤ │
│ │▼ SCENE ASSETS │ │                                                            │ │▼ HOSTED OPENINGS  │ │
│ │  Plinth (2)   │ │                                                            │ │  (No openings)    │ │
│ └───────────────┘ │                                                            │ ├───────────────────┤ │
│                   │                                                            │ │ACTIONS            │ │
│                   │                                                            │ │[Dissolve Junction]│ │
├───────────────────┴────────────────────────────────────────────────────────────┴───────────────────────┤
│ CAMERA TIMELINE (Docked 48px/288px) — Camera Domain Only                                               │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Scene • Plan | Cursor: X: 2.45m Z: -1.20m | Snap: 0.25m (Grid On) | Unsaved changes (2) | Shift: Snap  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Thesis
A high-trust, instrument-dense console that frames the spatial canvas with dark slate architectural chassis and precision-milled structural datums. It eliminates control flatness by organizing the shell into an upper **Command Horizon** (two mechanically distinct tiers with strict division between Document Authority and Workspace Navigation), flanked by structural tool bays. It achieves warmth not through decorative radius or pastels, but through calibrated neutral surfaces, rich tactile latches, and humanist typography anchored to tabular coordinates.

### 2. Shell Composition
* **Tier 1: Global Bar (36 px, Persistent):** Dark charcoal slate (`#16181D`). Houses project identity, persistence/cloud state, global undo/redo, Publish surface switch, and visitor preview.
* **Tier 2: Workstation Armature (34 px, Persistent):** Pinned directly below Tier 1. Split into two functionally explicit halves:
  - *Left Datum (Spatial Context):* Domain segmented toggle (`Scene | Camera`) with distinct optical latches, immediately followed by the View selector (`Plan | 3D`) and an expandable contextual instrument notch (`+ Ortho ▾`).
  - *Right Datum (Operation Engine):* Local Stance segmented pill (`Layout | Arrange`), followed by a vertical hair-divider and the contextual tool matrix (`Select`, `Wall`, `Room`, `Opening`, `Column`). Tools are compact 28 px latched buttons with micro-labels.
* **Left Rail — Navigator (240–300 px, default 260 px):** Pure structural inventory. Two top tabs: `Topology` (canonical architecture: Rooms, Walls, Junctions) and `Staging` (placed world-local assets). Distinct row treatments for entities versus structural parents. Non-selectable relationship metadata (e.g., boundary junctions) are rendered as nested sub-text, never as interactive entity rows.
* **Right Rail — Inspector (300 px, Persistent):** Direct property modification. Led by an actionable **Selection Datum Strip** (Entity Symbol, Author Name, Reference ID, Delete/Dissolve entry point), followed by categorized, collapsible property clusters (`Geometry`, `Constraints`, `Materials`, `Relationships`).
* **Timeline (Camera Domain Only):** Fully docked, spanning 100% of the viewport width. Collapses to a 48 px transport blade; expands to 288 px with five aligned track lanes.
* **Canvas Chrome:** Pinned to top-right of the viewport: View Camera Orbit/Orient Gizmo, Grid Toggle, Snap increment popover (`0.25 m ▾`). Bottom-right: Scale reference bar (`2 m`).

### 3. Visual System
* **Typography:** System UI sans (Inter/San Francisco) for structural chrome. Tabular Mono (`JetBrains Mono` / `SF Mono`) for all numeric dimensions, coordinates, angles, and canonical IDs (`W-FJSK`).
* **Density & Metrics:** Row height in tables/lists: 26 px (dense, scannable). Input fields: 24 px height with internal 1 px borders. Top chrome: 36 px + 34 px = 70 px. Status bar: 24 px.
* **Surfaces & Shape:** Deep charcoal/graphite foundation (`#121417`, `#1A1D23`, `#222630`). Edges are sharp 2 px radii with 1 px crisp borders (`rgba(255,255,255,0.08)`). No floating elevation cards; panels are docked architectural bulkheads.
* **Color Roles & Semantic Discipline:**
  - *Canvas Paper:* P23.13 off-white drafting surface (`#F5F6F8`) in Plan; deep spatial void (`#0D0E11`) in 3D.
  - *Canonical Selection:* Vivid Instrument Cobalt (`#2D68FF`), 2 px stroke outside wall mass in Plan.
  - *Primary Entity (Multi-select):* Cobalt with interior hatched pip.
  - *Active Tool / Latched Stance:* High-contrast Warm Ochre/Gold tint (`#D99B26`), clearly differentiating an armed mode from an entity selection.
  - *Snaps & Guides:* Precision Teal (`#00A896`).
  - *Refusal & Destructive:* Crimson (`#E63946`).
* **Interaction States:**
  - *Hover:* 1 px subtle surface illumination (`rgba(255,255,255,0.04)`), no layout shift.
  - *Armed Tool:* Inset well shadow (`inset 0 1px 2px rgba(0,0,0,0.4)`) + Ochre bottom key-line.
  - *Keyboard Focus:* High-contrast 2 px pure white offset ring (`outline: 2px solid #FFF; outline-offset: 1px`), visually distinct from Cobalt selection.

### 4. Educational Model
* **The Actionable Info Notch:** Evicts static documentation from the Inspector. Replacing it is a dedicated `?` trigger in the selection datum bar that opens a contextual popover ("How Wall Geometry Works") without stealing property layout space.
* **Inline Reason Badges:** When an action is disabled (e.g., `Save to Cloud`), the control displays a muted pill containing a lock icon; clicking or focusing it reveals a precision tooltip stating the exact blocking condition (`"Document has unsaved interior topology loops"`).
* **Gesture Reject Horizon:** When a wall or junction placement is refused, the status bar flashes into an amber/crimson diagnostic strip with an actionable error code (`ERR_ZERO_LENGTH_WALL`), while the cursor displays a temporary refusal glyph.

### 5. Extension Model (P24 & P26)
* **P24 Staging Depth:** The Inspector’s Selection Datum strip shifts dynamically to display multi-selection count (`3 Selected · Primary: Plinth P-01`). Properties with mixed values render a dedicated `~ Mixed` glyph with an inline "Equalize" action. A destructive action slot at the base of the Inspector isolates the P24.4 Environment Reset button behind a 2-step confirmation drawer.
* **P26 Spatial Depth:** The View cluster in Tier 2 hosts the contextual instrument slot:
  `[Plan | 3D] ─── [/] ─── [Section: S-01 ▾] ── [✕ Return to Plan]`
  Clicking a section line in Plan opens this instrument, keeping the workspace grounded while displaying finite depth, cut planes, and boundary controls in a contextual Tier 2 bay.

### 6. Risks
* *Density Overload:* Novices may perceive the dual-deck top bar as CAD-like without onboarding.
* *Monochrome Fatigue:* The dark slate chassis requires strict contrast auditing to prevent low-contrast text failures in muted list rows (resolving Issue #34).

---

# 3. Concept 2: The Framed Atelier

> **Territory Anchor:** *Instrumented Atelier hybridized with Guided Spatial Desk.*  
> **Target Persona:** Spatial storytellers, exhibition curators, and architects who value tactile graphic design, material warmth, and minimum visual noise.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🏛 Untitled Exhibition  [Local Session] ▾       [Spatial | Publish]       (↶ ↷)  [Preview ↗]  [Profile]│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ WORKSPACE ─────────────────────────┐  ┌─ CANVAS UTILITIES ─────────────┐  ┌─ PANEL TOGGLES ───────┐ │
│ │ Scene ▾ / Plan ▾  │  Layout Mode    │  │ Snap: 0.25m  Grid: On  Tour    │  │ [Navigator] [Inspector]│ │
│ └─────────────────────────────────────┘  └────────────────────────────────┘  └───────────────────────┘ │
├─────────────────┬──────────────────────────────────────────────────────────────┬───────────────────────┤
│ ATELIER ROSTER  │ DRAWING TABLE & STUDIO VIEWPORT                              │ PROPERTY COMPASS      │
│ (260px)         │                                                              │ (300px)               │
│ Spaces (1)      │                                                              │ Wall Segment          │
│  └ Gallery 01   │                                                              │ W-FJSK                │
│                 │                                                              │                       │
│ Structure       │   ┌─── FLOATING TOOL MAST ───────────────────────────────┐   │ Dimension             │
│  └ Walls (4)    │   │ [↖ Select] [━ Wall] [□ Room] [▯ Door] [🪟 Window]   │   │ Length        4.90 m  │
│    ├ W-FJSK ────┼───│ Active: Wall Tool (Chained)                          │───┼─ Thickness     0.20 m  │
│    └ W-8812     │   └──────────────────────────────────────────────────────┘   │ Height        3.50 m  │
│                 │                                                              │                       │
│ Furnishings (0) │                                                              │ Topology Relations    │
│                 │                                                              │ Junction: J-5AEX (2)  │
│                 │                                                              │ Junction: J-7V24 (2)  │
│                 │                                                              │                       │
│                 │                                                              │ [Dissolve into Wall]  │
├─────────────────┴──────────────────────────────────────────────────────────────┴───────────────────────┤
│ CAMERA FLIGHT STRIP (Collapsed 48px / Expanded 288px)                                                  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ℹ Wall drafting active: Click to anchor junction, Shift for 45° snap.                Draft layout · (2) │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Thesis
A humanist, warm-neutral architectural studio that treats the workspace as a tactile drawing desk framed by quiet drafting rails. It solves control-weight flatness by collapsing the horizontal ribbon entirely: Domain and View are treated as a unified **Workspace Address** (`Scene / Plan / Layout`), while the drafting tools are pulled down into an anchored, floating **Canvas Tool Mast** positioned directly above the active drafting space. It brings warmth through limestone, vellum, and linen colorways, warm bronze accents, and editorial typography.

### 2. Shell Composition
* **Top Horizon (40 px, Unified Persistent Frame):** Warm light limestone (`#EAE8E3`). Carries project name, session badge, spatial/publish segmented pill, undo/redo, and visitor launch.
* **Sub-Header Shelf (28 px, Dynamic):** A whisper-quiet contextual shelf holding three distinct spatial stations:
  - *Left Station:* The **Workspace Address Breadcrumb** (`Scene ▾ / Plan ▾ / Layout Mode ▾`). Clicking any token reveals its sibling domains/views in a clean popover.
  - *Center Station:* Viewport settings (`Snap 0.25 m ▾`, `Grid On/Off`, `Tour View`).
  - *Right Station:* Panel visibility switches (`Left [|]`, `Right [|]`, `Focus \`).
* **Floating Tool Mast (Anchored in Viewport):** Instead of a fixed ribbon, drawing and editing tools reside in a floating, pill-shaped horizontal mast anchored 16 px inside the top-center of the viewport. It displays the active tool with clear iconography, text labels for complex tools, and an immediate escape/commit indicator (`Escape to finish`).
* **Left Rail — Atelier Roster (240–300 px):** Warm, paper-like sidebar. Categorizes elements into human-readable museum terminology: `Spaces` (Rooms), `Structure` (Walls, Openings), `Furnishings` (Placed Objects).
* **Right Rail — Property Compass (300 px):** Elegant, editorial Inspector. Opens with an uncluttered entity title card. Properties are organized using quiet hairline dividers and generous typographic hierarchy, completely eliminating nested box borders.
* **Timeline (Flight Strip):** Positioned at the base of the canvas in Camera domain. Uses an ivory-tinted timeline ruler with warm terracotta node markers, visually echoing physical film editing blocks.
* **Status Bar (24 px, Warm Sandstone):** Acts as a live instructor. Displays context-aware microcopy explaining what the next mouse click or keypress will do.

### 3. Visual System
* **Typography:** Editorial Grotesque (`Plus Jakarta Sans` or `Fraunces` for subtle structural titles) paired with crisp geometric sans (`Inter`) for property fields and tabular metrics.
* **Density & Metrics:** Medium density. Section row height: 30 px. Control height: 28 px. Soft, comfortable padding that reduces cognitive strain while retaining professional precision.
* **Surfaces & Shape:** Warm neutrals (`#F7F6F3` shell background, `#EFECE6` panel backgrounds, `#FFFFFF` input wells). Subtle rounded corners (6 px for panels and floating mast, 4 px for inputs). Delicate 1 px warm borders (`#DDD8D0`).
* **Color Roles & Semantic Discipline:**
  - *Canvas Paper:* Warm ivory vellum (`#FCFBF9`).
  - *Canonical Selection:* Deep Tuscan Bronze (`#2458D4` in Plan, with a warm `#1E3A8A` hover ring).
  - *Primary Entity:* Tuscan Bronze with a solid amber corner pip.
  - *Active Tool:* Warm Burnt Ochre (`#C86D27`).
  - *Snaps & Guides:* Aegean Teal (`#14746F`).
  - *Refusals:* Terracotta Red (`#BA3C2A`).
* **Interaction States:**
  - *Hover:* Soft tint fill (`rgba(0,0,0,0.03)`).
  - *Pressed:* Tactile 1 px depression.
  - *Keyboard Focus:* 2 px offset warm copper ring (`#C86D27`).

### 4. Educational Model
* **The Living Status Bar:** Instead of passive system coordinates, the status bar acts as an active drafting assistant: `"Click to place Junction J-04. Hold Shift to constrain to 90°"`.
* **Subtle Empty-State Watermarks:** Empty viewports or sequence lanes display soft architectural line drawings with dismissible, one-click action cards (`[+ Draw First Wall]`, `[+ Place Camera]`).
* **Reasoned Action Tooltips:** Disabled buttons explain their state in natural language without jargon: `"Cannot join walls: Selected junction connects 3 walls (maximum 2 permitted for join)"`.

### 5. Extension Model (P24 & P26)
* **P24 Staging Depth:** The Atelier Roster expands its `Furnishings` tree into a multi-tiered display of Collections, Models, and Lights. The Property Compass handles mixed selections by displaying a comparative property column with an `"Apply to all 3"` bulk-commit control.
* **P26 Spatial Depth:** The Workspace Address breadcrumb naturally absorbs contextual instruments:
  `Scene / Section: North Gallery Elevation ▾ / Layout`
  A visible `"Return to Plan View ✕"` chip mounts directly into the Floating Tool Mast, ensuring users never get lost in nested orthographic cuts.

### 6. Risks
* *Floating UI Collision:* The Floating Tool Mast could occlude drafting geometry on small viewports (mitigated by auto-minimizing to an icon-only pill during active drawing gestures).
* *Aesthetic Softness:* If the warm palette is tuned too soft, the product risks feeling like a consumer illustration tool rather than a precise spatial authoring instrument.

---

# 4. Concept 3: The Optical Suite

> **Territory Anchor:** *Editorial Control Room hybridized with Technical Atelier.*  
> **Target Persona:** Creators who move fluidly between physical layout authoring and cinematic spatial staging; prioritizes visual focus, optical calibration, and unified spatial/temporal control.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ME] Untitled Exhibition    Scene [Camera]   Plan [3D]   [+ Elevation]     ↶ ↷  [Play Tour ▷] [Publish]│
├───────────────────┬────────────────────────────────────────────────────────────┬───────────────────────┤
│ SCENE GRAPH       │ DIRECTORIAL WORKSPACE                                      │ OPTICAL INSPECTOR     │
│ 280px             │ (WebGL 3D Viewport / SVG Plan)                             │ 300px                 │
│ ┌───────────────┐ │                                                            │ ┌───────────────────┐ │
│ │◉ Focus Active │ │                                                            │ │CAMERA NODE C-01   │ │
│ ├───────────────┤ │                                                            │ │Path 01 · 00:04.20 │ │
│ │▾ CAMERAS (4)  │ │                                                            │ ├───────────────────┤ │
│ │  ▶ C-01 (Seq) │ │                                                            │ │TRANSFORM          │ │
│ │    C-02 (Seq) │ │              [3D Camera Frustum Cone Active]               │ │X  1.20m  Y  1.60m │ │
│ │    C-03 (Seq) │ │                                                            │ │Z -4.50m  Pitch 0° │ │
│ │    C-04 (Free)│ │                                                            │ ├───────────────────┤ │
│ │▾ LIGHTS (2)   │ │                                                            │ │OPTICS             │ │
│ │  Spot North   │ │                                                            │ │FOV           65°  │ │
│ │▾ SPATIAL MASS │ │                                                            │ │Focal Dist  4.20m  │ │
│ │  Room East    │ │                                                            │ ├───────────────────┤ │
│ │  4 Walls      │ │                                                            │ │ACTIONS            │ │
│ └───────────────┘ │                                                            │ │[Align View to Cam]│ │
├───────────────────┴────────────────────────────────────────────────────────────┴───────────────────────┤
│ CAMERA TIMELINE (Expanded 288px) — Synchronized with 3D Canvas Grid                                    │
│ [▷ Play] [00:04.20 / 00:12.00]  Scope: Full Tour ▾  │ Zoom: [─|───]   [POV | Observer]   [⚙ Lanes ▾]  │
│ 01 Path   ├───[C-01]───────────────[C-02]────────────────────────[C-03]───────────────┤               │
│ 02 Shots  ├───[Shot 1: Wide]───────[Shot 2: Gallery Arch]───────[Shot 3: Close]──────┤               │
│ 03 FOV    ├───(65°)────────────────(55°)────────────────────────(70°)─────────────────┤               │
│ 04 LookAt ├───[Target: North Wall]─[Target: Exhibit Center]─────[Target: Plinth P1]───┤               │
│ 05 Roll   ├───[0° Constant]────────[0° Constant]────────────────[0° Constant]─────────┤               │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Camera • 3D | Sequence Active (3 Nodes) | 60 FPS | Space: Play/Pause | F: Focus Selected | \ Hide Shell│
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Thesis
A calibrated, cinematic control suite engineered for seamless authoring across spatial geometry and temporal movement. It eliminates the distinction between "a drawing tool" and "a movie editor" by collapsing global chrome into a single, high-efficiency **Horizon Bar (38 px)** that expresses workspace depth as a unified hierarchy path. The Camera Timeline is elevated from a docked secondary panel to a first-class **Temporal Stage Deck**, aligned to the viewport's spatial grid.

### 2. Shell Composition
* **The Horizon Bar (38 px, Unified Top Control):** Single persistent top header. Houses:
  - *Project Identity & Sync State:* Left-aligned compact logo and status badge.
  - *Unified Context Path:* An interactive, high-contrast segment ladder:
    `Domain: [Scene | Camera]` ➔ `View: [Plan | 3D | +Instrument]` ➔ `Mode: [Layout | Arrange]`
    Each level is visually differentiated by shape and tone (Domain is a high-contrast pill; View is an engraved latch; Mode is a secondary border-segment).
  - *Global Utilities:* Undo/Redo, Tour Player toggle, and Cloud Publication switch.
* **Contextual Tool Strip (In-Canvas HUD):** Left-aligned vertical toolbar resting inside the viewport canvas boundary. Semi-translucent obsidian glass (`rgba(16, 18, 22, 0.85)` with background blur). Holds view-specific tools (Move, Rotate, Scale in 3D; Wall, Opening, Room in Plan).
* **Left Rail — Scene Graph (240–300 px):** Unified spatial-temporal tree. In Scene domain, displays architectural rooms and staging assets. In Camera domain, seamlessly shifts into the Camera Sequence Graph (Sequenced Nodes, Unsequenced Nodes, Light rigs) with clear drag-to-sequence drop targets.
* **Right Rail — Optical Inspector (300 px):** Precision optical and geometric property stack. High visual hierarchy: large numeric readouts, integrated slider-steppers, and collapsible camera/lens/spatial sections.
* **Temporal Stage Deck (Camera Timeline):** The core signature of this concept. When expanded (288 px), it shares exact column alignment with the left and right rails. The track label column (120 px) precisely matches the left rail’s inner alignment. Timeline scrubbing dynamically manipulates the 3D viewport's camera frustum in real time.
* **Status Horizon (24 px):** Calibrated dark strip displaying active transport state, timecode, active selection coordinate metrics, and quick hotkey indicators.

### 3. Visual System
* **Typography:** Clean technical grotesk (`Geist Sans` or `Aptos`) paired with optical monospace (`Geist Mono`) for timecodes, coordinates, degrees, and focal lengths.
* **Density & Metrics:** High-precision compact density. Section header: 24 px. Numeric row: 24 px. Top bar: 38 px. Minimizes wasted vertical chrome to give maximum area to the 3D frustum and Plan canvas.
* **Surfaces & Shape:** Calibrated dark neutrals (`#0A0B0D` canvas void, `#13151A` shell panels, `#1D212A` elevated HUDs). Precision chamfered corners (1 px micro-bevels). Thin, luminous dividing borders (`rgba(255,255,255,0.07)`).
* **Color Roles & Semantic Discipline:**
  - *Canvas Paper:* Neutral Technical Drafting Slate (`#EAEDF1`) in Plan; Pure Optical Black (`#050608`) in 3D.
  - *Canonical Selection:* Vivid Optical Cyan (`#00E5FF`).
  - *Primary Entity:* Optical Cyan with bright white pip.
  - *Camera Domain Accent:* Amber Topaz (`#FFB300`), used on camera paths, frustum wires, and timeline node diamonds.
  - *Active Tool:* Bright Phosphor Mint (`#00F5A0`).
  - *Refusals & Warnings:* Laser Crimson (`#FF3366`).
* **Interaction States:**
  - *Hover:* 1 px luminous border highlight (`rgba(0, 229, 255, 0.3)`).
  - *Active/Latched:* Solid dark background with vivid phosphor accent line.
  - *Keyboard Focus:* Crisp 2 px Cyan corner brackets framing the focused input well.

### 4. Educational Model
* **The Optical Heads-Up Display (HUD):** Hovering over any spatial tool or camera handle displays a non-intrusive micro-HUD in the corner of the canvas indicating shortcut keys, mouse button actions, and spatial constraints.
* **Visual Frustum Guides:** Selecting an unsequenced camera node in 3D projects an interactive guide ray toward the nearest path connection point, visually instructing the user how to drag it into the active sequence without reading prose.
* **Refusal Reason Strips:** Any failed geometry edit triggers a red diagnostic banner directly below the Horizon bar that automatically collapses after 4 seconds or upon gesture correction.

### 5. Extension Model (P24 & P26)
* **P24 Staging Depth:** The Optical Inspector effortlessly incorporates complex P24 material nodes and P24.4 Light/Environment properties. The Scene Graph supports multi-selection with an explicit primary indicator:
  `[●] Plinth P-01 (Primary)   [✔] Plinth P-02   [✔] Plinth P-03`
  Mixed transforms display interactive range sliders with dual-thumb bounds.
* **P26 Spatial Depth:** The Horizon Bar natively hosts nested orthographic views via a third view slot:
  `Plan | Ortho [Section A-A ▾] | 3D`
  Entering Section mode isolates the camera cut plane, dynamically adjusting the Temporal Stage Deck into an Orthographic Profile Inspector.

### 6. Risks
* *Dark-Mode Bias:* The dark cinematic palette requires careful handling in Plan mode to prevent the light SVG canvas from creating extreme eye strain (mitigated by offering a Calibrated Slate Plan canvas option).
* *Camera Domain Dominance:* Spatial drafting must not feel subordinate to camera direction when working in pure Build/Layout mode.

---

# 5. Visual System Comparison & Architecture Matrix

| System Dimension | Concept 1: The Curatorial Console | Concept 2: The Framed Atelier | Concept 3: The Optical Suite |
|---|---|---|---|
| **Design Philosophy** | Mechanical precision workbench; high-trust tactile console | Warm humanist studio; material drafting desk | Calibrated cinematic suite; director control room |
| **Top Chrome Composition** | Dual-deck: 36 px Global Bar + 34 px Workstation Armature (70 px total) | Unified 40 px Horizon + 28 px Context Shelf (68 px total) | Single integrated 38 px Horizon Bar with Context Path (38 px total) |
| **Tool Placement** | Tier 2 right datum; latched 28 px mechanical buttons | Floating 36 px Tool Mast anchored in top-center viewport | Vertical 32 px semi-translucent HUD strip inside viewport |
| **Palette & Tonal System** | Dark slate (`#16181D`) framing off-white paper (`#F5F6F8`) | Warm limestone (`#EAE8E3`) framing ivory vellum (`#FCFBF9`) | Calibrated dark neutral (`#13151A`) framing technical paper (`#EAEDF1`) |
| **Signature Accent** | Precision Cobalt (`#2D68FF`) + Mechanical Ochre (`#D99B26`) | Tuscan Bronze (`#2458D4`) + Burnt Ochre (`#C86D27`) | Optical Cyan (`#00E5FF`) + Directorial Amber (`#FFB300`) |
| **Typography** | Inter + JetBrains Mono (rigorous tabular alignment) | Plus Jakarta Sans + Inter (editorial warmth) | Geist Sans + Geist Mono (compact optical precision) |
| **Corner & Edge Language** | Sharp 2 px radii, crisp structural 1 px bulkheads | Soft 6 px radii, warm hairline dividers, organic padding | Technical 1 px chamfered corners, luminous micro-lines |
| **Inspector Lead-in** | Actionable Selection Datum Strip (Name, Ref, Quick Actions) | Typographic Title Card (Humanist entity name & category) | Optical Property Header (Coordinates, IDs, Quick Focus) |
| **Timeline Integration** | 100% viewport width docked console; mechanical tracks | Warm vellum flight strip; tactile node blocks | Aligned grid deck; track headers match left rail boundary |
| **Canvas Utility Home** | Viewport top-right cluster (Grid, Snap, Orbit Gizmo) | Sub-header center shelf (Snap, Grid, Tour) | Integrated viewport top-right HUD |
| **Educational Vector** | Actionable `?` popovers + reason-coded error toasts | Natural-language live status bar + empty-state watermarks | Heads-Up Display tooltips + visual spatial connection rays |

---

# 6. Demonstration Across Canonical Review States (A–F)

To ensure fair and rigorous evaluation, all three concepts are evaluated against the mandatory states from Brief §12 and Context §15.

```
+──────────────────────────────────────────────────────────────────────────────────────────────────────────────────+
| CANONICAL REVIEW STATE MATRIX                                                                                    |
+──────────────────────────┬───────────────────────────────────────┬───────────────────────────────────────┬───────+
| State                    | Concept 1: Curatorial Console         | Concept 2: Framed Atelier             | Con   |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| A: Scene · Plan (Layout) | Dual-deck top bar; dark slate rails;  | Warm limestone frame; floating tool   | Singl |
|                          | off-white paper canvas; compact       | mast at top of vellum canvas;         | verti |
|                          | scannable architecture tree; property | editorial Inspector; live status bar  | slate |
|                          | sections led by W-FJSK datum card.    | assistant microcopy.                  | Ins   |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| B: Active Wall Operation | Latched Wall tool in Ochre; ghost     | Tool Mast shows active chained Wall   | Activ |
|                          | wall with live mono dimension; teal   | state; status bar prompts click/snap; | live  |
|                          | snap marker; refusal toast at base    | soft refusal card floats above cursor | HUD c |
|                          | if length is zero.                    | on invalid geometry.                  | strip |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| C: Scene · 3D (Selected) | Dark 3D viewport; 3D gizmo top-right; | Rich 3D canvas; floating tool mast    | Pure  |
|                          | transform matrix in Inspector;        | switches to spatial layout mode;      | selec |
|                          | Local/World toggle in Tier 2 right;   | Inspector shows warm material and     | trans |
|                          | P23.15 seams uncompensated.           | transform sliders.                    | HUD.  |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| D: Camera · Plan (Graph) | Domain toggle latched to Camera;      | Workspace address reads "Camera /     | Domai |
|                          | architectural plan dims to 60%        | Plan"; architectural drawing softens; | Archi |
|                          | contrast; amber camera nodes & paths; | terracotta camera nodes; sequence     | nodes |
|                          | sidebar hosts camera drop-target.     | drop target highlights.               | view  |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| E: Camera · 3D +Timeline | Docked 288 px / 48 px timeline;       | Tactile film-strip timeline; warm     | Stage |
|                          | full-width alignment; no-flow empty   | empty-state sequence prompt;          | rail  |
|                          | body shows clear "No Sequence" badge; | 3D viewport projects blue frustum     | frust |
|                          | 3D viewport shows 1 px frustum line.  | with occluded fill.                   | scann |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| F: Dense High-Pressure   | 21 rooms / 48 walls; Navigator uses   | Semantic zoom sheds wall dims;        | Graph |
|                          | virtualized scannable rows; Inspector | Inspector uses collapsible sections;  | badge |
|                          | uses compact 24 px rows; warnings     | warnings group into a quiet status    | warns |
|                          | grouped in dedicated collapsible bay. | pill without cluttering work surface. | per-p |
+──────────────────────────┴───────────────────────────────────────┴───────────────────────────────────────┴───────+
```

---

### Deep Walkthrough: Review State E (Camera · 3D + Timeline)

State E is a critical differentiator for shell integration and directly tests the trust and alignment contracts.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STATE E: CAMERA · 3D WITH POPULATED TIMELINE (Concept 1: Curatorial Console Presentation)             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Scene | Camera ▾]  [Plan | 3D ▾]  │  [Connect] [Frame] [Observer | POV]  │  Snap: Off  Grid: On       │
├───────────────────┬────────────────────────────────────────────────────────────┬───────────────────────┤
│ CAMERA GRAPH      │ 3D VIEWPORT                                                │ CAMERA INSPECTOR      │
│ ▾ Sequence (3)    │                                                            │ Node C-01             │
│   ● Node C-01     │                    ┌──────────┐                            │ Hold: 0.5s            │
│   ○ Node C-02     │                   ╱            ╲                           │ Transition: 3.2s      │
│   ○ Node C-03     │                  ╱   Frustum    ╲                          │ Easing: Smooth-Step   │
│   Unsequenced (1) │                 ┌────────────────┐                         │                       │
│     Node C-04     │                 │ Target: Room 1 │                         │ [Delete Camera Node]  │
├───────────────────┴─────────────────┴────────────────┴─────────────────────────┴───────────────────────┤
│ TIMELINE DOCK (288px) — Camera Domain Owned                                                           │
│ ┌────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [⟲] [▷ Play] [00:03.70 / 00:10.50]  Scope: Tour Sequence ▾  │ Track Height: =  │ [POV ▾] [Frame] [x]│ │
│ ├────────────┬───────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ Path       │ 00:00        00:02        00:04        00:06        00:08        00:10                 │ │
│ │            │ ───◆[C-01]─────────────────◆[C-02]───────────────────◆[C-03]──────────────────────┤ │
│ │ Shots      │ ───[Shot 1: Entry Hold]────[Shot 2: Arch Approach]───[Shot 3: Gallery Pan]─────────┤ │
│ │ FOV        │ ───(65°)───────────────────(50°)─────────────────────(65°)─────────────────────────┤ │
│ │ Look At    │ ───[Target: J-01]──────────[Target: Interior Center]─[Target: North Wall]──────────┤ │
│ │ Roll       │ ───0° (Fixed)──────────────0° (Fixed)────────────────0° (Fixed)────────────────────┤ │
│ └────────────┴───────────────────────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Camera • 3D | Node C-01 Selected | Frustum Visible (Occluded 9%) | Space: Play | \ Collapse Timeline   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### How Each Concept Resolves the Three Sub-States of State E:
1. **Sub-State 1: Expanded with a Populated Flow:**
   - *Concept 1 (Console):* Aligns the timeline dock edge-to-edge across the viewport. The track headers (80 px) anchor the five lanes. Node diamonds, shot blocks, and FOV curves share mechanical ochre accents. `Roll` is visually compressed to a 20 px secondary track marked with a subtle padlock glyph, indicating its fixed architectural constraint without lying about interactivity.
   - *Concept 2 (Atelier):* Renders the timeline as an ivory-toned Flight Strip. Shot blocks resemble physical film segments with human-readable hold labels.
   - *Concept 3 (Optical Suite):* Aligns track labels to match the Left Rail width (240–300 px) exactly, creating a clean continuous vertical datum. The FOV lane renders an interactive optical envelope line.
2. **Sub-State 2: Expanded with No Flow (Empty Sequence):**
   - *All Concepts:* Maintain the full 288 px dock height (preventing jarring viewport jumps), render the 36 px transport header with scope chip `No sequence yet`, and present an **authored empty state body** instead of a broken grid:
     ```
     ┌─────────────────────────────────────────────────────────────────────────────────┐
     │ ⤹ Connect at least 2 camera nodes in Plan or 3D to generate a cinematic tour.  │
     │   [+ Place First Camera Node]         [Learn Camera Flow Basics ↗]             │
     └─────────────────────────────────────────────────────────────────────────────────┘
     ```
3. **Sub-State 3: Collapsed 48 px Mini-Player:**
   - *Concept 1 & 3:* Pinned 100% across the viewport base, eliminating the current 760 px width-fragmentation bug. Contains: Scope Badge (`Full Tour`), Step-Back, Play/Pause, Step-Forward, Timecode Readout (`00:03.70`), Scrubber bar (omitted in no-flow mode), `POV | Observer` toggle, and Expand Chevron (`▾`).
   - *Concept 2:* Renders a centered tactile pill (floating 8 px above the status bar) that expands smoothly upward upon click.

---

### Deep Walkthrough: Review State F (Dense / High-Pressure State)

State F tests whether the visual system degrades gracefully under heavy informational load (21 rooms, 48 walls, multiple openings, active warnings).

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STATE F: DENSE ARCHITECTURAL STATE (Concept 1: Curatorial Console Presentation)                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ME] Grand Municipal Gallery ▾ [Cloud Synced]   [Spatial | Publish]   ↶ ↷  [Visitor ↗]  [Admin]        │
├───────────────────────────────────────────────────────┬────────────────────────────────────────────────┤
│ DOMAIN: [Scene ▾]  VIEW: [Plan | 3D : +Ortho]         │ STANCE: [Layout | Arrange]  │  [Tool Armature] │
├───────────────────┬───────────────────────────────────┴────────────────────────┬───────────────────────┤
│ NAVIGATOR (280px) │ VIEWPORT (Plan Canvas — 21 Rooms / 48 Walls Active)        │ INSPECTOR (300px)     │
│ ┌───────────────┐ │ ┌────────────────────────────────────────────────────────┐ │ ┌───────────────────┐ │
│ │Filter: Wall Q│ │ │ [Wall drafting active]            Draft layout · dirty │ │ │WALL: W-88B1       │ │
│ ├───────────────┤ │ │                                                        │ │ │Ref: J-12→J-14     │ │
│ │▾ ROOMS (21)   │ │ │     ┌─────────┐ ┌─────────┐ ┌─────────┐                │ │ ├───────────────────┤ │
│ │  ► R-01 Main  │ │ │     │ Room 01 │ │ Room 02 │ │ Room 03 │                │ │▼ GEOMETRY         │ │
│ │  ► R-02 Wing  │ │ │     └───┬─────┘ └───┬─────┘ └───┬─────┘                │ │  Length   12.40 m │ │
│ │  ▼ R-03 Court │ │ │         │           │           │                      │ │  Thick    0.30 m  │ │
│ │    W-88B1 ────┼─┼───────────┴───────────┴───────────┴──────[Selected Wall]─┼─►  Height   4.50 m  │ │
│ │    W-88B2     │ │                                                          │ │ ├───────────────────┤ │
│ │▾ WALLS (48)   │ │                                                          │ │▼ WARNINGS (1)     │ │
│ │  ● W-88B1     │ │                                                          │ │  ⚠ Non-standard   │ │
│ │  ○ W-88B2     │ │                                                          │ │    thickness      │ │
│ │  ○ W-88B3     │ │                                                          │ │ ├───────────────────┤ │
│ │▾ ISSUES (2)   │ │                                                          │ │▼ OPENINGS (2)     │ │
│ │  ⚠ Overlap    │ │                                                          │ │  D-01 (1.20 m)    │ │
│ └───────────────┘ │ └────────────────────────────────────────────────────────┘ │ └───────────────────┘ │
├───────────────────┴────────────────────────────────────────────────────────────┴───────────────────────┤
│ Scene • Plan | 21 Rooms · 48 Walls · 2 Warnings | Cursor: 14.20m, 8.40m | Snap: 0.25m | Shift: Constraint │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### How Each Concept Manages High Information Load:
* **Navigator Density Shedding:**
  - *Concept 1 (Console):* Activates virtualized row rendering with a sticky search/filter bar. Category groups (`Rooms`, `Walls`, `Openings`) collapse to single summary rows with count chips (`Walls (48)`). Individual wall rows compress to 22 px height using compact display references (`W-88B1`). Non-selectable junction relations are suppressed from the hierarchy tree.
  - *Concept 2 (Atelier):* Groups elements by assigned architectural zones. When count exceeds 15, the list automatically clusters into expandable sub-accordions with clean letter-index anchors.
  - *Concept 3 (Optical Suite):* Introduces a high-density "Mini-Map Rail" toggle, allowing users to scrub the hierarchy graphically by spatial coordinates.
* **Canvas Label Shedding (Settled P23.13 Enforcement):**
  - All concepts inherit P23.13 semantic zoom: At minimum zoom, wall dimension readouts shed first, followed by secondary junction markers, leaving room identity tags and boundary silhouettes crisp and unoccluded.
* **Inspector Accordion Discipline:**
  - *Concept 1 & 3:* Enforce a strict "Solo Section" option. Opening `Geometry` smoothly collapses `Openings` if vertical viewport height falls below 800 px, preventing accordion archaeology.

---

# 7. Concept-Review Pressure Tests Evaluation

Below is the explicit evaluation of all three concepts against the 14 pressure tests defined in Brief §13 and Context §16.

```
+──────────────────────────────────────────────────────────────────────────────────────────────────────────────────+
| PRESSURE TEST EVALUATION MATRIX                                                                                  |
+──────────────────────────┬───────────────────────────────────────┬───────────────────────────────────────┬───────+
| Pressure Test            | Concept 1: Curatorial Console         | Concept 2: Framed Atelier             | Con   |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 1. Semantic Hierarchy    | PASS. Strict 2-tier mechanical deck;  | PASS. Breadcrumb address ladder;      | PASS  |
|                          | domain, view, mode, and tool have     | floating tool mast is separated from  | laddr |
|                          | completely different geometry/tone.   | persistent workspace settings.        | diffe |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 2. Primary Viewport      | PASS. Viewport framed by quiet dark   | PASS. Warm limestone rails yield to   | PASS  |
|                          | slate rails; active tools quieten     | bright vellum canvas; tool mast auto- | semi- |
|                          | peripheral chrome during gestures.    | dims during drawing gestures.         | viewp |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 3. Selection Coherence   | PASS. Vivid Cobalt outer contour in   | PASS. Tuscan Bronze stroke across SVG | PASS  |
|                          | canvas = Cobalt tree marker in rail = | canvas, roster row, and property      | acti  |
|                          | Cobalt Selection Datum header.        | compass header.                       | graph |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 4. Density Degradation   | PASS. Compact 24 px rows, tabular     | PASS. Semantic clustering by zone;    | PASS  |
|                          | numerics, virtualized trees, solo     | graceful label shedding under P23.13  | mono  |
|                          | section mode in Inspector.            | rules.                                | secti |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 5. P24 Staging Future    | PASS. Selection Datum supports        | PASS. Comparative property columns;   | PASS  |
|                          | ordered sets (`Primary: P-01`);       | mixed-value pills; explicit reset     | multi |
|                          | mixed values display `~ Mixed`.       | action drawer.                        | thum  |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 6. P26 Spatial Future    | PASS. Dedicated Tier 2 instrument     | PASS. Contextual breadcrumb takeover  | PASS  |
|                          | notch (`+ Ortho ▾`) with clear return | with explicit `[Return to Plan ✕]`    | slot  |
|                          | path; never hardcodes 2 view slots.   | escape chip.                          | viewp |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 7. Timeline Native Feel  | PASS. 100% viewport width alignment;  | PASS. Tactile film-strip integration; | PASS  |
|                          | 48 px mini-player matches shell grid; | authored empty state; no-flow         | colu  |
|                          | authored empty body.                  | transport strip.                      | 48 px |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 8. Education Boundaries  | PASS. Actionable `?` triggers; inline | PASS. Living status bar prompts next  | PASS  |
|                          | reason badges on disabled buttons;    | gesture; natural language refusal     | toolt |
|                          | zero static tutorial prose.           | tooltips.                             | toast |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 9. Trust & No Mute Tools | PASS. Mute room rotation handle       | PASS. Silent handle removed; unjoin-  | PASS  |
|                          | retired; unjoinable junctions show    | able junctions display lock badge     | junct |
|                          | refusal reason code.                  | with explanatory tooltip.             | state |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 10. Value Ownership      | PASS. Canvas owns gesture; Inspector  | PASS. Grid/Snap owned exclusively by  | PASS  |
|                          | owns properties; Navigator owns       | Sub-header shelf; status bar echoes   | viewp |
|                          | counts; zero duplicate controls.      | passively without interaction.        | statu |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 11. Focus Mode (\)       | PASS. Rails collapse to `0 1fr 0`;    | PASS. Rails slide off-canvas; active  | PASS  |
|                          | selected entity chip floats in        | selection badge anchors to top-right; | HUD f |
|                          | canvas; `\` key restores layout.      | escape tab visible.                   | statu |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 12. Distinct Identity    | PASS. Mechanical workbench character; | PASS. Warm architectural atelier;     | PASS  |
|                          | survives theme shifts via typography, | vellum desk feel survives palette     | ident |
|                          | latched wells, and structural datums. | shifts.                               | optic |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 13. P23.15 Honesty       | PASS. No seam-masking chrome or fake  | PASS. 3D view renders raw compile     | PASS  |
|                          | bevels in 3D; ready for P23.15        | without artificial smoothing or       | geome |
|                          | tessellation.                         | perimeter coverups.                   | visual |
+──────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────┼───────+
| 14. Label Discipline     | PASS. Strictly enforces P23.12:       | PASS. Strictly enforces P23.12:       | PASS  |
|                          | Authored Name primary, Compact Ref    | Authored Name primary, Compact Ref    | Autho |
|                          | secondary, raw ID debug-only.         | secondary.                            | secon |
+──────────────────────────┴───────────────────────────────────────┴───────────────────────────────────────┴───────+
```

---

# 8. Resolution of Key Open System Questions

These positions resolve the open design questions formulated in Context §17 and Research §9:

### Q1: The Canvas/Paper Relationship
* **Settled Position:** The shell must act as a **calibrated frame around the drawing paper**, not an extension of it. The Plan canvas retains the settled P23.13 off-white drafting surface (`#F5F6F8`) with its physical graphite line weight, while the shell provides an optical border step. In 3D, the canvas shifts to an architectural void (`#0D0E11`), while the shell maintains its exact spatial landmarks.

### Q2: Resolving the Row 2 Control-Weight Flatness
* **Settled Position:** The flat run of chips is abolished. Domain (`Scene | Camera`) is promoted to a high-contrast structural anchor. View (`Plan | 3D`) is treated as an extensible spatial aperture. Stance (`Layout | Arrange`) is placed in a secondary operational zone. Tools are grouped into a dedicated, latched matrix with explicit hotkey badges.

### Q3: Evicting Prose from the Inspector
* **Settled Position:** The Inspector must be **100% property-first**. The 6-row summary block and wall-first tutorial text are completely removed. A selected Wall immediately displays its Name, Reference ID, and editable Length/Thickness fields. Learning is transferred to:
  1. *The Empty Selection State:* A clean graphic illustrating how to pick an element.
  2. *Refusal Tooltips:* Explaining why an invalid edit was blocked.
  3. *An On-Demand Info Trigger:* Accessible via keyboard or click, never occupying vertical property space.

### Q4: Camera Timeline Alignment & Mute Lanes
* **Settled Position:** The collapsed 48 px mini-player is expanded to 100% of the viewport width, terminating the 760 px centered fragmentation. In expanded mode, track headers align with the workspace grid.
* *The `Roll` Lane Resolution:* Camera product contracts prohibit deleting the `Roll` lane during P23.14. However, because `Roll` is a constant `0°` in all current scopes, its presentation is visually compressed into a slim 20 px "Fixed Constraint" strip with a small lock icon. This honors the trust test: it communicates that Roll is constrained, avoiding misleading promises of drag-editability.
* *The `No-Flow` Body Resolution:* In no-flow scope, the 288 px dock is preserved to avoid viewport jumping, rendering an authored onboarding graphic that guides the creator to place and link camera nodes.

### Q5: PR #57 Junction Dissolve Entry Point
* **Settled Position:** Following PR #57, degree-2 Junctions can be dissolved via Backspace/Delete. P23.14 provides the deferred official Inspector entry point:
  - When a degree-2 Junction is selected, an action button `[Dissolve into Continuous Wall]` mounts at the base of the Inspector.
  - If the junction connects 3 or more walls, the button renders in a disabled state with an inline reason badge: `"Cannot dissolve: Junction connects >2 walls"`.

---

# 9. Recommendation & Strategic Next Steps

All three concepts provide a durable visual operating system that solves control-weight flatness, respects fixed architectural contracts, and creates a high-ceiling foundation for P24 and P26.

### Architectural Recommendation: **Concept 1 (The Curatorial Console)**
While **Concept 2 (The Framed Atelier)** offers unmatched warmth and **Concept 3 (The Optical Suite)** provides cinematic drama, **Concept 1 (The Curatorial Console)** offers the highest operational ceiling for Museum Editor:
1. Its **dual-deck Command Horizon** creates an unshakeable visual grammar for rank that cleanly absorbs P26 orthographic instruments without floating UI collisions.
2. Its **Actionable Selection Datum Strip** instantly transforms the Inspector from an amateur tutorial panel into a professional property editor.
3. Its **structural bulkhead geometry** accommodates both the dense mathematical topology of the architectural Build phase and the multi-selection demands of the upcoming P24 Stage phase.

### Immediate Action Plan for Phase Selection:
1. **Design Review Session:** Review Concepts 1, 2, and 3 with product and engineering stakeholders against Canonical Review States A–F.
2. **Prototype the Chosen Rank Grammar:** Build a high-fidelity interactive prototype of the selected top chrome structure to validate keyboard traversal and focus transitions (addressing absorbed issues #38, #39, #40, #41).
3. **Execute Production Design Specification:** Formulate the definitive P23.14 design tokens (typography scale, elevation system, surface roles, and component specs) ready for implementation on `main`.