# Biskiq: Space Stays. Intent Changes.

One opinionated creator-facing direction. The companion interactive prototype is a product-design simulation, not a production implementation blueprint.

## 1. Central Design Thesis

The canvas is the constant. World and Experience are two authoring intentions over one project, not separate applications. World shapes what exists. Experience expresses what matters and how it is encountered.

The shell preserves the spatial canvas, subject selection, and temporary inspection frame across intention changes. The tools around the canvas change. "Present this" deliberately creates reusable meaning around a selected subject without a wizard, implicit Camera capture, or automatic Guide creation.

## 2. Information Architecture

- Project is the containing creative context.
- World contains distinct spaces, architecture, objects, and relationships. It is not collapsed into one document.
- Camera is one shared authority for authored Views, framing, movement, projection, and timing.
- Experience contains first-class Presentations and an optional Guide.
- A Presentation references zero, one, or several World subjects; it can include explanation, Views, supported Activities, and visitor Interactions.
- A Guide traverses Stops. Each Stop references reusable meaning and provides occurrence-specific entry context and continuation.
- Visitor delivery reads authored composition. Runtime and session choices never silently write back.

The UI retrieves these through a scoped index, contextual View library, occurrence workbench, and on-demand references. It does not invent duplicate semantic systems to simplify panels.

## 3. Shell Composition

The top bar provides project context, WORLD | EXPERIENCE, undo/redo, saved status, and Preview. The center is one continuous spatial canvas. A retractable scoped index sits beside it. A contextual workbench opens for the selected subject, Presentation, Stop, or shared View.

These are not a mandatory scene tree and universal Inspector. The index changes with intention; the workbench changes with the authoring action. Representation controls remain attached to the canvas, not the intention switch.

## 4. World and Experience Relationship

World exposes source construction, placement, geometry, materials, and relationships. Experience exposes story, authored framing, Activities, Interactions, and discovery.

Switching intention does not navigate the Camera, capture inspection, or reset source selection. The last relevant meaning or occurrence context remains latent while editing its World subject. Returning restores it. Selecting an unrelated subject begins a new meaning context instead of silently adding it to the old story.

World source names and Presentation titles are independently authored. A source rename is reflected in its focus reference but does not rewrite the Presentation title or explanation.

## 5. Spatial Navigation and Representation

One continuous inspection-angle control moves from above, through a spatial model, to eye level. Plan and 3D are representations of the same working context, not peer applications.

- Clicking selects without moving the Camera.
- Focus is an explicit approach action.
- Move invokes precise overhead direct manipulation without changing intention.
- Return to room restores the broader spatial context.
- Breadcrumbs reveal scope and spatial containment.
- Temporary pan, zoom, angle, and projection remain inspection until explicitly captured.

## 6. Selection and Context Contract

| Action | Selection and context | Camera | Authored writes |
| --- | --- | --- | --- |
| Switch lens | Same subject; relevant meaning remains latent | Retain inspection | None |
| Select Presentation | Meaning and linked subjects | No movement | None |
| Select Stop | Occurrence, shared meaning, linked subjects | No movement | None |
| Focus / inspect saved View | Semantic selection retained | Explicit movement | None |
| Adjust framing | Meaning retained; shared View working context | Temporary working frame | Only on Save |
| Return to World | Same source focus; meaning latent | Retain inspection | None |
| Edit source | Identity and links retained | Do not silently recapture | World only |
| Exit Preview | Exact authoring context restored | Editor inspection restored | None |

The interface distinguishes selection, representation, navigation, authoring intention, and authored visitor behavior. No one action silently performs the others.

## 7. Presentation Authoring

The simple composer contains name, focus, explanation, and View. "Present this" makes a new Presentation; opening existing meaning is a separate action. It never assumes there must be one Presentation per source.

The focus row edits zero, one, or multiple subject links. Content can be authored independently of focus. "Add to this story" reveals variants and supported behavior. Activities are things that happen; Interactions are actions a visitor chooses to invoke. Examples include a piano phrase, a single piano note, or revealing a detail. These do not change World source truth.

"Available while exploring" explicitly controls free-exploration discovery independently of Guide membership. A Presentation can exist with no Guide, no Stop, no subject, or no authored View.

## 8. Camera / View Progressive Disclosure

1. Use current view: explicitly capture temporary inspection into a shared authored View.
2. Choose saved View: reuse the one Camera authority.
3. Adjust framing: use the same canvas with scale, offsets, angle, and projection.
4. Unfold Movement: author and rehearse an eased route or approach, with duration.
5. Manage uses: understand shared references and deliberately save a separate View when appropriate.

Editing a reused View warns that saving updates its uses. Applying a View for inspection is not editing it. A Stop may override entry framing by referencing another shared View; it does not own a second Camera.

## 9. Guide / Stop Authoring

Guide is uncreated by default. Choosing a path creates it. Adding a Presentation produces one Stop reference. Adding it again produces another occurrence, visibly marked as reuse.

The Stop workbench contains the shared Presentation link, entry View, optional entry prompt, continuation, pacing, and optional Gate. Editing the shared Presentation is a clearly separate action. Removing a Stop does not delete the meaning. Reordering changes traversal only.

Default continuation is visitor-paced. Activities or a timed wait may provide deliberate authored continuation. Gates apply to the path, not to all exploration. Guide settings specify rejoin behavior: resume the retained occurrence by default, or deliberately advance after a completed occurrence. Visitors can always leave the path and explore.

## 10. Preview Behavior

Preview starts at the current Presentation or selected Guide occurrence. Authoring chrome disappears; a slim simulation strip offers a clear Back to editing / Escape exit.

Entry retains the lens, source selection, Presentation or Stop, workbench state, and inspection frame. Visitor camera exploration, interactions, Gate completion, and Guide cursor live in the Preview session only. Exit discards them and returns to the exact authoring context. Iteration is edit, Preview, exit, refine without reconstruction.

Visitors can follow a Guide, leave it, discover other meaning, interact, and later rejoin. The Guide cursor survives free exploration within the session. Broken authored references are surfaced as repair problems, not silently guessed visitor behavior.

## 11. Progressive Disclosure

The simple loop remains select -> explain -> choose View -> Preview. Advanced capabilities unfold at their owning decision:

- Multiple subjects through the focus row.
- Variants and Activities through Add to this story.
- Precise Camera and routes through Adjust framing / Movement.
- Reuse and entry context through the Stop.
- Gates and pacing through occurrence controls.
- Rejoin policy through Guide settings.
- Repair through dependency notices and an attention filter.

Use readable verbs, direct feedback, and rehearsal instead of a programming metaphor.

## 12. Critical Journey Walkthroughs

### World to Presentation

Edit the World, select the piano, optionally focus it, and choose Present this. Selection and inspection remain. The new meaning references the subject without capturing a View. Add explanation, deliberately choose or capture a View, and Preview. Exit returns to the same authoring context.

### Presentation Reuse

Create meaning once. Add it as Stop 01 and again as Stop 04. Give the first close entry framing and the return a room-wide frame plus a new prompt. Edit shared content once; both reflect it. Occurrence-specific framing and pacing remain independent.

### Experience Without Guide

Create several discoverable Presentations and visitor Interactions. Leave Guide absent. Preview allows spatial discovery and an Explore list. No sequence is generated from the authored Views or meaning.

### Advanced Camera

Begin with Use current view. Later adjust precise framing on the same canvas, unfold Movement, author an eased route, set timing, and rehearse. Save to the one shared View authority, with explicit shared-use feedback or a deliberate separate View.

### Repair

Delete a referenced View or remove a source subject. Retain the Presentation and unresolved reference. Surface an amber attention item. Offer explicit replacement, new capture, subject-free meaning, or removal of the View requirement. A moved source produces a framing-review notice, not automatic recapture. Review and save to acknowledge the new relationship.

### Dense Project

Keep a scoped index; search across World subjects, Presentations, Views, and Stops with type and location. Sort and filter for attention. Reveal references only when needed. Search selection changes context; explicit inspection applies a View.

### Repeated World / Experience Work

Select Piano -> Experience -> Presentation -> View -> World -> change Piano -> Experience. Source identity, linked meaning, and working inspection remain. World edits update source truth only. The story is not overwritten. A moved source invites framing review. The creator never starts over just because intention changes.

## 13. Dense-Project Behavior

Scope, retrieval, and on-demand relationships replace permanent chrome. World groups by spatial responsibility. Experience lists meaning. Stops live inside their optional path. Views are retrieved through a contextual library. Search includes occurrence identity to disambiguate repeated meaning. Reference surfaces answer where something is used. Attention is a focused repair queue rather than an always-on dashboard.

Presentations with the same focus share one canvas anchor that opens a small stack. This is a temporary retrieval surface, not a new semantic group or ownership system.

Saved scopes and bulk repairs are future research hypotheses, not required new semantic systems.

## 14. Deliberately Contextual Surfaces

World geometry and materials; hierarchy and cross-space scope; Camera framing, routes, timing, and library; Presentation references and variants; Guide sequence and occurrence tools; Gates, pacing, and rejoin rules; dependency repair.

No permanent Camera application, timeline, Guide sidebar, universal Inspector, or behavior palette.

## 15. Rejected Assumptions

A hierarchy must be the creative home; World is one document; Experience means tour; Presentation equals Stop; one Presentation belongs to one Stop; every View becomes a Stop; Plan and 3D are unrelated workspaces; Experience owns Camera; selection means navigation; inspection is authored visitor behavior; Preview is an editor; advanced features require permanent panels.

## 16. Questions to Test

Can creators predict retained context, including multi-subject and subject-free meaning? Is the continuous view-angle control legible? Are inspect, save, and separate-View actions distinct? Is explicit discovery understandable? Can creators explain reuse versus occurrence after one use? Is same-occurrence rejoin the least surprising default? Which World changes warrant framing review without noise? Can nontechnical creators predict Gates without thinking in code?

## Source and Prototype Boundary

The accepted constraints in the supplied brief are the available source of truth. No separate architecture documents or production codebase were provided. The prototype uses illustrative spatial renders, an editable overhead representation, local browser persistence, and synthesized audio. It is not a production geometry engine, publishing backend, or visitor-delivery service. No implementation limitations are inferred from the unavailable production codebase.