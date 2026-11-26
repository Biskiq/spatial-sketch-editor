# Design system — philosophy, shell and spatial grammar

**Owns:** design philosophy, shared shell landmarks and invariants, surface coexistence, and the
semantic grammar of Stage marks. Feature layout, controls and responsive states live in the approved
visual targets routed by [prototypes/README.md](../prototypes/README.md); T1 interaction design and
the Object Studio journey specification are also owned here. Domain ownership, single selection,
one Undo and visitor isolation remain binding everywhere.

## Authority and precedence

Authority is **by concern**, not a ranking that puts design above domain truth.

| Concern | Authority |
| --- | --- |
| Design philosophy and creative principles | This document (below) |
| Domain meaning, identity, validity, evaluation, persistence | [docs router](./README.md) → `reference/` contracts |
| Shared landmarks, coexistence, focus, return, mark species | This document |
| Feature composition, controls, actions, responsive states | The approved target for that surface in [prototypes/README.md](../prototypes/README.md) |
| T1 interaction design and Object Studio journeys | [T1 sketches](./design-system/t1-interaction-sketches.html) · [Object Studio](./design-system/object-studio.md) |
| Shared common shapes (identity, units, acceptance, release) | [architecture](./reference/architecture.md) |

A later explicit approval supersedes older details **within its scope**; it never silently narrows a
domain contract, the one Camera authority, one compiler or one history. Code and tests establish
landed behavior; an approved design establishes desired behavior. When they differ, expose the gap
or build toward the design — do not reinterpret the design to match the code.

```text
docs/design-system.md                 philosophy · shell · coexistence · mark grammar
docs/design-system/*.html             authoritative interaction specimens (World, Experience, T1)
docs/design-system/object-studio.md   Object Studio journeys and interaction specification
prototypes/README.md                  surface → approved visual target
docs/reference/*.md                   semantic authority and invariants
```

Programme folders under `docs/plans/` carry delivery scope. These design authorities live here and
survive programme retirement.

## Design philosophy

Biskiq is one continuing spatial project, not a chain of specialist modes. The visual system serves
that: a calm, curated surface over an open physical model, with real depth available exactly when the
creator asks.

1. **Curated surface, open depth.** The default path is **Pick → Adjust → More → Focused context**.
   Curated choices and a few named controls cover ordinary work; exact values, dense parameters,
   graphs, layer editors and specialised tools appear on request. Complexity on demand is desirable;
   mandatory complexity is not. No ordinary creator manages mesh topology, construction order, UV
   layout or a full CAD/DCC workflow to finish.
2. **Progressive depth without separate engines.** Beginner and professional surfaces are levels of
   access to one capability, not two implementations. Object Studio is the same application, project,
   selection, Undo and Save; appearance in a focused material workspace is the same Finish capability
   as appearance in World.
3. **Freeform freedom with semantic intelligence.** Direct, sketch-like modelling and meaningful
   native architecture coexist. Whether geometry is architecture, and which element kind it is, comes
   from the committed operation and declared relationships — never from resemblance, proximity or a
   later automatic reclassification. Freeform geometry stays useful without being given architectural
   meaning.
4. **Honest refusal and visible repair.** An invalid or ambiguous edit says why and writes nothing.
   A relation that cannot survive a revision is reported, anchored and repairable; it is never
   silently retargeted by name, nearest match or coordinates. "Overlaps, not joined" is information,
   not an implicit weld.
5. **Unified World and Experience over one truth.** World and Experience are lenses over the same
   project, Stage and source. Neither is a second document, selection store, Camera graph or history.
   Visitor Preview shows the visitor's execution, not authoring chrome.

**One writable owner per fact.** The visual host decides how a control paints; the lens or task
decides what is exposed; the domain owns what the operation means. Every writable fact has one
operation owner and one active editing context. Another entry point reaches it through the same
qualified operation. A Card header and body always describe the same canonical target, with each
property's owner legible when relevant.

## Shared shell

World and Experience share Head, a collapsible Index, a dominant Stage, a contextual overlay Card and
one lower working edge that grows upward from a dock. Identity and hierarchy stay recognizable across
lenses; Card, palette and Instrument are absent when their context is absent. **The Stage is the
workspace:** every other surface is small, floats over it or disappears.

```text
HEAD — Index toggle · Biskiq · project menu · World | Experience · active Experience
       · location chip (Index collapsed) · Find ⌘K · Undo/Redo · saved · Preview
INDEX (collapses to nothing)   STAGE — dominant spatial work
                               contextual overlay CARD
                               lower edge, bottom up: DOCK → armed tool's PALETTE → INSTRUMENT
```

| Landmark | Shared responsibility |
| --- | --- |
| **Head** | Project/application context, lens switch, **Find**, save/history, Preview. Application actions, not a second task toolbar. |
| **Index** | Locator and orientation, not a primary property editor: one scope at a time with crumbs, sibling menus and kind facets; relation-aware contents. |
| **Stage** | Continuous spatial truth, readings, marks and direct manipulation. One viewport, one evaluation. |
| **Card** | Canonical selection, its editable facts and the reach of a proposed edit. No empty Card at rest. |
| **Dock and palette** | Pointer tools and what the next gesture does; the armed tool's options stay attached. |
| **Instrument** | Invoked work that needs room while the Card keeps selection identity (Library, repair, Guide context). |

### Binding shell invariants

- **One project and one continuous Stage.** Plan, 3D and focused readings show the same world; a
  lens or reading change does not launch another application.
- **One canonical selection.** One identity, or an explicit supported set, resolved by Stage, Index,
  Card, Find, Details and both lenses. There are no parallel lens selections. A reference, active
  task or relation never masquerades as a second selection.
- **Selection is distinct from task focus.** Keyboard focus, a technical host, a repair candidate or
  temporary geometry are not substitute selections.
- **One Camera/navigation authority and one architectural compiler.** Shell surfaces request framing
  and readings; they own no second graph, Camera history, pose/FOV interpolation or architecture
  reconstruction.
- **Authored truth excludes session state.** Selection, armed tools, temporary readings, proposal
  geometry, disclosure and viewing preferences are not serialized as source.
- **One chronological source history.** One logical result per accepted command; cancellation,
  navigation and reading settings are not Undo.
- **Visitor isolation.** Preview is visitor execution with isolated sessions; visitor chunks exclude
  editor selection, history, gizmos and authoring machinery. Runtime-safe evaluation is shared, not
  forked.
- **A collapsed Index takes no width.** Its location moves into the Head (or a minimal edge arrow);
  collapse preserves location, selection and access. Index and Card overlay the Stage edges without
  resizing or reframing the viewport.
- **The lower working edge is one composition principle, not shared task semantics.** World
  Instrument and Guide context do not inherit each other's layout, vocabulary or lifecycle.
- **Focus and reach.** Keyboard focus is always visible, independent of selection, hover and
  refusal. Every hover-only reveal has a touch path; coarse pointers keep at least a **44 px**
  target. The fine-pointer geometry may be smaller.
- **The `#408` 1024 px coexistence rule.** With the Index open at 1024 px, Library and draft editors
  yield the left lane so both the Index filter and the Library controls stay clickable; Align and
  Import follow the same lanes. The Index never overlays a control the creator must use.

### Escape, return and replacement

- **Escape collapses an open palette before it disarms the tool.** Then it unwinds the active task or
  reading cleanly (picker → Library detail → Library → Align → editor → import → drawers → dropper →
  tray → draft), cancelling without a write.
- An invoked task, focused context or reading has an explicit entry, a visible exit and a revalidated
  return. Put back restores the exact prior standpoint and reading; a refused return preserves
  current state and explains itself.
- **Focus returns to the invoker** — Edit material… → editor → Done returns to *Edit material…*;
  Align → Put back returns to the Align link; Import → Cancel returns to *Import…*; an accepted
  import moves focus to the first target's Card.
- Preview removes authoring infrastructure and restores its entry context on exit. It is never a
  second authored Camera.

### Cards and the Ask Rule

The Card represents canonical selection, not the current tool or host. Identity stays visible when
open and survives compression as a selected-identity control. Identity, owner, source and reach are
independent questions: provenance alone does not announce edit reach.

An edit that reaches beyond the current use invokes the **Ask Rule**: explain what will change and
require an explicit scope decision before acceptance. Offer shared update, local specialization or a
fork only where the domain supports it. A scope prompt never invents inheritance, overrides or fork
semantics. Paint and Finish reach show the affected users before the write, and a stale reach refuses
without changing anything.

## Spatial mark grammar

A mark communicates a real authored fact, an evaluated relationship, a declared operation or
explicitly temporary session context. Its shape and motion must tell the truth about that category.

**Affordance admission.** A new handle answers: what fact does it address, who owns that fact, what
operation does a gesture request, and why is that relationship legible here? If the answer needs an
invented domain constraint, the handle is not admitted. A drawn circle, plane, axis or tangent never
implies an orbit, constant distance, collision boundary or constraint the domain lacks.

- Render architecture from canonical Layout output and Camera from Camera evaluation. Display,
  handles, estimates and execution agree.
- Show a proposal as a proposal and a refusal as a refusal. Accepted source and selection stay
  visible; a refused candidate keeps its attempted geometry as display-only evidence.
- Schematic geometry (a View constellation, a direction glyph, station correspondence) is allowed
  when its role is clear; it never claims metric accuracy, connectivity or identity it lacks.

### Species and emphasis

Owner and state never depend on hue alone; reinforce with shape, line, icon, label, position or
pattern.

| Species | Stage expression |
| --- | --- |
| **Canonical selection** | Coherent identity contour/boundary and permitted handles, gold `#d4ad45` with a dark halo; distinct from reference and task focus |
| **Hover** | Restrained neutral `#F3F4EE` cue below selection emphasis; never gold; grants no unsupported handles |
| **Task focus / reference** | Named relationship or host emphasis without selecting that identity; quiet line/shape/label |
| **Authored control** | Distinct operative glyph where the domain supports the operation |
| **Available transformation** | White sticker glyph (white body, fine ink keyline, soft shadow) on a dashed ink stem with a hairline white halo; value only on hover or drag |
| **Derived helper** | Lighter, hollow or dashed; cannot masquerade as an authored control |
| **Proposal** | One cobalt dashed line or outline with a white halo, no fill; one dashed centreline per changed Wall |
| **Refusal** | Red dashed in the refusal ink with its reason in the live tag; "this won't stay" |
| **Snap** | Relation shape at the winning location: filled dot free, hollow ring on a Wall/end, small square on the grid; ink only, no snap words |
| **Temporary reading** | Explicit state pill and retained as-built relationship; the Slice is a translucent yellow plane and depth volume |

Transformation marks are white sticker glyphs, never axis-coloured: the axis is named by direction
and live tag, and axis conventions never become selection colours. Ink glyphs carry a hairline white
halo so they stay legible on pale Paper and dark materials; a product pass measures at least **3:1**
non-text contrast. Every point and ray has a larger invisible hit area than its drawing, with **22 px**
fine-pointer and **44 px** coarse-pointer targets.

### Rays and points

One quiet vocabulary, scaling from a 0.6 m plinth to a 24 m roof, showing value only while held:

| Mark | Role |
| --- | --- |
| **Ray** | Dashed stem from the addressed face/edge to a chunky white sticker arrow |
| **Move cross** | Four-way chunky cross at the projected manipulation origin |
| **Turn arrow** | One bent two-way arrow in the subject's local frame; the ring is not drawn |
| **Height stem** | Stem spanning base to top with hexagon knobs |
| **Size chip** | Rounded chip with a diagonal two-way icon; toggles width/depth/height controls |
| **Track** | Dashed line along a host the subject slides on |
| **Point** | Small disc knob: end, joint, slide position; gold while held |
| **Dimension line** | Dashed measure line only where a measured relationship is the operation |
| **Tag** | Dark mono live value, only on hover or drag |

The shared language stops at anchors and rays: there is no universal handle, and a subject gets only
the marks its domain supports. A curved Wall publishes canonical arc length as a read-only reading
rather than inventing an exact-length writer. A closed Wall shows a radius ray from its centre. A
grip whose axis is edge-on or ambiguously foreshortened is withheld or given an explained alternate,
never allowed to promise precision it cannot deliver. Exact numeric access stays in the shell's
designated writer; a surface may open that writer or display its value, never expose a second
simultaneous writer.

**Preview equals commit.** The final preview and the committed result differ only within the
domain's declared tolerance (Scene placement: **1e-6** world units/radians). One gesture is one
history entry; invalid, no-op and cancelled gestures are none.

### Layering, density and correspondence

Compose by semantic purpose: world/drawing context → passive references → canonical selection and
task relations → active grips/gesture feedback → associated readouts. Shell controls and menus stay
above the spatial instrument. Preserve meaningful occlusion; when a helper is hidden, use a truthful
projected cue, local contrast or an explicit alternate — never silently move the Camera, substitute
selection or falsify a position.

Shed secondary annotation, repeated labels and passive helpers before obscuring the primary editable
relationship. Plan, 3D, Outside, Through and temporary readings are projections of the same facts;
they may use different graphics but never change identity, ownership, units or operation meaning. A
reading switch cannot secretly capture, retarget, create connectivity or introduce an alternate
evaluator.

Guide time and Camera sampling remain one evaluation. The Guide strip, tour time, scrub and playback
read the same time map; authoring time position never becomes a second animation authority.

### Camera framing postures

- **Outside** exposes the observer in spatial context: position/height, target/direction and framing
  geometry correspond to the evaluated View, subordinate to the world. A literal orbit ring is not
  required and no orbit constraint is promoted.
- **Through** uses the evaluated View image as the working surface with a frame gate and supported
  horizon/height, lens and target grips. Only the active grip shows a numeric tape.
- **Plan** locates Views and Camera support at map scale with schematic but truthful markers; default
  and entry roles are explicit, never inferred from marker arrangement.

Camera infrastructure uses the shared green role plus line/shape; selection and active manipulation
add gold locally. Guide-order connectivity is not Camera topology. A missing supported Travel is a
gap cue with a reason, never drawn as a valid path.

### Lifecycle

Guides, snap winners, live measurements, proposals and task helpers exist only while their task is
active. Clear stale emphasis and hit targets on completion, cancellation, lost capture, exit and
teardown. Temporary inspection stays coupled to its state pill; lens parking deactivates the reading
and Resume revalidates it. Selection may remain recoverable after a reading ends; temporary geometry
may not.

## Visual verification

Compare the live Stage against the approved specimen in matched invocation and viewport states —
desktop, plus narrow/1024 px when the change affects coexistence. Exercise real actions: choose
versus inspect, Escape/cancel, one-entry Undo, and return to the invoking control. A screenshot or a
matching label is not proof of a truthful mark, a reachable gesture or an accepted write.

Approved specimens are falsifiable examples, not mandated drawing techniques. Feature work must
identify its domain facts and operations, then show truthful geometry, eligible grips, species,
active/passive rank, local precision, density, hit/occlusion policy and return behavior in each
relevant reading.
