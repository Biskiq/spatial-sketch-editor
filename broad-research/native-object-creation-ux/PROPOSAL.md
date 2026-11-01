# Native object creation: one Stage, a continuous journey

**UX proposal · PR #244 review revision · 2026-11-01 · owner review**

Reviewed independently against merged `main` at `239ab893`, including R217.S17A and S19. Research documentation and static artwork only: no contract ratification, implementation, release or roadmap change. [Visual storyboard](./STORYBOARD.md) · [PNG and prompt provenance](./mockup-prompts.md).

## Recommendation

**Make Object Focus a deliberate change of editing scope within the existing World environment.** A selected object offers **Edit object**; **New object** opens the same scope without a placement. Both lead to the same selection language, tools and contextual Card. Returning to spatial composition is visible and predictable.

Keep World | Experience as the lenses. “Object Focus” identifies scope, not a third application. A form is useful immediately in World; parts and deeper shaping appear when requested. An ambitious object can grow into a piano or sculptural chair without restarting elsewhere.

The earlier proposal showed destinations better than transitions. This revision removes its prescriptive operation tables, storage model and fixed Focus snap settings. The advanced chair and piano remain ceiling illustrations, **not approved tool specifications**. Fifteen minutes and ten hours are ambitions, not measured outcomes.

![Two entries converge on Object Focus, then return to World or save, resume and place a draft.](./figures/11-journey-map.png)

## Evidence and the actual gap

Creators need to discover deeper work from an ordinary selection, recognize their object after entry, understand which part an edit affects, and leave without losing their place. Standalone creation also needs a clear draft/reuse lifecycle. Isolation alone solves none of these.

| Status | Evidence and consequence |
| --- | --- |
| **Shipped — P01 and S17A** | [P01 closure](../../docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/README.md), [S17A acceptance](../../docs/roadmap/r217-core-editor-stability/r217.s17a-shape-drawing-simplification/acceptance.md), [owner decisions O10/O11](../../docs/roadmap/r217-core-editor-stability/post-s10-convergence/owner-decisions.md): Pen/Ink is architectural; Objects unifies Box, Round, Free, Sphere, available Models, My Objects and Import. No Room is required. |
| **Shipped — creation/selection** | [Objects instrument](../../apps/editor/src/lib/authoring/adapters/scene/SceneTransformInstrument.svelte), [commit adapter](../../apps/editor/src/lib/authoring/adapters/scene.adapter.ts): creation selects the form **and reopens placement**; it does not automatically switch to Select or Focus. The current form Card has no Edit object action. |
| **Shipped — bounded reuse** | [My Objects](../../apps/editor/src/lib/authoring/adapters/scene/library/MyObjectsSection.svelte), [Scene contract](../../docs/reference/components/scene-content.md): single-form snapshots insert independent copies. Imported models are whole-model subjects; render children are not editable authored parts. Assemblies and standalone object drafts are not shipped. |
| **Planned — P02** | [T5 umbrella §6.3](../../docs/roadmap/t5-expressive-geometry/umbrella-plan.md#63-t5p02--object-focus-refine-and-shape-planned): selected-form entry, sections, outline revision, shaping with explicit reach/acceptance, and return. It does not deliver assemblies or a standalone lifecycle. |
| **Ratified — shared authorities** | [Architecture](../../docs/reference/architecture.md), [PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md): one Stage, canonical selection, Camera, source history and Card writer; distinct Scene/Layout/resource responsibilities. World Index is a scope locator, not an outline tree. |
| **Proposed here** | Edit object discovery, contextual entry/return, unplaced New object, focused Parts navigation, draft discovery and direct editable-copy entry. All await owner judgment and owning-track design. |

Current [dock source](../../apps/editor/src/lib/authoring/stage/shell/StageDock.svelte) and O10/O11 govern the mockups. Older Ink → Shape instructions and shell rosters are historical. Retained [shaping](../../prototypes/native-object-shaping/UX-SPEC.md), [Form Lab](../../prototypes/native-form-lab/FINDINGS.md) and [composition](../../prototypes/object-composition-prototype/README.md) studies inform reach, revision and reuse; none is a production contract.

## Alternatives reconsidered

| Model | Benefit | Weakness exposed by the journey |
| --- | --- | --- |
| World only, with isolation | Immediate contextual creation | No independent start, saved draft or component navigation |
| Separate Studio application | Clear standalone identity; specialist space | Transfer and divergent selection/save/navigation can divide one creative task |
| Separate part and assembly workspaces | Explicit edit reach and structure | Workspace decisions precede a simple object's need for them |
| **Shared Stage, scoped authoring** | Direct and standalone entries converge; depth grows in place | Scope, lifecycle and return must be explicit; renaming isolation is insufficient |

Standalone entry need not duplicate infrastructure. Sharing a Stage does not itself guarantee coherence. The recommendation depends on the following transitions, not the “Studio” name.

## A. World first: create, deepen, return

1. **Objects → create.** Keep S17A gestures: Box/Round click for standard size or drag a footprint; Free draws/clicks an outline and finishes deliberately. Height is a subsequent Card/ray edit. No name, hierarchy, library save or Focus visit is required. Sphere and models retain their own capabilities.
2. **Select → discover Edit object.** The new form is selected while Objects remains armed. The proposed native-form Card action is visible beside ordinary work, with Find/context-menu equivalents. Choosing it ends clean placement and enters Select in Focus; unfinished drawing must first finish or cancel. Never auto-enter Focus after creation. Simple work can stop here.
3. **Enter with recognition.** Preserve identity, placement and viewing angle. Camera may frame closer without relocating the object to an origin. Surroundings become muted, read-only reference; **Context: muted** can hide/show them without enabling picking. The scope strip names the object and **Back to World**. World lens and project identity stay unchanged. [05 → 06](./STORYBOARD.md#a-world-first-entry).
4. **Refine deliberately.** Start with the selected form and familiar Card. **Edit shape** opens the supported P02 task; entry does not automatically open a section or advanced operation view. A section is another reading of the same subject, with one active gesture target and one Card writer. Apply/Discard concerns the pending edit; leaving a task is not Undo. Section layout and tool semantics remain open.
5. **Add parts when useful.** **Add part** opens the same Objects surface with **Add to: [scope]** visible. Touching forms do not silently fuse. Parts grows as components are added; a single form needs no component setup. Select the whole object to act on the complete result, or a named part to refine only it. [06 → 08](./STORYBOARD.md#common-focus-whole-object-or-part).
6. **Back to World.** Restore the previous Camera viewpoint/reading, World location and Index disclosure, with the whole root selected. Applied edits remain; placement is unchanged. Restore a previously open Objects browser without an armed choice and return with **Select** active. Do not unexpectedly resume creation or a destructive tool. [08 → 09](./STORYBOARD.md#return-is-a-context-restoration).

Returning from an existing World object never inserts another copy. With a pending edit, offer **Apply & return**, **Discard change & return**, or **Continue editing**; invalid work cannot apply. Discard affects only that pending change. Esc cancels/unwinds the innermost task. If the subject or former World location disappears, resolve to the nearest valid scope and explain, rather than restoring stale selection.

## B. Standalone: first shape, continued draft, placement

1. **Objects / My Objects → New object.** Open empty Focus with **Not placed** and an origin-specific return label. No naming wizard or World placement. **Back to My Objects** returns to the library; a World-origin draft offers Back to World. An empty draft can be abandoned without a save ceremony.
2. **Create the first shape.** Objects is already open; there is no second central shape chooser or object Pen. No geometry means no selected-part Card. Use familiar click/draw/Finish gestures. Free drafting uses the active workplane reading and remains pending until accepted. [01 → 07](./STORYBOARD.md#b-standalone-entry-and-first-shape).
3. **Converge on the same Focus.** The accepted form becomes selected with the same sizing, Edit shape and Add part actions as journey A. Objects can remain ready for creation; selecting/refining is deliberate. Rename and size when useful. A neutral Stage replaces muted World surroundings; selection, Parts and Card behave identically. [10 compared with 06](./STORYBOARD.md#b-standalone-entry-and-first-shape).
4. **Save and resume.** Head **Save** preserves accepted work through the project lifecycle. Proposed **In progress** in My Objects locates saved object drafts; **Resume** reopens the object in Focus. Show saved/unsaved state. Do not promise autosave or persistence of session Undo, temporary selection or pending previews. Leaving nonempty unsaved work uses the existing save/leave guard; return itself does not save.
5. **Place when ready.** **Place in World** chooses a destination, opens ordinary World placement preview and accepts on click. Recommend an independent placed copy, clearly labelled, so later draft edits cannot silently change a composed World. Cancel keeps the draft; Undo removes the accepted destination insertion. Save before switching projects. Project/resource transport remains owning-track design, not a schema decision here.

The result has ordinary World root selection and Edit object; later refinement follows journey A. An in-session draft may return without placing anything. A saved draft remains findable even if never placed.

## What stays consistent, what changes

| Surface | Consistent | Focus change |
| --- | --- | --- |
| Head | Project, lenses, Find, Save and history | Scope strip adds object identity, placement state and return |
| Stage / Camera | Same renderer, navigation authority and selection marks | Object framing; read-only World context or neutral unplaced workplane |
| Index | Locates scope; selection matches Stage/Card | **Parts** navigates this object only; a proposed bounded exception to World's no-outline-tree rule |
| Card | Selected identity and sole ordinary numeric writer | Supported Edit shape / Add part / part identity; advanced tasks on demand |
| Lower tools | Objects remains creation entry; familiar order and gestures | Architectural Ink is absent, not repurposed; Select, Measure, Eraser and Objects remain, with task-specific controls |
| Precision | Exact numeric entry and visible units/frame | Object/part/workplane context is explicit; no new snap defaults or tolerances approved |
| History / saving | Accepted source edits and explicit Save | Scope changes are navigation; no separate modeling history or persistence authority |

**Whole versus part must be visible.** Root selection acts on the whole object; child selection highlights that part and names its parent in the Card. Parts supports nested disclosure, search and keyboard navigation. Breadcrumb/up returns to the containing object, distinct from Back to World. Selecting a part does not automatically move Camera. Add part targets the explicit active object/assembly scope, not whichever leaf is selected.

Shared-use edits must disclose reach before acceptance; ordinary selection cannot silently alter every reused copy. Component, grouping, pivot and reuse architecture is deferred. Separately addressable parts remain a product requirement so a future lid can move independently; no animation UI is proposed.

## Saved and imported objects: capability before affordance

| Entry | Supported or proposed path |
| --- | --- |
| **Saved native form** | Shipped **Insert copy** → World selection. Proposed Edit object then opens P02-supported refinement. |
| **Direct library refinement** | Proposed **Open editable copy** → new draft in the same Focus. The immutable snapshot stays unchanged. This replaces the ambiguous “Open for editing.” |
| **Reusable result** | **Save to My Objects** already saves single-form source snapshots. Complete assembly saving is future capability. Draft and reusable snapshot have distinct actions. |
| **Imported whole model** | Today: placement and supported whole-model transforms. Proposed **Inspect object** may use the same scope host, labelled whole-model/inspection only; no native Edit shape, inferred Parts tree or invented operation history. Deeper editing requires explicitly admitted capabilities. |
| **Unsupported / old item** | Explain refusal and retain available recovery/removal actions. Do not fabricate an edit path. Current pre-beta [compatibility policy](../../docs/reference/decisions/t5-object-focus-planning-2026-10-27.md#owner-amendment-reusable-native-objects) remains unchanged. |

## Integration and owner judgment

**Keep:** S17A Objects and Room-free creation; P01 direct manipulation and supported copies; R217 convergence; P02 bounded form refinement and per-edit acceptance; PLATE shared authorities and compact surfaces. Advanced illustrations do not expand P02.

**Reconsider through owning tracks:** T1 scoped navigation/selection and Camera-mediated return; T5 supported refinement tasks; T2 object composition and reuse; T3 standalone draft discovery/save. A piano needs more than shell changes. This package specifies no component schema, geometry kernel, modifier semantics, publication admission or new phase sequence.

| Owner UX decision | Recommendation |
| --- | --- |
| Visible entry | **Edit object** on capable selected subjects; no automatic Focus or mandatory tutorial |
| Surroundings | Muted, non-pickable context by default; optional hide/show; no relocation |
| Navigation | Bounded Parts view; canonical whole/part selection; Add part names its destination |
| Standalone lifecycle | New object and saved draft discovery; separate Resume, Open editable copy and Insert copy |
| Return / placement | Restore World with Select active; return existing placements in place, place unplaced drafts explicitly as copies |
| Sections | One active reading initially; review optional inset versus full-Stage section during P02 UX work |
| Advanced ceiling | Keep chair/piano as depth tests; approve individual tools and composition semantics separately |

Review **transitions**, not just screens: can a beginner make and size a plinth without Focus; enter/exit without losing place; finish a standalone form and recognize the editor; select a part and predict reach; resume a draft; distinguish a library copy from an imported model? Later, test piano/chair revisions over hours. These are proposed research tasks, not completed usability evidence.

The [storyboard](./STORYBOARD.md) labels every PNG's role and status. Narrow layouts should collapse Parts and reveal Card on demand, with keyboard/touch equivalents. Desktop artwork does not establish responsive, accessibility or performance acceptance.
