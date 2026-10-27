# E0 — Contextual spatial creation execution plan

**Status:** execution plan for review; documentation only. No prototype or study has run under this
plan. The owner has identified the T5 G0 reconciliation as ratified direction; this plan implements
its experiment brief, not a production authorization. E0 execution requires a subsequent instruction.

**Decision:** does selecting and reusing visible spatial context make a small creation-and-revision
job easier than competent explicit controls, without making consequences harder to understand?

**Bound:** one disposable application, two interaction conditions, two task fixtures, eight study
participants plus two excluded pilots, one technical fixture. Estimate **64 person-hours**, with
**12 additional hours maximum for one repair cycle**. Stop with a decision even if the result is
negative or inconclusive. Recruitment/calendar delays are reported separately.

## 1. Foundation and deliberate reductions

The controlling brief is [G0 reconciliation §10, pinned to its reviewed revision][g0-e0]. The source
PR is [#202][g0-pr]; it was still open when this plan was written. Pinning the source allows this
separate PR to target main without copying the reconciliation or implying that promotion has landed.
The user's ratification direction does not ratify the experiment's implementation, thresholds or UX.

Existing research supplies the questions, not results for this comparison:

| Input | Retain in E0 | Reduce or defer |
| --- | --- | --- |
| G0 §10.1 | Matched controls, unfamiliar transfer, irregular variation, return/repair, consequence prediction, eight mixed-experience creators | One task family with matched variants; no full modeling or exhibition application |
| G0 §10.2, first fixture | Shared guide → band + three members; detachment, missing support, Undo/new edit, copy and reopen | One analytic evaluator; no second engine or production integration |
| [Native creative depth proof agenda][proofs], P1/P3/P5 | Time partitioning, usefulness of retained source, identity and recovery falsifiers | No complete pavilion, family catalogue, railing/stair study or twelve-proof campaign |
| [Probe methods][methods] and [identity research][identity] | Matched output, independent oracles, measured boundary cost, no silent retargets | Earlier Node/kernel timings do not predict this browser workflow; no kernel tournament |
| [Native Form Lab findings][lab] and [Shape focus design][shape] | Inspect reusable numeric/interaction evidence before writing a small evaluator | Shape focus is design evidence, not a functioning shaping implementation; do not build it for E0 |

**The important simplification:** contextual and explicit conditions have identical continuing
relationships. Contextual selection may reduce setup and translation; it does not receive an
automation capability withheld from the baseline. A short following-off ablation separately tests
whether continuing relationships are worth their comprehension cost. E0 does not test freehand
recognition, so it cannot conclude that oversketching beats handles.

Two perpendicular contour edits, kept patches, negative-space fitting, bent precision parts,
cap/split references and alternative source encodings remain later questions from §10. They are
not prerequisites to finishing this experiment. Count 20→19→20 is unnecessary because E0 admits
three stable members and no count editing. These omissions limit conclusions, not Biskiq's ceiling.

## 2. Minimum working prototypes

Build **one local browser application with conditions C and E**, using the same renderer, evaluator,
fixtures, history, numerical inputs and study instrumentation. A condition switch is available to
the facilitator between tasks, never required within a task. Use neutral condition names in sessions.
Working geometry, direct manipulation and live bindings are required; click-through screens and
scripted animations cannot pass the experiment.

### 2.1 Shared capability envelope

- One floor plane and simple raised context objects; plan and oblique views with the same navigation
  in both conditions. No production Camera, Stage or shell reconstruction.
- One open planar guide with 3–6 keyed points, created by point clicks or borrowed from a visible
  fixture path. Drag points or enter coordinates. No drawing skill or freehand recognition required.
- One constant-width, constant-height band generated along that guide. Width and height are editable
  numerically and through handles. Use a rectangular cross-section; no fillets, cuts or materials UI.
- Three distinguishable primitives arranged at chosen start/end distances along the same guide,
  evenly spaced by arc length and oriented along it. Include one free object as a negative control.
- A visible support marker can drive the guide's first point. Selecting a marker alone never binds
  it. Both conditions require deliberate following and show its state; solve-once is the default.
- A member can stop following and retain its current pose; subsequent guide edits leave it alone.
  Relink is explicit. No implicit attachment, inference solver or automatically remembered snap.
- Move a support, edit a guide, change width/height/range, detach one member, Undo/Redo, save a local
  experiment file, reload, diagnose a missing source and explicitly repair it. Save means actual
  disk export/import or an equally demonstrable cold-reload path, not retaining JavaScript state.
- A personally chosen irregular guide and local exception must be possible within this envelope.
  No preset chooser or pre-recorded final geometry substitutes for participant authorship.

Working limits: coordinates within a 10 m square; segments ≥0.25 m; width 0.10–0.40 m; height
0.10–1.20 m. Use mitered offset joins limited to four times the half-width and reject self-crossing,
overlapping or degenerate bands. An invalid drag keeps the last accepted result, displays the draft
and explains refusal. Both conditions use exactly the same validity checks. Freeze valid study
fixtures during calibration; a task must never require an inadmissible shape.

These are experiment limits, not product requirements. Start with plain TypeScript and the existing
prototype rendering dependency if readily reusable. Inspect donors for at most two hours, then use
the smallest isolated scaffold. No new geometry dependency, WASM, worker pipeline, server, AI,
general constraint system, plugin framework or production persistence adapter is needed.

### 2.2 What differs between conditions

| Action | C — contextual | E — competent explicit controls |
| --- | --- | --- |
| Start a band | Select/draw visible guide, choose the nearby Band action, adjust visible width/height | Choose Band, select/draw its guide through a persistent labeled source field, adjust the same width/height controls |
| Arrange primitives | Select primitives and visible guide, choose Arrange along, adjust range in place | Choose Arrange along from a discoverable panel, select primitives and source guide, adjust the same range controls |
| Reuse context | Selected guide remains visible and available to another consumer; current selection is previewed | Previously created guide is directly selectable by name or in the viewport; no redraw or duplicate setup is forced |
| Follow a support/source | An in-place control names the source and affected subjects | A labeled panel control names the same source and affected subjects |
| Revise or detach | Select result; show relevant guide, local handle and following state | Select result; show its source, same local handle and following state in the panel |

Both get clear selection highlights, the same controls and defaults, keyboard equivalents, snapping,
numeric accuracy, cancel, Undo and useful error messages. Neither requires graph knowledge. Do not
intentionally add clicks, hide source reuse or remove viewport picking from E. The difference is
where context is acquired and carried between actions, not whether one interface has good shortcuts.
C may reveal no advantage over a good E; that is a useful outcome.

**Baseline adequacy check before participants:** a spatial-tool practitioner completes the entire
task in E, checks discoverability and source reuse, and suggests the most obvious missing shortcut.
Fix parity defects in both conditions within the build allowance. Record the walkthrough and the
capability matrix. If parity cannot be achieved within the cap, stop as an invalid comparison.

### 2.3 Disposable state and construction rules

The implementation needs only fixture/source IDs with lifetimes, guide points in an explicit frame,
band dimensions, member IDs/positions, explicit bindings and a revision counter. Generated meshes,
selection and live previews are rebuildable. A tiny snapshot history and experiment-only JSON are
acceptable shortcuts; record them as such. They do not choose Biskiq's source format or history.

Every accepted edit is one history step; cancel changes none. An outstanding candidate carries its
starting revision and is rejected after Undo, another edit or project replacement. A synchronous
implementation can exercise stale-candidate handling through a test-only delayed completion; do not
build workers to simulate a production architecture. Store the chosen source explicitly, never a
nearest-object query that may silently find something else later.

For this experiment only, a support binding stores an endpoint offset in the floor frame; moving
the support changes that endpoint and leaves other authored guide points alone. For guide length L
and start/end margins a/b, the three member distances are a, (a + L − b)/2 and L − b. Refuse L ≤ a+b;
use the outgoing segment tangent at an exact interior corner. Detach captures the member's world
pose. A missing support leaves its last accepted endpoint coordinates intact, marks the binding
unresolved and blocks edits through that binding; unrelated edits remain available. Repair picks a
new support and previews the new endpoint, or breaks following while keeping the last pose. Both
interfaces expose identical choices. This supplies executable behavior without a general solver.

Keep the eventual experiment outside production apps/packages and root npm workspaces, following
the [prototype boundary][prototype-boundary]. Preserve the runnable revision and anonymized evidence
for reproducibility, with a disposal note. Retention does not imply that prototype code is reusable
production infrastructure. No runnable files are created by this planning PR.

## 3. Comparative tasks and protocol

### 3.1 Fixtures and exact task cards

Prepare variants A and B with the same primitives, numeric demands and number of actions. B rotates
or mirrors the layout and changes labels; do not merely replay A from memory. Each has a supplied
support marker and a path outside a central object. The tasks specify outcomes, never a prescribed
tool sequence. Use this frozen card template, changing only fixture coordinates and names:

| Card | Participant instruction and success check | Time cap per condition |
| --- | --- | --- |
| T1 — compose and revise | Make a display band 0.20 m wide and 0.60 m high along the supplied path. Arrange three stands over its usable range, 0.30 m from each end. Make the band and stands follow future path changes. Move the support marker by 0.50 m in the marked direction so the path start follows. Keep the free sculpture still. Detach the middle stand and move it 0.25 m outward; change one guide point and keep that exception still. | 10 min |
| T2 — unfamiliar transfer | Around a differently placed table in a fresh scene, create your own 3–6 point guide, make a low band and arrange the three markers with 0.50 m end margins. Choose the width/height within the envelope. Move a different guide point; retain one deliberately independent marker. No demonstration of this scene. | 6 min |
| T3 — creative variation | State one intended irregular change before acting: for example, unequal bends, an asymmetric route or an independently oriented stand. Make your own choice and say whether the result realizes it. The original width/height and intended following behavior must still hold. | 3 min |
| T4 — delayed return and repair | Reopen your saved T1 work after 24–72 hours. Before editing, predict which subjects move when the support moves, and whether the detached stand moves when the guide changes. Perform both edits. The facilitator then loads a copy with the support removed; explain the diagnostic and repair by choosing a replacement source or deliberately breaking that relation. | 6 min |

Initial T1-A geometry: floor coordinates in metres, path (−2,−1) → (−2,1) → (2,1), support at
the first point, and a 0.7 m square free sculpture centered at (0,0). Supply three 0.15 m square
stand primitives beside the path. The support revision vector is (−0.50,0); the later guide edit
moves its middle point by (−0.25,0); the stand exception uses the outward normal at its position.
T1-B applies (x,z) → (z+0.5,x−0.5) to all positions and the corresponding linear transform to
directions. T2 starts with a 2 m × 1 m table at the origin and unarranged markers, without a guide;
the participant chooses a route around at least two sides without intersecting the table. Its B
variant uses the same transform. The participant selects a 0.25 m guide-point revision inside the
valid envelope. T3 uses the participant's T2 output. Test these fixtures before freezing; if an
ordinary target is invalid, correct both matched variants during calibration, not during the study.

Before each prediction, record the participant's answer; do not teach it by executing first. The two
prediction questions test support→guide→consumers and the detached exception. A correct answer must
include the stationary free object/exception, not just name something that moves.

Completion requires the requested subjects, dimensions and relationships to be correct, within
10 mm for requested positions/dimensions and 1° for requested orientation, plus participant approval.
The evaluator's technical tolerance is tighter (§4). Save task snapshots so correctness can be checked
without trusting a participant's confidence. Unsupported extra ambitions are recorded separately
from task failure; repeated inability to express an ordinary chosen variation is evidence against
the scope. No aesthetic rating is used to disguise numerical errors or enforce a preferred style.

### 3.2 Participants, order and assistance

Recruit eight people who actually create spatial presentations, exhibits, interiors or comparable
work: four with little regular modeling-tool use and four with regular modeling experience. Record
tools/frequency, mouse/trackpad use and drawing confidence. Do not recruit only fluent sketchers or
use the implementer as a study participant. Two additional pilot participants are excluded from the
eight. If recruitment falls short, label the result incomplete; never silently lower the denominator.

Within each experience group, assign one person to each sequence: C-A then E-B; E-A then C-B;
C-B then E-A; E-B then C-A. Give equal six-minute onboarding immediately before each condition,
using a separate miniature fixture. Teach every admitted capability, including following and repair,
but do not walk through the measured tasks. Report first-condition outcomes separately to expose
learning transfer. In the return session, reverse each person's condition order.

Main session: 5 min introduction, 2 × (6 min training + 19 min tasks), 4 min ablation, 6 min debrief
= **65 minutes**. Return: 2 × 6 min T4 + 3 min debrief = **15 minutes**. Permit a break outside timing.
Use the same study machine/input device across paired conditions; note deviations.

No concurrent think-aloud during timed tasks: it distorts timing. Ask short retrospective questions
after the clock stops. The facilitator may repeat the outcome card but cannot suggest a tool. A
requested procedural hint or intervention is logged as rescue and makes that task an unassisted
failure, even if the participant then finishes. Stop at the cap; record incomplete work and use the
cap in the time summary, rather than dropping slower people. Log equipment failures separately.

### 3.3 Minimal ablation and current-tool check

After the main tasks, use two matched saved scenes in C. Ask for one guide revision with following
on, and a matched revision with following off (explicitly disclosed); restore the intended band and
stand arrangement. Allow two minutes each, alternating order across participants. With following off,
the same source controls allow manual refresh of each consumer; do not remove useful controls.
This tests saved rework versus the cost of understanding persistence. It is diagnostic, not part of
the primary pass metric, and cannot repair a failed C-versus-E comparison.

Within the effort cap, ask two experienced participants/practitioners to demonstrate T1 in their
current relevant editor, using the retained-path/repetition features and normal extensions they
already use. Allow preparation and record it separately; record tool/version, starting assets,
workarounds, fidelity and the full revision sequence. Cap this collection at two staff-hours; use a
screen recording if scheduling is easier. Do not build a third prototype or learn a new product for
them. This is a qualitative reality check, not a controlled cross-tool speed ranking. If unavailable,
state **competitive differentiation untested**; core E0 can still decide C versus E. No broad novelty
or competitive-superiority claim follows from eight participants or these demonstrations.

## 4. Technical feasibility checks

One technical fixture exercises the same code as both interfaces. The three members have explicit
stable IDs; detach preserves ID and pose, copy remints IDs and internal bindings while preserving
geometry. No face topology references, arbitrary imported geometry or cross-domain lifecycle exists.

| Check | Procedure and evidence | Required result |
| --- | --- | --- |
| Matched geometry and validity | Feed identical captured inputs through C/E; compare source values, generated coordinates, band dimensions and member transforms. Use independent straight/right-angle examples, cumulative segment-length calculations and signed-area/intersection checks rather than calling the evaluator as its own oracle. | Same semantics; finite nondegenerate output, no unreported self-intersection; ≤1 mm geometric residual and ≤0.1° orientation residual on the bounded fixtures |
| Ordinary revision and exceptions | Script 100 fixed-size edits: guide/support moves, dimension/range changes, detachment, Undo/Redo, Undo then new edit. Check at 20/50/100 and repeat from the same initial state. | Stable live IDs; detached/free objects unchanged; source and geometry reproducible; exactly one history entry per accepted edit |
| Broken source and replacement | Remove support, create a lookalike with a new lifetime, attempt revision, then repair deliberately. Undo removal separately. | Missing source diagnosed; never silently bind to the lookalike. Correct refusal is not corruption. Explicit repair/Undo restores intended behavior |
| Copy and cold reopen | Copy the connected group with reminted keys; test isolation. Export accepted source, close/reload with all generated caches discarded, regenerate, continue editing. | Copy geometry preserved; no cross-copy binding. Reopened subjects, exception and following states equivalent; generated geometry not required to recover |
| Cancel and stale completion | Cancel a valid and invalid drag; delay a candidate, then Undo/new edit or load another file before delivering it. | No accepted change from cancel or stale candidate; no stale visual presented as accepted work |
| Cost and retention | Measure input-to-matching-presented-preview and commit/Undo-to-frame, cold reopen, frame times and retained source/history/buffers during repeated fixed-size runs. | Meets the provisional study-readiness envelope below, or is repaired/stopped; no hidden truncation or baking |

Use one designated ordinary laptop for the study; record hardware, RAM, OS, browser version, display,
power mode and input device. Run correctness in its Chromium browser plus one independent browser
engine. Add one alternate CPU architecture only if available within the six-hour QA allocation;
otherwise record untested. Compare geometry within tolerance, not floating-point byte identity;
identity/relationship mismatches must be zero. This is not platform certification.

**Provisional study-readiness envelope:** p95 input-to-matching preview ≤50 ms; p95 commit/Undo to
matching result ≤100 ms; cold fixture reopen ≤2 s. For each condition, perform one warm-up and three
100-edit runs with identical captured input; report run-level p50/p95/max and all failures. Do not
time only the generator or count input acknowledgment as a rendered result. Attribute the rendered
revision and sample presentation at the next frame, disclosing that this is a browser proxy, not a
hardware display-latency measurement. Use the same recording overhead in both conditions.

After the history cap of 100 accepted edits, run five additional 100-edit batches with fixed authored
size. Source size, history count and live geometry-buffer count must stay bounded. Record retained
heap after comparable idle periods, and controlled collection where the browser exposes it; investigate
monotonic retained growth, do not treat noisy heap samples as proof of a leak or a plateau. The source/
buffer accounting must explain retention. No full production benchmark, scale sweep or statistical
performance certification is required. The [product performance contract][performance] remains owned
elsewhere; E0's small-scene thresholds do not amend it or establish an R1 budget.

Any silent retarget, lost accepted work, incorrect save/reopen, accepted invalid geometry or stale
commit blocks participant collection until fixed. Preserve the failing input. A reproducible fidelity
or latency asymmetry also blocks comparison; a renderer defect must not masquerade as a UX result.

## 5. Evidence collection and analysis

Freeze the task cards, fixture data, build hash, assignment table, metric definitions, thresholds and
known limitations after the two pilots and **before** the eight-person study. Pilots may correct
instructions, time caps and defects within the bound; record changes. Later changes require a new
build/cohort label and invalidate pooling affected trials. Do not move thresholds after seeing results.

Minimum evidence bundle (created during execution, not by this PR):

| Artifact | Required contents |
| --- | --- |
| Run manifest | Plan/build revision, dependency versions, fixture seeds/data, participant pseudonyms/experience strata, condition order, machine/browser, known deviations, baseline adequacy walkthrough |
| Event log and task sheet | Session/condition/task, monotonic timestamp, action, source ID/lifetime/revision, draft/accept/cancel/refuse/Undo/save/load, presented revision, task start/end, timeout, hint/rescue, intended/observed consequence |
| Captures and authored outputs | Consented screen recording and saved initial/final/intermediate states for T1–T4; participant's stated variation, abandoned intentions, approval and two predictions recorded before action |
| Technical results | Captured lifecycle inputs, oracle residuals, failures/refusals, repeated timing summaries, retention counts and limitations; commands sufficient to reproduce |
| Results table and decision | Every participant and experience group, both conditions, paired differences, order effects, failures, ablation/current-editor evidence, conclusion and smallest justified next question |

Use pseudonyms in shared evidence; obtain consent for recordings and store contact details separately.
Commit de-identified task data/results; retain identifiable recordings privately with the agreed
access/deletion terms. Missing recording consent is not a task failure; use timestamped observation
and mark reduced coding confidence.

Partition task time into mutually exclusive categories: navigation/selection; preparation (creating
or identifying source/controls); initial result editing; correction of interpretation or unintended
change; requested revision/manual rework; broken-relation repair; waiting; help. Define examples in
the codebook and code from recordings plus events. **Preparation + manual rework** is the primary
cost metric; correction is reported separately so it cannot be hidden in savings. Report total elapsed
time, all category times, success, rescue, unintended accepted changes and fidelity alongside it.
Have a second person spot-code two paired sessions if available; otherwise repeat-code those sessions
later, record disagreements and label the lack of independent coding. Do not commission a research
team to complete the pilot.

For T1+T2 per participant, compute paired saving as (E preparation/rework − C preparation/rework) /
E preparation/rework. If E's value is zero, that pair supplies no percentage and is reported in seconds;
require at least six computable pairs for the percentage decision. Also report capped total time for
all eight, and completed-pair results separately. Failed/time-capped tasks cannot establish a positive
time advantage. Show all eight rows and group medians; no significance or population estimate is claimed.

## 6. Acceptance, decisions and stopping conditions

Separate **a valid completed experiment** from **support for the contextual hypothesis**. E0 succeeds
as research when it produces a bounded, reproducible decision; a negative result is not a reason to
keep adding capabilities.

### 6.1 Ready to run and complete

Ready to run: both conditions complete every card, baseline adequacy is documented, technical blockers
are zero, timings fit the envelope, two pilots establish that the cards are understandable, and the
protocol/evidence capture is frozen. All must hold before measured participant sessions.

Complete: eight paired main sessions and return sessions, lifecycle evidence, all exclusions/deviations
and a decision report. If return visits or essential evidence are missing at the cap, close as
**inconclusive**, identifying the exact missing decision. Do not present short-session performance as
proof of dependable return or long creative sessions.

### 6.2 Provisional decision thresholds

These operationalize G0's six-of-eight and approximately 25% proposal. They are pilot selection rules,
not ratified product requirements or validated effect sizes.

Recommend further investigation of C only if all of the following hold:

1. At least 6/8 complete **both T1 and T2 in C without rescue**, including at least 3/4 in each
   experience group. Completion cannot be lower than E by more than one participant.
2. At least 6/8 predict **both** T4 consequences correctly before acting, and complete return/repair
   without rescue; include at least 3/4 in each experience group. Report E identically.
3. Median paired preparation/rework saving on completed T1+T2 pairs is **≥25%**, with at least six
   computable successful pairs. Median capped total time in C is no more than **10% worse** than E;
   neither experience group's total-time median may be more than 10% worse. Report order effects;
   an advantage present only after prior exposure to E is inconclusive for initial learnability.
4. C has no more rescue cases than E, no larger median interpretation-correction time, and no more
   unintended accepted changes in aggregate. Every declared completed output meets the same fidelity
   checks. Any silent data loss or retarget blocks a positive recommendation regardless of averages.
5. At least 6/8 realize their stated T3 variation within the envelope without rescue. Report the actual
   differences and abandoned intentions; do not require stylistic diversity or generalize this tiny
   shape vocabulary into proof of unrestricted expression.

| Finding | Decision |
| --- | --- |
| C meets the thresholds with stable lifecycle evidence | Retain the demonstrated contextual actions for the next planning decision. Name the minimum behaviors/source facts required, not a persisted schema or committed R1 scope |
| C/E differences are small; both are understandable | Prefer the simpler explicit interface. Retain only specific contextual shortcuts with observed benefit; do not call equivalence a novelty win |
| Following ablation helps but C fails against E | Retain evidence for explicit relationships; reject the claim that contextual acquisition itself is established |
| C is faster but following/prediction/repair fails | Do not advance the combined workflow. One bounded simplification may test solve-once or clearer explicit controls; no solver expansion |
| Both conditions struggle or chosen variations repeatedly hit the envelope | Record the unmet job and narrow/reconsider the proposed first consumer. Do not infer that a bigger geometry engine will solve it |
| Missing evidence, parity defects, strong order effects or device limits | Inconclusive with named limits; no production authorization |

Preference is supplementary. If six people like C but the behavioral criteria fail, it does not pass.
A positive E0 result authorizes no implementation slice, production API, schema, kernel choice or
R1 deliverable. Its handoff recommends the smallest next consumer hypothesis and what remains open.

### 6.3 Stop rules

- Stop building at 20 implementation hours if the core card cannot run in both conditions. Record
  the missing behavior/cost; do not extend the experiment into an engine project.
- Pause data collection on lost work, retargeting, incorrect acceptance, parity drift or a recurring
  blocker. Mark affected trials invalid; never silently patch mid-study and pool results.
- Allow **one repair cycle, at most 12 staff-hours total**, only for a specific correctable defect or
  a narrowly isolated interaction ambiguity. This includes rechecking, at most two fresh exploratory
  participant sessions and analysis. Those sessions cannot replace the frozen eight-person decision
  or establish a new positive threshold result; a fresh full cohort needs a separate commission.
- Stop at **76 total staff-hours**. If the blocker remains after the repair cycle, close as
  inconclusive immediately; if fixed, only the already planned steps may continue within the cap.
  No automatic second study, kernel adoption, extra prototype condition or wider task family.
- If the comparator is already adequate and the result is negative, finish the decision report.
  Do not consume the repair allowance merely to seek a positive result.

## 7. Execution sequence and effort

One implementer/research lead can execute this plan, with short practitioner/owner reviews. Roles
describe responsibilities, not a request for parallel agents. A person-day here is eight focused hours.

| Step | Deliverable and exit check | Staff-hours | Dependency |
| --- | --- | ---: | --- |
| 1. Freeze scope and prepare | Confirm task relevance with two target creators/practitioners; recruit/book 8+2 and returns; set task cards, two fixtures, baseline matrix, evidence templates. Stop if the job is irrelevant to both reviewers | 6 | Later instruction to execute E0 |
| 2. Build the shared experiment | Both interfaces, common analytic geometry, binding/exception, snapshot Undo, local save/reload, logs. Donor inspection ≤2 h is included. Both T1/T2 executable by the implementer | 20 | Step 1; no production dependency |
| 3. Qualify and pilot | Lifecycle/oracles/performance/retention 6 h; two pilot sessions and baseline adequacy review 4 h. Freeze build/protocol or stop | 10 | Step 2; recruitment can proceed alongside building |
| 4. Collect | Eight 65-min sessions and eight 15-min returns, plus ≤2 h current-tool collection and scheduling notes | 13 | Step 3; 24–72 h between each person's visits |
| 5. Analyze | Code time categories, check output fidelity and variation, prepare individual/stratum tables, inspect order effects and ablation | 10 | Step 4; code completed sessions as they arrive |
| 6. Decide and close | Concise decision, evidence links, limitations, prototype shortcuts, cost ledger and disposal/retention note; owner review of conclusion | 5 | Step 5 |
| Contingency | One explicitly justified repair/recheck cycle; never automatic | ≤12 | Stop rules in §6.3 |

**Total: 64 h expected / 76 h hard ceiling** (8 / 9.5 person-days), plus participant time and
recruitment lead time. Rough calendar expectation is two to three weeks with participants prebooked;
availability can extend elapsed time without extending the work allowance. No paid recruitment or
external spending is assumed. If needed, resolve that resourcing before execution.

The 20-hour build allowance is the earliest feasibility test. Do not spend the analysis reserve
finishing an oversized prototype. A lower-cost paper pilot can reject unclear wording early, but cannot
replace working-geometry evidence. Existing review/test requirements apply to the eventual prototype
PR; this estimate does not assert that production integration or conformance testing is included.

## 8. Required closeout and open decisions

The decision report should be short: one recommendation (C, E, a specifically supported subset, or
inconclusive), a table against §6.2, individual/group outcomes, failures and technical envelope, actual
effort and the next smallest justified question. Link the frozen evidence rather than rewriting the
architecture. Explicitly distinguish observed facts, interpretation and remaining hypotheses.

Leave open: final gesture grammar; production source encoding; domain API/package boundaries;
Stage/F4/Camera integration; broader member lifetime rules; contour and negative-space mechanisms;
kernel/language/runtime placement; supported platform scale; R1 scope, slices, dependencies and
release. An experiment shortcut must not settle any of these by becoming convenient code.

This documentation PR adds only this plan and a navigation link. It does not implement E0, register
a phase or slice, amend a gate/release list, change a live baton, promote a reference contract or
expand the G0 architecture review.

[g0-e0]: https://github.com/Biskiq/spatial-sketch-editor/blob/f1a3cf553a5bba26c5bbdbe3761cf234ece1f938/docs/roadmap/t5-expressive-geometry/g0-reconciled-proposal/README.md#10-earliest-evidence-earn-the-workflow-and-the-architecture-together
[g0-pr]: https://github.com/Biskiq/spatial-sketch-editor/pull/202
[proofs]: ../../../broad-research/native-creative-depth/proof-agenda.md
[methods]: ../../../broad-research/native-creative-depth/probe-methods.md
[identity]: ../../../broad-research/native-creative-depth/geometry-identity-and-performance.md#5-identity-and-correspondence
[lab]: ../../../prototypes/native-form-lab/FINDINGS.md
[shape]: ../../../prototypes/native-object-shaping/README.md
[prototype-boundary]: ../../../prototypes/README.md#boundary
[performance]: ../../reference/components/performance.md
