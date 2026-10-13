# Experience UX V3 — implementation evidence

**Status: SUPERSEDED / INACTIVE (2026-10-13, #114).** The owner accepted
[Conservatory Round 2](../../../../../prototypes/experience-ux-alternative/README.md).
[PLATE](../../../../reference/design-system/editor-shell-and-visual-system.md)
owns the promoted unified shell and Experience authoring/UX acceptance.
This UX3/V3 package, standalone plan and generated PNGs are retained rationale
and Git provenance; none is an active design or implementation instruction.
Do not execute V3-A–V3-F or resume UX7. Next work is
[#115 parallel-track planning](../../../README.md#next-task-handoff--115).

**Original proposal/audit follows as historical text.** Earlier “active”,
“canonical”, pending-ratification and PNG-acceptance statements below describe
the superseded commission; they do not reopen current design acceptance.

Design and implementation-planning evidence; not a landed domain or persisted-format contract.
Source inspected at `de41341e82f4a745abe85537c59a217c160c60f3`.
The executable is the [spatial-authoring prototype][prototype], not production.
This audit was read-only: no browser session or test execution.

## Boundary and proposed cutoff

V3 introduces authored, ordered, stable slots on each converted Stop. A slot
references an existing Presentation View-use identity; Camera continues to own
the View, pose, projection, path, stations and evaluation. Slot dwell and movement
between adjacent slots belong to Experience. Freeze the first-slot entry when
creating the sequence; later changes to Presentation Default do not reorder it.

Legacy Stops retain their existing Entry and Next semantics until explicit
conversion. New Stops continue by linear Guide order. An existing explicit Next
target remains visible and executable; converting it requires a deliberate edit.
Main **Next always leaves the Stop**. Within-Stop autoplay ends waiting for Next.

The [product proposal](./README.md) and [plan](./implementation-plan.md) refine
this with explicit Guide execution metadata and atomic whole-Guide conversion;
mixed legacy/V3 Guides are invalid. V3 early Next is a declared Cut skip. The
current live-origin coverage facts below remain the legacy implementation baseline,
not a mandate to reconstruct all-origin Travel for that bounded V3 skip policy.

Use one invoked movement task with play, scrub and Follow through the existing
Camera authority. Do not split it into Path/Journey homes or expose a graph UI.
Hide the existing Cue, Gate and action writers while preserving authored execution
and a visible compatibility notice. Free/guided visit context requires runtime
adaptation; it cannot be established by changing a panel label or UI toggle.

## Verified current model

| Concern | Current source shape / behavior | Exact anchor |
|---|---|---|
| Domains | Experience and Camera are separate source objects; the prototype interfaces are explicitly local. | [Model][model] `createExperience` L4, `createCamera` L7 |
| Presentation | Reusable composition owns `focus`, `meaning`, and `uses` containing View-use IDs. | [Model][model] `addPresentation` L16 |
| Camera View | Camera stores framing; Experience stores a use referencing `viewId`. Adding a View does not create connectivity. | [Model][model] `addView` L24 |
| Default | `entryUse` resolves the Presentation use with `role:'entry'`; changing Default changes that role. | [Model][model] `entryUse` L30, `setRole` L31 |
| Guide | `guide` orders stable Stop IDs; each Stop references one Presentation. Repeated placements have distinct Stop identities. | [Model][model] `addStop` L45, `moveStop` L60 |
| Stop entry | One policy: Presentation Default, explicit use, or hold current viewpoint. No local ordered sequence exists. | [Model][model] `stopEntry` L54 |
| Continuation | `next` is Guide order, explicit target, or End; reordering affects order continuation only. | [Model][model] `resolveNext` L49 |
| Suggested Views | Optional Presentation `viewOrder`; missing eligible Views are appended and repeated IDs de-duplicated. | [Model][model] `eligibleViews` L223, `orderedViews` L224 |
| Local framing | Stop-only detachment clones Camera framing, creates one private entry use, and changes `Stop.entry`. | [Model][model] `detachUse` L123 |
| View reuse | New Experience use references the existing Camera View; Camera is not cloned. | [Model][model] `reuseView` L305 |
| Use removal | Local unlink deletes the Experience use, preserves Camera framing, and retains explicit missing Stop-entry references. | [Model][model] `removeContribution` L376 |

`experience.uses` contains both View uses and contribution uses. A mandatory
`kind:'view'` discriminator is not consistent across current creators: `addView`
omits it while `reuseView` writes it. Existing readers usually test `u.viewId`.
Do not introduce a new slot resolver that assumes every legacy View use has `kind`.

## Reuse / adapt / new / UI-only / deferred inventory

Classification names indicate work required by V3, not acceptance status.

| Classification | Concern | Implementation direction / evidence |
|---|---|---|
| Reuse | Presentation and Camera identity | Preserve the existing View-use → Camera View relationship; slots reference uses, never copied poses. `addView`, `reuseView`. |
| Reuse | Camera evaluator | `connectionPath`, `liveConnectionPath`, `viewPath`, `evaluatePath`, `routeGeometry`, and `realization` remain the only pose/projection path. [Kernel][kernel] L16–78. |
| Reuse | Authored interior points | `addAnchor` inserts a stable observer point in route order; generated endpoints remain unauthored. [Model][model] L103. |
| Reuse | Aggregate authoring | `command` wraps World + Experience + Camera + Scene snapshots with rollback. [Operations][operations] L48; [History][history] L1465. |
| Reuse | Reusable framing scope | `viewReach`, `proposePatch`, and `acceptFraming` already distinguish shared updates from explicit local detachment. [Model][model] L118; [Operations][operations] L851–873. |
| Reuse | Visit/run separation | Keep fresh invocation identity on Stop entry and preserve it during View changes. [Runtime][runtime] `enterPresentation` L137. |
| Adapt | Stop-local scope | Extend reach, removal, repair, duplication and detachment to slots; current `stopId` use handling addresses private entry only. |
| Adapt | Origin coverage | Preserve legacy eligible live departures, including selected/in-flight View. New V3 normal Travel uses fixed settled bookends; interruption explicitly Cuts. [Model][model] `originCoverage` L68. |
| Adapt | Travel preparation | Prepare missing routes explicitly; reuse existing support without rewriting it. Extend the report to the invoked slot transition. `prepareTravelSupport` L86. |
| Adapt | Movement clock | Parameterize Experience transition context rather than forcing intra-Stop work into a Stop→Stop Seam. [Coordination][coordination] `movementTiming` L3. |
| Adapt | Play/scrub/Follow | Reuse Camera evaluation and session playhead, add continuous Follow semantics and unified task ownership. Current Look through adopts one sampled pose. |
| Adapt | Free/guided runtime | Establish explicit visit context and its continuation/return rules; current Explore retains the active Stop/Presentation visit. [Runtime][runtime] L281–295. |
| Adapt | Preview scope and return | Include new slot/task context in the existing captured return state; preserve source cloning and audition cleanup. [Operations][operations] `preview` L507. |
| New | Stable Stop slots | Ordered authored slots with stable IDs, View-use references, local dwell and explicit unresolved state. Preserve repeated occurrences. |
| New | Stable internal transitions | Address movement between adjacent slot identities independently of positional indexes and Stop→Stop keys. |
| New | Sequence traversal | Runtime slot cursor and within-Stop autoplay; final slot waits for main Next. Slot changes must not create new Presentation visits. |
| New | Conversion operation | Atomically establish local sequence/entry policy while retaining or explicitly changing legacy continuation. No implicit bulk conversion. |
| New | Local sequence validation | Validate membership, references, dwell, transition adjacency and required Camera support; keep authored repairable failures distinct from executable closure. |
| UI-only | Unified movement home | One invoked task and one inspector identity; opening it moves no Camera or source. Existing task/return mechanisms provide session foundations. |
| UI-only | Reduced authoring exposure | Remove graph and split Path/Journey navigation from ordinary V3 exposure; hide Cue/Gate/action writers without deleting source. |
| UI-only | Compatibility disclosure | Show retained legacy policy/advanced work and its effect, especially explicit Next and hidden authored execution. |
| Deferred | Advanced authoring redesign | Cue, Gate, action/dependency and generalized coordination writer redesign; retained behavior still executes. |
| Deferred | Production cutover | Prototype evidence does not establish collection codecs, revision preconditions, public addresses or visitor bundle isolation. |

## Camera and timing constraints

| Fact to preserve | Source / implication |
|---|---|
| Endpoints come from Views | [Kernel][kernel] `connectionPath` L16 returns generated departure + authored interiors + generated arrival. Slots must not serialize a second endpoint set. |
| Interior anchors are observer positions | `interior` L15 derives aim/target from interpolated framing while preserving authored observer coordinates. Do not reinterpret them as targets. |
| Departure is live | `liveConnectionPath` L24 replaces nominal departure with the actual pose at request time; interiors and destination remain anchored. |
| One route measurement | `pathLength`, `pathSeconds`, `evaluatePath` L27–33 serve duration and runtime execution; drawing consumes `routeGeometry` L50. |
| Ordinary framing is supported separately | [Runtime][runtime] `requestView` L46 uses `viewPath` unless supplied a route. A View step is currently ordinary framing, not implicit Travel connectivity. |
| Travel requires support | `travelInvocation` L231 refuses a missing directed connection rather than silently cutting or returning to nominal departure. |
| Same View depends on live pose | Same Camera View is zero distance only when already there; otherwise Camera evaluates a live framing path. No fabricated self-connection. |
| Experience owns holds/time mapping | [Coordination][coordination] `movementTiming` L3 maps holds/invocations onto Camera stations; geometry stays in Camera. |
| Shared route has contextual timing | `journeyClock` L21 derives Cue identity from edge + connection + station. Two uses of one route may have different Experience holds. |
| Rehearsal is not a visit | [Operations][operations] `rehearsePlay` L988 and `rehearsalAt` L998 move a session playhead without firing authored Activities. |

Current rehearsal uses a nominal origin; visitor Travel evaluates a live-origin
route. Shared evaluator and mapping do not imply identical timing from different
origins. A Follow control must state which invocation it follows and evaluate that
same invocation, including local holds; it must not add independent interpolation.

## Compatibility and migration traps

| Trap | Required handling |
|---|---|
| Reusing Presentation `viewOrder` as local sequence | It appends all eligible Views and de-duplicates IDs. Introduce bounded stable slots; preserve Presentation choice semantics separately. |
| Slot index as identity | Reorder must preserve authored slot identity and references. Repeated uses of one View still require distinct slot identities. |
| Default changes after sequence creation | Freeze the first-slot entry; expose a deliberate change-entry operation. Do not regenerate local order from Default. |
| Legacy entry silently replaced | Keep existing Presentation/explicit-use/hold behavior until conversion, including unresolved references. |
| Explicit Next normalized to order | Preserve its target and visible notice; linear order is the default for new work, not a rewrite of existing instruction. |
| Main Next becomes a View-step button | Keep main Next as Stop continuation; local sequence controls and cursor must be explicit. |
| Auto crosses the Stop boundary | Current `tickRuntime` L394–399 advances Stops. Converted sequence autoplay must end waiting for Next rather than inheriting that branch. |
| Only final-slot origin prepared | Visitors can deliberately select another View or interrupt framing. Cover valid live origins or visibly refuse unsupported Travel. |
| Incoming movement to hold entry | Current Travel requires a destination View and refuses a hold destination. Specify the new policy; never invent a hidden Cut. |
| Stop→Stop Seam key overloaded | `seamKey` L62 cannot distinguish internal slot transitions. Add stable internal transition context while preserving legacy Seam addresses. |
| Shared path mutated without reach | `connectionReach` L148 currently discovers legacy Seams through origin coverage. Extend it to slot transitions before route/pace edits. |
| Private entry mechanism used for many slots | `detachUse` rewrites only one entry; `eligibleViews` excludes private uses. Add explicit slot ownership/resolution instead of extending accidental membership rules. |
| Hidden advanced work erased | Keep authored Cue/Gate/action records and execution. Expose meaningful compatibility state and repair/refusal when required behavior cannot run. |
| Missing View becomes keep viewpoint | Explicit missing use/Camera bindings must remain repairable. Current absent Presentation Default is treated as hold; do not copy that fallback into slot resolution. |
| Removed Presentation deletes occurrences | Prototype `removePresentation` L345 deletes its Stops. [F.1][foundation] preserves unresolved occurrence identity; production design must follow the target contract. |
| Generic Look through claims exact return | `lookThroughView` L287 captures no return itself. The invoked movement task must own a return token before any Follow/Look operation. |
| Opening a task moves Camera | Current `editRoute` L684 captures return but preserves standpoint. Keep opening, selecting, playing a diagram and following it distinct. |

## Runtime, history and visitor isolation

- [Runtime][runtime] `nextRuntime` L277 shares authored Gate checks with Auto,
  but manual Next does not wait for natural readiness or movement completion.
  Auto currently requires readiness and no active movement. Preserve the legacy
  behavior and define converted Stop sequence scheduling explicitly.
- `exploreRuntime` L281 cancels Camera movement/queue and disables Auto; ongoing
  contribution work remains governed by runtime lifetime. `resumeGuide` L295
  uses live pose and carried work without replaying entry or fired cues.
- `returnDetour` L354 restores the parent visit, run tokens and playhead;
  `previousRuntime` L278 starts a fresh visit. Do not conflate Return with Back.
- `openPresentationRuntime` L339 supports a fresh standalone visit or bounded
  Guide detour. Free visit needs an explicit runtime context if it differs from
  these existing semantics; the UI alone cannot make it independent.
- [History][history] `domainSnapshot` L1466 captures authored domains together;
  `commitEdit` L1468 suppresses no-op records and clears Redo after a write.
  Viewpoint/disclosure/trail remain session state. Slot creation, route preparation
  and cross-domain detachment must each settle as one coherent accepted command.
- [Operations][operations] `preview` L507 clones Experience/Camera/Scene,
  clears auditions and captures authoring context. `exitPreview` L537 restores
  lens, selection, context, Camera, inspection, sheets, browse and representation.
- Prototype `command` L49 blocks source writers during Preview;
  [drawing][drawing] `drawExperience` L38 hides authoring instruments, and
  [main][main] L222 dispatches visitor pointer input before authoring handlers.
  This proves behavioral guards only: the static prototype still imports editor
  modules. Production visitor chunks must exclude authoring infrastructure.

## Existing regression evidence to adapt

These are inspected test anchors, not test results from this audit.

| Suite | Relevant existing cases |
|---|---|
| [Runtime tests][runtime-tests] | A8 manual Next vs readiness; A12 live-pose Rejoin; A13 detour resume; A14 fresh repeated visits/View changes; A16 broken explicit Next; A19 authored domains unchanged. |
| [Model tests][model-tests] | Repeated occurrences/reordering; per-origin directed reach; Stop-only detachment; stable station coordination. |
| [Travel tests][travel-tests] | One aggregate Undo; Cut vs Travel invocation; early Next from live pose; same-View evaluation; readiness/holds counted once. |

Add focused evidence for repeated stable slots, reorder/removal repair, frozen
entry, legacy conversion, local dwell, autoplay waiting at final slot, main Next,
arbitrary/in-flight origins, shared-path reach and exact task/Preview return.
Repository verification obligations remain owned by the applicable test contract.

[prototype]: ../../../../../prototypes/spatial-authoring/README.md
[model]: ../../../../../prototypes/spatial-authoring/app/experience-model.js
[runtime]: ../../../../../prototypes/spatial-authoring/app/experience-runtime.js
[kernel]: ../../../../../prototypes/spatial-authoring/app/camera-evaluation.js
[coordination]: ../../../../../prototypes/spatial-authoring/app/experience-coordination.js
[operations]: ../../../../../prototypes/spatial-authoring/app/experience.js
[history]: ../../../../../prototypes/spatial-authoring/app/actions.js
[drawing]: ../../../../../prototypes/spatial-authoring/app/experience-draw.js
[main]: ../../../../../prototypes/spatial-authoring/app/main.js
[runtime-tests]: ../../../../../prototypes/spatial-authoring/tests/experience-runtime.test.mjs
[model-tests]: ../../../../../prototypes/spatial-authoring/tests/experience-model.test.mjs
[travel-tests]: ../../../../../prototypes/spatial-authoring/tests/experience-travel-agency.test.mjs
[foundation]: ../../../../reference/composition-execution.md#f1-identity-and-reference
