# P23.14 — Final Designer Direction

**Status:** Ratified design direction for implementation QA  
**Working name:** **PLATE**  
**Purpose:** Authoritative designer contract for P23.14 shell and visual-system implementation  
**Next consumer:** Designer D, to produce the interactive HTML **Atlas** used as a QA reference during implementation

---

## 0. Authority and intent

This document is the final P23.14 design direction. It supersedes the earlier proposal-level interpretations of PLATE while retaining the strongest parts of Designer A’s concept.

The final direction is a synthesis of:

- the P23.14 research and shell-design context;
- Designer A’s PLATE proposal;
- owner ratification and visual exploration;
- current Museum Editor shell behavior;
- P23.12 identity/search/Inspector contracts;
- P23.13 Plan drafting and iconography contracts;
- P24 staging and multi-selection pressure;
- P26 contextual architectural-instrument pressure;
- the four ratified PLATE visual specimens: Scene/Plan, Scene/3D, Camera/Plan, Camera/3D + Timeline.

Designer A remains the conceptual ancestor of the material and axis grammar, but this document is now the authority.

The Atlas produced from this document is **not** the product specification. It is an interactive, falsifiable QA instrument that demonstrates the specification. If an Atlas detail conflicts with this document, this document wins.

---

# 1. Product thesis

P23.14 should make Museum Editor feel like a **professional spatial-authoring instrument with a warm working surface held inside a cool engineered chassis**.

The shell should feel evolved from the current product rather than replaced by a new application. Existing mental models that already work should remain recognizable: hierarchy on the left, work in the center, properties on the right, Scene/Camera as domain context, Plan/3D as durable views, and Camera Timeline as a Camera-owned surface.

The visual identity must come from structure, material, typography, state and interaction—not decoration.

The product should feel:

- professional;
- architectural;
- warm;
- creative;
- precise;
- information-rich;
- stable;
- educational when context is needed;
- distinctive without becoming theatrical.

It must not become:

- generic SaaS;
- literal CAD cosplay;
- a floating-card dashboard;
- a sci-fi control room;
- a video-editing application;
- a minimal shell that hides useful structure;
- a theme whose identity depends mainly on color.

---

# 2. Core product contracts

These are not open for redesign in P23.14.

## 2.1 One product, one world

Scene and Camera are attention domains over the same project/world. They are not separate documents or applications.

## 2.2 Durable top-level views

Plan and 3D remain the durable top-level views.

P26 contextual orthographic instruments—such as Section, Wall Elevation and Ceiling Focus—must be subordinate contextual instruments entered from a durable view with an obvious return path. They must not become a third peer view or a new top-level world.

## 2.3 Camera Timeline ownership

The Camera Timeline belongs only to the Camera domain and is available in both Camera Plan and Camera 3D.

It is part of the central work surface, not a global application footer and not a Scene feature.

## 2.4 Scene Plan local modes

Layout and Arrange remain Scene Plan local modes. Camera does not gain a parallel local-mode system merely for visual symmetry.

## 2.5 One selection authority

Navigator, viewport, Inspector, search/reveal, Timeline and status readouts must resolve to the same canonical selection identity.

A selected object must never appear to be one thing in the Navigator and another thing in the Inspector.

## 2.6 P23.12 identity contract survives

P23.14 consumes P23.12 identity. It does not reopen it.

Names, compact references, canonical identity, search behavior and Inspector rename authority remain as ratified in P23.12.

## 2.7 P23.13 drafting/iconography contract survives

Existing ratified Plan drafting language and protected P23.13 iconography remain intact unless an implementation defect requires correction.

P23.14 may harmonize surrounding shell presentation but must not casually redraw or reinterpret the settled Plan authoring silhouettes.

The landed owner ruling retains Wall / Rect Room / Poly Room / Door / Window toolbar icons as Lucide `BrickWall` / `Square` / `Pentagon` / `DoorOpen` / `Grid2x2`. The Plan Door drawing cue remains perpendicular three-dash ink; it is distinct from the retained toolbar Door icon. Other integrated P23.13 drafting marks retain their settled paths.

---

# 3. Information-rank grammar

The shell should make this rank legible:

**Project → Domain → View → Contextual instrument → Local mode → Tool → Selection / gesture / status**

Each rank has a different visual job.

- **Project** is persistent application context.
- **Domain** answers whether attention is on Scene or Camera.
- **View** answers whether the durable representation is Plan or 3D.
- **Contextual instrument** answers whether the user has entered a subordinate focused representation such as a future P26 Section.
- **Local mode** changes how the current view is being edited, such as Layout or Arrange.
- **Tool** is armed action.
- **Selection / gesture / status** describes the immediate target, interaction or readout.

Do not flatten these ranks into controls with equal visual weight.

The primary signature is perpendicular:

- **Scene / Camera = vertical domain axis**
- **Plan / 3D = horizontal view axis**

That relationship should remain visible even when the user is not consciously thinking about it.

---

# 4. PLATE material grammar

PLATE uses exactly three visual-material classes.

## 4.1 CHASSIS

Persistent application structure:

- Domain Spine;
- Project Head;
- Navigator;
- Inspector;
- View Bar;
- Status Rail;
- Camera Drawer shell.

The Chassis is cool, stable, square and quiet.

## 4.2 PAPER

The spatial working surface:

- Scene Plan;
- Scene 3D;
- Camera Plan;
- Camera 3D;
- future contextual spatial instruments when they replace/focus the current work surface.

The broader PLATE Paper baseline is warm and visually distinct from application chrome. Scene Plan and Camera Plan retain the landed P23.13 Plan Paper `#F5F7F8`; surrounding PLATE Light Chassis does not override this drawing token. A future Plan Paper change requires explicit owner re-ratification and a QA pass.

Paper may contain spatial drawing, geometry, routes, selection, guides, handles and editor overlays. It should not accumulate application controls.

## 4.3 INSTRUMENT

Controls that act on the work:

- Tool Tray controls;
- local-mode controls;
- compact utility controls;
- transport controls;
- Timeline controls;
- numeric editor controls.

Instrument surfaces may have a slight manufactured edge and small radius, but should still feel mechanically integrated into the Chassis.

Do not invent a fourth material class.

---

# 5. Reference desktop shell geometry

The Atlas must include a reference desktop frame at **1440 × 900 CSS px** and reproduce the following geometry closely enough for implementation QA.

| Region | Reference geometry |
|---|---|
| Domain Spine | x 0, y 0, w 56, h 900 |
| Project Head | x 56, y 0, w 1384, h 36 |
| Status Rail | x 56, y 876, w 1384, h 24 |
| Navigator | x 56, y 36, w 268, h 840 |
| Inspector | x 1140, y 36, w 300, h 840 |
| Central work column | x 324, y 36, w 816, h 840 |
| View Bar | x 324, y 36, w 816, h 34 |
| Tool Tray | 44 px wide, vertical, attached to the Paper edge |
| Camera Drawer collapsed | 48 px high |
| Camera Drawer expanded | 288 px high |

These values define the reference composition, not a requirement that every viewport size use fixed pixels.

Responsive behavior must preserve hierarchy and ownership before preserving exact dimensions.

---

# 6. Default theme: PLATE Light

P23.14 introduces a new canonical default theme. It replaces the old navy dark-mode visual identity as the default product appearance.

The existing navy theme is no longer the product-defining baseline. If alternate themes continue to exist, they are variants of the same hierarchy and interaction grammar; they must not redefine component roles.

## 6.1 Default theme tokens

| Role | Baseline color |
|---|---|
| PLATE Paper baseline (non-Plan surfaces) | `#F5F2E9` |
| Plan Paper (Scene Plan and Camera Plan; landed P23.13) | `#F5F7F8` |
| Chassis main | `#D9DDE0` |
| Chassis recessed | `#CBD0D4` |
| Instrument surface | `#E8E5DD` |
| Primary ink | `#252A2E` |
| Secondary ink | `#697177` |
| Scene domain accent | `#A37A3D` |
| Camera domain accent | `#347D89` |
| Selection | `#2F8CFF` |
| Selection dark edge | `#145DA8` |
| Snap / guide | `#146D68` |
| Refusal / invalid | `#9B3149` |
| Armed tool | `#C58B35` |

These are the baseline default-theme values. Minor luminance adjustment is acceptable if necessary for accessibility or rendering consistency, but hue roles and contrast hierarchy must remain stable.

## 6.2 Surface rules

- Major Chassis surfaces use no decorative shadows.
- Separation comes from 1 px hairlines, tonal stepping and alignment.
- Chassis surfaces use square corners.
- Instrument controls may use approximately 3 px radius.
- Paper handles may use approximately 2 px radius.
- Avoid pill-shaped controls unless the underlying control semantics truly demand a pill.
- Avoid floating cards inside Navigator, Inspector and Timeline.

## 6.3 Color ownership

Domain accents belong primarily to the Chassis.

Scene brass and Camera cyan must not flood the Paper.

Paper owns spatial state colors such as selection, snap/guide and refusal.

No critical state may be communicated by hue alone.

---

# 7. Typography and iconography

Use two typographic voices:

- a warm humanist sans for ordinary UI;
- a narrow mechanical mono for measurements, coordinates, IDs, references, timestamps and precision values.

Approximate hierarchy:

- 10 px: engraved/group labels;
- 11 px: status and compact readouts;
- 12 px: standard rows and labels;
- 13 px: property values;
- 15 px: panel headings;
- up to 20 px only where project identity genuinely needs it.

Do not make the product feel premium by inflating headings.

Existing P23.12 and P23.13 iconography should be retained. Protected Plan authoring silhouettes stay protected. General shell icons should be normalized around the existing visual family rather than replaced wholesale with a new icon library.

---

# 8. Domain Spine

The 56 px vertical Spine is the exclusive home of the primary domain axis.

It contains two persistent stations:

- Scene;
- Camera.

The active station receives a restrained **3 px inboard edge-light** using the domain accent.

Do not use full-surface domain-color fills.

Do not put Settings, Assets, Help or unrelated utilities into the reserved lower Spine merely because space exists.

The empty lower Spine is deliberate breathing room and future capacity, not an invitation to toolbar accretion.

---

# 9. Project Head

The Project Head is approximately 36 px high and remains compact.

It holds project/global context such as:

`Projects → project name → session state → Undo/Redo → save state → Spatial / Publish → Preview → Theme → Account → Help`

Spatial and Publish are independent chassis actions, not one segmented control.

Do not create a second global toolbar.

---

# 10. View Bar

The View Bar spans only the central work column.

Plan and 3D are engraved view tabs integrated into the Chassis. They must not look like ordinary tool buttons.

Scene Plan may additionally expose the subordinate MODE label with Layout / Arrange.

Utility controls such as Snap, Grid, route visibility and Panels live in the same horizontal work-context region but are visually subordinate to the durable view tabs.

The View Bar must not extend over Navigator or Inspector.

---

# 11. Tool Tray

The Tool Tray is a **44 px vertical instrument rail attached directly to the Paper edge**.

It is not a second sidebar and must not become one.

Use small persistent group labels and compact icon-led tools.

Representative groups:

### Scene Plan

- DRAW: Wall, Rect Room, Poly Room
- OPENINGS: Door, Window
- OBJECTS: Place, Display, Sculpture, Seating, Platform, Column

### Scene 3D

- SELECT
- TRANSFORM: Move, Rotate, Scale
- SPACE: Local, World
- OBJECTS: relevant placement actions

### Camera Plan

- CAMERA: Select, Add Camera, Connect, Sequence, Play

### Camera 3D

- CAMERA: Select, Move, Look At, Play

The exact tool list remains subject to product capability, but the rail grammar and density do not.

---

# 12. Navigator — recursive spatial hierarchy

This is the largest intentional evolution beyond Designer A’s original proposal.

The Navigator is **not** a flat inventory and **not** a filesystem.

It presents two related structures:

1. **canonical spatial containment**;
2. **contextual projections** of entities relevant to that spatial context.

## 12.1 Future-facing containment model

The hierarchy must support structures such as:

`Site → Building → Floor → Room/Space → Content`

and more generally:

`container → child container → child container → entities`

The product must not permanently hard-code “Museum → Rooms” as the only useful organization.

Examples that should fit without a shell redesign:

- Museum → Floor → Gallery;
- House → Floor → Room;
- Campus → Building → Floor → Exhibition Wing → Gallery;
- future user-defined spatial containers if introduced later.

## 12.2 Contextual projections

A Room/Space may expose contextual groups such as:

- Architecture;
- Walls;
- Openings;
- Junctions;
- Content;
- Scene References;
- future typed relationships.

Visual nesting does **not** by itself establish canonical ownership.

Example:

`Gallery North → Architecture → Walls → W-FJSK`

means “show the canonical wall relevant to Gallery North,” not necessarily “Gallery North owns this wall.”

A shared wall may appear through multiple Room/Space contexts while resolving to the same canonical entity, reference, name and selection.

This principle must remain true for future multi-floor and cross-context features.

## 12.3 Row species

The Navigator must visually distinguish:

1. spatial/container entity;
2. ordinary entity;
3. typed group heading;
4. contextual/reference occurrence;
5. relation metadata;
6. authored empty/teaching state.

Group rows such as Architecture, Walls or Content must not masquerade as ordinary selectable domain entities unless they actually become real domain entities.

## 12.4 Identity presentation

Named entities lead with name and preserve the complete compact reference.

Unnamed Wall/Opening/Junction entities may lead with reference according to P23.12.

References never truncate.

Names may ellipsize under pressure, but the Inspector must expose the full name.

## 12.5 Depth and density

Deep hierarchy must remain usable at 268 px reference width.

Use shallow indentation—approximately 10–12 px per level—not oversized folder-tree indentation.

As depth increases, preserve:

- disclosure affordance;
- entity kind cues;
- useful name excerpt;
- full compact reference;
- active selection;
- search/reveal context.

Metadata and decorative counts degrade before identity.

---

# 13. Inspector

The Inspector remains property-first.

It is not a dashboard, tutorial, project summary or documentation surface.

The top selection header should expose:

- type icon;
- name or reference;
- secondary reference when named;
- kind.

Sections follow entity semantics, for example:

- Geometry;
- Transform;
- Placement;
- Identity;
- Relationships;
- Lens;
- Sequence;
- Actions.

Consequential/destructive actions come last.

P23.12 rename authority remains Inspector-owned.

Technical/raw canonical IDs remain behind the P23.12 Technical details disclosure rather than leaking into normal identity surfaces.

---

# 14. Status Rail

The Status Rail is approximately 24 px high and is **readout-only**.

It may report:

- current domain and view;
- current selection/reference;
- save state;
- grid/snap/metric state;
- coordinates or other low-noise work-state readouts.

It must not duplicate toolbar actions.

One fact should have one authoritative control owner. Status may passively echo a fact but should not create a second control.

---

# 15. Scene states

## 15.1 Scene / Plan / Layout

The Plan remains the strongest demonstration of PLATE:

- landed P23.13 Plan Paper `#F5F7F8`;
- cool Chassis;
- vertical Scene domain station;
- horizontal Plan view tab;
- vertical Tool Tray;
- recursive Navigator;
- property-first Inspector.

P23.13 owns architectural Plan representation. P23.14 owns the surrounding shell and state language.

Selection must reconcile across Navigator, Plan, Inspector and Status.

## 15.2 Scene / Plan / Arrange

Arrange remains a subordinate Scene Plan local mode, not a new top-level view.

## 15.3 Scene / 3D

Switching Plan → 3D must feel like changing the representation of the same work, not launching a different application.

The shell, Navigator and Inspector stay stable. The Tool Tray vocabulary changes to 3D-relevant instruments.

The 3D viewport remains an editor Paper surface—not a visitor presentation mode.

---

# 16. Camera states

Camera uses the same shell grammar but changes work ownership and content.

## 16.1 Camera / Plan

Scene architecture is passive spatial context.

The Camera graph/sequence overlays receive attention priority.

Camera Plan may show:

- camera nodes;
- route/sequence;
- direction;
- selected camera;
- ordering.

It must **not** show a finite FOV/frustum cone.

Any Camera Graph shown beneath a Floor/Space in the Navigator is a contextual presentation unless/until a separate product contract establishes canonical ownership. Do not infer that a tour or sequence is permanently owned by one floor; future tours may cross floors.

## 16.2 Camera / 3D

A finite frustum for the selected camera is appropriate in Camera 3D.

Route context may remain visible when useful.

The viewport remains an editor view.

---

# 17. Camera Drawer and Timeline

The Camera Drawer belongs to the Camera domain and spans the central work column only.

## 17.1 Collapsed

Reference height: **48 px**.

Show compact sequence transport/readout only.

No fake lanes. No ruler.

## 17.2 Expanded

Reference height: **288 px**.

Use exactly these five semantic lanes, in this order:

1. Camera Path
2. Shots
3. FOV
4. Look At
5. Roll

The Timeline must feel native to the same PLATE instrument system.

Do not introduce:

- audio tracks;
- object-animation tracks;
- generic video-editor track taxonomies;
- storyboard-thumbnail substitution for the semantic lanes;
- duplicate scrubbers.

Roll is a quiet compressed summary row, explicitly showing 0° when unchanged. It should not look like a waveform.

No-flow, edge and sequence states are states of the same Camera surface, not separate products.

---

# 18. Selection and state language

The visual system must clearly distinguish at minimum:

- hover;
- selected;
- primary selection;
- keyboard focus;
- active domain;
- active durable view;
- active local mode;
- armed tool;
- disabled;
- refusal/invalid;
- warning;
- destructive action;
- preview/ghost;
- snap/guide;
- authored versus derived information.

Do not overload selection blue to mean every state.

Do not depend on hue alone.

Selection coherence is a signature product behavior: Navigator ↔ viewport ↔ Inspector ↔ Timeline should feel like one identity moving through different representations.

---

# 19. Precision and guidance

Precision feedback should appear close to the gesture that caused it.

Examples:

- dimensions near selected/drawn geometry;
- snap indication at the snap location;
- refusal reason near the failed action when practical;
- numeric precision in Inspector or local direct-entry surfaces.

Do not make the Status Rail carry all precision communication.

Educational guidance should be contextual and authored:

- useful empty states;
- short reason text for refusal;
- labels that clarify hierarchy;
- concise context help where needed.

Do not turn the Inspector into documentation.

---

# 20. P24 pressure contract

P23.14 must not pre-design P24 behavior, but it must leave room for P24 without shell reinvention.

The Atlas should pressure-test at least:

- denser Scene content;
- multiple selected objects;
- object groups / staging relationships;
- richer Inspector property sets;
- materials and lights;
- larger Navigator inventories.

The shell should absorb these by contextual density and progressive disclosure, not by adding another permanent toolbar or dashboard.

---

# 21. P26 contextual-instrument contract

P23.14 must create a clear host for future contextual architectural instruments without deciding every P26 interaction today.

Future Section / Wall Elevation / Ceiling Focus should:

- enter from an existing durable view;
- replace or focus the central Paper surface;
- show their contextual identity visibly;
- retain domain context;
- retain selection coherence;
- expose an obvious return path to the owning durable view;
- avoid appearing as a third peer view beside Plan and 3D.

The Atlas should include at least one non-authoritative P26 stress specimen showing how a contextual instrument could occupy the shell while preserving this hierarchy.

This specimen is for pressure-testing only and must not invent P26 product semantics.

---

# 22. Responsive and density behavior

PLATE must survive professional density rather than only hero screenshots.

Required stress cases include:

- Navigator width 240–300 px;
- 3 floors;
- 8+ rooms/spaces per floor;
- 70+ walls total;
- deeply expanded Room/Space → Architecture → Walls branch;
- long authored names;
- duplicate names distinguished by references;
- a wall exposed from more than one Room/Space context;
- 8+ cameras;
- expanded 288 px Camera Timeline;
- smaller desktop height around 768 px;
- light and alternate-theme contrast checks if alternate themes remain.

Progressive density is preferred over disappearance.

When space tightens, remove or compress redundant metadata before hiding identity, selection or location.

---

# 23. Accessibility and motion

The Atlas and implementation must validate:

- keyboard navigation;
- visible focus independent from selection;
- accessible disclosure controls;
- accessible Inspector controls;
- non-hue-only state differences;
- readable contrast;
- reduced-motion behavior;
- pointer-target adequacy;
- coarse-pointer fallback where relevant.

Motion should reinforce hierarchy and continuity, not decorate the shell.

---

# 24. Explicit non-goals / rejected interpretations

P23.14 must not:

- turn Scene and Camera into separate applications;
- turn Plan/3D into a generic dropdown that hides the durable-view distinction;
- introduce Section/Elevation as a third durable peer view;
- move the Inspector into a dashboard role;
- make the Navigator a literal filesystem;
- infer canonical ownership from tree placement;
- permanently flatten Navigator into Rooms / Architecture / Placed Content sections;
- add a second global toolbar;
- widen the Tool Tray into another sidebar;
- turn Camera Timeline into a generic video editor;
- reopen P23.12 identity;
- redraw settled P23.13 Plan iconography without cause;
- make the old navy dark mode the default product identity;
- use theme color as the main source of hierarchy;
- add chrome simply because empty space exists.

---

# 25. Designer D — Atlas assignment

Designer D should now build or revise the interactive HTML Atlas against this document.

The Atlas is a **QA surface**, not a competing proposal.

Its job is to make the design falsifiable before implementation and during visual acceptance.

## 25.1 Required canonical specimens

The Atlas must include four high-fidelity canonical states:

### A. Scene / Plan / Layout

- recursive multi-floor Navigator;
- one expanded Space/Room → Architecture → Walls branch;
- selected wall using P23.12 identity;
- P23.13 Plan representation;
- property-first Inspector;
- landed P23.13 Plan Paper `#F5F7F8` / cool PLATE Chassis.

### B. Scene / 3D

Layout/Arrange remain Scene Plan local modes; Scene 3D has no parallel local-mode control.

- same shell geometry;
- same recursive hierarchy;
- selected Scene object;
- 3D transform instruments;
- no shell redesign between Plan and 3D.

### C. Camera / Plan / collapsed Drawer

- passive architecture;
- selected camera graph node;
- no finite frustum;
- collapsed 48 px Camera Drawer;
- Camera hierarchy uses the same Navigator grammar;
- any floor placement is explicitly contextual, not canonical ownership.

### D. Camera / 3D / expanded Drawer

- selected camera + finite frustum;
- expanded 288 px Drawer;
- exactly Camera Path / Shots / FOV / Look At / Roll;
- no generic video-editor tracks;
- coherent selection across Navigator / viewport / Inspector / Timeline.

## 25.2 Required stress specimens

The Atlas should also expose interactive stress toggles or dedicated fixtures for:

- deep multi-floor hierarchy;
- long names + complete compact references;
- duplicate names;
- same canonical Wall revealed in two Space contexts;
- 70+ wall density;
- 8+ cameras;
- expanded Timeline at reduced vertical height;
- empty state;
- disabled/refusal/warning/destructive states;
- keyboard focus;
- reduced motion;
- future P26 contextual-instrument host.

## 25.3 Atlas authority rule

The four owner-generated PLATE images may be used as visual orientation evidence for composition, warmth and intended density.

They are **not** pixel truth and must not be mined for accidental semantics.

Known examples of generator output that must not become product contracts include:

- arbitrary fixture IDs beyond ratified identity rules;
- Camera Graph appearing under a Floor as implied ownership;
- inconsistent utility-control order;
- generated room/wall relationship mistakes;
- exact typography/icon deviations from existing P23.12/P23.13 assets.

The Atlas should correct these against this document.

---

# 26. Acceptance criteria

P23.14 visual implementation is ready for acceptance when the Atlas and product make the following true simultaneously:

1. A user can identify project, domain, durable view, local mode and active tool without those ranks competing visually.
2. Scene/Camera remain visibly one product.
3. Plan/3D remain durable peers.
4. Paper, Chassis and Instrument are visually distinct without decorative excess.
5. The new PLATE Light theme is the canonical default and the old navy dark identity is no longer the product baseline.
6. Navigator supports recursive spatial containment and contextual projections without implying false ownership.
7. Multi-floor hierarchy does not require a new shell.
8. P23.12 identity remains intact through Navigator, Inspector, search and selection.
9. P23.13 Plan representation/iconography remains intact.
10. Selection is coherent across every visible surface.
11. Inspector stays property-first.
12. Status stays readout-only.
13. Camera Timeline remains Camera-owned and central-work-column aligned.
14. Camera Plan contains no finite frustum; Camera 3D may.
15. Expanded Camera Timeline uses exactly the five ratified semantic lanes.
16. P24 growth can be accommodated without adding permanent chrome.
17. P26 can enter as subordinate contextual instruments with a visible return path.
18. The shell survives dense, nested and reduced-height stress fixtures.
19. Keyboard, focus, contrast and reduced-motion checks pass.
20. The result still feels recognizably like Museum Editor—evolved, not replaced.

---

# 27. Final design statement

P23.14 should leave Museum Editor with a shell that is recognizable before its palette is visible.

Its signature is:

**spatial Paper (landed cool P23.13 Paper in Plan; warm PLATE Paper elsewhere) held inside a cool engineered Chassis, with compact Instruments attached directly to the work; Scene/Camera running vertically, Plan/3D running horizontally, and one coherent identity moving through Navigator, viewport, Inspector and Timeline.**

The Navigator scales from today’s Rooms to tomorrow’s Buildings, Floors, Spaces and contextual architecture without confusing navigation with ownership.

The new PLATE Light theme becomes the default face of the product. Existing P23.12 identity and P23.13 drafting/iconography remain foundations rather than collateral damage from polish.

This is the direction Designer D should now make concrete and falsifiable in the Atlas.
