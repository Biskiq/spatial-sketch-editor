# Integrated production shell — design note (wireframe round 2)

**Status: unratified design exploration for owner review.** Nothing here amends
[PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md), the
[spatial-instrument grammar](../../docs/reference/design-system/spatial-instrument-grammar.md),
domain contracts or production. Proposed departures are listed in
[§6](#6-proposed-departures-from-ratified-plate) for an explicit ruling. How to run the
wireframe, its tours, its Compare menu and the atlas is in the [README](./README.md).

Round 2 continues round 1.1 (commit `a7aa0cd1`, PR #181). Its brief was a visual language:
**simple, elegant, clear, lightweight, playful to manipulate**. The wireframe became one
coherent vocabulary of marks, now also used on architecture, the roof section, the Slice and
the Eraser. Every open choice is a live A/B in **Wireframe ▸ Compare**, the recommendation is
the default, and §4 gives a verdict for each.

**The atlas.** [atlas.html](./atlas.html) is the board view: 28 frames of the live wireframe,
each opened in one scripted state (`index.html?atlas=<key>`, presets in
[atlas.js](./atlas.js)). The frames cannot drift from the build, and every frame links to its
live, interactive state.

Not reopened: the compact Height Sheet; surfaces vs pins vs Levels; direct 2D/3D switching;
inline Card precision; Find in the Head; the permanent Brush; the contextual Library; the
shared World/Experience shell; temporary inspection and Preview isolation; one Camera, one
selection and chronological Undo; and no new tools.

## 1. The language

Each mark tells you what kind of state you are looking at; none of them is decoration.

| Mark | Means | Never means |
| --- | --- | --- |
| **Gold outline + translucent gold volume** | Selected geometry | Available actions, hover, inspection |
| **Thin white dashed line with a dark halo** | A transformation is available here (axis ray, rotation ring, track, dimension line) | Geometry |
| **Small white open arrowhead** | Which way that line drags | A button |
| **Small white point** | An anchor: wall end, joint, slide position on a track, the scale point. It turns gold while you hold it | Selection |
| **Translucent yellow plane or volume** | Temporary inspection: the Slice and its depth | Source; it is never saved |
| **Red dashes** | Marked for erasing, only with the Eraser | Errors elsewhere |
| **Dark tag, mono text** | The live value, shown **only on hover or drag** ("Height 1.10 · base stays") | Permanent W / D / H text |

**Retired:** large yellow knob disks, XYZ gizmos, permanent W/D/H labels, the gold joint
buttons on the roof section, and the Card's wide editing posture.

The halo is a 3 px dark under-stroke beneath every white mark. It keeps lines and arrows
legible on pale walls, on the gold selection and on the dark grid without a second colour.

**Dock and palettes.** Both are dark forest green with thin white icons. The armed tool sits
on a soft ivory key (`--ivory #f3f0e4`) with a dark icon. Tool colour survives only as a 2 px
mark under an icon. The palette column uses the same material as the dock, so the two read
as one instrument.

## 2. What changed from round 1.1

| Brief point | Round 1.1 | Round 2 |
| --- | --- | --- |
| 1 Toolbar | Light P3 dock; forest-pressed active tool | **Dark forest dock** with white thin icons, an **ivory** active key and small semantic marks. The palettes share the material |
| 2 Palette collapse | The palette closed implicitly | **Explicit.** Clicking a tool arms it and opens its palette. Clicking the armed tool again collapses or reopens it. A tiny `⌄` at the palette foot also collapses it. Choosing an option or drawing never closes it. **Esc collapses the palette before it disarms the tool.** The chosen option is remembered. Collapsed cue: a faint ivory caret above the armed key (A/B) |
| 3 Manipulation | Gold disks, a turn knob and a scale knob, with W/D/H knobs on request | **Rays and points** (§1): a dashed rotation ring with a radius of at least 30 px, a move cross at the base, and a scale point. Opening W·D·H turns each face into a short **axis ray** past the ring, with its arrowhead; height is a ray from the top face. Progressive scaling, planar rotation, support-aware resizing (base stays, riders follow) and the corner proportional scale are kept. Nothing is blocked by category, imported assets included. The Card stays the precision writer |
| 4 Architecture | Knobs on walls and roofs | The same vocabulary. **Wall:** end points (length), a top ray (height, snapping to Sheet heights), a two-way base ray (move parallel), and a two-way thickness arrow on the cap. **Opening:** a dashed track along the host wall with a slide point, side rays (width), a head ray and a sill ray. **Platform:** corner points and a height ray. **Roof:** a ridge ray up and an eave ray down on the nearer eave. Wall thickness is an editable Card field under More |
| 5 Roof Edit Shape | On-object section + Card; a floating editor; a Card posture | **Default: direct 3D editing** on a roof-local section drawn on the roof, with white joint points, small midpoint `＋` and a gold profile. A **3D \| Section** segment replaces 2D \| 3D while editing; `1` / `2` switch. **Section 2D** is a roof-local reading of the same Camera: the same selection, profile, history and Done, with a cross-fade and the roof framed. It is *not* the floor Plan. The gold joint buttons are replaced by points |
| 6 Slice | An infinite cut line, with tape knobs | **Drawn like the Pen**: a finite straight segment with a start and an end, a 45° soft snap and a live length tag. A translucent **yellow plane and depth volume** cuts only within its extent. End points redraw the line, the line moves it, and a depth ray adjusts how deep it looks. The pill (depth · Flip · Face · Put back) and the temporary-inspection rule are unchanged |
| 7 Index | A: scope + facets, B: outline tree | **Model A only** (the tree was removed). Collapsed: **A**, the Head location chip, or **B**, a minimal translucent arrow at the left edge with no rail. On touch the arrow stays faintly visible, and a tap on the edge zone opens the Index |
| 8 Eraser | Contextual kind chips (A) or filter funnel (B) | **Filter disclosure is the default**, as the owner preferred. A funnel in the Eraser palette opens "Erase only", a two-column kind grid with "Erase every kind". When a filter is active: a dot badge on the funnel and on the dock key, "filter leaves out …" in the acceptance bar, and a hint tag ("Walls are filtered out") when you touch a filtered kind. Immediate deletion, Undo, bulk acceptance and the cross-domain review are unchanged |
| 9 Polish | — | See §5 for what was fixed and what remains |
| 10 Intelligent Pen | — | Not implemented; fit is considered in §3 |
| Pen question | — | **A: context first** (Shape is one more reading on the chip). **B: a temporary Shape intent** in the Ink palette. Evaluated in §3 |
| Tours | Eight | **Ten.** New: *Walls, openings and platforms* and *One Pen, ordinary shapes*. Every tour was rerun with Show me |

## 3. Recommended (defaults in the wireframe)

| # | Choice | Why |
| --- | --- | --- |
| R1 | **Dark forest dock, ivory armed key, palettes in the same material** | The dock reads as one quiet instrument over any Stage. Ivory marks the armed tool without a second hue, and colour is kept for semantics |
| R2 | **Explicit palette collapse with remembered options; Esc collapses first** | The palette stays while you work and goes away only when you say so. Esc keeps its "one level at a time" rule |
| R3 | **Rays and points for every transform** (Compare ▸ Object manipulation A) | One grammar for objects, walls, openings, platforms, roofs and the Slice. It is small at rest, the value shows only on hover or drag, and it scales from a 0.6 m plinth to a 24 m roof |
| R4 | **The shared language stops at anchors and rays; each subject keeps its own handles** (Compare ▸ Architecture A) | §4 has the A/B. A wall's end is a point and its height is a ray, like an object's. A wall's thickness, an opening's track and a roof's eave are specific to that subject. There is no single universal handle |
| R5 | **Edit Shape: direct 3D first, Section 2D as a Stage reading** (Compare ▸ Roof Section 2D A) | It keeps the 3D context by default. Section 2D is one segment away, with the same selection, history and Camera, and it cannot be confused with the floor Plan |
| R6 | **Finite drawn Slice with a yellow depth volume** | It matches the Pen gesture, shows exactly what is cut, and leaves the rest of the building whole |
| R7 | **Index Model A; collapsed via the Head chip** | Settled by the owner. The chip works on touch and keeps location visible |
| R8 | **Eraser filter disclosure with layered "active" cues** | Owner preference. The badge, bar line and hit hint answer "why didn't that erase?" |
| R9 | **One Pen, context first (Pen A)** | See below |

### The Pen question: A context first vs B Shape intent

One Pen, with no Object Pen and no category picked before drawing. In **A**, the Pen reads
the surface as before, and **Shape** (an ordinary editable profile, pulled up later by its
height ray) is always one more reading on the chip. In **B**, a Shape toggle at the top of
the Ink palette makes every closed stroke an ordinary shape until Ink is put down.

| Ambiguous stroke | A · context first | B · Shape intent on |
| --- | --- | --- |
| Rectangle on the ground floor of an empty room | Room (walls, default) · Raised platform · Walls only · Shape | Shape. Room needs the intent off first |
| Closed loop with the Sheet raised to 0.90 m | Deck at 0.90 · Canopy roof · Walls on this height · Shape | Shape at 0.90 |
| Rectangle inside a gallery: is it a plinth or a platform? | Room by default, with Shape and Raised platform one Tab away. That is the honest ambiguity, and it costs one chip choice | Shape, with no question. This is predictable, but the plinth cannot become a platform without redrawing |
| Circle on a wall | Round window (the wall decides; no chip) | Same. The intent applies only to closed strokes on surfaces |
| Five-point closed outline on a deck | Deck-level readings · Shape keeps the outline | Shape keeps the outline |

- **Discoverability.** A shows Shape exactly where the decision is made, on the chip that
  appears for every closed stroke. B's toggle is easy to miss, and it is easier still to
  forget that it is on.
- **Cost.** In A an ordinary shape costs one extra click or Tab, and only for closed strokes
  where context guessed wrong. B saves that click across a long run of shapes, at the price
  of one toggle and of remembering to turn it off.
- **Predictability.** B is the most predictable while it is on. A is predictable because its
  default never changes and the chip states the reading before anything is committed.

**Recommendation: A.** Keep B as a candidate if field use shows long runs of ordinary
shapes, e.g. furniture blocking. Unratified.

**Future intelligent Pen (fit only, not implemented).** It fits A naturally: smarter
interpretation is only a better first reading and a better-ordered chip, with Shape always
the escape. It must keep the one-undo-step re-read, never commit an interpretation silently
across domains, and never become a second tool.

## 4. Open decisions compared (Wireframe ▸ Compare)

They were stress-tested at three zoom levels, with hover and without, on a 0.6 m plinth, a
1.8 m bench, a 6 m wall and a 24 m roof, in the Boathouse and in the dense Harbour museum.

| Question | A (recommended) | B (C) | Verdict |
| --- | --- | --- | --- |
| Object manipulation | **Axis rays** out of each face, past a minimum ring (Reference B) | **Dimension lines** offset beside the front edges with a grip point (Reference A) · **C** the round 1.1 knobs | A. B reads like a drawing and suits precise furniture layout. But its three lines converge at the front corner, crowd on small objects, and need the far edge to be visible. A keeps every ray outside the ring, so a 0.6 m plinth at overview zoom still has separated targets. C is kept only to show what was retired |
| Width · depth · height | **Progressive**: click the scale point | **Immediate**: always shown | A at overview zoom. At close range B is quicker, so a zoom-dependent rule (show the rays when the subject is ≥ 120 px across) is a reasonable later refinement |
| How far the language goes on architecture | **Same rays and points** as objects | **Edge grips**: the top, end and base edges are the handle, and arrows appear on hover | A. B is the most minimal at rest and reads well on long walls. But a 0.24 m wall end becomes a 3 px target, its affordance is invisible until hover (none on iPad), and it differs from objects. A costs four small marks per selected wall |
| Roof Section 2D | **Takes the Stage** as a roof-local reading | **Inset editor** over the 3D Stage, expandable | A. The inset keeps 3D visible, but it duplicates the profile at a second scale and covers the lower right of the Stage. A gives the profile the full Stage and leaves the way back to 3D one segment away. A persistent "open Edit Shape in Section" preference is **not needed yet**. The segment remembers nothing across subjects, and that was never the obstacle |
| Collapsed Index | **Head location chip** | **Translucent edge arrow** | A. B is now lightweight and touch-visible. Owner choice between the two, with A favoured because it also shows *where you are* |
| Collapsed palette cue | **Faint caret** above the armed key | **Nothing** | A, but only just: the caret is 10 × 5 px at 55 % opacity. It is enough to say "there is more here" without adding a control |
| Eraser kinds | **Filter disclosure** (owner choice) | **Kind chips** in the acceptance bar | A, as preferred. Chips remain the lighter answer for occasional use, and the funnel keeps chips' "what was left out" line |
| When erasing asks | **Only across domains** | **Also for topology** | Unchanged from round 1.1: A |
| One Pen | **Context first** | **Shape intent** | A (§3) |

## 5. Accessibility and touch

- **Hover-free equivalents.** Every hover reveal has a touch path:
  - Value tags appear while dragging.
  - The scale point is a tap.
  - The Sheet shows the snap name while dragging.
  - The edge arrow stays at 45 % on `hover: none`, with a 14 px tap zone.
  - Edge grips (Architecture B) have no touch equivalent, which is one reason B is not
    recommended.
- **Targets.** Every point has an invisible hit disc 22–26 px across, and every ray or edge
  an invisible 14 px hit band. The rotation ring has a radius of at least 30 px. Visible
  marks stay small. The rays deliberately
  extend past the ring, so targets never overlap even on a 0.6 m plinth.
- **Contrast.** White marks over a dark halo are meant to stay legible on both pale walls and
  the dark Stage. This is not measured yet; a product pass should check 3:1 non-text
  contrast for every mark. Gold is used only for selection and the held point. Red and yellow are never
  the only cue: the Slice has its pill, the Eraser has a bar, and filters have a text line.
- **Focus vs selection vs inspection.** Focus is the blue ring, selection is gold, inspection
  is yellow plus a pill, and erase marks are red dashes. Under Focus, the Height Sheet plane
  becomes an **outline** instead of a tint, so it no longer washes out the focused story.
- **Keyboard.**
  - Esc unwinds the palette first.
  - `1` / `2` switch 3D and Section while editing a shape.
  - Enter or Esc close Edit Shape.
  - Every Compare variant keeps the Card fields as the keyboard path to the same value.
- **Motion.** Entry animations are 140–220 ms fades. The atlas disables them, and a product
  build should honour `prefers-reduced-motion` in the same way.

## 6. Proposed departures from ratified PLATE

Each needs an owner ruling before it becomes a contract. D1–D13 carry round 1.1 forward.

| ID | PLATE today | Proposal (round 2) | Change from round 1.1 |
| --- | --- | --- | --- |
| D1 | Pointer families Select · Draw · Opening · Place · Measure · More (§0.8.4) | **Select · Ink · Slice · Eraser · Brush · Measure**, with Library beside them | Unchanged |
| D2 | Compact pointer rail on the Paper edge | Bottom dock in **dark forest** material with an **ivory** armed key, and an icon-only palette column in the same material. Collapse is explicit, Esc collapses first, and options are remembered | Material inverted; explicit collapse rules |
| D3 | Three drafting words | Withdrawn | — |
| D4 | Stage furniture incl. datum key | Height Sheet, docked right. Its plane becomes an **outline under Focus** | Outline under Focus |
| D5 | A tool is armed only by its own control | Withdrawn | — |
| D6 | Semantic colour roles fixed (§6.4) | Gold = selected only, white = available transform, yellow = temporary inspection volume, red = erase marks. Tool colour only as a 2 px mark | Narrowed and made explicit |
| D7 | Grammar silent | X-ray overhead plus the near-wall cutaway. The cutaway now spares the selection's host wall | Host wall spared |
| D8 | Experience Stage toolbar | Experience tools in the shared dock | Unchanged |
| D9 | Precision ladder ends in Dimensions; Card ≤3 facts | **The Card is the one writer for ordinary dimensions.** *This changes Card/Instrument authority.* Wall thickness is now an advanced Card field | The Card's wide posture removed |
| D10 | More / Find as a pointer slot | Find in the Head | Unchanged |
| D11 | One reading control | 2D \| 3D primary. While Edit Shape is active the segment becomes **3D \| Section**, a roof-local reading of the same Camera, distinct from the floor Plan | Section 2D reading |
| D12 | Index as grouped locator; collapse leaves a strip | **Scope-model Index (Model A)**, zero-width collapse, and a Head chip or an edge arrow | Outline tree withdrawn |
| D13 | Instrument hosts Edit shape and Erase review | Instrument reserved for Library, Guide and repair. Edit Shape is on the object or in the Section reading. Erase acceptance is a bar or bubble, and kind filters live in the Eraser palette | Filter disclosure in the palette |
| **D14** | The spatial-instrument grammar's knob-and-gizmo handles | **Rays and points** (§1) for every transform: axis rays, rotation ring, track, anchors, and values only on hover or drag. Gold disks, XYZ gizmos and permanent W/D/H text are retired | New |
| **D15** | Slice as a cut line or plane across the whole working area | **A finite drawn Slice**: start and end points, a live preview, and a yellow depth volume that cuts only within its extent. Still temporary inspection, with Put back | New |
| **D16** | Grammar silent on ordinary shapes | **Shape as a Pen reading**: an ordinary editable outline object in Scene, which its height ray pulls into a solid. No Object Pen | New |

Authority notes:

- **D9.** Dimensions stay owned by their domain: Layout for walls, openings, roofs, rooms
  and Levels; Scene for objects and art. Handles and Card fields write the same facts with
  the same refusals.
- **D11.** Section 2D is a viewing state of the one Camera, not a second Camera and not a
  second roof model.
- **D16.** A Shape is a Scene object; this proposes no format.

## 7. Remaining usability problems

Still open after the round 2 browser pass:

1. **Thickness on a wall is a fiddly gesture.** The two-way arrow on the cap thickens
   symmetrically at gain 1, but a 0.24 m wall at overview zoom gives little travel. The Card
   field is the real path; the arrow may belong only to close zoom.
2. **Dimension lines (B) crowd the front corner.** Kept for comparison, but not fixable
   without hiding one line.
3. **Edge grips (Architecture B) are invisible on touch.**
4. **Wall curve is specified, not built.** The atlas shows a static specimen: a hollow point
   at the middle of a free wall would bend it, and a dashed arc previews the curve. Rooms and
   hosted openings would need curved geometry first, and the mock walls are straight
   segments.
5. **The Section inset (B) covers the Stage's lower right**, where the Sheet's foot and the
   zoom controls already sit.
6. **iPad landscape is tight.** At 1180 × 820, with the Index open, a wall selected and the
   Ink palette open, nothing overlaps. But only about 10 px separate the Card from the
   Sheet. iPad portrait was checked only scaled down.
7. **The collapsed caret is very quiet.** Testing may show it needs 70 % opacity.
8. From round 1.1, still open: the cutaway is automatic, with no hold-to-see-outside; Preview
   in portrait crops authored Views; similar names in dense projects need thumbnails;
   Experience hides the Sheet.

Fixed during the round 2 pass:

- **Openings painted behind their wall.** Hosted items now draw just in front of their
  host's depth.
- **The cutaway hid the wall of a selected opening.** The selection's host is spared.
- **The Card collided with the Edit Shape pill** in Section 2D. The pill was replaced by the
  3D \| Section segment.
- **Overlay Index over the dock in iPad portrait.** The overlay now ends above the dock row,
  and its scrim leaves the dock usable.
- **Sheet tint competing with Focus.** It is outline-only under Focus.
- **No-op drags entered Undo.** A turn that snapped back to 0° recorded "Turn". Drags that
  change nothing no longer commit.
- **Wall thickness inverted with drag direction.** It is now symmetric about the wall's
  line.
- **A tour step pointed at the hidden Index** on narrow frames.

## 8. Preserved boundaries and prototype shortcuts

**Preserved:**

- One canonical selection; one Camera authority behind every reading, including Section 2D.
- Chronological Undo, kept separate from Esc.
- The Card holds identity and never tool state.
- Levels are authored; surfaces and pins are not Levels.
- Temporary readings (Slice, cutaway, Focus, Look through, Section 2D) are never source.
- Erasing sets hosted things aside and names cross-domain consequences.
- Preview is isolated from editor machinery.

**Shortcuts (not proposals):**

- Snapshot Undo.
- Painter's-algorithm SVG, with hosted items sorted by their host.
- The finite Slice cuts by each entity's plan centre, not by geometry.
- Roofs swept as one profile; roof-local Section 2D is a mock camera.
- Heuristic stroke reading.
- Bounding and centroid lasso.
- Mock Camera interpolation.
- Mock dense data.
- No persistence.

None of these implies a format, an evaluator or an algorithm.
