# #112 — World Authoring Prototype implementation plan

**Date:** 2026-10-01. **Status:** plan written for owner review; implementation has
not started. All stages below belong to one bounded prototype-adoption PR, #112.
Stage boundaries permit independent review/commits; they are not production children.

**Target:** evolve [the existing prototype](../../../../../prototypes/spatial-authoring/README.md)
in place into the **World Authoring Prototype**. No parallel executable successor
directory, framework conversion, production cutover or predecessor deletion in this
planning change. Git carries the predecessor implementation.

**Routes:** [P26/T1 status](../../README.md) · [prototype family](../../../../../prototypes/README.md)
· [#111 design package](../../../../../prototypes/world-experience-shell-round/README.md).

## 1. Outcome and authority

Acceptance proposition: **the new World shell is executable without losing the
spatial depth that made P26 worth preserving.** This requires independent shell
contract and spatial regression proof; a screenshot match satisfies neither.

Authority by concern:

| Concern | Governing source |
| --- | --- |
| Product destination, domain ownership and lifetimes | [North Star](../../../../reference/north-star.md), [architecture](../../../../reference/architecture.md), [ratification](../../../../reference/decisions/northstar-ratification-2026-09-27.md) and its [World/Experience amendment](../../../../reference/decisions/world-experience-reconciliation-2026-09-29.md) |
| Common composition/execution shapes; production gates | [F](../../../../reference/composition-execution.md); [roadmap](../../../README.md); [P26/T1](../../README.md) |
| Destination shell and return laws | [PLATE §0.8–§0.8.3](../../../../reference/design-system/editor-shell-and-visual-system.md#08-accepted-destination-shell--unified-world--experience-direction-2026-10-01-pr-111); §0.7 material/state language and surviving typography/control roles |
| Detailed World design rationale and specimens | [#111 final synthesis](../../../../../prototypes/world-experience-shell-round/design/design-synthesis.md) and [QA acceptance](../../../../../prototypes/world-experience-shell-round/QA-package/ACCEPTANCE.md) |
| Deep spatial interaction oracle | P26 A–F in [journeys.js](../../../../../prototypes/spatial-authoring/app/journeys.js), surviving rules in [implementer reference](../../../../../prototypes/spatial-authoring/IMPLEMENTER-REFERENCE.md), [rationale](../../../../../prototypes/spatial-authoring/rationale.html), and behavioral QA |

The old shell, permanent exposure, Navigator/Inspector composition and return
presentation are superseded wherever §0.8 covers them. P26's numerical and spatial
invariants survive; its JavaScript/session/snapshot mechanisms establish no
production interfaces. [Camera](../../../../reference/components/camera-tour.md),
[Scene](../../../../reference/components/scene-content.md) and
[placement](../../../../reference/components/placement.md) contracts keep their
current/destination distinctions. World is a lens, not a semantic document.

The owner's #113 baton in this commission extends the prototype sequence recorded
at #111, which currently returns to F after #112. Routing must now carry #113 as the
next **prototype** step. F exact-interface work and T1/T2/T3 authorization remain
unchanged; an Experience prototype is not production Experience implementation.

## 2. Checked current state

### Baseline and proof limits

Freshly fetched `origin/main`, local `main` and the planning branch all began at
`e708bbf2652fa4afda03f6d802c87c15cb029e16`, the merged #111 result. GitHub confirms
#111 merged 2026-10-01. Its files are documentation/design/assets; it did not
implement a shell or change the spatial executable.

Planning audit on that revision:

- The retained A–F runner completed **50/50 steps**, with zero reported page errors:
  A 11, B 10, C 9, D 6, E 9, F 5. This is replay evidence, not 50 independent
  assertions of every invariant. `anim.run` catches command errors, and the runner
  mainly checks that each step returns; strengthen both observations in S0/S8.
- The retained interaction script passed **27/27 checks**: real head drag/release,
  refusal rollback, numeric validation/cancel, Tab continuity, focus treatment,
  view-only history exclusion, and pooled overlay attribute cleanup. It was run
  from a temporary copy with captures outside the repo; no baseline asset changed.
- A targeted Section → Face → Back probe restored depth `3`, Reveal `harbor`,
  selection and Camera state, with only floating-point roundoff in `frameH`.
  Selection and `Stage.resize()` left `camState()` unchanged. This directly supports
  those cases, not all nested returns or every responsive state.
- Read the ten-board QA index, relevant synthesis sections, and representative
  ordinary/Unroll/narrow boards. Their landmarks and disclosure are evidence;
  generated scenery, text drift and raster dimensions are not requirements.

### Implementation facts

| Subsystem | Verified current implementation | Implication |
| --- | --- | --- |
| State | `state.js`: `S.sel`, session, knife, trail, pending edit, refusal, preview-related state; `ctx.museum`, Stage and UI callback | Keep one selection slot; add shell disclosure explicitly rather than repurpose `sel` or hide it in a panel |
| Fixture | `model.js`: two galleries, four straight/circular walls, hosted openings, three ceilings, floors, seven artworks, bench and vessel; one floor datum `+0.15` | No Piano, multi-level architecture, reusable source model, internal component registry or attachment-repair workflow exists |
| Spatial commands | `actions.js`: KIND lifecycle, nest-vs-replace, isometric Unroll/peel, Section/depth/Reveal, Lift/Look-up, membership and visibility reasons | Reuse these operations; separate orchestration from shell presentation |
| Navigation | `actions.js`: `fly`, `camAt`, recipes, origin/parent snapshots, trail, `last3D`; `stage.js` realizes projection; `main.js` also writes Camera during input | One conceptual navigation seam is feasible, but ownership is currently spread across callers |
| Stage | `stage.js`: one working `PerspectiveCamera`, plus `peekCam` for an inset; `geometry.js` analytic caps; `main.frameState` derives flatness, clipping and paper | The inset is a passive preview, not a second navigable world; retain it on the same evaluator/projection path |
| Manipulation | `draw.js`: one opening kit and legibility gate; `main.js`: surface-based pointer math; `ui.applyField` and actions share validation | Preserve math and one edit path; rehome disclosure/writer lifecycle |
| Selection presentation | `ui.js` global gallery Navigator and always-deep Inspector; Stage highlight and overlays read `S.sel` | Card must remain selected identity while technical controls move into task depth |
| Shell | `index.html` Scene/disabled Camera spine, Layout/disabled Arrange pair, permanent Draw/Look tray, top strip, fixed side panels/status trail | Replace this composition; Draw buttons currently only report that drawing is outside the prototype |
| Presenter | `journeys.js`, J panel, query jump/replay, `window.__me` | Preserve A–F labels, behavior and reproducible entry points; rewrite shell-era narration and DOM assumptions |
| QA | Screenshot generator, review scripts, visual-refinement scripts/reports | Harvest assertion intent; old selectors, fixed waits, hardcoded sessions/ports and screenshots need adaptation |

### Material reconciliation findings

1. `recipeOf` currently mixes procedure parameters, Camera snapshots and nesting;
   `exitSessionInner` always returns spatially. Lens exit cannot call it unchanged.
   Park needs a teardown that leaves the current standpoint alone.
2. Flatness affects FOV and Camera distance. `main.frameState` derives it from the
   active session each frame. Clearing the session can move the **realized** eye
   even if `az/el/target/frameH` stayed equal. Preserve realized pose/framing at the
   navigation seam; a shallow state comparison alone is insufficient.
3. Candidate drags temporarily mutate the model under `S.pending`; repair preview
   uses `S.preview`; numeric writers and pointer closures have separate state.
   Current `pointercancel` clears handle state without calling `cancelEdit`.
   Unify cancellation before adding lens switching or replacing DOM during drags.
4. The selection setter itself does not move Camera, and task focus already differs
   from selection in hosted-opening work. But artwork Face recipes record the host
   as `focusId`; do not use that field as the parked task's motivating identity.
5. Current Esc at rest clears selection, and beacon/popover cleanup can intercept
   spatial exit. Adopt the §0.8 unwind ordering explicitly; do not preserve old
   key dispatch merely because A–F calls the old close action directly.
6. Keyboard shortcuts, editable tape buttons, fields, Tab and focus styling are
   evidenced. Navigator rows have `tabindex=-1`; keyboard handle nudging and
   screen-reader task announcements are not established. The old reconciliation's
   “not demonstrated” list predates the later 27-check proof; neither record alone
   describes complete current accessibility.
7. Rationale/review prose still describes blue selection and older shell promises;
   current CSS, Stage colors and visual-refinement evidence use ochre. Harvest
   behavior, not those stale appearance claims. Selection and paper materials also
   deserve explicit visual checking; see the [paper-surface brief](../visual-system-refinement/paper-surface-brief.md).

## 3. Reconciliation disposition

| Class | Behavior/assets | Successor treatment and preservation condition |
| --- | --- | --- |
| PRESERVE | A–F; same-model Plan↔3D continuity and intermediate tilt | Same identities and accepted source values; continuous rendered/picked projection; no replacement Stage |
| PRESERVE | Isometric Unroll, partial peel, side, seam/junction cues, Square up/Step back | Keep arc-distance formulas, legal intermediate stops and per-axis scale honesty |
| PRESERVE | Section preview, slide/turn/flip, finite depth, caps, nested host recovery, Include/Reveal | Keep membership/reason behavior and exact return; controls move into invoked work |
| PRESERVE | Ceiling lift/tab, closure vs suspended region, gap/meets/intended, consequence preview, Look-up/mirror | Keep accepted fix semantics, typed hidden-axis heights and view/source separation |
| PRESERVE | Wall constant/slope/gable tops; opening rectangular/round/pointed profiles; arch rise holds head | Keep validators and shared field/handle math, including closed-wall seam continuity |
| PRESERVE | Local precision, refusals, exact numeric access, one accepted gesture/edit, Undo/Redo, explicit exit summary | Same valid results and zero history on refused/canceled proposals; no Camera motion from Undo |
| PRESERVE | Find with reason, beacon/locator, label priority/declutter, as-built references, Wall grid | One visibility-reason path; no hidden subject deletion; material reading changes no source |
| PRESERVE | Motion speed policy, repeated-use acceleration, Shift instant, system/user reduced motion | Preserve endpoint meaning and access; measurements are observations, not new timing thresholds |
| REPLACE | Scene/Camera spine, Layout/Arrange pair, permanent tool catalogue, full Navigator/Inspector, top strip | World/Experience Head, local Index, stable identity Card, lower invoked Instrument |
| REPLACE | Global numeric flood and specialist actions at rest; old fixed responsive panels | Calm ordinary selection; task-local controls and compact invoked sheets at narrow desktop |
| ADAPT | Selection → Card; contextual relations → Index; spatial verbs → Look | Explicit verbs and one selected identity; relation/context navigation never writes selection implicitly |
| ADAPT | Procedure → Instrument; active writer/deep controls → Precision | Task target/focus distinct from selection; reading and corresponding Instrument activate/deactivate together |
| ADAPT | Find → Search/Open location/Bring into view/Reveal/Include/Face | Preserve reasons while separating identity, browse, motion and inspection actions |
| ADAPT | Nested return, chronological trail and Put it back | Owned by the one prototype navigation seam; visible current Instrument always accompanies restored reading |
| ADAPT | Task parking/Resume | New §0.8.2 behavior; retain accepted edits, cancel proposals, ordinary return and fresh validation |
| RETIRE AFTER SUCCESSOR QA | Old-shell screenshots, duplicate review rasters, superseded prose and scripts | Harvest unique rules/tests first; delete only against equivalent successor evidence (§10) |
| DEFER | Persisted references/formats, component selectable identity, shared-source/override semantics, Camera storage, production history, F interfaces | No simulated result is promoted as a solution to these contracts |
| DEFER | New architecture drawing, vertical crop/cut-only, cubic-wall deformation, compiler-based caps, generated ceilings/overlap joints, full large-museum proof | Not implemented in current prototype; #112 must not claim inherited coverage or build a T1 substitute |

“Preserve” means preserve the behavioral invariant, not old chrome or implementation
accidents. No requirement to byte-copy markup, narration, snapshots or geometry
buffers. With an unchanged baseline fixture, accepted source fields must compare
exactly; computed coordinates/projection compare with documented numerical tolerance.

## 4. A–F migration map

These six mappings are separate acceptance obligations. Step counts refer to the
checked predecessor, not a cap on successor tests. Presenter steps may be split to
explain invocation/Precision while retaining A–F and their original outcomes.

### A — Curved wall (11 predecessor steps)

| Required aspect | Mapping |
| --- | --- |
| Invariant | Garden window remains the subject while Rotunda unrolls isometrically; partial states remain editable; head held during rise; opposite jamb held during jamb drag; accepted edits survive return |
| P26 exposure | Selected opening handles/tapes and Inspector; dog-ear; top strip side/curvature controls; Square up, O, Step back; Esc and summary |
| #111 expression | Garden window Card; capability Look → **Rotunda wall · Unroll around Garden window** Instrument; curvature/side/Square up; Precision around the selected opening and explicit host-top task focus |
| Implementation delta | Separate initiating identity from host target; direct dog-ear invokes the same task before its first delta; move fields/dial to Instrument; keep partial peel and current-side initiation; route return centrally |
| Exact/semantic preservation | `rise=.45` holds head `3.40`; width `2.20`; sill `.70`; gable ridge `7.20`; arc-distance/seam/junction behavior; half-wrap height-only scale and flat two-axis scale. The journey's explicit selection of Rotunda at its host-top step remains explicit, not required by task plumbing |
| Obsolete UI | Inspector command/field stack, full permanent handle kit at rest, top strip and old tool rail |
| QA | Real peel drag stops at non-detent and `.5`; both sides; edit at `.5` in 3D; numeric fallback at silhouette; flat/as-built overlays; profile and jamb assertions; one-edit/refused-edit counts; exact return and retained four edits/summary. Compare intermediate opening registration, not only flat endpoint |

### B — Look inside (10 predecessor steps)

| Required aspect | Mapping |
| --- | --- |
| Invariant | Preview a free line before opening; finite depth and exclusion remain truthful; selected excluded subject stays selected; Face host nests and returns to identical cut/depth/standpoint; Include/Reveal are view operations |
| P26 exposure | K/permanent Open line tool, Plan peek, line/end grips, strip depth/flip, locator band/line, Inspector recovery |
| #111 expression | Contextual **Look inside this place** entry for architecture in current location (also K), without selecting a fake Room; Section Instrument has preview/aim/open/cancel; local plan locator; Search/Look recovery; current child task and return crumb |
| Implementation delta | Make aim/preview an invoked task with its Instrument; keyboard line definition/slide/turn/depth equivalents; unify recovery dispatch and nested current-task projection |
| Exact/semantic preservation | Baseline line `[-17,.25] → [13,.25]`, side `-1`, depth `6`; depth `3` excludes Harbor; nested Back restores depth `3`; Include reaches `4`; door head `3.20`; cut close returns Plan and retains explicit Reopen affordance. No Undo from cut/depth/Reveal |
| Obsolete UI | Permanent knife catalogue, Inspector recovery duplication, global locator when irrelevant |
| QA | Plan inset and 3D in-place preview; real slide/end-grip movement before Open; intermediate parting; membership/locator consistency for cut/in/away/beyond; Reveal leaves depth unchanged; Include reaches required depth; nested Face/Back preserves Camera/Reveal; door edit and close; canceled aim writes no source/history |

### C — Ceiling (9 predecessor steps)

| Required aspect | Mapping |
| --- | --- |
| Invariant | Lift is temporary; gap/meets/intended and closure/suspended distinction stay explicit; preview consequences before choosing a supported fix; Look-up nests; mirror/picking agree; hidden-axis heights remain typeable |
| P26 exposure | Wall Inspector gap, ceiling tab, overlay tethers/popover, hover fix preview, strip Look-up/mirror, soffit field |
| #111 expression | Quiet North wall relation warning on Card/Details; explicit Lift relation task; ceiling Instrument with tethers; invoked correction focus and Preview/Accept; Look-up Instrument/Precision with typed underside height |
| Implementation delta | Keyboard focus/activation must preview and cancel as well as hover; freeze options before preview; keep Card identity when a related ceiling/wall is task target; return/summary through navigation |
| Exact/semantic preservation | North wall `4.00` vs ceiling `4.20`, initial `.20` gap; deliberate raise to `4.20`; intended light slot; lift displacement `2.60` as reading; Look-up cut `1.60`; soffit `3.20 → 3.00`; accepted two edits survive close-all |
| Obsolete UI | Always-deep ceiling Inspector and repair popover as permanent shell furniture; old strip |
| QA | Partial tab drag and lifted endpoint; tethers and last-known as-built outline; lower-ceiling preview leaves source/history unchanged on cancel; accept raise exactly once; mirrored projection and picking; numerical soffit access without misleading vertical drag; unwind Look-up → Lift → ordinary; accepted source vs temporary state assertions |

### D — Fast repeat (6 predecessor steps)

| Required aspect | Mapping |
| --- | --- |
| Invariant | Experienced work remains fast and reachable; shortcuts and gesture verbs invoke equivalent work; same-kind hop replaces, different-kind nests; explicit chronological return restores complete reading/standpoint independently of Undo |
| P26 exposure | Status Motion group, Reduce motion button, O/F, Esc, `[ ]`, strip/trail recipes |
| #111 expression | Discoverable motion preference separate from reduced motion; shortcuts enter the same Look/task dispatcher; centrally owned navigation trail/Put it back, current Instrument visible on explicit reading restore |
| Implementation delta | Remove permanent specialist catalogue without removing expert entry; keep a single shared trail across lens movement; restored targets revalidate; no per-lens Camera memory |
| Exact/semantic preservation | Adaptive first-two/then-brisk policy, Teach/Brisk/Instant/Shift behavior; same endpoints under reduced motion; Rotunda → Entrance replaces Face ancestry; explicit trail restores curvature/side/Reveal/mirror where recorded. Exact timings need not match recorded milliseconds |
| Obsolete UI | Full permanent Motion/trail furniture and old navigation crumbs; lens-specific return snapshots are prohibited |
| QA | First/repeated command accessibility; interruption finishes consistently; same-kind hop then Put it back; complete recipe restore, zero view-only Undo; reduced-motion endpoints/captions/CSS; explicit trail restoration is distinct from lens return, which never resumes |

### E — Everyday edit (9 predecessor steps)

| Required aspect | Mapping |
| --- | --- |
| Invariant | Ordinary Plan/3D manipulation and local precision are available from the current standpoint; projection controls legibility, not a mode-specific edit system; wall reading/material toggle changes no values; Undo changes building without moving Camera |
| P26 exposure | Plan tilt bead, selected opening kit in all standpoints, Inspector values, F/profile handles, Wall grid/G, exact Esc summary and Undo |
| #111 expression | Minimal selected identity + Look/Details; explicit **Edit dimensions here** task or first direct manipulation invokes Instrument/Precision in place, with no automatic Face; tilt stays spatial navigation; profile work may explicitly request Face |
| Implementation delta | The first edit gesture opens its task without swallowing the gesture; keep one kit and pointer math after invocation; move numeric fallback to Instrument; preserve existing profile-facing constraint |
| Exact/semantic preservation | Position `6.40`, width `2.00`, head `3.80`, rise `.60`; Plan withholds height handles but not typed values; intermediate `el=.8` gains readable handles; Face returns to that tilted standpoint; G changes no pose/selection/value; two Undos restore rise/head |
| Obsolete UI | Full Inspector and specialist handle/tape cluster merely from selection; Layout/Arrange pair |
| QA | Real Plan slide/jamb drags, intermediate tilt with stable selection, real 3D head and face rise edits; handle gate and numeric equality; grid off/on displacement cues; exact Face return; Undo/Redo model and Camera assertions; same tasks usable without pointer |

### F — Where did it go? (5 predecessor steps)

| Required aspect | Mapping |
| --- | --- |
| Invariant | Names/references find the actual subject and explain visibility from current reading; selecting does not move Camera; recovery is explicit; Face another host replaces same-kind work rather than corrupting nesting |
| P26 exposure | `/`/Cmd-K finder, nine-row result limit, beacon, Inspector “where”, Look at it/Face it; Tide then Harbor set aside |
| #111 expression | Search results with reasons and independent **Select**, **Open location**, **Bring into view**, **Reveal/Include/Face**; conditional selected-elsewhere recovery; Card remains canonical identity |
| Implementation delta | Remove fixed nine-result truncation through scrollable/paged bounded results; shared reason presenter; explicit row verbs; hover/focus result is not selection; recovery uses typed task targets rather than replacing Card with host |
| Exact/semantic preservation | Tide behind Rotunda from baseline; Harbor set aside while facing Rotunda; explicit Face Tide/Harbor resolves their actual host; selection/beacon is view/session state; no source/history writes from search/recovery |
| Obsolete UI | Modal pick combining result action, permanent global hierarchy and duplicate Inspector action catalogue |
| QA | Keyboard and pointer search; names/references/repeated names; more than nine results; empty state; independently test every verb's selection/context/Camera/source effects; off/behind/aside/beyond/away reasons; Beacon and Reveal remain at true source position; actual shell entry assertions alongside presenter replay |

## 5. Smallest credible implementation architecture

Retain static ES modules, vendored Three, one canvas and keyed overlays. Nothing in
the repository requires Svelte/Threlte conversion for this non-workspace prototype.
Keep mathematical helpers unchanged unless a failing preservation proof identifies
a specific integration defect. Do not copy production domain/evaluator code into it.

### Subsystem/file change map

Existing file names below are relative to
[the prototype root](../../../../../prototypes/spatial-authoring/README.md).
New leaf names are proposals, not existing routes or production API contracts.

| Existing subsystem | Disposition | Planned change |
| --- | --- | --- |
| `vendor/three.module.js` | KEEP AS-IS | No dependency upgrade |
| `app/model.js` | KEEP math/validators; ADAPT fixture lookup only as required | Preserve baseline IDs/values, frame functions and validators; optional fixture metadata stays separate |
| `app/geometry.js` | KEEP AS-IS | Existing wall/slab/cap algorithms; no new compiler/cubic generalization |
| `app/stage.js` | ADAPT narrowly | Keep realization/picking/preview; expose realized pose/framing checks; neutral teardown and bounded fixture rendering/guards only where needed |
| `app/overlay.js` | KEEP AS-IS unless a new-state test exposes a defect | Keyed pool, priorities, stale attribute cleanup |
| `app/draw.js` | ADAPT exposure | Preserve kit, legibility, dimensions/ghosts; render specialist kit for invoked manipulation task; new task-focus/reference styling and local refusal proposal |
| `app/state.js` | ADAPT | One canonical selection; explicit lens, browse/disclosure, task/focus/depth, writer and parked context; no lens selection memory |
| `app/actions.js` | ADAPT orchestration | Retain spatial operations and source edit helpers; extract navigation ownership, add neutral reading teardown and current-standpoint activation; no Instrument-owned origin/history |
| `app/main.js` | ADAPT; remove old shell dispatch | Keep frame/input math; shared task/keyboard dispatcher; unified proposal cancellation; input requests navigation; remove tray/Inspector DOM assumptions |
| `app/ui.js` | REPLACE shell presenters; KEEP/rehome useful helpers | Index/Card/Look/Details/Instrument/Precision, shared reasons, explicit relation verbs; preserve field specs/edit path and local locator logic |
| `index.html`, `styles/app.css` | REPLACE composition; ADAPT material/state tokens | Shared Head/Index/Stage/Card, bottom task home, narrow sheets; no Scene/Camera spine, Layout/Arrange pair or disabled Draw placeholders |
| `app/anim.js` | ADAPT narrowly | Retain clock/speed policy; expose command failure observation to QA and cancellation ordering; no parallel Camera interpolation |
| `app/journeys.js` | ADAPT | Keep A–F outcomes/URLs/presenter boundary; invoke new task APIs; rewrite narration and reset all added session state |
| `scripts/shoot.sh`, `review/*.sh` | ADAPT or DELETE AFTER QA | Harvest pointer/return assertions into current QA; replace capture entry points; remove dead predecessor comparison URLs |
| Documentation and evidence | ADAPT / DELETE AFTER QA | §10 gives per-family conditions; planning performs no retirement |

Two small module seams are justified. A proposed `navigation.js` owns the existing
prototype fly/trail/return context and the realized Camera contract; operations
register their reading contributions with it. A proposed `tasks.js` owns capability
dispatch, active/parked task descriptions and depth, calling navigation and source
helpers. Shell rendering does not interpolate pose or store Camera snapshots.
Keep spatial KIND implementations in actions initially: moving every function into
a framework or domain registry would obscure the preservation diff.

A proposed `fixtures.js` may provide explicit local context/relation metadata,
dense search subjects and the tiny foreign Presentation/repair scenarios (§7).
It has no codec/export/import promise. Extend `thing`/selection lookup through one
registry so fixtures cannot create a second selection system.

## 6. State and interaction contract

### State separation

| State | Owner within prototype | Constraint |
| --- | --- | --- |
| Accepted museum edits, Undo/Redo | Existing source/edit helpers | Whole-model snapshot shortcut remains disclosed; no production history redesign |
| Canonical selected ID | Existing selection facade (`S.sel`) | Stage, Index, Search, Card and foreign fixtures all read/write this one identity |
| Camera standpoint, framing, movement, return/trail | Navigation seam + Stage realization | Shared by both lenses; no shell/task/parked pose snapshots |
| Browse/search query and focused row | Shell session | Not selection; context-only changes do not move Camera |
| Current task kind, initiating identity, technical target, local focus, depth | Task session | Card never reads task target as its identity; one active task surface |
| Reading parameters | Spatial operation session contributions | Active only with corresponding Instrument; not source or authored View |
| Writer/drag/picker and refused candidate | Single transient proposal lifecycle | One owner at a time; cancel before teardown/lens change; no acceptance through blur |
| Parked task descriptor | Inactive session memory | Original identity/targets/parameters only; no Camera, selection snapshot, unaccepted writer, geometry/renderer objects or authored persistence |

`ordinary → Look/Details disclosure → invoked task → Precision → writer` is
progressive disclosure, not mandatory ceremony before every edit. Expert keys,
dog-ear/tab and direct edit grips dispatch the same task as menus; invocation is
atomic with the first gesture. Selection alone exposes identity, nearby context
and applicable entry points; it does not open a specialist Instrument or numeric
catalogue. Deep controls and numeric fallback are reached in the active task.

Look availability is derived from actual fixture capabilities and reading state:
host-resolving opening/art can Face; curved host can Unroll; ceiling can Lift/Look
up; Include/Reveal only where the existing reading supports them. A plain bench
need not have Look. Do not copy the synthesis's example lists unconditionally.
Section with no selected subject is an explicit current-location task where bound
architecture exists, not a global disabled specialist catalogue or fake selection.

Details expands real relations/structure. **Expand** changes disclosure; **Focus**
sets local task focus (for example Wall top), leaving selection alone; **Select**
changes the canonical ID; **Open task** invokes specialist work on the named target.
No name-click shortcut may conflate these. A technical focus path is not a new
durable component identity. Changing canonical selection while a task is active
keeps its technical target legible, revalidates applicable controls and never
rewrites Card to the old initiating subject or current host.

### Proposal, refusal and Esc

Reuse `applyOpening`, `applyWallTop`, `applyCeiling`, `applyField` and validation.
Keep valid pointer preview behavior while distinguishing preview from accepted
source. Invalid work shows the accepted geometry, the rejected candidate/value
and reason locally; do not invent the board's “structural pier” if the fixture
only proves opening overlap or wall-top clearance. No silent clamp/correction.
Any correction offered must call a supported, explicit validated edit.

One cancellation operation must cover pending snapshot rollback, numeric draft,
gap preview restoration, knife aim, pointer capture/closures, refusal/highlight,
and temporary picker state. Invoke it on Esc, pointercancel/lost capture, lens
exit and task teardown; prevent trailing pointerup/change/blur from committing.
Selecting another subject while writing must first finish this policy explicitly;
the minimal policy is cancel the unaccepted writer before applying that selection.

Esc cancels writer/proposal first, exits Precision next, then leaves the current
spatial Instrument through canonical return. For a nested reading, that return
reactivates the parent reading **and its Instrument** exactly. At the root it
puts the reading back and returns to ordinary. Non-spatial work unwinds picker,
Precision, local focus, Instrument overview, then rest. At rest Esc does not
replace selection; accepted edits never disappear through procedural exit.
Shift-Esc remains a direct whole-chain spatial return after canceling proposals.

### One spatial return authority

Move existing origin/parent/recipe/trail ownership behind navigation, preserving
exact explicit Back/trail behavior within a World chain. Instrument only asks
for movement or return. A restored reading must activate its task surface; no
hidden inspection, even when `[ ]` is used. Revalidate referenced subjects before
restoring recipes and explain unavailable work rather than retarget.

Shell reflow only changes canvas size/aspect. It must not call `fitFrame`, Face,
home or fly. Compare **realized eye, target, FOV, zoom/framing and history** as
well as session state; aspect necessarily tracks canvas dimensions. The preview
inset uses the same evaluator/scene and has no input, independent trail or source.

Parking must freeze the currently realized Camera pose/framing in navigation
before deactivating the reading; otherwise the old derived-flatness formula
silently dollies the Camera. Clear temporary geometry/clips/ghosts and mirrored
Look-up reading without restoring an origin pose. The mirror is a reading
reflection, not a separate saved standpoint. Navigation must own the neutral
realization after teardown; later explicit spatial input evaluates from it.
The acceptance check observes actual view matrices/FOV, not just `camState()`.

### §0.8.2 transition table

| Event | Required transition |
| --- | --- |
| Switch lens during World task | Cancel writer/drag/preview; store inactive original identity + resolving target IDs + reading/task parameters; deactivate Instrument and reading together; retain source, selection and current Camera standpoint; write no source/history entry |
| Return to World | Ordinary context derived from current project/selection/standpoint; no Instrument, reading, writer, old Search/Browse context or old Camera restoration |
| Open Resume context | Show contextual Resume only for original canonical identity and resolving targets/configuration; changed selection requires explicit Select first; explain missing/invalid targets locally |
| Explicit Resume | Revalidate identity, host/capability and parameters against current accepted model; atomically activate Instrument/reading from current Camera realization; start a fresh navigation return context and source-summary cursor |
| Invalid/missing target | Remain ordinary; unavailable reason or valid fresh invocation; never search by name/proximity, substitute a host or restore a proposal |
| Put it back after Resume | Navigation returns within the **new** invocation context; movement made in the other lens survives; old pre-crossing root is not reused |
| Explicit chronological trail action | A deliberate navigation request, distinct from lens return; may move to a recorded standpoint/readable recipe after revalidation, with the corresponding Instrument visible |

Nested procedures park as one inactive chain if valid; Resume revalidates all
targets and rebinds return to the current standpoint, not any recipe Camera.
For an unselected location-based Section, no fabricated selected identity is
introduced: remember the explicit fixture location and absence of selection;
offer fresh Section rather than Resume if that context no longer matches.
Browse/Search may retain inactive query/context for explicit reinvocation only;
the toggle never restores it. Unaccepted writer/picker proposals are never parked.

## 7. Honest fixtures and deferred depth

Prefer existing Saltmarsh content to reproducing Piano scenery. Ordinary World
with **Oak bench** demonstrates Index/Stage/Card and absence of specialist depth;
Garden window demonstrates selected subject vs Rotunda host. No Piano asset is
needed to pass those laws.

The old `gallery` field and object's `x > 0` bucketing are fixture shortcuts, not
location/ownership semantics. Add explicit, non-persisted fixture relation data
for the two actual galleries: Bounds, Openings on bounds, located subjects,
ceiling closure/suspended relations and wall-attached art. Shared bounds may
occur in both places without changing storage. A selected wall's local context
can show Attached here; location is never mislabeled as ownership. Do not show
empty Overlays or invent a Zone to fill the board. If an overlap fixture is added,
it must name explicit overlap relations, not pretend containment.

Dense Browse/Search uses a bounded metadata fixture with repeated display names,
distinct IDs, many results and distant/non-geometric contexts. Label records that
have no Stage geometry; **Open location** and **Select** can be proved without
pretending to fly to or reveal nonexistent geometry. Keep actual spatial recovery
tests on rendered Saltmarsh subjects. No multi-level Layout model is introduced.

Details and Owner/Source/Reach first use supported facts: Opening → host Wall,
Wall top structure and ceiling relations; Scene artwork → explicit wall reference.
Show Layout vs Scene responsibility at a real edit decision; identify a fact as
prototype-local source and name its actual affected subject/host. Avoid “3 shared
uses”, source forks or instance-only choices: no such model exists. Board 06's
full shared-source editing remains **deferred**, with an explicit coverage gap;
the three-question disclosure grammar is still tested on real local edits.
Internal selectable components and imported-model semantics remain deferred.

For missing-reference repair, use an isolated variant of a **wall-attached artwork**,
whose existing `wall` reference is explicitly made unresolved. Its cached last
position is a display locator only, never a host guess. Guard fixture rendering,
reason lookup and task dispatch against the missing host. Quiet warning at rest;
invoke Repair focus; explicitly pick a compatible Wall, preview a declared
station/height and accept once, or Leave unresolved. Validate fixture bounds and
parameters before acceptance. Do not offer Detach unless a real fixture operation
and free-placement representation are implemented and tested; it is unnecessary
for #112. This proves missing-reference/preview/explicit repair behavior without
inventing generic production attachment or override rules.

The minimum Experience bridge shares Head/Stage/Card and the same selection and
navigation seam. It contains one read-only named Presentation fixture referencing
Garden window, explicit **Select Presentation** and **Select referenced window**
actions, a foreign-World Card and ordinary Camera input. It can move the current
Camera and change canonical selection to exercise §0.8.2. Mark it visibly as a
continuity fixture in prototype/presenter context. It has **no** Presentation
creation/writer, Guide, Stop, Deck, capture, authored Camera View or visitor Preview.
Unsupported Preview/save affordances must not claim real execution/persistence;
record them as prototype limitations rather than fake successes.

This bridge proves World-side parking, foreign identity, return and Resume. It
cannot prove Experience procedure parking or real cross-lens product continuity;
those belong to #113.

## 8. Ordered implementation stages

Each stage commits only after its stated local proof; all remain inside one #112
PR. Writing this plan starts no implementation stage. Rebaseline
if main changes before implementation. Incremental refactors keep the executable
working; any short-lived old/new presentation switch must disappear before S8.

| Stage | Bounded change | Review/exit evidence |
| --- | --- | --- |
| S0 — baseline contracts and harness | Capture fixture hashes/source values, A–F checkpoints and selected real-pointer paths; harvest assertion intent from old scripts into prototype-local QA; add fail-on-assertion/command-error handling and explicit readiness waits | Reproduce 50-step/27-check baseline; record coverage limits, exact-return tolerance and intermediate checkpoints; no shell or evidence deletion |
| S1 — lifecycle and navigation seam | Introduce navigation/task separation, single cancellation policy and initiating-ID/technical-target distinction; retain old presentation while APIs stabilize | Pointercancel/Esc rolls back valid and refused previews with zero edits; field/tape/handle share validators; exact nested/trail returns; teardown can leave realized Camera unchanged; one owner of return/trail |
| S2 — ordinary shell | Replace composition with Head, relation Index, Stage, minimal Card and contextual entry points; remove old tool catalogue and inactive production-domain controls; keep presenter outside product | Bench/window/no-selection/foreign placeholders stay honest; all selection entry points use one facade; no Instrument at rest; no numerical flood or implicit Camera fit from panel opening |
| S3 — spatial tasks and Precision | Wire Look/shortcut/direct invocation to Face/Unroll/Section/Lift/Look-up; lower Instrument, nesting, current task focus, in-place dimension task, Precision and refused candidate | A–E checkpoints stay executable; first direct gesture retained; full local numeric/non-pointer access; reading/surface lifecycle paired; per-axis truth and accepted/refused edit counts |
| S4 — Browse/Search and Details | Explicit context/result verbs, recovery row, shared visibility reasons, Scroll/paging and relation focus; use bounded dense metadata fixture | F plus excluded-subject B; browse without selecting; Select without Camera/reading change; bring/reveal/include/face tested independently; Expand/Focus/Select/Open task identities proven |
| S5 — decision-point relations and repair | Supported Owner/Source/Reach; wall-top/host focus and gap preview; isolated unresolved-art-host fixture with explicit candidate validation | Quiet rest warning, invoked Repair, canceled preview unchanged, one accepted repair/Undo, missing identity stays unresolved; no name/geometry auto-match or fabricated source/override options |
| S6 — lens parking and explicit Resume | Minimum read-only Experience bridge; park all World task/readings and Browse/Search; ordinary return; current-source validation and fresh navigation binding | All §0.8.2 cases (§9 W9), accepted edits kept, proposals canceled; changed/missing target refused; actual Camera pose/FOV survives crossing; Put it back after Resume cannot rewind other-lens motion |
| S7 — responsive/accessibility hardening | Narrow Index/Card sheets, compact location/identity, coherent lower Instrument; keyboard focus/announcements and equivalent task controls; reduced-motion handling | 1440×900, 1280×800, 1024×768 and DPR2; keyboard-only A–F essential tasks; focus restoration and local refusal announcement; no ghost reading on sheet close; rendered/picked projection agrees |
| S8 — independent acceptance | Full shell matrix plus full A–F regression, real gestures, normal/reduced transitions and intermediate captures; visual review against prose/QA specimens | Both axes green, no outstanding manual coverage promises, no command/page errors, root architecture lane green; selected regression mutations demonstrate replacement checks fail on protected defects |
| S9 — harvest, retire and route | Only after S8: replace docs/evidence, delete redundant predecessor assets/scripts, update prototype/roadmap/current routing, use slice-closeout for accepted adoption | Every deletion has same-defect/behavior successor proof or harvested rule; docs gate, full arch and scope diff rechecked; current executable named World Authoring Prototype; #113 baton; no T1/F advance |

The suggested sequence is retained with one dependency correction: **S1 establishes
neutral Camera teardown and proposal cancellation before presentation adoption**.
Those seams are already necessary for S3 and cannot safely be postponed to S6.
S5 uses supported relations/repair, not a composition engine. Accessibility tests
start in S0/S2/S3; S7 hardens them rather than adding access at the end.

## 9. Two-axis QA and verification

Use UI-driven tests for shell wiring and real gestures, with `__me` for controlled
setup and value inspection. Presenter/action replay is complementary; a helper
pass cannot prove that Look, Search, Esc or the lens button calls it correctly.
Record model values, canonical selection, task/reading, writer, history counts and
realized Camera at meaningful checkpoints. Screens are selected evidence, not the
assertion mechanism. Failure must produce nonzero script exit, not just “FAIL” text.

### Axis A — executable World shell

| ID | Case and necessary proof | Design evidence |
| --- | --- | --- |
| W1 | Ordinary no-selection/bench/window: local Index + dominant Stage + canonical Card; only applicable entry points; no specialist Instrument or metadata flood | #111 board 01; PLATE §0.8 |
| W2 | Relation groups truthful/non-empty; same shared bound can appear in two contexts; changing context never implies ownership/selection | Synthesis §§2–4 |
| W3 | Dense browse, repeated names, >9 results, empty result, selected elsewhere; independently exercise Select/Open location/Bring into view/Reveal/Include/Face | Board 02; F journey |
| W4 | Closed Look discovery and shortcut/direct entry; invoke Unroll host while Garden window Card/selection stays; technical target named separately | Board 03 is post-invocation, so add a pre-invocation state |
| W5 | Precision/one writer, hidden-axis numeric access, real valid and refused drags, invalid typed input, explicit correction/cancel, no history noise | Board 04; use actual fixture refusal, not generated pier text |
| W6 | Details Expand/Focus/Select/Open task have distinct state effects; host/top focus leaves Card identity intact | Board 05 grammar; Piano/internal identity not required |
| W7 | Owner/Source/Reach separate at a supported local edit; no misleading shared-use scope choices | Board 06 disclosure grammar; shared-source editing deferred explicitly |
| W8 | Rest warning → Repair; unresolved host reason; explicit candidate preview/accept/leave; cancellation/Undo; no name/proximity retarget | Board 07 with actual wall-attached artwork fixture |
| W9 | Park Unroll, Section/depth/Reveal, Lift, mirrored Look-up, nested chain, in-place precision, knife aim and Browse/Search; return ordinary; only explicit validated Resume; source edits survive | PLATE §0.8.2; boards 08–09 are identity specimens, not complete parking proof |
| W10 | Cross while same identity; cross after explicit Presentation selection; move Camera in bridge, return with foreign Card; explicit select original then Resume; delete target/change host/invalidate config in fixture before Resume; no automatic selection replacement | Same §0.8.2; new executable checkpoints required |
| W11 | Lens switch during numeric draft, valid drag before release, refused drag, gap/repair preview, pointer cancel, queued transition: cancel once; late events cannot commit or revive parked task | Synthesis §19; new state/call-site checks |
| W12 | Wide/narrow shell and sheet toggles while ordinary, Unroll/Precision/refusal/Search/repair; Stage canvas/picking aligned; no pose/FOV/history change from resize | Board 10; explicit responsive proof |
| W13 | Keyboard-only selection/search/invocation/line definition/depth/curvature/side/typed manipulation/repair/Resume/return; focus stays visible and restores; writer errors/task state announced; no shortcut steals text entry | PLATE state language; synthesis §21 |
| W14 | OS preference on at boot and changed at runtime; user reduced-motion override; speed independently retained; identical accepted values/selection/navigation endpoints and no travel/caption dependence | P26 D + PLATE §23.1 |

For W9–W11 assert that parked state is inactive, not merely hidden CSS. Resume may
reapply validated reading parameters but cannot restore a Camera snapshot. Observe
the subsequent Put it back result after an explicit Face and after an invocation
that makes no spatial move. Also test unavailable Resume while another identity is
selected, Undo affecting a target/configuration, and current host differing from
the recorded host: changed relationships require explanation/fresh invocation,
never silently redirect the parked procedure.

### Axis B — P26 regression

| Journey | Required checkpoints beyond replay | Reusable evidence |
| --- | --- | --- |
| A | Mid-peel/half-wrap/inside/outside/flat, registration and per-axis truth, intermediate-state edit, rise/jamb invariants, gable, retained edit summary | A steps; screen capture cases; real peel checks in `review/test-flows.sh` |
| B | Aim before acceptance, sliding and turning line, Plan peek/3D preview, mid-part, exact nested cut return, depth/reveal/include, door head and reopen | B; flow script; Section/recovery captures |
| C | Partial lift, gap consequence preview/cancel/accept, intended opening, nested/mirrored Look-up/picking, typed soffit and whole-chain return | C; tethers/Look-up/refusal captures |
| D | Shortcut/menu equivalence, learned/brisk/instant/reduced endpoints, same-kind replace, full explicit recipe trail return, Undo exclusion | D; flow script exact-return probe; motion/transition probes |
| E | Real Plan move/jamb and 3D height/profile drags, legibility thresholds, grid/material toggle, exact tilted return, Undo/Redo without Camera move | E; `review/test-plan.sh`; 27-check interaction script |
| F | Actual Search selection and explicit recovery UI; all relevant visibility reasons, beacon/locator truth, same-kind Face replacement | F; finder/behind/Reveal captures and flow script |

Baseline values from §4 are asserted independently of screenshots. Add targeted
checks for wall slope/gable/seam, round/pointed profiles, ceiling slope validation,
selection restoration under Undo/Redo, summary Undo and no-op edits. These exist
outside the 50 presenter steps and must not disappear through shell adoption.

Reuse the [journey runner](../visual-system-refinement/qa/journey-check.sh),
[interaction checks](../visual-system-refinement/qa/interaction-check.sh),
[pointer Plan check](../../../../../prototypes/spatial-authoring/review/test-plan.sh),
[flow checks](../../../../../prototypes/spatial-authoring/review/test-flows.sh) and
[capture generator](../../../../../prototypes/spatial-authoring/scripts/shoot.sh)
as assertion/capture sources. Parameterize base URL/output/session and wait for
state readiness; port 8826 may already serve another checkout. Preserve assertions
through selector changes, then move live QA ownership beside the executable.
Old audit comparisons to removed designer servers are historical only.

For retirement replacement claims, mutate a narrow protected behavior: allow a
refused release to commit, substitute host selection, or let lens return restore
the parked Camera. The relevant successor must fail while unrelated controls stay
green. Do not retain redundant structural tests of the helper implementation.

Repository verification follows [the test contract](../../../../../apps/editor/tests/README.md),
independent of prototype task scope. Run the whole unconditional architecture lane
before the PR and again after retirement; Markdown routes are covered even though
prototypes are outside npm workspaces. Use the docs gate during documentation
edits and `git diff --check` over both working and complete base-to-head changes.
Production fast/heavy/perf/check/build applicability follows that contract and the
actual impact diff; prototype behavior needs its own browser proof, and no old
254/276-test or production-lane result is reused as a current pass.

## 10. Harvest, retirement and documentation closeout

**S9 is gated by S8.** During planning and baseline capture, delete nothing. Once
both acceptance axes pass, keep one current executable and one current explanation
of its behavior. Git preserves obsolete shell archaeology.

| Current artifact family | Classification / action after acceptance | Deletion condition |
| --- | --- | --- |
| Prototype `README.md` | Replace as current **World Authoring Prototype** README | Explain unified shell, inherited P26 A–F, run/jump/presenter routes, current QA, bridge limits and production boundary |
| `rationale.html`, `styles/doc.css` | Harvest spatial rules/intermediate journey rationale; rewrite as current World rationale (reuse document CSS if useful) | Remove blue/old-shell/obsolete “today” claims; images and wording route only current evidence; no parallel old rationale |
| `IMPLEMENTER-REFERENCE.md` | Harvest/replace as World prototype implementer reference | Preserve formulas, validators, tricky interaction rules and shortcut disclosures; new state/nav/parking API map; label it prototype evidence, never a production recipe |
| `REVIEW-RECONCILIATION.md` | Harvest conclusions, then historical-only delete | Unique explanations of isometry, per-axis scale, legibility, nest-vs-replace, exact return and refusal represented in current docs/tests; stale comparative deliberation lives in Git |
| `screens/` | Replace with semantically named successor intermediate/endpoint specimens | Every old unique spatial case has equivalent current capture + test/readout. No keep-all screenshot archive; unresolved unique evidence remains temporarily with an explicit reason |
| `review/` PNGs | Historical-only delete after harvest | Before/after designer/P26 shell comparisons have no unique behavioral coverage; any unique n-series peel/Plan/nesting/finder case has successor proof |
| `review/` shell scripts | Harvest assertions, then delete superseded scripts or retain adapted live checks | Same-defect pointer/return/membership checks exist in current QA; obsolete second-server comparisons removed |
| Visual-system refinement plan, acceptance/reports and `qa/` assets | Retain unique material/contrast/paper-slew evidence where not reproduced; replace old executable QA routes with forward pointers; delete redundant old-shell baseline/revised boards and comparison pages | Preserve numerical rationale/probes that still protect renderer behavior. First update every routed link and the acceptance record; keep a compact truthful closed-work pointer with Git recovery for deleted history |
| `paper-surface-brief.md` | Harvest surviving selection/material concern into current prototype limitations/reference; retain only if unresolved evidence remains unique | Do not silently declare the material conformance concern fixed by shell adoption |
| Presenter/journey documentation | Still-current behavior lineage, rewritten presentation | A–F and query routes retained; descriptions name Index/Card/Look/Instrument/Precision; presenter remains explicitly outside product |
| Phase-local `Final-Design-Prototype/README.md` | Replace with forward pointer; no executable there | Stable historical route now identifies World Authoring Prototype, inherited A–F, predecessor shell superseded |
| #111 synthesis/ten-board package/acceptance | Still-current design evidence; retain | Update next-step routing only; do not rewrite its design acceptance as executable acceptance or prune its canonical design boards as predecessor screenshots |

Keep a concise coverage/harvest table in the successor acceptance record: old
behavior/evidence → current test/checkpoint/specimen → retained/deleted decision.
If equivalent proof is absent, retain the unique evidence and name the missing
case; do not pass S9 with unexplained loss. Inspect inbound Markdown, HTML and
script routes before deletion; docs gate alone does not check HTML image links.
No historical record is rewritten to imply the old shell never existed.

Closeout routing changes:

- `prototypes/README.md`: current World executable reference at the existing
  spatial-authoring home; P26 behavioral lineage, #111 design evidence and bridge
  limitations explicit.
- P26 phase README and compatibility stub: inherited A–F remain behavioral
  evidence; predecessor shell superseded; current executable is World Authoring
  Prototype; production T1 is still re-derived/gated after F.
- Shell-round README: #111 frozen design retained; #112 executable adoption
  accepted with a direct current-prototype/QA pointer, no production cutover.
- Roadmap and `operations/current.md`: close only bounded #112 adoption; hand
  off to #113 prototype work. No P26 major-phase closure, T1 status advance or F
  interface completion. Use the repository slice-closeout workflow when adoption
  acceptance is actually complete; it does not run for this plan-writing turn.
- Reference contracts: change a route/current-prototype label only if it becomes
  stale; keep PLATE's production landed/destination labels and domain encodings.

## 11. Exclusions

No production files in `apps/` or `packages/`, dependency/runtime upgrades, root
workspace changes, persisted prototype formats, F interface implementations,
semantic domain relocation, Camera storage cutover, production history design,
component identity system, source/instance override or reuse semantics.

No new-wall/opening/ceiling drawing, cubic architectural evaluator, large-level
Layout implementation or production visitor/release work. The existing analytic
caps, independent clipping/membership, circular-only fixture, tiny-FOV flat view,
whole-model Undo and one-ray visibility remain disclosed prototype shortcuts.

No full Presentation authoring, Guide/Stop authoring, Experience Set/Deck/Seam,
Experience Camera authoring/capture, Preview implementation, import of the old
Experience runtime or complete cross-lens product integration. Do not promise
those features with inactive controls or scene decorations.

## 12. Risks and unresolved decisions

| Risk/question | Resolution within #112 / remaining boundary |
| --- | --- |
| Session-derived projection changes on park | Mandatory S1/S6 realization proof; preserve physical pose/FOV while deactivating temporary reading. Exact module payload is an implementation choice, not a production contract |
| Hidden task revival from queue/drag/DOM teardown | Single cancellation lifecycle and transition ordering; test late events, interrupted animations and current-task/Instrument pairing |
| Source edits/selection change while procedure active | Revalidate actual target IDs/capabilities; keep explicit selected identity and task target separate; missing references explain failure |
| New disclosure could make E ceremonial | Preserve direct first-gesture invocation and in-place dimension task; test real Plan/3D work, not just menu entry |
| Unknown original task identity in old recipes | Record initiating selection explicitly; artwork host `focusId` is not enough; migrate session-only recipes without a persisted compatibility format |
| Component/source/reach specimen cannot be reproduced truthfully | Use existing host/top/ceiling relations; defer internal selectable components and shared-source edits. Decide richer fixture only if a concrete acceptance gap remains, never for pixel parity |
| Dense context fixtures mistaken for architecture | Label non-geometric records; enable only operations they support; no invented Level model or Camera destination |
| Missing artwork host breaks rendering assumptions | Isolate fixture, audit host dereferences and maintain last-known display locator; no implicit nearest-wall fallback. Keep repair narrowly validated |
| Mat/paper and selection material; focus/motion placement | Preserve existing measured behavior and semantic accessibility; PLATE §0.3/§0.7.6 owner calls remain open. Record prototype placement choices without claiming ratification |
| Old QA counts hide missing wiring/intermediates | State assertions plus actual shell/gesture paths; mutation proof for harvested replacement checks; explicit deferred coverage |
| Browser scripts swallow failures or write old evidence | Parameterized session/output/readiness and nonzero failure; command errors observed; no automatic baseline overwrite |
| Final dimensions/spacing and bridge controls | Implementation calibration against written laws, wide/narrow QA and honest supported actions; raster dimensions are not frozen numbers |

No unresolved production semantic decision blocks this bounded prototype plan.
The implementation must stop and report a concrete scope conflict if preservation
cannot be achieved without production architecture, rather than minting an F
interface or reducing the proved behavior silently.

## 13. #113 handoff and completion boundary

After S8/S9, #112 leaves one current executable World reference, a compact
prototype state/navigation seam, inherited A–F proofs, and executable World-side
parking/return/Resume with an explicitly limited Experience bridge.

**Baton:** build the finalized **Experience V2 executable reference** against the
shared shell and validate **World ↔ Experience continuity**. Its design home is
[integrated-experience-authoring](../../../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md).
#113 replaces the read-only bridge with real Experience prototype behavior and
proves both directions, including Experience procedure parking, foreign identity,
shared Camera navigation and proposals/accepted edits. It must consume the shared
interaction laws rather than introduce another shell, remembered selection or
Camera history. Its implementation architecture is planned separately.

This plan-writing turn does not mark #112 accepted, run retirement, invoke slice
or phase closeout, implement #113, or advance F/T1/T2/T3. Implementation begins only
in a subsequent authorized turn; planning verification checks the plan and current
evidence, not the unbuilt successor.
