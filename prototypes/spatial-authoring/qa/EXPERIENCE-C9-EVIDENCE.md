# C9 Experience reconciliation — evidence record (C9.1–C9.3)

TYPE: prototype acceptance evidence (in progress; MP2 pending)
STATUS: C9.1–C9.3 implemented; the five external MP2 review blockers repaired with regression
coverage (2026-10-05); stopped for **MP2 human review**. C9.4/C9.5 (Travel and agency) are not
started. No commit, push, merge, phase closure or Paper work was requested or performed by this
increment.
SCOPE: [C9 authoring-completeness plan][plan] C9.1–C9.3 only. This record supersedes
nothing in the [C1–C8 conformance record][c8]: that remains the acceptance authority for
C1–C8 behavioral/visual conformance.

## Executable revision

- Branch `prototype-v2`; base commit `abaa7592730f565a8d47fd8480d69f0907dfe6c7` ("C9.1
  review pass"). The C9.1 slice was committed by the owner's review pass; C9.2/C9.3 (and the
  C9.1 regression hardening it needed) is the uncommitted working-tree diff on top.
- One executable serves every axis and journey: `index.html` + `app/` in this directory.
  Inspect live Git for exact bytes; the changed paths are:

  - app: `actions.js`, `experience-capabilities.js`, `experience-model.js`,
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

## Verification results

### Pure Node model/runtime/Camera suite

`node --test tests/*.test.mjs` — **70/70 pass** (`ℹ pass 70`, 0 fail). The C9 additions are
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

`qa/run-all.sh all` — **18 axes, 758 assertions, 0 failures, rc=0** (log
`/tmp/mp2-run-all-final.log`). Per axis: journeys A–F 59, real interaction 56, pointer flows 44,
lifecycle/policy 41, World shell 47, spatial/Precision 38, Browse/Search 60, repair 47,
lens/parking/Resume 81, Experience wiring 30, V2 conformance 97, C9.1 creator 23,
C9.2/C9.3 composition 27 (four external-review assertions added), visitor 14, shared/narrow
reconciliation 13, continuity 55, responsive 15, correctness 11. Every axis closes its own
browser; no session was left running.

### Mutation obligations (same-defect successor proof on disposable copies)

`qa/mutation-check.sh` — **23/23 rejections, rc=0** (full chain log
`/tmp/mp2-mutations-full.log`; composition-only rerun `/tmp/mp2-mutations-final.log`). Each
kind reintroduces the named defect in a disposable copy; the protected assertion must fail
while named unrelated controls stay green, never a crash or empty observation.

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
required verification). At base `abaa7592` plus the uncommitted C9.2/C9.3 + review-repair diff:

- `npm run test:arch` — **276/276 pass**, 24 files, rc=0 (`/tmp/mp2-arch.log`; rerun after
  the review repairs and their doc updates). The docs reconciliation removed the one
  pre-existing finding (the old checkpoint revision quoting the deleted fixture) and the
  historical S0–S9 record now declares that path under the documented `EVIDENCE-PATHS`
  convention.
- `npm test` — **33 files failed / 339 passed / 1 skipped; 4951 tests passed, 1 failed,
  1 skipped**, rc=1 (`/tmp/mp2-root-test.log`; identical to the pre-review run). The only
  collected failure is the missing-fixture import; the other 32 failing files fail
  dependent-suite collection for the same reason.
- `npm run check` — 1 missing-module error, 0 warnings (`/tmp/mp2-check.log`).
- `npm run build` — unresolved import of the same fixture (`/tmp/mp2-build.log`).
- `git diff --check` (whitespace) — rc=0 (`/tmp/mp2-whitespace.log`).

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
- No commit, push, merge, phase closure or Paper work is claimed or performed.

[plan]: ../../../docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md
[c8]: ./EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
[checkpoint]: ../../../docs/operations/checkpoints/pr113-experience-v2.md
