# PR #114 — closed unified design ratification and V2 disposition

**AUTHORITY: NONE. Status: accepted and closed (2026-10-13).** Slice id
`p25-unified-design`; [PR #114](https://github.com/Biskiq/spatial-sketch-editor/pull/114).
Delivered one ratified shell/Experience destination, reconciled Paper depth,
retained specialized prototype evidence, retired obsolete execution routing and
the deliberately removed benchmark workload, and handed #115 its S0-first mandate.

**Contract:** [PLATE](../../../docs/reference/design-system/editor-shell-and-visual-system.md)
owns the accepted design, including the non-blocking 3D Scene interface gap.
Current domain implementations retain their own authorities until explicit cutover.
[The #115 handoff](../../../docs/roadmap/README.md) owns future
S0/T-track planning; no assessment, track plan, production UI or new prototype is
implemented here. Accepted Conservatory revision:
`426698573e883bc3a16b265ff9efc5be744c5fec`.

## #114 V2 branch-diff disposition

**Inventory baseline:** PR base `48447fb4d26c4285d956d0b09c84587a93db99a8` to
inspected pre-reconciliation head `426698573e883bc3a16b265ff9efc5be744c5fec`.
These are evidence anchors, not a moving operational baton.

```sh
git diff --name-status 48447fb4d26c4285d956d0b09c84587a93db99a8...426698573e883bc3a16b265ff9efc5be744c5fec -- prototypes/spatial-authoring
```

| Group | Files | Disposition |
| --- | ---: | --- |
| Runtime/shell | 16 | Retain historical UX1–UX6 implementation and useful functional corrections; no accepted Experience shell or production mechanism is inferred |
| QA scripts | 28 | Retain selector adaptations, behavioral/mutation proof and isolated-session/bounded-sweep harness work; old surface assertions describe V2 only |
| Node tests | 3 | Retain path-point, Journey/coordination and Travel-agency coverage; not visual acceptance |
| Captures | 45 | Retain before/after provenance in place, never a pixel/layout gate |
| Documentation | 5 | Reconcile routing/status here; keep implementation records and tested-contract provenance |
| **Total** | **97** | No runtime/test/capture is reverted, deleted or refactored by this task |

**Runtime assessment.** Experience modules carry thumbnail generation, usage-first
subject disclosure, Presentation/View operations, Guide/edge Cards, path-point
editing and station-bound Journey/Cue playback. Their always-present Guide lane,
semi-spatial View constellation, split Path/Journey lanes and earlier Card
composition are superseded UX, retained as historical executable evidence.

Shared changes are consequential to preservation: `actions.js` keeps one selection
hook and advances the World source generation at history settlement;
`navigation.js` centralizes motion interruption/focus resolution; `stage.js`
renders derivative View previews with state restoration; `main.js` wires the
single frame clock, shared locator and cancellation; `state.js` holds only the
added session disclosures/generation; `fixtures.js`/`ui.js` distinguish register
records from logical Scene subjects and restore keyboard focus. Shared Head
markup removes fabricated save/history counts and consolidates Preview. The
removed visible trail list leaves `gotoTrail` and keyboard spatial return intact.
These are prototype mechanisms/functional changes, not new production authorities.

**World preservation.** Git comparison confirms no branch change to the World
journey definitions, canonical prototype World model, drawing/task/cancellation
modules, A–F baseline or the ten core World QA scripts listed below. Rotunda
Unroll/partial readings, Section/Cut, Ceiling Lift, nested Look and Plan ↔ 3D
return remain routed and executable. The shared files above are not World-only,
so removing them or their Experience modules would risk protected invariants.

**Decision/limits.** Retain this existing diff in #114 with explicit historical
classification. No substantial code change or unresolved semantic incompatibility
is required to make that disposition; this is a bounded diff assessment, not a
new execution of A–F or blanket acceptance of obsolete UI. Existing load-sensitive
image-pass readings and other prior limits remain recorded below. A later source
defect needs its own scope and focused proof, not a design-driven bulk revert.
No new V2 development is authorized. Wide World-instrument/overlay arbitration
remains a non-blocking delivery refinement in PLATE, not an invented solution here.

### Exact file inventory

**Runtime/shell:** `app/actions.js`, `app/experience-coordination.js`, `app/experience-draw.js`, `app/experience-image.js`, `app/experience-model.js`, `app/experience-scene.js`, `app/experience-ui.js`, `app/experience.js`, `app/fixtures.js`, `app/main.js`, `app/navigation.js`, `app/stage.js`, `app/state.js`, `app/ui.js`, `index.html`, `styles/app.css`.

**QA scripts:** `qa/capture-experience-shell.sh`, `qa/capture-experience-subject.sh`, `qa/capture-experience-ux456.sh`, `qa/capture-experience-views.sh`, `qa/composition-check.sh`, `qa/composition-mutation-check.sh`, `qa/conformance-check.sh`, `qa/conformance-mutation-check.sh`, `qa/continuity-check.sh`, `qa/creator-check.sh`, `qa/experience-check.sh`, `qa/experience-shell-check.sh`, `qa/lens-check.sh`, `qa/lib.sh`, `qa/locator-check.sh`, `qa/locator-mutation-check.sh`, `qa/mutation-check.sh`, `qa/precision-c9-check.sh`, `qa/presenter-check.sh`, `qa/reconciliation-check.sh`, `qa/revision-check.sh`, `qa/rich-check.sh`, `qa/run-all.sh`, `qa/subject-mutation-check.sh`, `qa/views-mutation-check.sh`, `qa/visitor-check.sh`, `qa/walkthrough-check.sh`, `qa/walkthrough-demo-check.sh`.

**Node tests:** `tests/experience-journey.test.mjs`, `tests/experience-path-points.test.mjs`, `tests/experience-travel-agency.test.mjs`.

**Documentation:** `README.md`, `qa/CONFORMANCE-MANIFEST.md`, `qa/EXPERIENCE-UX-EVIDENCE.md`, `qa/README.md`, `qa/experience-ux-selector-inventory.md`.

**Captures:** `screens/experience-ux-before/` (5), `screens/experience-ux1/` (5), `screens/experience-ux2/` (6), `screens/experience-ux3/` (6), `screens/experience-ux4/` (6), `screens/experience-ux456/` (10), `screens/experience-ux5/` (6), `screens/experience-ux6/` (1).

**Unchanged World anchors:** `app/journeys.js`, `app/model.js`, `app/draw.js`, `app/tasks.js`, `app/cancel.js`, `qa/baseline.json`, `qa/journey-check.sh`, `qa/interaction-check.sh`, `qa/flow-check.sh`, `qa/policy-check.sh`, `qa/shell-check.sh`, `qa/precision-check.sh`, `qa/browse-check.sh`, `qa/repair-check.sh`, `qa/responsive-check.sh`, `qa/correctness-check.sh`.

## Final review and acceptance evidence (2026-10-13)

**Implementation accepted.** The owner accepted the ratification, Paper
reconciliation, V2 preservation and inactive-plan disposition, then manually
reviewed the final work and directed closeout/push with existing full-suite
evidence reused. The remaining corrections declare PLATE's non-blocking 3D
Scene interface coverage gap, add #115's S0 disposition/prune-first gate, and
remove benchmark import/formatting artifacts and a stale owner-fixture hint.
No product UI, prototype development or track assessment/plan was added.

**Whole-PR re-review:** base `48447fb4d26c4285d956d0b09c84587a93db99a8`
to correction/capture revision `d0d3d162d358d8dca2faea522564e1b1b892b76e`;
196 changed files assessed by scope and preservation, with no material findings.
PLATE has one accepted shell/Experience destination, separated from implemented
production. Paper's detailed authoring body and all 16 protected World anchors
above are unchanged. The 97-file V2 diff remains explicitly historical; all
prototype runtime, scripts, tests, styles and images are unchanged since the
accepted artifact. Superseded plans stay inactive. Active benchmark validation
remains strict; the frozen baseline/ledger and historical captures are unchanged.
#115 retains one S0-first parallel-track planning mandate with UI replacement,
demonstrated compatibility obligations, removal acceptance and F interface gates.

### Focused P23B browser verification

The existing `/dev/perf/p23b` **Run six workload baselines → Run scripted
capture → Download baseline JSON** flow completed in a fresh in-app Chromium
document at a 1440 × 1000 viewport, DPR 2 (reported Chrome 155.0.0.0, Apple M2,
ANGLE Metal; graphics provenance is a diagnostic WebGL2 canvas). Source was
clean at `d0d3d162d358d8dca2faea522564e1b1b892b76e`.

| Hosted control | Capture session | Result |
| --- | --- | --- |
| Size-40 straight | `906d5425-2066-425f-9391-86a55a49c560` | Settled; zero dropped boundaries; five accepted warm-up actions excluded per applicable path; bend correctly not applicable |
| Size-40 all-curved | `49fad8c5-4d7e-4077-bb3c-35536fef3d79` | Settled; zero dropped boundaries; five accepted warm-up actions excluded, including bend |

Both observed Plan views are stable at **19.292586186549904 px/m**, with a
612 × 626 canvas. The prescribed driver obtained 25 accepted selection/drag/
authoring actions per control and 25 bend actions on the curved control; its
pan/zoom round trips restored each view within 0.0000 px. Setup/retry/reset
counts remain in the raw report; they are not substituted for accepted samples.

The unmodified [fresh export](../../../docs/archive/roadmap/p25-experience/p25-unified-design/p23b-browser-report.json)
is **73,217 bytes**, SHA-256
`b352f1fccd410791de63fa6e2fab893d747fd13fa7b1c8159a67b70f6b82fb73`.
[Validation results](../../../docs/archive/roadmap/p25-experience/p25-unified-design/p23b-validation-result.json)
record direct calls to `validateP23BBrowserReport(report, { requireCleanHead: true })`:
the six workloads/two controls pass; relabelling a workload or control as
`owner-40-curved-v1` and sharing capture sessions each fail. `validateBaseline`
and `serializeBaseline` read/round-trip the unchanged historical seven-workload/
three-control baseline. No recorder, baseline, ledger or historical-capture
write occurred.

**Limits:** the CLI initially lost its browser document; a narrow in-app attempt
failed the target-fit guard and produced only one control, so neither counts as
passed evidence. The complete fresh run above is the accepted browser record.
Its DEV timing samples are advisory; this verifies capture/export/validation,
not a performance improvement, native-browser timing guarantee, GPU presentation
or the separate M1/CDP profile. Guided 3D capture retains its existing owner deferral.

### Automated gates and preservation

| Evidence | Result |
| --- | --- |
| Final correction architecture lane, root `npm run test:arch` | **276/276**, 24 files; includes documentation-reference gate **22/22** |
| Focused baseline, fixture, measurement and driver-gesture tests | **22/22**, four files |
| Final correction root `npm run check` | Both apps: **0 errors / 0 warnings** |
| Final correction root `npm run build` | Both apps pass; existing chunk-size advisories |
| Reused root full-suite evidence, `7eb810b457881c17d254748311fb9cddf8c223e5` | **5242 pass / 4 skip**, **371 files pass / 2 skip**; owner explicitly directed no further full-suite run |
| Scope/preservation/whitespace | Paper body, World anchors, prototype implementation and frozen measurement records preserved; `git diff --check` passes |

The corrections alter documentation, benchmark presentation text, import
formatting and an equivalent matrix-map wrapper; domain algorithms and capture
semantics are unchanged, so prior full-suite evidence remains applicable.
Closeout introduces only documentation/preservation artifacts and uses its
self-check, without a new design review or full-suite run. No major phase closes.

## Closeout and preservation

**Residuals:** non-blocking UX refinements and 3D interface coverage stay in
PLATE; T2 validates Scene authoring with T1 Stage integration. #115 owns S0 and
independently gated track plans; F exact-interface ratification still gates
production. No genuine #114 blocker or manual-owed acceptance row remains.

**Entry points (existing behavior):**

- World journeys / QA: `prototypes/spatial-authoring/app/journeys.js`,
  `prototypes/spatial-authoring/qa/journey-check.sh`.

EVIDENCE-PATHS: start — bench paths as written before #115 removed the PERF lane and `lib/bench/**`

- Active benchmark fixtures / driver: `apps/editor/src/lib/bench/p23b-fixtures.ts`,
  `apps/editor/src/routes/dev/perf/p23b/drive.ts`.
- Fresh report / historical validation: `apps/editor/src/lib/bench/record-baseline.ts`,
  `apps/editor/src/lib/bench/bench-report.ts`.
- Regression contract: `apps/editor/tests/lib/bench/p23b-baseline-contract.test.ts`.

EVIDENCE-PATHS: end

**Closeout self-check: PASS.** Acceptance matches the recorded gates and owner's
manual review; durable design is promoted to its reference owners; recovery/tag
and evidence links resolve; phase status, current snapshot and S0-first baton
agree; no pending-merge status or operational head pin remains; preservation is
complete. Closeout changes only documentation and preservation artifacts; no
new design review, implementation-code change or major-phase closure occurred.
Post-compaction documentation-reference checks pass **22/22**, verifying the
compacted path and its links.

### Final correction / closeout file inventory

The bounded corrections change PLATE and the roadmap handoff, the dev benchmark
page/recorder, and import/whitespace artifacts in these 16 existing test/probe
files. Closeout changes three additional Markdown files and adds the two
measurement records; it changes no implementation code.

```text
docs/reference/design-system/editor-shell-and-visual-system.md
docs/roadmap/README.md
docs/roadmap/p25-experience/README.md
docs/operations/current.md
prototypes/spatial-authoring/qa/EXPERIENCE-UX-EVIDENCE.md
docs/archive/roadmap/p25-experience/p25-unified-design/p23b-browser-report.json
docs/archive/roadmap/p25-experience/p25-unified-design/p23b-validation-result.json
apps/editor/src/lib/bench/record-baseline.ts
apps/editor/src/routes/dev/perf/p23b/+page.svelte
apps/editor/tests/lib/bench/p23b11-node-probe.cli.ts
apps/editor/tests/lib/bench/p23b6-release-delay-probe.cli.ts
apps/editor/tests/lib/bench/p23b6-s1-node-probe.cli.ts
apps/editor/tests/lib/bench/p23b6-s3-net-benefit-probe.cli.ts
apps/editor/tests/lib/editor/layout/p23b6-s2-behavior-retention.test.ts
apps/editor/tests/lib/editor/layout/p23b6-s3-prepared-generation.test.ts
apps/editor/tests/lib/editor/layout/p23b6-s3b-mesh-input-contract.test.ts
apps/editor/tests/lib/layout/p23b-fixture-contract.test.ts
apps/editor/tests/lib/layout/p23b11-correspondence-cases.ts
apps/editor/tests/lib/layout/p23b4-consumer-observations.test.ts
apps/editor/tests/lib/layout/p23b4-extent-pruning.test.ts
apps/editor/tests/lib/layout/p23b4-measurements.test.ts
apps/editor/tests/lib/layout/p23b4-pruning-differential.test.ts
apps/editor/tests/lib/layout/p23b4-sampling-reference.test.ts
apps/editor/tests/lib/layout/p23b4-shared-derivation.test.ts
apps/editor/tests/lib/layout/p23b5-preflight-scope.test.ts
```

```text
CLOSEOUT PRESERVATION — p25-unified-design (2026-10-13)
prose compacted:                 1   QA-record stub at its existing path
reference promotions:            2   PLATE + spatial-instrument grammar
renderable evidence archived:    2 files / 76,906 bytes (fresh browser/validation JSON)
evidence stubs / manifests:      1   this record routes both measurements
transient artifacts removed:     0   no active #114 checkpoint; task runtime released
historical anchor:               2d135d6e825772d07a0271fdf836f8e088b34a40
preservation tag:                closed/p25-unified-design (pushed to origin)
new live → archive prose links:  0
manual-owed verification rows:   0
remaining deferred items:        2 grouped carry-forwards (UX/3D depth; #115/F planning)
```

**Owner-directed preservation boundary:** original inactive UX3/V3, UX0–UX7 and
PA0–PA12 plan bodies, all prototype directories, V2 runtime/QA/captures and
accepted Paper rationale stay in place. They are independently useful retained
references; #114 does not reorganize those families. Only the spent UX execution
narrative is compacted into this stub; its exact full body remains recoverable.
Older closed slices and their evidence are untouched. The two newly archived
measurements are byte-unmodified copies, not replacements for historical data.

### Historical UX4–UX6 review follow-up

<a id="ux4ux6-review-follow-up-2026-10-12--the-five-implementation-review-findings"></a>

The earlier follow-up is functional/regression history, including Node 148/148,
a serial 26-axis pass, load-sensitive concurrent image readings and unrun mutation
chains. Its old post-UX7 visual gate is superseded. Exact details and the original
UX0–UX6 execution record are recovered from the anchor below; the retained
97-file disposition above remains the live discovery route.

### Exact recovery and post-merge verification (P1)

P1 requires **a merge commit**, preserving the accepted full body and its
ancestors. The annotated tag targets the body commit, not the compaction commit.
All earlier accepted/capture provenance anchors are verified ancestors of its
target. Recovery is already verified in this clone and the tag is on origin:

```sh
git show 2d135d6e825772d07a0271fdf836f8e088b34a40:prototypes/spatial-authoring/qa/EXPERIENCE-UX-EVIDENCE.md
git show closed/p25-unified-design:prototypes/spatial-authoring/qa/EXPERIENCE-UX-EVIDENCE.md
```

After the owner merges, synchronize `main` and perform the required anchor check
before declaring the post-merge workflow complete:

```sh
git fetch origin main --tags
git switch main
git pull --ff-only
git merge-base --is-ancestor 2d135d6e825772d07a0271fdf836f8e088b34a40 main
git merge-base --is-ancestor 2d135d6e825772d07a0271fdf836f8e088b34a40 'closed/p25-unified-design^{}'
git show 2d135d6e825772d07a0271fdf836f8e088b34a40:prototypes/spatial-authoring/qa/EXPERIENCE-UX-EVIDENCE.md | head -3
```
