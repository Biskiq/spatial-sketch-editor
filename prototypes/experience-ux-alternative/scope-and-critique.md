# Scope recommendations and independent critique

Route: [README](./README.md) · [design rationale](./design-rationale.md) · [visual language](./visual-language.md)

## 1. What the prototype demonstrates

| Journey state | Where to see it |
| --- | --- |
| Initial workspace, how to start | *Prototype ▾ → Start from an empty experience*: Stage coach, outline and Guide empty states |
| Present this / New from standpoint | Object Card → **Present this**; outline **New** (3D captures, Plan places) |
| Presentation + available Views | Presentation Card: View grid, Default ◆, reorder, tour usage, free-exploration switch |
| Selected View, Look through, Exit View | View Card; Plan marker drag/aim; Look through with re-aim, Update View, Esc return |
| Guide overview, several Stops, a revisit | Guide strip (Stop 5 revisits the piano with a different sequence) |
| Selected Stop with guided sequence | Stop Card: Visits block, shot list, Not in this Stop, After this Stop |
| Direct Guide manipulation | Drag tiles, drag Presentation onto strip, Alt ←/→, ⋯ on selected tile |
| Cut/Travel and Camera path | Connector → Transition Card; Plan path points; wall warning |
| Playback, scrub, follow | Guide bar transport, scrub rail, Follow camera, Preview this move |
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
   removes them. The Guide strip *is* the timeline (tiles map View holds, connectors map travel
   time), and the Plan *is* the path editor. Two representations of one sequence will drift; one
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
- The *Prototype ▾* menu (scenarios, simulated width) and `window.__xp` are review facilities, not
  product UI. The World tab is disabled because World authoring is outside this study.
- Not verified: touch gestures on real devices, screen-reader flows beyond labelled controls,
  performance with large museums.
