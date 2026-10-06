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
| Accepted [V2 synthesis][v2-design]/[boards][v2-boards], accepted [World shell][world-design]/[QA][world-boards] | Useful unordered spatial View constellations, quiet Card, real fisheye Guide, central Seam, on-demand locator and spatial Camera instrument. The View specimens use observer/cone glyphs; they do not mandate rendered Camera images. Real View snapshots below are a new product recommendation, not a recovered settled requirement. |
| [C9 plan][c9]/[evidence][c9-proof], [C1–C8 conformance][conformance]/[acceptance][conformance-proof] | Narration, audition/capture, lifecycle, visitor choice and Travel are real. The ordinary narration field is not fake. Detailed density was explicitly assigned to this later slice. Removal and later rich-fixture acceptance are unfinished at the audit baseline. |
| [Experience commands][experience-code], [model][model-code], [capabilities][capabilities-code], [UI][experience-ui], [navigation][navigation-code], [Camera kernel][camera-kernel] | Existing focus variants, entry/choice roles and Stop overrides suffice. Descriptors already have labels/control metadata. Recommended framing currently fits only a first-subject point with fixed height. View speed is consumed by runtime, despite its poor product home. |
| [Stage][stage-code] constructor, geometry builders, restyle, Camera realization and inset; [frame wiring][main-code]; [Scene capability projection][scene-render-code] | One existing renderer/Scene can draw another evaluated Camera. The inset forces paper/no fog/ground and retains inspection geometry/effects, so it is not a clean thumbnail API. A bounded shared normal-World projection plus one small derivative render pass is required; no second Scene, compiler or Camera evaluator. |
| [Current QA guide][qa], creator/conformance/reconciliation/browse/responsive scripts; [repository test contract][tests] | Existing behavioral, geometry, picking, narrow-sheet and mutation proof is valuable. It does not protect the pruned visible-control inventory, visual View representations, no-scroll core density or advanced disclosure. Production shell tests inspect production components, not this static prototype. |

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
| V2 boards `Museum Piano Hall Tour Editor.png`, `Museum Tour Planner Interface.png`, `Museum Guide Planning Dashboard.png` | Keep quiet View inventory plus unordered spatial constellation; shallow Guide awareness; useful L0/L1 density and distinct occurrence identity. Their View representations are subject/cone glyphs, not Camera-composition snapshots; Stop L1 thumbnails are a different obligation. L2 proves disclosure, not author value. Real images and compressed ordinary Set placement are the bounded recommendation below, without restoring mandatory L2. |
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
| 7. Views and Default View; visual representation | **Accept language/ownership; recommend real snapshots for supported resolved Views.** A framing schematic describes Camera facts but cannot identify the actual crop, occlusion or subject appearance. The bounded Stage-owned image pass in §5 earns its cost for that author task. Constellation placement is directional and non-metric; the image itself is faithful. Keep roles, zero-View moments, neutral selection and explicit Look through. |
| 8. Spatial Camera editing | **Accept with bounded Camera work.** C9.8 already requires direct Stage grips, Camera Card detail, one active tape, postures and return. Consume that result instead of building another editor. Current observer/FOV are derived from a compact pose; do not promise independent free-eye/lens editing or make a new inverse/gizmo API a prerequisite. |
| 9. Pace belongs to movement/connection | **Accept the information home; reject blind data migration.** Hide ordinary View speed. Existing View speed still drives edge-free framing requests and estimates; preserve that runtime behavior. Normal Travel pace is authored once on the selected Camera connection. |
| 10. Guide sequences peers, not Presentation hierarchy | **Accept.** Repeated Stops retain distinct occurrence/visit identities. Spatial containment never creates a Presentation parent. |
| 11. Separate composition and scripting | **Accept immediate disclosure separation.** One contextual Advanced authoring task preserves existing writers. Do not design a new scripting document, workspace, language or execution system. |
| 12. Trail, history and selection cleanup | **Accept with two qualifications.** Keep local procedural/spatial return while removing routine view-mode trail. Keep a legible contour/quiet tint, including an accessibility halo where needed. This prototype has no persistence operation: remove its fictitious Saved/count status without replacement Head text; session lifetime belongs in help. |
| Follow-up: one ordinary Guide and one deliberate deeper posture | **Accept.** The existing lower Deck is the right home; use named compact Stops, bounded Edit Guide and sole Stop Card writers. Remove ordinary Expand. Compare Views/L2 is omitted by default; retain only if existing-task evidence demonstrates additional author value under §6's gate. |
| Follow-up: Preview next to the Guide rail | **Modify.** PLATE assigns Preview to the shared Head, and the runtime supports Presentation, Guide and Experience entry. Use one explicit Head Preview Guide primary when a Guide exists, with other supported scopes in its menu. No duplicate Guide Preview in Index, Deck or Card. See §6 for the complete placement and command decisions. |
| Review: Plan is not silently visitor content | **Accept the distinction.** Camera Plan is authoring context; ratified direction allows explicitly validated inspection capture. Present/Capture from Plan requires a deliberate visitor-View choice, never an incidental `flat` serialization or silent return to an old 3D pose. See §3. |
| View images around broad Presentation focus | **Accept with two bounds.** Use the existing renderer/Scene and shared Camera realization, with a session-only target/cache. Preserve coarse bearing and aim in a focus-anchored schematic; do not claim ordinary tile positions are true observer locations or geographic North. Focus resolves World truth, never the first View target or a synthetic Scene container. |

### Explicit exposure amendments proposed for approval

Acceptance of this plan should expressly approve these changes to PLATE §0.8.1/C9
authoring exposure for this prototype: composition-first ordinary Card; narration and
behavior writers reached deliberately; Present as aggregate first-View capture;
Auto/Hints retained as invoked recommended-framing options rather than a compulsory
ladder; Views/Default View ordinary language; removal of View movement preference from
ordinary UI; named compact Guide and bounded Edit Guide exposure instead of ordinary
Peek/Overview/Expand commands; shared Stop editors removed from the occurrence Card;
Head-only scoped Preview; no save-status replacement; explicit Plan capture intent;
existing coordination summarized until Coordinate is invoked; real rendered View
images and a non-metric ordinary Stage constellation anchored to Presentation focus.
PLATE/V2 currently place observer glyphs at spatial/map scale. This plan explicitly
changes ordinary **thumbnail label placement**, not Camera geometry: direction is
preserved, distance is compressed and exact observer/frustum/path truth stays in
Camera/Seam editing. The mandatory-image rule is new UX acceptance; historical
thumbnail styling was a non-contract. **PLATE's required L2
expanded-occurrence exposure becomes conditional author-value depth in this prototype,
omitted by default.** This expressly amends that exposure requirement, not Camera or
Stop semantics. Keep Set semantics, Scale × Depth, shell-owned Deck compositions,
scope/Ask, Camera ownership and all proved execution unchanged.
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
| Views and Default | Compact rendered inventory in Presentation Card; focus-anchored, non-metric working constellation on Stage | Same image/identity in both projections, with distinct inventory/spatial jobs and one action/menu writer. Tile menu owns Set as Default; selected View use Card states owner/current use. No ordinary graph or distance editing. |
| Guide/order/Stop identity | Named shallow Guide rail in the one lower Deck; Index Guide locator reveals/focuses that rail | Edit Guide opens bounded L0/L1 sequence in the same Deck. One Stop context-menu host owns reorder/repeat/remove. No Compare Views/L2 unless §6's author-value gate is met. |
| Stop entry/continuation | Selected Stop Card: Presentation relation, Entry, Next and transition door | Occurrence-local advanced policy is invoked deliberately; shared Presentation opens its owner. No property writer in the Deck comparison. |
| Preview | Shared Head: Preview Guide for nonempty Guide, otherwise Preview Presentation for the working moment or Preview Experience for eligible Experience-only content | Same Head scope menu exposes supported entries. No secondary visible Guide Preview command. |
| Camera View editing | Selected View → Edit Camera | One Camera Stage task, Camera-owned proposal/Ask and selected-identity Card; Outside/Through/Plan. |
| Transition Cut/Travel | Selected Seam's central Deck instrument | Experience transition policy references Camera support; explicit Travel prepares only missing support through Camera. Stop Card contains a summary/door. |
| Camera connection pace/path | Selected connection inside Seam | Exactly one pace writer in the central instrument; path/anchor gestures only on Stage. Card supplies identity/owner/reach. |
| Narration, behavior, offers, cues, lifecycle | Quiet indication when authored; subject Card shows actual uses | One invoked Advanced authoring task or selected Activity/Interaction Card. Operation-specific audition/configuration appears after a choice. |
| Station/invoke/Hold coordination | Seam summary/door when relevant | Deliberate Coordinate depth in the same Deck, mirrored with Stage; no permanent global timeline. |
| Source history | Shared Head | Undo/Redo verb labels/tooltips; no save-status text. Prototype session lifetime is explanatory help, not another Head item. Internal counts remain QA-only. |

| Current surface | Action in this slice |
| --- | --- |
| World/Experience switch, project/Experience identity, Stage and selected Card landmark | **Keep**; fix identity/header reach if obscured. |
| Experience Presentation rows and Guide locator | **Keep/simplify**; locator focuses the same Guide rail, with no duplicate Preview/editor. |
| Peek, Overview, repeated Expand controls and expanded Stop panel | **Replace/rename/prune** as compact Guide and bounded Edit Guide; ordinary Stop selection edits only Card. L2 comparison needs demonstrated value before retention. |
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
4. Select/open the new Presentation at ordinary depth. Its Default visual item and Stage
   marker are immediately usable. Create no narration, Activity, Stop, route or edge.

**Creation does not fly the authoring viewport.** The recommendation is visible in its
rendered View image; Look through is a deliberate action. An existing-use relation explicitly
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
the eligible current Camera after any explicit Plan-intent choice and uses environment
focus; it never falls back to
the selected object or `deriveFraming`. Name it **Untitled Presentation**, with immediate
optional row rename; naming is not a prerequisite to Preview.

Camera owns a bounded **snapshot-and-interrupt** operation: sample the live Camera,
stop any in-flight navigation at that sample, clear unaccepted Camera drafts without
jumping to a requested destination, and prevent a later queued tween overwriting it.
Then accept the same aggregate as above. If a draft is active, restore its accepted
authoring viewpoint before taking the sample; a proposal is not silently captured.

### Product ruling: Plan capture requires explicit visitor intent

**Plan is an authoring posture, not automatically a visitor View.** The current
[Camera contract][camera-contract] describes Camera Plan as graph/spatial authoring;
the shell's Plan posture locates Views and routes. Neither establishes that pressing
generic Present in Plan should silently publish that reading. The [ratified
direction][direction-ratification], “Inspection as a first-class creative act,” permits
explicit capture of eligible semantic parameters after validation. The existing
prototype Camera/runtime can realize `flat` poses, which supports a bounded explicit
Plan-View capture; that technical fact does not determine the default UX.

For **Present** or **+ Capture view** invoked in a Plan/flattened authoring reading,
open one compact capture choice anchored to the invoking command, using existing
shell disclosure rather than a new panel. Explain that visitors see World content
without authoring aids. Keyboard entry/Escape returns focus to that command; create
no source before the choice:

- **Compose in 3D** — invokes the existing Camera 3D return, using its normal return/home
  policy. It creates nothing; the author composes and invokes Present/Capture again.
- **Use plan as visitor View** — explicitly accepts the current normal-World plan
  composition as visitor intent and performs the same aggregate/capture command.
- **Cancel** — leaves source, history, selection and Camera unchanged.

Compose in 3D is the primary choice. Do not silently capture the last 3D pose, invent
an oblique recommendation, or offer a permanent menu of Presentation species. The
choice is contextual capture intent; it adds no Presentation/Camera kind or persisted
flag. An existing intentionally captured Plan View can still be edited/looked through
and used in Preview without repeated confirmation. If no prior 3D standpoint exists,
the explicitly chosen 3D action uses the existing Camera home, not an Experience framer.

Use Camera's reading/eligibility facts, including a parked flattened reading and
Plan-bound navigation, rather than inventing an Experience projection classifier.
The capture choice and canceled intent write nothing; a late flight or changed source
invalidates a pending capture and must be revalidated before acceptance. Only the
explicit Plan choice may capture a Plan reading. Perspective capture retains the live
snapshot-and-interrupt rule. Logical-subject Present and recommendation/capture options
obey the same eligibility rule when they use the current viewport.

Eligible Plan capture preserves target, azimuth, elevation, frame height, flat/mirror
through the same Camera evaluation and renders **normal World content**. Exclude editor
drafting grids, selection, route pins, gizmos and temporary Unroll/Section/Look aids; do not promise
those as visitor content. The tiny-FOV approximation remains existing prototype Camera
behavior, not a ratified production Plan/orthographic format. At equal aspect, Preview
must reproduce the captured eligible composition through the same kernel. If the
accepted executable cannot do so without a new representation/projection subsystem,
the Plan choice is unavailable with a truthful reason; Compose in 3D remains usable.
Do not expand this pruning slice to add that subsystem.

Do not serialize viewport dimensions, aspect locks, clip planes, image buffers,
Three objects, inspection recipes or shell state. World lens crossing already parks
temporary Unroll/Section/Look representation; capture the normal World at the held
Camera, never a displaced inspection as authored scene truth.

### Additional Views and focus

**+ Capture view** captures the actual eligible viewport through the same Camera
snapshot operation and explicit Plan rule above. It adds one Camera View/use in one history result; only the first
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

Render compact visual View items: a real Camera snapshot, name, Default marker and a
quiet menu. Card is the inventory/door; Stage is the working spatial composition.
They share the same cached image, canonical View-use selection and action/menu host,
not two editors. Image, name and a non-hue selected cue remain readable; no action
toolbar is painted across every image.
The default appears first for discoverability; the remaining display order is stable
session presentation, **not** authored progression. No numbered tiles, connecting
arrows, reorder handle, filmstrip or “next View” authoring sequence. Stage placement
does not follow this display order or move when Default changes. No permanent rig,
global Camera graph or generated proposal badge at rest. Guide editing still shows
Stop entry pins; Camera editing substitutes its precise instrument for this constellation.

**For a supported resolved View, a rendered snapshot is required.** A schematic cannot
tell an author whether a painting is cropped, a wall blocks the subject or two framings
actually look different. This is the additional value over the accepted cone-glyph
specimens. It is a meaningful bounded rendering feature in this UX slice, not already
supplied by the inset or pulled into C9.8. Schematics/placeholders are transient or
exceptional states, not the final ordinary representation of an otherwise supported View.

The image represents **that resolved Camera composition over normal authored World
content at a deterministic baseline**, not the result of executing its Presentation
or Stop. Keep authored visibility, static opening/material/light values and resource
appearance. Sample time-dependent authored playback at reference time zero; do not
run an Experience, audition, narration or visitor timeline to make an image. Behaviors
may change a visit later; the thumbnail does not promise that outcome.

Use the **current Stage content aspect**, the same aspect explicit Look through uses.
Camera stores vertical framing, not an authored aspect lock. A fixed thumbnail Camera
aspect would show a different horizontal composition, especially at 1024×768. Contain/
letterbox the image inside stable tile chrome; do not crop, retarget, fit the subject or
change FOV to fill the tile. Sheet opening does not resize Stage or invalidate images.
An actual Stage-aspect change does. Raster rounding may differ by at most one output
pixel; evaluation uses the recorded Stage aspect. This adds no persisted aspect field.

### Smallest safe image implementation

Keep this in the existing Stage lifecycle, with a small editor-only `view-thumbnails.js`
consumer/cache if separation helps. It is not a renderer service or new document domain:

1. Read an immutable resolved View/World generation. Use `navigation.resolvedCamera()`
   and `Stage.placeCamera` → existing `navigation.realize`/Camera kernel. An auxiliary
   Three projection camera, like the existing `peekCam`, is a consumer, not another
   Camera authority. Never apply the View to live navigation to take a screenshot.
2. Use **the existing Stage Scene and WebGLRenderer**, one reusable small render target
   and one serialized read/copy to a session bitmap/canvas. Card lies outside Stage's
   canvas, so scissored inset drawing alone cannot supply its image. No second renderer,
   Scene clone, document import/rebuild path, independent projection or pose interpolation.
3. Extract a bounded **normal-World render projection** from the current frame/restyle
   path; normal Stage/Look through and image capture consume it, with deliberate
   inspection/runtime values layered by their existing owners. It takes resolved
   Camera/World values and supplied Scene values without reading or advancing clocks.
   Image capture supplies baseline values, never a separate effect interpreter.
   Existing builders remain the only geometry
   lowering. Retain neutral wall/ceiling geometry handles alongside the current inspection
   variant and temporarily swap those handles; do not rebuild all architecture per image.
   Neutral handles refresh/dispose through the same source-update/build lifecycle.
4. Apply the projection inside a synchronous guard with `finally` restoration. Never
   await while shared Scene/renderer state is swapped. Copy/read pixels before restoring;
   asynchronous encoding may happen afterward against that detached copy. Then render
   the live frame normally, including refreshing any disturbed derived shadow state.
5. Publish only if View/source/aspect generation still matches. Failure restores live
   state and exposes a named image-error state with retry; it cannot leave the Stage in
   the thumbnail's Camera or representation.

The current inset is evidence that arbitrary-pose rendering can share the renderer,
**not** a sufficient clean pass: `stage.js` builds peeled/lifted geometry, restyles from
live Camera/display state, and its inset forces paper/no fog/ground. `main.js:frameState`
mutates clipping/caps/paper/shadows; `experience-scene.js:realizeCapabilities` changes
transforms/materials/visibility and a session clock. Merely hiding DOM/gizmos or copying
the current framebuffer would retain those changes. Extract shared projection inputs
and reuse builders/capability application; do not write a parallel Scene interpretation.

| State | Thumbnail policy / restoration obligation |
| --- | --- |
| Selection, hover, reveal/xray, proposed placement and away copies | Suppress highlights/helpers/previews; preserve live selection, hit targets and visibility afterward. |
| Unroll/peel/lift, ghost/hidden inspection, Section/Look clips/caps and drafting sheets/grids | Use normal geometry/materials and the View's normal projection. Restore geometry handles, transforms, visibility, materials, clips/caps and display state. No inspection recipe becomes Camera content. |
| Audition, temporary capability values, visitor overrides and animation phase | Apply authored baseline values without advancing/resetting audition, visitor or editor phase clocks; restore the live projected values. No visitor-time thumbnail work. |
| Background, fog, ground, lights, shadows, supported Plan reading | Derive settled normal-World appearance from this View, not the live Stage Camera/paper transition. Use the same normal profile for Look through/visitor-eligible projection; no forced paper-only inset style or new Plan projection. |
| DOM/SVG labels, Camera/route gizmos, rulers, chips, Preview and debug UI | Exclude from the image. Camera grips remain outside its rendered content when editing. |
| Renderer/GPU state | Restore target, viewport/scissor/test, clear state, clipping, output/color settings and shadow flags; refresh shared derived GPU state before the live frame if necessary. Restore on injected failure as well as success. |

### Invalidation, performance and exceptional images

Cache by **resolved pose fingerprint + committed World/Scene/resource generation +
Stage aspect + raster size + normal-render-profile version**. Relative focus motion
changes the resolved pose. Source commits/restoration, Undo/Redo, fixture replacement,
provider changes and asset-ready/appearance changes invalidate relevant images; a
conservative World generation is sufficient initially. Neither Undo depth nor
`View.revision` alone detects every change. Share a Camera image across its uses.
View/Presentation names, Default/use roles, Guide order, focus-only constellation
placement, selection, hover, audition, inspection and live navigation do not invalidate
pixels **when resolved pose and authored World appearance are unchanged**.
An actual Scene/focus-binding move does; merely renaming or changing the Presentation's
focus metadata does not retarget its Views or regenerate unchanged images.

Bound the pass: at most **one visible dirty image draw/readback per idle scheduler turn/
frame**, with an event-loop yield between jobs; selected/default visible images have
priority. Pause on input/drag/proposal, navigation/travel, Preview and hidden Experience
surfaces; no operation waits for a queue drain. A running synchronous pass may finish
before input is serviced, so it also has a **less-than-50 ms** pass budget on the settled
rich-fixture QA environment, not just a work-count limit. A warm
resting cache performs **zero** thumbnail draws/readbacks. Raster longest edge is at
most **320 pixels**, independent of DPR; keep at most **32** cached images plus the one
target and active detached copy. These are technical resource bounds, not shell metrics.
Reuse the target; dispose evicted bitmaps/URLs and neutral geometry when superseded,
and dispose all derivative resources on reset/teardown/context loss. Generation tokens
reject stale work after edit/Undo/resize. Do not re-render continuously for clocks or
retry a failed image every frame. Report cold/warm timing and retained-resource counts
on the rich fixture; cache/interaction bounds are blocking, not “optimize later.”
Reduce raster size within the cap or remove redundant projection/readback work if the
pass budget fails; do not substitute a permanent schematic or add another renderer.

Readiness exposes current pending/ready/error generations. Extend the existing QA
`render`/idle observation with a bounded visible-image drain/probe through **this same
scheduler**, yielding between jobs and reporting timeout/error explicitly. Existing
background-tab QA cannot rely on RAF advancing. This probe does not tick Camera,
runtime or capability clocks and cannot use a separate QA rendering path.

Loading keeps the item/name/Default stable with a quiet placeholder. Missing Camera
references, `unresolved` relative/fixed bindings or unsupported projection show a named
repair/unavailable placeholder; never render a guessed target, origin or stale last
image as current truth. An image failure offers contextual retry and the existing
Camera/repair door. A valid Camera may still have a real image when the Presentation's
focus is missing; mark that focus separately rather than conflating the two failures.

### Focus-centered, non-metric constellation

Ordinary Stage places snapshot tiles **around Presentation focus**, leaving the focus
and World visible. This is a schematic annotation over Stage, not a new map/workspace,
owned geometry, draggable layout or Camera graph. A quiet “not to scale” explanation
and orientation cue establish that tile position is approximate; only Camera/Seam
editing displays exact observer/frustum/path geometry. Do not add thumbnails over the
precision instrument or expose all Presentation constellations at once.

Resolve a read-only focus anchor/extent through the same neutral Stage/World extent
query required by recommended framing, with placed/local transforms already applied:

| Presentation focus | Center and representation |
| --- | --- |
| One resolved spatial subject | Neutral rendered extent center; existing Stage subject remains the visual center, with a quiet named focus marker if needed. No separate subject model/mesh. |
| Several subjects | Center of their resolved extent union; a quiet named group/count marker. Preserve references; this does not create a Scene group or Presentation containment. |
| Region | Center of existing focus bounds in their supported World frame; quiet area marker. It is reference metadata, not a new Scene container or persisted preview geometry. |
| Environment | Center of authored placed Layout/Scene extents, excluding infinite Stage ground, helpers, away copies and Camera geometry; quiet Environment marker. No artificial Museum object. |
| Logical/no spatial extent, empty environment, missing or partially unresolved focus | Named non-spatial/repair marker and unordered inventory; do not assign a false coordinate. Partial groups may show the known subset labeled partial, never as a resolved whole. No first-View-target or `[0,0,0]` fallback. |

The present `experience-ui.js:constellation` uses the **first View target** as center
and divides all distances by the farthest View. Replace both: Presentation use order
cannot determine focus, and adding one distant View must not collapse every nearby tile.

For each resolved View, evaluate observer `eye` and actual aim through Camera. Project
`eye − focusAnchor` into the current Stage's **horizontal bearing basis**, derived from
its evaluated Camera orientation (screen right and horizontal away/up). Preserve angular
side/bearing in that basis. In Plan this follows its real orientation; do not invent
geographic North or an authored compass. A rotated 3D Stage therefore rotates the
schematic bearings coherently instead of contradicting the visible World. Include
the Stage's actual display handedness/mirror in that basis; a represented View's own
mirror flag changes its image, not its observer's World position.

Use focus extent as the positive reference scale `s`, horizontal distance `d`, and a
bounded radius such as `rMin + (rMax − rMin) × d/(d+s)`. Obtain `rMin/rMax` from measured
center-marker/tile footprints and the available Stage host, reserving a clear central
focus area, Head, rail/Deck, Card and
open sheets. This compresses distance independently of the farthest View. It does not
encode meters, travel length/time, lens scale or route cost. Missing/degenerate extent
uses the named non-spatial state rather than a fabricated metric scale.

The directional glyph reflects **Camera aim**, including aim away from Presentation
focus; do not force every glyph/Camera target inward. Preserve above/below categorically
against focus extent where useful, not as a second metric axis or larger diagram radius.
A nearly vertical/coincident horizontal observer has no reliable bearing: use a named
above/below/coincident stack, with orientation still supplied by the image/Camera glyph.

Collision handling is deterministic by stable View/use identity, independent of Default,
Guide order or insertion-order sequencing. Allow bounded radial/tangential displacement
within the same bearing sector, then group crowded tiles into a local stack/count with
keyboard-accessible image disclosure. Retain each View in Card inventory. Never shrink
type/hit targets, drag the Camera to arrange thumbnails, auto-fit the Stage or spill over
the inspector. If the measured host cannot contain full image tiles, use compact
bearing nodes with deliberate image disclosure while Card retains the real-image
inventory; do not invent negative radii or an oversized diagram. If focus is outside/behind the current Stage, use a named off-screen
anchor/indicator in the safe host; do not imply that displaced marker is its true location.
The normal one-/two-View and four-direction cases must remain individually legible at
both review sizes; the twelve-View stress case may use these deliberate stacks.

Approximately preserve **bearing/side, Camera aim and useful categorical elevation**.
Distance is only compressed radial context; precise coordinates, height, inter-View
spacing, scale/FOV, path length and order are deliberately non-metric. No numbers,
progress arrows, inter-View edges, reorder handles or default-dependent placement.
Snapshot fidelity and placement fidelity are independent acceptance questions.

Tile/Stage marker selection changes the canonical **View use** and opens an honest
Camera View/current-use Card; it moves no Camera. Look through and Edit Camera are
separate actions. Tile menus provide Rename, Set as Default, Edit Camera and the
accepted C9.6 relation-removal action where supported. The selected View Card provides
owner/shared-use reach and Back to Presentation; it does not repeat the whole inventory
or carry Movement, entry/choice/cue controls.

Camera View name is canonical. Current Camera/use name duplication must not produce
different labels in editor and visitor: resolve ordinary labels from Camera consistently
(including visitor controls, Guide references and visual items), preserving only genuinely
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

Retain meaningful fisheye **L0 compact identity / L1 name, visual reference, entry and warning**.
The chosen Stop is obvious; nearby Stops remain identifiable and distant ones compress.
One horizontal sequence lane uses bounded useful item sizes, not equal blank cards.
Its heading/Collapse action stays reachable; item contents do not gain independent
vertical scrollers. Stop semantic property editing stays in Card.

**Default scope: omit Compare Views and L2 expansion.** Stop Card already identifies
shared Presentation, local entry and Next; Open Presentation reaches its visual View
inventory/Stage constellation; Seam supplies transition origin/destination context.
Do not add another simultaneous representation simply because C8/C9 proved it. In
ordinary and deep Guide posture Stage shows numbered entry pins, not View constellations
or Camera topology. Opening the shared Presentation deliberately returns to its normal
composition home and unordered Views, with correct selection and no Camera move.

**Conditional retention gate, before UX4:** use the existing C9 L2 prototype and
Presenter-closed task evidence; do not build a new comparison surface to justify itself.
Ask an author to distinguish the Default from two repeated Stops' different entry
overrides, predict local/shared reach, or understand eligible end Views before Travel.
Record the concrete question, actions, answer accuracy and actual friction using
Stop Card + Presentation Views + Stage/Seam. Retain L2 only if the existing comparison
demonstrably resolves a distinct author question or material difficulty that those
homes do not answer coherently, without obscuring Stage/inspector or adding writers.
Showing a panel, passing selectors or saving one click is not sufficient evidence.
No such value has been established by the inspected conformance proof. **Absent that
evidence, omit it and continue the slice; this is not a TBD or an acceptance blocker.**

If the gate is met and the bounded retention is recorded in the UX0 handoff, a single
deep-only **Compare Views** menu action may reuse read-only L2: Presentation summary,
resolved entry, reach/repair and schematically placed unordered View images with the Stage
counterpart. Both projections select the same use neutrally. View editing leaves
comparison for its normal owner. No Default/pose/Entry/Next/order writers are embedded;
comparison closes on Stop change/Guide exit and obeys the same height/reach budget.
This conditional branch reuses existing L2, not a new workspace or comparison engine.
Acceptance of this plan explicitly amends PLATE's mandatory L2/expanded-occurrence
exposure; C9's existing capability/structural acceptance remains intact until the UX
cutover, with successor proof for View selection, ownership and Camera neutrality.

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
| Expand occurrence / Expand on every Stop | **REMOVE** product commands; **REMOVE by default** L2 comparison | Retain a deep-only Compare Views action solely after the author-value gate above; proven availability alone does not earn another home. |
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
visual View representation and Preview never prepare routes.

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
no save/persistence operation exists here. **Do not replace it with permanent status
text.** Head contains Undo/Redo without Saved/Saving, Session only, transaction counts
or a reserve blank status slot. Explain session lifetime in existing prototype help:
“Changes last for this session; reloading resets the prototype.” Production Saved/Saving/Error remains the persistence
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
location/identity triggers. Opening a sheet/Deck/menu or generating a View visual never fits
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
| `app/main.js`, `app/ui.js`, `app/fixtures.js`, `app/state.js`, `index.html` | Shared subject locator coverage, neutral selection, on-demand Index, one rename writer, scoped Head Preview, remove status/trail clutter and keep chooser/capture-intent state session-only. |
| `app/navigation.js`, `app/camera-evaluation.js` | Camera snapshot/interruption and recommended extent framing through current constraints/evaluation. Reuse landed C9.8 operations; no new movement authority or inverse/gizmo requirement. |
| `app/experience-draw.js`, `app/experience-ui.js` | Focus-resolved non-metric Stage thumbnail placement and compact Card inventory; share images/actions. Preserve precise Camera/Seam and Guide disclosure. No graph/map/Camera editing in the constellation; L2 retention remains conditional. |
| `app/stage.js`, `app/main.js`, `app/experience-scene.js`; bounded new `app/view-thumbnails.js` if separated | Stage-owned image pass, one reusable target/projection camera and session cache; shared normal-World projection/neutral geometry handles and deterministic capability application. Use existing renderer/Scene/builders/kernel, restore live state, schedule/dispose through existing lifecycle. No second rendering architecture. |
| `app/experience-model.js`, `app/experience-runtime.js` | Reuse current roles/focus/Stop/Travel. Only bounded label resolution and C9.6 relation/repair consumption justify changes; no speed/lifecycle/evaluator rewrite. |
| `app/experience.js:buildExampleFixture/quickstart`, `app/conformance-fixture.js` | Adjust real recipe/control paths and add only authored initial fixtures needed for exceptional states. Current fixture/Presenter code is here; there is no `experience-examples.js` at this baseline. Consume any explicit C9.9 extraction, not an assumed file. No hidden final-pose/task/runtime preparation. |
| Existing `tests/*.test.mjs`, `qa/*-check.sh`, `qa/run-all.sh`, QA guide/manifest | Preserve proved behavior, migrate moved UI paths to semantic selectors, add explicit Experience shell/disclosure and packet capture proof. |

**No required persisted-model or descriptor addition.** Existing focus, entry/choice,
Stop override and Camera pose/connection shapes suffice. Required APIs are prototype
operation seams: aggregate Present, Camera live snapshot, useful recommendation fit,
shared locator coverage, canonical View label resolution, scoped Preview routing and
Camera capture eligibility/intent. Required **renderer/session APIs** are a read-only
neutral World extent query, shared normal-World projection and guarded Stage image read
with generation/disposal. These are genuine bounded additions; they are not persisted
Camera/Scene APIs, a renderer service or an F cutover. The existing point-only `worldOf`
is insufficient for group/environment extents; reuse neutral Stage builder output,
never inspect lifted geometry or reconstruct Layout. Image/placement caches, Guide
posture and chooser state are session derivatives, never authored state. C9.6 removal
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
| Views | Camera/use split, roles, reuse, cues, per-View speed and text inventory; glyph Set and first-target schematic; no clean image API; global remove helper unsafe for local tiles | C9.6 local/shared detach, revision/removal and binding repair; C9.8 selected Camera detail | Real snapshot inventory + focus-centered non-metric Stage constellation, Default and one selected-use owner; request preferences advanced | **Medium for C9 rework; meaningful new UX rendering work.** Image/placement recommendation **STABLE NOW**; unlink/Ask/repair **WAIT FOR C9.6**; detail **WAIT FOR C9.8**. Build the bounded Stage pass only in UX3, not C9.8; no C9 semantic or geometry rewrite. |
| Scene subject | Stage pick plus exhaustive list; descriptors render all controls; audition/capture works; shared Search rejects Experience | C9.6 provider replacement/gain/loss and compatible rebind; C9.7 native Wall/environment adapter participation | Stage + complete shared locator; identity/actual uses; chosen-operation flow | **Medium.** Selection/chooser home **STABLE NOW**; provider/repair interface **WAIT FOR C9.6**; exact Wall/logical discoverability **WAIT FOR C9.7**. Avoid new permanent descriptor chrome. |
| Guide / Stops | Optional Guide, separate visits, compact number rail and Stop Card; repeated Overview/Expand/Preview and shared fields | C9.6 order/removal leaves explicit links repairable; C9.7 routes/coordination; C9.9 Q5–Q8 and scope predictions | One named compact Deck, local Stop Card and bounded L0/L1 Edit Guide; L2 omitted unless author-value gate passes | **High if more writers spread now.** Single homes **STABLE NOW**; exact removal/repair **WAIT FOR C9.6**; stale route/event returns **WAIT FOR C9.7**. Keep C9 Overview/L2 proof until cutover; do not infer author value from it or prebuild a Compare Views replacement. |
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
  renamed Default; connection pace; no fictitious save-status chrome; explicit Plan
  capture intent; compact Guide + local Stop Card + deliberate bounded Deck; Head
  Preview and separate Presenter. Real resolved-View images plus non-metric
  focus-centered placement are the bounded UX recommendation; Compare Views is
  omitted absent demonstrated value. These are safe
  design recommendations to ratify now; their changed ordinary exposure still belongs
  to the UX slice unless the owner expressly approves a bounded C9 amendment.
- **WAIT FOR C9.6:** inspect actual copy/link/detach/rename/replace/regroup/removal
  APIs, reach/Ask and routed notice shapes, View unlink/default/Stop/cue consequences,
  profile gain/loss and missing-reference refusal. The operation homes above are settled;
  implement UX against the accepted operations instead of inventing substitutes.
  Include P5's Camera binding proof: current `actions.js:worldOf` uses
  `arcSNearCamera` for curved Walls, so that inspection point is not a stable authored
  Camera-focus anchor. Verify Follow focus resolution is independent of the live
  authoring Camera in the C9.6/C9.7 native-Wall case. Any repair belongs in the one
  canonical Camera/World resolver under that acceptance, preserving captured framing/
  binding semantics; never hide it with a thumbnail-specific resolver or cache rule.
- **WAIT FOR C9.7:** audit native Wall/logical inventory, stable event focus and
  counterpart IDs, Hold/invocation repair, selected-connection pace/anchor timing and
  return/disarm behavior. Recheck whether existing coordination disclosure can become
  summary-only without losing its truthful door. Consume the landed native adapter
  projection when isolating baseline images; do not assume all subjects have today's
  `capabilityParts` or invent another effect renderer. No new Guide workspace is required.
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
| Ordinary Expand plus an Expand on every deep card | **Recommend consolidation now if touched:** one selected-Stop deep-only existing L2 proof entry; no ordinary Card Expand, automatic expansion or second writer. Do not build a new Compare Views product for C9. Later UX omits L2 unless its author-value gate passes. |
| View Movement preference | **Implement existing C9 C3 detail placement now** when Camera/pace is touched; retain the request preference writer, connection Pace and runtime data. No migration. |
| Existing coordination auto-exposure | **Keep temporary accepted C9 exposure.** Moving it to quiet summary + explicit Coordinate needs this plan's disclosure amendment; C9.7 can reuse the exact local task either way. |
| Primary narration, derived framing + explicit Capture, old Overview label/layout | **Keep for C9 acceptance.** Aggregate Present, advanced-content separation, visual View inventory and full bounded Guide layout belong to the dedicated UX slice. |

These small home corrections can be accepted with this plan before remaining C9 work,
without pulling forward the whole redesign. If they are not accepted early, retain
the existing C9 exposure as temporary proof, record its replacement here, and avoid
adding further copies. This is an explicit recommendation for bounded exposure,
not an inferred authority override or a change to accepted capability scope.

## 9. Implementation sequence, each increment usable

| Increment | Dependency and bounded work | Acceptance before proceeding |
| --- | --- | --- |
| **UX0 — review and accepted baseline** | Owner accepts exposure amendments; C9 gates/repair/precision complete. Verify changed removal/capture/adapter/render evidence. Confirm the bounded shared-Stage image seam and L2 author-value result; absent value, omit L2. | No unresolved C9 dependency disguised as visual work; accepted scope/fresh provenance. No second Scene/renderer or speculative Compare Views requirement. Image work belongs to UX3a, not C9.8. No implementation starts merely because this plan exists. |
| **UX1 — complete locator and clean shared chrome** | Extend shared Search/Browse/keyboard/logical subjects, then remove Scene inventory. Remove counts/fictitious Saved and routine trail; retain return. | Every formerly listed subject reachable; selection/nav/history neutrality; both lenses and 1024 sheets usable. World shell/return regressions green. |
| **UX2 — deliberate operation and advanced homes** | Introduce subject actual-use Card/chooser and one Advanced authoring task. Move narration/builders only when their replacement doors/writers exist. | Creator narration/behavior/offer/capture/update/ambiguity jobs still execute; no capability inventory or empty advanced stack. Narrow flow and keyboard cancel/focus pass. |
| **UX3a — faithful View images** | Shared normal-World projection/neutral extent and geometry handles, deterministic capability application, guarded Stage render/read/cache and compact image replacement in the existing inventory. Use canonical View labels and accepted Camera realization. | TQ1–TQ5/TQ8 below pass before creation/pruning depends on images: fidelity, neutrality, failure restoration, freshness and bounded cold/warm work. Prototype remains usable; no second renderer/Scene/compiler or active-gesture readbacks. If the bounded seam is insufficient, report the concrete scope blocker; do not silently accept schematics or build a general render platform. |
| **UX3b — composition creation and spatial Views** | Aggregate Present, live capture/fit and explicit Plan-intent choice; quiet Presentation Card/rename/focus; real inventory, focus-centered non-metric Stage constellation and Default remapping. Consume C9.6 relation repair and UX3a. | New eligible moments immediately Preview; Plan never captured implicitly; zero/missing states honest; no edges. TQ6/TQ7 and visual/no-scroll Card gates pass at both sizes; selected images are recognizable and placements cannot imply exact Camera locations or sequence. |
| **UX4 — Guide, Seam and Camera reconciliation** | Named compact Guide, scoped Head Preview, bounded L0/L1 Edit Guide and sole Stop Card; single connection pace, deliberate coordination. Consume C9.8; omit L2 unless UX0 value gate passed using existing evidence. | One-/six-Stop and simultaneous narrow Deck/Card gates pass; no duplicate Preview/Expand/order/Entry writers. Guide/Travel/agency/coordination, direct Camera operations and neutral return stay proved; no new gizmo/comparison engine. |
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
| F2 | Capture live 3D/mirror/interrupted perspective flight through Camera with equal-aspect eye/target/up/FOV/frame correspondence within existing `0.002` tolerance and no queued jump. From Plan, generic Present/Capture creates nothing before explicit intent: Cancel is neutral; Compose in 3D is explicit navigation only. Eligible Use plan as visitor View accepts once and Preview matches normal captured World with no authoring aids. If unsupported, show truthful unavailability and usable 3D path; no new projection subsystem. Generic Present never calls subject auto-framing. |
| F3 | Subject/union/region recommended extent fit is Camera-owned and contains the requested extent at the current aspect. Logical/no-geometry subjects capture current viewpoint. Focus edits change references only, never retarget Views. |
| F4 | Search covers visible, occluded, off-screen, tiny/overlapping and logical subjects; repeated names disambiguate. Query/page/close are neutral; Select converges on `A.select`; navigation is a separate action. Source revision/profile loss invalidates derived locator facts. |
| F5 | Subject rest shows uses and no operation inputs. Chooser renders declared labels; range/toggle/playback chosen controls work. One active operation, zero writes for audition/cancel; capture/update/ambiguity/capture-another have existing semantics and named destination. |
| F6 | Narration, cue markers, suggestions, lifecycle/retention, offers, trigger versus target, availability, Gate and station/Hold remain reachable via deliberate doors and execute unchanged. Existing rich tests cannot be deleted because the controls moved. |
| F7 | View tile/Stage marker selection changes identity, never standpoint/source; explicit Look through works. Default change leaves Camera/Guide/explicit Stop overrides intact; all legitimate visitor choices/Travel origins survive. Rename agrees in Card/visitor/Guide/visual item. |
| F8 | Existing zero-View and unset-default states remain distinct from unresolved referenced View. Repair/dependent removal uses C9.6 contract; local unlink retains Camera and other uses. Undo restores exact authored references; no deletion-to-hold or silent first-row choice. |
| F9 | First Add to Guide creates/selects one Stop in the shallow named rail; repeated Stops remain distinct visits. Selecting a Stop preserves ordinary depth and edits Entry/Next only in Card. Order/repeat/remove use one Deck context operation with one Undo; default order reconnects, explicit refs stay repairable. Edit Guide and any value-gated comparison are neutral disclosure; no implicit expansion or Camera move. |
| F10 | Ordinary View UI has no pace writer; advanced Camera request detail writes only existing `View.speed` and preserves request/estimate correspondence. One selected connection writer edits only `connection.speed`, with Ask for shared reach. Neither edits/copies the other field. Only explicit Travel prepares support; gaps and live-start/same-View behavior remain truthful. |
| F11 | Retained C9.8 direct grips and keyboard/numeric detail share the existing patch/Ask/Camera writer and one history result. Pose/observer/frustum/frame geometry agree with realization; labels do not promise independent-eye gestures. Selecting a grip is neutral; Escape/lost capture/close clears proposal/hit targets with zero writes. |
| F12 | Every supported resolved View has a current rendered image after readiness. Snapshot/Look through realize the same Camera at the same Stage aspect; TQ1–TQ8 below prove baseline composition, freshness, state isolation, bounded work and non-metric unordered placement. No source/history/selection/navigation/clock writes or serialized derivative. Exceptional placeholders never present guessed or stale images as truth. |
| F13 | Plan↔3D and World↔Experience write no source/history; routine toggles create no semantic trail. Meaningful World return, Camera Put it back/Close, ordinary lens return, neutral revalidated Resume and exact Preview return retain their distinct contracts. |
| F14 | Presentation/Guide/interaction-only Preview use one isolated runtime, with frozen Layout/Scene/Camera/Experience snapshots and source history. No authoring DOM/hit targets active in visitor. Real-clock captions/effects, agency/rejoin/detour and exact exit remain proved. |
| F15 | Head Preview Guide starts the first Stop even when a later Stop is selected; its scope menu invokes the chosen supported entry once. Presentation Preview is never claimed as selected-Stop Preview. Only observational Presenter guidance accompanies Preview, with no authoring/source controls. Exact exit restores the originating Guide/Card/task posture. |
| F16 | Leaving Seam/Coordinate for Stop editing cancels/disarms stale route proposals and anchor-add handlers. Entry/route repair invalidates old coverage; Resume/Edit route revalidates selected connection membership before any patch. No ghost click authors an anchor. Stable C9.7 event/Hold focus identifies the authored item even when several share a station. |

### View image and constellation acceptance

Use a small authored fixture with distinct crops/occlusion, opposed bearings, a View
aimed away from focus, mirror and one deliberately supported Plan View. Include an
authored static capability value and a separate time-dependent baseline case. Invoke
**Look through through the real product action**; no harness assignment to a target
Camera pose. Existing numeric tolerance is `0.002`; authored identities/values compare
exactly. Raster equality is not the contract: same-Camera math, observable image
landmarks and a written paired visual verdict together establish faithful composition.

| ID | Blocking image/placement proof |
| --- | --- |
| TQ1 Camera fidelity | Record resolved View plus auxiliary and explicit Look through realization: eye, target, up, FOV, frame height, mirror, near/far and aspect. All evaluated numbers agree within `0.002` at the same Stage aspect; source pose is exact. No thumbnail-specific fit/FOV/crop. At each canonical size, compare a thumbnail with the downscaled World-content image from actual settled Look through, containing/letterboxing to the same aspect. |
| TQ2 Visual fidelity | Judge identifiable subject positions, crop, orientation/mirror, foreground occlusion, material/light/background/fog and supported Plan reading for the same clean baseline. At least two different framings must produce visibly different compositions. Same-profile fiducial centers/edges agree within one thumbnail pixel plus documented raster/antialias tolerance; overlays are outside the comparison. Static fixtures permit this comparison without resetting clocks. Running effects separately prove deterministic time-zero projection, not resemblance to an arbitrary live animation frame. |
| TQ3 Isolation/restoration | Dirty live selection/hover, audition, lift/unroll, Section/Look and paper transition; capture another View. Its image matches the clean authored baseline. Before/after compare source/history, canonical selection, live Camera, task/proposal, inspection/display/geometry handles, materials/visibility/clips/caps/lights and phase clocks. Inject failure after state/target swaps: `finally` restores CPU/renderer state and the next live frame is visually unchanged, including shadows. No thumbnail call to `frameOnce`, tween tick, reading mutation, Preview or capability-clock advancement. |
| TQ4 Freshness/cache | Change View framing/relative subject location, World/Scene appearance, provider/resource readiness; commit, cancel restoration, Undo/Redo and replace fixture. Re-render current pixels and reject delayed old generations. Resize Stage aspect and assert matching Look through; opening a sheet or DPR-only change causes no refit or needless image churn. View/Presentation rename, Default, Guide order, focus-only changes and hover/audition hit unchanged Camera/World pixels. Same-depth source replacement cannot reuse stale imagery. Native curved-Wall Follow focus must resolve consistently through the canonical Camera path before/after live navigation; no cache workaround for a resolver defect. |
| TQ5 Exceptions/lifecycle | Missing/unresolved View, unsupported projection, loading, failure/retry and missing/partial focus each have the §5 honest state. A valid Camera image may survive focus-only failure; unresolved Camera imagery cannot. Reset/teardown/context loss disposes target/bitmaps/URLs/retained neutral geometry appropriately. No image/placement/render handles are serialized or placed in Undo. |
| TQ6 Spatial meaning | Subject, multi-subject union, region and environment use their actual neutral World focus, independent of first-use order or Camera target. No fake Scene identity. Opposed bearings remain on opposed sides; Stage rotation/Plan orientation changes the display basis coherently. Aim-away, mirror, above/below and coincident observers remain honest. Far/near same-bearing Views have legible compressed placement; adding an extremely distant View cannot squeeze other tiles onto focus. Missing/logical focus gets no guessed spatial center. |
| TQ7 Density/unorderedness | Individually legible one-/two-View and four-direction compositions at both sizes; twelve Views use bounded collision stacks and one inventory rather than overflow or tiny labels. Focus/World, Head, Card, Guide and required hit targets remain usable. Stack disclosure has keyboard focus/return and distinct identity. Reorder the use array, rename/change Default or reorder Guide: no sequence arrows/numbers or role-driven spatial relocation; selection authors no Camera/edge/layout. Guide/Camera/Seam depth suppresses the ordinary constellation as specified. |
| TQ8 Work/resource bounds | Instrument draw/readback/cache/resource counts and synchronous pass duration. Cold visible set uses at most one job per idle turn/frame and the §5 target/raster/cache bounds; each settled rich-fixture pass is under 50 ms, with no thumbnail-attributable long stall. Warm rest, active navigation/drag/proposal/Preview and hidden surfaces perform zero thumbnail draws/readbacks. Repeat entry/exit, Undo, resize and loads: counts remain bounded, stale jobs cannot publish. Record cold/warm timing and no-image baseline at both sizes/DPR matrix; input pauses the next job and never waits for queue drain. Bounded readiness works with RAF stopped through the same scheduler, or fails explicitly on timeout/error. |

Retain two same-View diagnostic thumbnail/Look-through pairs (perspective and supported
Plan) with numeric/profile/aspect sidecars; use them at both review aspects in the
browser checks. They are local comparison evidence, not extra full-window product
postures. P2/P3/P5/P6/P8/P9 below still carry the shell/visual acceptance.

### Visible inventory, density and responsive gates

Canonical design review sizes remain **1440×900 and 1024×768, DPR1**. Retain the existing
**1280×800 and 1024×768 DPR2** projection/picking/no-refit automated matrix; these are
not additional screenshot permutations. Use actual Stage rect/active sheets to judge
reach, not obsolete 820×834 World shell dimensions.

| ID | Blocking rendered-shell rule |
| --- | --- |
| S1 Information homes | Every home in §2 has exactly one active writer in its posture. Enumerate visible controls and exercise their writes; fail duplicated Default, pose, pace, subject selection, history or operation configuration. Relation links may open the owner. |
| S2 Ordinary disclosure | Fresh and rich Presentation rest show identity, Focus, Views, Guide and the menu/content summary only. No Name/text narration field, Auto/Hints/derived badges, role/cue/speed controls, estimate, lifecycle/signal/Gate builder, station strip or exhaustive capability inventory. |
| S3 Core density | For canonical one-/two-View fixtures, identity, Focus, recognizable contained image/name/Default, the second View when present, Capture view, Guide relation/action and menu are visible/hit-reachable without scrolling the Card body at 1440×900; the same holds with its sheet open at 1024×768. No large Card constellation duplicates the Stage composition. Subject identity/Present/Add doors and a representative use are similarly visible. |
| S4 Growth | More Views/uses use one named locally scrolling inventory, with identity, Capture and Guide doors retained. Long names, repeated names, at least six Stops and twelve Views cannot create document horizontal scroll, nested accordion stacks, lost selected identity or tiny-font fitting. Overflow menus are visible and keyboard reachable. |
| S5 Reach/geometry | Every required ordinary action/menu trigger/posture/return and active grip has positive rect, lies inside its host/viewport, and passes `elementFromPoint` or an equivalent true hit test. No Head/Guide/Deck/sheet/label covers another required hit target. Check corners as well as centers for overlapping controls. |
| S6 Stage dominance | Closed narrow sheets leave the continuous Stage usable; opened sheets overlay without Camera refit. Ordinary thumbnail placement reserves actual shell/sheet hosts, keeps focus/World exposed and stacks collisions rather than covering controls. It cannot become an opaque diagram dashboard. Deep Edit Guide/Seam preserves breadth and useful upper Stage/Card identity. Deep Guide is `<40%` viewport height at both sizes, reserved in layout; sparse content does not fill that budget. Review fisheye/triptych proportions, not just geometry. |
| S7 Camera density | Precision has no six-property dashboard, duplicate precise entry or concurrent full numeric form. One active tape, quiet passive rig, one posture/return home; no collision with Head, Guide rail, frame gate or selected identity. Outside geometry is evaluated; Through remains clearly authoring. |
| S8 Selection/state | Stage/row/tile/Stop/connection selection agrees with canonical identity. Card image and constellation refer to the same View use; selecting either opens one owner and moves no Camera. Selection cues live in tile/Stage chrome, never in cached image pixels. References/task focus/hover remain subordinate; active lens/posture is neutral. No selected geometry DOM box/blurred shadow; quiet contour/tint preserves artwork/grid. Keyboard focus has an independent non-hue cue. |
| S9 Language | Ordinary Presentation/View groups reject `Show · unordered Set`, internal `entry`/`choice` role labels, `derived`, raw adapter IDs/kind/channel/source-editable and internal scope fields. Stop's deliberate **Entry** control is valid product language. Shared Head rejects transaction counts, Saved/Saving and Session only text. Scope tests to UI labels, allowing user names, useful reach explanations and technical terms at deliberate depth; no blind replacement. |
| S10 History/status | Undo/Redo enabled state and action labels are truthful. No stack count, fictitious save state, replacement session label or empty reserved status slot in Head. Prototype help explains reload/session lifetime. Failed/canceled edits add no history; navigation/sheets/menus remain outside Undo. |
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
| GQ3 Deep disclosure | Edit Guide opens bounded L0/L1 fisheye; default scope has no Compare Views/L2. If author-value retention is recorded, its read-only comparison/counterpart obeys the same bounds and owns no properties. No ordinary Gate/dwell/signal/coordination forms, per-Stop vertical scrollbar, unbounded panel or new shell region. Collapse preserves selection and Camera. |
| GQ4 Simultaneous narrow work | At 1024×768, keep deep Guide open while opening selected Stop Card sheet. Header/identity, Entry/Next, Guide count/Collapse and selected Stop/menu all pass true hit tests above/in their reserved hosts. Index does not overlap; Head navigation/Preview stays reachable; useful Stage remains visible. Do not close Guide before testing Card. No refit, document overflow or nested Stop-card scrolling. |
| GQ5 Uniqueness | At ordinary rest: one Head primary Preview Guide (or unavailable reason), zero Index/Deck/Card Guide Preview; one Edit Guide entry in rail; zero Peek/Overview/Expand occurrence commands; one Card Entry/Next editor; zero persistent reorder stacks. Open menus: one scoped Preview component, one ordering host. Deep: one Collapse, no duplicate Edit Guide and zero Compare Views by default; maximum one only after value-gated retention. Assert DOM inventory and observed writers. |
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
repair/Undo; chosen operation/profile-loss; Edit Guide/Seam/precision; value-gated
comparison only if retained; explicit Plan-intent/cancel/eligibility; Plan/3D and parked
lens return; real-image cold/warm/error/restoration and constellation coincident/above/
off-screen/partial focus. Functional fixtures cover this matrix; it is not a screenshot Cartesian
product. An empty state teaches one next action without offering inert future machinery.

### Existing proof to amend, preserve and run

Update `creator-check.sh`, `conformance-check.sh`, `experience-check.sh`,
`composition-check.sh`, `reconciliation-check.sh`, `browse-check.sh`, `visitor-check.sh`
and continuity paths to use the new homes. In particular, the current creator recipe
asserts separate Capture/narration/Operate/permanent subject rows; migrate its steps
while retaining authored/runtime results. Keep all existing pure Camera/Experience,
MP2 scope/Guide and Travel/agency suites and the World A–F/numerical/lifecycle axes.
Replace the old Overview→Expand and Deck/Card Preview selector recipes with the new
Guide posture/Head entry, retaining L0/L1 and runtime outcomes. The explicit L2 exposure
amendment replaces mandatory duplicate-projection counts with neutral canonical View
selection/ownership proof in normal Presentation/Stage homes; if value-gated L2 remains,
retain its counterpart checks too. Do not erase unrelated semantic/Camera guarantees.
Replace `reconciliation-check.sh`'s collapse-before-Entry workaround with GQ4's
simultaneous state. The new axis must fail if duplicate Preview/Expand/order writers
or automatic L2 return, even when existing Guide height/hit tests still pass.

For replaced obligations, extend the existing mutation harness so the successor fails
when the old defect is restored and unrelated controls stay green: broken locator
wiring, generic Present using derived pose, lost rich-editor reach, duplicated pace
writer, preview mutation, stale selection/Camera return, stale Seam membership,
automatic Guide expansion, duplicate Guide command hosts and suppressed shared Ask.
Include image-specific fault/mutation cases: stale same-depth source cache, live Camera
capture instead of resolved View, leaked inspection/audition, omitted `finally` restore,
first-View-target focus, max-distance collapse and Default-driven spatial ordering.
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
Record browser/device/GPU mode for image timing evidence; cold means image cache cold
over an already settled, resource-ready World, not an undocumented startup stall.

| State | Viewport | What the reviewer must judge |
| --- | --- | --- |
| P1 Selected Machine, resting subject Card | 1440×900 | Identity, restrained Stage selection, actual-use rows and Present/Add doors; no capability-control catalogue or persistent Scene inventory. |
| P2 Fresh subject Presentation, one Default, no Guide | 1440×900 | Clear identity/quiet Focus, real resolved-View image and compact focus-anchored placement; recognizable composition, Default and Capture/Guide/menu visible. No ceremony/advanced stack, selection pixels or schematic-only final View. |
| P3 Four-View Presentation with authored narration/behavior and ordinary six-Stop Guide | 1440×900 | Real distinct images around subject focus with coarse opposed bearings, useful aim, compressed spacing and explicit non-metric reading. No View sequence/edges or opaque diagram panel. Quiet content summary and shallow named Guide/order/connectors; one Head Preview, no extra Stop editors or scripting disclosure. Covers ordinary multi-Stop Guide. |
| P4 Edit Guide, selected repeated Stop | 1440×900 | Bounded L0/L1 density, occurrence versus shared Presentation, numbered Stage pins and stable Card identity/Entry/Next/Collapse. No L2/Compare Views by default, giant empty panel, Camera graph or duplicate writers. Covers deliberate deep posture. |
| P5 Edit Camera Outside | 1440×900 | Truthful exact observer/target/framing, selected View/owner/reach, spatial grips, one active tape, quiet return/posture; no floating property dashboard or ordinary thumbnail constellation over the rig. |
| P6 Edit Camera Through | 1440×900 | Usable composed image/frame gate corresponding to the same View thumbnail, one active grip, authoring chrome, complete identity/return and no pace/role/cue machinery. Compare with P5 and the TQ1/TQ2 image pair. |
| P7 Selected Travel connection in Plan Seam | 1440×900 | Triptych, explicit coverage/gap, selected connection and single central Pace, Stage-only route/anchors; coordination available but not automatically expanded. |
| P8 Generic environment Presentation from an authored 3D viewport composition | 1440×900 | Real image/Look through reproduce the captured composition. Environment center/marker derives placed World extents, excluding infinite ground/helpers; no object requirement/species menu/nesting or false point target. Focus is metadata, not geometry. |
| P9 Two-View Presentation Card sheet | 1024×768 | Identity/Focus/both contained real images/Capture/Guide/menu visible without Card-body scrolling; recognizable narrow-aspect composition, Stage constellation reserves the sheet, no overflow/occlusion/refit. |
| P10 Subject Search/Index sheet with occluded and logical result | 1024×768 | Complete lookup names/reasons, keyboard focus and separate Select/navigation; actual selection Card remains recoverable; no parallel Scene list. |
| P11 Camera Through, active target/framing grip, compact Guide | 1024×768 | Clear image, one tape/posture/return, no grip/Guide/Head/identity collision, dominant Stage and correct narrow selected-identity access. |
| P12 One-Stop Guide, new Stop selected in Card | 1440×900 | Small proportionate named rail, obvious selected Stop/Presentation relationship, local Entry/Next and discoverable Head Preview; zero Expand/Overview/duplicate Preview. Covers one-Stop Guide. |
| P13 Ordinary six-Stop Guide, later repeated Stop selected in Card | 1440×900 | Named order/selected occurrence, single Deck order menu and transition door, visible Entry/Next; no shared Meaning/View editor or dispersed Preview/reorder stack. Covers selected Stop with inspector. |
| P14 Six-Stop Edit Guide and Stop Card sheet simultaneously open | 1024×768 | Reserved band `<40%`, reachable Card identity/Entry/Next and Guide Collapse/selected Stop, useful Stage, no Index overlap/nested Stop scrolling or close-before-Card workaround; no comparison expansion by default. Covers narrow Guide. |

Companion states (empty, invalid focus/default, unlink repair, operation chooser, Plan
intent/cancel/eligible capture/Preview, advanced coordination) are asserted in the state matrix and inspected
through their real journeys. Reuse the existing QA-5 coordination proof after deliberately
opening Coordinate; it is not an extra new packet permutation. If a companion reveals
a material design failure, add its one diagnostic capture to the finding; this does not
waive or silently expand the canonical packet. The fourteen captures include five
explicit Guide judgments (P12, P3, P13, P4, P14); three added Guide frames reuse the
same one-/six-Stop fixtures rather than multiplying View, connection and viewport cases.
If L2's author-value gate passes, capture the retained comparison within P4 and P14
and record the qualifying task evidence; do not add a second mandatory packet. Real
images are judged within P2/P3/P6/P8/P9. TQ's two matched image pairs are diagnostic
World-content crops/sidecars, not extra full-window postures or a permutation matrix.

Each packet entry records exact commit/dirty paths, fixture identity, reproducible
product actions, viewport/DPR, fonts/readiness, canonical selection/task/depth, source
digest, actual/requested Camera/Stage rect and image render-profile/aspect/generation
in a read-only sidecar. Capture settled
states at matching provenance, with Presenter/debug overlays closed. Do not set a
target pose through a harness API to make a screenshot look good.

The written verdict for **each PNG** contains Pass/Fail and evidence for: information
homes, resting/disclosed controls, density/reach, selection/state, Camera/spatial truth,
PLATE material/type/contrast and responsive/return context. Compare relevant accepted
boards, the current baseline and the new packet, naming which accepted exposure rule
has been deliberately amended. Mandatory pairs: P1→P2 (explicit Present, identity),
P2→P3 (content/Views grow without machinery), P3→P13→P4 (ordinary Guide → Stop
identity → deliberate sequence editing), P12→P13 (one Stop versus repeated multi-Stop), P5↔P6
(same Camera authority), P7 versus advanced QA-5 (coordination is deliberate), P3↔P9
and P6↔P11 (narrow composition), P4↔P14 (deep Guide and Card coexist). Any dimensional Fail blocks acceptance. Owner visual
review remains a gate; screenshot existence, selector visibility and a green test count
are insufficient.

## 12. Deferred work and review decision

Deferred: production schemas/F interfaces and package cutovers; Paper PA0–PA12; real
audio/media/resource authoring; full narration/scripting workspace; unrestricted code,
timelines or trigger languages; new multiselection/room/nearby search semantics;
abstract/unspecified persisted focus; generalized image service, separate renderer/
Scene, persisted/exported image assets, occurrence/behavior preview thumbnails,
production image pipeline and a metric constellation/Camera graph editor; production
visitor Plan/orthographic format;
independent observer/target inverse gestures,
Camera lens/eye schema or general gizmo; legacy
View-speed migration; global Camera deletion/graph cloning; broad World typography,
brand/settings/rail redesign; multiple Experiences/Guides beyond current prototype
capability. Existing supported advanced behavior remains editable and executable.

**Owner review decision:** accept or amend the explicit exposure changes in §1 and
this bounded scope/sequence. The recommended choices are resolved here: preserve the
C9 gate order, consume C9.6 repair/C9.7 coordination/C9.8 precision, keep scalar selection,
use neutral initial Camera editing, put Preview in Head and Stop properties in Card,
require faithful real View images through one bounded shared-Stage pass and a
focus-resolved non-metric constellation, require explicit Plan visitor intent, keep a bounded
Guide with L2 omitted absent value, preserve real advanced semantics, and remove save
status without replacement chrome. §8 separates stable design and bounded C9 home recommendations
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
[stage-code]: ../../../../../prototypes/spatial-authoring/app/stage.js
[main-code]: ../../../../../prototypes/spatial-authoring/app/main.js
[scene-render-code]: ../../../../../prototypes/spatial-authoring/app/experience-scene.js
[p23-importer]: ../../../../../apps/editor/src/lib/bench/p23b-fixtures.ts
