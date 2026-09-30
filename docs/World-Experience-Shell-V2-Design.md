# World | Experience — one spatial workbench

**Status:** opinionated design proposal for review and integrated Prototype V2, 2026-09-29. It is not a ratified shell contract, an implementation plan, or a claim about shipped behavior. The [World | Experience design context](./World-Experience-Design-Context.md), [North Star](./reference/north-star.md), [F contract](./reference/composition-execution.md), [Camera contract](./reference/components/camera-tour.md), and [PLATE shell and visual-system contract](./reference/design-system/editor-shell-and-visual-system.md) retain authority over their concerns. Current production still uses Scene | Camera and Plan | 3D until an explicit cutover.

## 1. Thesis and decision

**Keep the world in place; change the authoring intention around it.** World and Experience are two lenses on one continuously inspectable spatial stage. A creator should be able to point at a subject, work on it, and make it meaningful to a visitor without moving to another application, resetting the camera, or constructing an abstract content tree first. The lens switch changes the available edits and the surrounding index. It does not replace the renderer, spatial standpoint, selection authority, or project history.

The shell is a **spatial workbench with a contextual composition card**, not a pair of workspaces with matching panels. World makes source structure and intrinsic capability editable. Experience makes visitor meaning, Views, contextual behavior, and optional guidance editable. Preview takes over as a visitor session.

This is the direction I would carry into Prototype V2. It deliberately abandons the current Scene | Camera spine, the permanent Camera timeline, and the assumption that all authored concepts deserve a standing panel.

## 2. Information architecture

```text
Project
├─ World lens → Layout + Scene source truth, intrinsic capabilities
│  ├─ spatial subjects and their relationships
│  ├─ structures / levels / placed content / environment
│  └─ temporary inspection of the shared world
├─ Experience lens → select one Experience in the project
│  ├─ Presentations                 reusable visitor meaning
│  ├─ Interactions                  may be Experience-wide
│  └─ Guides, if authored           Stops are occurrences of Presentations
├─ Shared Camera authority → Views, routes, framing, projection, evaluation
├─ Shared typed resources → states, performances, media, definitions
└─ Preview / Publish → selected Experience and accepted revision
```

World is a lens, not a `WorldDocument`. Camera and resources are real authorities but need no peer creator application. A View is discovered through a Presentation, a saved inspection, search, or a route problem; its controls write to Camera. A reusable performance can be invoked from a Presentation without becoming Presentation content. One project can have multiple Experiences; the active Experience name is always visible in the head. Changing Experience keeps the shared World and spatial standpoint, while changing the Experience-specific index and composition context.

The primary creator objects are **subjects** and **Presentations**. Guides are optional compositions of Stops. The product does not create a Guide, a Stop, or a View checkpoint when a Presentation is created. A Presentation may focus on several subjects, a place, a relationship, the environment, or an authored viewpoint. Several Presentations can address the same subject. The Experience can contain global Interactions without a Presentation.

## 3. Shell composition

The following is a hierarchy diagram, not fixed pixel geometry. The [PLATE](./reference/design-system/editor-shell-and-visual-system.md) material, type, control, and state roles govern the actual design.

```text
┌ Project · save/undo ─ World | Experience · [Experience name ▾] ─ Preview · Publish ┐
│ INDEX                    │ SPATIAL STAGE                        │ WORK CARD          │
│ World: places, subjects  │ standpoint / level / scale             │ World: source edit │
│ Experience: Presentations│ contextual view trail + return        │ Experience: meaning│
│ Guide (if any), Offers   │ one selected subject / spatial overlay │ selected scope     │
│ Search across both       │ direct handles or View instrument      │ next useful action │
│                         │                                        │                    │
│                         ├ optional GUIDE DECK or DIRECTION DECK ┤                    │
│                         │ only while editing ordered occurrences │                    │
└ quiet project status · issue count · measured / authored / temporary state ┘
```

The **Project Head** holds project identity, save/history, the World | Experience intention switch, active Experience selection, Preview, and publication access. World | Experience is visually prominent but does not navigate to a different canvas. A lens change preserves stage pose, open spatial instrument, selected identity, and each Index's browse position. Preview is a separate takeover, not a third editing lens.

The **Stage** gets the largest share of space. Its edge hosts a small standpoint control, level/context readout, and a view trail. Building tools appear as a contextual instrument in World; View and capture controls appear there in Experience. The stage never becomes a dashboard of floating application panels. A contextual Section, unfolded wall, or ceiling view replaces/focuses Paper and has one explicit return crumb.

The **Index** occupies the left host when open. In World it shows spatial containment and placed subjects. In Experience it shows a searchable Presentation list, Experience-wide visitor offers, and a Guide entry only if one exists. It is a locator and relationship browser, not the property editor. Search spans both lenses and reports why a found subject is outside the current view. The selected identity stays visible in a pinned row when filtering or spatial occlusion hides it.

The **Work Card** occupies the right host when there is useful work. It is an action and explanation surface, not a permanent dump of all properties. Its header states the target and **edit scope** before a drag or field edit: `World source`, `Presentation`, `Camera View`, or `This Stop`. The card can collapse for spatial work; reopening restores its target. Only one exposed control writes each fact. A subject selected in Experience shows its World facts read-only with `Edit in World`, alongside `Present this` or `Use in this Presentation`.

The **bottom deck** is absent by default. Opening a Guide shows an ordered Stop deck. Opening precise direction or a coordinated performance replaces that deck with the relevant Camera or timing instrument. A Guide and a timeline are never both permanent furniture. The card and deck can be resized or collapsed; below dense desktop widths, secondary labels and metadata compress before identity, selection, stage, or the active instrument.

## 4. Selection, lens switching, and spatial navigation

There is one canonical **selected identity**. A World subject selected on the stage remains selected when the creator enters Experience; the Work Card changes from source editing to visitor-facing actions. If a Presentation or Stop is selected when switching to World, it remains the selected identity in a read-only bridge card until the creator explicitly selects a source subject. Its linked subjects can be highlighted as relationships, not falsely marked as selected. A sticky `Working on: [Presentation]` context may survive a subject selection; that is an authoring context, never a second selection.

The stage does not jump on a lens change. Selecting a Presentation in the Index locates its focus without silently moving the viewpoint. `Look through opening View` is the explicit spatial move. This prevents a dense Presentation list from turning every selection into camera travel. The inspection trail records standpoints and contextual view recipes, separate from Undo; Escape walks back one nested inspection, while the first crumb returns to the base standpoint. Source edits remain in project history when the view is put back. Temporary section cuts, unfolded geometry, selection, and editor-only visibility are never captured into visitor behavior by accident.

The standpoint control has **Plan** and **3D** endpoints with a continuous tilt between them. Plan is a measured view of the same model, not a second document or tool set. Near exact orientations, the picture settles and declares which axes are to scale; handles appear only where their own edit axis reads, while numeric entry stays available. In World, a selected wall/window/ceiling exposes `Face`, `Open`, `Look inside`, or `Look up` as appropriate. In Experience, the same temporary inspection is useful for choosing meaning and View intent, but authoring a visitor View requires explicit `Use this view` or `Save View`.

The desired Paper expression is the accepted dark spatial mat and vellum drafting sheet, with technical ink and restrained ochre selection. Chassis remains quiet, and instrument controls remain manufactured and compact. A view-only displaced wall is dashed slate; caution and refusal have separate language. Paper/grid/selection compose without turning ochre into a surface fill. This uses the [desired-from-demo PLATE target](./reference/design-system/editor-shell-and-visual-system.md#07-desired-visual-language--folded-from-the-accepted-p26-demo-2026-09-29); it does not claim the production editor paints it today.

## 5. Presentations: start from the work, then compose meaning

The ordinary creation action is **Present this**, attached to a selected subject, multi-selection, region, environment, or current viewpoint. The action creates a distinct draft Presentation focused on that context, selects the new Presentation, and opens its Work Card. The original subject remains visibly linked as focus, with a cue distinct from selection. The action never silently merges with an existing Presentation; the subject card first shows `Presentations about this subject` so the creator can reopen one or choose `New Presentation`.

The Work Card's first screen is not a wizard:

```text
Presentation · Why this piano matters                    [Preview this ▸]
Focus  Piano  + Add another subject
Meaning  [one title and a short explanation or media]
Show     Suggested framing  [Use View] [Use my view] [Keep visitor view]
Happens  [+ Use a supported action]
Visitor can  [+ Offer an interaction]
Guide    [Add to Guide]               (only a route if explicitly chosen)
```

These are composable slots, not mandatory steps or a fixed playback order. The creator can write meaning before selecting a View. `Suggested framing` is a temporary preview; `Use View` explicitly accepts a Camera-owned adaptive View. `Use my view` captures eligible parameters from the current inspection into a Camera View; it does not capture editor trails, temporary cuts, selection, or gizmos. `Keep visitor view` is an explicit entry policy, never a missing View fallback. A Presentation must have a declared entry behavior before its affected behavior can Preview.

Selecting a subject while working on a Presentation offers **Try control** and **Use in Presentation**. Try is temporary audition. Capture creates a contextual Activity against the subject's supported capability, with a visible source-versus-Experience scope. `Let visitors use this` is a separate Interaction and can be Presentation-contextual or Experience-wide. Unsupported behavior is not offered as if an imported mesh had semantic parts. The simple path shows a result and one sentence about its effect; start signals, boundaries, replacement policy, and timing appear only on `Direction details`.

Presentation browsing is a dense, searchable list with title, focus, Guide-use count, and issue state. A selected subject filters a relation view (`3 Presentations about Piano`) without moving or reparenting those Presentations. A selected Presentation expands its Views, Activities, and visitor offers in the Work Card, not as a permanently expanded left tree. This scales to many subjects and many Presentations without multiplying panels.

## 6. Camera and View exposure

Camera is a shared semantic authority with a **contextual product surface**. It is neither a top-level creator lens nor an Experience-owned copy. View controls follow four depths:

1. **Auto:** frame the focused subject or region with a Camera-owned adaptive View.
2. **Hints:** near/far, side, height, look-at and movement intent, shown as direct language.
3. **Use my view:** explicitly capture the current standpoint into a Camera View.
4. **Precise:** enter a focused Direction instrument with observer/target, lens/projection, route, anchors, motion profile and evaluated path. Return restores the author's previous standpoint and composition context.

The Work Card always identifies which Camera View is being edited and how many Presentations/Stops use it. A shared edit explicitly says `Update View everywhere (3 uses)`; `Change only here` creates a private Camera specialization/reference for that invocation. It never duplicates the Presentation or Guide order. A precise pinned View can report `Review framing` after World geometry changes; an adaptive View can recompute but still exposes the changed result for inspection.

Direction appears when a creator chooses travel, framing, a multi-View sequence, or route repair. A route-map instrument can overlay the stage to author canonical Camera connectivity. **Cut** chooses a View without inventing a spatial edge. **Travel** requires a supported Camera route; a missing route is shown as a gap with the choices `Author route` or `Use cut`. Runtime-generated node-view endpoints may be displayed but are not authored anchors. A timed score appears only for work that actually needs coordination; simple Presentations never open on a timeline.

## 7. Optional Guide and Stop editing

`Add Guide` is an intentional Experience action. Once a Guide exists, its Index row opens the **Guide deck**, a compact ordered strip of Stop cards. Dragging a Presentation from the Index or choosing `Add to Guide` creates one Stop referencing it. Repeating that action creates another Stop with a new occurrence identity and the same Presentation reference. No View inside a Presentation automatically becomes a Stop.

Selecting a Stop changes the Work Card header to **`This Stop · appearance 2 of “Why this piano matters”`**. Its ordinary controls are entry View or `Keep current viewpoint`, Cut/Travel, pacing, continuation, visitor choice, and a deliberate Gate. Its linked Presentation title and meaning are shown with `Edit shared Presentation (used by 2 Stops)`. Changes to explanation/meaning go through that shared Presentation. If only this occurrence truly needs different meaning, `Make a distinct Presentation` is an explicit fork with a new identity. If only its entry framing differs, `Change View for this Stop` specializes Camera intent without cloning meaning.

Default Next follows Guide order. An explicit branch or detour belongs to the Stop; a Presentation never acquires Previous/Next from where it is used. Autoplay readiness, manual Next permission, and a Gate are separately labelled. Manual Next remains available when a valid destination exists unless the author deliberately gates it; long narration or ongoing behavior alone does not lock it. A reused Stop's run/visit state is private each time it is entered.

For Prototype V2, I would make **promoting an interior View to a Stop** a deliberate `Make Stop from this View` action that starts the *same Presentation* with an entry framing override. It does not silently restart or seek its explanation. I would prototype this default and test whether people expect an explanation entry point; the meaning remains open until observed.

## 8. Preview and visitor context

Preview is a **visitor takeover** of the selected Experience, Presentation, or Stop. The entry button uses the current authoring context and offers a choice only when the entry is ambiguous. The authoring Index, Work Card, tools, gizmos, selection, and history are absent from the Preview surface. A small `Draft Preview · Exit` frame is the only editor affordance. Visitor navigation, content, captions, interactions, choices, and any Guide controls are the actual visitor program, not editor controls painted over it.

Before entry, the same semantic preparation used for delivery checks required bindings and supported behavior. An unresolved required reference blocks that Preview scope and links to its repair card; an unaffected explicit scope can still be previewed. A draft may retain an unresolved binding for repair, but publication requires executable closure. Preview runs on detached session state and never writes visitor choices or behavior results to World or Experience source.

The visitor always has an understandable location: active Presentation, current Stop when guided, and the available actions. Following direction, a visitor may choose **Explore freely**. This releases guided Camera control and pauses autoplay without ending the Experience or mutating World truth. World interactions remain available according to their authored scope. **Return to Guide** states the target Stop before moving; from the actual current pose it uses a supported Camera route or an explicit Cut policy, never an improvised path. Rejoin leaves autoplay off until the visitor enables it. Persistent Activities follow their declared lifecycle; Camera movement alone does not replay them. Exit Preview returns to the exact authoring lens, selection, Work Card, spatial standpoint, and open inspection context, with visitor-only state discarded.

For Prototype V2, I would start detours by **pausing the parent explanation and automatic viewing**, retaining its invocation and letting already-running subject Activities follow their own declared boundaries. Returning resumes from the actual pose without replaying entry. This is an experimental visitor/creator default, not a ratified execution policy; the prototype must test whether pausing, continuing, or restarting better matches expectation.

## 9. Progressive disclosure and failure cases

| Situation | Surface response |
| --- | --- |
| First useful Presentation | Subject → `Present this` → explanation → accept a View or choose keep-current → Preview. No Guide, duration, route graph, or lifecycle form. |
| Skilled composition | The same Work Card reveals View hints, Activity scope, visitor offer, and reuse counts at the point of use. |
| Precise direction | Direction instrument on the same stage; Camera-owned pose, projection, route and movement; optional score only when temporal coordination is needed. |
| World subject moved | Adaptive framing is recomputed and inspectable; pinned framing is flagged for review. Presentation identity and explanation remain. |
| Subject/capability removed | The affected binding shows original identity and typed failure. Presentation and Stop survive. `Relink`, `Remove use`, or keep the explicit unresolved draft; no nearest-name retarget. |
| Many items | Index search, filters, compact rows, relation counts and selected-item pin. Guide deck can collapse/group while keeping Stop identities and order legible. |
| No Guide | No Guide deck. Direct Presentation entry, visitor exploration and Experience-wide Interactions remain first-class. |
| Several Presentations on one subject | World selection displays the relation set; new meaning gets a new Presentation ID, never overwrites an existing one. |
| Lens switching during a section or wall face | Stage recipe and standpoint persist, and source selection remains coherent. Experience can explicitly save eligible Camera intent without serializing the editor-only opening. |

Advanced controls do not require an `Advanced mode`. They appear when a chosen behavior creates a real question: travel needs a route, a shared View needs edit scope, a timed Activity needs lifecycle, a Guide branch needs continuation. Refusal is local and gives a recovery action; warning is not styled as refusal; view-only displacement remains distinct.

## 10. Journey pressure tests

### Build → present → preview

1. In **World**, draw or place a subject while orbiting, tilting toward Plan, facing a surface, or opening a contextual cut. Handles and measurements remain tied to the selected source identity. The view trail records where the creator stood; Undo records accepted source edits.
2. Select the subject. The Work Card shows World properties and the related Presentations. Choose **Present this**. The stage stays at the current standpoint and the lens changes to Experience. The new Presentation becomes the canonical selection; the subject is shown as linked focus, not as a second selection.
3. Write why it matters. Compare a suggested Camera framing with the current inspection, then explicitly accept or capture a View. Try a supported subject operation, capture it as an Activity, and optionally offer it to visitors. Each step says whether it edits World source, Camera View, or this Presentation.
4. Choose **Preview this Presentation**. The editor chrome gives way to visitor content; the subject behavior runs in a detached session. Exit returns to the same section/standpoint and the same Presentation context. No Guide has been created.

### Reuse a Presentation at two Stops

1. In Experience, select `Why this piano matters` and choose **Add to Guide**. The Guide deck opens with one Stop. Add the same Presentation after the Paris Stop; the deck now shows two appearances with separate Stop IDs and a shared Presentation reference.
2. Select the second Stop. Change only its entry to a close View, adjust its pace, and make its Next target explicit. The Work Card says `This Stop`; the shared explanation stays untouched. If the close View is reused, `Change only here` specializes the Camera View reference for this occurrence.
3. Opening the Presentation shows the common meaning and its two Guide uses. Editing that meaning offers a visible impact count. To tell a different story at one Stop, the creator deliberately forks a new Presentation.

### Guided visitor → exploration → interaction → rejoin

1. The visitor reaches a Stop through a supported Camera route. The Presentation explains the subject; Next is available unless a deliberate Gate says why it is blocked.
2. The visitor chooses **Explore freely**. Guided Camera control and autoplay release; the visitor operates an authored World interaction. The active Presentation/Stop stays locatable in a small visitor context, and any ongoing Activity obeys its own lifecycle.
3. The visitor chooses **Return to Guide**. The interface names the target Stop and uses Camera's supported return travel or the authored Cut policy from the actual current pose. It does not replay entry effects or turn the visitor's operation into a World edit. Autoplay remains paused; Next or an explicit choice continues.

## 11. Evidence taken and assumptions retired

| Evidence | Keep / modify / retire |
| --- | --- |
| [Production EditorApp](../apps/editor/src/lib/editor/app/EditorApp.svelte) and live editor | **Keep:** canonical selection coherence, direct Plan editing, typed Inspector values, collapse/focus options, project save/history, and Preview's detached return record. **Retire:** Scene | Camera as the creator axis, Camera-only graph/timeline host, fixed three-column Inspector as the only way to act, and `Spatial`/`Publish` as the implied top-level product model. Current Camera data and preview preparation remain implementation cutover concerns. |
| [Spatial prototype](../prototypes/spatial-authoring/README.md), [journeys A–F](../prototypes/spatial-authoring/rationale.html#journeys), and live session | **Adopt:** one continuous standpoint, selection through nested inspection, exact return, view trail distinct from Undo, measured editing wherever legible, find-with-occlusion reason, physical open/settle, and the accepted mat/vellum direction. **Modify:** its current Scene spine and Plan/3D tab presentation become a smaller continuous standpoint control. **Reject as contracts:** analytic geometry, tiny-FOV orthographic stand-in, whole-model history, prototype key bindings and any duplicate Layout/Camera evaluation. Its older blue-selection prose is superseded by PLATE's desired ochre selection. |
| [Experience prototype](../prototypes/experience-authoring/README.md) and live authoring/Preview | **Adopt:** subject-first creation, independent Presentations, explicit View capture, trying a capability before capturing it, optional Guide, repeatable occurrence identity, only-here versus shared scope, and free exploration/rejoin. **Modify:** the visible Encounter form becomes a composition card; the Guide strip appears only when needed. **Reject:** permanent World+Experience outline, tiny central scene, repeated form fields for simple work, authoring chrome in Preview, prototype Camera interpolation/use dictionaries and last-command-wins shortcut. |

I considered a literal World workspace beside an Experience workspace, a single enormous mixed entity tree, and a permanently visible storyboard/timeline. Each makes an important behavior harder: the first loses spatial continuity, the second confuses source and visitor meaning, and the third makes a Guide look mandatory and steals the stage. The chosen shell keeps these structures available only when the creator's current action calls for them.

## 12. Prototype V2 evidence required

Build an integrated prototype around **one project with a real spatial stage**, not side-by-side screenshots. It must support selecting a World subject, lens switching without camera reset, creating and reopening two Presentations about it, accepting/capturing a View, trying/capturing a supported action, an Experience with no Guide, repeated Stops, only-this-Stop editing, free exploration/rejoin, and an explicit missing-reference repair state. Instrument the current selection, working Presentation, stage recipe, authored unit touched, and visitor invocation so failures are observable rather than inferred from visuals.

The two open behavior trials are: **(1)** whether `Make Stop from this View` should change entry framing alone or establish an explanation checkpoint, especially on an out-of-order visit; **(2)** whether detour should pause the parent explanation and automatic viewing or use ordinary departure/re-entry. Test each with a creator predicting the result before Preview and a visitor experiencing it; record surprise, not only preference. Also test whether creators understand the Work Card's scope before changing a shared View or second Stop, whether the same stage remains intelligible across repeated World | Experience switching, and whether the Index/deck still work with dozens of subjects and Presentations at 1280×768.

The shell direction is settled for this proposal: **one spatial workbench, two authoring intentions, contextual composition, optional guidance, and visitor-only Preview**. Prototype V2 should challenge its interaction details, not revert to two permanent applications by default.
