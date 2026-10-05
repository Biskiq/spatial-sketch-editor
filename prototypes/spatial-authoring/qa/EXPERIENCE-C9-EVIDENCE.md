# C9 Experience reconciliation — evidence record (C9.1–C9.3)

TYPE: prototype acceptance evidence (in progress; MP2 pending)
STATUS: C9.1–C9.3 implemented; the five external MP2 review blockers repaired with regression
coverage, then the review's folded second-pass findings (station activation contract, cue-scope
consistency, remaining-work edge cases, stale provenance) repaired with their own coverage
(2026-10-05); stopped for **MP2 human review**. C9.4/C9.5 (Travel and agency) are not started.
No merge, phase closure or Paper work was requested or performed. Commit/push provenance is
recorded exactly under *Executable revision*; nothing here claims an uncommitted increment that
Git already holds as commits.
SCOPE: [C9 authoring-completeness plan][plan] C9.1–C9.3 only. This record supersedes
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
- One executable serves every axis and journey: `index.html` + `app/` in this directory.
  Inspect live Git for exact bytes; the changed paths are:

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

## MP1 and MP2 record

- **MP1 — accepted explicitly by the owner, 2026-10-04, in this thread.** The standalone J1
  loop (real subject → explanation/framing → capability capture → no-Guide Preview/return)
  was inspected with the Presenter closed. No comprehension result was invented.
- **MP2 — pending human review.** Automated assertions cannot substitute for it. The
  reviewer repeats J1, adds A/B, previews the Guide and presses Next, selects/edits a Stop
  at Peek, deliberately opens and leaves Overview, and predicts View/Stop counts and scope,
  confirming that the advanced lifecycle work did not raise the low floor. C9.4/C9.5 wait
  for the recorded outcome.

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

## Verification results

### Pure Node model/runtime/Camera suite

`node --test tests/*.test.mjs` — **75/75 pass** (`ℹ pass 75`, 0 fail) after the second repair
pass; the first pass's run was 70/70. The second-pass additions are four review cases: station
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

### Full prototype axis driver

`qa/run-all.sh all` — **18 axes, 762 assertions, 0 failures, rc=0 at the frozen executable
revision `9a44678a`** (log `/tmp/c9-all-final.log`: every axis reports `FAIL=0`, the chain ends
`qa: all requested axes passed`, `ALL_RC=0`, 762 `PASS` lines, no console or page faults).
Every axis is proven at that one revision; none is carried from an earlier pass. Per axis:
journeys A–F 59, real interaction 56, pointer flows 44, lifecycle/policy 41, World shell 47,
spatial/Precision 38, Browse/Search 60, repair 47, lens/parking/Resume 81, Experience wiring
30, V2 conformance 101, C9.1 creator 23, C9.2/C9.3 composition 27, visitor 14, shared/narrow
reconciliation 13, continuity 55, responsive 15, correctness 11. The four review additions in
the conformance axis (the offer authored through the real subject control, the station picker
excluding it, the binding read after the real invoke click, and the Stop Card declaring
`trigger moves here`) are included in that count. The first repair pass's full run — 758
assertions with conformance at 97 — is retained as history (`/tmp/mp2-run-all-final.log`); the
second pass supersedes it rather than being carried. Every axis closes its own browser; no
session was left running.

### Mutation obligations (same-defect successor proof on disposable copies)

`qa/mutation-check.sh` — **23/23 rejections, rc=0** for the first repair pass (full chain log
`/tmp/mp2-mutations-full.log`; composition-only rerun `/tmp/mp2-mutations-final.log`) and
**28/28** after the second (full chain `/tmp/c9-mutations-final.log` rc=0 at the frozen
revision — World 3, V2 7, C9 18 — with the composition-only rerun 18/18
`/tmp/comp-mut.log`). Each kind reintroduces the named defect in a disposable copy; the
protected assertion must fail while named unrelated controls stay green, never a crash or
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

### Defects found and repaired during this increment

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
required verification), at the frozen revision `9a44678a`. These gates never import the
prototype's Experience runtime (root workspaces are `apps/*` and `packages/*` only; the
prototype is not a workspace), so the docs-only child commit cannot change them:

- `npm run test:arch` — **276/276 pass**, 24 files, rc=0 (`/tmp/c9-arch-final.log`; rerun at
  the frozen second-pass revision). The docs reconciliation removed the one pre-existing
  finding (the old checkpoint revision quoting the deleted fixture) and the historical S0–S9
  record now declares that path under the documented `EVIDENCE-PATHS` convention.
- `npm test` — **33 files failed / 339 passed / 1 skipped; 4951 tests passed, 1 failed,
  1 skipped**, rc=1 (`/tmp/c9-root-test-final.log`; identical to the pre-review run). The only
  collected failure is the missing-fixture import; the other 32 failing files fail
  dependent-suite collection for the same reason.
- `npm run check` — 1 missing-module error, 0 warnings (`/tmp/c9-check-final.log`).
- `npm run build` — unresolved import of the same fixture (`/tmp/c9-build-final.log`).
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
- The second repair pass reran the pure suite, the full mutation chain and the complete
  prototype axis driver at its frozen executable revision, and reran the root repository gates
  above at the same revision (arch 276/276 rc=0; test/check/build red only on the missing P23B
  fixture, unchanged). All 18 axes are therefore proven at `9a44678a`; none is carried from an
  earlier revision. The evidence and status docs land as a docs-only commit on top of it, so
  the pushed head and the tested executable differ only in those docs.
- A station-bound Activity's route and named station are validated where they are read
  (Camera travel and the coordination strip): Experience holds stable identity, never a copy
  of route geometry, so a deleted anchor or station still refuses locally at travel time.
- No merge, phase closure or Paper work is claimed or performed. C9.2/C9.3 (`12652d9b`), the
  first repair pass (`db83a9d7`) and the second repair pass (`9a44678a`, with the evidence and
  status docs as its docs-only child) are committed and pushed to `origin/prototype-v2`.

[plan]: ../../../docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md
[c8]: ./EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
[checkpoint]: ../../../docs/operations/checkpoints/pr113-experience-v2.md
