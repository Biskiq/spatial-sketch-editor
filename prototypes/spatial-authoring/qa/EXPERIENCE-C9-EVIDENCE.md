# C9 Experience reconciliation — evidence record (C9.1–C9.5)

TYPE: prototype acceptance evidence (C9.1–C9.5 implemented; C9.6–C9.9 and Paper not started; stopped for MP3)
STATUS: **MP2 accepted by the owner 2026-10-05.** C9.1–C9.3 implemented; the five external MP2
review blockers repaired with regression coverage, then the review's folded second-pass findings
(station activation contract, cue-scope consistency, remaining-work edge cases, stale provenance)
repaired with their own coverage; C9.4 (Camera default Travel and live invocation) and C9.5
(visitor participation and agency) then implemented, self-reviewed and verified at the executable
revision recorded below. MP3 is not claimed; the slice stops at the MP3 human gate.
No merge, phase closure or Paper work was requested or performed. Commit/push provenance is
recorded exactly under *Executable revision*; nothing here claims an uncommitted increment that
Git already holds as commits.
SCOPE: [C9 authoring-completeness plan][plan] C9.1–C9.5 only. This record supersedes
nothing in the [C1–C8 conformance record][c8]: that remains the acceptance authority for
C1–C8 behavioral/visual conformance.

## Executable revision

- Branch `prototype-v2`; base commit `abaa7592730f565a8d47fd8480d69f0907dfe6c7` ("C9.1
  review pass"). The C9.1 slice was committed by the owner's review pass.
- Commit provenance, correct against live Git at the close of this increment: C9.2/C9.3
  (with the C9.1 regression hardening it needed) is `12652d9b`, the first external-review
  repair pass is `db83a9d7`, and the second repair pass is `9a44678a`; all three are pushed to
  `origin/prototype-v2`. This record's evidence update and the two status docs form the
  docs-only child of `9a44678a` and are pushed with it, so the pushed head names the exact
  authenticated executable. An earlier revision of this record and of the checkpoint described
  C9.2/C9.3 as an uncommitted working-tree diff with "no commit/push performed"; that was stale
  and was corrected by the second repair pass, and the push itself followed on owner
  instruction.
- **C9.4/C9.5 are `c118c08b`** ("C9.4/9.5 implementation"), pushed to `origin/prototype-v2` as the
  child of `1b9cf745`. `1b9cf745` ("C9.2-3 full-axis verification") is the docs-only child of the
  `9a44678a` executable named above, so the C9.2/C9.3 numbers recorded below remain that
  increment's evidence. Every `app/`, `tests/` and `qa/` file of `c118c08b` is byte-identical to the
  revision the C9.4/C9.5 verification ran against, each run finishing after the last edit to any of
  those files; this record and the four status docs land as the docs-only child of `c118c08b`, so
  the pushed head an independent C9.4/C9.5 review should read is that child.
- **The independent-review repair pass is `bdaa9a83`** ("C9.4/9.5 review repairs"), pushed to
  `origin/prototype-v2` as the child of `19074d95`. The executable the review read was `c118c08b`
  (with `19074d95` as its docs-only child); this record and the four status docs land as the
  docs-only child `88dda494`, with this record's own list-rendering fix `4c5188cf` on top, so the
  pushed head a re-review should read is `4c5188cf` — docs only above the executable `bdaa9a83`. Every
  `app/`, `tests/` and `qa/` file of `bdaa9a83` is byte-identical to the revision this pass's
  verification ran against, and to every file of the pushed head, which differs from it in markdown
  alone.
- One executable serves every axis and journey: `index.html` + `app/` in this directory.
  Inspect live Git for exact bytes; the changed paths are:

  - the review repair pass touches `app/experience-runtime.js`, `app/experience.js`,
    `app/experience-ui.js`, `app/main.js`, `tests/experience-travel-agency.test.mjs`,
    `qa/visitor-check.sh`, `qa/composition-mutation-check.sh`, this record and the four status docs
    cited above.
  - C9.4/C9.5 touches `app/camera-evaluation.js`, `app/experience-model.js`,
    `app/experience-runtime.js`, `app/experience-ui.js`, `app/experience-draw.js`,
    `app/experience.js`, `app/main.js`, `tests/camera-conformance.test.mjs`, new
    `tests/experience-travel-agency.test.mjs`, `qa/experience-check.sh`, `qa/conformance-check.sh`,
    `qa/visitor-check.sh`, `qa/composition-mutation-check.sh`, this record and the four docs cited
    above.
  - the second repair pass touches `app/experience-model.js`, `app/experience-runtime.js`,
    `app/experience-ui.js`, `app/experience.js`, `app/main.js`,
    `tests/experience-runtime.test.mjs`, `tests/experience-mp2-review.test.mjs`,
    `qa/composition-mutation-check.sh`, `qa/conformance-check.sh`, this record, the C9 plan
    header and the status docs below.
  - first-pass app: `actions.js`, `experience-capabilities.js`, `experience-model.js`,
    `experience-runtime.js`, `experience-scene.js`, `experience-ui.js`, `experience.js`,
    `main.js`
  - styles: `styles/app.css`
  - tests: `tests/experience-runtime.test.mjs`, new `tests/experience-composition.test.mjs`,
    new `tests/experience-mp2-review.test.mjs` (external-review regressions)
  - qa: `lib.sh`, `run-all.sh`, `mutation-check.sh`, `conformance-check.sh`,
    `experience-check.sh`, `reconciliation-check.sh`, `README.md`,
    `EXPERIENCE-ACCEPTANCE.md` (declares the deleted fixture path per the documented
    `EVIDENCE-PATHS` convention), new `composition-check.sh`, `creator-check.sh`,
    `composition-mutation-check.sh`, new `EXPERIENCE-C9-EVIDENCE.md` (this record)
  - docs: `docs/operations/current.md`, `docs/operations/checkpoints/pr113-experience-v2.md`,
    `docs/roadmap/p25-experience/README.md`,
    `docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md`
    (first pass; the second pass updates the last three plus this record)

## Product work covered

- **C9.2 — local composition execution** (J2/J4): organization separated from activation,
  arming scope, boundary and retention; explicit activation and Experience-wide listeners;
  hold policy and later-entry cue cutoff; fresh repeated-Stop visits; captions/transcript;
  several Views with explicit visitor choice; opt-in View suggestions; current-adapter Auto
  estimates; explicit marker seconds that survive explanation edits; cue/Gate validation
  without silent fallback.
- **C9.3 — normal Guide/Stop editing** (J3/J10): Peek selection distinct from explicit L2
  Expand; compact Stop Card authoring entry/Next/pacing/dwell/signal/Gate; direct Preview
  Guide; one Stop per Presentation and explicit order/target/end; owner-ratified fresh
  repeated visits; visible compact editing at 1440×900 and 1024×768.
- **C9.4 — Camera default Travel and live invocation** (N1, owner-ratified): choosing Travel is one
  explicit aggregate authoring transaction. `prepareTravelSupport` reads the Seam's eligible origins
  with the ordinary `originCoverage` reading and has **Camera** create only the missing direct
  connection for each; existing authored routes are reused untouched, an origin already at the
  destination View is Camera's own zero-distance evaluation rather than a fabricated edge — and only
  while the visitor is actually standing there; from anywhere else the same-View Seam is the ordinary
  Camera framing invocation evaluated from the live pose — and an unresolved origin or destination entry
  stays a reported gap. Nothing else creates connectivity:
  adding or selecting a View and starting a Preview leave the Camera graph alone. Execution is the
  existing Camera evaluator, invoked from the visitor's **live** pose: `liveConnectionPath` is the
  live-start instance of the same route (the authored interior observer anchors and the destination
  are preserved verbatim, the departure endpoint is where the visitor actually is), so early Next,
  redirect and rejoin traverse the supported directed route instead of demanding a second
  departure. The C8 departure-readiness restriction is removed at both of its former copies
  (`gateState` and `goStop` now share the one `travelInvocation`), an unsupported origin is still an
  explicit local refusal with no silent fallback, Cut still executes no route beats or flight, and
  route/station/Hold/invocation execution stays bound to the traversed connection, exactly once.
  Advanced route editing, anchors, named stations and Hold remain compatible unchanged.
- **C9.5 — visitor participation and agency**: interaction stays a visitor offer and is never armed
  automatically; a real click on a used subject activates what that subject offers, while a drag
  orbits the visitor's own viewpoint and never activates (release decides, with a 6px slop); several
  offers for one subject open an **explicit choice** instead of executing the first enumerated one;
  an offer reads its availability, its activation subject and the subject it operates before the
  click; an offer's availability is authored explicitly and independently of its organizational home,
  defaulting to Experience-wide (I4); eligible Presentation Views stay deliberate visitor choices;
  another Presentation opens as its own bounded visit — parking a Guide Stop with exactly one return
  bookmark — and closes back to exploration with the parked Return still explicit; Preview Experience
  starts a world-only visit with no Presentation, Stop or Guide whenever an Experience-wide offer exists
  (I3/J6); manual View/Next/Back and rejoin follow the accepted live-navigation semantics; Rejoin and
  detour Return resume the playhead rather than rebuilding an estimate — the remaining work is what each
  live run has not yet spent, a cue whose own signal already fired is skipped while future cues stay, and
  Return recomputes the parent's remainder and cue floor instead of leaving the detour's reading attached
  (V2/V7); the experimental parent pause/bookmark policy is preserved as experimental and is never
  promoted here; and the whole session runs against a deep copy of World/Scene/Camera/Experience, so no
  visitor action writes authored source or history.

## MP1 and MP2 record

- **MP1 — accepted explicitly by the owner, 2026-10-04, in this thread.** The standalone J1
  loop (real subject → explanation/framing → capability capture → no-Guide Preview/return)
  was inspected with the Presenter closed. No comprehension result was invented.
- **MP2 — ACCEPTED by the owner, 2026-10-05.** The manual review repeated J1, added A/B,
  previewed the Guide and pressed Next, selected and edited a Stop at Peek, deliberately
  opened and left Overview, and judged View/Stop ownership and editing scope predictable;
  no workflow failure blocked ordinary use, so the reviewed low-floor Guide behavior is
  accepted as-is. Three observations were recorded as explicitly **non-blocking** and were
  not treated as reopening C9.1–C9.3:
  - the shell/control density is still high — assigned to the later dedicated UI/UX
    refinement slice, not a C9.1–C9.3 defect;
  - Guide navigation snaps/cuts when a Seam travels — the expected pre-C9.4 state, because
    ordinary Camera Travel is the work C9.4 was authorized to deliver;
  - View/Presentation removal is incomplete — deferred to C9.6 revision/repair, which owns
    removal, repair and copy/link/regroup behavior.
  Nothing above redefines MP2 as automated evidence; the outcome is the owner's manual
  verdict, and C9.4/C9.5 proceeded on the strength of it.

## External MP2 review — five blockers repaired (2026-10-05)

An external review of the C9.2/C9.3 revision blocked MP2 with five named defects. Each is
repaired at its owning authority and protected by regression coverage; the human gate is not
claimed here.

- **P1 route writer outlived its Stop selection.** `selectStop` now ends the procedure that
  belonged to the previous context (`occurrence`/`seam`/`route`/`coordination`/`precision`/
  `hints`), normalizes disclosure to the Peek-level reading and clears the seam, while leaving
  the realized viewpoint untouched. `routePoint` and `routeProposal` additionally refuse any
  writer that is not the task in hand, so a stale Stage click cannot edit an old route.
  Coverage: the writer end plus Stage-entry refusal in `experience-mp2-review.test.mjs`, and
  `conformance-check.sh` selecting an unrelated Stop through the real control and then a real
  Stage press, with the old route byte-identical and the standpoint unchanged.
- **P2 explanation binding vs organizational home.** The primary explanation now carries an
  explicit `primaryFor` binding; regrouping changes `presentationId` only, so editing
  Presentation A updates the original use instead of creating a second narration, and the
  Card excludes the bound explanation from its additional-contribution list by binding rather
  than home. Coverage: the model case and `composition-check.sh` regrouping the fixture
  explanation through `data-exp-home`, then editing A and observing exactly one narration.
- **P3 Experience-scoped narration output.** `emit` treats Experience-scoped runs as
  Experience output: captions and View cues survive later Stop entries, while visit-local
  output is still dropped once its visit passed, a stale run cannot emit, and signals remain
  visit-keyed so an Experience-scoped completion never satisfies a later Stop's Gate.
  Coverage: caption and cue through a later visit, plus the Gate counter-proof.
- **P4 Auto derived from remaining runtime work.** Readiness subtracts time already spent by
  carried Experience-scoped runs (completed work owes nothing), already-passed cue moments no
  longer delay arrival, Auto never advances while a Camera move is in flight, and the Auto
  toggle keeps the Stop's remaining-work clock instead of restarting it. Movement duration
  still comes from Camera evaluation. Coverage: completed and partially spent Experience
  narration, a long manual move, and the Auto clock (including a real visitor toggle in
  `composition-check.sh`).
- **P5 signal activation scope.** `contributionIssues` reports start dependencies and View
  cues whose reference can never emit for the instruction, and `stopConditionIssues` reports
  Gate and pacing references outside the Stop's own visit; `gateState` refuses them as
  repairable. The authored instruction is retained and the run is `unavailable` — never an
  endless wait. Coverage: dependency, cue and Stop-condition cases, each with a compatible
  control that stays green.

Regression coverage: `tests/experience-mp2-review.test.mjs` (10 cases), four new
`composition-check.sh` assertions and two new `conformance-check.sh` assertions.
`qa/composition-mutation-check.sh` gains seven same-defect obligations (route writer,
explanation binding, Experience output, completed work, live move, Auto clock, dependency
scope), and the existing hold-cue mutation now targets the review-era emit gate.

## Second external MP2 review — folded verdict and repairs (2026-10-05)

The same reviewer re-read the committed revision and folded its verdict: **C9.1 accepted**;
**C9.2 needs repairs** for station activation, cue-scope consistency and remaining-work edge
cases; **C9.3**'s Guide/Stop workflow looks acceptable once those shared runtime semantics
are green, and the combined C9.2/C9.3 verdict cannot be accepted while they are red. Each
finding is repaired at its owning authority, and each repair is protected by a named
assertion with a same-defect mutation obligation.

- **Station invocation contract (P1).** `addInvocationBeat` was adding `{kind:'invoke',
  useId}` to the Seam and nothing else, so an Activity armed by Presentation/Experience entry
  also ran again at the station, and the picker offered every non-View use. Binding a station
  is now the Activity's **trigger**: the use is re-bound to `{kind:'station', seam,
  connectionId, stationId, presentationId: destination}`, which replaces entry/Experience/
  dependency activation, scopes its output to the destination visit, and makes `armScope`
  (already station-aware) the only arming path. One Activity is invoked by one station — a
  second binding is refused with an explicit refusal instead of layering a second trigger — and
  the invocation is idempotent for the same station. Only automatic work this Scene can
  actually produce is invokable: `invokableRefusal` is the single authority the model refuses
  with and the coordination picker offers from, so a visitor offer, a Camera View, an
  unsupported capability and a definition-less use are never presented as traversal work, and
  UI and contract cannot disagree. The destination plan counts invoked work once, at its own
  station time inside the incoming movement; the Activity Card reads the binding
  (`invoked at <station> · Seam i → j`) and the Stop Card's coordination detail says
  `trigger moves here`. A station trigger whose Seam no longer resolves or is no longer
  adjacent is a repairable `Station invocation needs repair` issue, never a silent dead end.
  Coverage: two new review cases (trigger replacement with entry amortization and idempotence;
  automatic-work-only with the refusal surface), the `double-invoke` mutation now
  reintroducing the *entry-plus-station* defect by dropping the re-bind, a new
  `invoke-repeat` obligation for once-per-transition, a new `offer-invoke` obligation, and
  four real-UI assertions in `conformance-check.sh` (offer authored as an offer, picker
  exclusion, binding read after the real click, Card reading).
- **Cue scope versus Gate/pacing scope (P1).** One predicate was answering two questions.
  `signalCanDriveVisitCondition` is the strict question — Gate, pacing and visit-local
  dependencies must be released inside the Stop's own visit, so Experience-start completion
  can never unlock a later Stop. `signalCanCuePresentation` is the live-output question —
  `emit` deliberately lets Experience-scoped narration cue the View of the current
  Presentation, so that cue is legitimate work, not an impossible scope. `contributionIssues`
  now uses the cue predicate for View cues and the strict predicate for dependencies and Stop
  conditions, which is what makes runtime, repair system and readiness planner agree (J4):
  the previously rejected cue is no longer reported, no longer dropped from Camera requests,
  and still fires in the runtime. Coverage: the new `P3 a View cue driven by
  Experience-wide output…` case (predicate, plan request at the authored phrase time, runtime
  cue, plus the Gate counter-proof on the same reference), and a `cue-scope` mutation that
  collapses the cue predicate back onto the strict one while the Gate counter-proof stays
  green.
- **Remaining-work edge cases (P1/P2).** `carriedElapsed` subtracted elapsed time
  independently at every recursive node. The plan now models remaining runtime completion
  once: `windowOf` places each contribution as the window it actually occupies relative to
  the visit entry (`start`, `duration`), chaining dependents from the parent's **signal**
  position and letting a dependent that has already begun keep its own position, so no path
  pays the same spent time twice. A carried run read as stopped or unavailable returns `null`
  and is excluded with its disarmed dependents — stopped work never resumes, so a later Stop
  never waits for its remainder — while absence of a reading still means freshly armed. Cue
  moments now come from the same model (`signalAt`), and a cue whose authored moment already
  passed before entry still cannot fire or delay arrival. Coverage: a stopped-run case
  (readiness drops to breathing, the dependent is stopped with it, Auto advances), a carried
  dependency case that double-subtracts under the old math (readiness 12 s, not 10 s), and
  `stopped-remainder`/`carried-dependency` mutations that reintroduce each defect while the
  unaffected completed-work control stays green.
- **Operational provenance (P2).** The evidence record, checkpoint and `current.md` still
  described C9.2/C9.3 as an uncommitted working-tree diff with "no commit/push performed".
  Git says otherwise (`12652d9b`, then `db83a9d7`, both on `origin/prototype-v2`), so the
  provenance is corrected in all three records; this second repair pass is its own commit
  (`9a44678a`), pushed on the owner's later instruction, and the full axis driver was then
  rerun at that revision (Verification results).

## C9.4/C9.5 self-review — findings repaired

The combined increment was re-read against the accepted semantics before verification. Each
finding below was repaired at its owning authority and is protected by coverage; the two that
touch surrounding C9.1–C9.3 behavior are named as such.

- **An origin already at the destination View was reported as a Travel gap** (C9.1–C9.3 behavior,
  in scope because N1 makes Travel ordinary). `originCoverage` reports `connectionId:null` for such
  an origin because no edge is needed, and the Seam UI, the Plan chip and the C8 gate all read
  `!connectionId` as "no Camera connection": Travel was refused and the author was asked to create a
  connection that must not exist. It is now Camera's zero-distance evaluation — `direct` in the
  preparation report, `✓ Camera zero-distance` in the Seam, no gap chip for `viewId===targetId`, and
  `{path:null, speed:'cut'}` rather than a refusal at travel time.
- **The departure-readiness rule had two copies.** `gateState` carried its own prose copy of the
  check `goStop` performed, so removing the C8 restriction in one place would have left the other
  refusing early Next while the UI no longer explained why. Both now call the single
  `travelInvocation`, which is where the `live-departure` mutation reintroduces the old behavior.
- **A drag that began on a used subject fired the offer.** `visitorPointer` activated on pointer
  down, so an orbit drag starting over a used subject ran its offer. Activation moved to the
  release, with `VISITOR_DRAG_SLOP` marking the release as a drag; pointermove is now the only place
  a drag is recognized, in a visit and in exploration alike.
- **A second side detour silently replaced the first parent.** `chooseRuntime(detour)` always pushed
  a bookmark, so a second detour pushed a second one and Return restored the wrong parent. The
  experimental policy is now one bounded detour at a time: `parkParent` refuses the second with an
  explicit refusal, and a **go choice** clears the parked parent because the visitor chose to
  continue rather than come back.
- **Rejoin assumed a Guide Stop.** `resumeGuide` read `stopEntry(e, r.stopId)` unconditionally, so a
  standalone visit had no truthful rejoin. It now resolves the Stop's entry or, standalone, the
  Presentation's own entry View — which is what makes the open/close/rejoin slice honest: viewing is
  a framing invocation, so no route station runs again and no queued cue replays.
- **The explicit choice needed one legible offer label.** The offer row and the choice group now
  share `offerLabel`, which names the activation subject and the operated subject when they differ;
  the choice group would otherwise have shown bare Activity names. Any deliberate visitor command
  settles a pending choice (`S.visitorChoice`), so a choice can never stay armed behind navigation
  the visitor already made.
- **Axis steps encoded the superseded workflow** (verification defect). `experience-check.sh` and
  conformance QA-4/QA-5 asserted the C8 per-origin Connect surgery and *required* a visible Travel
  gap, so they would have failed a correct N1 implementation while still passing the workflow N1
  replaces. They now assert one-step support for every legitimate origin, the owner-named report
  (`Prepared n Camera route … · Camera owns route geometry`), the aggregate Undo step and the
  absence of any per-origin preparation offer; the old gap assertions became full-support
  assertions, and the visitor axis gained the click/drag/choice and open/Return steps.

## Independent C9.4/C9.5 review — four findings repaired (2026-10-05)

An independent review of the pushed C9.4/C9.5 executable re-derived the work rather than trusting the
report. It confirmed the C9.4 ownership direction (one explicit aggregate preparation, reused routes,
`liveConnectionPath` inside the Camera evaluator, the shared `travelInvocation`, Cut executing no beats,
connection-local station work) and most C9.5 visitor mechanics, and named four acceptance blockers the
green suite did not exercise. All four are repaired at their owning authority, each with behavior-level
coverage and a same-defect mutation obligation. The earlier 86/86, 18-axis/771 and 34/34 results were
valid at their revision, but they were coverage holes in the acceptance contract rather than test
failures — which is the useful part of the finding.

- **Rejoin and detour Return rebuilt remaining work (V2/V7).** `carriedWork` carried only
  Experience-scoped runs, so a visit-local run live in the *same* visit was counted from its full
  authored length after Explore → Rejoin; the reading is now honoured for whichever run currently owns
  the use (work belonging to another visit is still excluded by activation scope, and a stopped or
  unavailable run still owes nothing). `resumeGuide` also passed no cue floor and no fired-cue predicate,
  so a cue whose own signal had already fired was owed a Camera move again; the plan now skips cues the
  runtime has already emitted — the shared emission record, not a second estimate — and the Stop's own
  cue floor travels with it. `returnDetour` restored the parked parent without recomputing anything,
  leaving the detour's readiness attached to the parent and the detour's cue floor in place; the bookmark
  now carries the cue floor and the suppressed-viewing flag, and Return recomputes the parent's own
  remainder from the restored playhead.
- **Interaction-only Preview Experience was missing (I3/J6).** The runtime already supported a
  zero-Presentation visit, but the product path refused it — `preview()` demanded a Presentation — and no
  entry existed. `previewExperience()` is the third entry into the one runtime, refused only when the
  Experience has no Experience-wide offer to participate in, and the index exposes it exactly then.
- **Availability was modelled but not authorable (I4).** The offer draft had Target, Capability and
  Activation but no availability, and `acceptOffer` left every new offer contextual. The draft now
  carries availability with **Experience-wide as the default**, the authored choice is written inside the
  same aggregate edit as the offer, and the contribution Card exposes the same choice through the
  ordinary writer — so the default and a contextual switch are each one Undo step, and neither changes
  the offer's organizational home.
- **A same-View Seam ignored the live pose (N1).** `travelInvocation` treated
  `from.view.id===to.view.id` as an unconditional zero-distance Cut, which is true only while the visitor
  is standing at that View: after Explore the nominal origin could still name that View while the live
  pose had moved, and Next snapped to the destination instead of reclaiming guidance from where the
  visitor actually was. The zero-distance shortcut is now pose-sensitive, and anywhere else that Seam is
  the ordinary Camera framing invocation from the live pose — no fabricated edge, no hidden Cut.

Coverage: seven new cases in `tests/experience-travel-agency.test.mjs` — moved-pose same-View Travel;
completed work owed nothing after Rejoin; a cue whose signal already fired skipped; a future cue kept and
still firing; Return restoring the parent's remainder and cue floor; offer authoring defaulting to
Experience-wide and writing a contextual choice in one edit; and a world-only Preview Experience with
zero Presentations, Stops and Guides. Nine real-UI assertions were added to `qa/visitor-check.sh`
(availability in the draft with Experience-wide selected, the authored use Experience-wide and still
homed, the Card reading it back, contextual switching as one ordinary edit, the Experience-only entry,
the world-only visit, its participation, its activation, and authoring restored untouched). Five new
same-defect obligations — `same-view-snap`, `rejoin-full-estimate`, `skip-fired-cue`, `detour-readiness`
and `offer-availability-write` — each reintroduce the named defect while a named neighbour stays green.

### Root-gate finding repaired by this pass

The review pass also caught a defect in this record itself: the root-gates bullet named the missing P23B
fixture *path* in prose outside the declared `EVIDENCE-PATHS` region, which the repository's
documentation-reference gate reads as a claim about a file that does not exist. The path is named once,
inside that region, and nowhere else; the gate is green at this revision (22/22 in
`apps/editor/tests/docs/documentation-references.test.ts`). The finding was invisible to the earlier
arch run because that run read the tree before the edit landed, so this record does not claim the
earlier revision passed it.

### Independent re-verification at the pushed head (2026-10-05)

The repair pass was re-run independently rather than read from this record. `node --test
 tests/*.test.mjs` is **93/93**; `qa/run-all.sh all` is **18 axes, 780 assertions, 0 failures,
 rc=0**; `qa/mutation-check.sh` is **39/39 rejections, rc=0**; and the documentation-reference gate
 above is **22/22**. Each of the five repair obligations — `same-view-snap`, `rejoin-full-estimate`,
 `skip-fired-cue`, `detour-readiness` and `offer-availability-write` — reintroduces its named defect
 in a disposable copy and is rejected by its named protected assertion while its neighbour stays
 green. One mutation run met a transient browser-readiness timeout on the `parked` obligation; the
 obligation itself reproduces cleanly in isolation (V2 boundary resume 94 pass / 6 fail at the
 `resume` boundary), so it is a harness flake, not a product defect.

## C9.5 self-review pass and MP3 pre-QA (2026-10-05)

A second self-review pass re-read the C9.4/C9.5 visitor runtime against the accepted semantics and
then drove the prototype end to end in the real browser at the frozen revision. One defect was found
and repaired; one candidate finding was examined and ruled by design rather than changed. Both
outcomes are recorded here because the second is the kind of finding a later reader will re-raise.

### Defect repaired — Rejoin and Return did not restore the Stop's held viewing intent

`resumeGuide` and `returnDetour` preserved the playhead, the cue floor and the carried reading, but
neither restored `viewingSuppressed`, while the remaining-work planner was told `cues: !entry.hold`.
A Stop whose entry **holds** the viewpoint therefore planned its remainder with automatic cues
excluded and then let the runtime perform one: the planner said the work was not owed and the runtime
cued it anyway. A probe on a held Stop with a narration-linked View cue measured
`plan.requests = []` while the runtime requested `use-3` at t=20 s. Both functions now set
`r.viewingSuppressed = !!entry.hold` before planning, which is exactly the reading the estimate is
planned with. Repair is the executable change in `022c64f4`.

Coverage: a new case in `tests/experience-travel-agency.test.mjs` (“C9.5 rejoin restores a held
viewing intent, so no cue the remainder excluded can run”) asserts the runtime never moves after the
rejoin, and a new same-defect mutation obligation `rejoin-held-cue` reintroduces the omission while
the named neighbour “C9.5 rejoin keeps a future cue” stays green.

### Candidate finding examined and ruled by design — Close keeps the standalone Rejoin target

A probe showed that after `closePresentationRuntime` from a standalone Presentation the runtime still
reports `exploring: true` **and** keeps `presentationId` attached, so a Presentation-local offer stays
live and activatable during free exploration and the visitor title still names the Presentation that
was closed. This was written up as a context leak and a change was drafted. It was then withdrawn,
because the retention is load-bearing and deliberate:

- `resumeGuide`'s standalone branch resolves the entry View from `r.presentationId`; nulling it on
  Close removes the truthful **Rejoin** the panel offers after a Close.
- The behaviour is already protected by an existing case — “C9.5 open/close/rejoin and one bounded
detour never write authored documents” asserts `closed.exploring === true &&
  closed.presentationId === third` and then rejoins it — added with the C9.4/C9.5 implementation and
  re-verified by the independent review.
- The design intends it. §3 of the completeness plan has Close return a standalone Presentation to
  exploration, not to authoring, while the visit is preserved; the same section requires the visitor
  to be able to open any available Presentation from visitor navigation (P12); and J5/I6/V1 require a
  real subject activation **while exploring**, which means an offer staying live in exploration is the
  contracted behaviour, not a leak. Exploration already suppresses automatic cues (`emit` returns
  while `r.exploring`), so only deliberate visitor activation reaches the offer.

No code was changed for this finding, and the drafted change was reverted before it was committed.
The two comments that had been written for it were reverted with it; the shipped behaviour and the
existing assertions are unchanged from the reviewed revision.

### MP3 pre-QA — end-to-end manual browser pass at the frozen revision

The owner's MP3 walkthrough was rehearsed end to end through the real product UI (built from Reset
and also from the product's own `Load Example` control) at this revision, and every recipe step was
observed rather than inferred. Observations, with the values measured in the session:

- **Explicit Travel preparation.** A Guide whose departure Presentation held two Framed uses (entry
  `az 1.2`, second View `az 0.72`) plus a one-View destination: choosing Travel left **every origin
  supported** (“All origins supported · Camera owns the routes”), wrote `connection-4
  view-1→view-3` and `connection-5 view-2→view-3` with **no origin as a gap**, and the whole
  preparation was **one Undo step**. Adding a View, and starting a Preview, added no connectivity.
- **Visible Camera flight, and Cut on the same Seam.** On the Travel Seam, Next flew the authored
  route — the target interpolated `[-10, 1.2, 1] → [-9.32, 1.12] → [-8.63, 1.24] → [-7.94, 1.35]
  → [-7.25, 1.47]` over a `1.015 s` movement with a connection id, arriving at the authored
  destination `[-3, 1.2, 2.2]`. Flipping the **same** Seam to Cut and pressing Next produced
  `movement: null` and a straight snap, with Camera connectivity unchanged — the A/B that also
  answers the earlier “it cuts immediately” question: Cut is the owner-ratified default for an
  ordinary Guide-add, and Travel is deliberately requested.
- **Early/manual navigation and redirect during movement.** Pressing Next while a flight was in
  flight raised no “finish the current move” demand (`refusal: null`) and arrived at the authored
  destination. Choosing another eligible View mid-flight started the new movement from the **live**
  pose: the live target at the moment of the redirect was `[-8.32, 1.2, 1.29]` and the replacement
  movement's first sample was exactly `[-8.32, 1.2, 1.29]`, not the origin and not the destination.
- **Rejoin and Return keep the remainder** (closes the review blocker in the real UI). At Stop 1 the
  panel read readiness **42.000** (a 40 s narration + 2 s of framing). After 9.06 s of narration had
  played, Explore left readiness at 42, and **Rejoin** re-derived it as **32.939 = 2 + (40 − 9.06)**
  with the **same run token** (`visit-1/run-1`) still running — the narration continued, no station
  re-ran and no queued cue replayed, Auto stayed off. Taking the authored side detour then showed the
  detour's own remainder (**2.819**, parent narration paused), and **Return** recomputed the parent's
  remainder as **16.187** — the parent's own reading, not the detour's — with the same run resuming and
  the log line “Returned without duplicate entry”.
- **Exploration.** Explore and orbit changed the visitor's own pose and fired nothing: no offer ran,
  no cue fired, and the authored snapshot (source, Undo length, selection, pose) was byte-identical
  after the session.
- **Direct visitor interaction.** A drag over a used subject orbited and activated nothing
  (`S.visitorChoice` stayed null, no override was written); a release without movement on the same
  subject went through the offer path.
- **Multiple offers.** With two offers authored on the same activation subject, that click opened the
  explicit choice — “Switch offers 2 interactions · choose one”, with both offers named by activation
  and target (“Intensity · Switch → Light”, “Play music · Switch → Piano”) and a Cancel. Nothing ran
  before the choice (`active` unchanged, no overrides). Cancel settled it with nothing run; choosing
  ran **only** that offer (`overrides: ['piano']`, light untouched); and a deliberate Next settled an
  open choice.
- **One side detour, a second refused, and Return.** With the detour armed (exactly one bounded
  bookmark) a second navigation request was refused with the visible reason “Return from this detour
  before opening another Presentation”, the bookmark count stayed 1, and Return restored the parent
  Stop with no duplicate entry.
- **Standalone open/close.** Opening another available Presentation from a Guide Stop parked the Stop
  with exactly one bounded Return; **Close** returned to exploration and never to authoring (authored
  source, Undo length and selection unchanged, session still live, panel still offering Return), and
  Rejoin re-entered the standalone Presentation's viewing intent.
- **Availability authoring.** The offer draft exposed the Availability picker with **Experience-wide
  selected by default** and the hint that availability is independent of the offer's home; the draft
  was accepted as one ordinary Undo step with `availability: null` and the offer homed in the edited
  Presentation, the Card read it back as `Experience-wide`; switching it to a named Presentation from
  the Card's own writer was **one** Undo step labelled `Edit Activity availability` with the
  organizational home unchanged.
- **Preview Experience without a Presentation.** With two Experience-wide offers and no Presentation
  selected the `Preview Experience` entry was present; the visit started with `presentationId: null`,
  `stopId: null`, no Guide navigation and no Stop controls, offered exactly the Experience-wide
  participation, ran it as a session override (`overrides: ['light']`, Scene source untouched), and
  exited with authored source byte-identical, the pose restored and Undo unchanged. Without an
  Experience-wide offer the entry is absent rather than starting an empty visit.
- **Same-View Travel after moving** (closes the other live-pose review blocker in the real UI). With a
  Travel Seam whose origin and destination Framed use resolve to the **same** Camera View, Next while
  standing there produced `movement: null` — instant, zero distance, no fabricated edge. After
  Explore + orbit moved the visitor's own pose (az `1.2 → -0.36`), Next produced a real movement
  (`0.822 s`) whose first sample was the live `az -0.36`, and Camera connectivity was unchanged
  (3 before, 3 after): the Camera flew back from where it actually was.
- **Predicted versus observed cursor/Auto.** At a Stop whose panel read `readiness 3.015 s`, Auto
  advanced at session time 3.1 s; toggling Auto off and on left the Stop's own clock counting
  (`0.43 → 1.62 → 1.66 → 2.85 → 2.90`, never restarted) and did not reset the reading, so the toggle
  re-reads the plan instead of rebuilding it.

Two limits are recorded rather than smoothed over. The visit interactions above were driven through
the product's own DOM controls and pointer path; the pointer events were injected, and Chromium does
not mark injected events trusted, so the `agent-browser` axis (`qa/visitor-check.sh`) remains the
trusted-input proof for click-versus-drag. And the cross-subject click required a pose in which the
subject is actually pickable; the first attempt was made from an exploration pose where it was not,
which is why the pose was restored by Rejoin before the click that opened the choice.

## Verification results

### Re-verification at the self-review head (2026-10-05)

Everything below was re-run on the frozen revision that carries the self-review repair (`022c64f4`
plus its reverted candidate finding), not read from the earlier pass:

- `node --test tests/*.test.mjs` — **94/94 pass** (`ℹ pass 94`, 0 fail), log `/tmp/c9-pure.log`.
  The travel/agency file is now 12 cases, one more than the reviewed revision.
- `qa/run-all.sh all` — **18 axes, 780 assertions, 0 failures, rc=0**, log `/tmp/c9-all.log`:
  journeys A–F 59, interaction 56, flows 44, lifecycle/policy 41, World shell 47, Precision 38,
  Browse/Search 60, repair 47, lens/parking/Resume 81, Experience wiring 30, V2 conformance 105,
  C9.1 creator 23, C9.2/C9.3 composition 27, visitor 28, reconciliation 13, continuity 55,
  responsive 15, correctness 11. No axis is carried from an earlier pass.
- `qa/mutation-check.sh` — **40/40 rejections, rc=0**, log `/tmp/c9-mut.log` (40
  `PASS: <domain> rejects <kind> regression; unrelated control stays green` lines). The one new kind
  is `rejoin-held-cue`; each rejection reintroduces its named defect in a disposable copy and is
  caught by its named protected assertion while its control stays green.
- Documentation-reference gate `apps/editor/tests/docs/documentation-references.test.ts` — **22/22**.

The root repository gates remain red on the same pre-existing missing P23B fixture reported below
and in the checkpoint record; nothing in this pass changes that, and it is not hidden here.

### Pure Node model/runtime/Camera suite

`node --test tests/*.test.mjs` — **93/93 pass** (`ℹ pass 93`, 0 fail) at the reviewed C9.4/C9.5
executable: Camera conformance 6, Experience model 11, composition 15, folded external review 15,
runtime 28, and the travel/agency file 18. The first C9.4/C9.5 pass was **86/86**, and the C9.2/C9.3
increment's run was **75/75** (its first pass 70/70). The second-pass additions are four review cases: station
invocation replacing the Activity trigger (entry amortization, idempotence, second-station
refusal, invoked work counted once inside the destination visit); automatic-work-only
targeting with the shared refusal surface; a View cue driven by Experience-wide output being
legitimate work (predicate, plan request, runtime cue, Gate counter-proof); a stopped carried
run with its disarmed dependents owing no wait; and a carried dependency counted once rather
than twice (the same suite also keeps the rewritten multi-origin case, whose invocation target
is now automatic work instead of an offer).
The C9 additions are
in `tests/experience-composition.test.mjs` (14 cases): organization independent of
activation/boundary, completion/retention boundaries, fresh repeated visits, marker seconds,
hold cue suppression, later-entry cutoff, manual redirect without restart, Auto estimates
excluding hypothetical offers and organizational home, independent later-boundary naming,
zero-second phrase firing once, and unsupported pacing signal never falling back to Auto.
The external-review additions are in `tests/experience-mp2-review.test.mjs` (10 cases): the
route writer ends on Stop selection and Stage entry refuses a stale writer; explanation
binding survives regrouping and stays a single narration; Experience-start captions and View
cues survive a later visit while its completion never satisfies a later Gate; completed and
partially spent Experience work determines Auto readiness and a live Camera move is never
interrupted; the Auto toggle keeps the remaining-work clock; and dependency, cue and
Stop-condition scope mismatches become repairable unavailable work with compatible controls
still green.
The C9.4/C9.5 addition is
`tests/experience-travel-agency.test.mjs` (11 cases): preparation creates only the missing scoped
routes, reuses the rest and is idempotent under one aggregate Undo; no View add or Preview authors
connectivity; Cut executes no Travel route beats or flight; early Next from the live pose traverses
only the supported redirected route, and rejoin runs no station again; a same-View origin is Camera
zero-distance, never a fabricated edge; readiness and Auto count the route and its holds exactly
once; offers are never automatic work and availability stays explicit; a click activates where a
drag never does and several offers open an explicit choice; open/close/rejoin and one bounded detour
never write authored documents; and a full visitor session leaves authored documents, history and
selection untouched. The live-start successor proof replaced the C8 departure-wait case in
`tests/camera-conformance.test.mjs`: the route's first sample is the live pose, the movement
duration is that live path's, and the authored interior observer anchor still resolves to the
station's absolute observer position.

### Full prototype axis driver

`qa/run-all.sh all` — **18 axes, 780 assertions, 0 failures, rc=0 at the reviewed C9.4/C9.5
executable** (log `/tmp/c945b-all.log`: every axis reports `FAIL=0`, the chain ends
`qa: all requested axes passed`, `ALL_RC=0`, 780 `PASS` lines, no console or page faults). Every axis
is proven at that one revision; none is carried from an earlier pass. Per axis: journeys A–F 59, real
interaction 56, pointer flows 44, lifecycle/policy 41, World shell 47, spatial/Precision 38,
Browse/Search 60, repair 47, lens/parking/Resume 81, Experience wiring 30, V2 conformance 105, C9.1
creator 23, C9.2/C9.3 composition 27, visitor 28, shared/narrow reconciliation 13, continuity 55,
responsive 15, correctness 11. Across the two C9.4/C9.5 passes the conformance axis gained four
assertions (one-step Travel support for every legitimate origin, no gap and no per-origin preparation
offer, the owner-named report, the aggregate Undo step) and the visitor axis gained fourteen (a framed
used subject's offer, drag activating nothing, click activating or opening the explicit choice, opening
another Presentation parking one bounded Return, Return restoring it, and the nine review additions above:
availability authoring, contextual switching, the Experience-only entry, and the world-only visit). The
Experience axis keeps its 30 assertions with the N1 reading rewritten. History is retained rather than
superseded: the first C9.4/C9.5 pass (**771**, `/tmp/c945-all.log`), the C9.2/C9.3 run (**762** at
`9a44678a`, `/tmp/c9-all-final.log`) and the first repair pass's 758 with conformance at 97
(`/tmp/mp2-run-all-final.log`). Every axis closes its own browser; no session was left running.

### Mutation obligations (same-defect successor proof on disposable copies)

`qa/mutation-check.sh` — **39/39 rejections, rc=0** at the reviewed C9.4/C9.5 executable (full chain
`/tmp/c945b-mutations-all.log`; composition-only rerun `/tmp/c945b-comp-mut.log`, 29 obligations):
26 model/runtime kinds, 3 World/lens kinds, 7 V2 conformance kinds and 3 wiring kinds. History: 34/34
for the first C9.4/C9.5 pass, 23/23 for the first C9.2/C9.3 repair pass and 28/28 after the second. Each kind reintroduces the named defect in a disposable
copy; the protected assertion must fail while named unrelated controls stay green, never a crash or
empty observation.

- Existing World: host, camera, selection (3).
- Existing V2: evaluator, parked, shared, endpoints, pins, stations, preview (7).
- New C9 obligations from the plan (5.4/§9): **organization-as-start**, **hold cue
  leakage**, **entry-plus-station double invoke** in the model/runtime; **empty Reset hidden
  placeholder**, **silent first-offer choice**, **Peek forcing L2** in the wiring (6).
- External-review obligations (2026-10-05): **route writer surviving Stop selection**,
  **explanation binding collapsed onto organizational home**, **Experience-scoped output
  dropped with its visit**, **completed Experience work charged again**, **Auto interrupting
  a live Camera move**, **Auto restarting the remaining-work clock**, and **impossible
  dependency scope accepted** (7). The runner is `qa/composition-mutation-check.sh`, chained
  by `qa/mutation-check.sh`.
- Second-review obligations (2026-10-05, folded verdict): **entry-plus-station double
  activation** (the `double-invoke` kind now drops the station re-bind instead of the per-tick
  guard, so the obligation matches the contract it protects), **invocation repeating on every
  tick**, **a visitor offer bound as automatic traversal work**, **a stopped carried run's
  remainder waited for**, **a carried dependency paying its elapsed time twice**, and **the cue
  predicate collapsed back onto the strict Gate scope predicate** (5 new kinds, 18 C9
  obligations in total: 15 model/runtime + 3 wiring).
- C9.4/C9.5 obligations (2026-10-05): **departure instead of live start** (`live-departure`),
  **adding a View authoring Camera connectivity** (`implicit-connectivity`), **Cut flying the
  route** (`cut-flight`), **every authored beat executing instead of only the traversed
  connection's** (`traversed-only`), **an offer becoming automatic visit work**
  (`offer-automatic`), and **the visit runtime reading and writing the authored documents**
  (`visitor-source-write`); 24 C9 obligations in total (21 model/runtime + 3 wiring). The pure
  obligations now also carry `tests/camera-conformance.test.mjs` and the new travel/agency file,
  so the live-start and visitor-isolation classes are protected where they are contracted.
- Independent-review obligations (2026-10-05): **a same-View Seam collapsing to an unconditional Cut**
  (`same-view-snap`), **only Experience-scoped work carrying its playhead** (`rejoin-full-estimate`),
  **a cue whose signal already fired counted again** (`skip-fired-cue`), **Return leaving the detour's
  reading on the parent** (`detour-readiness`), and **the authored availability being dropped**
  (`offer-availability-write`); 29 C9 obligations in total (26 model/runtime + 3 wiring).

### Defects found and repaired during the C9.2/C9.3 increment

- **Guide band reachability (product)**: the fixed non-ordinary Guide band measured
  285.84px against the Card's 216px reserve, so the last Card controls could not scroll
  clear of the band and were covered by `.stop-strip`. `renderDeck()` now measures the band
  after render and publishes `--guide-band-h`; `body.guide-band .card` reserves it plus 24px.
  Probe after fix: Card row top 507 < band top 576 (uncovered).
- **Visitor transcript crash (product)**: the transcript filter called `activationScope(u)`
  on View uses with no `.start`, throwing `TypeError: Cannot read properties of undefined
  (reading 'kind')` and tripping the page fault gate. `activationScope` is null-safe and the
  filter treats a null scope as Experience-scope.
- **Parked detour regression (product)**: the broadened `closeVisit` ended the parked parent
  visit on detour entry; it now skips parked visits, and `returnDetour` computes the parked
  set before popping the bookmark.
- **QA harness robustness**: bash 3.2 brace-splitting of `qa_js` substitutions hoisted into
  their own assignments in `composition-check.sh`/`creator-check.sh` (the broken form
  silently compared empty strings); `qa_scroll_center` added for Card controls under the
  fixed band.

### Root repository gates

Run after the prototype work, per the repository test doctrine (task scope never narrows
required verification), at the reviewed C9.4/C9.5 executable revision. These gates never import the
prototype's Experience runtime (root workspaces are `apps/*` and `packages/*` only; the prototype is
not a workspace), so a docs-only child commit cannot change them — except for the documentation gate,
whose finding this pass repaired (see above):

- `npm run test:arch` — **276/276 pass**, 24 files, rc=0 (`/tmp/c945c-arch.log`, rerun after the
  documentation-reference repair).
- `npm test` — **33 files failed / 339 passed / 1 skipped; 4951 tests passed, 1 failed,
  1 skipped**, rc=1 (`/tmp/c945c-root-test.log`) — the same signature as the C9.2/C9.3 run. The
  one collected failure is the P23B dormant-mapping test whose fixture import is missing, and
  the other 32 failing files fail dependent-suite collection for that same import.
- `npm run check` — 1 missing-module error, 0 warnings (`/tmp/c945c-check.log`; the error names the
  same P23B wall fixture that *Known limitations* declares once below, and this record names it nowhere
  else so the repository's documentation-reference gate stays clean).
- `npm run build` — unresolved import of the same fixture (`/tmp/c945c-build.log`).
- `git diff --check` (whitespace) — rc=0.

The missing P23B fixture is the external blocker for the three red gates above and is
reported separately; it was not restored, hidden or fabricated.

### Donor oracle (reported separately from successor parity)

`prototypes/experience-authoring`: `npm run typecheck` rc=0; `npm test` **62/62** rc=0;
`npm run build` rc=0 (one 898kB chunk-size warning, no error); Playwright e2e **21/21
passed** (1.1m) on an owned Vite server, which was stopped afterwards; `.last-run.json`
reports `{"status":"passed","failedTests":[]}`; the donor tree is unchanged.

## Known limitations

EVIDENCE-PATHS: start — the deleted P23B fixture this record reports as an external
blocker; identity as recorded at base `abaa7592`
- The missing fixture `docs/roadmap/p23b-geometry-performance/40-walls.json` is a
  pre-existing repository-gate blocker, external to C9. It was not restored, hidden or
  fabricated.
EVIDENCE-PATHS: end
- MP2 is human evidence and is not claimed here; no visual refinement campaign was started
  (that belongs to the dedicated UI/UX slice).
- The reviewed C9.4/C9.5 increment reran the pure suite, the complete prototype axis driver, the full
  mutation chain and the root repository gates at its own executable revision, after the
  documentation-reference repair (arch 276/276 rc=0; test/check/build red only on the missing P23B
  fixture, unchanged). All 18 axes are therefore proven at the reviewed executable revision; none is
  carried from an earlier pass, and nothing above is inherited from the C9.2/C9.3 increment's run. The
  evidence and status docs land as a docs-only commit on top of it, so the pushed head and the tested
  executable differ only in those docs.
- A station-bound Activity's route and named station are validated where they are read
  (Camera travel and the coordination strip): Experience holds stable identity, never a copy
  of route geometry, so a deleted anchor or station still refuses locally at travel time.
- C9.5's agency is deliberately bounded: no View or Presentation deletion (C9.6 revision/
  repair), no automatic offer execution, and the parent pause/bookmark policy stays experimental
  rather than being promoted to permanent architecture. MP3 has not been claimed; the increment
  stops at the human gate.
- No merge, phase closure or Paper work is claimed or performed. C9.2/C9.3 (`12652d9b`), the
  first repair pass (`db83a9d7`), the second repair pass (`9a44678a`, with the evidence and
  status docs as its docs-only child) and C9.4/C9.5 (`c118c08b`) are committed and pushed to
  `origin/prototype-v2`.

[plan]: ../../../docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md
[c8]: ./EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
[checkpoint]: ../../../docs/operations/checkpoints/pr113-experience-v2.md
