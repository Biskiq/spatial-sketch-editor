# Prototype 4.1 — synthesized spatial Experience implementation plan

EVIDENCE-PATHS: start — the paths below quote the authoring session's external checkouts (`Prototype-4`, a local agent-attachment); they are kept as written and are not routes in this repository.

Status: planning only. Evolve the existing local application; do not scaffold a replacement.

Authority: [Synthesized Spatial Experience Model](</Users/tony/.codex/attachments/d68389bd-a558-461d-b32b-497f3d2b5487/Pasted text.txt>), then the [original Prototype 4 plan](/Users/tony/Documents/Prototype-4/PLAN.md), then the working implementation. Keep the original plan as the historical baseline.

## Inspection and starting point

Reviewed the authored model and mutation helpers, history, runtime, fixture, Scene, authoring and visitor inspectors, Presenter, and all current tests. Baseline verification on 2026-09-28: typecheck and production build pass; 24 Vitest tests and 9 Playwright tests pass. The build reports the existing large-bundle advisory. These checks establish working baseline behavior, not compliance with the new synthesis.

The checkout already contains local Inspector changes and history/browser regression tests. Preserve those changes, particularly captured-control editing without duplication, visitor/authoring selection separation, and undo coalescing.

Keep React/TypeScript/Vite/Three.js, primitive geometry, native controls, the in-memory document, clone-based authored edits, and pure runtime transitions. There is no structural reason to rebuild. Add only small Camera-evaluation and presentation-planning modules; extract inspector components when their responsibilities change, without a general component rewrite.

## Resulting prototype model

| Concept | Prototype 4.1 responsibility and representation |
|---|---|
| World / Subject | Retain stable IDs, transforms, source properties, profiles and generic capability descriptors. Capability adapters supply simulated durations, effects and interruption defaults. |
| Encounter | Retain audience intention, focus and organizational membership. Zero or more Views, narration, Activities and contextual Interactions; no intrinsic previous, next or playback order. |
| View definition / View use | Retain reusable framing definitions and stable uses. A use may be available for manual viewing or participate in a presentation through an explicit entry/cue/dependency relationship. Neither creates a Guide Position. |
| Activity | Retain narration and behavior uses as authored Activities with explicit start, boundary and dependency relationships. Add interruption/effect-retention policy. Organizational membership is independent of all three. |
| Interaction | Retain a visitor activation subject separate from the capability invocation's target subject. It is an offer, not an automatically started Activity. Activation creates session execution. Availability is Experience-wide or Encounter-contextual. |
| Optional Guide | Retain positions, ordered routes, labelled choices and detours. A position is a distinct navigation occurrence referencing an Encounter and optionally a View use. One optional Guide with side routes is sufficient for 4.1. |
| Derived presentation / Visitor session | Derive execution facts and continuation estimates outside the authored document. Session state holds visits, running instances, Camera movement, cues, captions, effect ownership, navigation history and bookmarks. |

Keep the existing definition/use dictionaries and IDs. Refine use variants only where needed to distinguish View presentation, Activity lifecycle and Interaction availability. Do not make a schema cleanup or execution-engine rewrite a prerequisite for observable UI. In creator-facing copy, use Views, explanation, Activities and Interactions.

### Delivery priorities and low-floor contract

Prioritize, in order: a simple authoring loop; Encounter/View/Guide independence; a multi-View presentation with Camera-aware Auto pacing; manual Next versus an explicit Gate; and exploration with direct interaction and Guide rejoin. Preserve reuse, structural editing, repair and source isolation throughout.

A creator must be able to select a subject, create an Encounter, capture or accept a View, write a short explanation, operate a subject and choose Use in Experience, then Preview. Adding that Encounter to a Guide is one separate action. Repeating the same loop for another Encounter makes Next meaningful. None of this requires choosing a duration, cue, start/end relationship, lifetime, definition/use scope or schema field.

Supply defaults underneath: automatic framing, simulated narration duration, entry behavior, a suitable local effect boundary and Auto pacing. Put timing estimates and lifecycle diagnostics in optional presentation detail. The simple authoring surface uses plain View, explanation, subject controls, Preview and Guide language; no timing/lifecycle/schema vocabulary is needed to complete it.

### Guide structure and reuse

- “Add Encounter to Guide” creates one position presenting the Encounter. “Add selected Views as checkpoints” is a separate explicit action. Adding, removing or rearranging Encounter content never edits the Guide.
- Multiple positions may reference the same View use. Remove automatic copying from both the Guide-add helper and Position view picker. Distinct position IDs provide occurrence identity.
- Distinguish three position presentation choices: **Present Encounter**, **Start from this View**, and **Keep current viewpoint**. A null View reference alone must not ambiguously mean both “play the Encounter” and “keep the Camera still.”
- Present Encounter runs its authored viewing relationships. Keep current viewpoint suppresses automatic viewing for that position while Activities continue. The mapping from Start from this View to an ongoing presentation cursor is an experimental default described below, not a settled product rule.
- Retain same-Encounter continuity: changing framing does not automatically restart narration or reissue Activities. Do not infer a narration edit or segment boundary merely from Guide membership. The exact remaining-work calculation after a checkpoint jump is part of the experiment.
- Make route position order the authority for default Next. Replace stored default nextId plus manualNext synchronization with a connection choice: follow route order, explicit target, or end. One resolver serves the Guide strip, inspector, runtime and tests. Explicit choices/detours retain target IDs. Remove the need to rebuild cached default Next links.
- Route order controls navigation only. Presentation cue order controls events within a visit; it cannot become a second Guide graph. Camera consumes movement requests and owns their evaluation.
- Retain detach-on-first-local-edit and shared-definition editing. Show reuse scope only when it matters, including the number of uses and referring checkpoints. “Only this View use” updates that use's appearances; “Everywhere this View is used” edits the definition. An explicit “Only this checkpoint” operation creates a private use and retargets that position before editing. Adding a checkpoint alone never does this.
- Shared framing never shares connections, cue relationships, gates, lifetimes or interruption policies. Duplicating an Activity preserves its declared boundaries; regrouping changes organization only.

### Experimental defaults for 4.1

Implement these policies narrowly enough to observe and revise. They must not drive a general seek, pause or presentation-cursor engine.

| Trial | Initial 4.1 behavior | Evidence to collect |
|---|---|---|
| Checkpoint → presentation cursor | Frame the selected View immediately; leave the current narration playhead unchanged. Cancel queued Camera requests that would take the visitor back before that View's known presentation placement, then allow future cues. For an unscheduled View, frame it and wait for future cues. Recalculate only the supported remaining work. | Before an early or out-of-order checkpoint jump, ask what the creator/visitor expects the narration and next View to do. Compare the prediction with playback, including a repeated appearance. |
| Detour pause | Reuse the existing bookmark approach: save the parent visit/position and narration playhead, pause its narration and automatic viewing, let subject Activities follow their existing boundaries, then resume on return. Re-evaluate return Camera travel from the current pose. | Ask whether the explanation should pause, continue or restart, then observe the return. Check whether captions and ongoing behavior make the selected default understandable. |

Regression checks characterize these defaults and protect source isolation, activity continuity and freedom to leave. They do not establish the policies as permanent product semantics. Record expectation mismatches as prototype findings; do not build all alternative policies in advance.

### Minimal presentation planning

Add one small pure helper alongside the existing runtime that resolves the supported presentation and estimates its completion. Share those timing facts with playback. A short list of due View requests, narration cues and finite completions is enough; do not build a general dependency compiler, arbitrary timeline, branch planner or whole-Guide duration service.

Support entry, named narration cues and the existing completion dependency needed for casing → rotor. Retain existing advanced relationships without expanding their language. The first suggested View can default to entry; additional Views remain available for manual viewing. An optional “Show during this explanation” action connects a View to a named phrase/cue, with a suggested placement the creator can preview. Merely listing Views creates neither playback order nor Guide positions.

Activities retain their own start rules. Resolve contributions activated for this presentation, not everything grouped under the Encounter. Do not assume a visitor action will happen; use an explicit Gate when it is required for progression.

For the supported presentation:

1. Use the narration duration, resolved cue positions and capability durations already available.
2. Evaluate one Camera movement at a time. If a cue occurs during travel, begin its requested movement when the current one finishes. Narration continues; no audio stretching.
3. Natural readiness is the latest relevant narration end, Camera arrival, finite completion or scheduled persistent-Activity start, plus one two-second breathing allowance. Overlapping work is not summed; a persistent Activity never contributes an infinite end.
4. Reuse validation for missing references, unsupported signals and cycles. Mark unavailable work and estimate the valid remainder rather than waiting forever.

For a View-only presentation, Camera arrival plus the same allowance is sufficient. Keep breathing room as an internal default, not an Encounter-duration field.

Example oracle: an 18-second explanation requests travel at 6 and 12 seconds, after entry travel has finished. Travels of 3 and 4 seconds yield a last arrival at 16 seconds and readiness at approximately 20. Travels of 6 and 8 seconds yield readiness at approximately 22. Casing work can overlap and the running rotor adds no duration. Slower movement need not change the total when narration remains the longest contribution.

In optional Presentation details, display “Estimated presentation: ~20 sec · Auto” beside speed controls, with a short breakdown and entry-pose assumption. Recalculate after relevant edits. Keep it outside the simple authoring path and never write it back as an authored duration. Per-presentation estimates are sufficient for 4.1.

Make Auto the default. Keep existing dwell/signal overrides available in advanced detail without expanding them or requiring them for a successful walkthrough. Replace the unconditional four-second passed-cue fallback with remaining supported work plus a short rejoin allowance. Passed cues must not replay or cascade through positions.

### Camera, narration and captions

Create one Camera adapter around the existing framing solvers. Travel duration is the greater of observer/target displacement divided by a documented Auto/Slow/Normal/Fast rate; Cut takes zero time. Presets are sufficient: defer custom rates, collision detection and route search.

View intent supplies movement defaults; a Guide connection can override incoming Cut/Travel through the same adapter. Measure entry, internal presentation movement, early redirection and rejoin from the current pose. Do not count connection travel twice.

Move visitor Camera progress into deterministic session time. Scene renders/samples the runtime movement instead of running its independent fixed half-second tween for visitor requests. Retain the existing editor framing animation. An interrupted movement starts its replacement at the interpolated current pose. Free exploration reports its current pose when guidance resumes.

Keep Auto, existing distance/anchoring, Use my view and optional speed controls. Reuse subject-relative framing and fixed-view review notices. Do not add a new precise Camera editor.

Keep the ordinary explanation textarea. Derive a simulated duration and caption passages from the text using a fixed reading-rate policy; retain the existing duration field only as an optional override. Generate passages automatically, so a simple Encounter needs no caption editor. For the richer trial, let creators name a cue at a passage boundary and attach a View or Activity. Keep stable cue IDs and show resolved seconds only in detail. If an edit removes an anchor, ask for local repair rather than implementing smart text matching.

The same narration playhead drives transcript highlighting, the current caption and cue emission. Pausing, detouring, returning, early exit and completion must update all three together. Cues can request a View or start an Activity without navigating the Guide. Keep full transcript access and a caption toggle.

### Execution, permission and interruption

Keep pure elapsed-time/event transitions, existing Activity records, temporary overrides and last-command-wins ownership. Add only the visit/presentation tokens needed to reject stale Camera work and scope cue/completion records. A past visit must not satisfy a new Gate; a carried Activity must not duplicate. A general Activity-instance store is unnecessary.

Use bounded fixed simulation steps for elapsed-time updates; split a larger elapsed input into those steps. Check cue crossings once, keep Camera/captions on the same clock and retain cycle validation. Allow a small documented tolerance (for example 0.25 seconds) between estimates and observed continuation; exact arbitrary-tick equivalence and a general event-boundary scheduler are outside 4.1.

Natural readiness only controls autoplay. Manual Next is enabled immediately when a valid next destination exists unless its explicit Gate denies progression. Camera travel, narration, unfinished Activities and estimated duration are never implicit Gates.

Use the existing explicit completion/signal Gate to test progression permission. A Gate guards its marked Guide connection, not all movement through the world. Evaluate permission consistently for button, keyboard and autoplay. Back, exploration and exit remain available; broken required references explain the block. A new state-condition language is unnecessary for this iteration.

Keep start/arming scope, running lifetime, effect retention and interruption distinct. In particular, finite execution finishing must not automatically erase its result: Light intensity and casing position can remain at their target until the declared boundary or a newer command. Playback returns to stopped at completion. Reuse override ownership rather than adding another presentation layer.

| Required prototype behavior | Minimal implementation |
|---|---|
| Cancel | Cancel pending/running work and remove only effects it still owns. Never undo a newer visitor command. |
| Finish | Allow an already started finite operation to finish; retain/release its result according to its boundary. Do not start work that had not begun. |
| Continue | Keep a started persistent Activity running to its explicit stop or Experience end. |

Defaults come from type: narration and local highlighting stop, started casing motion can finish, and an explicitly persistent rotor continues. A simple optional “Keep running after leaving” control is sufficient. Defer a complete policy picker, animated fades and Settle-to-target execution; neither cancellation nor a mock fade may invent natural completion.

On ordinary departure, disarm not-yet-started work scoped to that visit even if its eventual running lifetime would have been persistent. Thus leaving before casing completion normally leaves the waiting rotor unstarted. An explicitly Experience-scoped listener can continue waiting; this is a deliberate advanced choice. Finish may emit genuine completion, but it cannot resurrect the closed visit's disarmed dependents.

Preserve these navigation guarantees, with the two trial policies kept explicitly experimental:

- Camera changes alone do not reissue Activity entry commands. Same-Encounter checkpoint jumps follow the experimental cursor policy rather than establishing a permanent narration-seek rule.
- Crossing to another Encounter creates a new visit. Previous uses actual navigation history; an ordinary revisit starts a fresh local explanation.
- Detour pause/resume follows the 4.1 trial above. Extend the existing bookmark only as needed; do not snapshot an entire execution graph or define a universal pause policy.
- Free exploration releases Camera control and pauses Guide autoplay. Narration and Activities continue by their policies; missed Camera cues do not queue a forced replay. Rejoin restores the appropriate current framing, derives remaining work, and leaves autoplay off until requested.
- With a saved Guide position, manual Next/Previous also remain usable during exploration and explicitly reclaim guidance. Remove the current blanket exploration disablement from the Next button and arrow-key handler; normal destination and Gate checks still apply.
- Presentation Camera requests carry a generation/visit token. Early navigation cancels abandoned requests before starting the destination. Handling still-relevant future cues after a checkpoint jump belongs to the experimental cursor policy.
- Final positions remain explorable. Exiting Preview clears every session effect. Ordinary authored editing remains outside Preview; a new Preview creates a fresh session.

## Fixture, creator workflow and review scope

Retain Machine/casing/rotor, Piano, Wall, Light, imported mesh, room environment and the replacement profile lacking rotor support. Add only a small addressable Switch with an activation affordance. Machine casing and rotor can remain capabilities on the Machine subject; a production sub-object hierarchy is unnecessary.

Revise Load Example to contain:

- The existing machine explanation with three Views, one continuous narration with named cues, finite casing motion, an Encounter-local highlight, and a persistent rotor.
- One default Guide position for that whole explanation, followed by the existing comparison that reuses its overview. Demonstrate extra/repeated checkpoints by explicitly adding them in the editor.
- The existing Wall Encounter as a detour, plus an environment/no-View Encounter outside all Guide routes.
- Experience-wide Piano Play/Stop and Switch → Light intensity interactions. Author the deliberate completion Gate during its optional trial, using the existing first Next connection; no new condition system is needed.
- Clearly separated View poses/speeds so the final Camera arrival can become the critical path. The primary guided flow remains ungated so early Next is immediately demonstrable.

Reset still restores the baseline room, empties the Experience, and clears history, auditions, review observations and execution. Load Example restores the revised editable example and clears the same transient state. Neither starts Preview or autoplay.

Keep one spatial workspace. The Encounter inspector should lead with intention, Views, explanation and “what happens”; contextual Interactions and optional guidance follow. Capture and capability operation remain the primary actions. Hide raw definition IDs, global signal lists, organization/lifetime detail and shared scope until relevant. Replace a global dependency chooser with subject/Activity selection followed by that item's supported cues or completions. When several Activities control the same subject channel, require choosing the Activity to edit or “Capture another Activity”; do not silently edit the first matching use.

For cross-subject interaction authoring, retain “operate target → Let visitors activate this” and clarify the existing trigger picker as “Activated by.” Operating Light and choosing Switch is enough to test the binding. Do not require a second interaction-builder workflow or a global action catalogue.

Keep the Presenter observational and dismissible. Give it a short successful path before richer trials:

1. From Reset, select Machine, create an Encounter, accept/capture its View and type a short explanation. Operate casing → Use in Experience → Preview with no Guide. No advanced panels are needed.
2. Add that Encounter to the Guide. Repeat the simple creation loop for a second Encounter, then Preview and use Next. The first Encounter occupies one position.
3. Explore and rejoin. This completes the quickstart; the reviewer can stop with a usable authored Experience. Creating independent visitor offers is a separate trial.

Continue with a separate richer trial: capture more Views, choose phrases at which to show them, observe one multi-View presentation inside one position, enable Auto, change Camera speed and compare the estimate with playback. Then deliberately add a selected View checkpoint and try an early jump.

Optional trials cover a Gate refusing then permitting progression, pending versus persistent behavior, independent/cross-subject interaction, experimental detour pause/return, local/shared View revision, World/Experience scope, a no-View Encounter and repair. Each checks the observed outcome, not merely that a field was authored. Back/Skip never create missing content. Reviewer shortcuts remain labelled and call ordinary commands.

For low-floor evidence, also run the quickstart with the Presenter closed and only a plain-language task prompt. Record the creator's action path, requests for help and any advanced control they felt forced to open. Automated success alone does not establish that the model is understandable.

Mocked: primitive geometry/effects, straight-line Camera evaluation, text-derived narration duration/captions and provider replacement. Retain generic capabilities and real structural edits despite these mocks.

Omitted: backend, durable persistence, publishing, collaboration, asset import, production audio, full Camera routes/physics, arbitrary scripting/conditions, shell integration, final visual polish and production device/accessibility coverage. Preserve basic keyboard operation and readable labels. Capability interactions and existing spatial Encounter entry are enough for 4.1; defer general link/content action catalogues, event-conditioned Interaction availability, multiple named Guides and production schema migration.

Also defer a general presentation seek/pause engine, exact arbitrary-tick scheduling, total-Guide runtime estimates, smart transcript alignment, a full interruption-policy editor and custom Camera rates. Existing supported behaviors remain; new infrastructure must serve an observable trial above.

## 1. Reconciliation summary

| Disposition | Old plan / implementation evidence | 4.1 decision |
|---|---|---|
| Fully valid | Plain model, authored edit helpers and history in [model.ts](/Users/tony/Documents/Prototype-4/src/model.ts) and [history.ts](/Users/tony/Documents/Prototype-4/src/history.ts); isolated projection in [runtime.ts](/Users/tony/Documents/Prototype-4/src/runtime.ts). | Retain stable identity, reducer/runtime separation, undo, World/Experience scope, session isolation and last-command-wins behavior. No framework or architecture replacement. |
| Fully valid | Capability-driven controls, non-object creation, independent Piano interaction, no-Guide preview, adaptive/fixed framing, repairable instructions, real structural editing, Reset/Load Example and observational Presenter. Existing tests exercise these. | Retain and extend. These are already synthesis-aligned, not new features requiring reconstruction. |
| Valid, refine | Definitions, uses and positions are separate, but addToGuide and the Position inspector copy a View use when another position references it. | Navigation occurrence identity comes from the position. Create a new use only for an explicit duplication or local occurrence edit. |
| Superseded | addToGuide promotes every Encounter View by default; EncounterInspector says it does not create a presentation inside the Encounter. The fixture, Presenter and tests expect three machine positions. | Default to one Encounter position. Add presentation relationships independently; select checkpoints explicitly. Replace those count/identity expectations rather than preserve them as regressions. |
| Superseded as the default | Position.pacing is only dwell/signal; new positions and passed-cue fallback use four seconds. | Auto derives from actual work. Retain explicit dwell/signal overrides as advanced intent, not mandatory authoring. |
| Valid intent, misleading implementation | Route order and stored nextId/manualNext are synchronized by rebuildRoute; the strip can disagree with an explicit destination. | Keep default order plus explicit connections, resolve them once, and display explicit deviations. No cached duplicate default chain or Encounter-level navigation. |
| Valid, refine | Interaction triggerSubjectId is separate from ControlDefinition.subjectId, and the UI already permits rebinding them. Generic Use also carries irrelevant lifecycle fields; complete can immediately release an interaction's state effect. | Preserve the cross-subject representation. Improve subject-first binding, typed variants and effect retention; add Switch/Light evidence and missing-trigger/target repair. |
| Valid, refine | Activities already have start/end relationships; closeEncounter applies a blanket stop to matching boundaries, and signals are keyed only by use ID. | Add visit-scoped arming/signals, type-based interruption, completion-versus-result retention and stronger bookmark state. Preserve carried Activities and same-Encounter continuity. |
| Genuinely new | [Scene.tsx](/Users/tony/Documents/Prototype-4/src/Scene.tsx) owns a fixed approximately 0.5-second visitor tween; runtime stores only a destination. | One duration-aware Camera adapter supplies both runtime movement and estimates, including speed, interruption and rejoin. |
| Genuinely new / refinement | Narration has duration and named second-based markers; [Visitor.tsx](/Users/tony/Documents/Prototype-4/src/Visitor.tsx) displays the whole text and progress. View starts are ignored by runtime. | Coordinate semantic cues, captions, View requests and Activities in one presentation; derive readiness from their overlap and dependencies. |
| Valid, refine | [Inspector.tsx](/Users/tony/Documents/Prototype-4/src/Inspector.tsx) exposes definitions, organization, starts/ends and global signal choices early. | Keep real controls, but present meaning, framing and subject operations first. Reveal lifecycle, reuse and timing only when relevant. |
| Fully valid with revised content | [fixture.ts](/Users/tony/Documents/Prototype-4/src/fixture.ts), [Presenter.tsx](/Users/tony/Documents/Prototype-4/src/Presenter.tsx) and the existing domain/browser test structure. | Reuse the room, examples, observational checks and test harness. Update scenarios and assertions around the superseded assumptions. |

The difficult-to-test parts are localized: automatic Guide promotion, duplicated navigation authority, the render-owned Camera clock, incomplete effect/interruption semantics and early exposure of the schema. Address those directly; retaining them would bias the experiment toward a tour model.

## 2. Revised implementation sequence

Use four UX milestones instead of eight separate infrastructure stages. Within each, make focused commits that connect model/runtime changes to real controls and an observable result. Update fixture data, validation, Presenter instructions and relevant tests as each capability lands; none should wait for a final integration pass.

### Stage 1 — create, preview and guide a simple Encounter

**Goal:** a creator completes the low-floor loop immediately, with guidance optional.

**Changes:** merge the Encounter editor simplification with Guide/View decoupling. Lead with intention, subject operations, View capture and a plain explanation; supply narration/lifecycle defaults and hide schema detail. Add Encounter creates one position; selected View checkpoints are explicit, and repeated references do not clone uses. Resolve default Next from route order, with explicit targets shown through the same resolver. Keep direct View selection and existing exploration usable. Add the Presenter quickstart now.

**Reuse:** current subject controls, capture helpers, definition/use identities, framing, history, manual visitor navigation and no-Guide Preview. Preserve current advanced autoplay until Stage 2 supplies the new Auto default.

**Checks:** perform A0's task with no advanced panel opened; repeat it to create a second Encounter and use Next. Three Views can belong to an Encounter with zero or one position. Guide reorder/remove works without changing content, and Preview leaves source untouched. This milestone is a complete manual authoring/guidance experience.

### Stage 2 — see a multi-View presentation pace itself

**Goal:** one narrated Encounter visibly presents several Views, and Camera speed changes its Auto estimate/playback.

**Changes:** integrate the small presentation helper, duration-aware Camera adapter, cue-driven View requests and Auto pacing as one vertical slice. Keep the explanation textarea; derive captions/duration and offer optional named-phrase placement for additional Views. Scene samples visitor movement from the runtime clock. Reuse the casing completion → rotor dependency, exclude persistent duration and expose one estimated-presentation label. Deliver a working two-View explanation first, then extend the same flow to the three-View fixture; do not develop independent engine layers before showing playback.

**Reuse:** framing solvers, narration markers, duration descriptors, Activity playheads, tickRuntime, visitor progress UI, validation and autoplay controls.

**Checks:** one narration/caption playhead spans three Views without changing positionId; the same presentation works without a Guide. Auto accounts for overlapping narration, finite action and Camera cost, including the numeric oracle. Speed changes on the critical path change both estimate and observed continuation. Manual Next works before completion. The simple Stage 1 flow still requires no timing or cue authoring.

### Stage 3 — visitor agency, independent interactions and policy trials

**Goal:** exploration, guidance and direct interaction coexist, with a Gate visibly different from pacing.

**Changes:** add Switch → Light through the existing target/trigger binding controls; fix finite-result retention. Implement only the Cancel/Finish/Continue defaults needed by the fixture and the optional persistence control. Disarm pending visit work on departure and reject stale cues. Keep Next available while exploring when its destination/Gate permits it; rejoin from the current Camera pose with autoplay off. Exercise the existing explicit completion Gate. Add the two checkpoint/detour experimental defaults with minimal visit/bookmark fields, not a general pause/seek abstraction.

**Reuse:** capability inputs, activation, effect ownership, Gate checks, actual-history Previous, exploration/rejoin and the existing detour bookmark.

**Checks:** independent Piano and cross-subject Light interaction work with no Encounter/Guide. Early Next, blocked then released Next, persistent versus local behavior and visitor Stop all work through real controls. Checkpoint/detour tests characterize the trial policy and record user predictions; source isolation and no duplicated entry remain hard requirements. No timing/lifecycle controls enter the quickstart.

### Stage 4 — revise real work and collect acceptance evidence

**Goal:** reviewers can author, revise and repair their own example, and the prototype produces usable evidence.

**Changes:** finish local/shared and checkpoint-only View editing, structural command coverage and repair for newly introduced references. Reuse existing add/rename/copy/replace/regroup/remove operations; do not build a universal graph-cloning framework. Complete the richer Presenter trials and revised Load Example, and update README/tests. Audit cue/trigger/target/View/availability/Gate references, default navigation reconnection and explicit missing destinations.

**Reuse:** clone-based edits, coalesced history, definition detachment, issue links, profile replacement, existing regression tests, read-only snapshots and reviewer observations.

**Checks:** edits remain genuine, undoable and locally repairable; removing an Encounter preserves contributions, while removing a checkpoint's View yields Keep current viewpoint. No silent retargeting. Reset/Load Example restore their documented states. Run typecheck/build/domain/browser checks and the low-floor manual trial; record outcomes for checkpoint and detour defaults. A successful prebuilt example does not substitute for successful authoring from Reset.

## 3. Prototype 4.1 acceptance / test matrix

“Domain” includes authored-command, small presentation-helper, Camera and runtime tests. Browser scenarios author through real controls and may read snapshots to assert outcomes. Manual review records comprehension and visible behavior. Checkpoint-cursor and detour-pause checks characterize 4.1 trial policies; independence, source isolation and visitor permission are model invariants.

| ID | Scenario and required outcome | Verification |
|---|---|---|
| A0 | From Reset, select a subject → create Encounter → accept/capture View → write a short explanation → operate subject/Use in Experience → Preview without a Guide → Add Encounter to Guide. Repeat the simple loop for a second Encounter and use Next. No duration, cue, lifecycle, start/end, definition/use or schema control/vocabulary is shown or required; timing estimates remain in optional detail. | Browser: assert the authored result, one position per Encounter and no advanced panel opened; defaults work underneath. Manual: a creator performs the task with Presenter closed, without an explanation of timing/lifecycle/schema; record completion, help requests and unexpected detours. |
| A1 | Three Encounter Views; zero Guide positions initially; Add Encounter creates one; adding a selected checkpoint adds only that occurrence. An unselected View still appears by cue. | Domain + browser |
| A2 | Create and preview an Encounter with no Guide, including a no-View environment/region Encounter. Enter Encounters in arbitrary order without implied previous/next. | Domain + browser + manual |
| A3 | Piano activation with no Encounter or Guide; Switch activation changes Light, retains the completed state result, and leaves framing/navigation alone. | Domain + browser |
| A4 | Interaction availability is independent of organization; trigger/target changes use supported capabilities. A new capability description works without authoring branches. | Domain + browser |
| A5 | Narration, several Views, finite casing work and persistent rotor form one presentation; captions, transcript and semantic cues stay synchronized. Cue-driven viewing does not change Guide position. | Domain + browser + manual |
| A6 | Auto derives from overlapping durations/dependencies and one breathing allowance. Persistent duration is excluded; work scheduled but not assumed visitor-triggered is handled explicitly. | Domain with numeric oracles |
| A7 | Cut versus Travel, longer distance and slower speed change Camera estimates and observed arrival; a critical-path change changes total guided runtime. No double-counted entry/connection travel. | Domain + browser + manual |
| A8 | Manual Next at an early time succeeds while narration/travel are active, with no Gate. Autoplay waits for natural readiness; explicit dwell/signal overrides remain intentional and separate. | Domain + browser |
| A9 | An explicitly authored completion/signal Gate blocks its connection across button/keyboard/autoplay, then permits it when satisfied. Remove the Gate and early Next works. A past visit's completion does not unlock a new visit; broken references explain the block. | Domain + browser |
| A10 | Leave before casing completion: unstarted visit-scoped rotor stays unstarted. Leave after rotor starts: persistent rotor continues; local highlight/narration stop. Only already started finite work can Finish; pending work is never forced to its target. | Domain + browser + manual |
| A11 | Visitor Stop is not undone by later View changes, stale completions, carried work or rejoin. Cancellation removes only the departing owner's effect. | Domain + browser |
| A12 | Free exploration releases Camera and pauses autoplay; interaction and permitted manual Guide navigation still work. Rejoin evaluates from the actual pose, skips passed Camera cues and requires an explicit autoplay restart. | Domain + browser + manual |
| A13 | Characterize the experimental detour default: parent narration/captions pause and resume, subject Activities follow their boundaries, and return does not duplicate entry. Record whether the reviewer expected pause, continuation or restart. Ordinary cross-Encounter Previous still starts a fresh local visit. | Domain + browser characterization; manual expectation/observed-outcome record |
| A14 | Repeated positions have distinct IDs and can reference one use; Guide order and presentation relationships stay independent and use one navigation resolver. Characterize early/out-of-order checkpoint jumps without asserting a permanent cursor policy; record expected versus actual narration/framing. | Domain + browser; manual trial record |
| A15 | Local View edit affects only the chosen use; shared edit affects linked uses; checkpoint-only edit detaches explicitly. Connections/lifetimes do not change, and scope/affected-count UI is accurate. | Domain + browser + manual prediction |
| A16 | Add, rename, duplicate, replace, reorganize and remove content/positions; default chain reconnects, explicit references remain repairable, organization does not rewrite lifecycle. Undo/redo restores relationships; dragging stays one edit. | Domain + browser |
| A17 | Subject/profile loss, missing trigger/target/View/cue and dependency cycles preserve instructions and unaffected playback. Rebind/remove/replace through issue links repairs locally. | Domain + browser |
| A18 | World edits change source truth; Experience auditions and Preview use temporary state. Adaptive framing follows source movement; fixed framing receives review. | Domain + browser + manual |
| A19 | Freeze/snapshot the authored World and Experience, then execute cues, interactions, gates, early leave, autoplay, detour and exploration. Deep equality holds; exit clears session effects and preserves author selection. | Domain + browser |
| A20 | Fixed-step updates keep estimated/observed arrivals, captions and readiness within the documented small tolerance for supported scenarios. Larger elapsed inputs do not miss or duplicate cues. Invalid dependencies are reported without hanging. | Focused domain tests; no arbitrary-tick equivalence requirement |
| A21 | Presenter observes actual creation and runtime outcomes; Next is not earned by merely adding a Gate or pressing a control. Back/Skip/close/reopen preserve work and never author it. | Browser + manual |
| A22 | Reset restores baseline World and empty Experience; Load Example restores the documented editable example. Both clear session/history/audition/review state and neither starts playback. | Domain + browser |

Completion requires the matrix checks, passing typecheck/build/tests, a manual Presenter pass and A0's creator evidence. If the simple task requires explaining timing/lifecycle/schema or opening advanced controls, revise the entry UI before expanding runtime scope. Keep the existing captured-edit, selection-isolation and undo regressions. Replace assertions encoding superseded assumptions rather than deleting their coverage. Record expectation mismatches in the two experimental policies as findings, not as proof that the product semantics are settled.

## 4. Product questions requiring prototype evidence

The model and its independence/isolation guarantees remain the authority. Checkpoint-to-cursor behavior and detour pause behavior are provisional 4.1 defaults. Collect evidence before hardening either into product semantics or a reusable engine:

1. Can a creator complete A0 without learning timing, lifecycle or schema concepts, and predict that adding Views does not add Guide positions? Where does the UI force an unnecessary concept or decision?
2. On an early, repeated or out-of-order View checkpoint, should narration continue, seek or restart? Does the initial framing-without-seeking default match expectations?
3. Should a detour pause the parent explanation, let it continue or restart it on return? How do ongoing subject behavior and captions affect that expectation?
4. Does the simple Auto estimate make sense when Camera speed changes the result, or when narration still dominates? Are named phrases sufficient to place additional Views without a timing editor?
5. Do manual Next, an explicit Gate, exploration and rejoin feel distinct and predictable? Are the limited early-leave defaults sufficient for local versus persistent behavior?
6. Can creators predict local/shared View edits and discover Switch → Light binding through subject controls, without needing internal IDs or an action catalogue?
