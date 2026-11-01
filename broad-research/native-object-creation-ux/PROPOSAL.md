# Native object creation: one Stage, deeper objects

**Product and UX research · proposal for owner review · 2026-10-31**

No implementation, interactive prototype, plan release or contract amendment. Investigated independently, without subagents, against `main` at `1032c09c`. The PNGs illustrate the proposed destination; they are not product screenshots or proof of geometric feasibility.

## Recommendation

**Make Object Focus the object-authoring experience, with a first-class New object entry and a real component model underneath it.** A creator can begin with an unplaced design, build it into an assembly, and place it in World when ready. Quick World creation stays quick.

Object Focus is the appropriate **interaction foundation**, but the existing single-form refinement plan is insufficient. The missing foundation is the distinction between an object's design, its components and its placements. Calling a focused view “Object Studio” would not supply that foundation.

Keep **World | Experience** as the lenses. Use **New object**, **Edit object**, **Parts**, **Shape** and **Operations** as creator language. “Object Focus” describes the active scope. Do not add a third Studio lens.

The ambition becomes two credible paths: a plinth in minutes without learning hierarchy; a piano over hours with independently editable keys, lid, body and wheels. Fifteen minutes and ten hours are product goals, not measured results.

## 1. The actual problem

I began with the creator journeys and competing authoring models before inspecting implementation. The resulting product test is: **can someone start an object, understand the reach of an edit, and revise it next week without reconstructing their intent?**

| Barrier | Why it matters | Needed capability |
| --- | --- | --- |
| Placement precedes identity | An empty World removes the museum, but still makes the creator think about placement before design | An unplaced, saveable object draft |
| One body is treated as one object | Joining a piano into a solid destroys useful component boundaries | Nested assemblies, component identities and local frames |
| Isolation is mistaken for modeling depth | A better camera cannot make a hole, sweep a leg or preserve a repeated pattern | A deliberate native geometry capability ladder |
| Revisions depend on remembering construction | A beautiful result becomes fragile when an earlier dimension changes | Persistent editable operations and explicit dependencies |
| Selection does not communicate edit reach | “Change this key” may mean one key, all white keys or every piano | Visible source/use scope and deliberate exceptions |
| Saving, reuse and editing are conflated | A library snapshot is not a mutable draft or a live instance | Separate, plainly named lifecycle actions |

Beginners need useful defaults and forgiving direct manipulation. Ambitious creators need explicit structure, exact values and inspectable operations. Hiding these concepts universally reduces the ceiling; exposing them universally burdens the simple path.

### What the repository actually establishes

| Status at the research base | Evidence and implication |
| --- | --- |
| **Shipped:** T5.P01 source forms, sizing, save/reopen and My Objects copies | [P01 closure](../../docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/README.md). This is a usable source-based foundation, not advanced modeling. Its load/performance evidence is not a general complex-object performance pass. |
| **Shipped later:** Objects is the creation/insertion entry; Ink is architectural | [R217.S17A plan](../../docs/roadmap/r217-core-editor-stability/r217.s17a-shape-drawing-simplification/implementation-plan.md) and [acceptance](../../docs/roadmap/r217-core-editor-stability/r217.s17a-shape-drawing-simplification/acceptance.md). Box/Round click or drag, Free, Sphere, Models, My Objects and Import; placement can use the datum without a Room. Upright form encoding survives, but upright Stage drawing awaits the face-frame capability. |
| **Shipped, bounded:** My Objects saves immutable single-form source; insertion detaches | [Library UI](../../apps/editor/src/lib/authoring/adapters/scene/library/MyObjectsSection.svelte), [copy planner](../../packages/project-model/src/scene-planning/operations.ts), [assets contract](../../docs/reference/components/assets.md). It does not reopen an item as a standalone assembly draft, offer live updates or preserve assembly structure. |
| **Not shipped:** durable editable assemblies and component resolution | [Scene contract](../../docs/reference/components/scene-content.md), [F.1](../../docs/reference/composition-execution.md#f1-identity-and-reference). Clusters are member lists, not assemblies; current resolvers refuse non-null component references. An imported GLB's render hierarchy is not authored component identity. |
| **Approved direction, future capability:** Object Focus and subsequent geometry | [T5 umbrella §6.3–6.4](../../docs/roadmap/t5-expressive-geometry/umbrella-plan.md#63-t5p02--object-focus-refine-and-shape-planned). P02 covers sections, outline revision and reach-bounded shaping; boolean composition, generators and reuse remain conditional. No separately registered P02 phase appears in the inspected track register. |
| **Ratified constraints:** shared infrastructure and domain ownership | [Architecture](../../docs/reference/architecture.md#expressive-creation-and-revision-destination), [F](../../docs/reference/composition-execution.md), [PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md). One Stage, canonical selection, Camera authority and chronological source history; Scene owns objects, Layout owns architecture, typed resources own reusable source. |
| **Convergence in progress:** preserve the current correction work | [R217 register](../../docs/roadmap/r217-core-editor-stability/README.md) and [owner rulings](../../docs/roadmap/r217-core-editor-stability/post-s10-convergence/owner-decisions.md). S12–S18 and S17A are shipped at this base; S19–S25 remain approved. Compact shell, truthful feedback and selection are foundations, not new modeling capabilities. |

Some older headings still say My Objects is “in review,” and the umbrella still describes Ink → Shape. Phase closure, S17A's explicit cutover and matching source resolve those bounded discrepancies. This proposal does not rewrite their historical records.

## 2. Alternatives considered

| Authoring model | Strength | Cost / failure mode | Verdict |
| --- | --- | --- | --- |
| World-only creation + isolated editing | Few transitions; excellent contextual scale | Object projects still begin as placements; parts and source lifecycle remain unresolved | Preserve for quick work; insufficient alone |
| Standalone object application with export/import | Strong mental separation; ample specialist UI | Risks divergent commands, persistence and revision; transfers interrupt composition | Reject the separate application, not the standalone entry |
| CAD-style Part Studio and Assembly workspaces | Strong source/instance distinction; deliberate engineering structure | Repeated workspace transitions and construction concepts become the default | Borrow semantics, not mandatory workspace separation |
| One Stage with unplaced drafts and scoped component editing | Direct start, consistent interaction, explicit depth and natural composition | Requires substantial T2 modeling/lifecycle work and a bounded shell amendment | **Recommend** |
| Procedural graph as the primary interface | Strong generative depth and explicit dependencies | Poor first-object experience; graph management becomes a second task | Optional future expert surface only when earned |

The earlier objection that a studio *necessarily* duplicates Camera, history and persistence is too strong: a distinct entry can consume shared infrastructure. Conversely, “an empty World already works” answers spatial emptiness, not source ownership or reuse. The recommendation separates those questions and retains the current one-Stage architecture.

Three external precedents sharpen the tradeoffs, without proving Biskiq usability: SketchUp distinguishes definition edits from making one instance unique; Onshape distinguishes multi-part authoring from assembly instances; Blender exposes ordered modifiers. The useful lessons are edit reach, structure and revisable order—not wholesale adoption of their interfaces. Sources: [SketchUp components](https://help.sketchup.com/en/sketchup/editing-components), [Onshape Part Studios](https://cad.onshape.com/help/Content/PartStudio/part_studios.htm), [Onshape assembly insertion](https://cad.onshape.com/help/Content/Assembly/insert_parts_and_assemblies.htm), [Blender modifiers](https://docs.blender.org/manual/en/5.0/modeling/modifiers/introduction.html).

## 3. A coherent creator workflow

### Start simply, or start independently

**Quick World path:** Objects → Box, Round or Free → draw/place → adjust height or dimensions in the Card. No naming, library save, hierarchy setup or Focus visit is required. Sphere keeps its honest primitive capability; do not imply every existing kind has the same edit set.

**Standalone path:** My Objects → **New object** opens an empty object scope on the same Stage. Name is optional. Box/Round/Free create the first component; **Add part** continues. No Room, museum or World placement is created. An **In progress** section in My Objects locates saved object drafts; **Saved objects** contains reusable snapshots. These are two lifecycle views, not competing stores.

Inside a World project, Objects → **New object** creates an unplaced project-local design. From the application entry, it creates an ordinary authoring project envelope containing the object design, with no placed World content. T3's existing project lifecycle and Save service remain responsible; this adds an entry/discovery path, not a T5 document format. The unplaced definition itself needs T2 admission.

![Start a standalone object with an empty workplane and no World placement.](./figures/01-new-object.png)

*01 — Proposed standalone entry. The saved draft is recoverable even if it is never placed. The new object-scale snap setting requires approval; it is not current World behavior.*

### Build parts without making everything procedural

A root can contain one form or a hierarchy. **Add part** creates a sibling under the current assembly scope; drawing never silently unions touching parts. Selecting geometry exposes its supported actions. **Edit shape** enters source refinement; **Edit object** enters the whole object's component scope.

A grand piano can grow as follows:

1. Draw the body profile; add depth, then retain cavity cutters as editable inputs.
2. Add the lid as a separate component; establish its hinge-edge pivot without moving it.
3. Create key designs; distribute 52 white and 36 black keys using an explicit pattern with octave gaps and end exceptions, not one indiscriminate linear array.
4. Add legs, wheels and pedals as components; reuse a wheel definition where appropriate.
5. Revise body proportions, inspect affected parts and accept or repair deliberate relationships.

A chair follows the same structure: separate frame, seat shell, back ribs and feet; sweep/bend the frame; cut the seat; repeat ribs. Neither requires a different application.

### Make geometry progressively deeper

| Capability family | Creator interaction | Retained intent / limitation |
| --- | --- | --- |
| Existing forms + P02 | Draw, size, edit outline, inspect sections, reshape with visible reach, Keep part | Keyed controls and object-space operations; re-evaluate or refuse |
| Solids and construction | Cut, join, intersect; revolve and sweep; later loft where it earns admission | Retained operands, profiles and paths; joining solids is explicit and distinct from assembly |
| Repetition and deformation | Repeat/mirror parts; bend, twist, taper | Editable seed, distribution and exceptions; declared affected scope |
| Precision and smoothness | Fillet, shell/offset, blends; later subdivision or sculpt detail if needed | Each route declares accuracy, bindings and conversion losses; no universal kernel promise |

These are a recommended long-term capability agenda, not a newly approved feature list. Prioritize assemblies, cut/join, revolve/sweep and patterns against the piano/chair briefs. A blanket prohibition on face/edge operations or visible operation order would prematurely rule out useful precision work. Such operations still need a robust reference strategy before admission.

**Operations** is an optional Card view for the selected part: a retained source recipe, not session Undo and not a log of every gesture. Direct edits change the corresponding parameters. Experts can inspect inputs, suppress an operation, revise parameters and preview supported reorderings. Never offer arbitrary reordering when dependencies forbid it. Operation focus does not replace the canonical selected part.

![A chair seat with a visible source recipe, section inset and pending bend.](./figures/02-geometry.png)

*02 — Proposed geometry depth beyond P02. The seat stays selected while its Bend operation is edited. The section inset is a reading of the same evaluated subject; depicted geometry and dimensions are illustrative.*

### Organize an assembly

| Concept | Meaning in the interface |
| --- | --- |
| **Form/body** | Editable geometric source; several solids may belong to a deliberately combined part |
| **Component** | A named, addressable part with its own local frame and pivot |
| **Assembly** | A component containing child occurrences; meaningful ownership and transform hierarchy |
| **Group** | Organizational membership only; grouping creates no attachment, fusion or mechanical relationship |
| **Reusable design / instance** | Shared source and a particular occurrence; each instance has its own identity and admitted overrides |
| **Pattern** | An authored distribution of instances with stable member identities and explicit exceptions |

Within Object Focus, the existing Index becomes **Parts**, with a bounded, collapsible tree of the focused assembly. Ordinary World retains its location/scope Index. This is an explicit exception to PLATE's exclusion of an outline-tree Index, not a global outliner.

Click selects an immediate child in the current scope. **Enter part**, double-click or a breadcrumb descends; **Up one level** ascends. Browsing alone does not change selection. Find searches parts; hidden/locked states remain identifiable and keyboard reachable. Selecting a repeated member exposes **This instance** and **Edit shared design**, with affected-use counts before a shared edit. **Make independent** creates a new source identity; ordinary Duplicate is independent, while **Add linked instance** is explicit.

Reparenting previews the new parent and preserves world pose by default. It refuses cycles and unsupported transforms. Deleting a component names affected relationships; unresolved references remain visible where the owning domain permits them. Reordering rows does not retarget references.

Setting a pivot preserves visible geometry. Local position/rotation, parent transforms and a pivot frame support later independent motion without adding joints, animation channels or a timeline now. Whole-assembly resizing defaults to uniform scale; stretching dimensions must use declared parameters or disclose the deformation, never silently shear child frames.

![A grand piano with nested components, repeated key families and a selected lid pivot.](./figures/03-assembly.png)

*03 — Proposed assembly hierarchy. Keyboard and Legs are subassemblies; wheel/key reuse is distinct from organization. The open lid is a static authored pose, not animation.*

### Save, reopen, reuse and return

| Action | Exact promise |
| --- | --- |
| **Save** | Saves accepted draft/project source through the existing conditional Save path. Unsaved work remains visibly unsaved; no implied new autosave policy. |
| **Resume draft** | Reopens the saved authoring project and its object design. Operations persist; session Undo and temporary inspection do not. |
| **Save to My Objects** | Creates an immutable reusable source snapshot, including nested definitions, materials, dependencies and pivots once admitted. It is an external library operation, not an Undo entry. |
| **Open for editing** on a saved item | Opens a new editable draft copy; names that copy and leaves the immutable library item unchanged. |
| **Insert copy** | Creates independent authored identities and an editable dependency closure in the destination project. Neither project nor library silently updates the other. |
| **Place in World** within the current project | Creates the first placement of the project-local design with an explicit placement preview and one accepted Scene operation. Later linked placement is explicitly named. |
| Future **Use linked / Update available** | Uses exact pinned revisions; updates require impact review and acceptance. This is separate T2 scope, not a reinterpretation of Insert copy. |

To place a standalone draft into another project, save the draft, choose the destination and insert an independent copy through the same resource system. Undo belongs to the destination insertion; it cannot undo the source project's work. A saved source must close over its dependencies rather than depend on another project's private bytes.

When entering from World, **Back to World** restores Camera-managed viewpoint/reading, scope and selection context; the object never moves to an origin for editing. **Show context** reveals surrounding World as read-only reference. World geometry can inform a one-time dimension without creating an automatic following relationship.

A clean exit keeps applied edits. A pending operation offers **Apply & return**, **Discard change & return**, or **Continue editing**; invalid candidates cannot apply. Discard affects only the current pending operation. Esc cancels the innermost gesture/task; it never undoes already accepted work. If Undo deletes the focused subject, exit to the nearest valid scope.

![The piano back in a museum World, with an ordinary object Card and My Objects copy actions.](./figures/04-world-return.png)

*04 — Proposed return/reuse state after placing a draft and subsequently editing it from World. Assembly snapshots and Open for editing are new capabilities. Insert copy retains today's independence promise.*

## 4. Interaction and revision rules

**Information homes remain recognizable.** Head owns project identity, Save/history, Find and lenses. The scope pill identifies the editing target and return destination. Parts locates components; the Card owns selected identity and numeric/operation controls; Stage owns direct manipulation. Objects/My Objects uses the existing lower instrument. Advanced capabilities do not create a permanent dashboard or global feature timeline.

**Precision is frame-aware.** Show whether a dimension concerns the object, component, profile or World; distinguish exact inputs from measured evaluated results. Typing a value is not a persistent constraint. Offer explicit dimension constraints only when supported. Proposed Focus defaults: millimetre display, 100 mm grid and 10 mm snap, changeable explicitly and never with zoom. World keeps its accepted grid/snap policy. This does not lower today's 1 mm feature floor or imply machining tolerance.

**Sections favor spatial continuity.** Recommend an optional, expandable section inset on large screens; full-Stage section on small screens or by choice. Only the active reading receives gestures, with one selection and Camera authority. This settles P02's open presentation question in favor of a named inset treatment, subject to usability review.

**Failures preserve accepted work.** Retain the candidate and explain “Cut would remove the kept base” or “Bend intersects the frame.” Show affected geometry and deliberate corrections. Revising an upstream profile re-evaluates downstream work in declared order. Lost support stops the candidate or produces an explicit repair state where admitted; it never guesses a replacement edge by proximity. Converting or baking a representation is explicit, states lost editability and retains the source needed for recovery.

**Scale comes from structure, not flattened meshes.** Pattern members require stable authored keys and source correspondence, not triangle or array-index identities. Changing count cannot silently transfer an exception to another key. Lazy hierarchy expansion, scoped picking, shared geometry and evaluation caches should keep dense assemblies workable; identity does not require a draw call per part. Long operations need cancellable preparation and stale-result rejection. None of these performance properties has been demonstrated by the PNGs.

**Small screens and access:** collapse Parts to a scope chip; open the Card on demand; expand a section instead of squeezing two unusable views. Provide keyboard scope navigation, explicit selection paths, numeric equivalents and touch targets of at least 44 px. The desktop PNGs do not establish touch, contrast or narrow-layout acceptance.

## 5. Integration and owner decisions

### Preserve

Keep P01's authored source, deterministic evaluation, copy semantics and ordinary World interactions. Preserve S17A's Objects entry and R217's current interaction/camera/convergence work. Keep P02's sections, outline keys, reach, kept regions, refusal and per-edit acceptance. Retain Scene/Layout separation, typed resources, F.1 identity, F.4 acceptance and visitor isolation.

The [Shape focus study](../../prototypes/native-object-shaping/UX-SPEC.md) contributes visible reach and pending-change/return behavior. [Native Form Lab](../../prototypes/native-form-lab/FINDINGS.md) contributes profile/path and identity-loss examples. [Object Composition](../../prototypes/object-composition-prototype/README.md) contributes source/use reach and repair cases. These are design evidence, not production models or proof of creator success. PLATE and the accepted shell remain the visual baseline.

### Reconsider explicitly

| Decision requested | Proposed disposition | Owner / impact |
| --- | --- | --- |
| World-first creation in T5 umbrella §2 | Add direct unplaced drafts; retain same Stage and route infrastructure | Owner, T2/T3 lifecycle and T1 host |
| P02 as single-form refinement only | Keep that useful bounded milestone; design its scope host for an assembly root and nested target. Do not claim it delivers a piano | T5 + T1; revise scope before implementation if expanded |
| Hierarchy deferred indefinitely behind shaping | Plan T2 component identity/definition/instance work alongside T5 depth; useful assemblies do not depend on every deformer | Owner + T2; no new phase IDs created here |
| No outline tree in PLATE | Approve Parts tree only inside Object Focus, representing actual composition ownership | Owner + shell/T1 |
| “Creators never manage construction order” in umbrella | Replace with “ordinary creation does not require it”; expose authored Operations on demand | Owner + T5; preserve semantic order and one Card writer |
| Object-scale grid/snap and section presentation | Approve fixed explicit Focus settings and optional section inset; preserve World policy | Owner + T1/T5, Camera review |
| Form-only immutable library | Extend to assembly source closure and draft discovery; preserve detached-copy default | Owner + T2/T3; item revisions/linked updates stay separately approved |
| Advanced geometry and precision ceiling | Admit capabilities individually from concrete blocked work; revisit face/edge operations when robust references are available | Owner + T5/T2; kernel/licensing review when a route is proposed |

**Architecture implications:** Scene needs unplaced definitions, stable child occurrences, local frames, component resolvers, per-component capabilities and validated hierarchy edits. Independent lid/leg orientations require admitted 3D component transforms beyond current upright, floor-supported form placement; this is not merely a new gizmo. T1 needs scoped selection/picking and Camera-mediated entry/return. T5 supplies geometric source/evaluation. T3 owns project lifecycle/history and any asynchronous F.4 extension. T4 must separately admit native-form/assembly delivery; current publication refusal is not resolved by this proposal.

Current library items are capped at 256 KiB and 1,000 items per owner. Assembly storage needs explicit closure, deduplication and quota decisions rather than embedding unlimited children in that payload. Decorative columns may be object components; structural Layout subjects, openings and levels keep their architectural semantics and compiler.

An object project uses the existing F2 envelope and typed-resource architecture; a new root/scope capability is not a new semantic domain. Existing single forms must remain directly editable; promotion to an assembly preserves the placed root's identity and explicitly maps any changed addresses. Do not silently serialize Focus, selection, camera return state or evaluated meshes as object source. Retained editing operations are source and survive reopen; chronological Undo remains session state.

Pre-beta strict readers and old-library-item refusal remain the [owner's current compatibility policy](../../docs/reference/decisions/t5-object-focus-planning-2026-10-27.md#owner-amendment-reusable-native-objects). Dependable revision is a within-supported-format promise until a migration baseline is declared. No dependency or geometry kernel is selected here. Printable export would require explicit units, closed-solid/manifold validation and conversion tolerances; it would not certify structural safety or fabrication fitness.

### Suggested next decisions and proof

Approve the product model and bounded shell departures first; then commission T2/T5 plans together. Sequence useful capabilities as **Focus/revision → unplaced drafts and basic assemblies → retained solid operations/generators/patterns → richer reuse and precision**, allowing shared foundations to progress alongside P02. Do not make every advanced operation a prerequisite for standalone entry.

Before release, compare the current path with this design using a small beginner/experienced cohort:

- **15-minute plinth:** create, size, materialize, save and place it without needing hierarchy. Record completion, wrong-mode actions and recovery.
- **Standalone piano:** build independently editable lid, keys and wheels, save, reopen and place into two projects. Confirm the creator predicts which copies each edit affects.
- **Sculptural chair revision:** change an early profile after cuts/repetition; inspect or repair affected work without rebuilding unrelated components.
- **Ten-hour continuation:** return after history is gone, revise a named part, preserve its identity and reuse the result. Record repair time and destructive rebuilds.
- **Dense assembly and failure:** pattern hundreds of parts, remove an addressed member, cancel a slow operation, simulate a stale edit and reopen without caches. Measure latency/memory against the owning performance contract.

These are proposed validation tasks, not completed tests. The decision should turn on creative outcomes and revision reliability, not merely whether the new panels feel familiar.

## Artifact notes

Four authored PNG mockups accompany this proposal. They were generated and visually reviewed using the built-in image-generation tool; [prompts and targeted corrections](./mockup-prompts.md) are retained. Rendered shapes, icon details and sample dimensions communicate intent and are not production geometry, exact pixel specifications or tested accessibility evidence. No interactive prototype or production code is included.
