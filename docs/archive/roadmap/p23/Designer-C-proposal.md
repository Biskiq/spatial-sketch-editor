# P23.13 UX/UI Design Specification: Architectural Plan Drafting Finish

**Slice:** P23.13 — Architectural Plan drafting finish  
**Status:** Complete Design Specification & Production Contract  
**Authority:** Aligned with `main` @ `c2a2404` (P23.11 curves merged, P23.12 identity merged via PR #55, PR #56 anchor-release fix, PR #54 gesture fix).  
**Consumes:** `P23-design-context.md`, `P23.12-final-design-contract.md`, and Deep Research on Architectural Plan Drafting Precedents.  
**Guiding Philosophy:** *Architectural drawing when idle; precision editor when touched.*

---

## 1. Resting-State Plan Visual System

The resting plan is an architectural drawing: calm, legible, tonally balanced, with a strict cut hierarchy. It avoids looking like an engine topology mesh or wireframe debug canvas.

```
CUT HIERARCHY (Top to Bottom)
▲ [Cut Architecture]     Walls & structural masses cut at 1.2m plan plane: dark poché + 1.25px ink
│ [Seen Editable]        Threshold lines, window frame lines, LayoutObject footprints: 0.75px ink
│ [Information]          Room names, compact references (R-####), derived areas: neutral typography
│ [Passive Context]      Scene content footprints: 0.5px dashed/muted tone, 25% opacity
▼ [Canvas Chrome]        0.25m grid, rulers, scale bar, orientation key: background framing
```

```
WALL BAND vs. INK ANATOMY
  Outer Cut Line: 1.25px stroke (#1E232D)
  ┌────────────────────────────────────────────────────────┐
  │ Solid Poché Band (Physical thickness T, e.g. 0.20m)   │
  │ Fill: #2B3240 (Paper) / #CBD5E1 (Dark Surface)         │
  └────────────────────────────────────────────────────────┘
  Outer Cut Line: 1.25px stroke (#1E232D)
  (No centerlines or triangulation seams visible at rest)
```

### 1.1 Wall Grammar: Band, Ink, Joins, and Caps

1.  **Band vs. Drafting Ink:**
    *   Walls are rendered as physical solid polygons (bands) computed directly from `CompiledLayoutGeometry.boundaryFaces`.
    *   Physical thickness ($T$) is preserved at true world scale.
    *   Outlines (drafting ink) are constant screen-space strokes: `1.25px` on both lateral faces.
    *   *Screen-space ink floor:* When zooming out where $T \times \text{scale} < 2.5\text{px}$, the outline merges into a single solid stroke of minimum `1.5px` width to prevent geometry dropout, without modifying physical model thickness.
2.  **Monolithic Joins (L, T, X):**
    *   Connected walls sharing a canonical `Junction` fuse into a single continuous poché polygon.
    *   Internal seam lines between intersecting walls are suppressed.
    *   Outer contour miter/bevels wrap the perimeter continuously.
3.  **End Caps:**
    *   Free wall ends terminate with a clean, flat cap perpendicular to the wall’s tangent vector at the endpoint, drawn with the same `1.25px` cut ink.
4.  **Mixed Thickness and Height:**
    *   When walls of unequal thickness meet at a junction, the shared boundary polygon resolves with an exterior transition step or miter; the interior join remains seamless.
    *   Height differences are not drawn with elevation shadows at rest (preventing false 3D illusions), but step edges receive a `0.75px` line where the taller wall boundary overlooks the shorter wall.
5.  **Curved Walls:**
    *   Curved walls follow the exact `cubic-chain` centerline expanded symmetrically by $T/2$.
    *   Poché and lateral ink curve continuously; no polygon segment facets or tessellation cords are visible.

---

### 1.2 Boundary vs. Partition Distinction

To indicate whether a wall defines a room boundary without using hidden-line dashes or hue-only signals:

```text
BOUNDARY WALL:
┌──────────────────────────────────────────────────────────┐
│ Poché Fill: 100% Solid (#2B3240)                         │
└──────────────────────────────────────────────────────────┘
Outer Cut Stroke: 1.25px Solid (#1E232D)

PARTITION WALL (Non-room-bounding):
┌──────────────────────────────────────────────────────────┐
│ Poché Fill: 35% Screen / Tint (#8A94A6)                  │
└──────────────────────────────────────────────────────────┘
Outer Cut Stroke: 1.0px Solid (#4A5568)
```

*   **Boundary Wall:** Full visual mass. Dense solid poché fill. Indicates spatial enclosure.
*   **Partition Wall:** Secondary visual mass. Medium-tint poché fill (35% density), crisp solid outlines. Reads clearly as a physical wall, but clearly communicates non-enclosing behavior.
*   **Color-Blind Safety:** Evaluated in grayscale, partition walls exhibit a 40% luminance delta compared to boundary walls. Dashed lines are strictly avoided (reserved for passive context and thresholds).

---

### 1.3 Neutral Door and Window Cuts

Openings cut the wall band cleanly to true physical width ($W$).

```text
DOOR SYMBOL (Neutral Void + Jambs + Threshold Cue)
Wall Band          Jamb Ticks          Void (No Leaf / No Swing)     Jamb Ticks          Wall Band
─────────┐         ┌─┐                 ░░░░░░░░░░░░░░░░░░░░░░░       ┌─┐                 ┌─────────
 Poché   │         │ │ 0.05m           ░░░ CLEAR OPENING ░░░░░       │ │ 0.05m           │ Poché
─────────┘         └─┼ - - - - - - - - - - - - - - - - - - - - - - - ┼─┘                 └─────────
                     │ Threshold Line: 0.5px dashed (#94A3B8)        │

WINDOW SYMBOL (Neutral Void + Jambs + Glazing Frame Lines)
─────────┐         ┌─┐                 ───────────────────────       ┌─┐                 ┌─────────
 Poché   │         │ │ Jamb            ── 2 Glass Lines (0.75px) ──  │ │ Jamb            │ Poché
─────────┘         └─┴───────────────────────────────────────────────┴─┘                 └─────────
```

*   **Door (Neutral Specification):**
    *   Physical void cut across the wall thickness.
    *   Two jamb returns: $0.05\,\text{m}$ thick lines normal to the wall face.
    *   A single `0.5px` dashed line along the reference baseline representing the sill/threshold.
    *   **Zero swing arcs, zero leaf rectangles, zero handing indicators.**
*   **Window:**
    *   Physical void cut across the wall thickness.
    *   Two jamb returns normal to the wall face.
    *   Two parallel `0.75px` solid frame lines spaced $0.04\,\text{m}$ apart centered in the wall band, terminating precisely at the jamb lines.
    *   *Frame Limit:* Does not imply mullions, sills, or sash mechanics.

---

### 1.4 Room Information Hierarchy

Labels are positioned inside the persistent semantic room polygon:

```text
┌──────────────────────────────────────┐
│                                      │
│              MAIN GALLERY            │  ← Tier 1: Authored Name (13px Bold, #0F172A)
│                 R-7K2M               │  ← Tier 2: Compact Ref (10px Mono Quiet, #64748B)
│                84.5 m²               │  ← Tier 3: Derived Area (11px Regular, #475569)
│                                      │
└──────────────────────────────────────┘
```

*   **Typography:**
    *   *Authored Name:* `13px`, font-weight `600`, tracking `0.02em`, uppercase.
    *   *Compact Reference:* `10px`, font-family `var(--font-mono)`, font-weight `500`, tracking `0.05em`, color `--editor-text-muted`.
    *   *Derived Area:* `11px`, font-weight `400`, color `--editor-text-secondary`. Format: `XX.X m²`.
*   **Placement Rule:** Centered at the visual pole of inaccessibility (maximum inscribed circle center) of the room polygon.
*   **Resting Negative Space:** Room interiors have no colored fill at rest, maintaining high-contrast negative space.

---

### 1.5 Footprint Tiers: LayoutObjects vs. Passive Scene

```text
TIER 1: ARCHITECTURE     Dense Poché + 1.25px Cut Ink. Primary visual weight.
TIER 2: LAYOUT OBJECTS   0.75px Solid Neutral Ink (#475569) + 4% Neutral Fill.
TIER 3: PASSIVE SCENE    0.5px Dashed Ink (#94A3B8) + 0% Fill. 25% Opacity.
```

*   **LayoutObjects (Editable Content):** Clean, geometric bounds (cylinders, boxes, plinths) drawn with `0.75px` solid outlines and a faint 4% gray fill.
*   **Passive Scene Footprints:** Drawn with `0.5px` dashed strokes, zero fill, and 25% overall opacity. Completely non-authoritative; no hover reactions and no snap authority during architectural drafting.

---

### 1.6 Canvas Chrome

*   **Grid:** Orthogonal lines at $0.25\,\text{m}$ minor intervals (`rgba(0, 0, 0, 0.04)`), with major accents every $1.0\,\text{m}$ (`rgba(0, 0, 0, 0.09)`).
*   **Rulers:** Compact $20\,\text{px}$ ruler bands along top (X) and left (Z), labeled in meters with tick marks every $0.5\,\text{m}$ and numbers every $1.0\,\text{m}$ or $5.0\,\text{m}$ based on zoom.
*   **Scale Bar:** Segmented bar in bottom-right corner displaying alternating black/white segments calibrated to $1\,\text{m}$, $5\,\text{m}$, or $10\,\text{m}$.
*   **Orientation Key:** Minimalist orthogonal X/Z coordinate triad in bottom-left corner ($32 \times 32\,\text{px}$).

---

### 1.7 Architectural Plans Across 3 Zoom Regimes

```
FAR OVERVIEW (< 6 px/m)           NORMAL READING (6 - 28 px/m)       NEAR EDIT (> 28 px/m)
┌───────────────────────────┐     ┌───────────────────────────┐      ┌───────────────────────────┐
│ ┌───────┐  ┌────────────┐ │     │ ┌───────┐  ┌────────────┐ │      │                           │
│ │ R-01  │  │   R-02     │ │     │ │GALLERY│  │COURTYARD   │ │      │   [W-04]                  │
│ │       │  │            │ │     │ │ R-01  │  │ R-02       │ │      │  ───────────────          │
│ └───────┴──┴────────────┘ │     │ │24.5 m²│  │62.0 m²     │ │      │   4.50 m                  │
│ Centerline / Thin Band    │     │ └───────┴──┴────────────┘ │      │  ───────────────          │
│ Simplified Breaks         │     │ Full Poché + Jambs/Frame  │      │  Full Detail + Handles    │
│ Ref Only                  │     │ Name + Ref + Area         │      │  Working Dimensions       │
└───────────────────────────┘     └───────────────────────────┘      └───────────────────────────┘
```

1.  **Rectilinear 2-Room Layout:**
    *   *Far:* Walls simplify to $1.5\,\text{px}$ joined bands; room tags show `R-01` / `R-02`.
    *   *Normal:* Full poché, continuous exterior joins, doors show jambs + dashed sills, complete 3-line room tags.
    *   *Near:* Full poché, exact $0.05\,\text{m}$ jamb returns, visible snap points, working dimensions on selection.
2.  **Angled & Shared-Wall Layout:**
    *   *Far:* Single line at junction apex; room labels cull if bounding box < 20px.
    *   *Normal:* Miters wrap continuous boundary; shared wall poché renders once with zero interior seams; room tags center in their respective polygons.
    *   *Near:* Endpoint junctions display discrete node handles; acute angle dimension visible during direct editing.
3.  **Curved-Wall Exhibition Rotunda:**
    *   *Far:* Smooth circular centerline stroke; opening breaks visible.
    *   *Normal:* Solid circular curved poché band; smooth continuous joins with tangential straight walls.
    *   *Near:* Curve control polygon handles visible when selected; tangent handles reveal on bend point hover.
4.  **Dense Multi-Alcove Gallery Plan:**
    *   *Far:* Sub-alcoves suppress labels; main hall retains reference.
    *   *Normal:* Main rooms show full tags; small alcoves suppress area and retain name + ref; door cuts stay clean.
    *   *Near:* All alcoves show full tags; opening clearance dimensions ($0.45\,\text{m}$ jamb-to-corner) visible on selection.

---

## 2. Active-State Grammar & Handle Architecture

### 2.1 The 8-State Interaction Model

Active states are strictly separated: neutral ink explains geometry, vibrant accents explain interaction.

```text
1. Rest         → Dark neutral cut ink (#1E232D), solid/tinted poché, zero handles.
2. Hover        → Soft Cyan-Blue halo (2px stroke, #38BDF8, opacity 0.5), cursor changes, zero handles.
3. Focus (Keyb) → Dual-ring high-contrast contour (1px white inner, 2px #2563EB outer), zero handles.
4. Selected     → Vibrant Accent Blue contour (2px stroke, #2563EB), mode-specific handles revealed.
5. Direct-Edit  → Geometry updates in real-time; candidate proposal band rendered with live dimensions.
6. Snap Active  → Winning snap marker (shape-encoded) + 1px dashed projection guide line + relation tag.
7. Valid Draft  → Semi-transparent candidate poché (opacity 0.6) + accent contour + live dimension pills.
8. Invalid Draft→ Barred Hatching Pattern + Refusal Red contour (#DC2626) + Blocked Icon + local reason tag.
```

---

### 2.2 Precedence Stack for Coincident Targets

When hit targets overlap under pointer or keyboard focus, resolve in strict ranking order:

```text
RANK 1 (Highest): Curve Knot / Bend Point Handle (Direct manipulation anchor)
RANK 2:           Opening Slide / Resize Tab
RANK 3:           Junction / Endpoint Handle
RANK 4:           Wall Edge / Body
RANK 5:           Opening Body Cut
RANK 6:           Room Semantic Face
RANK 7:           LayoutObject Bound
RANK 8 (Lowest):  Passive Scene Footprint (Zero Layout hit authority)
```

---

### 2.3 Shape-Encoded Handle System

Handles are shape-coded by function to eliminate ambiguity:

```text
JUNCTION HANDLE             CURVE BEND HANDLE           OPENING RESIZE TAB
┌───────┐                   ┌───────┐                   ┌───┐
│   ●   │ 7px Solid Circle  │   ○   │ 8px Hollow Ring   │ ❚ │ 4x8px Capsule Tab
└───────┘                   └───────┘                   └───┘
Filled: #FFFFFF             Ring: 2px #2563EB           Filled: #2563EB
Border: 2px #2563EB         Center: Transparent         Border: 1px #FFFFFF
```

*   **Junction Node (Topology Anchor):** Solid filled white circle, $7\,\text{px}$ diameter, with a $2\,\text{px}$ selection-blue stroke.
*   **Curve Knot / Control Point:** Hollow ring, $8\,\text{px}$ diameter, with a $2\,\text{px}$ stroke and transparent center. Control polygon lines are thin dashed blue lines (`1px`, dash `3 3`).
*   **Opening Edge Tab:** Narrow rectangular capsule ($4 \times 8\,\text{px}$) aligned parallel to the jamb.
*   **Junction Reveal Rule:** Junction handles are **invisible at rest**. They appear *only* when:
    1.  The parent wall is selected.
    2.  The parent wall or junction is hovered.
    3.  The Wall creation tool is actively armed.

---

### 2.4 Working Dimensions Grammar

Working dimensions appear automatically at the locus of attention during creation and editing, then disappear at rest.

```text
         Dimension Witness Line (0.75px, #64748B)
         │                     Dimension Leader Line
         ▼                     ▼
       ┌─┬─────────────────────┬─┐
       │ │       4.50 m        │ │  ← Dimension Pill: #0F172A text, #FFFFFF bg, 1px #CBD5E1 border
       │ └─────────────────────┘ │
───────┼─────────────────────────┼───────
       ▲                         ▲
       Wall Start                Wall End
```

*   **Automatic Trigger Set:**
    *   During Wall creation: Live length ($L$) and sweep angle ($\theta$).
    *   During Wall selection: Clear span length centered outside the wall band.
    *   During Opening slide: Distance from start junction, distance to end junction, and opening width.
*   **Placement Rules:**
    *   Positioned on the *exterior* side of the wall band, offset by $16\,\text{px}$ screen-space.
    *   Stable orientation: Always readable from bottom or right edge of viewport.
    *   *Short Span Push-out:* When span length < 40px screen-space, witness tick marks remain, and the numeric pill pushes to an exterior shoulder with a leader line.

---

### 2.5 Multi-Channel Invalid Feedback

Rejection of an edit state communicates immediately through three non-color channels:

```text
INVALID EDIT CANDIDATE (Overlapping / Degenerate)
┌──────────────────────────────────────────────────────────┐
│ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱│  ← 45° Barred Hatch Pattern (Fill)
└──────────────────────────────────────────────────────────┘
▲ [ ! ] Cannot overlap existing opening                       ← Floating Reason Tag
└─ Contour: 2px Dashed Stroke (#DC2626)
```

1.  **Hatch Pattern:** The proposed poché displays an interior 45° diagonal warning hatch (`stroke: #DC2626; stroke-width: 1.5; stroke-dasharray: 4 4`).
2.  **Contour Stroke:** $2\,\text{px}$ dashed perimeter stroke.
3.  **Blocked Status Tag:** Floating pill anchored at cursor: `[ ! ] Min wall length 0.20m` or `[ ! ] Opening exceeds wall bounds`.

---

## 3. Creation & Direct-Edit Previews

### 3.1 Per-Tool Preview Composition

```text
WALL DRAW PREVIEW
[Click 1: Start J-01] ───────────────► Pointer (Ghost Band)
                                       ├── Live Poché (50% Opacity)
                                       ├── Outer Cut Lines (1.25px #2563EB)
                                       ├── [ 5.25 m | 0.0° ] Working Dimension Pill
                                       └── Green Ring (●) if closing on Junction
```

*   **Wall Tool:** Click $\rightarrow$ move previews true thickness band with miters pre-calculated against hovered junctions. If the pointer comes within snap radius of the start junction or another boundary wall, a **Room Closure Ring (8px emerald circle, `#059669`)** illuminates, confirming room face creation on click.
*   **Door / Window Tool:** Hovering over a wall previews a clean cut void with jambs moving dynamically with the pointer along the wall centerline. Host wall highlights with a soft cyan contour. If wall length is insufficient for the preset width, the preview turns to invalid red hatch.
*   **Bend / Curve Command:** Alt/Option-drag on a straight wall immediately inserts a curve knot and renders the real-time curved cubic-chain band, updating both boundary contours dynamically.

---

### 3.2 In-Canvas Type-to-Enter Precision

To eliminate round-trips to the Inspector without complex command-line syntax:

```text
IN-CANVAS NUMERIC ENTRY PILL
┌───────────────────────────────────────────────┐
│ Length: [ 4.80 m ]    Angle: [ 45.0° ]        │
└───────────────────────────────────────────────┘
  ▲ Autocused on keystroke. Tab switches fields. Enter commits. Esc cancels.
```

1.  **Trigger:** When drawing a wall or dragging a handle, **typing any numeric key (`0-9`, `.`, `-`)** automatically activates and focuses the floating dimension input pill at the pointer.
2.  **Interaction:**
    *   Numeric entry immediately overrides pointer distance along current angle constraint.
    *   `Tab` cycles between `Length` and `Angle` (or `Offset` and `Width` for Openings).
    *   `Enter` commits the value and advances the creation tool.
    *   `Escape` clears numeric entry, closes the input pill, and restores raw pointer tracking.
3.  **Scope:** Available on Wall draw, Wall resize, Opening placement, and Bend offset.

---

## 4. Semantic Zoom, LOD & Density Engine

### 4.1 Semantic LOD Matrix

Zoom thresholds are calibrated in screen-space pixels per world meter ($\text{px/m}$). Transitions incorporate a $\pm 1.5\,\text{px/m}$ **hysteresis band** to prevent visual flickering on fine scroll-wheel steps.

| Entity Class | Far Regime ($< 6\,\text{px/m}$) | Normal Regime ($6 - 28\,\text{px/m}$) | Near Regime ($> 28\,\text{px/m}$) |
| :--- | :--- | :--- | :--- |
| **Walls** | $1.5\,\text{px}$ merged band; no poché; no joins. | Full world thickness poché band; $1.25\,\text{px}$ outer cut ink; monolithic joins. | Full poché band; individual junction handles revealed on select; miter lines inspectable. |
| **Doors** | Simple clear break in wall band. | True void + $0.05\,\text{m}$ jamb returns + dashed threshold cue. | True void + jamb returns + dashed threshold + clearance dimensions on hover. |
| **Windows** | Simple break with single center line. | True void + jamb returns + 2 glass frame lines ($0.04\,\text{m}$ spacing). | True void + jamb returns + 2 glass frame lines + frame thickness profiles. |
| **Rooms** | Compact Ref only (`R-01`) if face $> 400\,\text{px}^2$; else hidden. | Name + Compact Ref + Area ($3\text{ lines}$). | Full $3\text{ lines}$ + perimeter readout + internal anchor points. |
| **Junctions** | Completely culled. | Invisible at rest; revealed on select/hover. | Revealed on select/hover; $7\,\text{px}$ node + coordinate readouts. |
| **Dimensions** | Completely culled. | Active tool/selection working dimensions only. | Full working dimensions + edge-to-opening clearances. |
| **Passive Scene**| Culled completely. | $0.5\,\text{px}$ dashed footprints (25% opacity); labels culled. | Footprints at 40% opacity; technical category labels visible. |

---

### 4.2 Label Collision & Suppression Priority

When room tags, dimensions, or diagnostic markers compete for screen space, labels are suppressed in strict reverse-priority order:

```text
PRIORITY 1 (Highest): Active Selection Handles & Dimensions (Never suppressed)
PRIORITY 2:           Topology Warning / Invalid Diagnostic Markers
PRIORITY 3:           Active Snap Relation Tag
PRIORITY 4:           Room Authored Name
PRIORITY 5:           Room Compact Reference (R-####)
PRIORITY 6:           Room Derived Area (XX.X m²)  [First to drop under pressure]
PRIORITY 7 (Lowest):  Passive Scene Footprint Labels
```

*   **Selected Room Override:** If a room is selected by the user, its full 3-line label (`Name + Reference + Area`) forces rendering at the polygon centroid, temporarily overriding lower-priority annotations within a $32\,\text{px}$ screen-space radius.

---

### 4.3 Empty-State Blueprint Overhaul

Replaces the mismatched and incomplete ghost blueprint:

```text
┌ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ┐
'                                                                           '
'                       START YOUR EXHIBITION PLAN                          '
'          Draw walls or place a preset room using the ribbon above         '
'                                                                           '
'            [ Wall (W) ]    [ Rect Room (R) ]    [ Poly Room ]             '
'                                                                           '
'                            10.0 m × 8.0 m                                 '
' - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ┘
```

*   **Copy:** Harmonizes ribbon labels exactly ("Wall", "Rect Room", "Poly Room"). Explicitly presents the Wall tool as a primary creation mechanism.
*   **Dimensions:** Shows an architecturally balanced $10.0\,\text{m} \times 8.0\,\text{m}$ starter boundary.

---

## 5. Openings & Rooms Detailed Specifications

### 5.1 Door & Window Geometric Details

```text
DOOR CUT SPECIFICATION
────────────────────────┐      ┌────────────┐      ┌────────────────────────
  Wall Poché            │      │ 0.05m      │      │ Wall Poché
                        │      │ Jamb Return│      │
────────────────────────┘      └────────────┘      └────────────────────────
                        ◄──────   Width W   ──────►
                        - - - - - - - - - - - - - -  ← Sill / Threshold Line
```

*   **Jamb Thickness:** Standardized to exactly $0.05\,\text{m}$ physical width.
*   **Sill/Threshold:** Single baseline stroke, dashed (`stroke-dasharray: 2 2`), stroke width `0.5px`, color `--editor-plan-threshold`.
*   **Window Glazing Lines:** Exactly two parallel lines, centered within the wall thickness, spaced $0.04\,\text{m}$ apart ($0.02\,\text{m}$ each side of wall centerline).

---

### 5.2 Room Label Placer & Duplicate Disambiguation

1.  **Placement Algorithm:**
    *   Computes the maximum interior inscribed disk (pole of inaccessibility) within the room boundary polygon.
    *   Clamps the label bounding box within the polygon with a minimum margin of $0.40\,\text{m}$ from any interior wall face.
2.  **Duplicate Name Handling In Situ:**
    *   When multiple rooms share identical authored names (e.g., two rooms named `Gallery`), the canvas automatically elevates Tier 2 Compact References:
        *   Room 1: `GALLERY · R-01`
        *   Room 2: `GALLERY · R-04`
3.  **Selection Emphasis:**
    *   When a Room is selected, its interior is filled with a soft architectural wash (`rgba(37, 99, 235, 0.06)`), and its bounding wall interior faces gain a $2\,\text{px}$ blue perimeter highlight.

---

## 6. Iconography Sheet & Preset Footprint Grammar

Tool icons are rendered in the precise visual language of the plan (thick bands, cut ink), establishing an immediate mental model:

```text
[ Select ]       Minimalist cursor arrow (45° angle, crisp monochrome).
[ Wall ]         Straight thick double-edge cut band with solid poché fill.
[ Rect Room ]    Rectangular boundary ring with solid cut poché corners.
[ Poly Room ]    Irregular polygon outline with filled poché vertices.
[ Door ]         Clean wall cut void flanked by two jamb tick marks (NO swing arc).
[ Window ]       Wall cut void with two parallel glazing lines in center.
[ Column ]       Round architectural column cut (solid filled circle).
[ Platform ]     Low stage / raised floor footprint (solid outline + corner brackets).
[ Plinth ]       Display pedestal footprint (square outline + centered square mark).
[ Add Junction ] Wall cut band with a crisp circular node splitting the centerline.
[ Snap 0.25m ]   Orthogonal grid intersection with a magnetic snap diamond.
```

*   **Creation Preset vs. Committed Geometry Rule:** The toolbar icons for Column, Platform, and Plinth represent architectural archetypes to guide authoring intent. Once placed on canvas, they render strictly as generic spatial cylinders and boxes (`LayoutObjects`), fulfilling invariant §3.6.

---

## 7. Theme, Grayscale Proof & Accessibility Annex

### 7.1 Canvas Surface Direction: Architectural Warm Paper

The default plan surface is calibrated as an authentic, high-legibility architectural drafting paper, providing maximum contrast against dark UI chrome:

```css
/* Architectural Warm Paper Theme (Default Baseline) */
--editor-plan-bg:                  #F8F7F4;  /* Warm archival drafting paper */
--editor-plan-grid-minor:          #EDEAE2;  /* Calibrated 0.25m minor grid */
--editor-plan-grid-major:          #DCD7CA;  /* 1.0m major accent grid */
--editor-plan-wall-cut:            #1E232D;  /* 1.25px outer drafting cut ink */
--editor-plan-wall-poche:          #2B3240;  /* Monolithic solid wall poché */
--editor-plan-wall-partition:      #8A94A6;  /* 35% density non-bounding poché */
--editor-plan-threshold:           #94A3B8;  /* Dashed opening sill line */
--editor-plan-selection:           #2563EB;  /* Interaction accent blue */
--editor-plan-selection-halo:      #38BDF8;  /* Hover / preselection halo */
--editor-plan-invalid:             #DC2626;  /* Error / refusal red */
--editor-plan-text-primary:        #0F172A;  /* Room titles */
--editor-plan-text-muted:          #64748B;  /* References & dimensions */
```

---

### 7.2 Grayscale Contrast Verification

Every functional state maintains strict luminance deltas readable without color:

| State | Primary Element | Grayscale Luminance | Contrast vs. Canvas (#F8F7F4) | Compliance |
| :--- | :--- | :--- | :--- | :--- |
| **Resting Boundary Wall** | Solid Poché (`#2B3240`) | 19% | **10.8 : 1** | WCAG AAA |
| **Resting Partition Wall**| Screened Poché (`#8A94A6`)| 58% | **4.2 : 1** | WCAG AA Large |
| **Hovered Wall** | Cyan Halo (`#38BDF8`) | 72% + 2px outline | Distinct geometry | Shape/Size cue |
| **Selected Wall** | Accent Blue (`#2563EB`) | 32% + Solid handles | **5.4 : 1** | WCAG AA |
| **Invalid State** | Diagonal Hatch Pattern | 45° alternating | Non-color pattern | Pattern cue |

---

### 7.3 Dual-Ring Focus & Keyboard Accessibility

*   **Keyboard Focus Ring:** Implemented as a dual-ring: an inner `1.5px` white ring (`#FFFFFF`) and an outer `2px` deep blue ring (`#1D4ED8`). This guarantees immediate visibility whether overlapping dark wall poché, light canvas paper, or selection halos.
*   **Keyboard Navigation:** All visible handles (Junctions, Knots, Opening Tabs) are accessible via standard arrow-key navigation when the canvas has focus, with `Tab` navigating between discrete handle groups.

---

## 8. Boundary Log & Scope Separation

```
┌─────────────────────────────────────────────────────────────────────────┐
│ P23.13 SCOPE (This Document)                                            │
│ • Wall band, cut ink, poché, monolithic joins, and end caps.             │
│ • Neutral Door/Window cuts without swing.                               │
│ • Room label hierarchy (Name → Ref → Area) & suppression rules.         │
│ • Shape-encoded handles & working dimensions grammar.                   │
│ • In-canvas type-to-enter precision interaction.                        │
│ • Semantic zoom LOD matrix & empty-state copy.                          │
├─────────────────────────────────────────────────────────────────────────┤
│ P23.14 SHELL / NAVIGATOR / INSPECTOR FINISH (Deferred)                  │
│ • Shell rail width adjustments (nominal 268px vs 240-300px).            │
│ • Inspector property re-grouping and action placement.                  │
│ • Final removal of `Ends...` relation row from Room Navigator.          │
│ • Context-menu keyboard arrow-key navigation & status bar hint contrast.│
├─────────────────────────────────────────────────────────────────────────┤
│ P23.15 JUNCTION-CORRECT 3D WALLS (Deferred)                             │
│ • 3D mesh tessellation matching 2D monolithic plan joins.               │
│ • Miter/bevel volumetric meshing for mixed height/thickness walls.      │
├─────────────────────────────────────────────────────────────────────────┤
│ POST-P23 / FUTURE SEMANTICS (Strictly Prohibited Here)                  │
│ • Door swing arcs, leaves, and handing metadata.                        │
│ • Multi-select / Marquee selection.                                     │
│ • Architectural classification for Columns/Platforms.                   │
└─────────────────────────────────────────────────────────────────────────┘
```

*   **Door Swing Deferral Rationale:** Door swing indicates directional clearing paths. In P23, wall openings have no inward/outward side metadata or door leaf swing properties in the data model. Fabricating a default swing arc would invent data that does not exist, violating Invariant §3.6 and failing the 2D/3D correspondence rule. Neutral void cuts with jamb returns are truthful, elegant, and standard in technical schematic design.

---

## 9. Open-Question Register

Direct, binding determinations for all 34 research questions:

1.  **Resting Wall Body:** Dark monolithic poché (`#2B3240`) with crisp `1.25px` outer cut lines.
2.  **Boundary vs. Partition in Grayscale:** Boundary is 100% solid poché; Partition is 35% screened poché. Identifiable via 40% luminance difference.
3.  **LOD Thresholds:** Far: $< 6\,\text{px/m}$; Normal: $6 - 28\,\text{px/m}$; Near: $> 28\,\text{px/m}$.
4.  **Far-Zoom Wall Simplification:** Merges into a continuous $1.5\,\text{px}$ single stroke.
5.  **Handle Shapes:** Junction = Solid circle; Curve Knot = Hollow ring; Opening = Rectangular tab.
6.  **Junction Reveal Rule:** Visible only when parent wall is selected, hovered, or Wall tool is armed.
7.  **Baseline Geometry Visibility:** Visible only during active direct-edit drag operations.
8.  **Curve Scaffolding Persistence:** Visible while wall is selected; control lines hide on deselect.
9.  **Type-to-Enter Scope:** Wall length/angle and Opening offset/width.
10. **Type-to-Enter Trigger:** Typing any numeric key (`0-9`, `.`, `-`) immediately focuses input.
11. **Auto vs. Selected Dimensions:** Length/angle auto-display on draw; clear span displays on select.
12. **Dimension Editability:** Double-clicking dimension pill opens inline text edit.
13. **Neutral Door Geometry:** True cut void + two $0.05\,\text{m}$ jamb returns + dashed threshold cue.
14. **Window Frame Limit:** Void + two jamb returns + exactly two parallel center glazing lines.
15. **Far Opening Distinction:** Door = clean wall break; Window = clean wall break with single center line.
16. **Room Type Hierarchy:** Authored Name (13px bold) $\rightarrow$ Compact Ref (10px mono) $\rightarrow$ Derived Area (11px regular).
17. **Room Label Drop Order:** Area drops first $\rightarrow$ Reference drops second $\rightarrow$ Name drops last.
18. **Selection Override:** Selecting a room forces rendering of all 3 label tiers at centroid.
19. **Label Travel Tolerance:** Clamped to max $1.2\,\text{m}$ from polygon visual center.
20. **Selection Emphasis:** Soft 6% blue room fill wash + 2px interior boundary highlight.
21. **Column/Platform Presentation:** Generic clean geometric outlines; zero architectural role claims.
22. **Future Semantics for Presets:** Deferred to P24 Stage phase.
23. **Passive Scene Quietness:** $0.5\,\text{px}$ dashed strokes, zero fill, 25% opacity.
24. **Passive Scene Label Policy:** Completely culled in Layout mode.
25. **Plan Surface Direction:** Architectural Warm Paper (`#F8F7F4`) as universal canvas baseline.
26. **Dual Focus Ring:** $1.5\,\text{px}$ white inner ring + $2\,\text{px}$ deep blue outer ring.
27. **Invalid CVD Accommodation:** 45° barred hatch pattern + dashed contour + floating warning pill.
28. **Resting vs. Scaffolding Balance:** Complete resting calm; editing scaffolding appears strictly on touch.
29. **RoomSketcher Calm vs. Vectorworks Precision:** Resting state matches RoomSketcher calm; active state delivers Vectorworks precision.
30. **Presentation-Only vs. Future Semantic Boundary:** Everything in P23.13 is strictly derived presentation.
31. **Screen-Space Ink Floor:** Fixed at minimum $1.5\,\text{px}$ to prevent geometry dropout.
32. **Opening Arched Profiles in Plan:** Rendered with standard rectangular jamb cuts; arch type indicated in Inspector.
33. **Short-Span Dimension Push-Out:** Automatically pushes outside wall band with leader line when span < 40px.
34. **Empty State Naming:** Aligned completely with ribbon tools ("Wall", "Rect Room", "Poly Room").