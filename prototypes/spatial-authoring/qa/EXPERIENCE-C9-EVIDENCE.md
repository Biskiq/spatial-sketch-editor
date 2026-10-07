# C9 Experience reconciliation — evidence record (C9.1–C9.9)

TYPE: prototype implementation/review evidence for C9.1–C9.9; final owner acceptance pending.
STATUS: **MP1 owner-accepted 2026-10-04; MP2 owner-accepted 2026-10-05. MP3 and MP4 remain human gates.** C9.1–C9.9 are implemented and reviewed. The owner-directed optional walkthrough correction is in verification: Next demonstrates the current task when on, or browses without an outcome gate when off. The preceding proof below belongs to its recorded executable, not this correction. Automated proof, browser rehearsals and Presenter completion do not accept MP3 or MP4.
SCOPE: [C9 authoring-completeness plan][plan] and the owner's bounded follow-up before final human acceptance. No production migration, broader shell overhaul, six-QA visual reconciliation, merge, phase closure or Paper work. This record preserves [C1–C8 conformance evidence][c8] and does not replace its authority.

## Preceding observational follow-up provenance (historical)

- Baseline committed revision: `dad60dffd79e064c8af14e75cb888ad80d2f87e3` on `prototype-v2`.
- **Final committed executable: `1f1e711535be3363f48024df2ec19ed3bcf27fc8`**,
  `C9: give Experience its own workflow in the shared Presenter`, child of the baseline.
  Every final run in this block ran after that commit, with a clean executable tree.
- This evidence packet, live-status updates and one capture form an **evidence-only child** of that
  executable. No `app/`, `index.html`, `styles/`, `tests/` or QA script bytes change in that child.
  Inspect the pushed branch head and compare it to the executable above; final code proof is anchored
  to the exact committed revision actually tested, rather than claiming runs against a later edit.
- Historical increment counts below belong to their own revisions or explicitly identified
  intermediate stages. They are not final follow-up claims.

### Changed behavior and design decisions

- **One lens-switched Presenter:** the existing panel/controller keeps World's A–F scripts,
  Replay, tabs and instruction position. Experience replaces that content with Q1–Q8 followed by
  A1–A10; no second tutorial panel, framework, selection model or history is created.
- **An actual creator workflow:** select a World subject → Present → explanation/framing →
  operate/Use → standalone Preview → add to Guide → second Presentation → Preview Guide/Next →
  explore/rejoin. Each step names its instruction, real action and observed outcome. Back and explicit
  Skip change only the cursor; earned Next observes product results and advances once. Reset/Load
  Example remain separate, explicit source-loader commands. The walkthrough is editor guidance,
  distinct from authored Experience Guide/Stops.
- **Preview remains isolated:** the shared guidance may remain visible read-only; loaders and all
  authoring controls remain unavailable. Product execution uses the existing private visitor
  session and Camera evaluator; exiting returns the exact source/history/selection/viewpoint.
- **A2 proves the dependent run:** observed capability handoffs retain `fromUseId → toUseId` and
  the target run token. The visitor must stop that same live carried target run. A different carried
  use, or another run of the same use, cannot earn the capability-sequence outcome.
- Self-review also closed two misleading quickstart completions: a Guide visit cannot substitute
  for standalone Preview (Q4), and repeated Stops of one Presentation cannot substitute for a second
  Presentation (Q6). Both now have regression and same-defect mutation proof.
- Guidance placement changes are bounded to Experience: its toggle sits above the Guide Deck, and
  the scrollable panel moves left in a narrow Card sheet so actual authoring controls remain reachable.
  World interaction and the wider shell remain intact.

### Final verification at the committed executable (2026-10-07)

- `node --test prototypes/spatial-authoring/tests/*.test.mjs` — **130/130**, exit **0**;
  `experience-c9-review.test.mjs` contains **20** tests, including both A2 identity counterexamples.
- The smallest sufficient affected browser proof uses the existing `qa/run-all.sh` axes at
  **1440×900**, all with exit **0** and no console/page errors:

  | Axis | Assertions passed |
  | --- | ---: |
  | World journeys A–F | 59 |
  | World shell | 47 |
  | Lens/parked work | 81 |
  | Standalone creator | 23 |
  | Composition/compact Guide | 27 |
  | Presenter, all 18 topics | 59 |
  | Shared Experience workflow Q1–Q8 | 33 |
  | Visitor execution | 42 |
  | World ↔ Experience continuity | 55 |
  | Responsive/keyboard | 15 |
  | Numerical/nested correctness | 11 |
  | **Affected-axis total** | **452** |

- The same actual Q1–Q8 workflow at **1024×700** adds **33/33**, exit **0**:
  **485/485 browser assertions total**. This proves visible product controls, both lens directions,
  disabled unearned Next, exact Preview return, source-neutral tutorial navigation, distinct
  Presentations/Guide Next and a real canvas exploration gesture/rejoin. It is automated rehearsal,
  not owner comprehension or MP3/MP4 acceptance.
- One [narrow workflow capture](../screens/experience-c9/shared-walkthrough-1024.png) comes from that
  final 1024×700 run, after earning Q1–Q8 and advancing to A1. The tally reflects predicates in the
  current session, not stored tutorial history or human acceptance. No six-QA campaign was run.
- `bash prototypes/spatial-authoring/qa/mutation-check.sh` — **94/94 regressions rejected**, all
  named unaffected controls green, exit **0** (3 World + 7 V2 + 53 model/runtime + 31 browser).
  The complete chain includes `handover-identity`, `handover-run-identity`, `quickstart-standalone`,
  `quickstart-second-moment` and `presenter-lens-content`; neither A2 defect nor World content in
  Experience survives its witness. Intentional mutant failures are rejection proof, not product failures.
- Verification repairs were folded before the executable froze: the visitor witness closes its
  explicit loader disclosure before opening guidance; the narrow gesture samples unobstructed canvas;
  moved Presenter/placeholder mutation anchors target the shared renderer. All 84 composition anchors
  were applied on disposable copies, and the complete 94-obligation chain was rerun successfully.
- Logs for this exact final run are `/tmp/pr113-c9-final-node.log`, the corresponding
  `/tmp/pr113-c9-final-<axis>.log`, `/tmp/pr113-c9-final-narrow.log` and
  `/tmp/pr113-c9-final-mutations.log`. Earlier preflight attempts are not the final counts above.

### Repository gates and donor oracle at the same executable

- Unconditional `npm run test:arch` — **276/276**, 24 files, exit **0**.
- Root `npm test` — **4951 pass, 1 fail, 1 skip**; 32 suites cannot collect and the one collected
  failure imports the same missing P23B fixture declared under *Known limitations*. Exit **1**.
- Root `npm run check` — **1 missing-module error, 0 warnings**, exit **1**; root `npm run build`
  cannot resolve that same fixture, exit **1**. The fixture remains outside this follow-up's scope.
  These root gates are unresolved: this packet is ready for prototype owner review, not merge.
- Museum check/build were run explicitly because root commands stop at the editor failure:
  **0 errors/0 warnings**, build succeeds, both exit **0**.
- The unchanged donor oracle: typecheck/build succeed, **62/62 domain/history tests** and
  **21/21 Playwright journeys/regressions** pass. The browser runner used a private ephemeral port,
  one worker and `reuseExistingServer: false`; its browser and server were released. Donor success
  is reported separately from successor proof.
- `git diff --check` is clean. QA browsers/private servers are released; no external browser was closed.

### Owner-review frontier

C9.6–C9.9 are implemented/reviewed work, not an unstarted queue. The plan, current baton,
[PR checkpoint][checkpoint] and P25 router now agree: **MP3 — Travel and agency** and
**MP4 — rich capability acceptance** still require explicit owner outcomes. Review MP3 with the
Presenter closed; inspect the new Experience guidance as part of MP4, alongside the capabilities
and shared structural seams. No acceptance, merge, phase closure or production cutover is implied.

## Historical executable revisions — C9.1–C9.5

- Branch `prototype-v2`; base commit `abaa7592730f565a8d47fd8480d69f0907dfe6c7` ("C9.1
  review pass"). The C9.1 slice was committed by the owner's review pass.
- Commit provenance, correct against live Git at the close of this increment: C9.2/C9.3
  (with the C9.1 regression hardening it needed) is `12652d9b`, the first external-review
  repair pass is `db83a9d7`, and the second repair pass is `9a44678a`; all three are pushed to
  `origin/prototype-v2`. This record's evidence update and the two status docs form the
  docs-only child of `9a44678a` and are pushed with it, so the pushed head names the exact
  authenticated executable. An earlier revision of this record and of the checkpoint misreported
  C9.2/C9.3 commit/push provenance; that stale description was corrected by the second repair pass, and the push itself followed on owner
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
  misreported C9.2/C9.3 commit/push provenance.
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

## External C9.4/C9.5 implementation review — five findings repaired (2026-10-05)

A second external review re-read the C9.1–C9.5 implementation at `2725917f` and named five acceptance
gaps the green suite did not exercise. Each is repaired at its owning authority with behaviour-level
coverage — a new protected assertion and a same-defect mutation obligation — and the whole acceptance
run was re-executed at the repaired revision rather than read from this record. These repairs were subsequently committed in `056ae3f9`; the numbers in this subsection are historical stage evidence, not final follow-up verification.

- **P1 Return followed by Auto cut off unfinished narration** (`app/experience-runtime.js`).
  `returnDetour` restored the parked parent's `elapsed` clock but recomputed `readiness` as the
  remaining work, and Auto advances on `elapsed>=readiness`: after 7 s of a 10 s narration the parent
  read 7 against a deadline of 5, so Auto advanced on its next tick and cancelled the run. The Stop's
  clock now restarts at the remainder it owes, exactly as `resumeGuide` already did, so the restored
  playhead and the remaining-work deadline agree. Coverage: `tests/experience-runtime.test.mjs`
  "C9.5 Return restarts the parent remaining-work clock…" (Auto waits, then the narration completes
  rather than stops), a real-UI assertion in `qa/visitor-check.sh` after a real Return, and the
  `return-clock` obligation.
- **P1 Opening another standalone Presentation skipped departure cleanup**
  (`app/experience-runtime.js`). `openPresentationRuntime` cleared `presentationId` before
  `enterPresentation`, so the ordinary departure cleanup could no longer match the departing
  Presentation: its narration stayed running and its visit-retained highlight/visibility effects stayed
  projected into the next Presentation. The departing identity now stays attached through
  `enterPresentation`'s `closeVisit`. Coverage: `tests/experience-runtime.test.mjs` "C9.5 opening
  another standalone Presentation ends the departing visit local work", a real-UI assertion in
  `qa/visitor-check.sh`, and the `standalone-open` obligation.
- **P1 Travel preparation omitted the shared entry View** (`app/experience-model.js`).
  `originCoverage` filtered the departing Presentation's uses to the departing Stop's entry, its
  choice-role uses and its cue-bearing uses, so a Stop entering through another View reported every
  origin supported while the Presentation's own entry stayed visitor-selectable and selecting it
  disabled Next with a Travel gap. Coverage now derives from the departing Presentation's
  `eligibleViews` plus the private Stop entry — the same set the visitor's View controls and `viewStep`
  read. Coverage: `tests/camera-conformance.test.mjs` "every eligible Presentation View and the private
  Stop entry are legitimate origins", `tests/experience-travel-agency.test.mjs` "C9.4 a Stop entering
  through another View keeps the shared Presentation entry a supported origin", and the
  `shared-entry-origin` obligation.
- **P2 Go choices executed as detours** (`app/experience-ui.js`, `app/experience.js`, `app/main.js`).
  Every choice rendered the detour command and `visitorCommand` had no go dispatch, and the Stop
  control authored only detours. A choice's authored `kind` now reaches all three: the visitor panel
  renders a `go` command for a go choice (which continues and exposes Back rather than Return), a
  detour choice still parks for one bounded Return, and the Stop control offers a Detour and a Go
  target select that each write their own kind and label. Coverage: `tests/experience-travel-agency.test.mjs`
  "C9.5 a go choice is a distinct authored continuation", authored and driven through the real control
  in `qa/visitor-check.sh`, and the `go-continuation` obligation.
- **P2 Abandoning a detour left parked parent work alive** (`app/experience-runtime.js`). A go choice
  discarded the parked bookmark without applying departure policies, so the parent's narration stayed
  paused and its effects survived; a later visit to the same Presentation then reused the paused token
  instead of starting narration. The abandoned parent's visit identity is now restored just long enough
  for `closeVisit` to end its local work under its own policies — a paused narration is stopped so a
  fresh occurrence starts a new run, a waiting dependent is disarmed and a visit-retained effect is
  released — while work the author explicitly carried past its visit is left alone. Coverage:
  `tests/experience-runtime.test.mjs` "C9.5 a go choice ends the parked parent local work instead of
  leaving it paused", and the `abandoned-parked-work` obligation.

## Verification results

### Repairs re-verified after the external C9.4/C9.5 review (2026-10-05)

Re-run at the repaired working tree, not read from this record:

- `node --test tests/*.test.mjs` — **99/99 pass**, 0 fail (`/tmp/c9rev-*.log`). Five new cases: the
  Return/Auto clock, the standalone departure cleanup, the abandoned parked parent, the shared-entry
  origin, and the go choice; the earlier camera-conformance detached-entry case is corrected because
  it had encoded the omitted shared entry as an *ineligible* origin.
- `qa/run-all.sh all` — **18 axes, 787 assertions, 0 failures, rc=0** (`/tmp/c9rev-all.log`). Only the
  visitor axis changed: it gained seven assertions (standalone departure cleanup, both choice-kind
  authoring readings, the rendered go/detour commands, go continuation, detour parking, and Return's
  remaining-work clock) for 35, with every other axis at its reviewed count.
- `qa/mutation-check.sh` — **45/45 rejections, rc=0** (`/tmp/c9rev-mut.log`). The five new obligations
  (`return-clock`, `standalone-open`, `shared-entry-origin`, `go-continuation`,
  `abandoned-parked-work`) each reintroduce their named defect in a disposable copy, are rejected by
  their named protected assertion, and leave their named control green.
- `git diff --check` (whitespace) — rc=0.

## Third external C9.4/C9.5 review — three detour findings repaired (2026-10-05)

The same review re-read the first repair stage before its commit and named three related defects in the detour
lifecycle. All three live in `app/experience-runtime.js` and are repaired there, each with a
behaviour-level assertion and its own mutation obligation. This section supersedes the round-1
description of the Return repair above: zeroing `elapsed` was that pass's fix and is not the repair
of record.

- **P2 Carried narration stayed paused after Go** (`app/experience-runtime.js`). `parkParent` pauses
  every running narration of the departed visit; `closeVisit` then deliberately ends only the work
  whose departure policy cancels — a visit-retained effect or a cancelling interruption — leaving
  Finish, Continue and Experience-end runs parked on purpose. When a go choice discarded the bookmark,
  `endParkedVisit` restored the visit identity and ran `closeVisit`, but nothing resumed the work that
  policy had said should outlive its visit, so the run's clock froze at its parked value forever: an
  18 s Finish narration stayed at 2.1 s after 20 s more elapsed through the product controls.
  `endParkedVisit` now resumes exactly the paused runs `closeVisit` refused to end, reinstating
  `r.active[useId]` and `running` on the parked playhead, while work that *is* cancelled is still
  ended. Coverage: `tests/experience-runtime.test.mjs` "C9.5 a go choice resumes carried parent work
  whose departure policy continues it" (a `finish` narration and an Experience-end narration both
  return to `running` with their parked `elapsed`), alongside the round-1 case that the cancelled
  parent is still ended, and the `carried-pause` obligation.
- **P2 Return restarted the full authored dwell** (`app/experience-runtime.js`). Round 1 fixed the
  Default-Auto cut-off by restarting the Stop clock at the remainder it owed — but that rewound an
  authored `pacing.seconds` dwell too: spend 7 s of a 10 s dwell, take a detour, Return, enable Auto,
  and the Stop waited a fresh 10 s instead of the remaining 3. The runtime now carries
  `remainingFrom`, the playhead the remaining work is measured from: `enterPresentation` and
  `resumeGuide` set it to 0, `returnDetour` sets `r.remainingFrom=r.elapsed` and no longer touches
  `elapsed`, and Auto's three deadlines read `since=r.elapsed-r.remainingFrom` (the signal fallback on
  `since>=BREATHING`, the default on `since>=r.readiness`) while the authored dwell keeps its own
  absolute clock on `r.elapsed>=s.pacing.seconds`. The Stop clock therefore survives a Return at 7
  while the deadline is still the work owed. Coverage: `tests/experience-runtime.test.mjs` "C9.5
  Return preserves the parent Stop clock while Auto still waits the remaining work" (`elapsed===7`,
  `readiness===BREATHING+3`, then the narration completes rather than stops) and "C9.5 Return preserves
  an authored dwell instead of restarting it" (Auto refuses at 9 s of a 10 s dwell and advances past
  it), a real-UI Return assertion in `qa/visitor-check.sh`, and the `return-clock` and `return-dwell`
  obligations.
- **P2 Go from a detour lost the parent from Back history** (`app/experience-runtime.js`). A detour
  deliberately omits its parent from ordinary `history` because the bookmark owns the way back, so a
  go choice that discarded the bookmark also discarded the only record of the parent: for A → detour
  B → Go C, Back reached B and a second Back stayed at B. `endParkedVisit` now pushes the parked
  `b.stopId` into `r.history` as it abandons the bookmark, so the genuinely visited parent is ordinary
  history again before the go destination is entered. Coverage: `tests/experience-runtime.test.mjs`
  "C9.5 a go choice keeps the visited parent reachable through Back history" (`history===[a,b]`, two
  Backs reaching `b` then `a`), the same walk driven through the real visitor controls in
  `qa/visitor-check.sh`, and the `abandoned-history` obligation.

### Repairs re-verified after the detour review (2026-10-05)

Re-run at the repaired intermediate stage before commit `056ae3f9`; these historical counts are not current-head claims.

- `node --test tests/*.test.mjs` — **102/102 pass**, 0 fail. Three new cases (the authored dwell, the
  resumed carried work, and the abandoned parent in Back history) plus the rewritten round-1 Return
  case, which now asserts the preserved clock (`elapsed===7`) and the rebased deadline rather than the
  round-1 restart convention.
- `qa/run-all.sh all` — **18 axes, 794 assertions, 0 failures, rc=0**. Only the visitor axis changed, for
  **42** (from 37): the go choice's Back walk and Return's preserved clock, plus the review's own product
  observation driven through the real controls — the parent narration is live at the Stop, the detour
  suspends it, Go resumes it on its parked playhead, and it keeps advancing instead of staying frozen.
  Those last three were proved non-vacuous by replaying the defect in a disposable copy of
  `app/experience-runtime.js`: with the resumption removed they fail, together with the Return-clock
  assertion. The axis is therefore not only green at the repaired revision but demonstrably red without
  the repair. Every other axis is at its reviewed count.
- `qa/mutation-check.sh` — **48/48 rejections, rc=0**. Three new obligations (`return-dwell`,
  `carried-pause`, `abandoned-history`) each reintroduce their named defect in a disposable copy, are
  rejected by their named protected assertion, and leave their named control green; the round-1
  `return-clock` obligation was rewritten to drop the `remainingFrom` rebase instead of round 1's
  zeroing.
- `npm run test:arch` (root) — **276/276 pass, rc=0**, which includes the documentation-reference gate
  `apps/editor/tests/docs/documentation-references.test.ts` at **22/22**.
- `git diff --check` (whitespace) — rc=0.

Two load-dependent harness races surfaced while re-running the whole driver, and only under the full
18-axis run; neither reproduces in isolation and neither involves the repaired code paths. The
`qa/responsive-check.sh` green in the round-1 pass sampled the emulated `prefers-reduced-motion` state
after a fixed 60 ms sleep and failed once here, so both of its media-change blocks now poll the state
they assert (bounded at 5 s) instead of sleeping. The C9.2/C9.3 composition axis failed two Gate
assertions in one full run and passed 27/27 in each of four consecutive isolated runs; it is recorded
here as a flake, not as a pass that was not observed.

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

## C9.6–C9.9 review round — eight findings repaired (2026-10-07, `4e8cc8e7`)

SCOPE: the C9.6 (revision, removal, repair), C9.7 (rich example and local coordination), C9.8 (precise
Camera) and C9.9 (review aid) implementation carried in the working tree, after an independent review of
those four slices alone. Each finding was reproduced against the executable revision, repaired at its own
cause, and covered by a unit test, a product axis assertion, or both. Nothing here is an owner
acceptance, an MP3 claim, a merge or a phase closure.

| # | finding | repair | coverage |
| --- | --- | --- | --- |
| 1 | [P1] a use-only change (Activated by) made while a shared-edit Ask was open applied the pending descriptor immediately, so every linked Activity changed before acceptance | reach is computed from the complete merged proposal in `rebindContributionCommand`, so the merged edit waits as one disclosed decision instead of the touched field alone deciding | unit `a merged rebind proposal waits for the shared-edit acceptance and the Card reads it`; `revision-check` "the linked offer proposal waits with its reach disclosed and nothing written", "a use-only change while the Ask is open never writes the merged definition edit", "accepting the merged proposal writes the shared definition for every linked Activity and the use-owned trigger only for the Activity that was edited"; mutation `rebind-merged-silent` |
| 2 | [P2] during a scoped replacement the Card reset the Subject control to the stored subject and offered that subject's capabilities, so the proposed capability could not be chosen and an incompatible pair could be accepted | the Card and the repair controls render the descriptor the author proposes (`pendingDescriptor`), never the stored one | unit `a merged rebind proposal waits for the shared-edit acceptance and the Card reads it`; `revision-check` "the pending subject drives the capability picker of the shared proposal" and "…of the linked offer proposal" |
| 3 | [P2] descriptor repair kept the captured value, leaving a value Preview rejects while Presenter reported the repair complete | `rebindContribution` adapts the retained value to the capability it now describes (`compatibleValue`), and repair is credited only when the retained instruction resolves | unit `a descriptor replacement adapts the value it keeps and credits repair only once it resolves` |
| 4 | [P2] a retained choice whose destination left with its Presentation offered no local repair/removal, and Preview still armed it: following it parked the parent, paused narration and cleared the active Stop before reporting the missing Stop | the owning Stop exposes local repair and removal (`choiceRepointCommand`/`choiceRemoveCommand`), Preview disables the unresolved choice, and the runtime refuses it before any parking | unit `a retained choice is repaired and removed locally, and a visit refuses it before parking`; `rich-check` "the Stop that authors the broken choice offers its own repair and removal", "Preview marks the retained unresolved choice unavailable instead of offering it", "the runtime refuses the unresolved destination without parking the parent visit", "repairing the destination points the authored choice at a resolving Stop", "removing the choice is one Experience Undo"; mutation `choice-unresolved` |
| 5 | [P2] a capability the profile declares but this Stage does not realize was hidden from direct capture and still reachable through offer creation, rebinding and the visitor runtime | one authority (`isRealized`) is consulted by every writer that creates, rebinds or runs capability work — audition, offer draft and acceptance, capture/update/Capture-another, rebind, the repair pickers; an unrealized capability can never become visitor work | unit `an unrealized capability is refused by every writer that could run it`; `revision-check` "the offer picker lists only capabilities this Stage realizes", "a declared-but-unrealized capability can never be authored as visitor work"; mutation `offer-unrealized` |
| 6 | [P2] focusing a Hold's duration field left the previous station highlighted (Card, station row and Stage disagreed) and the rerender dropped keyboard focus on BODY | `focusHoldBeat` moves the coordination focus onto that Hold's own station and event, and the field the author entered takes focus back after the rerender; a focus that moves nothing records nothing | unit `focusing a Hold addresses that Hold own station, exactly once`; `rich-check` "focusing the Hold moves the coordination focus to that Hold own station and event" |
| 7 | [P2] any authored write credited every satisfied quickstart topic, so renaming a loaded example completed topics the loader, not the author, had satisfied | authorship is recorded per outcome (`reviewAuthored`/`authoredHere`) and a quickstart topic reads only the outcomes its own instruction produces (advanced topics stay reviewable on loaded content) | unit `a quickstart topic is credited by its own authored outcome, never by any write`; `presenter-check` "an authored edit that is not this topic's outcome is counted, and completes nothing"; mutation `presenter-unrelated-credit` |
| 8 | [P2] the visit ledger opened empty and recorded only destinations a later command reached, so a Guide visit that entered Stop 1 and travelled to Stop 2 never satisfied the Travel topic | Preview seeds the ledger with the Stop the runtime actually entered (`visitor: {…emptyVisitorLedger(), stops:[entered]}`), so the first Stop is a visit the ledger witnessed | unit `a Guide visit opens its ledger with the Stop it actually entered`; `presenter-check` "the visit opens its ledger with the Stop it entered, before any command", "…and records the Stop it travelled to as a traversal", "…so the supported Travel topic is credited by the visit that really made it"; mutation `visit-ledger-unseeded` (superseded by `visit-entry-unseeded` — see the next round) |

### Historical verification at this review stage

- Prototype Node suite: `node --test prototypes/spatial-authoring/tests/*.test.mjs` — **117/117 pass**.
  The round added `experience-c9-review.test.mjs` (seven tests, one per repair) and extended
  `experience-revision.test.mjs`.
- Product axes through the real controls (`QA_SHOT=0`, a private server and browser per axis):
  `revision-check` **38/0**, `rich-check` **34/0**, `precision-c9-check` **55/0**, `presenter-check`
  **40/0**, each with its own "no command or page fault" and "no console or page errors" assertion green.
- Successor proof, `qa/composition-mutation-check.sh` — **64/64 obligations rejected their regression and
  every named control stayed green** (exit 0): 42 pure model/runtime obligations on disposable copies of
  the Node suite and 22 browser-wiring obligations. This round added five: a merged rebind that slips past
  the scope Ask (`rebind-merged-silent`), an unrealized capability authored as visitor work
  (`offer-unrealized`), an unresolved choice followed before parking (`choice-unresolved`), any write
  crediting a quickstart topic (`presenter-unrelated-credit`) and a visit ledger that opens without the
  Stop it entered (`visit-ledger-unseeded`). Two anchors were re-pointed at the repaired source (the
  go-choice renderer, whose label now names a needed repair) so that obligation still fails when its
  defect is reintroduced.
- Two harness defects were found and fixed while proving the new assertions, and are recorded rather than
  hidden: one new eval was written as a statement list (invalid inside the harness's `await (…)` wrapper),
  and `qa_js` could take a whole axis down under `set -e` when an eval came back empty; it now reports the
  empty observation and lets the assertion that asked for it fail.
- `git diff --check` is clean. This change is prototype-only (`prototypes/spatial-authoring/**`): the root
  editor/architecture suites and the repository gates are untouched by it and were not re-run here — the
  review recorded them green apart from the pre-existing missing `40-walls.json` fixture.

## C9.9 advanced topics — four further findings repaired (2026-10-07)

SCOPE: the review aid's *advanced* half (Q2's framing outcome, A2's capability sequence, A3's entry policies
and Q7/A4's Travel arrival) after a second independent review of the same four slices. The gap it named was
not coverage but false predicates: the topics were credited by outcomes the instruction does not produce.
Each finding was reproduced against the executable revision, repaired at its own cause (the runtime's own
report, the visit's own ledger, or the authored outcome the topic names), and covered by a unit test and a
product-axis assertion. Nothing here is an owner acceptance, an MP3 claim, a merge or a phase closure.

| # | finding | repair | coverage |
| --- | --- | --- | --- |
| 1 | [P2] Load Example and edit only its explanation: Q2 completed while every framing remained loader-provided — its authored requirement recorded the explanation alone, although the instruction also asks for an explicit Camera Capture | `captureView`/`reuseFraming` record the framing outcome the author accepted (`reviewAuthored('framing')`, plus `framed` for the Presentation it was accepted in, reset with the document's provenance), and Q2 requires both outcomes (`authored:['explanation','framing']`), recorded per Presentation so a View captured in another moment is never this one's framing; the aid's line says which half is missing and why | unit `a quickstart topic names every outcome its instruction produces, not any one of them`, `the framing a topic asks for belongs to the moment it was accepted in, through either authored door`; `presenter-check` "…while the explanation alone leaves the topic open: its framing came with the document", "…and an explanation on a moment made here is still only half of it", "…while an accepted Capture of the author's own framing completes it"; mutation `presenter-framing-uncharged` |
| 2 | [P2] Reset, author narration, one casing Activity and framing, Preview without a Guide: A2 was credited once the casing completed, with no dependent rotor, no handover, no carried run and no visitor Stop — and the completed count included the narration | `visitOutcome.completed` counts completed *capability* work only and adds `handoffs` (the dependent runs a completion actually began); the visitor's own Stop is recorded in the ledger with the run it ended, live at the time and on its authored Experience lifetime; A2 requires the sequence, the handover and that carried stop | unit `the capability-sequence topic needs the handover and the carried run the visitor stopped`; `presenter-check` "the casing completes and hands over to a rotor that is still carried as the visitor's live run", "…while that sequence alone leaves the topic open: no carried run was stopped", "…and the visitor's own Stop ends that carried run, live and on its authored lifetime"; mutation `presenter-sequence-credit` |
| 3 | [P2] after a standalone Preview, two Stops with presentation/hold entries configured completed A3 without any Guide Preview and without the specific later-View entry: configured policies plus any previous visit were read as if the visit had run them | every Stop entry a visit really makes is recorded in the ledger (`entryRecord`/`reconcileVisitor`: the policy the author configured, whether the named View is a later one, the Camera's own arrival at it, and whether content ran under a hold); A3 requires one visit that ran a Presentation entry, a specific later View and a hold with content still running | unit `the Stop entry-policy topic reads the entries a visit ran, never the policies an author configured`; `presenter-check` "the three policies are authored through the Stop's own Entry control", "…while configured policies alone leave the topic open, with only the entries a visit really made", "…and one visit that ran all three credits it, each where it actually happened"; mutation `presenter-entry-configuration` |
| 4 | [P2] on an authored machine-to-piano Travel, Next credited Q7 and A4 after 0.028s of a 0.819s movement: `arrivedViewUseId` still named the source View, and its truthiness marked the destination arrived | the runtime reports its own arrival (`arrivedViewUseId` with `arrivedTravel`, set only when a movement completes, from the movement's own Seam route); the ledger records the transition's destination entry View and reconciles arrival from that report, counting a Travel arrival only for the Seam's own route — A4 requires that completed traversal | unit `a Guide visit opens its ledger with the Stop it entered and arrives where the Camera does`; `presenter-check` "…which stays travelling until the Camera really reaches the destination entry", "…and arrives where the Camera does, on the Seam's own route", "…so the supported Travel topic is credited by the visit that really made it"; mutation `visit-arrival-immediate` |

### Historical verification at this review stage

- Prototype Node suite: `node --test prototypes/spatial-authoring/tests/*.test.mjs` — **120/120 pass**. The
  round extended `experience-c9-review.test.mjs` to ten tests: the ledger test now also proves arrival is
  read from the Camera (a traversal that is entered during the movement is not arrived, and a Travel is
  counted only when its own route arrives), and four tests were added for the framing pair, the framing's
  own moment and its second authored door (reusing a Camera View), the capability sequence and the entry
  policies. Two earlier tests were renamed because their names now say what they prove: row 7's coverage
  test is `a quickstart topic names every outcome its instruction produces, not any one of them`, and row 8's
  is `a Guide visit opens its ledger with the Stop it entered and arrives where the Camera does`.
- Product axes through the real controls (`QA_SHOT=0`, a private server and browser per axis): every axis green —
  `presenter-check` **52/0** (twelve assertions added: the framing pair, the arrival bookend, the capability
  sequence, the entry policies), `visitor-check` **42/0**, `experience-check` **30/0**, `rich-check` **34/0**,
  `composition-check` **27/0**, `conformance-check` **105/0**, `reconciliation-check` **13/0**,
  `correctness-check` **11/0**, `continuity-check` **55/0**, `revision-check` **38/0**, `precision-c9-check`
  **55/0**, `creator-check` **23/0** — each with its own "no command or page fault" and "no console or page
  errors" assertion green. The four new checkpoints (`framing`, `arrival`, `sequence`, `policies`) and the two
  the repairs read (`a2`, `a3`) exist so each repair can be mutation-tested at the assertion that protects it.
- One axis was flaky, and the check — not the product — was repaired: `rich-check`'s World Wall assertion waited
  on 1500 ms of wall time for the visitor runtime's own 1 s unroll tween, so in a backgrounded tab (rAF
  suspended) the tween never advanced and the assertion read a value the product had not been asked to reach.
  It failed once in a back-to-back batch run and passed on every serial run. The wait is now
  `E.stepVisitor(2)` — the visitor's own clock, the same clock the product's runtime uses — so the assertion is
  deterministic and states the mechanism it depends on; re-run green **34/0** afterwards.
- Successor proof, `qa/composition-mutation-check.sh` — **68/68 obligations rejected their regression and
  every named control stayed green** (exit 0). This round added four browser-wiring obligations:
  `presenter-framing-uncharged` (the framing outcome dropped from Q2's authored requirement),
  `presenter-sequence-credit` (any completed work crediting the capability sequence),
  `presenter-entry-configuration` (configured entry kinds read as executed ones) and
  `visit-arrival-immediate` (the destination read as arrived from the last View the Camera stood at). The rich
  boundary the clock change touches was re-run with them.

## C9.9 advanced topics — four further findings repaired (2026-10-07, second round)

SCOPE: the same four topics after a third review reproduced each one through the product. The gap was again not
coverage but false predicates: a credit that outlived the moment it was about, a handover credited to a run
that never began, a ledger that only saw commanded Stops, and an arrival lost to a cue the destination itself
started. Each was repaired at its own cause and covered by a unit test, a product-axis assertion and a
successor obligation. Nothing here is an owner acceptance, an MP3 claim, a merge or a phase closure.

| # | finding | repair | coverage |
| --- | --- | --- | --- |
| 1 | [P2] Load Example, edit Understand the drive's explanation, Capture framing on Compare materials, reopen Understand the drive: Q2 completed while its own observed line said the framing came with the document — the per-Presentation record fed only that text, and credit still read the session-wide framing counter | an outcome that belongs to one moment is recorded against that Presentation as well as in the session tally (`reviewMoment`/`momentAuthored`, replacing the framing-list-and-global-counter pair), and Q2's authored requirement is two predicates closing over the moment it assesses, so a Capture or an explanation authored on another Presentation is never this one's | unit `the framing a topic asks for belongs to the moment it was accepted in, through either authored door`; `presenter-check` "…and a Capture on another moment never stands in for the one the topic assesses", "…and returning to it credits the topic again, where the reviewer is reading"; mutation `framing-global` (unit) and `presenter-framing-scope` (product) |
| 2 | [P2] Load Example, Preview Guide, Next before casing completion, then exit: the rotor stayed stopped with reason `Visit left before dependency` and never started, yet `handoffs` was 1 and A2 completed — excluding only *waiting* and *unavailable* admitted disarmed dependents | `begin` records `a.began` only once a run really started (after every gate that can refuse it), the record survives a later Stop, and `handoffs` counts dependents that began — so a run the visitor stopped still counts and one the visit disarmed never does | unit `a capability sequence counts a handover only when the dependent really began`; `presenter-check` "…so the dependent the visit left behind is no handover, whatever else completed"; mutation `handover-stopped` (unit) and `presenter-handover-disarmed` (product) |
| 3 | [P2] After configuring a later-View entry and a hold entry, Auto visited all four Stops but the ledger kept only the first, so A3 and A4 stayed incomplete — entries and transitions were appended only inside a visitor command | where the visit is, which Stop entry it made and how the Camera's movements ended are all read from the runtime in `reconcileVisitor`, so a command, a choice, a detour and Auto are one story; the command writes only the facts its own action produced | unit `a Stop reached by Auto is as real as one reached by Next`; `presenter-check` "…and with Auto on, all four Stops and their three entry policies land in the ledger"; mutation `entry-auto-only` (unit) and `visit-entries-auto` (product) |
| 4 | [P2] A short explanation at the destination whose completion cues another View: the Travel completed and the cue began in the same tick, the `!movement` guard rejected the arrival, and the cue's completion then overwrote `arrivedViewUseId`, so Q7 stayed unseen and A4 incomplete | completed movements are journalled in the runtime (`arrivals`, with `travelArrivals`), an entry records the Camera serial it was made at, and arrival is read by matching that movement rather than the last arrival slot or the absence of a movement | unit `a Travel arrival survives the destination starting its own cue`; `presenter-check` "…which stays travelling until the Camera really reaches the destination entry" (unchanged, still the pre-arrival witness); mutation `arrival-slot` (unit) and `visit-arrival-immediate` (retargeted, product) |

### Historical verification at this review stage

- Prototype Node suite: `node --test prototypes/spatial-authoring/tests/*.test.mjs` — **123/123 pass**.
  `experience-c9-review.test.mjs` is thirteen tests; three were added for the runtime findings above, and the framing test
  now walks the reviewer's own reproduction (two explained moments, a Capture on one, the other still open).
- Product axis through the real controls (`QA_SHOT=0`): `presenter-check` **56/0** — four assertions added (the
  cross-moment Capture, the disarmed handover, the Auto visit) and one updated to state the new semantics
  truthfully. **A behaviour change is recorded here deliberately:** because a topic about a moment is credited
  on the moment the aid assesses, the aid's session tally now follows that moment — expanding a Stop onto the
  loaded example's own Presentation opens Q2 again (its framing came with the document) and the tally reads 0
  there, which the visit-block assertion now proves rather than hides.
- Successor proof, `qa/composition-mutation-check.sh` — **75/75 obligations rejected their regression and every
  named control stayed green** (exit 0): forty-six model/runtime obligations (the C9.9 review suite is now
  included in the unit run) and twenty-nine browser-wiring obligations, of which this round adds
  `presenter-framing-scope`, `presenter-handover-disarmed` and `visit-entries-auto`, and retargets three whose
  anchors the repairs moved (`presenter-framing-uncharged`, `visit-arrival-immediate`, and the renamed
  `visit-entry-unseeded`, whose defect class is now the opening entry the visit never records).

## C9.9 re-review and folded repair (2026-10-07)

The four second-round repairs were already present in the working tree and passed the initial **123/123**
Node suite. Re-review confirmed the per-Presentation Q2 credit and actual-begin handover records. Three
remaining event-recording cases and one capability-sequence predicate failed before this fold and pass afterwards:

| case | cause and folded repair | coverage |
| --- | --- | --- |
| Auto enters several Stops between aid readings | Polling the current Stop missed intermediate entries and captured a late Camera serial. The runtime now records each actual entry with its originating visit, policy and completed outcomes; the aid reads those records. | The existing Auto unit test now runs with both 1-second and 8-second readings; Presenter advances its whole 34-second Auto visit before reading it. |
| Ten queued destination cues evict the entry arrival | The eight-item Camera diagnostic journal could forget a completed Travel before the aid read it. Camera completion now records arrival on its originating entry, which outlives the diagnostic window. | Unit `entry arrival survives more cues than the Camera diagnostic journal retains`; Presenter authors ten cues through the real controls, then proves both Camera completion and retained Q7/A4 credit; mutation `arrival-evicted`. |
| Return is mistaken for a fresh Stop entry | A changed current Stop was treated as a new entry even when Return restored an existing visit. Only actual entry creates a runtime record; Return resumes without another policy entry. | Unit `Return resumes its Stop without inventing another entry policy`; rich assertion `Return resumes the parent without recording a duplicate Stop entry`; mutations `return-entry` and `visit-return-entry`. |
| Narration completion stands in for a capability handover | An explanation could finish and start the rotor while an unrelated casing operation had also completed. A2 now requires a capability dependent that actually began on another capability's completion, in addition to the visitor's Stop. | Unit `an explanation finishing is not a capability completion handover`; Presenter authors that dependency through the signal picker, runs and stops it, and keeps A2 open; mutation `handover-narration`. |

Held-content outcomes are recorded while that entry is active, rather than inferred later from completed
work left by another visit. The movement's visit identity prevents repeated Stops sharing a View from
borrowing one another's arrival. Camera still evaluates every movement; these are private session outcomes,
not authored data or a second navigation authority. No production code, root fixtures or gates were changed.

The first mutation run exposed a QA defect introduced while adding Return coverage: Return released the
Wall projection before the Exit-restoration assertion, allowing `representation-restore` to pass. Exit and
Return now run in separate visits, preserving both witnesses. This failure is recorded rather than claimed
as a product pass. Final verification below supersedes that interrupted mutation run.

Historical verification at the final re-review sources (committed as `dad60dff`):

- Prototype Node suite **126/126**; the C9 review file has **16 tests**. The four new failing cases were
  reproduced before their repairs, including the two observation cadences in the existing Auto test.
- Twelve affected product axes green: Presenter **59/0**, rich **35/0**, visitor **42/0**, Experience **30/0**,
  composition **27/0**, conformance **105/0**, reconciliation **13/0**, correctness **11/0**, continuity **55/0**,
  revision **38/0**, precision-c9 **55/0**, creator **23/0**. Presenter and rich were re-run after the final
  capability-handover requirement and the QA ordering correction. Each axis's fault/error controls passed.
- Full composition mutation chain **79/79 regressions rejected**, all named controls green, exit **0**:
  **49** model/runtime and **30** browser obligations. Existing obligations were retargeted to the runtime
  entry records; the four additions are `arrival-evicted`, `return-entry`, `handover-narration` and
  `visit-return-entry`.
- Architecture **276/276**, exit **0**; `git diff --check` clean. Root `npm test`, `npm run check` and
  `npm run build` were all run and remain red only on the pre-existing missing `40-walls.json` fixture.
  Root tests report **4951 passed, 1 failed, 1 skipped**, with **32 suites unable to collect** through the
  same missing import; this is not a passing root gate.
- These final re-review sources were committed in `dad60dff`. The **126/126**, twelve affected axes and **79/79** mutations above describe that executable increment, not the later follow-up. All owned browsers and private QA servers were released. No owner acceptance, closure or production acceptance is claimed.

## Known limitations

EVIDENCE-PATHS: start — the deleted P23B fixture this record reports as an external
blocker; identity as recorded at base `abaa7592`
- The missing fixture `docs/roadmap/p23b-geometry-performance/40-walls.json` is a
  pre-existing repository-gate blocker, external to C9. It was not restored, hidden or
  fabricated.
EVIDENCE-PATHS: end
- MP1 and MP2 are explicitly owner-accepted. MP3 and MP4 remain pending. No visual refinement campaign was started; it belongs to the later dedicated UI/UX slice.
- Historical C9.4/C9.5 and C9.6–C9.9 increment counts above retain their own provenance. Use the current follow-up block for final code, tests/mutations and repository-gate status.
- A station-bound Activity's route and named station are validated where they are read
  (Camera travel and the coordination strip): Experience holds stable identity, never a copy
  of route geometry, so a deleted anchor or station still refuses locally at travel time.
- C9.6 now supports bounded View/Presentation removal and repair. Automatic offer execution remains excluded, and parent pause/bookmark policies remain experimental.
- No merge, phase closure, production acceptance, Paper work or six-QA reconciliation is claimed or performed. MP3 and MP4 require owner review of this committed executable.

[plan]: ../../../docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md
[c8]: ./EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
[checkpoint]: ../../../docs/operations/checkpoints/pr113-experience-v2.md
