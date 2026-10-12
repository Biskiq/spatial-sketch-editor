# Unified World and Experience Prototype QA

The prototype's acceptance lives beside its executable here, not in a design folder. Each script
owns its own static server for **this** checkout (an ephemeral port), waits for real readiness, and
**exits nonzero** when an assertion fails.

```sh
qa/run-all.sh              # every axis
qa/run-all.sh journey      # axis B: journeys A–F, one checkpoint per step
qa/run-all.sh interaction  # axis B: real pointer and keyboard paths
qa/run-all.sh flows        # axis B: peel, nested return, trail restore, knife, grid, reopen
qa/run-all.sh policy       # lifecycle: cancellation, identity vs target, neutral teardown
qa/run-all.sh shell        # the World shell's composition: one head, Index, Card, invoked Instrument
qa/run-all.sh precision    # stage S3: spatial tasks, in-place measurement, Precision
qa/run-all.sh browse       # stage S4: Browse/Search context, result verbs, the Details grammar
qa/run-all.sh repair       # stage S5: the unresolved reference, Repair, and Owner/Source/Reach
qa/run-all.sh lens         # stage S6: the lens, parked work, and World parking and refusal grammar
qa/run-all.sh experience   # stage S7: Experience wiring and the visitor's isolated preview
qa/run-all.sh experience-shell # PR #114 UX0/UX1: the shell's homes, the one Preview control and the Deck band
qa/run-all.sh locator      # PR #114 UX1: the one Preview menu and locator coverage by pointer and keyboard
qa/run-all.sh conformance  # V2 product journeys and visible Camera/Set/coordination geometry
qa/run-all.sh creator      # C9.1: standalone creator loop, domain preservation and compact reach
qa/run-all.sh composition  # C9.2/C9.3: composition execution and compact Guide
qa/run-all.sh revision     # C9.6: revision, removal, repair and provider capability loss
qa/run-all.sh rich         # C9.7: the rich example, the native Wall, retained choices and local coordination
qa/run-all.sh precision-c9 # C9.8: the precise Camera, its deliberate property depth and one live tape
qa/run-all.sh presenter    # C9.9: Experience topics, provenance, advisory outcomes and ungated navigation
qa/run-all.sh walkthrough  # shared Presenter: lens isolation and actual Q1–Q8 author workflow (also at 1024×700)
qa/run-all.sh walkthrough-demo # optional Next demonstrations Q1–Q8/A1–A10, cancellation, Preview and Undo
qa/run-all.sh visitor      # visitor controls, effects, Gates and isolation
qa/run-all.sh reconciliation # saved controls and narrow Guide/Card/precision/visitor
qa/run-all.sh continuity   # stage S8: both-directions parking, neutral Resume, Preview return, history
qa/run-all.sh responsive   # stage S7: viewport/DPR, keyboard controls and live reduced motion
qa/run-all.sh correctness  # numerical validators, summary history, nested parking and cancellation
qa/mutation-check.sh       # protected regressions on disposable copies (World, V2, C9.2/C9.3, UX1)
qa/composition-mutation-check.sh # C9 composition/runtime/walkthrough obligations (also chained by mutation-check)
qa/locator-mutation-check.sh # UX1: a second Preview entry, the restored Scene list, a locator without
                             # the Scene's subjects and a register without record flags (also chained)
qa/capture-baseline.sh     # regenerate qa/baseline.json (deliberate: the accepted baseline changed)
```

Requires `agent-browser` and `python3`. `QA_SHOT=0` skips captures; `QA_BASE=http://host:port` measures
an already-running copy instead of starting one; `QA_OUT` moves the captures.

The whole sweep (`qa/run-all.sh` with no axis) runs `QA_JOBS` axes at once — 3 by default, `QA_JOBS=1`
for strictly one at a time. The axes are CPU-bound in this harness (one CLI process per eval,
software-rendered pages), so the ceiling is cores, not patience: on an 8-core machine the same tree
measured **285 s at 1, 212 s at 2 and 174 s at 3, all green**, while **6 went slower (290 s) and
invented six failures**, every one of them a timing-sensitive reading (the image pass's idle-turn and
cache laws, a visitor caption, and the three Gate-completion reads this suite already documents as
load-sensitive). More browsers than cores costs wall clock *and* fabricates defects, so raise this
only with a measurement in hand.

Each axis is one browser session, torn down however its script ends — pass, failure or interrupt — and
no two axes ever share one: each session's name carries this run's token, so a second run (another
worktree, another agent) can never be read as this one's, and the sweep stops every axis it started if
the driver is interrupted. Because several axes run at once, each one's output is buffered and printed
as a block when it finishes, followed by an axis summary line per axis. Never fan a *single* axis into
sections that each open their own browser and server: every copy pays startup again and leaves the
machine slower for the run after it. Session lifecycle is owned by `.agents/skills/browser-hygiene`;
the batching and minimum-testing rules below are this harness's own.

Minimum testing: an axis asserts only what its stage can break, aims at seconds rather than tens of
minutes, and is run on its own while a stage is being built; the full set belongs to a checkpoint.
Inside an axis, one eval returns a block's whole JSON blob and the assertions compare it in bash, so an
assertion costs no browser round trip. If a run is dragging, cut checks — never let a suite run for
tens of minutes. The agent runs the axes: handing the command to the owner is not a substitute for a
run, and a slow suite is fixed by making it smaller and self-closing rather than by passing it on.

What the harness knows about keys, measured rather than assumed:

- `agent-browser press <printable key>` does not release the key: the page then receives thousands of
  keydowns a second, forever, so the key's command re-runs whenever the state changes (close a reading
  and watch it open again). `qa_press` therefore dispatches the keydown itself for a single-character
  key. Escape uses a focused dispatch after native Escape stalls. Repair reentry also exposed a
  retained native Enter accepting the next candidate, so `qa_press Enter` uses the same single
  focused keydown, uncanceled button activation and keyup. Tab/arrows retain native default
  behavior. Assertions/tolerances are unchanged.
- With a live knife aim on screen, `press` hangs for about 30 seconds and drops the key. Where that
  matters, `qa_key_dispatch` dispatches the keydown explicitly instead.
- A press can therefore also land after the eval that followed it, which is why key-driven assertions
  wait for the state the key should cause, and why the ordinary state a block depends on is established
  and then verified rather than assumed.
- What produces **no value at all** in an assertion is a command that hung or was dropped, not the
  number of evals: 220 plain evals in one session returned clean in 6 seconds. An empty result is a
  harness symptom; re-run the axis before reading it as a defect.

## What is observed

`window.__me.qa` (in `app/main.js`) reports, read-only:

| Probe | Meaning |
| --- | --- |
| `state()` | reading label, canonical selection, Undo/Redo depth and last label, Reveal, knife aim, session kind and parameters (`u`, `side`, `depth`, `ceilId`, `focusId`, parent, origin), crumbs, trail, requested camera, **realized** camera (eye, up, direction, FOV, distance, framing), fault count |
| `museum()` / `hash()` | the accepted fixture's source values and a stable digest of them |
| `realized()` | the camera as rendered, not as requested — the distinction parking and resizing must keep |
| `faultList()` / `clearFaults()` | every command error inside `anim.run`, every frame error and every page error |
| `idle()` | resolves when the command queue is empty |
| `render()` | draws one frame on demand. A backgrounded tab stops `requestAnimationFrame`, so waiting for frames would hang the harness; assertions about what is drawn ask for a frame instead |

## Baselines and tolerances

- `baseline.json` holds the fixture digest, the A–F step inventory and one checkpoint per presenter
  step. `journey-check.sh` compares each step against it. Regenerating it means the accepted
  baseline changed; there is no automatic overwrite.
- Numbers compare with an absolute tolerance of **0.002** (`check.py --tol`). Requested and realized
  camera framing are recorded to three decimals. Positions and source values compare exactly.
- The realized camera — eye, distance and frame height — is a function of the **stage rect**, which
  each checkpoint records (`stage`). A shell change that resizes the stage therefore moves those
  numbers without moving any behaviour, and re-baselining is how that is recorded. The S2 baseline
  was regenerated for exactly that reason: the fixture digest (`650e93c4`), the fixture itself, the
  step inventory and every semantic field (`kind`, `sel`, `session`, `crumbs`, `trail`, `undo`,
  `lastUndo`, `fov`, `dir`, `up`, `target`) were identical, and only the fit-dependent fields moved.
  The Instrument overlays the stage rather than taking layout space, so the stage rect is constant
  across all 50 checkpoints and invoking work cannot change the fit of a reading.
- B7–B9 preserve the originally unselected Section subject as null; only these three expectations changed during S8, independently protected by correctness parking checks.
- Raster equality is not a contract. **The written visual conformance review is a blocking acceptance
  gate**, and the active contract is the one the current PR is held to:
  - the locked design — [PLATE §0.8.1](../../../docs/reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)
    — owns the finalized Experience shell expression: visual roles, hierarchy and density;
  - the [#114 plan](../../../docs/roadmap/p25-experience/design/experience-v2-prototype/ux-pruning-and-shell-reconciliation-plan.md)
    §7 boards own this PR's written acceptance, slice by slice (QA 1–6, Camera precision and Global),
    and each shipped slice's evidence record ([EXPERIENCE-UX-EVIDENCE.md](./EXPERIENCE-UX-EVIDENCE.md))
    records the readings that carry its exit gate. Owner visual acceptance remains the PR's gate.

  Automated visibility, hit reachability and geometry assertions support that review; they do not
  substitute for it. Density, spatial instruments and semantic control hierarchy are not waivable as
  observational — through PLATE §0.8.1 and the §7 boards rather than through the superseded S-series
  level language, which survives only as history in
  [EXPERIENCE-ACCEPTANCE.md](./EXPERIENCE-ACCEPTANCE.md) and
  [EXPERIENCE-CONFORMANCE-ACCEPTANCE.md](./EXPERIENCE-CONFORMANCE-ACCEPTANCE.md). Those records keep
  their own verdicts and confer none on #114; the guide-specific part of the V2 board set is replaced
  by UX4's Guide Deck when that slice lands.

## Coverage limits (recorded, not hidden)

1. The A–F run proves 50 presenter steps against recorded checkpoints — reading, selection,
   parameters, Undo depth, crumbs and standpoint per step. It is not 50 independent proof cases for
   every spatial invariant; the invariants are asserted separately in `interaction-check.sh` and
   `flow-check.sh`.
2. Real gestures are covered where they carry a rule: handle drag and release, refusal rollback,
   typed values, Tab continuity, the peel, Plan and 3D drags, the knife slide, the reopen control.
   Pan/orbit/pinch feel, trackpad, touch and pen are not asserted here.
3. Keyboard proof includes search/selection/invocation, fields/refusal announcements, line definition, sheet focus/return, shortcut isolation, gap preview/cancel, Repair/Resume and unwind. Screen-reader listening and assistive-device/usability trials remain outside this prototype acceptance.
4. Responsive proof covers 1440×900, 1280×800, 1024×768 and DPR2 with canvas/picking agreement and unchanged realized pose/source.
5. Intermediate visuals (mid-peel, mid-lift, mid-cut) are captured on demand (`QA_SHOT=1`) and are
   evidence, not assertions.
6. Shell composition is asserted as geometry and inventory (what exists, where it sits, which verbs a
   subject offers), not as appearance: colour, type and spacing are the design system's business and
   are reviewed by eye. The World responsive axis measures narrow desktop and DPR2; reconciliation owns narrow Experience.
7. [Conformance manifest](./CONFORMANCE-MANIFEST.md) owns the new product recipes. Fresh captures,
   read-only state/source sidecars and full-board pairs live in `screens/experience-conformance/`;
   the [new conformance review](./EXPERIENCE-CONFORMANCE-ACCEPTANCE.md) owns their verdicts.
   `screens/experience-v2/` and [S0–S9 acceptance](./EXPERIENCE-ACCEPTANCE.md) remain historical;
   their prior pass labels confer no replacement acceptance.

## Files

| File | Role |
| --- | --- |
| `lib.sh` | server, readiness, decoded evals, real pointer helpers, assertion counters, fault observation, the Card-door hooks (`qa_card_*`) and the Scene subject's own door path (`qa_subject_operation` / `qa_subject_invoke`) |
| `check.py` | subset/baseline comparison with numeric tolerance; `--get` reads one value |
| `capture-baseline.sh` | writes `baseline.json` |
| `capture-experience-subject.sh` | evidence tool, not an axis: QA 5's Scene subject states at 1440×900 and 1024×768 — the Card at rest with both doors and no capability control, the chooser over the declared descriptors, the offer draft the interaction door opens with this subject as its target and activation, and the invoked operation with its audition and capture writers (brought into the Card's own view) — each capture paired with a reading of what was photographed |
| `capture-experience-views.sh` | evidence tool, not an axis: QA 3's Presentation/Views states at 1440×900 and 1024×768, each capture paired with a reading of what was photographed. The Advanced home is photographed as its **contents** at both sizes — expanded, all four sections read back from the captured state, its controls scrolled into the Card's view and hit-reachable there, native-Enter toggling proved on a focused summary and returned, and every control inside natively focusable |
| `journey-check.sh` | axis B presenter replay against the baseline |
| `interaction-check.sh` | axis B pointer/keyboard interaction wiring |
| `flow-check.sh` | axis B harvested flows and exact return |
| `policy-check.sh` | lifecycle: one cancellation policy, identity vs technical target, parking that keeps the realized camera |
| `shell-check.sh` | the World shell's composition: one search entry, the Index, the Card, the Instrument that takes no space, and a row's verb acting on the row's subject |
| `precision-check.sh` | stage S3: Look's three routes, the retained first gesture, in-place measurement, one active surface, Precision and its refusal, and a number reached where no handle is legible |
| `browse-check.sh` | stage S4: one bounded dense list with paging and an honest register, browse/context that never selects or moves, Select that changes identity only, Open location/Bring into view/Include/Reveal/Face each on the named record, and Details Expand/Focus/Select/Open task as four distinct effects |
| `repair-check.sh` | stage S5: the quiet rest warning for an unresolved reference, the locator that is never a host, Repair's explicit wall pick and declared station/height, the fixture's own refusals, one accepted edit with Undo/Redo moving the reference and not the view, canceled and left-unresolved work writing nothing, and Owner/Source/Reach as supported facts |
| `lens-check.sh` | World parking semantics, inactive teardown, neutral Resume, canonical/foreign identities, World/Search refusal grammar, target/selection revalidation and canceled World writers/aims; both-direction/Preview/history ownership is below |
| `experience-check.sh` | ordinary authoring, shared history, unordered Set, Guide/Seam, 2-of-3 coverage, Camera reach/detachment and stable coordination wiring |
| `experience-shell-check.sh` | PR #114 UX0/UX1: the shell's six homes exist once each and the visitor surface is hidden while authoring; the shell offers exactly one Preview control — the Head's `Preview ▾` menu, every scope inside it — and the menu closes behind the visit it starts; a Guide mounts exactly one Deck naming its own posture in one home; the band stays under 40 % of the viewport at 1440×900 and 1024×768, its heading stays hit-reachable at the same time as the Card's identity, nothing inside it scrolls and the document never scrolls sideways; opening a posture or an invoked sheet writes no source, history, selection or Camera intent and resizes no Stage; Preview hides every authoring home, offers exactly one Exit Preview and returns the exact context. Controls are addressed by `data-home`/`data-act` so #114's slices re-point a recipe instead of weakening it. UX2 adds the View preview's image pass: one idle turn draws the picture once from the Stage's own renderer with nothing left pending, a View already drawn is served from the session cache for no draw at all, the session cache is reported against its bound, the audited draw leaves source, history, selection, audition, standpoint, realized camera and the live camera object exactly as the selection left them (with the audition realized on the Stage, not merely remembered), the projection is a normal-World reading and the last draw is reported under the §3.6 ceiling, and a refused draw leaves a named reason, keeps the live page intact and is not retried every turn. UX2 review adds the Index painted-line law at both review sizes — no line of text painted over another, none leaving its own row or the column, measured as painted line boxes in the column at 1440×900 and in the invoked sheet at 1024×768 — and the two reading laws the pass owes a derivative picture: it is fogged at its own projection's eye distance rather than at the standpoint the author is standing at (with the two distances shown to really differ in that state, so the reading is never vacuous), and it is keyed on the World generation the history settles at rather than on the museum's object identity, so an accepted in-place World write re-draws the View instead of serving the picture of the world before it |
| `subject-mutation-check.sh` | UX3 replacement proof: a capability control rendered at rest, a door that invokes the first descriptor instead of opening the chooser, a door that authors a capture on the way in, a derived row that marks its Presentation as the selection, the derived reach promoted above `Present this`, and a chooser that offers a descriptor this Stage does not realize. Each is reintroduced in a disposable copy and the assertion that protects it must reject it; pass a leg name to re-run one (`qa/subject-mutation-check.sh door-writes`) |
| `views-mutation-check.sh` | UX2 replacement proof: aggregate Present that writes no View use or writes it as a visitor choice, a Plan reading captured without asking, the reviewed precedence defect restored (the recommended framing preferred over the reading the author chose), an unlink that takes two history steps, Set as Default written without the shared-use Ask, the retired `Present region` row restored beside the one creation entry, the constellation drawn at a projected standpoint with a leader and an origin square, a picture keyed on the museum's object identity alone, a picture fogged at the live camera's distance, an image drawn with the authoring treatment instead of a normal-World reading, and an image pass that never gives the live camera back. Each is reintroduced in a disposable copy and the assertion that protects it must reject it; pass a leg name to re-run one (`qa/views-mutation-check.sh image-cam`) |
| `locator-check.sh` | PR #114 UX1: exactly one Preview control (no entry outside the Head menu), the scopes that can really start, and the control absent rather than inert when none can; the retired Experience Index Scene list; `Browse World` opening the one locator at the whole museum; every formerly listed Scene subject reachable **by pointer** (its own Select) and **by keyboard** (ArrowDown to the row, Enter); one row per identity, deduplicated against the museum's own subjects; a logical subject marked as having no Stage geometry and offered Select alone; the records register never borrowing a Scene subject; selecting through the locator presenting nothing and writing nothing; and the World shell unchanged afterwards. Re-point every recipe that used the Index's Scene rows or the retired Deck/Stop-Card/Head Preview entries through `lib.sh`'s `qa_locator_*` and `qa_preview_*` helpers |
| `visitor-check.sh` | outside-product example/Presenter, visitor takeover, independent Piano, visible Switch → Light session effect, keyboard Gate parity, captions/cues, exploration/rejoin and frozen source/history |
| `continuity-check.sh` | both-direction parking, neutral Resume, canceled live framing drag, exact Preview/accepted-inspection return, interleaved history and inert World footer controls |
| `conformance-check.sh` | actual product journeys QA-1…6, no-View Preview, derived Auto/Capture, repeated Meaning scope, local entry, real observer routes and anchors, stable mirrored stations, shared route scope, spatial precision, neutral Resume/fresh return, Escape/lost capture, and the QA 5 Scene-subject readings (the Card's order, no capability control at rest, no Presentation looking selected, the chooser over exactly the declared descriptors operating nothing, the derived reach as references that open their owners, and the door writing nothing on the way to an operation); permitted authored source loaders only |
| `creator-check.sh` | C9.1 from a retained non-empty Camera baseline: Reset preserving World/Camera/history, the eight-action subject→explanation→Capture→operate→Use→Preview loop through real controls, update-not-duplicate, Escape cancellation, real-clock Preview and exact return, two labelled loads plus aggregate Undo, and compact 1024 controls |
| `composition-check.sh` | C9.2/C9.3: organization independent of activation/boundary, Hold and later-entry cue policy, fresh repeated-Stop visits, explicit cue/Gate block and release, opt-in View suggestions, transcript/captions, compact Peek Stop editing with advanced dwell/Gate, and direct Preview Guide |
| `revision-check.sh` | C9.6/J8: rename once, Duplicate as an independent identity, Make local/Link, a descriptor replacement that discloses its real reach and waits as one merged proposal, a local fork that leaves the linked original alone, removal that keeps definitions/Views/references repairable, provider profile gain/loss with a routed repair, and a declared-but-unrealized capability refused by every writer |
| `rich-check.sh` | C9.7: the loaded example's World Wall unroll through its own evaluator (advanced on the visitor's own clock, never on wall time), Return resuming without another Stop entry, an authored Hold whose duration is real, the station-only Activity that never arms on entry, a rebound invocation refused rather than run twice, the retained choice whose destination left with its Presentation, and its local repair/removal |
| `precision-c9-check.sh` | C9.8: the precise Camera's property depth — one live tape, every grip hit-testable on seats that do not cover each other, a declined draft that never stays on screen, and the Camera Card that owns the full list |
| `presenter-check.sh` | C9.9: eighteen topics with real predicates, explicit provenance, loaded content crediting no quickstart topic, a topic credited only by every outcome its own instruction authors on the moment it assesses (an explanation without the framing it asks for is not Q2, and a Capture on another moment never stands in for it), a visit ledger that opens with the Stop it entered and arrives only where the Camera arrives, a Travel credited for its own route's arrival even after ten destination View cues, a capability sequence credited for a handover that really began and the carried run the visitor stopped (a dependent the visit left behind is none), entry policies credited for every Stop Auto entered between readings, navigation that prepares nothing, and read-only guidance during Preview |
| `reconciliation-check.sh` | Head/Index/owner/reach, saved Stop controls/Undo and 1024×768 Guide/Card/precision/visitor reachability without Camera refit |
| `responsive-check.sh` | S7 viewport/DPR, sheet focus and pose stability, keyboard aim/fields/refusal, live OS reduced motion and identical endpoints |
| `correctness-check.sh` | remaining numerical and nested-lifecycle obligations, no duplicate broad shell suite |
| `mutation-check.sh` / `conformance-mutation-check.sh` / `composition-mutation-check.sh` / `locator-mutation-check.sh` / `views-mutation-check.sh` | same-defect replacement proof in disposable copies: World plus seven V2 boundaries and the C9 obligations, including the C9.6–C9.9 wiring — a silent merged rebind, an unrealized capability authored as visitor work, an unresolved choice followed before parking, any write crediting a quickstart topic, a visit ledger that opens without the Stop it entered, a topic charged for framing it never authored, any completed work crediting the capability sequence, configured entry kinds read as executed ones, and a destination read as arrived from the last View the Camera stood at, a topic charged for framing it never authored on the moment it assesses, a dependent the visit disarmed counted as a handover, an Auto visit's Stops invisible to the ledger, and a completed Travel lost to a cue the destination itself started, entry arrival evicted from a diagnostic window, Return mistaken for another entry, and narration completion credited as a capability handover. UX1 adds a second Preview entry restored in the Index, the retired Scene-subject column restored, a locator that stops listing the Scene's own subjects, a register whose records are no longer marked as register records, and a one-Preview-control rule that offers the control while it is inert. UX2 adds an aggregate Present that writes no View use or writes it as a visitor choice, a Plan reading captured without asking, a Plan door that saves the recommended framing instead of the reading it was asked for, an unlink that takes two history steps, a Set as Default written without the shared-use Ask, the retired `Present region` row restored beside the one creation entry, a constellation drawn at metric standpoints with leaders and an origin square, a picture keyed on the museum's object identity instead of the source's own generation, a picture fogged at the live camera's distance, an image drawn with the authoring treatment instead of a normal-World reading, and an image pass that never gives the live camera back. UX3 adds a capability control rendered at rest on a Scene subject's Card, a `+ Add behavior` door that invokes the first declared descriptor instead of opening its chooser, a door that authors a capture on the way in, a derived `Used in Experience` row that marks its Presentation as the current selection, that reach promoted above `Present this`, and a chooser that offers a descriptor this Stage does not realize |
| `run-all.sh` | the axis driver and the concurrent sweep: `QA_JOBS` axes at a time (default 3), each keeping its own browser session and ephemeral port, each buffered into one block plus a summary line |
