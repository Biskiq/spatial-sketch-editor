# Mockup provenance and prompts

Static artwork for the [proposal](./PROPOSAL.md) and [storyboard](./STORYBOARD.md). The original four mockups were generated on 2026-10-31; the connected journey revision was generated and reviewed on 2026-11-01. The built-in image-generation tool produced the interface PNGs; no CLI/API fallback, production implementation or interactive prototype was used. Final project assets are in [figures](./figures/). Generative outputs are not guaranteed to reproduce identically.

## Current package

| File | Status in this revision | Actual dimensions |
| --- | --- | --- |
| [01-new-object.png](./figures/01-new-object.png) | Replaced: empty standalone scope with one Objects entry | 1586 × 992 |
| [02-geometry.png](./figures/02-geometry.png) | Retained: advanced ceiling only | 1586 × 992 |
| [03-assembly.png](./figures/03-assembly.png) | Retained: assembly ceiling only | 1586 × 992 |
| [04-world-return.png](./figures/04-world-return.png) | Retained: ceiling composition; new 09 governs return | 1586 × 992 |
| [05-world-entry.png](./figures/05-world-entry.png) | New: ordinary World selection and Edit object | 1586 × 992 |
| [06-focus-entry.png](./figures/06-focus-entry.png) | New: same subject, muted World context | 1586 × 992 |
| [07-first-shape.png](./figures/07-first-shape.png) | New: first standalone outline, not yet accepted | 1584 × 993 |
| [08-part-scope.png](./figures/08-part-scope.png) | New: whole/part distinction | 1586 × 992 |
| [09-world-restored.png](./figures/09-world-restored.png) | New: restore 05's World view with changes kept | 1586 × 992 |
| [10-standalone-focus.png](./figures/10-standalone-focus.png) | New: convergence with 06 after first creation | 1586 × 992 |
| [11-journey-map.png](./figures/11-journey-map.png) | New: deterministic visual flow | 2400 × 1480 |
| [12-refine-shape.png](./figures/12-refine-shape.png) | New: Edit shape task and pending-change return | 1586 × 992 |

Dimensions were checked from the actual PNGs; every file decoded and passed PNG integrity verification. All final images were visually reviewed for labels, selected-subject correspondence, scope and journey continuity. Icon details, sample dimensions and geometric rendering remain illustrative. Original 02–04 controls are explicitly qualified in the storyboard; their presence does not approve operations, pivots, assembly storage or current library capabilities.

### Journey-map source

[11-journey-map.svg](./figures/11-journey-map.svg) is manually authored static vector artwork (text, paths and rectangles, no scripts or interactions), exported to PNG with `rsvg-convert`. It is a documentation diagram, not an application/prototype. The exported PNG was visually inspected. The map connects both creation entries, shared Focus, return, saved drafts, independent-copy placement and import capability boundaries.

## Journey revision prompts — 2026-11-01

The following are the full submitted prompts, including targeted corrections. Referenced images served as edit targets, preserving visual continuity across states.

### 05-world-entry.png — generation

New generation, no input image.

```text
Use case: ui-mockup. Create a polished static desktop screenshot concept for Biskiq spatial creation. Landscape 1600 by 1000, sharp legible typography, flat straight-on UI no browser or device frame. PLATE aesthetic: deep forest header #11291f, stone white Index 250px left, dominant cutting-mat Stage #1D3A33 or vellum for plan drawing; floating white contextual Card upper right about 310px, not a full-height inspector. Serif authored names, system sans controls, mono measurements. Forest icon-only dock bottom, ivory armed key. Ivory Save and World active buttons, NOT gold. Gold #d4ad45 ONLY the selected geometry contour and pale selected row accents. White spatial handles, gray/white hover. Consistent Head: Biskiq | project name dropdown | World Experience | Find | undo redo | Save. Small lower-right footer 'UX proposal · not shipped'. No timeline, no giant modifier stack, no RGB gizmo. Stage remains dominant; no empty Card. No permanent labels under dock icons. Model geometry is elegant but simple shaded native geometry, not a photo.
WORLD-FIRST JOURNEY, STATE A2: A SIMPLE CREATED SHAPE IS SELECTED; DEEP EDITING IS DISCOVERABLE.
Project name 'Museum study'. World lens active. Upper left of Stage familiar '2D  3D' reading control with 3D active. Left Index scope 'Museum study / Gallery', heading 'Located here', rows 'Display plinth' selected, 'Bench', 'Wall text'. The Stage is a modest architectural gallery cutaway over dark green ground grid, quiet warm white walls in the background, an unselected slim walnut bench to left, a framed art piece on a rear wall, plenty of empty space. Central foreground a plain ivory rectangular display plinth, width/depth about 0.8m height0.9m, no sculpture on it, no base trim or cap yet. The plinth is selected with a narrow gold outline and subtle tint, modest white translation anchor. Keep the plinth center at x850 y570 with clear space around it. The Card title 'Display plinth', subtitle 'Native form', size fields 'Width 0.80 m' 'Depth 0.80 m' 'Height 0.90 m'. Under them a very clear forest button 'Edit object', small help line 'Shape and refine in Object Focus'. Then quiet 'Save to My Objects' and More. NO Object Focus state pill yet. This is a normal selected World object.
Above bottom dock is a compact forest Objects instrument row, title 'Objects', named choices 'Box' 'Round' 'Free' 'Sphere' and 'All'. This is the unified creation entry, not an Ink palette. Bottom dock EXACTLY five icon positions: selection arrow, architectural pen, ruler, eraser, books/library (Objects). No other tools. Objects key ivory because it remains active after creation; the existing created shape stays selected. Make the spatial scene restrained and recognizable enough to reuse in later entry and return states. The image demonstrates today's shape creation plus the proposed Edit object affordance.
```

### 05-world-entry.png — targeted correction

Edited the initial 05 generation.

```text
Make only these UI corrections to this screenshot. 1. Replace the merged top header text 'World Experience' with two clearly separate lens buttons: 'World' on an ivory rounded key, followed by 'Experience' as quiet pale text on forest. 2. Remove the full-width bottom forest band. Continue the green Stage grid to the bottom and keep the existing five dock icons together on a SMALL compact floating forest pill centered at the bottom, about 360 pixels wide and 65 pixels tall. Do not change icon order. 3. The Box choice in the Objects row must have an ivory key background and forest text/icon, not gold outline. Gold remains only on selected plinth geometry and left row. Keep every other detail including the gallery composition, plinth location, camera, text, dimensions, Card and image resolution exactly unchanged.
```

### 06-focus-entry.png

Edited final 05-world-entry.png, preserving the museum, selected subject and shell.

```text
Transform this screenshot into the NEXT STATE, entering Object Focus on the selected Display plinth. Keep the exact same Biskiq header, Museum study project, World active lens, visual system and 1586x992 size. Keep the very same plain ivory plinth, with absolutely unchanged geometry and dimensions, and the same camera angle. Frame the view slightly closer around it through camera zoom only, keeping the bench and rear artwork in corresponding background positions. Mute the entire surrounding gallery into desaturated low-contrast green-gray translucent ghost context; it remains recognizable but cannot be edited. Plinth stays opaque and selected gold.
At top of Stage after the 2D/3D control add a clear pill 'Object Focus · Display plinth' with an explicit 'Back to World' button. Beside it a smaller control 'Context muted'.
Replace the left World location Index with a scoped white panel headed 'Parts', breadcrumb 'World / Display plinth', one selected row 'Display plinth', quiet caption '1 form'. NO empty deep tree.
Floating right Card stays 'Display plinth' and 'Native form', with unchanged Width0.80m Depth0.80m Height0.90m fields. Replace the previous entry button with 'Edit shape'. Under it secondary button 'Add part', and small explanatory caption 'Build on this object'. Keep Save to My Objects quiet under More if needed. No operation stack.
CLOSE the Objects instrument row that was above the dock. Bottom dock now compact icon-only Select, ruler, eraser, divider, Objects books; Select ivory. Architectural Pen is absent because this is an object scope. Do not add a new app or tab. Footer 'UX proposal · not shipped'. The image must visibly read as the SAME object and SAME project after a scope transition.
```

### 09-world-restored.png

Edited final 05-world-entry.png, preserving the museum, selected subject and shell.

```text
Transform this screenshot into the RETURN TO WORLD state after editing the plinth and adding one separate top plate. Preserve EXACTLY the original gallery camera, framing, wall, painting, bench, Stage grid, head and Index locations. Plinth remains at EXACTLY the original world location; the only geometry change is a thin, flat, warm brass top plate resting on top of the same ivory body, extending just a few centimeters around its perimeter. The whole two-part plinth is selected with gold contour, not separately exploded.
Same left Index 'Museum study', 'Gallery', 'Located here', 'Display plinth', 'Bench', 'Wall text'. Same top World lens active. Same right Card title 'Display plinth', subtitle now 'Object · 2 parts'. Keep Width Depth Height fields but update shown overall values to '0.84' '0.84' '0.94' m. Keep 'Edit object' entry button and 'Save to My Objects'. Delete the small line 'Shape and refine in Object Focus' and use 'Changes kept in this World' instead.
Do NOT show any Object Focus pill, Parts tree, Edit shape controls or ghost surroundings. Restore gallery to its full original materials and contrast. Add a small unobtrusive confirmation above bottom-left 'Back in World · changes kept'.
Keep the Objects compact row in the same location, but no tile armed: Box, Round, Free, Sphere, All in neutral text/icons with no ivory tile highlight. Keep five-icon compact floating dock as in source, now Select ivory and Objects neutral. This shows restored disclosure, safely returned to Select. Add tiny footer 'UX proposal · not shipped'.
```

### 01-new-object.png — replacement

Edited final 06-focus-entry.png to retain the same shell and identity language.

```text
Use this screenshot as the same app shell and transform it into the standalone EMPTY OBJECT state after My Objects > New object. Preserve all typography, header layout, 2D/3D control location, Parts panel and compact floating dock visual styles. Keep World active; change project name to 'Untitled object'. The Stage is now a neutral dark forest measured workplane only: remove every trace of the museum, walls, bench and artwork, AND remove the plinth. Add a small neutral origin point. No geometry exists. REMOVE the entire right Card; nothing is selected.
Scope pill says 'Object Focus · Untitled object' and 'Back to My Objects'. Replace Context muted control with a small passive 'Not placed' label, not a disabled context button. Left Parts panel breadcrumb 'Untitled object', quiet empty message 'No parts yet'.
In the wide free space, a modest empty-state line 'Start with a shape' and a small hint 'Choose a shape below. Add parts as you go.' Do NOT add a second set of shape cards in the middle of the Stage.
Show ONE compact forest Objects row just above bottom dock: heading 'Objects', context subtitle 'Add to Untitled object', then Box, Round, Free, Sphere, All. No shape is armed yet. Bottom dock ONLY selection arrow, ruler, eraser, divider, Objects books. Objects can be open without a shape being selected. No architectural Pen in this scope. Small footer 'UX proposal · not shipped'. No specific snap interval or architecture floor controls. This is a new entry into the same workspace, not a separate Studio.
```

### 01-new-object.png — targeted correction

Edited that state's initial generated image.

```text
Make exactly one text correction: in the top header replace the project name 'Museum study' with 'Untitled object'. Preserve absolutely everything else unchanged, including all other text, layout, colors, image size, empty workplane and dock.
```

### 07-first-shape.png

Edited final 06-focus-entry.png to retain the same shell and identity language.

```text
Use this screenshot as the same app shell and transform it into standalone FIRST-SHAPE DRAWING, after opening Objects and choosing Free in an empty object. Change project name to 'Untitled object'; World remains active. Scope pill 'Object Focus · Untitled object' with 'Back to My Objects', passive 'Not placed' beside it. Left Parts panel 'Untitled object' and 'No parts yet'. REMOVE right Card because no object has been accepted or selected.
Stage is a pale warm vellum top view with subtle measured grid and NO museum, architecture, bench or existing plinth. Toggle 2D active, 3D neutral. In center draw a clear large simple near-rectangular CLOSED-READY FREE PROFILE, four sides with one gently curved corner, about 500 pixels square, thin dark forest outline, a few white corner points outlined dark. Last line approaching start shown dashed; one small live pointer point. No filled gold object, no giant dimensions. A small neutral text tag next to the start point 'Close outline or Finish'. This is a pending outline for a first plinth body, not an already committed component.
Above bottom dock ONE compact forest Objects row: heading 'Objects', small subtitle 'Add to Untitled object', options Box Round Free Sphere, Free ivory armed; a forest/ivory 'Finish' button and quiet 'All'. Bottom dock only Select arrow, ruler, eraser, divider, Objects books; Objects ivory. Add a small status sentence 'First shape · not created yet'. No special object pen, no separate sketch toolbar, no depth dialog. The same Free creation language used in World is reused here. Sharp exact text; footer 'UX proposal · not shipped'.
```

### 07-first-shape.png — targeted correction

Edited that state's initial generated image.

```text
Correct this screenshot precisely: (1) Top header project name must be 'Untitled object', replacing Museum study. (2) Left Parts panel must have only a plain breadcrumb 'Untitled object' and an empty-state message 'No parts yet'. Remove the selected Untitled object row and remove the 'World /' prefix, since nothing is selected or placed. (3) Bottom dock Select arrow must have neutral FOREST background, NOT ivory. Objects books icon remains the sole ivory armed key. (4) The floating Objects row above the dock must be dark FOREST, not white: white labels/icons except Free on a pale IVORY key with dark ink, and an ivory Finish button. Its shape names and controls stay exactly as they are. (5) Replace the crossed-eye icon beside 'Not placed' with a simple neutral location-pin outline. Preserve all remaining screenshot content, the outline and pending stroke, exact text and dimensions, vellum background, image size and layout.
```

### 08-part-scope.png

Edited final 06-focus-entry.png to retain the same shell and identity language.

```text
Use this screenshot as the same app shell and transform it into OPTIONAL PART EDITING of the SAME Display plinth after adding a top plate. Keep Museum study header, World active, Focus pill 'Object Focus · Display plinth', 'Back to World' and 'Context muted', and muted gallery framing.
Same ivory plinth body at same place. Add a thin warm brass top plate, flat rectangle extending a few centimeters past the body on all sides. ONLY the plate is selected with gold contour. Body opaque ivory but quiet, NO gold contour on body. No giant handles, a small white handle near plate is enough.
Parts Index: breadcrumb 'World / Display plinth'; root row 'Display plinth' expanded, children indented 'Body' and 'Top plate'. Only Top plate has pale selected row and narrow gold left accent. Below rows '+ Add part'. A small read-only caption '2 parts'.
Right Card title 'Top plate'; subtitle 'Part of Display plinth'; tiny breadcrumb 'Display plinth / Top plate'. Fields 'Width 0.84 m' 'Depth 0.84 m' 'Height 0.04 m'. Main button 'Edit shape'. Secondary text action 'Select whole object'. Small explanatory text 'Only Top plate is selected.' No modifier stack, pivots, storage metadata, animation or new global toolbar. Bottom compact dock Select ivory, ruler, eraser, divider, Objects books. Objects instrument closed. Keep whole object visible so the creator understands part versus whole without a new editor. Footer 'UX proposal · not shipped'.
```

### 10-standalone-focus.png

Edited final 06-focus-entry.png; neutral surroundings and standalone lifecycle affordances.

```text
Transform this screenshot into the SAME Object Focus workspace reached by the standalone journey AFTER creating and sizing its first shape and naming it Display plinth. The point is visual convergence with World-first Focus. Keep the identical header layout, Parts panel, floating Card, 3D reading, plinth geometry at exactly 0.80m by0.80m by0.90m, gold selection and compact floating dock.
Make these specific changes only:
1. Header project name becomes 'Plinth study'. World lens remains active.
2. Focus pill says 'Object Focus · Display plinth', and exit text 'Back to My Objects'. The neighboring status says 'Not placed' with a location-pin outline.
3. REMOVE ALL museum background: no walls, bench or painting, even ghosts. The Stage is now the same neutral dark forest cutting-mat workplane and subtle grid used for empty standalone creation, with the identical selected ivory plinth on it.
4. Parts breadcrumb is just 'Display plinth', with one selected Display plinth row and '1 form'.
5. Card stays Display plinth / Native form, same dimensions, Edit shape, Add part, same layouts. Replace the bottom Save to My Objects button row with two compact secondary actions 'Save to My Objects' and 'Place in World'; remove More if space requires. Do not make Place in World auto-act or show a placement preview yet.
6. Keep Select ivory, ruler, eraser, divider, Objects in compact icon dock. No Pen. No Objects panel currently open.
Footer 'UX proposal · not shipped'. Everything is consistent with the source image except the origin/return target, absent World context and placement affordance.
```

### 12-refine-shape.png

Edited final 06-focus-entry.png; an illustrative supported outline-refinement task, not a finalized tool specification.

```text
Edit the attached Biskiq screenshot into the very next state after the creator chooses "Edit shape" on this same Display plinth. This is a polished static UX concept illustration, not a tool specification. Preserve the same PLATE shell, exact typography, Head project Museum study, World lens, left Parts identity, size and spacing, scope strip "Object Focus · Display plinth", explicit "Back to World", and compact four-icon bottom dock. Preserve the same selected native form identity. Change only the working reading and the contextual Card content to show one simple, supported outline-refinement task.
The Stage becomes a warm pale vellum top workplane reading with restrained green-gray grid. 2D is active and 3D inactive. No 3D inset and no permanent second viewport. Replace the muted photographic museum and solid plinth with a single large nearly square top outline of the plinth centered in the available Stage, representing 0.80 m x 0.80 m. Thin gold outline identifies selected form; small white circular source control handles mark all four corners. Show only the upper-right corner control being moved slightly inward, with a faint dashed prior corner segment behind it and a subtle pointer; no extra vertices, no dimensions clutter, no fabricated procedural stack. Nearby small quiet caption "Outline · Top". This is a pending preview, not new object creation. Change Context muted pill to "Context hidden" because this task hides surrounding geometry for clarity.
Floating Card top-right keeps title "Display plinth", subtitle now "Editing outline". Beneath a small breadcrumb "Object / Shape". One compact neutral row "Reading" with value "Top". Small helper sentence "Move a point. Review the shape." Then a divider, a quiet pending strip "Previewing outline change". Two equal buttons "Discard" (white) and "Apply" (forest). Beneath a quiet text action "Back to object". No editable dimension inputs in this temporary task, no Add part or Save to My Objects buttons while pending. Gold reserved for selected geometry and left selected row. Nothing is named Part Studio, Studio or Pen. Header Save stays ivory, no gold buttons. Bottom dock remains compact, Select ivory, Measure/Eraser/Objects unarmed. Add small footer "UX proposal · not shipped". All operational text must be crisp and correctly spelled. No additional callouts, arrows, legend or marketing text. Preserve image aspect and high quality.
```


## Original package prompts — 2026-10-31

These record the first package. The old 01 rendering was replaced in this revision; 02–04 remain unchanged. Original requests asked for 1920 × 1200; the four original outputs were 1586 × 992. These prompts are provenance, not current UX authority.

### Original 01-new-object.png — superseded

#### Generation prompt

```text
Use case: ui-mockup. Create a polished, pixel-sharp desktop product UX concept screenshot for Biskiq, a professional spatial creation application. Landscape 1920 x 1200. This is a STATIC PNG design mockup, no browser frame, no laptop, no perspective tilt of the screenshot, no marketing page. Carefully typeset, highly legible text. Restrained professional CAD/design tool, approachable and elegant. Consistent PLATE visual system: compact 52px deep forest header #11291f; warm white and pale stone collapsible left navigation Index about 250px wide; dominant dark forest cutting-mat 3D Stage #1D3A33 with very subtle measured grid; contextual floating white Card about 300px wide at upper right, never a full-height inspector; small forest icon dock centered at bottom, selected tool ivory. Serif only for authored object names; clear operational sans for all controls; tabular mono dimensions. Gold #d4ad45 is ONLY selected geometry and selected item accents; buttons forest or ivory. White thin spatial handles; no RGB gizmos, no permanent dimension cage, no timeline. Top bar uses project-name dropdown, quiet World | Experience lens toggle, Find, undo/redo, explicit Save button. State pill near top of Stage explains Object Focus and offers exit. Crisp hierarchy, exact minimal labels, thoughtful whitespace. Include small unobtrusive footer "UX proposal · not shipped". UI is the content, not explanatory callout boards.
STATE 01: START A NEW STANDALONE OBJECT, BEFORE ANY WORLD PLACEMENT.
Top title "Untitled object" with World active. Far right "Save".
Left Index heading "Parts"; breadcrumb "Untitled object"; small empty message "No parts yet". No fake object geometry in hierarchy.
Stage is a beautiful EMPTY object-sized workplane with origin marker and shallow perspective subtle grid, no museum or architectural walls, no geometry. Small pill "Object Focus · Not placed", and exit text "Back to My Objects". At center-left of the Stage an elegant modest empty-state introduction, not a modal: serif title "Make your first part"; subtext "Draw a form. Add parts as you go." Three tasteful compact illustrated choices on one horizontal line: "Box", "Round", "Free". Below a quiet link "Start from My Objects". At bottom-left small "mm · Snap 10 mm" and at lower right zoom controls. Bottom forest dock has selection, form creation, measure, objects icons. No right Card because nothing is selected. The workplane dominates. Ensure the simple uncluttered composition communicates starting an object directly, with no naming requirement or project setup wizard.
HIGH PRIORITY: Save button must be pale ivory with forest text, NOT yellow or gold. World active lens also neutral ivory. Branding white, NOT gold.
```

#### Targeted correction

Applied with the generated image as the sole referenced edit target.

```text
Edit this UI mockup only: remove the four words Select, Add, Measure, Objects underneath the bottom dock icons and shrink the dock height to a compact icon-only row. Remove the 100% zoom percentage at lower right and keep minus, plus and fit controls. Preserve absolutely everything else, including all text, workplane, colors, sharpness, spacing and image dimensions. Do not add or change any other element.
```

### Original 02-geometry.png — retained

#### Generation prompt

```text
Use case: ui-mockup. Create a polished, pixel-sharp desktop product UX concept screenshot for Biskiq, a professional spatial creation application. Landscape 1920 x 1200. This is a STATIC PNG design mockup, no browser frame, no laptop, no perspective tilt of the screenshot, no marketing page. Carefully typeset, highly legible text. Restrained professional CAD/design tool, approachable and elegant. Consistent PLATE visual system: compact 52px deep forest header #11291f; warm white and pale stone collapsible left navigation Index about 250px wide; dominant dark forest cutting-mat 3D Stage #1D3A33 with very subtle measured grid; contextual floating white Card about 300px wide at upper right, never a full-height inspector; small forest icon dock centered at bottom, selected tool ivory. Serif only for authored object names; clear operational sans for all controls; tabular mono dimensions. Gold #d4ad45 is ONLY selected geometry and selected item accents; buttons forest or ivory. White thin spatial handles; no RGB gizmos, no permanent dimension cage, no timeline. Top bar uses project-name dropdown, quiet World | Experience lens toggle, Find, undo/redo, explicit Save button. State pill near top of Stage explains Object Focus and offers exit. Crisp hierarchy, exact minimal labels, thoughtful whitespace. Include small unobtrusive footer "UX proposal · not shipped". UI is the content, not explanatory callout boards.
STATE 02: ADVANCED GEOMETRY ON A SCULPTURAL CHAIR, SHOWING MEANINGFUL EDITABILITY.
Top project "Ribbon chair"; World active; Save at right. Stage pill "Object Focus · Ribbon chair" and "Back to My Objects".
Left Parts Index shows "Ribbon chair" root, children "Frame", selected "Seat shell", "Back ribs", "Feet". A secondary small read-only caption "4 components".
Dominant Stage has a highly refined sculptural walnut chair in three-quarter view, gracefully bent wood, multiple separate parts, organically curved perforated seat shell with twelve neat slots, a curved ribbed back and slender separate dark walnut legs. Beautiful realistic but clear shaded geometry, correct chair proportions. Seat shell alone is outlined gold, other parts visible neutral walnut. A small translucent pale-yellow section plane through seat, with white profile handles, communicates section inspection. A small VELLUM inset lower left within Stage labeled "Profile · Side" contains a clear curved cross-section and a dimension "18 mm". The inset is the same object's section, not another independent model or viewport app.
Floating right Card title "Seat shell"; subtitle "Native form"; single tab row "Shape   Operations" with Operations active. Compact ordered rows "01  Profile", "02  Sweep", "03  Bend", "04  Cut slots". Bend expanded with one precise input "Angle 22°" and label "Object space". Other row controls subtle. Below a quiet source relation "Cutters: Slot pattern" and "Retained for revision". Card includes pending-change strip "Previewing bend" and buttons "Discard" and forest "Apply". No duplicate numeric writers elsewhere. Keep the 3D object larger than panels. Bottom dock has only icons. This is a proposed advanced destination, convey discoverable depth without an enormous toolbar.
HIGH PRIORITY: Save button must be pale ivory with forest text, NOT yellow or gold. World active lens neutral ivory. Branding white. Bottom dock icons have NO text labels.
```

#### Targeted correction

Applied with the generated image as the sole referenced edit target.

```text
Edit this UI mockup only: change the top-left navigation panel heading from Index to Parts and remove the small gold underline below that heading. Change the lower-left inset to a pale warm vellum background with subtle green-gray grid and dark ink, keeping its curved section drawing and dimension legible; change its header text from Profile · Side to Section · Side. Preserve absolutely everything else including all other text, chair, panels, layout, colors, controls, sharpness and image dimensions.
```

### Original 03-assembly.png — retained

#### Generation prompt

```text
Use case: ui-mockup. Create a polished, pixel-sharp desktop product UX concept screenshot for Biskiq, a professional spatial creation application. Landscape 1920 x 1200. This is a STATIC PNG design mockup, no browser frame, no laptop, no perspective tilt of the screenshot, no marketing page. Carefully typeset, highly legible text. Restrained professional CAD/design tool, approachable and elegant. Consistent PLATE visual system: compact 52px deep forest header #11291f; warm white and pale stone collapsible left navigation Index about 250px wide; dominant dark forest cutting-mat 3D Stage #1D3A33 with very subtle measured grid; contextual floating white Card about 300px wide at upper right, never a full-height inspector; small forest icon dock centered at bottom, selected tool ivory. Serif only for authored object names; clear operational sans for all controls; tabular mono dimensions. Gold #d4ad45 is ONLY selected geometry and selected item accents; buttons forest or ivory. White thin spatial handles; no RGB gizmos, no permanent dimension cage, no timeline. Top bar uses project-name dropdown, quiet World | Experience lens toggle, Find, undo/redo, explicit Save button. State pill near top of Stage explains Object Focus and offers exit. Crisp hierarchy, exact minimal labels, thoughtful whitespace. Include small unobtrusive footer "UX proposal · not shipped". UI is the content, not explanatory callout boards.
STATE 03: BUILD AND MANAGE A GRAND PIANO AS A NESTED ASSEMBLY.
Top title "Grand piano"; World active; Save at right. Stage pill "Object Focus · Grand piano", exit "Back to My Objects". Add quiet pill "Editing this design".
Left Parts Index expanded as a real assembly tree using clear nested indents, small distinct form/assembly/pattern/link icons: "Grand piano" root; children "Body", "Lid" (selected gold row), "Keyboard" expanded with "White keys · 52" and "Black keys · 36"; "Legs" expanded with "Front left", "Front right", "Rear"; "Wheels · 3"; "Pedals". Below hierarchy a small button "+ Add part". No all-World outline tree.
Stage contains a gorgeous accurate grand piano made from separate walnut components, open raised lid, glossy dark walnut curved body, clearly independently modeled black and ivory piano keys, three tapered legs, brass caster wheels, brass pedals. Three-quarter elevated view showing assembly and keyboard. Only the lid has a thin gold contour and modest selected tint, rest natural walnut. A white local pivot marker and short hinge axis sits on the left hinge edge of the lid, label "Pivot · hinge edge". Do not show animation or a timeline. No exploded separation; this is the assembled object.
Floating white Card upper right title "Lid"; subtitle "Component · Grand piano"; rows "Edit shape", "Position", "Pivot". Pivot expanded, value "Hinge edge" with button "Set pivot". Secondary section "Reuse" with text "Unique component" and action "Make reusable". Small read-only footer "Changing the pivot keeps the lid in place." Keep this Card compact and use generous Stage space. Bottom small caption "Select a part in the Stage or in Parts." No fake edit affect counts. Exact labels and clear tree nesting are essential.
```

#### Targeted correction

Applied with the generated image as the sole referenced edit target.

```text
Edit this UI mockup only: change the top-right Save button background from yellow gold to pale ivory, keeping forest dark text and icon. Change the little gold logo beside Biskiq at top left to white. Make the selected Lid row in left Parts tree a very pale warm ivory with a narrow gold left bar, rather than a saturated gold flood. Preserve the gold selection contour on the piano lid. Preserve absolutely everything else including all text, layout, piano, lighting, sharpness and image dimensions.
```

### Original 04-world-return.png — retained

#### Generation prompt

```text
Use case: ui-mockup. Create a polished, pixel-sharp desktop product UX concept screenshot for Biskiq, a professional spatial creation application. Landscape 1920 x 1200. This is a STATIC PNG design mockup, no browser frame, no laptop, no perspective tilt of the screenshot, no marketing page. Carefully typeset, highly legible text. Restrained professional CAD/design tool, approachable and elegant. Consistent PLATE visual system: compact 52px deep forest header #11291f; warm white and pale stone collapsible left navigation Index about 250px wide; dominant dark forest cutting-mat 3D Stage #1D3A33 with very subtle measured grid; contextual floating white Card about 300px wide at upper right, never a full-height inspector; small forest icon dock centered at bottom, selected tool ivory. Serif only for authored object names; clear operational sans for all controls; tabular mono dimensions. Gold #d4ad45 is ONLY selected geometry and selected item accents; buttons forest or ivory. White thin spatial handles; no RGB gizmos, no permanent dimension cage, no timeline. Top bar uses project-name dropdown, quiet World | Experience lens toggle, Find, undo/redo, explicit Save button. State pill near top of Stage explains Object Focus and offers exit. Crisp hierarchy, exact minimal labels, thoughtful whitespace. Include small unobtrusive footer "UX proposal · not shipped". UI is the content, not explanatory callout boards.
STATE 04: RETURN TO WORLD AND REUSE THE COMPLETED PIANO.
Top title "Museum of music"; World active; Save at right. This is ordinary WORLD, with no Object Focus pill, no operation stack, no Parts tree.
Left Index is the scope model: breadcrumb "Museum of music / Ground / Music gallery", heading "Located here", rows "Grand piano" selected, "Display plinth", "Listening bench", "Wall text"; lower quiet navigation "Other spaces". No hierarchy tree of the piano.
Dominant 3D Stage shows a beautiful airy museum gallery in three-quarter architectural view: pale limestone floor, warm plaster walls, restrained tall decorative columns, framed exhibits, good soft daylight. The same walnut grand piano with raised lid, ivory/black keys, brass wheels and pedals stands comfortably in the gallery, selected with thin gold outline. A modest white move anchor near feet; no busy cage.
Floating white Card upper right title "Grand piano"; subtitle "Independent copy"; simple rows "Width 1.52 m", "Depth 2.15 m", "Height 1.02 m"; a prominent forest "Edit object" button and quiet "Save to My Objects" action. Card text "Changes affect this copy."
At bottom above the compact dock a modest forest Objects instrument is open, 650px wide maximum, leaving the piano visible. Heading "My Objects". One beautifully small piano thumbnail with name "Grand piano" and subtext "Editable assembly"; primary action "Insert copy", secondary "Open for editing". Include a small textual confirmation above the dock: "Returned to Music gallery · changes kept". Bottom zoom controls. This frame communicates a real placed object, shared interface and preserved edits, plus a source-based reusable item. No animation or publish controls and no invented live link between independent copy and library source.
HIGH PRIORITY: Save button pale ivory with forest text, NOT yellow or gold. World active lens neutral ivory. Branding white. Bottom dock icons have NO text labels.
```

#### Targeted correction

Applied with the generated image as the sole referenced edit target.

```text
Edit this UI mockup only: change the upper-right Card's Height value from 1.02 m to 1.65 m. Remove the 70% zoom percentage at lower right, keep minus plus and fit. Remove any brand lettering from the piano front, leaving plain walnut. Preserve absolutely everything else including other text, layout, piano, museum, selection outline, material, lighting, sharpness and image dimensions.
```
