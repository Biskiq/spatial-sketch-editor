# Scope recommendations and independent critique

Route: [README](./README.md) · [design rationale](./design-rationale.md) · [visual language](./visual-language.md)

**Ratification boundary (#114, 2026-10-13):** the owner accepts the unified UX
direction; [PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md)
owns promoted principles and preserved semantics. The original critique and
recommendations below remain provenance, not automatically ratified product
rules. §5's Guide-context questions are settled as one active Guide, staying open
during related Presentation/View work. Other refinements/deferred depth are not
unfinished acceptance gates. No prototype shortcut or new format is promoted.

## 1. What the prototype demonstrates

| Journey state | Where to see it |
| --- | --- |
| Initial workspace, how to start | *Prototype ▾ → Start from an empty experience*: Stage coach, outline and Guide empty states |
| Present this / New from standpoint | Object Card → **Present this**; outline **New** (3D captures, Plan places) |
| Presentation + available Views | Presentation Card: View grid, Default ◆, reorder, tour usage, free-exploration switch |
| Selected View, Look through, Exit View | View Card; Plan marker drag/aim; Look through with re-aim, Update View, Esc return |
| Guide as an invoked context | Index → *Salon tour* opens it; × or Esc closes it and its Stage overlays |
| Guide overview, several Stops, a revisit | Guide instrument (Stop 5 revisits the piano with a different sequence) |
| Long Guides (15 / 30 Stops) | *Prototype ▾ → Long Guide*: overview bracket, drop on overview, ←/→, ‹ › |
| Dense content (20 / 50 Views, 40 Presentations) | *Prototype ▾ → Large Presentation / Many Presentations*: dense grid, filter, Index search |
| Stage visibility | *Show ▾*: Whole Guide / Selection only; markers, frustums, paths, labels |
| World in the same shell | Head → World: Context Index, object/room/wall Cards, Measure instrument |
| Selected Stop with guided sequence | Stop Card: Visits block, shot list, Not in this Stop, After this Stop |
| Direct Guide manipulation | Drag Stop cards, drag a Presentation onto the Guide, Alt ←/→, ⋯ on the selected card |
| Cut/Travel and Camera path | Connector → Transition Card; Plan path points; wall warning |
| Playback, scrub, follow | Guide header transport, overview bar scrub, Follow camera, Preview this move |
| Guided vs free visitor experience | **Preview**: chooser, guided with Next stop, free with Places and Back to the tour |
| Narrow layouts | *Simulate width → Tablet / Phone*, or resize |

## 2. Recommended prototype boundary

**In:** everything above, plus Undo/Redo, Back, rename, remove with stated consequences.

**Minimum timing for a convincing guided visit — and nothing more:**
1. a **hold** per guided View (Stop-local),
2. a fixed short **glide** between Views inside a Stop (not authored),
3. **Cut** or **Travel + duration** between Stops,
4. a **visitor gate** at the end of each Stop (*Next stop*).

That is enough to demonstrate pacing, automatic progression and visitor control.

**Defer:** mid-route pauses and timed events/actions, narration and captions authoring,
object-interaction scripting, Gates/Go/Detours and branching, multiple Guides, path height and
easing controls, 3D path-point dragging, Camera precision panels, automatic route finding,
resume rules after free exploration beyond “back to the Stop you left”.

**If cues are added later**, put them on the same scrub rail as small *beats* you drop at a moment
(hold here, show caption, trigger object) and edit in the Card. That keeps one timeline instead
of reintroducing station/event dropdowns.

## 3. Where this disagrees with the brief

1. **No separate Journey or path-topology surface.** The brief asks to simplify them; this design
   removes them. The Guide instrument *is* the timeline (its overview bar maps View holds and
   travel time), and the Plan *is* the path editor. Two representations of one sequence will drift; one
   cannot.
2. **The Card is an overlay sheet, not a column.** It departs from the literal Index/Stage/Card
   column arrangement. A column either sits empty or resizes the Stage on every selection, which
   re-frames Plan and breaks “layout changes don’t move the Camera”. The cost is that the Card can
   cover Stage content; the Plan fit reserves its width, and Look through/Follow narrow the canvas
   so a composition is never hidden.
3. **Stop-local sequences — kept, with a consequence made visible.** Routes belong to the Camera
   and are keyed by the pair of Views they join, so they can be reused (the same exit → entry pair
   shares one path). Reordering a Stop so it enters or leaves on a different View therefore means
   a *different* route. The design says so (toast, red dashed direct path when it crosses a wall)
   rather than silently dragging the old path along.
   *Alternatives considered:* routes owned by the transition (simpler to explain, but makes the
   Camera graph a Guide artefact and blocks reuse); Stops that reference all Views in Presentation
   order with only skip toggles (simpler, but loses the expressive revisit — “same piano, new
   order”). The brief’s model is the better product; it just needs this honesty.
4. **Camera control is two three-way choices.** Lens (Wide/Normal/Close) and Eye height
   (Seated/Standing/Raised), plus placing and aiming by hand (Plan handle or Look-through drag). No
   numeric pose, FOV, roll or multiple camera postures. If a creator needs more, the answer is a
   better hand gesture, not a field.
5. **Present this and New are both kept, as two doors to one concept.** The brief warns against
   duplicated creation. They are not duplicates: one starts from a thing, one from a place, and
   they live in different contexts (object Card vs outline). The subject relationship is retained
   but reduced to a kicker link.
6. **“Open in free exploration” is a new per-Presentation switch.** Small semantic addition:
   without it every Presentation is necessarily public, and creators lose the ability to keep a
   working Presentation out of the visitor menu. Default on. Flag for the owner: drop it if free
   exploration must always expose everything.
7. **Inside a Stop, View-to-View motion is not authored.** It is a fixed 1.6 s glide evaluated by
   the Camera. The brief only asks for Cut/Travel *between Stops*; authoring every inner move would
   double the decisions for little visitor value. Deferred, not forbidden.
8. **The last Stop ends into free exploration.** “Keep exploring — including views the tour
   skipped” is the visitor-facing payoff of the guided/free distinction.
9. **3D shows paths but edits them only in Plan.** Planar route shaping on paper is precise and
   unambiguous; height interpolates between the two Views. A 3D drag on the floor plane is easy to
   add later but was not worth the ambiguity now.

## 4. Prototype shortcuts (never promote these)

- `app/camera.js` is a stand-in for the Camera authority (Catmull-Rom on planar points, smoothstep
  orientation blending). It exists to make the *rule* visible — one evaluator for every consumer —
  not as a curve or guard model.
- The data in `app/world.js` (`presentations`, `views`, `guide.stops`, `paths` keyed `from>to`) is
  mock state, not a format proposal. View storage, Camera storage location and document
  boundaries are untouched questions.
- Undo is a JSON snapshot stack; selection history is an array; nothing persists across reloads.
- Thumbnails use a second WebGL context; the visitor preview a third. Fine for a demo, not a
  rendering strategy.
- The *Prototype ▾* menu (scenarios, stress content, simulated width) and `window.__xp` are review
  facilities, not product UI. Stress content is generated (`seedStress` in `app/world.js`).
- The World domain is representative only: read-only Cards, static bound names, one Measure
  instrument. It shows shared grammar, not World authoring.
- Editor visibility (*Show*) and Guide density are session preferences, never serialized.
- Not verified: touch gestures on real devices, screen-reader flows beyond labelled controls,
  performance with large museums.

## 5. Open decisions after round 2

1. **Does the Guide stay open across Presentation work?** This design says yes until closed
   (one task: capture a View, then include it in a Stop). The alternative — close when the
   selection leaves the Guide — is quieter but forces reopening constantly.
2. **Multiple Guides.** The Index section is plural and the instrument names its Guide, so a
   second Guide is a second row. Whether two Guides can be open at once is deferred; this design
   assumes one open at a time.
3. **Stage visibility defaults.** *Whole Guide* with faint context is the default; *Selection
   only* is one click. If owners prefer focus by default for long Guides (> 12 Stops), that is a
   one-line rule.
4. **World instruments that need width** (Unroll, Section): proposed exception — they take the
   full Stage width and the Card collapses to its title while they run.
5. **Serif for authored names** is kept but used less (Card title, Guide name, Stop identity,
   visitor captions). If the owner prefers UX3’s all-sans identity, only `--font-display` changes.
