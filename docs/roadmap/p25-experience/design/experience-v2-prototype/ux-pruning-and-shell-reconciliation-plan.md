# Experience V2 — composition UX pruning and shell reconciliation

**Status: proposed; ready for owner implementation review. Planning only.**
This document authorizes no implementation, commit, merge, phase closure, Paper work or
production cutover. It defines the dedicated prototype UX slice following C9 capability
acceptance. Its product amendments require acceptance of this plan; they are not silently
promoted into PLATE. PR placement is not assigned.

**Inspected baseline:** `056ae3f9f1c200517a4ad132cab376e0ed29387d`, with a clean working
tree before this planning task. Current executable: [spatial-authoring][prototype].
The [C9 plan][c9], [C9 evidence][c9-proof] and [current baton][current] agree that C9.1–C9.5
are implemented, MP2 is accepted, MP3 is pending, and C9.6–C9.9 are not started. “C9 proved
the machinery” does **not** mean C9 is complete. The executable README's older “C9 is
unstarted” description is stale implementation evidence, not the status authority.

**Execution dependency:** retain the approved C9 sequence through MP3, revision/repair,
rich coordination, C9.8 precision and MP4 capability acceptance. Then implement this
slice against that accepted executable. Do not absorb unfinished C9 into this plan or
rerun its implementation from the inspected baseline. Reconcile only the source/QA
changes actually landed since this audit before beginning UX1. In particular, reuse
C9.8's concise Camera surface and C9.6's repair operations. Paper remains separately gated.
The design is **not wholly waiting for C9**: the stable information homes can be
ratified now and guide C9.6–C9.9 implementation choices. §8 records the exact dependent
APIs/proof that remain provisional, without changing C9 semantic scope or its checkpoints.

## 1. Intended product and evidence reconciliation

The ordinary Experience surface composes **visitor-facing moments**. A Presentation
answers what this encounter is about; its unordered **Views** show Camera compositions,
with a **Default View** describing how it normally opens. An optional **Guide** orders
distinct **Stops**; a Stop may override entry, and its transition references Camera
support. The author moves between these questions without opening a scripting dashboard.
Narration, behavior and visitor participation remain real capabilities, reached through
deliberate operation flows and one invoked advanced-authoring home.

This is a low-floor authoring model, not a reduction of Experience to static states or
an endpoint-only execution model. Presentation focus is not a container, a Camera
target binding or an organizational parent. A Museum moment, Rotunda moment and Painting
moment can be peers in a Guide. Layout/Scene owns their spatial relationships; Guide
owns editorial order; Camera owns viewing intent and movement.

### Evidence used, and what it establishes

| Inspected evidence | Finding and implication |
| --- | --- |
| [PLATE][plate], Authority/invariants, shared shell, Experience expression, visual/state grammar, return and responsive sections | Accepted Head–Index–Stage–Card continuity; one selection/writer/history; quiet ordinary context; unordered spatial Set; one shell-owned lower Deck, fisheye Guide and Seam; Preview in Head; role-based material/type/state. These survive pruning. Some exposure choices below deliberately amend its current Experience expression. |
| [Shell ratifications][ratifications], especially authority and reusable guards; P23.14 [closeout evidence][p23-qa] | Roles, control ownership and visible focus are settled. Older shell dimensions and historical A–D PNGs are evidence, not new prototype goldens. Closeout does not establish fresh V2 screenshot coverage. |
| [Ratified direction][direction-ratification]/[World–Experience amendment][lens-amendment]; [North Star][north-star], Composition/behavior/direction and ownership; [architecture][architecture]; [Camera contract][camera-contract]; [F][foundation] F.1/F.2/F.4 | Broad Presentation focus already fits the direction. Camera and Experience remain distinct. Aggregate explicit authoring is legitimate; the prototype's snapshot command is not a production F implementation. |
| Accepted [V2 synthesis][v2-design]/[boards][v2-boards], accepted [World shell][world-design]/[QA][world-boards] | Useful spatial View constellations, quiet Card, real fisheye Guide, central Seam, on-demand locator and spatial Camera instrument. Preserve these compositions, rather than copying every raster button or label. |
| [C9 plan][c9]/[evidence][c9-proof], [C1–C8 conformance][conformance]/[acceptance][conformance-proof] | Narration, audition/capture, lifecycle, visitor choice and Travel are real. The ordinary narration field is not fake. Detailed density was explicitly assigned to this later slice. Removal and later rich-fixture acceptance are unfinished at the audit baseline. |
| [Experience commands][experience-code], [model][model-code], [capabilities][capabilities-code], [UI][experience-ui], [navigation][navigation-code], [Camera kernel][camera-kernel] | Existing focus variants, entry/choice roles and Stop overrides suffice. Descriptors already have labels/control metadata. Recommended framing currently fits only a first-subject point with fixed height. View speed is consumed by runtime, despite its poor product home. |
| [Current QA guide][qa], creator/conformance/reconciliation/browse/responsive scripts; [repository test contract][tests] | Existing behavioral, geometry, picking, narrow-sheet and mutation proof is valuable. It does not protect the pruned visible-control inventory, visual thumbnails, no-scroll core density or advanced disclosure. Production shell tests inspect production components, not this static prototype. |

A live browser audit of this exact baseline confirmed: Present this creates only a
Presentation, leaving zero authored Camera Views and a derived badge; the subject Card
renders all capabilities; Search refuses in Experience; Plan → 3D adds `3D › Plan › 3D`
to the visible trail; a fresh narrow Card is an accordion stack with naming/narration
above the composition actions. The task-owned browser/server were closed. Temporary
audit captures are corroboration, not acceptance goldens; the retained PNGs below remain
the reviewable repository evidence.

The additional Guide audit used a real one-Stop creation flow and the existing six-Stop
conformance fixture. `experience-ui.js` currently supplies **three Preview Guide
buttons** in ordinary selected-Stop posture: Index, bottom rail and Card. The ordinary
rail names Stops only by number; Card repeats entry, shared Views/meaning and an Expand
door. Overview repeats Expand on every occurrence. At 1024×768, expanded Guide plus
Card exposes seven Expand buttons, a 37.2%-height Deck and a long Card, despite passing
the existing `<40%` geometry guard. Sparse and expanded panels waste space; selector
reach alone is insufficient. `reconciliation-check.sh` closes the expanded Deck before
testing narrow Card Entry, so its pass does not prove simultaneous reachability.

### PNG audit and reconciliation

| Inspected image family/state | Judgment used by this plan |
| --- | --- |
| Archived P23.14 `PLATE-1.png`, `PLATE-4.png`; retained `gallery/Camera/camera-3d-framing.png` | Keep quiet chassis divisions and truthful rig/frustum context. Their permanent Scene/Camera inventory, global timeline and legacy ordering are superseded for destination Experience. |
| World QA `01-world-ordinary-piano.png`, `02-world-dense-search-recovery.png`, `08-experience-foreign-world-piano.png`, `10-world-narrow-unroll.png` | Keep restrained selection, honest foreign identity, on-demand subject search, visibility reasons, separate Select/Bring into view, and compact identity/location sheets. Amber active-lens styling in generated boards is recorded drift; PLATE's neutral lens state wins. |
| V2 boards `Museum Piano Hall Tour Editor.png`, `Museum Tour Planner Interface.png`, `Museum Guide Planning Dashboard.png` | Keep quiet View inventory plus unordered spatial constellation; shallow Guide awareness; useful L0/L1/L2 density and distinct occurrence identity. Retain read-only L2 comparison at deliberate depth, without permanent Expand controls. Thumbnail rows must not imply View sequence. |
| V2 `Museum Floorplan Route Editor.png`, `Museum Hall Tour Dashboard Mockup.png` | Keep Seam bookend–instrument–bookend, honest multi-origin gaps and invoked mirrored coordination. Path geometry stays on Stage. |
| V2 `Under the Lid_ Hall Tour Editor.png`, `Museum Camera View Editor.png`, Ask companion `Museum Tour Editor Interface.png` | Keep direct framing/observer/target, one active tape, editor chrome and explicit return/reach. A pictured circle or lens label does not establish an orbit constraint or independent lens operation. |
| Retained [current conformance PNGs][current-pngs]: ordinary, route, Through/Outside, Plan/resume, narrow Card/precision/Guide | Structural homes exist, but text inventories, repeated controls and six-property Camera clusters obscure the image. The narrow precision cluster covers the framing gate's upper-right area. Earlier pass labels do not accept C9's later density. |
| Local regenerated C9 `qa/out/creator-check/c9-creator-narrow.png` and current conformance/precision captures | Confirm the capability inventory and narration/advanced-stack growth after earlier specimens. Local regenerated captures lack a new accepted visual packet; do not treat their existence as acceptance. |
| Donor `review/captured-edit-stale-confirmed.png` | Preserve operation-specific audition/capture and revision behavior; do not transplant the donor dashboard or Experience-owned Camera machinery. |

The historical images above were inspected through the routed evidence families. They
are not an instruction to reopen archived design or reproduce old pixel dimensions.

### Disposition of the peer proposal

| Proposal item | Recommended disposition and reason |
| --- | --- |
| 1. Presentation is a visitor-facing moment with broad focus | **Accept.** Subjects, region and environment already exist. No Presentation hierarchy, container or new schema is needed. Intentionally unspecified/abstract focus is destination scope, not a new prototype variant. |
| 2. One Present concept | **Accept, with supported context only.** Generic Present captures composition; Present this supplies a subject recommendation. No permanent species menu. Scalar selection does not support Present selection today; do not invent multiselection as part of pruning. |
| 3. Usable View immediately; generic captures viewport | **Accept as an explicit aggregate command.** Present is the author's capture acceptance. This changes the separate C9 derived→Capture ceremony; lens switching/inspection still authors nothing. Recommended framing must be Camera-owned and useful, rather than the current fixed guess. |
| 4. Remove persistent Scene inventory | **Accept only after locator coverage is repaired.** Current Search refuses Experience and excludes capability fixture subjects. Stage is primary; occluded/logical/keyboard subjects still need a complete fallback. |
| 5. Identity/actual uses, then operation chooser | **Accept.** Existing descriptor labels, controls and constraints suffice. No new grouping/priority schema is justified by the bounded chooser. |
| 6. Aggressively prune Presentation Card | **Accept the smaller composition Card; modify removal claims.** Move real narration, authored behavior and repair reach into deliberate disclosure. Do not discard them as unfinished or hide their existence. Name belongs to one lightweight rename writer, not a permanent field. |
| 7. Views and Default View; visual representation | **Accept as UX remapping.** Keep internal entry/choice roles and unordered Stage constellation. Preserve valid existing zero-View moments; only new ordinary Present guarantees a Default. Selection is neutral; Look through is explicit. |
| 8. Spatial Camera editing | **Accept with bounded Camera work.** C9.8 already requires direct Stage grips, Camera Card detail, one active tape, postures and return. Consume that result instead of building another editor. Current observer/FOV are derived from a compact pose; do not promise independent free-eye/lens editing or make a new inverse/gizmo API a prerequisite. |
| 9. Pace belongs to movement/connection | **Accept the information home; reject blind data migration.** Hide ordinary View speed. Existing View speed still drives edge-free framing requests and estimates; preserve that runtime behavior. Normal Travel pace is authored once on the selected Camera connection. |
| 10. Guide sequences peers, not Presentation hierarchy | **Accept.** Repeated Stops retain distinct occurrence/visit identities. Spatial containment never creates a Presentation parent. |
| 11. Separate composition and scripting | **Accept immediate disclosure separation.** One contextual Advanced authoring task preserves existing writers. Do not design a new scripting document, workspace, language or execution system. |
| 12. Trail, history and selection cleanup | **Accept with two qualifications.** Keep local procedural/spatial return while removing routine view-mode trail. Keep a legible contour/quiet tint, including an accessibility halo where needed. This prototype has no persistence operation: replace its fictitious Saved/count status with honest Session only, rather than inventing Saving. |
| Follow-up: one ordinary Guide and one deliberate deeper posture | **Accept.** The existing lower Deck is the right home; replace number-only Peek with named compact Stops, rename Overview to Edit Guide, merge useful L2 comparison into that posture, and remove ordinary Expand. Stop occurrence controls belong only in Card. Preserve accepted fisheye and spatial projections at deliberate depth. |
| Follow-up: Preview next to the Guide rail | **Modify.** PLATE assigns Preview to the shared Head, and the runtime supports Presentation, Guide and Experience entry. Use one explicit Head Preview Guide primary when a Guide exists, with other supported scopes in its menu. No duplicate Guide Preview in Index, Deck or Card. See §6 for the complete placement and command decisions. |

### Explicit exposure amendments proposed for approval

Acceptance of this plan should expressly approve these changes to PLATE §0.8.1/C9
authoring exposure for this prototype: composition-first ordinary Card; narration and
behavior writers reached deliberately; Present as aggregate first-View capture;
Auto/Hints retained as invoked recommended-framing options rather than a compulsory
ladder; Views/Default View ordinary language; removal of View movement preference from
ordinary UI; named compact Guide, Edit Guide/Compare Views exposure instead of ordinary
Peek/Overview/Expand commands; shared Stop editors removed from the occurrence Card;
Head-only scoped Preview; existing coordination summarized until Coordinate is invoked.
Keep Set semantics, Scale × Depth, shell-owned Deck compositions, optional L2 schematic
and spatial Views, scope/Ask, Camera ownership and all proved execution unchanged.
The proposed change from PLATE's “existing coordination exposes the strip” to a quiet
summary is an explicit disclosure amendment, not a claim that the current contract
already says this. Do not edit the reference contract to
describe these proposals as shipped; any durable destination amendment is an explicit
owner promotion, separate from prototype implementation.

## 2. Information homes and surface inventory

Every fact has one writer. A relation/summary may open that writer; it must not mount
a duplicate control. Selection is one `S.sel`/`A.select` value, distinct from the working
Presentation, task target, Search highlight and operation draft.

| Concept | Ordinary home | Deliberate depth / writer |
| --- | --- | --- |
| Scene subject selection | Stage picking; shared Head Search opens Index locator | Same locator provides browse/keyboard/overlap recovery and Select. No separate Experience object selection. |
| Presentation identity/name | Experience Index row; stable Card title | One inline row rename editor, reached from row context action or Card menu; both open the same editor. |
| Focus | Quiet named metadata on Presentation Card | Change focus task in its menu; selects references or defines area using supported focus operations. Selecting/focusing references does not navigate. |
| Views and Default | Visual unordered inventory in Presentation Card; working constellation on Stage | Tile menu owns Set as Default for that Presentation. Selected View use Card states owner and current use. |
| Guide/order/Stop identity | Named shallow Guide rail in the one lower Deck; Index Guide locator reveals/focuses that rail | Edit Guide opens bounded fisheye in the same Deck. Optional Compare Views supplies read-only L2. One Stop context-menu host owns reorder/repeat/remove in either posture. |
| Stop entry/continuation | Selected Stop Card: Presentation relation, Entry, Next and transition door | Occurrence-local advanced policy is invoked deliberately; shared Presentation opens its owner. No property writer in the Deck comparison. |
| Preview | Shared Head: Preview Guide for nonempty Guide, otherwise Preview Presentation for the working moment or Preview Experience for eligible Experience-only content | Same Head scope menu exposes supported entries. No secondary visible Guide Preview command. |
| Camera View editing | Selected View → Edit Camera | One Camera Stage task, Camera-owned proposal/Ask and selected-identity Card; Outside/Through/Plan. |
| Transition Cut/Travel | Selected Seam's central Deck instrument | Experience transition policy references Camera support; explicit Travel prepares only missing support through Camera. Stop Card contains a summary/door. |
| Camera connection pace/path | Selected connection inside Seam | Exactly one pace writer in the central instrument; path/anchor gestures only on Stage. Card supplies identity/owner/reach. |
| Narration, behavior, offers, cues, lifecycle | Quiet indication when authored; subject Card shows actual uses | One invoked Advanced authoring task or selected Activity/Interaction Card. Operation-specific audition/configuration appears after a choice. |
| Station/invoke/Hold coordination | Seam summary/door when relevant | Deliberate Coordinate depth in the same Deck, mirrored with Stage; no permanent global timeline. |
| Source history/status | Shared Head | Undo/Redo verb labels/tooltips and honest prototype session status. Internal counts remain QA-only. |

| Current surface | Action in this slice |
| --- | --- |
| World/Experience switch, project/Experience identity, Stage and selected Card landmark | **Keep**; fix identity/header reach if obscured. |
| Experience Presentation rows and Guide locator | **Keep/simplify**; locator focuses the same Guide rail, with no duplicate Preview/editor. |
| Peek, Overview, repeated Expand controls and expanded Stop panel | **Replace/rename/merge** as compact Guide, Edit Guide and optional read-only Compare Views in one bounded Deck; ordinary Stop selection edits only Card. |
| Preview Guide in Index/rail/Stop Card | **Move/merge** into one scoped Head Preview home; preserve all visitor entries. |
| Stop Card shared Set/Meaning editor, repeated entry summary and reorder stack | **Replace** with local Entry/Next, transition summary and Open Presentation; order operations live once in Deck context. |
| Seam triptych and scoped route support | **Keep**; preserve Camera/Experience information homes and deliberate coordination. |
| Permanent Scene subjects list | **Replace** with complete on-demand shared locator before removal. |
| `+ Presentation`, `Present environment`, `Present region` | **Replace** with generic Present plus contextual Present this; area definition is a focus operation, not a permanent species. |
| Every descriptor's controls/Use button/repeated audition paragraph | **Replace** with actual uses and a selected-operation chooser. |
| Name input, primary narration textarea, Focus Select/Operate | **Move** rename/narration to their homes; **remove** duplicate Focus actions. |
| `Show · unordered Set`, `entry`, `choice` labels in ordinary Card/Stage | **Rename/remap** to Views, Default and optional named View. No numbering or progression arrows. |
| Auto/Hints/Capture proposal badge/extra derived accept step | **Replace** creation ceremony; **move** recommended framing to one invoked Camera option. |
| Ordinary Reuse a Camera View accordion | **Move** to Views menu → Use existing View; preserve deliberate reuse and shared reach. |
| Bring into view | **Move** to relevant context menu/locator action; remains explicit Camera navigation. |
| Intent/shared summary, Additional contributions, generic offer builder, View suggestions/estimate | **Hide from ordinary Card; move** to Advanced authoring. Preserve actual data and editors. |
| Frame-height/aim/target six-button viewport cluster | **Replace** with spatial grips, local posture/return, one active tape and deliberate keyboard/numeric access. |
| View Movement selector; role/cue controls on View Card | **Hide/move**: transition Pace only in connection UI; legacy View request preference in advanced Camera detail; default in Presentation View menu; cue in advanced narration. Do not migrate one speed field to the other. |
| Local coordination strip/markers automatically revealed by existing beats | **Make deliberate depth**; existing coordination earns a summary, not automatic technical expansion. |
| Global view trail; change/Undo depth counts | **Remove from ordinary chrome**; preserve internal navigation/Undo and explicit task return. |
| Heavy selection border/shadow/boxed geometry | **Simplify** to one legible contour/tint, sharing semantic state across Stage/rows/tiles. |
| Unsupported tile deletion/global Camera deletion | **Do not add** here. Consume C9.6's accepted relation/removal/repair contract only; see §5. |

## 3. Present and capture flows

### Contextual Present this

1. The command receives the selected resolvable subject explicitly. Do not infer a
   subject from the active tool, an old working Presentation or an unrelated reference.
2. Cancel unaccepted proposals/audition through existing lifecycle policy. Camera
   prepares recommended framing against current World truth and current Stage aspect.
3. One existing prototype `command` accepts Presentation + Camera View + Experience
   Default use together. Capture focus bookkeeping consistently with `captureView`;
   validate before acceptance. Failure leaves every authored domain/history unchanged.
4. Select/open the new Presentation at ordinary depth. Its Default thumbnail and Stage
   marker are immediately usable. Create no narration, Activity, Stop, route or edge.

**Creation does not fly the authoring viewport.** The recommendation is visible in the
thumbnail; Look through is a deliberate action. An existing-use relation explicitly
opens an existing Presentation; Present this always permits a new distinct moment.
No subject-based deduplication or silent reopening.

Recommended framing must use the Camera-owned helper, upgraded to fit a subject's
resolved render extent rather than the current fixed `frameH:3` point guess. If the
operation is invoked for an already supported focus set/area, fit its union/bounds.
Consume accepted Stage/World extents; do not reconstruct Layout or add an Experience
framer. Occlusion does not demand an automatic route/visibility solver. If a logical
subject has no render extent, show **Present** and capture the current viewport, with
that subject as focus; do not frame its arbitrary fixture coordinate as geometry.

### Generic Present

The single Index creation command is **Present**. It always means “make a moment from
this composition,” even if another Presentation/View/Stop is selected. It captures
the actual current Camera and uses existing environment focus; it never falls back to
the selected object or `deriveFraming`. Name it **Untitled Presentation**, with immediate
optional row rename; naming is not a prerequisite to Preview.

Camera owns a bounded **snapshot-and-interrupt** operation: sample the live Camera,
stop any in-flight navigation at that sample, clear unaccepted Camera drafts without
jumping to a requested destination, and prevent a later queued tween overwriting it.
Then accept the same aggregate as above. If a draft is active, restore its accepted
authoring viewpoint before taking the sample; a proposal is not silently captured.

In this prototype, Plan can be captured faithfully with the existing `flat` pose and
derived Plan drawing. Preserve target, azimuth, elevation, frame height, flat/mirror
and Camera evaluation; compare author/visitor at equal aspect. The tiny-FOV Plan
approximation is retained prototype behavior, not a production orthographic format.
Do not serialize viewport dimensions, aspect locks, clip planes, image buffers,
Three objects, inspection recipes or shell state. World lens crossing already parks
temporary Unroll/Section/Look representation; capture the normal World at the held
Camera, never a displaced inspection as authored scene truth.

### Additional Views and focus

**+ Capture view** captures the actual accepted viewport through the same Camera
snapshot operation. It adds one Camera View/use in one history result; only the first
View of a valid empty Presentation becomes Default. Existing defaults remain unchanged.
No derived recommendation wins merely because a stale Hints session exists.

Views menu → **Recommended framing…** opens the retained Camera recommendation/hints
flow; accepting it captures/adds a View explicitly. Views menu → **Use existing View…**
opens a bounded Camera lookup and then adds a reference, without a clone or route.
Both are deliberate operations, not ordinary accordion sections.

Change focus uses the existing subjects/region/environment shapes. Reuse the existing
two-corner `experience-region` operation for an area, with an equivalent numeric/
keyboard path and cancel-before-accept behavior. A bounded subject-reference picker
can add/remove several focus references; its draft membership is an authored relation
proposal, not a second live selection. Reuse shared subject resolution/Search, names
and disambiguation. Accept focus changes through `updatePresentation`/Ask. Focus changes
never retarget captured Camera Views automatically. Do not add multi-select, room
inference, Presentation nesting or unspecified-focus persistence to enable this flow.

## 4. Selected Scene subject and shared discovery

The resting subject Card contains its name/kind, **Present this** (or Present for a
logical subject), **Used in Experience**, and **+ Add behavior / + Visitor interaction**
when supported. No capabilities means no inert capability buttons. Existing-use rows
name the operation, Presentation or Experience-wide home, and whether this subject is
operated or activates something else. Empty use state is one quiet sentence. Long
use lists use one bounded relation region, not a Card-sized capability dashboard.

An Add action opens a compact chooser using `cap.label`, `control` and declared
constraints. Choosing Open casing, Run rotor, music, highlight, visibility, etc.
reveals **only that operation** and its audition/configuration. Keep audition temporary,
with one contextual statement and Clear/Cancel; it writes neither source nor history.
Use/update/capture-another retains existing unique-match/ambiguity semantics, named
destination, one transaction and supported shared/local Ask. A selected subject does
not silently switch identity to the working Presentation.

Behavior capture explicitly names its destination: working Presentation or supported
Experience scope. An interaction keeps **Activated by**, **Operates**, **Availability**
separate. Organizational home does not arm execution; current Experience-wide offer
availability default remains. Existing Activity/Interaction rows select those authored
identities and open their existing writer. Cancel/selection/lens crossing/Preview/task
exit clears audition and draft capture choices.

### Search/Browse is a prerequisite, not optional polish

Extend `main.js:searchRequest`, `ui.js:records/browseMatches/renderBrowse` and the
derived `fixtures.js:browseRecords` inventory to serve subject discovery in both lenses.
Include existing museum identities **and** `ctx.sceneSource.subjects`; deduplicate by
identity, invalidate on relevant source revision/profile replacement, and mark logical
atmosphere as having no Stage geometry. Preserve complete names, location/source facts,
query, paging, context and explicit verbs. Selection calls the same `A.select`.

Use the existing all-places/current-place and truthful in-view/out-of-frame/occluded
readings. Do not add Nearby, Recent or invented Room membership/ranking. No compulsory
scope chips are needed beyond supported locator context. Search is subject lookup;
the capability chooser is an operation lookup. Search queries, highlighted results,
paging and closing change neither selection, authored source nor Camera. Select changes
identity only. Bring into view/Open location are separate, explicitly named navigation.
Stage overlap can use the same bounded candidate chooser; do not pick a hidden subject
by arbitrary enumeration. The exhaustive Scene section disappears only once this
fallback reaches every formerly listed subject with keyboard and pointer.

## 5. Ordinary Presentation, Views and Default

The Card has a persistent **Presentation · name** header, quiet **Focus**, **Views**,
**Guide** and a menu. It has no ordinary Name/explanation form, Select/Operate, role
editor, cue form, generic builder, suggestion/estimate section or framing ladder.
Authored narration/behavior/interaction earns one quiet advanced-content summary/door;
empty categories render nothing. Missing references produce a concise actionable notice.

Presentation rename is one Index-row writer, opened by row context action or a Card
menu door. Escape cancels; acceptance uses the existing shared-Presentation scope
policy. The Card title is never replaced by a tool title or naming field. At narrow
width the same action invokes the Index sheet/row writer and restores focus on exit.
This does not alter the production/World object rename contract.

### Visual View inventory

Render compact visual View items: Camera image, name, Default marker and a quiet menu.
The default appears first for discoverability; the remaining display order is stable
session presentation, **not** authored progression. No numbered tiles, connecting
arrows, reorder handle, filmstrip or “next View” authoring sequence. Keep the accepted
working unordered constellation on Stage, with names/Default language and evaluated
orientation. No permanent rig, global Camera graph or generated proposal badge at rest.

Thumbnail generation is a Stage rendering derivative using the **same Camera
realization/kernel and Scene/Layout representation**. Use the existing renderer with
a temporary Camera/render target; never navigate the live Stage to get an image.
Evaluate **normal authored World/Scene representation for this View's `flat` reading**,
rather than borrowing the live Stage's globally applied Paper/material, clipping,
set-aside geometry or shadow state. Suppress editor selection/gizmos/audition/visitor
overlays. Use a bounded derivative render pass with full render/representation-state
restoration on success, failure and cancellation; no second renderer, architectural
reconstruction or call to World inspection authoring helpers. A 3D View thumbnail must
remain a 3D composition when the live Stage is Plan or an inspection is parked/resumed.
Use a disposable cache keyed by View revision, relevant World revision and rendered
aspect; invalidate after edits/profile changes/Undo/Redo. It stores no authored pose
copy, new View identity or persisted image field. Unresolved Views show a labelled
repair placeholder, not a stale attractive thumbnail. A simple framing schematic is a
loading/failure fallback, not the final substitute for a supported captured image.

Tile/Stage marker selection changes the canonical **View use** and opens an honest
Camera View/current-use Card; it moves no Camera. Look through and Edit Camera are
separate actions. Tile menus provide Rename, Set as Default, Edit Camera and the
accepted C9.6 relation-removal action where supported. The selected View Card provides
owner/shared-use reach and Back to Presentation; it does not repeat the whole inventory
or carry Movement, entry/choice/cue controls.

Camera View name is canonical. Current Camera/use name duplication must not produce
different labels in editor and visitor: resolve ordinary labels from Camera consistently
(including visitor controls, Guide references and thumbnails), preserving only genuinely
authored local aliases if C9 later establishes them. Rename writes the Camera name once,
with reach disclosure; do not add a second ordinary alias field or silently rename the
Presentation/Stop.

### Default and exceptional states

Use `setRole('entry')` for **Set as Default**; demote the previous entry atomically.
No new `defaultViewId` or role enum is needed. A Presentation default is shared by its
uses; existing Ask precedes a consequential shared change. Stop **Specific View**
overrides remain unchanged. All valid Views remain visitor choices and Travel origins.
Default changes do not alter Guide order, Stop identities, Camera poses or connectivity.

New ordinary Present creates exactly one Default. Existing valid no-View moments remain
valid: **No View · uses current viewpoint**, with Capture first View. Existing nonempty
collections without entry say **Default not set**, with an explicit choice; no first-row
inference. A missing/unresolved referenced default is **Repair required**, distinct from
intentional keep-viewpoint. Rendering never creates a View or repairs a reference.

**Removal boundary:** C9.6 owns revision/removal/repair acceptance. This slice exposes
its accepted operation as **Remove from Presentation**, never directly wires the current
global `removeView` helper to a tile. A local unlink retains Camera truth and other uses;
Default, explicit Stop entry, cues and Travel coverage consequences must be disclosed
and repaired/rebound deliberately. No automatic replacement Default, deletion-to-hold
or silent route retarget. If C9.6 does not supply this bounded contract, omit Remove
and route the defect back to C9 before this slice's acceptance; do not invent broad
graph deletion or silently leave a required dependency unresolved.

## 6. Guide, transition and spatial Camera work

### One ordinary Guide home

Guide remains optional. No Guide means no rail. **Add to Guide** authors exactly one
Stop and selects that new Stop in a shallow named Guide rail; its Card makes the
Presentation → Stop relation explicit. Selection is a session result, not another
transaction or Camera move. Existing Presentation use relations identify distinct
Stops and open their Cards; **Add another Stop** is explicit, never deduplication.

The shell's existing bottom Deck is the single ordinary sequence home. It contains
**Guide · Stop count**, compact named Stops in order, quiet connectors, canonical
selected-Stop feedback, and one **Edit Guide** door. A Stop exposes position and its
referenced Presentation name; a local label, if supported, does not obscure that
reference. Repeated Presentations remain separately numbered Stops. One Stop occupies
one shallow row, rather than a large empty panel. Five to eight Stops use a single
horizontal rail with selected/nearby names, recoverable full accessible names and
compact overflow. No document-level horizontal scroll, per-Stop vertical scrolling,
or permanently expanded transition controls. Keyboard selection reveals the chosen
Stop within the rail without moving Camera.

Selecting a Stop opens only its normal Card, keeping the rail shallow. The Index
Guide row is a locator: it reveals/focuses this same rail, not another summary/editor
or automatic deep task. Stop context menu in the Deck is the **one ordering host**:
Move earlier/later, Add another Stop and Remove Stop. The same menu component is used
at deep Guide depth; no second Earlier/Later stack in Card or L2. Moving/removing is
one command, preserves Presentation/Camera truth, recomputes only default order and
leaves explicit missing Next/Gate references repairable under C9.6. Last Stop removal
removes the rail. No drag-only requirement; a future drag gesture would call the same
order operation and is not needed for this slice.

The ordinary Stop Card provides its occurrence/Presentation relation, **Entry**
(Presentation default / Specific View / Keep current viewpoint), **Next** continuation,
and a transition summary/door, plus its local-detail menu. Identity, Presentation
reference, Entry and Next remain visible together. Use one entry summary/control,
without the current duplicate boilerplate, shared View inventory, shared Meaning
writer, Preview Guide or Expand occurrence. **Open Presentation** reaches the shared
composition owner; it does not edit shared meaning inside the Stop Card. Cut/Travel
is edited only after opening the transition, not by another ordinary Stop selector.
Ordinary automatic continuation needs no dwell form.
Dwell, signal/Gate, branches and specialized visitor choices live under deliberate
Stop detail in Advanced authoring. Do not duplicate shared Presentation/View editors;
open their owner with scope/reach. Existing automatic versus Gate behavior, distinct
repeated visits and Guide runtime entry remain unchanged.

### Deliberate Edit Guide, not an expanding overlay

**Edit Guide** enters the accepted broad lower Deck posture with an explicit
**Collapse Guide** return. Reserve its measured lower band in the shell layout;
do not append a growing body overlay and compensate with hidden Card padding. Head,
navigation, upper Stage and Card identity/ordinary Stop controls remain usable above
it. At both review sizes the deep Guide budget is **less than 40% of viewport height**,
extending the existing narrow guard. This is an upper bound, not a target or a reason
to stretch sparse content. One Stop does not expand to a multi-Stop workbench height.
Layout reservation changes shell rectangles, never Camera intent or automatic fit.

Retain meaningful fisheye **L0 compact identity / L1 name, thumbnail, entry and warning**.
The chosen Stop is obvious; nearby Stops remain identifiable and distant ones compress.
One horizontal sequence lane uses bounded useful item sizes, not equal blank cards.
Its heading/Collapse action stays reachable; item contents do not gain independent
vertical scrollers. Stop semantic property editing stays in Card.

An optional selected-Stop menu action **Compare Views**, available only inside Edit
Guide, opens bounded **read-only L2**: Presentation summary, resolved entry, shared-use/
repair context and unordered schematic Views. It answers which compositions this
occurrence shares and how it opens; it is not another occurrence editor. Preserve
PLATE's L2 counterpart working constellation on Stage. Ordinary Guide/editing without
this deliberate comparison shows only numbered spatial entry pins, not a Camera graph.
Both View projections select the same canonical use neutrally; opening its writer
leaves comparison and enters the normal View/Camera context. No Default, pose, Entry,
Next or order writer is embedded in L2. Collapse comparison when the selected Stop
changes or the Guide posture closes. There is no separate product “expanded Stop”
workspace or repeated Expand button.

At 1024×768 the Index remains an invoked locator sheet, not a visible competing Guide
editor. Opening Edit Guide parks the Index sheet; its Head trigger remains available.
The selected Stop Card sheet opens **above the reserved Deck band** while Guide work
stays open. Entry/Next, Guide heading/Collapse and selected Stop/menu must be hit-reachable
simultaneously, leaving useful Stage visible beside the sheet. One Card-body scroller
and one horizontal Deck lane have distinct jobs; no scroller nested inside Stop cards.
Closing Guide before testing Card reach is specifically forbidden as a test workaround.

### Preview, Overview, Peek and Expand decisions

| Current concept | Decision | Lasting job / reason |
| --- | --- | --- |
| Preview Guide in Index, rail and Stop Card | **MOVE + MERGE** into shared Head | PLATE's global visitor takeover home; three entries use one isolated runtime. Scope is explicit, without far-separated copies. |
| Overview | **RENAME** to Edit Guide, one rail door | A deliberate order/comparison posture in the existing Deck, distinguished from Stage's unrelated environment Overview framing action. |
| Peek | **REMOVE** product label; retain shallow internal posture | Ordinary Guide awareness is just Guide. Collapse Guide returns here with selection and Camera preserved. |
| Expand occurrence / Expand on every Stop | **REMOVE** ordinary commands; **MERGE** useful read-only comparison into Edit Guide → Compare Views | Preserve accepted L2 use/entry comparison without an extra normal editor or property stack. |
| Reorder in Card and expanded Stop | **MERGE** into one Deck Stop context menu | Sequence ownership is local to Guide; keyboard operation remains available without repeated controls. |

The **Head is the only primary Preview placement**. With a nonempty Guide, the primary
label/action is **Preview Guide**, starting at its first Stop through existing
`previewGuide`/`startGuide`; selecting a later Stop does not silently mean “preview
from here.” Without a Guide, **Preview Presentation** uses the selected/working moment
when resolvable; otherwise **Preview Experience** is primary for eligible Experience-only
content. With neither, Preview is unavailable with one useful next-action reason.
The adjacent scope menu contains supported **Preview Presentation**,
**Preview Guide** and **Preview Experience** entries with truthful availability. A menu
choice invokes that scope once; it does not relabel a hidden sticky primary. Empty
Guide/Presentation entries are unavailable with a reason. Experience-only interaction
Preview remains possible. There is no secondary visible Guide Preview shortcut in
Index, Deck, Stop Card, advanced task or Presenter; review instructions point to Head.
In particular, the existing global Presentation Preview must not be relabelled as a
selected-Stop Preview: it does not execute the Stop's entry/Gate/Next settings.

Only one Preview component is mounted. While its scope menu is open the Guide item
and primary button are two parts of that **same scoped component**, with one runtime
command, not duplicates in distant homes. Uniqueness checks account for this declared
menu state. In Preview the authoring component is inactive and the runtime provides
its own exit/continuation controls under the existing isolation contract.

### Seam and Camera connection

Seam selection opens the same shell-owned bookend–central-instrument–bookend Deck.
Its center owns Cut/Travel, origin coverage, selected Camera connection and pace,
with Edit route and Coordinate doors. Stop Card repeats only a summary/link. Selecting
Travel is the existing explicit aggregate `prepareTravelSupport` transaction: reuse
authored support, create only missing eligible direct connections, report unresolved
origins/destination, and use the same live-start evaluator. View creation, selection,
thumbnail generation and Preview never prepare routes.

A multi-origin Seam selects which connection is being inspected/edited; **Pace** has
one writer for that selected Camera connection. Shared connection reach/Ask remains
visible before acceptance. Path/anchor geometry is edited on Stage only. Coordinate
depth deliberately reveals stable station/invoke/Hold work and mirrored emphasis;
existing coordination otherwise earns a quiet summary. Preserve authored interior
anchors versus generated endpoints/helpers and exactly-once traversed-route behavior.

Opening a Seam or returning to Stop editing cancels/disarms stale route proposals and
anchor-add hit targets. Selecting a Stop from Seam returns to the ordinary rail and
its Card. **Edit Stop** is an explicit return from the central instrument, not a second
Entry/Next writer mounted beside an armed route editor. After an entry/rebind/repair,
Resume/Edit route must revalidate that the selected connection still belongs to the
current Seam's coverage; an old connection ID alone cannot authorize a stale patch.
Existing beats do not automatically enter Coordinate when `openSeam` runs.

Remove the ordinary View Movement control. Preserve existing `View.speed` values and
runtime request/estimate behavior; new Views keep the existing Camera default. Do not
create an edge for standalone look/cue/visitor View choice or copy speed to a fabricated
connection. Preserve its real writer only in deliberate **Camera request preference**
detail, with plain help distinguishing standalone/cue/View arrival requests from Guide
Travel on a connection. It is not a normal View tile/Card property or a duplicate Seam
pace control. C9 C3 explicitly requires this preference in detail, so hiding the ordinary
selector must not remove that capability. A future preference/model migration is separate.

### Camera editing

Reuse the existing Camera task/proposal/Ask/return system and consume C9.8's changes.
**Edit Camera opens neutrally at the current standpoint**; no automatic Through flight.
Outside, Through and Plan are available postures of one task. Explicit posture/framing
actions may navigate through Camera. A compact posture/return cluster stays in a
reserved local tool area; the permanent six-property viewport dashboard disappears.

Stage work centers on observer position, target and framing. Geometry derives from
evaluated Camera facts. One active grip/tape receives manipulation emphasis; passive
geometry is quiet. Keep the supported framing/aim/target direct grips on that one
instrument, with accessible task names and deliberate numeric/non-pointer access to
the same writer. The observer/frustum remain truthful evaluated geometry; a passive
observer marker must not suggest an unsupported independent-eye operation.
A Camera Card Precision action exposes the focused property; it does not simultaneously
mount a duplicate full form beside an active Stage value tape. Through remains editor
authoring with chrome, selected View identity and return; Preview has none of them.

The current pose stores target/azimuth/elevation/frame height/flat; observer and FOV
are derived. **C9.8 implements the concise existing instrument now**; its accepted scope
does not require independent observer-position/target-held-eye gestures or a new inverse
API. After it lands, audit actual grip geometry, disclosure, keyboard access and return,
then adjust only remaining density/state problems here. Do not reimplement its Camera
Card or postpone removal of the six-control cluster to UX4. Independent observer/target
gesture semantics, inverse mapping and lens/FOV/eye storage are deferred, not hidden
requirements of this plan. No general gizmo, orbit constraint, interpolation loop or
Experience-specific Camera evaluator is authorized.

Put it back restores the Camera task's spatial origin; Close ends work and keeps the
current standpoint. Back to Presentation changes authoring identity without a Camera
move. Lens crossing parks task inactive; ordinary return keeps current identity/Camera,
and explicit Resume revalidates at the current posture. Preview exit instead restores
the exact originating task, selection, sheets, accepted Camera and return context.

## 7. Advanced disclosure and shared shell cleanup

**Advanced authoring…** in the relevant Presentation/Experience menu invokes one
contextual task using existing writers. It lists authored narration/Activities/offers
and offers purposeful Add actions; selecting one opens its editor. Existing rich
content has a quiet summary/door in the ordinary Card, so hiding the textareas/builders
does not make behavior invisible. Subject Add behavior/Visitor interaction shortcuts
enter the same operation flow directly. Selecting an authored Activity/Interaction
still gives its canonical Card identity and current meaning/repair first.

Move primary explanation/narration, duration/caption/cue/marker editing, suggestions/
estimates, start/signal/dependency/lifecycle/retention, visitor-offer availability and
advanced Stop policy there. Station work remains deliberate Coordinate in Seam.
No new scripting workspace name, document, language, timeline or execution authority
is introduced. Prototype Presenter recipes must follow these real doors; loaded
examples and read-only observation cannot mark authoring actions complete.

**Trail:** remove the global ordinary Experience View trail, and filter routine Plan/
3D changes from semantic navigation history in both lenses. Keep meaningful World
inspection chains/internal return, Back/Put it back and explicit Camera task return.
No replacement global breadcrumb lists raw posture switches. Navigation remains
distinct from source Undo; do not delete the return machinery to hide its label.

**History/status:** remove `undoCount` and transaction-count text from shared Head.
Keep Undo/Redo state, specific verb tooltip/accessibility names and short accepted
action feedback. `ui.js:renderHead` currently fabricates Saved from `S.undo.length`;
no save/persistence operation exists here. Use quiet **Session only** in this prototype,
with session-lifetime help. Production Saved/Saving/Error remains the persistence
owner's fact; no new save API belongs in this slice. Demo Reset/Load remain explicitly
labelled authoring commands outside normal product chrome.

**Selection/material:** use the existing PLATE contour/quiet-tint roles on actual
geometry. A two-tone legibility halo is allowed; a DOM rectangular box, blurred
decorative shadow or surface flood is not. Preserve independent artwork/material,
authored visitor highlights and Plan paper/grid. Selected subject/View/Stop/connection
echo canonical identity; task target/reference/hover and neutral active lens/posture
must remain distinct. A selected Presentation focus reference is not a selected Scene
object. Logical or occluded subjects get honest locator context, not fabricated Stage
geometry. Retain type/control roles; no brand/type-ramp redesign or shrinking text to
make a dashboard fit.

**Narrow shell:** 1024×768 uses accepted invoked Index/Card sheets with compact
location/identity triggers. Opening a sheet/Deck/menu or making a thumbnail never fits
or moves Camera. Avoid collisions with Head, posture/return, the Guide rail and active grips.
Keep identity recoverable while a spatial task is active; one lower task home follows
its information span. This plan does not bring forward PA0–PA12's World Paper rail or
settings migration. Existing World footer controls remain inert in Experience unless
they are shared accessibility/session settings; no duplicate Camera pace control.

## 8. Scope, model/API impact and likely files

Allowed mutations are in the unified prototype, its tests/QA/evidence and narrowly
related plan routing. No `apps/` or `packages/` implementation, npm workspace change,
production codec, Scene/Layout migration, F interface amendment, public release or
resource system is included. Do not change World A–F behavior or coordinate-frame
conversion to accommodate Experience. Preserve existing placed/room-local transforms;
the ratified destination still has explicit internal frames and no mandatory Room frame.

| System/files | Bounded change |
| --- | --- |
| `app/experience-ui.js`, `styles/app.css` | Information homes, visual Views, Card/chooser/advanced disclosure, compact Guide and bounded reserved Deck, Stop summaries, single Seam pace owner and narrow density. Consume C9.8 instrument and existing roles. |
| `app/experience.js`, `app/actions.js` | Aggregate Present/capture, explicit inputs, cancel/selection/return, canonical naming and existing reuse/Ask/repair. Keep one chronological domain command/history. |
| `app/main.js`, `app/ui.js`, `app/fixtures.js`, `app/state.js`, `index.html` | Shared subject locator coverage, neutral selection, on-demand Index, one rename writer, scoped Head Preview, honest status/trail and session-only chooser/cache state. |
| `app/navigation.js`, `app/camera-evaluation.js` | Camera snapshot/interruption and recommended extent framing through current constraints/evaluation. Reuse landed C9.8 operations; no new movement authority or inverse/gizmo requirement. |
| `app/stage.js`, `app/experience-draw.js`, `app/experience-scene.js` as needed | Thumbnail render derivative, existing direct instrument, selection treatment, correct ordinary/Edit Guide/L2/Seam depth and no visitor authoring overlays. |
| `app/experience-model.js`, `app/experience-runtime.js` | Reuse current roles/focus/Stop/Travel. Only bounded label resolution and C9.6 relation/repair consumption justify changes; no speed/lifecycle/evaluator rewrite. |
| `app/experience.js:buildExampleFixture/quickstart`, `app/conformance-fixture.js` | Adjust real recipe/control paths and add only authored initial fixtures needed for exceptional states. Current fixture/Presenter code is here; there is no `experience-examples.js` at this baseline. Consume any explicit C9.9 extraction, not an assumed file. No hidden final-pose/task/runtime preparation. |
| Existing `tests/*.test.mjs`, `qa/*-check.sh`, `qa/run-all.sh`, QA guide/manifest | Preserve proved behavior, migrate moved UI paths to semantic selectors, add explicit Experience shell/disclosure and packet capture proof. |

**No required persisted-model or descriptor addition.** Existing focus, entry/choice,
Stop override and Camera pose/connection shapes suffice. Required APIs are prototype
operation seams: aggregate Present, Camera live snapshot, useful recommendation fit,
shared locator coverage, canonical View label resolution, scoped Preview routing and
thumbnail rendering/cache. Guide posture/layout is session UI, not a new sequence
model. Chooser/session state is not authored state. C9.6 removal
is a prerequisite contract, not permission for this slice to invent deletion.

Preserve visitor/editor isolation and separate Layout/Scene/Camera/Experience owners,
one architectural compiler, one navigation/movement/evaluation system, unauthored
generated endpoints, deterministic history/selection and frozen source in Preview.
The static prototype's DOM/session isolation is **not** production chunk-isolation
proof; unchanged production import-boundary gates remain required separately.

### Post-C9 reconciliation: four layers, not one exposure contract

C9 remains authoritative for **semantic capability**, **ownership** and a **reachable
truthful product operation**. Ordinary visual exposure is the fourth layer. A moved
operation still needs real invocation, cancellation, repair and outcome proof; a
prototype proof control does not earn permanent chrome. This plan does not remove
any C9 parity row, journey or checkpoint. The recommendations below guide implementation
latitude now; where the accepted C9 text explicitly prescribes exposure, preserve it
until an exposure amendment is accepted rather than treating this proposal as authority.

| Area | C9.1–C9.5 at inspected baseline | C9.6–C9.9 adds/changes | Intended post-C9 ordinary home | Rework risk and dependency |
| --- | --- | --- | --- | --- |
| Presentation | Primary narration, Focus actions, framing ladder, contributions/advanced stack; new Presentation has no captured View | C9.6 real rename/remove/regroup/reuse/repair; C9.7 rich Wall and no-View atmosphere; C9.9 outcomes | Index identity/rename; quiet Focus, visual Views/Default and Guide Card; real content has an advanced door | **Medium.** Homes **STABLE NOW**; relation/removal/repair APIs **WAIT FOR C9.6**; final exceptional fixtures **WAIT FOR C9.7**. Aggregate first-View Present remains the later explicit UX amendment, not a C9 rewrite. |
| Views | Camera/use split, roles, reuse, cues, per-View speed and text inventory; global remove helper is unsafe for a local tile action | C9.6 bounded local/shared detach, revision/removal and unresolved-reference repair; C9.8 selected Camera detail | Unordered visual inventory, Default remapping and one selected-use owner; request preferences advanced | **Medium.** Semantics/labels **STABLE NOW**; exact unlink/Ask/repair **WAIT FOR C9.6**; detail disclosure **WAIT FOR C9.8**. Thumbnails are new bounded UX work. |
| Scene subject | Stage pick plus exhaustive list; descriptors render all controls; audition/capture works; shared Search rejects Experience | C9.6 provider replacement/gain/loss and compatible rebind; C9.7 native Wall/environment adapter participation | Stage + complete shared locator; identity/actual uses; chosen-operation flow | **Medium.** Selection/chooser home **STABLE NOW**; provider/repair interface **WAIT FOR C9.6**; exact Wall/logical discoverability **WAIT FOR C9.7**. Avoid new permanent descriptor chrome. |
| Guide / Stops | Optional Guide, separate visits, compact number rail and Stop Card; repeated Overview/Expand/Preview and shared fields | C9.6 order/removal leaves explicit links repairable; C9.7 routes/coordination; C9.9 Q5–Q8 and scope predictions | One named compact Deck, local Stop Card, bounded Edit Guide and read-only L2 comparison | **High if more writers spread now.** Single homes **STABLE NOW**; exact removal/repair **WAIT FOR C9.6**; stale route/event returns **WAIT FOR C9.7**. Keep existing Overview/L2 proof during C9; its later command/layout pruning stays UX. |
| Camera View | Truthful evaluated rig and direct grips exist, but six-property floating dashboard and redundant task entry remain | C9.8 removes dashboard, relocates property/mode detail to Camera Card, proves grip/tape/posture/return reach | One existing direct Stage instrument; focused Camera Card detail; one active tape | **Low when C9.8 is consumed.** Ownership/instrument/no-dashboard **STABLE NOW**; actual residue and numeric focus paths **WAIT FOR C9.8**, not an automatic inverse/gizmo rewrite. |
| Camera connection / Seam | Camera-owned explicit Travel support, coverage/live-start, central connection pace; existing beat data auto-opens Coordinate | C9.7 selected event/Hold focus, duration/rebind/pace/anchor proof, stable refs, traversed-route-only execution and repair | Same Seam triptych, sole connection Pace writer, Stage geometry, deliberate Coordinate depth | **Low with correct homes; medium for focus/return.** Homes **STABLE NOW**; usable focus/timing/repair **WAIT FOR C9.7**. Auto-existing Coordinate remains C9 behavior pending the explicit UX disclosure amendment. |
| Repair/revision | Partial validation and Camera detach, incomplete product revision/profile/repair writers | C9.6 real copy/link/local/shared/replace/regroup/remove, routed binding repairs and aggregate Undo | Selected-item menus + local repair notices route to exact owner; no permanent repair dashboard | **Low if C9.6 follows existing conventions.** Placement **STABLE NOW**; exact operations, preservation and notice contracts **WAIT FOR C9.6**. |
| Capability / behavior scripting | Lifecycle, narration/cues, offers and availability already execute; ordinary cards expose much of it | C9.6 definition reuse/rebind/repair; C9.7 station-only invokes/Holds and richer examples | Chosen operation or authored-item Card; advanced composition content; Seam-only coordination | **Medium.** Advanced/disclosure separation **STABLE NOW**; supported revision/event details **WAIT FOR C9.6/C9.7**. Preserve all real behavior; no new scripting language or workspace. |
| Presenter | Four quickstart topics, outcome counters and instructions; not full 18-topic, Preview-visible, gated walkthrough | C9.9 completes Q1–Q8/A1–A10 predicates, isolation, provenance and MP4 after earlier slices | Optional separate review aid; never ordinary product chrome or another Preview/editor home | **Low if observational.** Separation **STABLE NOW**; full capability inventory and outcome handoff **WAIT FOR C9.9 / MP4**. UX changes action recipes, not semantic predicates. |

### C9.6 landing guidance, operation by operation

Use C9 §2 R1–R8/W6–W8, §4 J8, §9 J8 and §10 C9.6. No broad fork, graph clone,
silent promotion, deletion-to-hold or lifecycle rewrite is permitted. Each operation
must be testable through its real home, with accurate shared/local reach and one
accepted history result. The classifications are recommendations for remaining UI
latitude, not permission to narrow semantic acceptance.

| Required operation | Best likely home now and after pruning | Required truth / bounded C9 implementation |
| --- | --- | --- |
| Rename Presentation | **Context menu / overflow**, opening one Index-row rename | Accept once; preserve stable identity and shared use. C9.6 can land the lasting row writer immediately; no second permanent Card field. |
| Remove Presentation | **Context menu / overflow** on its row/selected identity | Preserve reusable definitions/contributions and broken bindings as C9 specifies; disclose affected Stops/Next/cues/offers, then route local repair. No implicit Experience-start activation. |
| Rename / duplicate / replace / regroup / remove contribution | **Context menu / overflow** on the selected contribution or its advanced inventory; **selected-item inspector** for actual content/value/bindings | A move/regroup changes organizational home only. Duplicate/copy/link identity and reach are explicit; replace never rewrites unrelated lifecycle or station activation. Add remains purposeful in the operation/content flow. |
| Remove View use or replace its Camera reference | **View context menu / overflow** plus **contextual repair notice** | Distinguish local use unlink from Camera deletion; preserve other uses, explicit Stop entry, cue and Travel dependencies. Do not expose the current global `removeView` helper as local removal. |
| Copy / link / make local / detach shared narration or operation definition | **Selected-item context menu**, with scope in **selected-item inspector/Ask** | Name which definition/use changes. Keep reusable truth, local fields and current eligibility distinct. No universal Presentation fork is needed. |
| Shared/local Camera View edit; Stop-entry-only detach | **Selected Camera inspector/Ask**; local-entry operation in **selected Stop Entry context** | Local Stop entry copy is atomic and does not enter the shared View set or clone connections. Resulting Travel gaps stay explicit. |
| Provider profile gain/loss/replacement | **Selected-item inspector** in World subject Details | Explicit source operation preserves instance/geometry. Descriptor-driven capability discovery/rebind, not a Presenter mutation or Experience-owned World control. |
| Capability/definition replacement and target/trigger rebind | **Contextual repair notice** → **selected Activity/Interaction inspector** | Retain the broken original until acceptance; choose compatible descriptor/target deliberately; trigger and target remain distinct. Refusal/optional disable is local and honest. |
| Missing Focus/subject or Camera View/default/Stop override | **Contextual repair notice** at owning Presentation/selected View/Stop → relevant picker/editor | Name the missing reference. No first-available fallback, guessed framing, implicit keep-viewpoint or deletion-to-hold. |
| Missing cue/marker, availability, start/dependency or boundary | **Contextual repair notice** → **advanced/script surface** or the affected authored-item inspector | Keep supported signal/scope validation, required refusal versus optional disable and valid-remainder estimates. A permanent repair/lifecycle stack in ordinary Presentation is unnecessary. |
| Missing Next/choice/Gate binding after reorder/remove | **Contextual repair notice** → **selected Stop inspector**, with deliberate advanced Gate/branch detail | Reconnect only default order. Preserve explicit target/end identities and explain affected permission; no guessed successor. |
| Aggregate Undo/Redo; canceled edit/Ask | **Ordinary shared Head** for history; existing scoped proposal lifecycle | Accepted change/continuous gesture once, cancel zero; Undo source relationships, never session navigation. No visible stack depth. |

If C9.6 adopts the row rename writer now, route or remove the existing Card Name
writer in that same change; adding a second editing authority is not compatible
landing. Other references can open the writer, with selection/focus return intact.

Repair reach survives deletion of its old home: the Experience-level invoked authored
item inventory must list retained contributions with an unresolved organizational
binding and route to their selected-item repair writer. It must not require opening
the removed Presentation, silently rehome/activate the item, or discard the issue.
Consume C9.6's accepted notice/reach implementation, including linked definitions and
independent activation; the current home-based `definitionReach` enumeration alone
is not sufficient evidence of that contract.

**Temporary C9 proof surface policy:** prefer the existing selected-item menu/Card,
repair notice and Coordinate task; do not introduce a new developer dashboard to save
time. If an adapter-profile trial or not-yet-polished binding form genuinely needs a
provisional writer, keep it under explicitly labelled **Prototype detail** in the
appropriate subject/item task. It must call the real operation, remain keyboard
reachable, have cancel/scope/Undo proof and a recorded later disposition. The label
does not excuse raw fields in ordinary Cards. Never put a source mutation in Presenter,
`__me` preparation or visitor Preview. This is a limited fallback, not a new feature
or a license to create throwaway shell regions.

### C9.7 coordination, C9.8 precision and C9.9 handoff

**C9.7 now:** complete the representative Machine/Wall/environment/interaction fixture
and preserve the independent six-Stop stress fixture. Wall behavior consumes the
existing Layout representation evaluator through a runtime-safe adapter; atmosphere
has no fabricated geometry. Enter Seam directly from compact Guide/Stop Card—Overview
is not a prerequisite. Use the existing central Coordinate strip for route/station,
invoke and Hold, with Stage-only anchors and single selected-connection Pace. A selected
event must carry its **event/beat ID**, not only its station ID: two events at the same
station remain distinguishable. Keep canonical Stop selection for task counterpart
focus; event/Hold detail identifies target, duration/rebind, station and occurrence
reach. Prove stable binding across pace/geometry edits, exactly-once only on the
traversed route, no Cut execution, no entry-plus-station duplicate and honest repair.
No permanent Guide enlargement or ordinary Presentation coordination fields follow
from these requirements.

C9's accepted §7/§8 deliberately exposes existing coordination when Seam opens; this
is not an implementation mistake. It can remain during C9 proof. This plan recommends
an explicit post-C9 amendment to summary + Coordinate invocation. Build a reusable
local strip/task either way, so the change is a disclosure gate, not a rewrite of
bindings/timing. C9.7 may move the misleading ordinary View Movement writer into
Camera request preference detail now, consistent with C9 C3, while retaining its data.
Connection Pace must already have the lasting Seam home; never migrate the two fields.

**C9.8 now:** remove the floating six-property cluster, select supported grips directly,
move deliberate property/mode depth to the Camera Card and retain one active tape,
postures, evaluated observer/frustum/target geometry and current-context return. Use
existing gestures/numeric → proposal → Ask → `editView`, including keyboard/narrow
sheet paths and refusal/cancellation proof. Remove redundant precise-entry buttons
while the task is already active. These are already required by C9 C6/§8/J10/J11/C9.8;
they should not wait for UX. Independent observer/target inverse, free lens storage,
general gizmo and new manipulation vocabulary are outside that scope and this plan.

**C9.9 / MP4:** freeze a trustworthy capability inventory and outcomes, not the final
ordinary layout. Complete all eighteen Q/A topics, actual writer/runtime predicates,
Preview-visible read-only guidance, Skip/Back/close/reopen isolation and explicit
loader provenance. Loaded examples do not complete Reset authorship; field presence
or a clicked button is not success. Keep Presenter closed for ordinary comprehension
and structural captures. Retain C9's small structural packet; the fourteen-state UX
packet below is not pulled into MP4. No additional Preview/editor copies are earned
by Presenter instructions. Existing mechanism tests using direct `__me.E.command`
remain mechanism proof; capability journeys require visible-authoring or explicitly
labelled initial-fixture recipes as C9 permits.

### Stable decisions and the exact post-C9 pass

- **STABLE NOW:** peer moments/no hierarchy; existing focus/role/Stop ownership;
  one selection/Camera/navigation/history; single information homes; complete locator
  before Scene inventory removal; chosen-operation disclosure; visual unordered Views;
  renamed Default; connection pace; truthful session status; compact Guide + local Stop
  Card + deliberate bounded Deck; Head Preview and separate Presenter. These are safe
  design recommendations to ratify now; their changed ordinary exposure still belongs
  to the UX slice unless the owner expressly approves a bounded C9 amendment.
- **WAIT FOR C9.6:** inspect actual copy/link/detach/rename/replace/regroup/removal
  APIs, reach/Ask and routed notice shapes, View unlink/default/Stop/cue consequences,
  profile gain/loss and missing-reference refusal. The operation homes above are settled;
  implement UX against the accepted operations instead of inventing substitutes.
- **WAIT FOR C9.7:** audit native Wall/logical inventory, stable event focus and
  counterpart IDs, Hold/invocation repair, selected-connection pace/anchor timing and
  return/disarm behavior. Recheck whether existing coordination disclosure can become
  summary-only without losing its truthful door. No new Guide workspace is required.
- **WAIT FOR C9.8:** inspect the landed Camera Card/grip/tape/posture/numeric focus
  paths and actual narrow residue. Consume its dashboard removal; limit UX changes
  to remaining density, labels, selection and collisions, not another manipulation API.
- **WAIT FOR C9.9 / MP4:** freeze the complete capability/recipe/predicate inventory,
  accepted trial observations and exact executable provenance. Map every moved control
  to a surviving product operation/outcome; rerun affected recipes after pruning.

**Amendments before remaining C9 implementation:** no semantic rewrite is recommended.
C9.6 row rename/overflow/local notices, C9.7 Seam-only coordination/event identity and
connection pace, and C9.8 concise direct precision already fit the accepted scope and
should be used now. Avoid new permanent revision rows, View-as-transition speed and
duplicate coordination editors. The following bounded exposure recommendations are
reviewable now; they do not start code work or change a C9 semantic predicate:

| Before C9.6–C9.9 recommendation | Treatment |
| --- | --- |
| Named selected/nearby Stops in compact Guide | **Implement under existing C9 obligation.** C9 §8 already requires names; number-only dots are an existing exposure gap, not a deferred visual redesign. |
| Direct Preview Guide from ordinary Stop editing | **Recommend bounded home amendment now:** C9 §8's direct door should point to the one explicit Head action, removing Index/rail/Card copies when shared Guide UI is next touched. Preserve first-Stop entry, scope availability and one-click Guide Preview; no Deck redesign required. |
| Ordinary Expand plus an Expand on every deep card | **Recommend consolidation now if that surface is touched:** retain one selected-Stop deep-only expansion/comparison entry and its accepted L2 projections. No ordinary Card Expand, automatic selection expansion or second property writer. Final Edit Guide/Compare Views naming and reserved-band layout remain UX work. |
| View Movement preference | **Implement existing C9 C3 detail placement now** when Camera/pace is touched; retain the request preference writer, connection Pace and runtime data. No migration. |
| Existing coordination auto-exposure | **Keep temporary accepted C9 exposure.** Moving it to quiet summary + explicit Coordinate needs this plan's disclosure amendment; C9.7 can reuse the exact local task either way. |
| Primary narration, derived framing + explicit Capture, old Overview label/layout | **Keep for C9 acceptance.** Aggregate Present, advanced-content separation, thumbnail inventory and full bounded Guide layout belong to the dedicated UX slice. |

These small home corrections can be accepted with this plan before remaining C9 work,
without pulling forward the whole redesign. If they are not accepted early, retain
the existing C9 exposure as temporary proof, record its replacement here, and avoid
adding further copies. This is an explicit recommendation for bounded exposure,
not an inferred authority override or a change to accepted capability scope.

## 9. Implementation sequence, each increment usable

| Increment | Dependency and bounded work | Acceptance before proceeding |
| --- | --- | --- |
| **UX0 — review and accepted baseline** | Owner accepts the recommended exposure amendments; C9 capability gates/repair/precision complete. Verify current changed evidence and removal contracts; preserve a source/QA baseline. | No unresolved C9 dependency disguised as visual work; accepted scope and fresh executable provenance. No implementation starts merely because this plan exists. |
| **UX1 — complete locator and clean shared chrome** | Extend shared Search/Browse/keyboard/logical subjects, then remove Scene inventory. Remove counts/fictitious Saved and routine trail; retain return. | Every formerly listed subject reachable; selection/nav/history neutrality; both lenses and 1024 sheets usable. World shell/return regressions green. |
| **UX2 — deliberate operation and advanced homes** | Introduce subject actual-use Card/chooser and one Advanced authoring task. Move narration/builders only when their replacement doors/writers exist. | Creator narration/behavior/offer/capture/update/ambiguity jobs still execute; no capability inventory or empty advanced stack. Narrow flow and keyboard cancel/focus pass. |
| **UX3 — composition creation and visual Views** | Aggregate Present, live capture/fit; quiet Presentation Card/rename/focus; visual View items, canonical names and Default remapping. Consume C9.6 relation repair. | New moments immediately Preview; legacy zero/missing states honest; no generated edges; visual/no-scroll core Card gate at both desktop sizes; thumbnails cannot change source/Camera. |
| **UX4 — Guide, Seam and Camera reconciliation** | Named compact Guide, one scoped Head Preview, bounded Edit Guide/Compare Views and sole Stop Card; single connection pace writer, deliberate coordination. Consume C9.8 precision, changing only remaining disclosure/density/collisions. | One-/six-Stop and simultaneous narrow Deck/Card gates pass; no duplicated Preview/Expand/order/Entry writers. Guide/Travel/agency/coordination, direct Camera operations and neutral return stay proved; no new gizmo/evaluator. |
| **UX5 — integrated acceptance** | Freeze executable; all retained/new axes, mutation obligations, repository gates and the bounded packet. Record owner visual review and accurate external failures. | All functional and §10/§11 design gates pass. No “polish later” exception for overflow, density, information homes or reach. No merge/closure implied. |

Each increment carries its applicable visual/reachability gate; UX5 assembles the proof,
not the first time visual structure is checked. Keep live prototype recipes usable at
each step. Update tests when controls move in the same increment. If correctness needs
production, broader World or unfinished C9 changes, report the scope dependency rather
than making them under UX authority.

## 10. Strict functional, shell, responsive and visual QA contract

### Harness and proof layers

Extend existing browser axes; add one focused **Experience shell** axis and register it
in `run-all.sh`. Its future script is named `experience-shell-check.sh` in the existing
QA directory. Use real product actions; Reset/Load authored fixtures are the only source
builders. `__me.qa`/source snapshots observe. No test API creates final Views, chooses
tasks, sets a final Camera or builds a Gate to bypass the authoring flow.

Pure tests protect aggregate/Camera/label/default semantics; browser tests protect
wiring, cancellation, control inventory and hit reach; written full-window review
protects hierarchy, density, state and spatial truth. Raster equality is not the
contract. No one layer substitutes for the others. Assertions must exercise the writer
and observed domain effect, not merely trust self-declared DOM owner attributes.

Use stable semantic action/home selectors instead of `details:nth-of-type` or translated
button counts. Ordinary-state tests assert allowed visible control groups **and forbidden
machinery** even after loading rich C9 content. A loaded example does not earn automatic
technical expansion. Hidden controls cannot remain keyboard/pointer-active.

### Required behavioral checks

| ID | Executable acceptance |
| --- | --- |
| F1 | Subject Present accepts exactly P + Camera View + Default use in one Undo/Redo; no Stop, connection, narration or stale derived badge. Generic Present captures current composition despite a selected P/View/Stop. Invalid target/fit fails atomically. |
| F2 | Capture live 3D and Plan, mirror and an interrupted flight. At equal aspect, reproduced eye/target/up/FOV/frame match the live accepted sample within existing `0.002` tolerance. No post-capture queued jump. Generic Present never calls subject auto-framing. |
| F3 | Subject/union/region recommended extent fit is Camera-owned and contains the requested extent at the current aspect. Logical/no-geometry subjects capture current viewpoint. Focus edits change references only, never retarget Views. |
| F4 | Search covers visible, occluded, off-screen, tiny/overlapping and logical subjects; repeated names disambiguate. Query/page/close are neutral; Select converges on `A.select`; navigation is a separate action. Source revision/profile loss invalidates derived locator facts. |
| F5 | Subject rest shows uses and no operation inputs. Chooser renders declared labels; range/toggle/playback chosen controls work. One active operation, zero writes for audition/cancel; capture/update/ambiguity/capture-another have existing semantics and named destination. |
| F6 | Narration, cue markers, suggestions, lifecycle/retention, offers, trigger versus target, availability, Gate and station/Hold remain reachable via deliberate doors and execute unchanged. Existing rich tests cannot be deleted because the controls moved. |
| F7 | View tile/Stage marker selection changes identity, never standpoint/source; explicit Look through works. Default change leaves Camera/Guide/explicit Stop overrides intact; all legitimate visitor choices/Travel origins survive. Rename agrees in Card/visitor/Guide/cache. |
| F8 | Existing zero-View and unset-default states remain distinct from unresolved referenced View. Repair/dependent removal uses C9.6 contract; local unlink retains Camera and other uses. Undo restores exact authored references; no deletion-to-hold or silent first-row choice. |
| F9 | First Add to Guide creates/selects one Stop in the shallow named rail; repeated Stops remain distinct visits. Selecting a Stop preserves ordinary depth and edits Entry/Next only in Card. Order/repeat/remove use one Deck context operation with one Undo; default order reconnects, explicit refs stay repairable. Edit Guide/Compare Views are neutral disclosure; no implicit expansion or Camera move. |
| F10 | Ordinary View UI has no pace writer; advanced Camera request detail writes only existing `View.speed` and preserves request/estimate correspondence. One selected connection writer edits only `connection.speed`, with Ask for shared reach. Neither edits/copies the other field. Only explicit Travel prepares support; gaps and live-start/same-View behavior remain truthful. |
| F11 | Retained C9.8 direct grips and keyboard/numeric detail share the existing patch/Ask/Camera writer and one history result. Pose/observer/frustum/frame geometry agree with realization; labels do not promise independent-eye gestures. Selecting a grip is neutral; Escape/lost capture/close clears proposal/hit targets with zero writes. |
| F12 | Thumbnail render/cache is source/history/selection/Camera neutral; no editor/audition marks, stale unresolved image or serialized cache. Normal View-appropriate World representation is stable when the live author toggles Plan or parks/resumes inspection. Render state restores after errors/cancellation. Undo/Redo, View/World edits and resize invalidate derivatives without navigation. |
| F13 | Plan↔3D and World↔Experience write no source/history; routine toggles create no semantic trail. Meaningful World return, Camera Put it back/Close, ordinary lens return, neutral revalidated Resume and exact Preview return retain their distinct contracts. |
| F14 | Presentation/Guide/interaction-only Preview use one isolated runtime, with frozen Layout/Scene/Camera/Experience snapshots and source history. No authoring DOM/hit targets active in visitor. Real-clock captions/effects, agency/rejoin/detour and exact exit remain proved. |
| F15 | Head Preview Guide starts the first Stop even when a later Stop is selected; its scope menu invokes the chosen supported entry once. Presentation Preview is never claimed as selected-Stop Preview. Only observational Presenter guidance accompanies Preview, with no authoring/source controls. Exact exit restores the originating Guide/Card/task posture. |
| F16 | Leaving Seam/Coordinate for Stop editing cancels/disarms stale route proposals and anchor-add handlers. Entry/route repair invalidates old coverage; Resume/Edit route revalidates selected connection membership before any patch. No ghost click authors an anchor. Stable C9.7 event/Hold focus identifies the authored item even when several share a station. |

### Visible inventory, density and responsive gates

Canonical design review sizes remain **1440×900 and 1024×768, DPR1**. Retain the existing
**1280×800 and 1024×768 DPR2** projection/picking/no-refit automated matrix; these are
not additional screenshot permutations. Use actual Stage rect/active sheets to judge
reach, not obsolete 820×834 World shell dimensions.

| ID | Blocking rendered-shell rule |
| --- | --- |
| S1 Information homes | Every home in §2 has exactly one active writer in its posture. Enumerate visible controls and exercise their writes; fail duplicated Default, pose, pace, subject selection, history or operation configuration. Relation links may open the owner. |
| S2 Ordinary disclosure | Fresh and rich Presentation rest show identity, Focus, Views, Guide and the menu/content summary only. No Name/text narration field, Auto/Hints/derived badges, role/cue/speed controls, estimate, lifecycle/signal/Gate builder, station strip or exhaustive capability inventory. |
| S3 Core density | For canonical one-/two-View fixtures, identity, Focus, Default visual item, the second View when present, Capture view, Guide relation/action and menu are visible/hit-reachable without scrolling the Card body at 1440×900; the same holds once its sheet is opened at 1024×768. Subject identity/Present/Add doors and a representative use are similarly visible. |
| S4 Growth | More Views/uses use one named locally scrolling inventory, with identity, Capture and Guide doors retained. Long names, repeated names, at least six Stops and twelve Views cannot create document horizontal scroll, nested accordion stacks, lost selected identity or tiny-font fitting. Overflow menus are visible and keyboard reachable. |
| S5 Reach/geometry | Every required ordinary action/menu trigger/posture/return and active grip has positive rect, lies inside its host/viewport, and passes `elementFromPoint` or an equivalent true hit test. No Head/Guide/Deck/sheet/label covers another required hit target. Check corners as well as centers for overlapping controls. |
| S6 Stage dominance | Closed narrow sheets leave the continuous Stage usable; opened sheets overlay without Camera refit. Deep Edit Guide/Seam preserve accepted breadth and useful upper Stage/Card identity. Deep Guide is `<40%` viewport height at both review sizes, reserved in layout; sparse content does not fill that budget. Fisheye/triptych structure is reviewed, not replaced by equal empty cards or a growing body overlay. |
| S7 Camera density | Precision has no six-property dashboard, duplicate precise entry or concurrent full numeric form. One active tape, quiet passive rig, one posture/return home; no collision with Head, Guide rail, frame gate or selected identity. Outside geometry is evaluated; Through remains clearly authoring. |
| S8 Selection/state | Stage/row/tile/Stop/connection selection agrees with canonical identity. References/task focus/hover remain subordinate and distinct; active lens/posture is neutral. No selected geometry DOM box/blurred shadow; quiet contour/tint preserves artwork/grid. Keyboard focus has an independent non-hue cue. |
| S9 Language | Ordinary Presentation/View groups reject `Show · unordered Set`, internal `entry`/`choice` role labels, `derived`, raw adapter IDs/kind/channel/source-editable and internal scope fields. Stop's deliberate **Entry** control is valid product language. Shared Head rejects transaction counts and fake Saved. Scope tests to UI labels, allowing user-authored names, useful reach explanations and precise technical terms at deliberate depth; no blind text replacement. |
| S10 History/status | Undo/Redo enabled state and action labels are truthful; no count badge or count-derived save state. Session only correctly describes this executable. Failed/canceled edits add no history; navigation/sheets/menus remain outside Undo. |
| S11 Visual grammar | Full-window verdict checks PLATE chassis/paper/instrument roles, warm UI/technical measure type, role-sized controls, hierarchy, semantic color/line species and contrast. No nested shadow dashboards, arbitrary local type scales or ambiguous enabled/disabled states. No typography/brand redesign. |
| S12 Accessibility | Keyboard-only Select→Present→rename→View/menu/default→Edit Camera→return and subject chooser→audition→capture/Cancel work at both sizes. Search/chooser/menu/sheets have named controls, coherent focus entry/Escape/return and live refusal. Non-pointer precision uses the same operation. Retain coarse-pointer target minimum 44×44 and reduced-motion endpoints; no shortcut steals text/numeric entry. |

### Guide-specific blocking contract

Use one Stop and a **six-Stop** sequence within the requested five-to-eight range,
including two occurrences of one Presentation, different entry policies, one Travel
and one explicit missing-reference warning. The warning companion need not appear in
every screenshot. Test the following at both sizes through real Guide actions:

| ID | Guide acceptance |
| --- | --- |
| GQ1 One Stop | One shallow named row, clear selection/count/Presentation relation, no disproportionate empty Deck. Entry/Next in Card and Head Preview Guide are immediately reachable; no full workspace required. |
| GQ2 Six Stops | Every identity/order position is recoverable with pointer and keyboard; current Stop is obvious, repeated Presentation occurrences distinguishable. One local order menu; transitions discoverable from selected Stop/connector without permanently exposing all writers. Overflow reveals selected Stop and never widens the document. |
| GQ3 Deep disclosure | Edit Guide deliberately opens the bounded fisheye; optional Compare Views adds read-only L2 and truthful spatial counterpart. No ordinary Gate/dwell/signal/coordination forms. No vertical scrollbar inside any Stop card, unbounded white panel, property writer in L2 or new shell region. Collapse preserves canonical Stop and Camera. |
| GQ4 Simultaneous narrow work | At 1024×768, keep deep Guide open while opening selected Stop Card sheet. Header/identity, Entry/Next, Guide count/Collapse and selected Stop/menu all pass true hit tests above/in their reserved hosts. Index does not overlap; Head navigation/Preview stays reachable; useful Stage remains visible. Do not close Guide before testing Card. No refit, document overflow or nested Stop-card scrolling. |
| GQ5 Uniqueness | At ordinary rest: one Head primary Preview Guide (or unavailable reason), zero Index/Deck/Card Guide Preview; one Edit Guide entry in rail; zero product Peek/Overview/Expand occurrence commands; one occurrence Entry/Next editor in Card; zero persistent reorder stacks. With menu open: one scoped Preview component, one contextual ordering host. At deep depth: one Collapse, no second Edit Guide command; optional single Compare Views at the selected Stop. Assert both DOM inventory and observed writers. |
| GQ6 Semantics/return | Order/repeat/remove preserves authored occurrence identity rules and Camera/Presentation truth; Stop overrides cannot mutate shared Presentation. View comparison/Seam/Stop/lens/Preview returns cancel incompatible proposals and restore correct context. Each history operation is one accepted transaction; disclosure/selection are zero. |

Stage's separate World framing action named Overview is outside GQ5's Guide-command
scope; do not fail or rename unrelated product actions through blind text matching.
Similarly, architecture-only internal `overview`/`occurrence` depth strings may remain.
The visual packet must judge control locality and proportions even when every geometry
assertion passes—the current 37.2%-height narrow example demonstrates why both are needed.

**State matrix:** exercise no selection/empty Experience; selected visible and logical
subject; fresh generic/environment and subject Presentation; one/two/many Views; no
Guide and existing/repeated Guide use; multi-subject and region focus; unresolved focus;
valid zero-View/unset-default; missing View/default/Stop override; C9.6 local removal and
repair/Undo; chosen operation/profile-loss; Edit Guide/comparison/Seam/precision; Plan/3D and parked
lens return. Functional fixtures cover this matrix; it is not a screenshot Cartesian
product. An empty state teaches one next action without offering inert future machinery.

### Existing proof to amend, preserve and run

Update `creator-check.sh`, `conformance-check.sh`, `experience-check.sh`,
`composition-check.sh`, `reconciliation-check.sh`, `browse-check.sh`, `visitor-check.sh`
and continuity paths to use the new homes. In particular, the current creator recipe
asserts separate Capture/narration/Operate/permanent subject rows; migrate its steps
while retaining authored/runtime results. Keep all existing pure Camera/Experience,
MP2 scope/Guide and Travel/agency suites and the World A–F/numerical/lifecycle axes.
Replace the old Overview→Expand and Deck/Card Preview selector recipes with the new
Guide posture/Head entry, retaining L0/L1/L2, neutral Set selection and runtime outcomes.
Replace `reconciliation-check.sh`'s collapse-before-Entry workaround with GQ4's
simultaneous state. The new axis must fail if duplicate Preview/Expand/order writers
or automatic L2 return, even when existing Guide height/hit tests still pass.

For replaced obligations, extend the existing mutation harness so the successor fails
when the old defect is restored and unrelated controls stay green: broken locator
wiring, generic Present using derived pose, lost rich-editor reach, duplicated pace
writer, preview mutation, stale selection/Camera return, stale Seam membership,
automatic Guide expansion, duplicate Guide command hosts and suppressed shared Ask.
Do not mutate the original checkout or weaken tests to bless moved controls.

Implementation inner loops run affected pure/browser tests and rendered inventory;
final integration runs the complete prototype suite and all registered World/Experience
axes plus packet capture and the relevant mutation checks. Required commands include:

```sh
node --test prototypes/spatial-authoring/tests/*.test.mjs
QA_SHOT=0 bash prototypes/spatial-authoring/qa/run-all.sh
bash prototypes/spatial-authoring/qa/mutation-check.sh
npm run test:arch
npm test
npm run check
npm run build
git diff --check
```

Retain donor tests/typecheck as required by the C9/conformance preservation contract;
do not claim the donor is superseded by this UX slice. Root workspaces do not run the
prototype, and production shell role/ownership/a11y tests do not cover its DOM: new
prototype checks must actually run against this executable. Repository verification
is unconditional under [the test contract][tests], despite prototype-only code scope.
Use its lane/closeout rules, including any separately required heavy/perf gates.

Prior records and this audit confirm a missing P23B `40-walls.json`, imported by
[p23b-fixtures.ts][p23-importer]. This is an external repository-gate dependency, not a
UX exception. Re-run gates and record exact failures against the final revision;
restore the authoritative fixture only under separate scope. Never generate a stand-in,
skip its import tests, claim global green or merge/close while required gates are blocked.

## 11. Bounded screenshot acceptance packet

Capture **fourteen full-window PNGs**, DPR1, through real product recipes after the final
executable freezes. Reuse existing authored fixture loading and the QA readiness/
browser lifecycle. The future packet folder is `experience-ux` under the retained
screens directory; add one capture/review manifest beside the existing QA manifests.
Never overwrite historical S0–S9, C1–C8, V2 or donor specimens.

| State | Viewport | What the reviewer must judge |
| --- | --- | --- |
| P1 Selected Machine, resting subject Card | 1440×900 | Identity, restrained Stage selection, actual-use rows and Present/Add doors; no capability-control catalogue or persistent Scene inventory. |
| P2 Fresh subject Presentation, one Default, no Guide | 1440×900 | Clear Card identity/quiet Focus, useful Camera thumbnail, Default marker, Capture/Guide/menu visible; no creation ceremony or advanced stack. |
| P3 Two-View Presentation with authored narration/behavior and ordinary six-Stop Guide | 1440×900 | Unordered visual Views plus spatial constellation; quiet content summary and shallow named Guide/order/connectors; one Head Preview, no extra Stop editors or scripting disclosure. Covers ordinary multi-Stop Guide. |
| P4 Edit Guide, selected repeated Stop, Compare Views invoked | 1440×900 | Bounded L0/L1/L2 density, occurrence versus shared Presentation, schematic/spatial unordered Views, stable Card identity/Entry/Next and Collapse; no giant empty panel, Camera graph or duplicate writers. Covers deliberate deep posture. |
| P5 Edit Camera Outside | 1440×900 | Truthful observer/target/framing, selected View/owner/reach, spatial grips, one active tape, quiet return/posture; no floating property dashboard. |
| P6 Edit Camera Through | 1440×900 | Usable composed image/frame gate, one active grip, authoring chrome, complete identity/return and no pace/role/cue machinery. Compare directly with P5. |
| P7 Selected Travel connection in Plan Seam | 1440×900 | Triptych, explicit coverage/gap, selected connection and single central Pace, Stage-only route/anchors; coordination available but not automatically expanded. |
| P8 Generic environment Presentation from an authored viewport composition | 1440×900 | Captured composition agrees with thumbnail/Look through; environment focus is a peer moment, no object requirement/species menu/nesting. |
| P9 Two-View Presentation Card sheet | 1024×768 | Identity/Focus/both visual items/Capture/Guide/menu visible without Card-body scrolling; no overflow, occlusion or Camera refit. |
| P10 Subject Search/Index sheet with occluded and logical result | 1024×768 | Complete lookup names/reasons, keyboard focus and separate Select/navigation; actual selection Card remains recoverable; no parallel Scene list. |
| P11 Camera Through, active target/framing grip, compact Guide | 1024×768 | Clear image, one tape/posture/return, no grip/Guide/Head/identity collision, dominant Stage and correct narrow selected-identity access. |
| P12 One-Stop Guide, new Stop selected in Card | 1440×900 | Small proportionate named rail, obvious selected Stop/Presentation relationship, local Entry/Next and discoverable Head Preview; zero Expand/Overview/duplicate Preview. Covers one-Stop Guide. |
| P13 Ordinary six-Stop Guide, later repeated Stop selected in Card | 1440×900 | Named order/selected occurrence, single Deck order menu and transition door, visible Entry/Next; no shared Meaning/View editor or dispersed Preview/reorder stack. Covers selected Stop with inspector. |
| P14 Six-Stop Edit Guide with Compare Views and Stop Card sheet simultaneously open | 1024×768 | Reserved band `<40%`, reachable Card identity/Entry/Next and Guide Collapse/selected Stop, useful remaining Stage, no Index overlap/nested Stop scrolling or close-before-Card workaround. Covers narrow Guide. |

Companion states (empty, invalid focus/default, unlink repair, operation chooser, Plan
capture/Preview, advanced coordination) are asserted in the state matrix and inspected
through their real journeys. Reuse the existing QA-5 coordination proof after deliberately
opening Coordinate; it is not an extra new packet permutation. If a companion reveals
a material design failure, add its one diagnostic capture to the finding; this does not
waive or silently expand the canonical packet. The fourteen captures include five
explicit Guide judgments (P12, P3, P13, P4, P14); three added Guide frames reuse the
same one-/six-Stop fixtures rather than multiplying View, connection and viewport cases.

Each packet entry records exact commit/dirty paths, fixture identity, reproducible
product actions, viewport/DPR, fonts/readiness, canonical selection/task/depth, source
digest and actual/requested Camera/Stage rect in a read-only sidecar. Capture settled
states at matching provenance, with Presenter/debug overlays closed. Do not set a
target pose through a harness API to make a screenshot look good.

The written verdict for **each PNG** contains Pass/Fail and evidence for: information
homes, resting/disclosed controls, density/reach, selection/state, Camera/spatial truth,
PLATE material/type/contrast and responsive/return context. Compare relevant accepted
boards, the current baseline and the new packet, naming which accepted exposure rule
has been deliberately amended. Mandatory pairs: P1→P2 (explicit Present, identity),
P2→P3 (content/Views grow without machinery), P3→P13→P4 (ordinary Guide → Stop
identity → deliberate comparison), P12→P13 (one Stop versus repeated multi-Stop), P5↔P6
(same Camera authority), P7 versus advanced QA-5 (coordination is deliberate), P3↔P9
and P6↔P11 (narrow composition), P4↔P14 (deep Guide and Card coexist). Any dimensional Fail blocks acceptance. Owner visual
review remains a gate; screenshot existence, selector visibility and a green test count
are insufficient.

## 12. Deferred work and review decision

Deferred: production schemas/F interfaces and package cutovers; Paper PA0–PA12; real
audio/media/resource authoring; full narration/scripting workspace; unrestricted code,
timelines or trigger languages; new multiselection/room/nearby search semantics;
abstract/unspecified persisted focus; independent observer/target inverse gestures,
Camera lens/eye schema or general gizmo; legacy
View-speed migration; global Camera deletion/graph cloning; broad World typography,
brand/settings/rail redesign; multiple Experiences/Guides beyond current prototype
capability. Existing supported advanced behavior remains editable and executable.

**Owner review decision:** accept or amend the explicit exposure changes in §1 and
this bounded scope/sequence. The recommended choices are resolved here: preserve the
C9 gate order, consume C9.6 repair/C9.7 coordination/C9.8 precision, keep scalar selection,
use neutral initial Camera editing, put Preview in Head and Stop properties in Card,
retain bounded deliberate Guide/L2 comparison and real advanced semantics, and report
Session only truthfully. §8 separates stable design and bounded C9 home recommendations
from the exact contracts awaiting each remaining slice. No product
decision is left as TBD and no missing source prevents this plan's core recommendations.
Pending C9 human acceptance and the external fixture are execution dependencies, not
permission to weaken this UX contract. Do not begin code changes until the owner accepts
the plan and its applicable dependencies are satisfied.

[prototype]: ../../../../../prototypes/spatial-authoring/README.md
[current]: ../../../../operations/current.md
[c9]: ./authoring-completeness-plan.md
[c9-proof]: ../../../../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md
[conformance]: ./conformance-plan.md
[conformance-proof]: ../../../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
[plate]: ../../../../reference/design-system/editor-shell-and-visual-system.md
[ratifications]: ../../../../reference/design-system/editor-shell-ratifications.md
[p23-qa]: ../../../p23-layout-depth/p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md
[north-star]: ../../../../reference/north-star.md
[direction-ratification]: ../../../../reference/decisions/northstar-ratification-2026-09-27.md
[lens-amendment]: ../../../../reference/decisions/world-experience-reconciliation-2026-09-29.md
[architecture]: ../../../../reference/architecture.md
[foundation]: ../../../../reference/composition-execution.md
[camera-contract]: ../../../../reference/components/camera-tour.md
[v2-design]: ../../../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md
[v2-boards]: ../../../../../prototypes/integrated-experience-authoring/Design-QAs/
[world-design]: ../../../../../prototypes/world-experience-shell-round/design/design-synthesis.md
[world-boards]: ../../../../../prototypes/world-experience-shell-round/QA-package/
[current-pngs]: ../../../../../prototypes/spatial-authoring/screens/experience-conformance/
[qa]: ../../../../../prototypes/spatial-authoring/qa/README.md
[tests]: ../../../../../apps/editor/tests/README.md
[experience-code]: ../../../../../prototypes/spatial-authoring/app/experience.js
[model-code]: ../../../../../prototypes/spatial-authoring/app/experience-model.js
[capabilities-code]: ../../../../../prototypes/spatial-authoring/app/experience-capabilities.js
[experience-ui]: ../../../../../prototypes/spatial-authoring/app/experience-ui.js
[navigation-code]: ../../../../../prototypes/spatial-authoring/app/navigation.js
[camera-kernel]: ../../../../../prototypes/spatial-authoring/app/camera-evaluation.js
[p23-importer]: ../../../../../apps/editor/src/lib/bench/p23b-fixtures.ts
