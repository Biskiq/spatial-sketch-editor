# P26 designer brief — Architectural Spatial Depth

**Status:** design assignment. Ready to send to independent designers.
**Date:** 2026-09-22
**Audience:** designers who will not read the repository, the research harvests, or the synthesis.
**Authority:** this document is an assignment, not a product contract and not an implementation plan. It restates the landed P26 research synthesis and the shipped P23 system so a design response can be judged against them. It does not ratify a screen, a gesture, or a schema.

```text
PIPELINE: P23 (shipped) → P23B (planning, ongoing) → P26 (this assignment) → P24 → P25
RESEARCH: closed. The synthesis is the research conclusion. Do not restart precedent hunting.
DESIGN: open. The problems in §6 are the work. Research bounds them and does not answer them.
IMPLEMENTATION: not approved. This brief does not open it.
```

---

## 0. How to use this brief

Produce **distinct design directions**, not cosmetic variants of one layout. A direction differs when its information architecture, instrument navigation, or core gesture model differs. A second color, type ramp, or icon style of the same model is not a second direction.

Each direction must be complete enough that another designer, an engineer, and the product owner can evaluate it against the same scenarios in §9 without asking for another briefing.

Two grades of statement appear throughout. Keep them apart in your response.

| Grade | Meaning for your work |
|---|---|
| **Established** | A research conclusion or a shipped product fact. Design inside it. Say where a direction is in tension with it. |
| **Open** | A product question research deliberately left to design. Propose an answer, name the alternative you rejected, and name what is still unresolved. |

Do not treat an open question as already decided. Do not reopen an established conclusion by offering a peer CAD workspace, a second geometry model, or a full roof system as one of the directions.

Concepts from FreeCAD, Bonsai, and Homemaker may inform the design. Their licenses (LGPL and GPL) do not travel with those concepts. Do not specify copying their source, file formats, or drawing objects into Museum Editor.

---

## 1. The assignment

Museum Editor can already draw a wall-first plan and show that plan as a compiled 3D interior. It cannot yet author the vertical form of that interior with any precision. Wall height is one positive number. A room ceiling is derived from the tallest boundary wall. Openings have a width, a height, a sill, and a simple profile, but the plan is a poor place to judge them. There is no section, no wall elevation, and no ceiling-focused view.

P26 is the phase that makes the architectural model genuinely spatial, and that gives the author one precise orthographic surface for that space.

The design job is the **instrument and the authoring interaction** around a bounded vertical vocabulary:

- wall-top profiles (constant, slope, gable) instead of only a single height number;
- opening width, sill, head, and arch rise, edited where the opening is actually visible;
- independent ceiling regions (flat, shed, gable) that a room may seed and may overlap, and that a room does not own;
- column and platform vertical extents, when those objects are architecture rather than staged props;
- one shared orthographic instrument family — **Section**, **Wall Elevation**, and **Ceiling Focus** — entered from the existing Plan, with an obvious way back.

Plan stays the horizontal authority. The orthographic instrument is where vertical relationships become exact. 3D proves the space and may expose only coarse handles. All three edit one architectural document.

You are designing how a person enters, reads, edits, selects, fails, and leaves those instruments inside the shell that already shipped. You are not designing a new application.

---

## 2. Product context

### What Museum Editor is

Museum Editor is a web application for authoring an interactive interior and publishing it for visitors. A creator builds the architecture, stages objects, lights, and materials inside it, directs a guided camera through it, and publishes a walkable result. The intended outcome is an interior someone can move through: a gallery, a museum room, a showroom, a portfolio, a teaching space. The product is a spatial authoring tool with a published visitor runtime.

It is aimed at people making those interiors, including people who are not CAD operators. The shell should feel like a precise architectural instrument. It should remain understandable without a documentation-set mindset: no sheets, no title blocks, no plot styles, no view browsers that exist to manage drawings.

The product already separates two kinds of truth:

- **Architecture** — walls, junctions, rooms, openings, and the compiled interior — lives in one Layout document.
- **Staged content** — models, lights, materials, cameras — lives in a separate Scene document.

Plan and 3D are two views of one compiled world. They are not two models that must be kept in sync by hand. A change to a wall is a change to the document. Plan, 3D, and the published visitor all read the compilation of that document.

### Wall-first architecture, as it works today

The current architectural system is wall-first.

- A **junction** is a point. Connectivity is the identity of the junction, not a near-miss between coordinates.
- A **wall** runs from one junction to another. It exists once, even when two rooms share it. It has a thickness, a role (`boundary` or `partition`), and a centerline that is either straight or a cubic curve with persistent bend points.
- A **room** is a named semantic region whose boundary is an ordered list of those walls. The room does not own the walls. Geometry may suggest an enclosed face; the product decides which face remains a room.
- An **opening** (door or window) is hosted by one wall. Its position is a distance in meters from the wall’s canonical start. It has width, height, sill height, and a profile of rectangular, rounded, or pointed.
- The **floor** of the document is a single horizontal datum: an elevation. It has no storey height. Wall bottoms sit on that elevation. A wall’s height is a single positive number measured up from it, so the top is `floor elevation + wall height`. That number is the whole vertical description of the wall today. Adjacent walls may differ. Changing a height does not create, split, or delete rooms.
- A room’s **ceiling**, today, is one derived flat plane: floor elevation plus the maximum height among the walls that bound that room. A shorter boundary wall does not pull the plane down. The room also stores a floor thickness and a ceiling thickness as surface metadata. There is no ceiling object to select, slope, or move. A room whose boundary cannot be resolved does not receive a manufactured ceiling.
- **Layout objects** (box, cylinder, sphere, and similar) are separate document-level objects in project coordinates. A “column” and a “platform” exist only as presets of those objects (a cylinder, a box). They are not yet architectural types with base, top, and a meaning of “this holds the building up” or “this changes the floor you walk on.”

Plan is where footprint and topology are authored: walls, junctions, rooms, opening position and width, snaps, guides. 3D shows the compiled walls, including how walls meet at junctions, and is the spatial proof of that plan. Selection is one identity across the navigator, the plan, the 3D view, and the inspector. One completed gesture writes one history entry, or it writes nothing.

The world is therefore credible in plan and already three-dimensional, and it is still vertically flat in authorship. A designer cannot draw a gable, set a window head against a sloping top, or look at a wall face-on and trust the drawing.

### The shell you must fit

P23.14 shipped a shell named **PLATE**. Later phases fit into it. They do not restyle it and they do not add a third top-level view beside Plan and 3D.

What a designer needs to know about PLATE:

- The product is one world. **Scene** and **Camera** are domains of attention, not separate applications. **Plan** and **3D** are the durable views. Scene Plan has a local mode pair, **Layout** and **Arrange**. Camera owns the timeline. Architecture authoring belongs to Scene, not to Camera.
- Information has a rank, and the rank must stay visible: **Project → Domain (Scene / Camera) → View (Plan / 3D) → Contextual instrument → Local mode → Tool → Selection / gesture / status**. Scene/Camera is the vertical axis. Plan/3D is the horizontal axis. Those two axes stay legible while an instrument is open.
- The screen is a cool chassis around a warm working surface. Chassis regions are the domain spine, project head, navigator (left), inspector (right), view bar, and status rail. The working surface is **Paper**: the plan or the 3D view. Controls that act on the work are **Instrument** (the tool tray, numeric fields, mode controls). Paper holds the drawing, selection, guides, and handles. Paper does not accumulate application controls. Do not invent a fourth material.
- The reference desktop frame is **1440 × 900**. Navigator, inspector, and the central work column already have jobs. A section view occupies the work column. It does not become a new application frame.
- One selection identity. The navigator, the view, the inspector, search, and status readouts name the same object. A retained selection survives a view change. The inspector header and the inspector body describe the same target.
- One writer for each fact. A control lives in one host. A second surface may display the same fact and may not edit it a second time.
- Names may duplicate. A compact reference plus the canonical identity is how two walls with the same name stay distinct. The inspector is where a name is edited.

P26 instruments are **contextual**. The shell contract already says so: a section, a wall elevation, or a ceiling focus is entered from a durable view and must offer an obvious return. It is not a third peer of Plan and 3D, and it is not a new top-level world.

### Where P26 sits

```text
P23    shipped 2026-09-22
       Wall-first plan, topology, openings, curves, identity, one compiler,
       Plan and junction-correct 3D, PLATE shell.
       Vertically: one height number per wall, derived room ceiling.

P23B   planning, and still the immediate execution phase
       Makes the existing compiler stay fluid as curved, multi-room models grow.
       Changes cost, not capability. Adds no view, no document, and no schema.
       Not finished. Do not describe it as done, and do not design around a
       speedup that has not been measured.

P26    this assignment
       Vertical form plus one orthographic instrument family.
       Planning only. Research is complete. No child plan exists.

P24    later
       Staging: props, artwork holders, materials, lights, placed inside the
       space P26 defines. P24 must not re-own architecture.

P25    later
       Visitor experience: destinations, stops, panels, interaction over the
       compiled result.
```

P23B was inserted ahead of P26 so that vertical authoring is not built on an unmeasured compiler. P26 planning proceeds in parallel. P26 implementation does not start until P23B’s own gates and a later P26 plan say so. A design response must not depend on P23B having already made large models fast, and it must not propose a second compiler to avoid that wait.

P26 is also the selected validation window of an internal architecture cycle. **Selected means later, not open.** Nothing in this brief starts that validation. Designers can ignore the cycle except for this: do not invent a parallel geometry, selection, or history system “for the new views.”

---

## 3. What already exists

Design against this behavior. Do not redesign it, and do not draw it as if the vertical vocabulary below were already in the product.

| Already true | What the author can do today |
|---|---|
| Wall-first plan | Draw straight and curved walls, join them at junctions, host doors and windows, create and name rooms, snap and align, undo one gesture at a time. |
| Shared walls | One wall object bounds two rooms. The wall is not stored twice. |
| Vertical numbers that exist | Floor elevation. Per-wall height as one positive scalar from that elevation. Opening width, height, sill, and profile (`rectangular`, `rounded`, `pointed`). Room floor thickness and ceiling thickness. A room ceiling derived from the tallest boundary wall. |
| Plan and 3D | Two views of one compilation. Plan owns footprint and topology. 3D shows the compiled interior, including how walls meet. |
| Identity | Stable ids for rooms, junctions, walls, and openings. Optional names. A compact reference that survives rename. Selection is the entity, shared by navigator, view, and inspector. |
| History | One completed gesture, one transaction, or no transaction. Invalid results are refused. The product does not silently repair topology. |
| Shell | PLATE, as §2 describes. Scene / Camera and Plan / 3D. Layout vs Arrange on Scene Plan. |
| Scene placement | Scene and camera positions are project/world coordinates. Older room-frame coordinates exist only as a legacy read path. Rooms are not the transform parent of architecture or of staged objects. |
| Column and platform | Preset layout objects (cylinder, box) only. No architectural column or platform type. |
| What is absent | Section, wall elevation, ceiling focus, wall-top profiles, slope and gable, an editable ceiling object, finite-depth controls, cut / projected / hidden drawing, orthographic handles. |

A height edit today does not change which rooms exist. Keep that. Vertical authoring must not quietly become a topology editor.

---

## 4. Research the design has to absorb

P26 research is finished. It has three layers: a broad product study of architectural tools, a source harvest of FreeCAD’s section machinery, and a source harvest of Bonsai’s drawing, identity, and reflected-plan machinery. A synthesis then decided what those sources mean for this product. This section is that decision, written for designers. Provenance and the limits of the evidence are included so you can see what was observed, what was only inferred, and what was deliberately not studied.

### 4.1 The product shape research selected

**Established.** One canonical architectural model. Orthographic views are derived from it. They are not documents, not saved drawings with their own geometry, and not peer workspaces.

The selected shape is:

```text
Plan
  Horizontal authority.
  Footprints, topology, section placement, ceiling footprints.
  Quiet vertical hints on the selected object only (a height, a sill).
  Does not become a wall of elevation dimensions.

Orthographic instrument family   (contextual, temporary unless the author pins it)
  Section          Cross-space vertical precision.
  Wall Elevation   One wall face and its openings.
  Ceiling Focus    Reflected horizontal view for ceilings.

3D
  Spatial proof.
  Coarse handles only where a direction chooses to include them.
  Precision that the 3D view cannot show truthfully is sent back to the instrument.
```

All of them edit the same architectural document through the same kinds of change. Handles differ by view. Identity does not.

Research rejected, and a direction should not revive:

- four permanent peers (Plan, Section, Elevation, RCP, 3D) and the view manager that comes with them;
- a documentation system: sheets, callouts, plot scales, named drawing sets;
- compass elevations (North / South / East / West) as the primary model;
- “the orientation of the camera is enough to know what kind of view this is.”

**Why the last rejection is specific.** FreeCAD uses one section-plane object and no view-kind field. Sections, elevations, plans, and reflected plans all fall out of which way the plane faces. That proves a single cut kernel can serve every orthographic form. Bonsai stores an explicit kind (`plan`, `reflected plan`, `section`, `elevation`, `model`) and derives the camera from the kind. The cut kernel is still shared — section and elevation take the same code path — but kind changes policy the camera matrix does not carry. The decisive bit is the reflected plan’s vertical mirror: mirroring the serialized drawing is not the same as flipping the camera, because winding and text direction change. An orientation-only model drops that bit.

So the instrument has an explicit kind, and a small policy beside it: how the camera is derived, what is in scope, whether the result is mirrored, a tiny depth offset to avoid z-fighting, and which references are harvested. Kind is editor state. It is not architectural truth and it does not belong in the layout document. A later pinned view may remember a kind. The remembered thing is a record of an instrument, never a copy of the geometry.

Wall Elevation is not its own geometry engine. In both harvested codebases it is a section with a constrained plane and a shallow depth. FreeCAD has no elevation-specific code at all. Bonsai sends section and elevation down one branch.

Ceiling Focus is not a mode named RCP, and it is not a peer workspace. The words “reflected ceiling plan” are the wrong label for this audience. The behavior is a reflected horizontal view.

### 4.2 How a view is derived

**Established.** One pipeline, in this order:

```text
Architectural document
  → the existing compiler (solids and hosted relations, once)
  → membership, evaluated once (included, and excluded with a reason)
  → derivation per source (cut, projected, hidden, symbol)
  → pixels, handles, snaps, temporary dimensions (read-only)
  → a gesture becomes a canonical change
  → validation
  → one layout transaction, or nothing
```

| Stage | What it is | What may be stored |
|---|---|---|
| Architectural document and compiled solids | The only truth | The document and its history |
| Instrument definition (kind, plane, span, depth, crop, scope) | Editor state | The definition, at most. Transient first. A pin may remember it later. Never the output. |
| Membership | Derived for this instrument and these sources | A cache keyed by that pair, if needed |
| Typed primitives | Derived, each tagged with its source | A cache at source granularity, if needed |
| Pixels, fills, overlays, snaps, temporary dimensions | Presentation | Session state outside the document |
| The gesture’s intent | Transient until commit | Only the committed document change |

The compiler already resolves hosting and subtraction. A section consumes those solids. It does not cut the openings out of the walls a second time.

**The failure both codebases actually have, which the design must not repeat.** Membership is easy to compute in two or four places that disagree.

- FreeCAD’s section plane has a Depth property (“keep zero for unlimited”). The geometry helper honors it. The flagship drawing path never passes it. Depth is a property some consumers ignore, so the published drawing silently keeps the whole model.
- Bonsai has four inclusion mechanisms that do not agree: the camera frustum, an include/exclude list (the frustum wins over an explicit include), a representation-context filter that drops geometry without saying why, and a serializer prefilter. There is no single view-range object.

P26’s rule is the correction: **membership is evaluated once**, from scope + span + depth + crop. The renderer, the hit tester, the snap engine, and the overlays all receive that same included set and the same reasons for exclusion. None of them may decide again who is in the view.

Exclusions carry a reason. The reasons research named are: outside depth, outside span, outside crop, filtered by type, no meaningful projection, out of scope. Silent disappearance is the shared defect of both predecessors.

Derived linework, fills, merged outlines, SVG, snap candidates, temporary dimensions, and membership caches are never architectural truth. A pinned view, if you propose one, stores the instrument definition. It does not store a drawing.

### 4.3 Identity

**Established.** Selection is the architectural entity, in every view.

Both harvested systems keep identity through the cut and lose it at a later flatten:

- FreeCAD threads the source object through the boolean, then flattens each stream into one compound before hidden-line removal. The projected edges come out anonymous. Fills and a few symbols still carry an id. The loss is the merge, not the cut.
- Bonsai threads an integer id through 3D caches and a guid through the SVG until a shape-union merges several guids into one class. Openings are omitted from the drawing entirely. A raycast on a cut wall hits the host wall, not the opening. The opening still exists one relationship away (`HasOpenings` / `FillsVoids`), which is why the drawing can afford to drop the opening mesh and the product cannot afford to drop the relation.

Rules that follow:

1. Every selectable derived primitive carries the canonical source id, including outlines. Tag it with the stream (cut, projected, hidden, symbol) and, where needed, a sub-reference (which edge, which opening role). Project per source.
2. There is no section-local id, no proxy wall created by the cut, no “section object” the user can select instead of the wall.
3. Selectable streams are not merged. Neither codebase has a merge that keeps membership. Until one exists, the editing instrument does not merge. An export path may merge only if it keeps a membership record. Visual overlap is not a reason to fuse two sources into one hit target.
4. Selection state is a set of canonical entities. Changing view may change handles. It does not change which entity is selected. Bonsai can orphan a selection by tying isolation to the camera. That is the failure to avoid.
5. An entity outside the depth or the crop stays identified, with a reason. The author can learn that it was excluded. Research requires a **Reveal** affordance for depth and crop exclusions. The interaction is open (§6).
6. Opening hits resolve through the host→opening relationship, not by classifying faces of a boolean mesh. Both codebases agree, from opposite implementations: FreeCAD bakes the hole into the wall and the faces no longer know they were an opening; Bonsai subtracts in the kernel and also drops openings from linework, and the relation graph is the only surviving identity. Do not design a face-classification fallback. If an opening is hoverable in section or elevation, the derivation emits an opening primitive from the relationship on purpose.

A platform or a ceiling that shares an outline with a wall stays separately selectable even if a drawing style someday strokes them as one line. Bonsai’s default of merging wall and slab linework is the cautionary case.

**Open, and narrow.** Whether an opening intent is keyed by the opening id alone or by host-plus-opening. Either way the user is selecting the opening, not a region of the wall face. Choose one and say how Inspector, undo, and a replaced host behave.

### 4.4 From pointer to change

**Established.** Three steps, and they stay separate.

```text
Hit        The pointer meets a derived primitive.
           Result: primitive, source id, stream, point.
           This step does not know what a wall or an opening means.
           A clipped solid attributes to its source.
           Snap is a separate service that feeds hit. It is the existing
           plan snap engine, extended with vertical candidates
           (datums, wall tops, heads, sills, ceiling surfaces, intersections,
           increments). There is no second snap engine.

Resolve    The source id becomes the canonical entity and its relationships.
           Openings resolve through the host relationship.
           An id that is outside the view resolves to a reason, not to a miss.

Intent     The gesture, the entity, and the view become one canonical change:
           the same change Plan, 3D, or the Inspector would emit
           (set a wall-top profile, set opening vertical geometry, set a
           column or platform extent, set a ceiling profile).
           Then the existing validation. Then one transaction, or nothing.
```

The handle is a translator. It is not an author. Derived geometry contains no mutation logic. This is what makes different views safe: Wall Elevation can show an arch-rise handle that Plan does not show, and both handles emit the same kind of change.

Temporary dimensions, handles, guides, and the one accepted snap are instrumentation. They are created when they are needed, invalidated when the camera, the selection, the edit, or undo changes, and they are discarded on commit. They are not stored on the architectural object. Bonsai’s split — persisted annotation, cached snapshot, ephemeral gizmo, with gizmos writing only through operations — is the precedent. FreeCAD’s habit of storing a generated symbol inside the document is the precedent to avoid.

Invalid input follows the rule the plan already uses: show the proposal, validate, refuse with a reason. Do not auto-repair a wall, an opening, or a ceiling to make the gesture succeed.

### 4.5 Section

**Established.** A section is an instrument: a cut line in plan, a side to look toward, a span, a depth, and an optional vertical crop. It is editor state. Creating one does not create architecture.

Research-level shape (a sketch for discussion, not a schema):

```text
kind:            section | wall-elevation | reflected
origin, tangent, look side
span
depth:           cut-only  |  finite, in meters
                 Depth is required. It is a derivation parameter with a finite
                 default. It is not an optional flag a renderer may skip.
vertical crop:   optional min/max height
scope:           optional explicit inclusion; default is the whole layout
```

- **Finite depth is the default.** Both harvested tools default to unlimited depth and neither defends the clutter that produces. A museum of many rooms is unreadable in an infinite section. The numeric default is open.
- **Cut-only** means the far projection is suppressed (a zero or minimal far depth). Archicad and Rhino have the convention. Neither FreeCAD nor Bonsai implements it as a first-class mode. The semantics are settled enough to design. The control is open: a toggle, a zero handle, or a mode are all unproven.
- **Span, lateral crop, and vertical crop** are ranges on the same derivation. They are not a second model. Whether crop is instrument chrome or a session frame around the view is open. FreeCAD’s own section has no crop property; cropping happens later, in the drawing sheet. That is a warning, not a recommendation to add sheets.
- **Scope** defaults to the whole layout. An excluded object is excluded with a reason.
- **Fit / recenter** is a pure function of the scope and the placement. FreeCAD’s version is the right pattern and has a real bug: the margin is computed from X only, so a tall narrow section is padded incorrectly. Use a margin that respects both axes.
- **Direction** is “which side of the cut you look toward,” not a quaternion the author hand-edits. FreeCAD stores a placement quaternion and offers rotate buttons because direct editing of that placement is hostile. Keep look-side as a human control and convert it to a matrix only when deriving.
- **Reveal** is required for depth and crop exclusions. The interaction is open.
- **After you leave**, whether the cut line remains quietly visible in plan is open. Research’s visual principle, while the instrument exists: plan shows a quiet cut line and a look arrow at rest, and shows span and depth chrome only when that section is selected.

**Open.** The creation gesture. Both harvests are silent in a useful way: FreeCAD wraps the current selection and does no point picking. Line-first (two clicks, then a side) and drag-a-volume are both legitimate. Choose, and show the empty-model case.

**Open.** Default finite depth in meters. Cut-only’s control. Crop’s presentation. Whether recent sections are a transient stack or a short list. Whether anything remains in plan after return.

### 4.6 Wall Elevation

**Established direction.** Wall Elevation is a section whose plane is taken from the wall at every rebuild, not a frozen plane and not a separate system.

Definition: wall + side + horizontal extent + vertical crop + a shallow background depth.

The plane and the depth are derived from the wall’s current geometry each time the view rebuilds, so a moved or curved wall carries the elevation with it. This follow behavior is new. FreeCAD and Bonsai both freeze the plane at creation. The architecture of “a constrained section” is precedented. The follow behavior is not, and its edge cases are a design problem: curved walls, a wall that is dragged while the elevation is open, a wall that is deleted, a wall that becomes too oblique to the view.

Entry research already selected, as workflows rather than as widgets:

- Select a wall → open its elevation.
- Select an opening → open the host wall’s elevation.
- Select a room → a chooser of interior elevations, one per boundary wall. The room is navigation context. It does not own the elevation and it does not own the wall.

Handles the view must be able to express: opening width, sill, head, arch rise, and points on the wall-top profile. Exact values live in the Inspector as well. Selection identity matches Plan, Section, and 3D.

A wall that is too oblique to the elevation plane is rejected or redirected, with a reason. The view must not pretend an oblique projection is an elevation.

**Open.** The entry control (double-click, menu, inspector action, floating action). The return path — this is the known weakness of contextual tools, and it has to be excellent, not merely present. What “follow” means on a curve. What the author sees when the wall disappears.

### 4.7 Ceilings and Ceiling Focus

Treat ownership and viewing as different questions. Research did.

**Ownership — established as the selected model, with a stated limit.**

An independent ceiling region, owned by the layout document, is the selected model. A room may seed a ceiling and may overlap one. The room does not own it. A ceiling is not room metadata, and it is not a staged scene object.

Evidence grade matters here. FreeCAD and Bonsai **directly demonstrate** the shared cut kernel, identity-through-projection, and storey-free sections. For ceilings they only **support compatibility**:

- Bonsai’s containment is optional and is a scheduling link, not a geometric parent. Room-free elements are normal. Sections run with storeys ignored.
- Neither codebase special-cases ceilings in the view code. FreeCAD sections a roof as a generic solid. Bonsai’s reflected plan contains no ceiling-type branch. A ceiling can be authored as ordinary geometry and consumed by the same pipeline.
- Nothing in either harvest required a volumetric cell complex before a ceiling could exist.

What that does **not** prove: that every multi-room case is solved by footprint overlap alone. Spanning — one ceiling over several rooms, several ceilings in one room, partial coverage, two adjacent rooms that disagree — is still to be reconciled when this is implemented. Design for those cases. Do not invent a volumetric topology to feel safer, and do not claim the harvests mathematically proved overlap is sufficient.

**Homemaker was not harvested.** It is the open-source system that decomposes a building into a Topologic cell complex: 2D traces (wall and room chains) and 3D hulls (roof and soffit shells). The question it would answer is whether a robust multi-room ceiling actually needs that volumetric topology. Research stood the harvest down. Bonsai’s optional containment and FreeCAD’s generic solids already support a lightweight region, and a full Homemaker study would reopen a chosen direction. The only trigger for a short, targeted read of Homemaker’s trace/hull split is a design direction that specifically doubts room-free spanning. Do not do that read as homework. If your direction depends on cells, hulls, or roof shells, it is outside this assignment; say so and stop that direction.

Profiles in scope: **flat, shed, gable**. Outside: freeform meshes, roof assemblies, overhangs, fascia, drainage, multi-plane linked roofs.

**The relationship to today’s derived ceiling is open.** Today a room ceiling is the max boundary-wall height, plus a thickness number. Research did not say whether an authored ceiling region replaces that, sits under it, or leaves it as the closure when no region exists. Visitor-visible interiors still need a closed overhead. Full roof semantics are out. Your direction must show the unauthored, partial, overlapping, and spanning cases and must label the choice as a proposal.

**`Fit wall to ceiling` is provisional.** A wall top might later follow a ceiling, with the dependency running ceiling → wall, never in a cycle. The precedent is Revit’s attach. It is not harvest-proven. Whether P26 includes it, how an attached wall looks, and how a cycle is refused are open. A direction may include it or exclude it. If you include it, show the refusal. Do not present it as a settled feature.

**Viewing — established policy, open scope.**

Bonsai’s reflected plan is the same pipeline and the same context set as the plan, plus four deltas and no ceiling-specific logic:

1. the camera looks the other way in Z;
2. the serialized drawing is mirrored in Y (the bit a camera matrix does not carry);
3. a 2 mm Z offset, opposite in sign to the plan’s offset, so coplanar faces do not fight;
4. an explicit cut height. Bonsai uses storey elevation + 1.6 m. It does not read the ceiling’s own elevation.

P26 therefore needs a reflected instrument kind that reuses the plan’s scope, at an explicit height, with a mirror policy. The cut height is an instrument parameter with a sensible default. It is not derived from the ceiling geometry.

Including the **viewing** policy is cheap because it falls out of the shared core. Which **ceiling handles** the view exposes, and whether Ceiling Focus ships in the first P26 release or immediately after, is a design recommendation this assignment asks you to make. There is no separate ceiling mode and no RCP label.

### 4.8 Vertical vocabulary

**Established as the bounded vocabulary. Not a schema.**

| Subject | What P26 is allowed to add | What stays out |
|---|---|---|
| Wall | A piecewise-linear top along the wall: distance along the wall (arc length on curves) and a height. Forms: constant, slope, gable. The slope is authored on the wall and the section consumes it as a solid. No special section code per form. | An arbitrary wall-profile sketch. Freeform tops. Per-side wall heights. The physical wall stays one object; overhead conditions on each side are the ceilings, not a second wall. |
| Opening | Authoring of width, sill, head, and arch rise, with handles and exact inspector values. Profiles already exist: rectangular, rounded, pointed. | Door families, jambs, swings-as-truth, catalogs, handing theater. Swing marks, if shown, are symbols derived from the opening, not a second geometry. |
| Column | Footprint + base + height/top, **when** the object is structure or a spatial boundary. Then it is architecture. A decorative prop stays a scene object and is a later staging concern. | A new “column family.” The meaning decides the owner. The mesh does not. |
| Platform | Footprint + base + thickness/top, **when** it changes the walking surface or the room volume. Then it is architecture. An artwork plinth stays staging. | A new solid modeler. Identity stays on the platform even if its outline is drawn near a wall. |
| Ceiling | Independent region. Flat, shed, gable. | Roof systems. Overhangs. Meshes. |

FreeCAD walls are a single height scalar, sectioned as generic solids. That does not contradict profiles: once the solid has a shaped top, the existing “cut the solid” path is enough. No section-side support for slopes is required. Sweet Home 3D’s endpoint-height interpolation was not harvested; a piecewise-linear profile already includes “two heights and a straight interpolation” as its simplest case.

Column and platform had no view-specific evidence in either harvest. That is consistent with kind-agnostic consumption, not evidence that the product already has these types. It does not (§3).

**Open.** Handle grammar for profile points, which must not be a generic 3D transform gizmo wearing a new icon. Ridge, eave, and slope interaction in section and in plan. Which of these 3D is allowed to edit coarsely. The batch-edit question in §4.10.

### 4.9 Several rooms, and levels later

**Established.** Levels (storeys) are not a prerequisite for any P26 view or edit.

- FreeCAD sections raw geometry. A storey object is not required.
- Bonsai builds sections from a cursor and a direction. Storeys are off in the serializer. Placement is an absolute chain. Containment in a storey is optional metadata. Plan and reflected plan use the storey only as a convenient height datum, and they fall back to the origin when it is missing.

What “reserve a datum” means, without designing a level feature:

- Vertical numbers are absolute in the architectural sense: a base elevation, a sill relative to the host wall’s base, a profile height. Their meaning must not depend on an implicit “the floor of the world is Y = 0,” and must not depend on a level container existing.
- The current product already has a floor elevation, and it is not required to be zero. Use it. Show it in at least one scenario.
- A future level, if it is ever built, is a named datum (an id and an elevation) plus an optional link. It references those numbers. It does not become the geometric parent that restructures them.

No level UI, no storey manager, no “which floor is this section on” as a prerequisite for cutting.

**Multi-room sections** are made readable by finite span, finite depth, and optional crop. The visual order research wants is:

```text
CUT  >  NEAR  >  FAR  >  passive context  >  hidden / absent
```

Cut is strongest, with a light neutral poche (a flat fill per source). Projected geometry is thinner. Selected uses the existing selection color. Hover is softer. Do not introduce a section-red that fights selection. Far-field fading and gradation are **open**: both harvested codebases exclude instead of fading, while commercial tools fade. There is no implementation precedent in the harvests for how the fade works. Propose it, or propose hard exclusion plus Reveal, and say which.

A shared wall remains one wall. Each side may meet a different ceiling. The model is “wall top + ceiling A + ceiling B,” never “the north room’s copy of the wall has its own height.”

### 4.10 Selection sets and transforms

**Established.** P26 does not become a transform product.

Full architectural multi-select — stretching a room, rotating part of a plan, mirroring a wing, auto-splitting walls, breaking a wall off its junctions — is a later capability. It tangles shared-wall ownership, junction creation, opening hosts, identity, undo, and curves. It is a solver disguised as a drag. Do not smuggle it in as “spatial depth.”

In scope only if a vertical tool genuinely needs it: **same-property batch edit**. Examples research named: several walls’ heights, several openings’ heads aligned, several columns’ heights, several ceiling properties. Bounded. No new topology.

Safe later, and not this assignment: moving, rotating, or mirroring the entire layout as one object.

The current product is single-target. Marquee multi-select is not a shipped architectural feature. A direction that needs a same-property batch edit must show the selection set, the one transaction, and the refusal when the members disagree. A direction that needs no batch edit should say so; that is a valid answer.

Room-stretch questions (does the shared wall move, does the neighbor shrink, do connectors appear, or is the gesture refused?) stay unanswered on purpose.

### 4.11 Presentation principles that are settled, and the ones that are not

**Established.**

- Stream order and weight: cut strongest, projected thinner, hidden subordinate or absent, symbols derived. Split the streams in the data. Style them at draw time. Do not style one soup of lines and hope selection can recover.
- Poche is a flat fill per source. No hatch engine. FreeCAD’s hatch path is a commented stub. Legibility at this product’s scale does not need material patterns.
- Precision chrome appears around the active target: handles, temporary dimensions, one accepted snap, a guide, the proposal. It goes away on commit.
- Snap reuses the plan engine and its winner-takes-all rule. Vertical candidates join that set.
- Scene content drawn in an orthographic view is passive context. It is not a hit target for architectural edits. Staging stays staging.
- Semantic zoom sheds detail in an order: dimensions, then secondary edges, then labels, then handles. The cut silhouette is last to go.
- Plan, at rest, shows a quiet cut line and look arrow. Span and depth chrome appear when the section is the selected instrument.

**Open — say explicitly that you are proposing, not reporting a finding.**

- Far-field fade versus hard cutoff.
- Gable and shed handle grammar.
- Cut-only’s control.
- Reveal’s interaction.
- Temporary-dimension placement, collision, typing, and keyboard order.
- How ceiling edges are drawn against walls.
- Whether a room is filled or labeled in section.
- Which coarse handles exist in 3D, and how 3D avoids a gizmo on every edge.
- Ceiling Focus: overlay on the plan versus a focused styling of the same instrument, and whether it is in the first release.

### 4.12 What the harvests changed, in brief

Use this as a map of confidence, not as a second brief.

**Strengthened.** Contextual instruments. One derivation core. Wall Elevation as a constrained section. Derived output kept outside the document. No levels required. One intent pipeline. One snap engine. The rejections in §5.

**Refined.** Kind is explicit editor state plus a small policy, because mirror cannot be inferred from the camera. Depth is a required derivation parameter. Selection identity includes per-primitive source ids, reason-coded exclusion, and Reveal. The elevation plane follows the wall. Hit, resolve, and intent are separate. Ceiling Focus has an exact delta list (flip, mirror, offset, shared scope, explicit height). Fit/recenter is adopted, without FreeCAD’s X-only margin. Cache derived work per source, not per tessellated face.

**Standing, but narrower.** Depth epsilons stay a renderer tolerance, not a number in the UI. Flat poche is enough. The instrument does not need a merge step.

**Rejected by the harvests.** Orientation alone as the reflected-plan model. Recovering openings by classifying faces. Authored per-view geometry (Bonsai elements can carry a plan swing, an elevation, and a 3D body as separate representations, with no check that they agree — that is a second source of truth).

### 4.13 Invariants

These are hard boundaries. A direction that breaks one is not a candidate.

```text
I1   One architectural document owns all architecture.
     Scene owns staging. One compiler feeds Plan, orthographic views, 3D,
     and the visitor.

I2   Orthographic output is derived and non-authoritative.
     It persists at most as editor or view state outside the document.
     No surface writes architecture except through a canonical change.

I3   One orthographic core, parameterized by an explicit kind (editor state,
     never document truth) and a small per-kind policy.
     No separate geometry pipeline per view.
     No orientation-only inference where policy (the mirror bit) is not
     in the camera matrix.

I4   Every selectable derived primitive carries canonical source identity.
     No section-local entity ids.

I5   No destructive merge of selectable streams.
     A future export merge keeps membership records.
     The editing instrument does not merge.

I6   One hit → resolve → intent path for every surface.
     Hit does not know the model. Resolve owns relationships.
     The result is one layout transaction or nothing.

I7   Openings keep their identity outside the wall mesh.
     Interaction uses the host→opening relationship.
     Derivation emits opening primitives from that relationship.
     Faces are never classified to recover an opening.

I8   Levels are not required for any P26 view or edit.
     Vertical numbers stay meaningful without a level container.
     A future level is a named datum plus an optional link.

I9   Ceilings are layout architecture beside rooms.
     They are not room metadata and not scene geometry.
     Rooms may seed or overlap a ceiling. Ownership does not flow through
     the room. Exact spanning topology is still to be reconciled;
     do not replace the region model with a cell complex in this design.

I10  Plan remains the horizontal authority for footprints, topology, and
     section placement. Orthographic surfaces expose vertical precision.
     3D exposes bounded spatial manipulation. None of them owns a private
     architecture.

I11  Membership is evaluated once from scope, span, depth, and crop.
     Every consumer sees the same included set and the same reasons.
     Render, hit testing, snapping, and overlays do not reinterpret membership.
```

---

## 5. Scope boundaries

Three columns. The middle column is the design space. Do not move an item rightward into the middle because it would make a demo richer, or leftward because it would be easier to draw.

| | Existing behavior (shipped) | P26 design scope | Deferred |
|---|---|---|---|
| Views | Plan and 3D only | Contextual Section, Wall Elevation, Ceiling Focus over one derivation | Peer view tabs, sheets, named drawing sets, plot output |
| Wall vertical | One positive height from the floor elevation | Piecewise-linear top: constant, slope, gable | Arbitrary profile sketches, per-side wall solids |
| Opening | Hosted door/window; width, height, sill; rectangular, rounded, pointed | Authoring those values, plus arch rise, in elevation and section, with inspector parity | Families, jambs, catalogs, handing systems |
| Ceiling | Derived from the tallest boundary wall; thickness metadata | Independent flat / shed / gable regions; Ceiling Focus as reflected policy | Roofs, overhangs, fascia, drainage, meshes |
| Column / platform | Layout-object presets only | Architectural extents when the meaning is structure or walking surface; decorative props stay scene objects for P24 | A component catalog |
| Depth | None | Finite depth as a required parameter; cut-only as a mode to design; crop; Reveal | Unlimited depth as the default; a second clipping truth per renderer |
| Selection | One canonical entity; single target | Same identity in the new views; reason-coded exclusion; opening identity via the host relation | Section-local objects; face guessing |
| Multi-edit | Single target | Same-property batch edit only if a vertical tool needs it | Room stretch, partial rotate/mirror, disjoin, auto-split |
| Levels | One floor datum (an elevation) | Datum-safe numbers; sections work without a storey | Level / storey hierarchy |
| Performance | One compiler; large curved plans can already hitch (the P23B problem, unmeasured) | Instruments that do not add a second compiler or a second membership test | P23B’s optimizations; do not design them here |
| Staging and experience | Scene is separate; visitor consumes the compilation | Orthographic views may show scene content as passive context | P24 materials, lights, plinth authoring; P25 visitor interaction |
| Shell | PLATE; Plan and 3D are the durable views | Contextual instruments inside that shell, with a return path | A new top-level view; a restyle of PLATE |

Also out, stated so they are not slipped in: IFC classification, phases, assemblies, schedules, structural analysis, MEP, family editors, freeform solid modeling, Blender-style mesh editing, and any visitor-only architecture.

---

## 6. Design problems

Each problem is open inside the invariants. A complete direction answers all of them. Where you consider the question premature, say what the author sees instead, and what you are deferring.

### 6.1 Instrument navigation

How does a person discover and enter a section, a wall elevation, and a ceiling focus without those tools becoming peers of Plan and 3D?

Research rejected a permanent orthographic workspace and rejected hiding the capability so well that only an expert finds it. The shell’s rank already has a slot called “contextual instrument,” under the durable view and above the local mode. Use that slot. Show:

- where the command lives (tool tray, view bar, selection action, inspector);
- what the view bar and the domain spine do while the instrument is open;
- the return to Plan, in one obvious action, from every instrument;
- whether 3D can open an instrument, and that Camera never can;
- what is remembered when you return (selection, the cut line, a recent-section list);
- empty entry: no walls yet, no selection, a room with no boundary.

The return path is part of the design, not a back button added at the end. Contextual tools fail when the author cannot tell how they got there or how to leave.

### 6.2 Section creation and depth

Propose the gesture that creates a section, the default finite depth, the look-direction control, and the way span and depth are edited after creation.

Include cut-only as a real state with a consequence the author can see. Include vertical crop. Say whether crop belongs to the instrument or to the session frame.

Show the cut line in plan before, during, and after the instrument is open. If nothing remains after exit, say what makes the section findable again.

### 6.3 Reading cut, projected, and hidden geometry

Draw the same model three ways and use one legend across your boards:

- **Cut** — the solid the plane intersects. Strongest line, light neutral poche, flat fill per source.
- **Projected** — beyond the cut, inside the depth. Thinner.
- **Hidden** — present in the model and suppressed by policy. Either absent, or shown in a clearly subordinate way. If you show it, it stays hit-tested only under the rules you state.
- **Symbol** — a derived mark (an opening swing, a ridge line) that is not a second solid.
- **Excluded** — outside depth, span, crop, or scope, with a reason available.

Show selected and hover on top of those streams without replacing them with a new color system. Selection color is the product’s existing selection color.

Show a shared wall cut by the plane, an opening in that wall, a wall beyond the cut, and something past the depth. The author must be able to tell those four apart at a glance and with the navigator closed.

### 6.4 Finite depth, crop, and Reveal

Depth is a required parameter. Design its control: a handle in the plan, a handle in the section, an inspector field, or a combination. Show the value, the side it measures from, and what happens at the far plane.

Reveal is the answer to “where did that opening go?” Design it. The minimum content is the reason (`outside depth`, `outside crop`, and the others in §4.2) and a way to bring the excluded object into attention without destroying the section. State whether Reveal changes depth, temporarily shows the object, or navigates to another view. State what happens to selection if the entity is excluded.

Also design the quiet case: nothing was excluded, so Reveal is not shouting.

### 6.5 Wall Elevation

Design entry from a wall, from an opening, and from a room (the chooser over boundary walls). Design the shallow depth behind the face. Design return.

Design follow: the author moves the wall in plan, or edits a curve, and the elevation is open or is reopened. Design the curved wall specifically. Design deletion of the wall while the elevation is open. Design the oblique wall that cannot be an elevation: the refusal, the reason, and where the author is sent.

Opening handles: left and right width, sill, head, arch rise. Wall-top points along the wall. The inspector shows the same numbers and stays in lockstep with the handles. The architectural value has one owner. Do not add a second chrome control (tool tray, view bar, status) that edits that value independently of the inspector.

### 6.6 Ceiling authoring and Ceiling Focus

Propose how a ceiling region is created. Research named three possible entries and did not choose a subset: from a room, across several rooms, or from a drawn footprint. Choose a first set. Show defaults. Show overlap: two regions in one room, one region across two rooms, a partial cover, a gap with no region.

Propose how flat, shed, and gable are edited in section and in Ceiling Focus: ridge, eave, slope, height. Keep the handles specific to the profile. A generic move/rotate gizmo is not an answer.

Propose Ceiling Focus presentation: a reflected styling of the plan’s work surface, or an overlay. No RCP nomenclature. Show the mirror so that text and “left/right” stay intelligible. The cut height is explicit; show where the author sees and edits it, and a default that does not pretend to have read the ceiling.

State whether Ceiling Focus is in your recommended first release or the immediate follow-up, and what the author does about ceilings if you defer the view. Viewing policy is cheap. Handles are the cost. Make the trade-off explicit.

State your proposal for the gap between today’s derived room ceiling and an authored region. Label it as your proposal.

If you include **Fit wall to ceiling**, show attach, detach, the attached appearance in plan and section, and a cycle refusal. If you exclude it, say what the author does instead when a wall should meet a sloping ceiling.

### 6.7 Selection, reveal, and the Inspector

One entity, every surface. Storyboard at least this loop:

1. Select an opening in plan. The navigator and the inspector agree, including host and kind.
2. Open the host elevation. The same opening is selected. Handles are the elevation’s handles.
3. Change the sill from the handle and from the inspector. One history entry each. The other control follows.
4. Return to plan. The opening is still selected. Undo restores the sill.
5. Switch to 3D. The opening is still selected. If your 3D view has no opening-detail handles, the selection remains and the precision action points back to the elevation.
6. Put the opening outside the section depth. The selection is not deleted. The author can see the reason and can Reveal.

Also show a wall selected from a cut face, a ceiling selected in Ceiling Focus, and a scene prop visible in the section that cannot be edited there.

Search and the navigator must find the entity while an instrument is open, using the existing name and reference, not a section-local name.

### 6.8 Gestures, handles, dimensions

For each editable number in the vocabulary, say:

- which views show a handle;
- which views show only the inspector;
- where the temporary dimension sits, how it avoids colliding with the drawing, whether it is editable by typing, and whether hover dimensions differ from selected dimensions;
- what the keyboard does (confirm, cancel, move to the next field);
- what an illegal value looks like (opening taller than the wall, negative height, gable with no ridge). Refusal with a reason. The document unchanged.

Wall-top points are edited as profile points along the wall, including on a curve (distance along the wall, not a screen-x approximation).

3D handle subset: name the coarse handles you allow (research’s likely set is wall, column, platform, and ceiling) and the ones you refuse (opening arch, profile intermediates). If you allow none in 3D, design the redirect. The failure mode to avoid is a handle on every edge of every solid.

### 6.9 Dense, empty, and unsupported

The gallery in §9 is the dense case. Also design:

- an empty project;
- a single wall and no room;
- a room whose derived ceiling is the only overhead, because no region was authored;
- a section that cuts nothing;
- a ceiling footprint the author has not closed;
- an attempt to stretch a room or multi-select a wing (the product does not do this; the UI must not imply that it will);
- two walls with the same name;
- a floor elevation that is not zero.

Unsupported is a designed state: a sentence that says what is wrong and what the author can do, not a disabled control with no explanation.

---

## 7. Architecture constraints

These protect the shipped system. They are the same invariants as §4.13, stated as design constraints.

**One navigation system.** The product has one camera graph and one motion model for visitor movement and for camera authoring. A section’s look direction is instrument state inside the editor. It is not a camera node, not a tour stop, and not a second way to move a visitor. Do not put section planes into the camera timeline. Do not design a section camera.

**Scene and Camera stay different domains.** Instruments are Scene / Layout attention. Camera keeps the timeline and the camera graph. Opening a section does not switch the author into Camera, and Camera Plan does not gain a section tool for symmetry.

**Two documents.** Layout owns architecture, including any ceiling, column, or platform your direction classifies as architecture. Scene owns staged props, lights, materials, and cameras. A ceiling is not a scene mesh. A plinth is not a layout slab. Editing in 3D does not transfer ownership.

**Plan and 3D, and the new instruments, are views of one compiled world.** There is one geometry compiler. Orthographic derivation consumes its solids and its hosted relationships. It does not build a private mesh, resample curves, or re-solve how walls join. P23B may later change the cost of that compiler. It will not add a second one, and neither does this design.

**Placement is project/world-local.** Scene and camera coordinates are world coordinates. Layout objects are document-level world coordinates. The floor elevation is a datum, not a room frame. Legacy room-frame files are a compatibility read path only. Do not design room-parented transforms back into the product. A room drag today, where it exists, moves the room’s walls as architecture; it is not a transform parent for staged objects. P26 does not add a new transform parent.

**Identity, selection, and history stay canonical.** The id the plan uses is the id the section uses. One gesture, one history entry, tagged to the layout document. Handles and temporary dimensions are not history. Undo restores the architectural value and the selection.

**No competing authority.** No second selection model inside the instrument. No second snap engine. No second gizmo host: the 3D view already has one transform host with separate adapters for scene, camera, and layout. Orthographic handles are a different presentation of the same rule — they emit layout changes through the existing transaction path. They do not become another host with its own undo.

**Visitor isolation.** The published visitor and the frozen museum route do not receive editor chrome, section instruments, selection, or history. Anything you draw is an editor surface. The visitor consumes the compiled interior only. Do not propose a visitor-facing section tool.

**PLATE.** Compose the instrument from the existing chassis, paper, and instrument materials. Use the shell’s type, color, and state language. Do not introduce local font sizes or a new control style to make the section “look technical.” Paper may hold the drawing and its handles. Controls sit in the chassis and the instrument layer. One writer per fact. The inspector resolves one target.

**Invalid stays invalid.** Proposal, validate, refuse with a reason. No silent fix.

**Height is not topology.** A profile edit, a ceiling edit, or a depth change does not create or destroy rooms or junctions.

---

## 8. What to deliver

If this brief is given to several designers, each designer submits **one** complete direction. The set of submissions is what gets compared, so directions must differ in structure, not in taste.

If you are responding alone, submit **two** directions that differ in at least one of: instrument navigation, the depth/Reveal model, or the ceiling-authoring entry. Style both of them with PLATE. Do not spend the second direction on a dark theme.

For **each** direction, include all of the following.

1. **Information architecture.** A map of entry, exit, and the shell ranks while each instrument is open. Desktop 1440 × 900. State what happens to the navigator, inspector, view bar, tool tray, and status when the author is in a section.
2. **Core workflows**, storyboarded on the scenarios in §9: create a section and set a wall-top; open a wall elevation and set a sill and an arch; create a ceiling and see it in section and in Ceiling Focus; return to plan with selection intact.
3. **Section, elevation, and ceiling interaction.** The gestures and handles, drawn on the model, not described only in a paragraph.
4. **Cut / projected / hidden / symbol / excluded**, using the legend in §6.3, on a multi-room cut.
5. **Depth controls and Reveal**, including an object that is excluded and the reason.
6. **Selection and Inspector.** The opening loop in §6.7. Show the same identity in the navigator, the view, and the inspector. The handle and the inspector edit one architectural value and cannot diverge. No third control writes that value.
7. **A dense case** from §9, not only a two-wall diagram.
8. **Empty, failure, and unsupported states** from §6.9, at least: empty project, deleted wall during elevation, oblique wall, illegal opening, room-stretch attempt, no ceiling authored.
9. **PLATE compatibility.** One frame that shows the instrument inside the shipped shell composition. Annotate return, domain, and view. Do not restyle the chassis.
10. **Trade-offs and unresolved decisions.** For every open question in §6 that you answered, name the alternative you rejected and why. For anything you did not settle (spanning topology, fit-to-ceiling, the exact default depth, whether Ceiling Focus is in the first release), leave it marked unresolved. Do not convert a research limit into a fake certainty.

Label every board with the direction name and the scenario id.

Recommend one direction as your primary, and say under which future evidence you would switch. The recommendation is yours. This brief does not have one.

Out of scope for the response: implementation plans, schemas, component trees, performance budgets, and a restyle of PLATE.

---

## 9. Canonical scenarios

Use these so two proposals can be scored against the same model. Dimensions are meters. The floor elevation is **0.15** throughout, so a design that assumes the world starts at zero will fail in public.

Do not add rooms, roofs, or levels beyond what a scenario asks. You may simplify a storyboard frame, but the pressure tests must appear at full complexity somewhere in the direction.

### S1 — Two galleries and a shared wall

- Floor elevation 0.15. Heights below are wall heights; world-Y tops are elevation + height.
- North room, 8 m east–west by 6 m north–south. South room, 8 × 5, sharing North’s south wall.
- Shared wall height 3.20 (top Y 3.35).
- North’s north wall height 4.20 (top Y 4.35). North’s east and west walls height 3.20.
- South’s other three walls height 2.80 (top Y 2.95).
- Derived ceilings, as the product works today, are one flat plane per room at the **maximum** boundary-wall height. North’s plane is Y 4.35. South’s plane is Y 3.35. The shared wall is shorter than North’s ceiling, so there is already a gap above that wall inside North. Your ceiling proposal must say what the author sees in that gap before they create a region, and after. The curved partition below is not a boundary wall and does not move either plane.
- Door in the shared wall, centered, width 1.00, height 2.10, sill 0, rectangular. It connects the rooms.
- Window in North’s east wall, width 1.80, height 1.20, sill 1.10, rounded profile. Head at 2.30, under that wall’s 3.20 height.
- A curved partition inside North, not part of the room boundary, height 2.40.
- An East gallery, 6 × 6, sitting east of North with a short gap between them. It exists so a finite depth can exclude it. It is not part of S1’s ceiling story.

### S2 — Section across both rooms

Cut line in plan runs north–south through the center of the door, looking east. Span covers North and South. Finite depth reaches North’s east wall and stops before the East gallery.

The board shows: cut poche on the walls the plane crosses (including the shared wall at the door), the door as an opening with its own identity rather than an anonymous hole, North’s east window in projection if you allow a facing wall beyond the cut to read as projected, the curved partition if it falls inside the depth, and the East gallery absent with a reason.

On this board, edit a value the cross-section can show truthfully (the door’s head or sill, or the cut wall’s height at this station) and show the inspector. If the projected east window is not honestly editable from this view, show the redirect to its elevation instead of a fake precise handle. The along-wall gable is S3, not this board.

### S3 — Elevations of the shared wall

- North side and south side are different views of one wall.
- The door is the selected opening.
- Edit width, sill, and head.
- Raise the wall top into a gable with the ridge over the door. The inspector shows the same profile.
- Then delete the wall from the navigator while the elevation is open, and show the recovery.
- Separately, open an elevation of the curved partition. Show follow when a bend point moves. Show the oblique case: the author asks for an elevation of a wall that faces the wrong way, and the product refuses with a reason.

### S4 — Twelve-room wing (density)

A 3 × 4 grid of rooms, 6 × 5 each, sharing walls, alternating wall heights 3.0 and 4.2. Two doors and one window per room on average. One curved wall. One section cut through a row, finite depth of about one room, so eleven rooms are excluded.

Show that the drawing stays readable, that the navigator still names the selected wall by reference when names collide (“Gallery” appears four times), and that Reveal can surface one excluded opening without turning the section into an infinite elevation.

### S5 — Ceilings

On S1:

- Direction A’s ceiling story: one shed region spanning north and south, sloping down toward north, ridge along the south exterior.
- The comparison case, on the same plan: two regions inside north only (one flat, one gable) and no region in south.
- Partial coverage: the north region stops 1 m short of the east wall. The gap is a designed state.
- Ceiling Focus at an explicit cut height (propose the default; do not silently use 1.6). Show mirrored left/right so a label on the east window stays readable.
- Overlap: the two north regions overlap by 0.5 m. Show whether that is refused, stacked, or trimmed, and mark the choice as your proposal. Research did not settle overlap topology.

### S6 — Depth and Reveal

From S2, shorten depth until North’s east window is outside it. The window remains the selection. The author sees “outside depth” (or your wording) and a Reveal action. Show the result of Reveal, and show undo of that action if Reveal changed the instrument.

Also exclude by vertical crop: crop out everything below 1.0 m so the door sill is outside the crop, and show that reason as distinct from outside depth.

### S7 — Selection round trip

The loop in §6.7, using S1’s door. Include undo. Include 3D with the same selection and without opening-detail handles, unless your direction explicitly includes a coarse sill handle — in which case show both the coarse 3D handle and the elevation’s precise one, and show they write the same value.

### S8 — Column, platform, and a prop

- A column the author means as structure: footprint 0.4 × 0.4, base at the floor elevation, top at 3.35. Show it in plan as a footprint and in section as a height. It is architecture in your direction, or you explain why it stays a layout object.
- A platform the author means as a walking surface: 3 × 2, top at 0.45 above the floor, thickness 0.20. Section shows the rise. It stays selectable as itself where it meets a wall.
- A scene artwork on a plinth inside north. It may appear in the section as passive context. It is not selectable as architecture. The inspector does not become a material editor. That work is P24.

### S9 — Failures

- Empty project, section tool armed.
- Section that misses every wall.
- Opening height edited above the wall top. Refusal, reason, document unchanged.
- Gable interaction with the ridge dragged onto an eave. Your rule, visibly enforced.
- Author selects two rooms and drags, expecting a stretch. The product does not do this. Show the state.
- Floor elevation 0.15 is visible somewhere so heights are not drawn as if zero were the floor.

### S10 — PLATE frame

One 1440 × 900 frame of S2 inside the shipped composition: domain spine (Scene), view axis (the instrument under Plan, not beside it as a third peer), navigator, inspector, tool tray, status. Return to Plan is visible without a tooltip. Camera timeline is absent because this is not the Camera domain.

---

## 10. How responses will be compared

A direction is reviewable when a reader can complete S1–S10 from the boards alone.

Prefer the direction that:

- keeps Plan, the instrument, and 3D as views of one model, with a return path a new author can find;
- makes cut, projected, hidden, and excluded distinguishable in the dense wing (S4), not only in a diagram;
- keeps one selection identity, with the handle and the inspector editing one value and no third control writing it;
- treats depth as a parameter the author can see, with a reason when something vanishes;
- authors ceilings as regions beside rooms, and is honest about overlap and about the derived ceiling that exists today;
- refuses the out-of-scope gestures in S9 instead of hinting at them;
- fits PLATE without a new visual system;
- labels its unresolved choices as unresolved.

Reject a direction that:

- adds a peer workspace, a sheet, a level manager, or a roof system;
- gives the section its own objects or its own undo;
- recovers openings from faces;
- merges selectable geometry and then cannot say what was clicked;
- evaluates “what is in the view” in the renderer differently from the hit test;
- puts architecture into the scene document, or a visitor control into the editor;
- depends on P23B already having solved performance, or proposes a second compiler;
- treats this brief’s open questions as if research had closed them.

---

## 11. Questions this brief leaves open

These are not omissions. A response answers them as proposals or marks them unresolved. The owner has not picked among them.

1. Navigation presentation and the exact return pattern.
2. Section creation gesture, default finite depth, cut-only control, crop presentation, what remains in plan after exit, transient stack versus a short list.
3. Depth and crop handles, and the Reveal interaction.
4. Whether Ceiling Focus ships in the first release, and how it is presented.
5. Wall-top and opening handle grammar; temporary dimensions.
6. Shed and gable ridge / eave / slope interaction.
7. Whether “fit wall to ceiling” is in P26, and how a cycle is shown.
8. Far-field fading versus exclusion only.
9. Which coarse handles exist in 3D.
10. Which ceiling-creation entries are in the first set, and how overlap works.
11. Whether any same-property batch edit is included.
12. How an authored ceiling region relates to the room ceiling the product derives today from wall heights.
13. Opening intent identity: opening id alone, or host plus opening.
14. Auto-follow on curved walls, and the deleted-wall case.

Spanning topology (whether footprint overlap is enough for every multi-room ceiling) stays a later reconciliation. Design the cases in S5. Do not settle the topology by drawing a cell complex.

---

## 12. Provenance

You do not need to open these. They are the evidence behind §4. Dates and revisions are the ones the synthesis recorded.

| Source | What it contributed | Limit |
|---|---|---|
| P26 synthesis, `research/synthesis/p26-architectural-spatial-depth-synthesis.md` | The conclusions in §4, including invariants I1–I11 and the open list in §11 | Research authority for this assignment. Not an owner-ratified UI. |
| Phase-1 product research, `research/broad/deep-research-P26-phase-1.md` (compact beside it) | Why the product is contextual instruments plus a bounded vocabulary; commercial patterns from Revit, Archicad, Vectorworks, BricsCAD, Rhino, SketchUp | Product hypotheses. Harvests later confirmed, narrowed, or rejected them (§4.12). |
| FreeCAD BIM section plane, `main` at `3f5a2ae6b`, LGPL-2.1. Harvest: `research/harvests/P26-phase2-freecad-section-orthographic-harvest.md` | One instrument over many sources; cut / kept / hidden split in data before styling; depth implemented and then ignored by the main drawing path; identity lost at flatten; openings baked into the wall solid; generic solids, so slopes need no special section code; fit/recenter as a pure function, with an X-only margin bug; no elevation-specific code; no view-kind field | The drawing path stores a baked symbol and navigates back by hand. Too heavy, and the wrong place to persist output. Unlimited depth is not a recommendation. |
| Bonsai / IfcOpenShell, `v0.9.0` at `998060b6`. Bonsai GPL-3.0, library LGPL-3.0. Harvest: `research/harvests/P26-phase2-bonsai-view-identity-rcp-harvest.md` | Explicit view kind as policy over a shared cut; reflected plan = flipped plan + mirror + opposite 2 mm offset + explicit cut height, and no ceiling-type code; identity as ids until a shape merge; raycast separate from semantic resolve; openings recovered from relations, not faces; three layers (annotation, cache, gizmo); sections without storeys; four disagreeing filters; per-view geometry representations as a second-truth hazard; selection orphaned when isolation follows the camera | Documented drift between saved view properties and live camera properties. Do not copy that split. |
| Homemaker / Topologic, GPL-3.0. Not harvested | Would have tested whether multi-room ceilings need a volumetric cell complex (2D traces, 3D hulls) | Stood down. Compatibility evidence favors a lightweight region and does not prove every spanning case. A targeted read happens only if a design direction doubts room-free spanning. This assignment does not ask for that direction. |
| Sweet Home 3D, Blueprint3D | Endpoint heights; a browser plan-to-3D prototype | Stood down. Not inputs to this brief. |

Shipped product facts in §2 and §3 come from the current architecture and layout contracts: wall-first layout (`formatVersion` 5), one compiler, PLATE, world-local scene placement, and the P23 close (2026-09-22). P23B’s scope comes from its planning umbrella: cost, not capability, and still in planning.
