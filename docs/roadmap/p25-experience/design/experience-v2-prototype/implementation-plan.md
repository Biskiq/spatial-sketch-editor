# Experience V2 unified prototype — implementation plan (#113)

**Status:** plan ready; implementation not started. The owner requested plan-only
completion on 2026-10-03. This is prototype work only. It satisfies no production
F/T gate and closes no major phase.

**Goal:** replace the read-only Experience bridge in the accepted World executable
with the finalized V2 Experience authoring and visitor execution, and prove real
World ↔ Experience continuity through the shared Stage, selection, navigation,
cancellation and source-history seams.

**Authority:** [PLATE §§0.8–0.8.2](../../../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)
owns shell design; [final V2 synthesis](../../../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md)
retains design rationale and canonical specimens. [Architecture](../../../../reference/architecture.md)
and [F](../../../../reference/composition-execution.md) own domain concerns.
The [4.1 plan](../../../../../prototypes/experience-authoring/PROTOTYPE_4_1_PLAN.md)
and donor tests are harvest material. [Test doctrine](../../../../../apps/editor/tests/README.md)
owns verification and replacement proof.

**Sequence:** #112 (merged) → #113 → Paper PA0–PA12 in the next PR → prototype
detour closes → F exact-interface amendments → T1/T2/T3/T4.

**Scope:** prototype-local native ESM/DOM modules, fixture subjects, tests and
routed documentation. No production formats, package extraction, framework
migration, root workspace change, route search, collision planner, general scheduler,
scripting, media platform, general Presentation fork, or Paper adoption.

**Starting point:** clean checkout at `e9ebe60a8f7026f8d0279787fb1a1ddba66d8ba1`
(merged #112). The donor retains its runnable shell as a regression oracle.

## Executable topology

Use `prototypes/spatial-authoring/` as the unified #113 executable. It already owns the functioning World shell, Stage, canonical selection, navigation, cancellation, history and parking seams. Moving these into either other folder would add migration risk without improving the prototype.

| Location | Role after #113 |
|---|---|
| `prototypes/spatial-authoring/` | One World ↔ Experience executable, one entry point, shared Stage and source/session authorities. |
| `prototypes/experience-authoring/` | Retained runnable regression oracle and implementation donor. Its shell is historical evidence. |
| `prototypes/integrated-experience-authoring/` | Finalized V2 synthesis and visual QA record. No third application. |

Correct the prototype index’s stale statement that the integrated design folder is the future executable home.

Keep #112’s native ESM/DOM implementation and vendored Three renderer. Adapt the donor’s small pure model/runtime/planning functions into prototype-local modules; do not mount its React application or renderer inside the World shell. Preserve algorithms and tests through that adaptation. No framework migration, root workspace change, iframe pairing or production-package extraction is needed.

## Harvest and reconciliation

| Disposition | Material |
|---|---|
| Retain | Plain authored data versus pure runtime transitions; stable definition/use/occurrence identities; Presentation/Guide independence; no-Guide execution; capability-driven controls; separate activation and invocation targets; explicit reuse and local/shared edits; structural editing; repair; narration/caption/cue synchronization; Auto pacing; explicit Gates; exploration/rejoin; Cancel/Finish/Continue behavior; source isolation; coalesced Undo; observational Presenter. |
| Replace | Encounter inspector and permanent Guide strip; old application mode switching; remembered subject selections; selection-triggered Camera movement; standalone Experience topology; old shell-integration exclusion; render-owned visitor tween; automatic missing-View conversion to “Keep current viewpoint.” |
| Reconcile further | The current donor includes V1.1 `viewOrder`, `orderedViews`, and entry-from-first-ordered-View behavior, beyond the 4.1 plan. V2 replaces this with an unordered Set and explicit entry/cue/choice roles. Preserve cue-driven presentation, not filmstrip order or implicit entry-by-array-position. |
| Newly implement | Final Head/Index/Stage/Card/Deck; Scale × Depth; unordered Set; Peek/Overview/expanded occurrence; Seam and multi-origin reachability; Camera routes/stations; coordination; progressive Camera precision; Ask Rule; full visitor takeover and exact authoring return; two-way procedure parking and continuity. |

Three donor shortcuts require explicit correction under newer authority:

- **Runtime identity:** activity maps and override ownership currently lean on authored-use IDs. Introduce session visit/run tokens so stale completions cannot affect later invocations. Changing Views within a visit does not restart it; entering another Stop is a distinct occurrence visit even when it references the same Presentation.
- **Channel replacement:** preserve visitor Stop and supported replacement behavior through declared fixture capability policies. Do not promote unrestricted “last command wins” into a general conflict rule.
- **Repair:** missing framing remains unresolved and repairable. “Keep current viewpoint” is an explicit choice, not a silent deletion fallback.

## Ownership and source transactions

- `S.sel` remains the only canonical authoring selection. Extend its identity resolution to Camera and Experience subjects; never introduce lens-specific selections. Context, task target, hover and expanded occurrence are separate from selection.
- Preserve the existing museum fixture and architectural evaluator. Add donor capability subjects to the same Stage through Scene-owned fixture data. Experience references existing World identities, including the actual Garden window, rather than copying subjects into an Experience world.
- Extend the existing source transaction/history seam to include Camera and Experience source alongside existing World source. Domain ownership remains distinct; the aggregate snapshot is only prototype coordination, not a proposed persisted document.
- One accepted command produces one source-history step, including explicit detach-and-retarget operations. Cancellation produces none. Undo never restores Camera standpoint.
- `navigation.js` remains the Camera/navigation entry point. Consolidate reusable framing, duration and route evaluation beneath it. The donor runtime requests movement and consumes Camera results; it must not retain an independently evaluated pose/FOV tween.
- Preserve #112’s specialized World navigation profiles. “One authority” does not require one interpolation kind.
- For bounded route proof, support explicit directed Camera connections with interior anchors and generated View endpoints. A piecewise-linear evaluator is sufficient; route search, collision planning and production curve design are out of scope. Estimates and execution use the same evaluator.
- Guide order stays Experience-owned. Seam UI derives adjacent occurrence bookends; it stores no competing order chain. Cut creates no Camera edge. Travel resolves supported Camera connectivity or reports a gap.
- Coordination references Camera stations—departure, stable anchor, arrival, supported named marker. Experience owns beats and holds. Generated samples are never authored station identities; the temporal strip cannot edit path geometry.

## Neutral Resume

`resumeParked()` re-enters World readings through `openSession()`. It establishes a fresh return origin, but the current code still animates toward the reading’s home. Existing lens QA mainly proves the fresh origin and subsequent Put-it-back return.

For #113’s required contract, Resume must reactivate a revalidated procedure **without moving the current rendered standpoint**. Face/Bring into view are subsequent explicit actions. Preserve the existing return-origin assertions and add immediate realized-Camera equality across Resume.

## Lens crossing and Preview

Lens crossing:

1. Cancel unaccepted fields, gestures, auditions and pending acceptance callbacks.
2. Remember inactive procedure context: original identity, resolving targets and accepted parameters.
3. Remove active task surfaces, temporary readings, handles and execution work.
4. Carry current selection, source/history and realized Camera unchanged.
5. Return to ordinary lens context; Experience may show existing Guide Peek.
6. Offer explicit Resume only after original identity and targets revalidate. Store no Camera snapshot in parked records.

Use one shared parking mechanism with records keyed by owning lens; this must not create separate active task or navigation authorities.

Preview:

1. Cancel unaccepted proposals and suspend authoring interaction.
2. Capture a return token through canonical shell/navigation/task authorities.
3. Execute against isolated session state; hide authoring chrome and disable authoring handlers.
4. On exit, destroy visitor effects and restore lens, canonical selection, Card context, standpoint and accepted inspection state.
5. Do not use lens-switch parking semantics for Preview return, and do not hard-code return to Experience as the donor currently does.

## Implementation slices

Each slice must retain earlier acceptance and end in an observable working state.

| Slice | Implementation and reuse | Verification and completion |
|---|---|---|
| **S0 — preflight** | Confirm merged base; record donor behavior/test mapping; lock topology and fixture mapping. Inspect existing QA before changing assertions. No runtime changes in this slice. | Baseline donor domain tests/typecheck, existing World QA and documented known deltas. Acceptance: executable commands and retained/superseded tests are mapped. |
| **S1 — real ordinary Experience** | Extend `state.js`, `actions.js`, `ui.js`, `main.js`, fixture resolution and shared source history. Replace the bridge with explicit create/open Presentation, Meaning/Focus and foreign-identity Cards. | Create, rename, cross lenses, Undo/Redo. Lens toggle creates/selects/moves nothing. No Guide or permanent Deck. No broad World redesign. |
| **S2 — Set and standalone execution** | Harvest model, capability controls, narration and runtime helpers. Add explicit entry/cue/visitor-choice roles, Auto/Hints/Capture, subject/region/environment creation and basic isolated Preview using shared Camera. | Author from Reset without timing/schema controls; three Views remain unordered; no Stop or edge appears. Preview without Guide, including no-View Presentation; exact authoring return. |
| **S3 — optional Guide** | Reuse `resolveNext`, occurrence editing, pacing, Gates and visitor navigation. Implement Peek, Overview density and expanded occurrence with the same Set. | Add Presentation creates one Stop; repeated Stops have distinct IDs without cloning framing. Reorder changes editorial order only. Stage overview shows numbered entry pins, no Camera graph. |
| **S4 — Seam and routes** | Add local Seam instrument, origin coverage, destination entry and Camera-owned connection editing on Stage. Reuse shared navigation/return and cancellation. | Opening Seam changes neither pose nor projection. Explicit route work may request Plan. Prove 2-of-3 reachable origins, repair one gap, Cut without edge, Travel refusal on unresolved support. No route-search framework. |
| **S5 — precise Camera and reach** | Extend the canonical Camera seam with Outside/Through/Plan postures and direct framing controls. Adapt donor local/shared and Stop-entry detachment helpers. | Precision accessible without Guide; one active numeric tape; Through visibly remains authoring. Ask Rule names affected uses. Explicit detach is atomic and undoable. No unsupported placement overrides or general Presentation-fork system. |
| **S6 — local coordination** | Add invoked coordination to the selected Seam, using Camera stations and existing capability invocation machinery. | Anchor/pace changes update derived timing while beat references remain stable. Generated samples cannot be selected as stations. Shared route edits show reach; path edits occur only on Stage. |
| **S7 — complete visitor/regression behavior** | Finish Auto estimates, cues/captions, interactions, interruption, Gates, exploration/rejoin, repair and run identity. Adapt visitor UI and Presenter scenarios rather than their old layout. | Execute retained A0–A22 coverage below. Freeze source through runtime flows; stale runs cannot reclaim effects. Required broken behavior is refused/disabled locally. No general scheduler, scripting or production media system. |
| **S8 — full continuity** | Generalize World parking to Experience Overview/Seam/coordination/precision; implement neutral Resume; harden Preview return and interleaved source history. | Both directions, accepted edits, canceled drags, changed selection, deleted/rebound targets, repeated crossings, Camera movement in the other lens, ordinary return and explicit Resume. No hidden active work. |
| **S9 — acceptance and preservation** | Complete unified QA, visual specimens, harvest mapping, readmes/status routing and Paper handoff. | All required rows pass; observed experiments are recorded separately. Retire bridge assertions only after replacement proof. No production cutover or phase closure. |

Dependencies are sequential for reviewability. Continuity invariants apply from S1 onward; S8 is comprehensive adversarial proof, not the first integration.

For Camera precision, use **Outside initially** to preserve standpoint; expose Through explicitly and record the default-posture experiment. This is a prototype trial setting, not a new product ruling.

## Acceptance

Keep four categories distinct.

| Category | Required proof |
|---|---|
| Hard invariants | One canonical selection, Camera/navigation authority, shared Stage, source-history sequence and execution path; separate domain ownership; no source mutation from runtime; no generated authored anchors; stable View/use/Stop/visit/run identities. |
| V2 design | Ordinary Experience without Guide/Deck; explicit Presentation creation/opening; unordered Set in Plan and 3D; Peek → Overview → expanded occurrence; stable Card; Seam bookends and origin gaps; no implicit Camera movement; local coordination; Ask Rule; progressive Camera; visitor takeover. |
| Cross-lens contract | World identity enters Experience unchanged; Experience identity enters World unchanged and inert; toggle creates/captures/selects/moves nothing; pending edits cancel; accepted edits survive; procedures park inactive; return is ordinary; Resume revalidates; other-lens Camera movement survives both return and Resume. |
| Observational experiments | Through versus Outside default; Deck crop-docking/spatial memory; station-bound coordination comprehension; legacy checkpoint/cursor and detour expectations. Passing characterization tests does not ratify these policies. |

Harvest all 4.1 rows explicitly:

| Original rows | #113 disposition |
|---|---|
| A0–A2 | Retain low-floor creation, Presentation/View/Guide independence, no-Guide and no-View Preview. Replace Encounter terminology and old shell assertions. |
| A3–A4 | Retain independent Piano interaction, Switch → Light, separate trigger/target and capability-driven authoring. |
| A5–A7 | Retain synchronized narration/captions/cues, overlapping Auto readiness and Camera timing. Extend movement checks to the shared Camera evaluator and supported routes. |
| A8–A9 | Retain immediate permitted manual Next versus Auto readiness and explicit connection Gate, including keyboard/autoplay parity and visit-local signals. |
| A10–A12 | Retain disarming pending work, finite Finish, persistent Continue, visitor Stop ownership, exploration and current-pose rejoin with autoplay off. |
| A13 | Retain detour characterization and isolation/no-duplicate-entry invariants; pause policy remains observational. |
| A14 | Retain distinct repeated occurrences and one Next resolver. Legacy checkpoint cursor behavior remains characterization, not the default V2 authoring path. |
| A15 | Retain local/shared framing and explicit Stop-only detachment; require Ask Rule and accurate affected counts. |
| A16 | Retain real structural commands and coalesced Undo; replace ordered-View UX assertions. |
| A17 | Retain repair and cycle handling; strengthen missing View versus intentional keep-viewpoint distinction. |
| A18–A19 | Retain World source edits versus temporary Experience effects, adaptive/fixed framing review, frozen-source execution and selection isolation; extend to exact shell/inspection return. |
| A20 | Retain bounded deterministic stepping and documented tolerance; no arbitrary-tick scheduler requirement. |
| A21–A22 | Retain observational Presenter and deterministic Reset/Load Example. Neither starts playback or authors work through Back/Skip. |

## Verification and preservation

Reuse #112’s eleven QA axes and A–F source assertions. Extend the existing harness with Experience and continuity cases. Rewrite bridge-only and superseded shell assertions; do not rebaseline World behavior to make integration pass.

The commands below describe future implementation verification. No prototype modules
or tests have been added by this planning task.

Use focused pure tests for identity, source commands, runtime, timing, reachability and station binding, plus real-control browser proof for wiring. Preserve existing captured-control editing, visitor-selection isolation and one-drag/one-Undo regressions.

Deliberately inspect all six V2 canonical visual states, visitor Preview, foreign selection, parked procedures and narrow desktop. Follow `browser-hygiene` for every browser run. Existing desktop, keyboard and motion coverage remains; add no speculative production device/performance/accessibility gates.

Run the unconditional root `npm run test:arch`. Prototype checks own runtime behavior unless implementation expands into production code or configuration. The donor Playwright configuration currently expects port **5173**, while its `dev` script specifies **3000**; resolve harness startup explicitly before relying on that suite.

Preserve the donor executable, 4.1 plan, tests, V2 synthesis/boards and #112 acceptance. Mark their roles clearly. Record successor coverage before removing any old test or bridge code; use targeted mutation proof for replacement claims.

Route the new plan from operations/current, roadmap, P25, P26’s prototype handoff and prototype readmes. Update the stale integrated-folder executable-home claim. On implementation acceptance, use slice-closeout without claiming a major-phase close.

Paper receives the unified executable, stable selection/navigation/history/cancellation seams, both-lens parking and Preview-return tests, known prototype shortcuts and preserved A–F evidence. Its PA0 must reconcile against #113’s resulting tree; #113 does not implement Paper’s rail, drawing, derived-room or placement work.


## Executable verification and progress

- S0: donor `npm test` and `npm run typecheck`; World `QA_SHOT=0 bash qa/run-all.sh`.
  Inspect bridge assertions before replacing them. Record baseline results in the
  unified acceptance record.
- Inner loop: `node --test prototypes/spatial-authoring/tests/*.test.mjs` and the
  affected browser axis. New pure modules are directly runnable with Node ESM;
  browser wiring is checked through real controls in the existing harness.
- S9: complete World axes, unified Experience/continuity browser coverage,
  donor tests/typecheck, targeted replacement mutation proof, and unconditional
  root `npm run test:arch` (includes documentation references).
- Donor browser startup uses an explicit strict 5173 port when invoking its
  retained Playwright suite; dev's ordinary 3000 port is not its harness contract.
- No commits or pushes are authorized. Keep the tree reviewable and use
  slice-closeout only after every required acceptance row passes.

| Slice | Status | Evidence |
|---|---|---|
| S0 | baseline verified; mapping recorded in this plan | donor: 62 tests + typecheck pass; all eleven existing World QA axes pass (2026-10-03) |
| S1–S9 | not started | implementation requires a subsequent owner request; acceptance record will name commands and results |

No owner product or architecture decision blocks this plan. Outside is the initial
precision posture as a documented prototype experiment; exact CSS metrics are
implementation choices consistent with the existing shell.
