# World Authoring Prototype — acceptance and harvest

**Accepted prototype adoption:** 2026-10-02, #112 scope, at the existing spatial-authoring home.
S0–S7 were already implemented in stages; S8 completed independent shell/spatial proof and fixed
the remaining lifecycle defects. S9 replaces predecessor explanations/evidence and routes #113.
[Closed plan/recovery](../../../docs/roadmap/p26-spatial-depth/design/world-authoring-prototype/implementation-plan.md)
· [current executable](../README.md) · [mechanics](../IMPLEMENTER-REFERENCE.md).
This is executable prototype acceptance, with no production cutover or F/T1 authorization.

## Recorded verification

Chromium via agent-browser, private ephemeral server per axis, one browser at a time, all closed.
No automatic baseline regeneration. Counts include checkpoint/assertion observations, not independent
unit cases. The 50 A–F steps are compared against their own recorded state baseline.

| Current axis | Passed / failed | Protected behavior |
| --- | --- | --- |
| Journey | 59 / 0 | 50 A–F checkpoints, exact final source values, fixture/inventory, faults |
| Interaction | 56 / 0 | Valid/refused release, typed writer/Tab, rise/head and opposite jamb, pooled overlays |
| Flows | 44 / 0 | Real peel/Plan/3D gestures, knife slide, nested cut/trail return, grid/reopen |
| Policy | 41 / 0 | Pointer cancellation, subject versus host, neutral teardown and navigation ownership |
| Shell | 47 / 0 | Ordinary/Look/Details, explicit row target, selected Card, one Instrument |
| Precision | 38 / 0 | First gesture retained, in-place Measure, one writer, local refusal, hidden-axis access |
| Browse | 60 / 0 | Dense/paged/repeated-name search, context and all explicit recovery/Details verbs |
| Repair | 47 / 0 | Honest unresolved reference, explicit compatible candidate, accept/Undo/cancel and reach |
| Lens | 80 / 0 | Inactive parking, foreign identity, ordinary return, current-source refusal, fresh Resume |
| Responsive | 15 / 0 | 1440×900, 1280×800, 1024×768, DPR2, sheet/field focus, announcements, keyboard line, live OS motion |
| Correctness | 11 / 0 | Profile/slope/seam validation, summary/no-op history, nested Section/Reveal and mirrored Look-up parking, held return realization, live-drag cancellation, keyboard gap/Repair/Resume |

**498 passing observations**, zero failing acceptance observations and zero command/page/console
errors in the accepted runs. One full sequential pass plus affected-axis retries obtained these
results. The native Escape command stalled/dropped later evaluations in Precision/Policy; the
shared harness now dispatches Escape once through the focused page handler. Responsive delayed
browser viewport/media events passed on a fresh retry. Empty results were not treated as application
failures or used to change acceptance criteria.

Exact source assertions preserve A's head 3.4/rise .45/width 2.2/sill .7/ridge 7.2, B's door head 3.2,
C's wall top 4.2/soffit 3, and E's stored position `6.399999999999999`/width 2/head 3.8/rise .6,
with Undo returning E's head/rise to 3.4/.8. No source fixture was re-baselined. Only B7–B9's task
subject expectations changed to null: the parent Section started without selection and must not
borrow the later Harbor selection during Back. The three semantic expectation corrections are
independently checked by the unselected-Section parking case.

The added correctness axis is the minimum supplement to existing checks: it covers numerical and
nested-lifecycle obligations outside the 50-step inventory, reusing existing shell/gesture axes.
`qa/mutation-check.sh` proves replacement coverage on disposable copies: implicit host selection
must fail Shell, and a Camera reset on World return must fail Lens, with unaffected controls passing.
It never mutates the current executable.

Root unconditional architecture lane: **24 files / 276 tests passed** before retirement.
Production `npm test`, check/build and fast/heavy/perf lanes are not applicable to this impact:
no apps, packages, dependencies, workspace/runtime configuration or production imports changed.
Prototype browser checks own executable behavior; the complete architecture lane owns repository
boundaries and Markdown references. S9's documentation/HTML routes and full architecture recheck
are recorded under Preservation. Syntax and working/base-to-head whitespace checks pass.

## Visual and accessibility evidence

Current `scripts/shoot.sh` produces 27 semantically named endpoint/intermediate specimens into
ignored QA output; replacement of checked-in screens is deliberate. Mid-cut and mid-Look-up are
controlled intermediate states, not timing/performance measurements. Normal travel and live
reduced-motion endpoints are asserted; old unique mat↔paper timing evidence remains retained.

Visual inspection covers ordinary bench/window, inside/outside half-wrap and flatness, Section aim,
parting/depth/Reveal/nesting, partial Lift/gap preview, mirrored Look-up, Plan/tilted editing,
Precision refusal, Repair, Search, crossing/foreign identity/Resume and narrow Card. It checks written
PLATE laws and source truth, not pixel identity to generated boards. Visual review found and corrected the predecessor numerical catalogue still present on ordinary Card, clipped Unroll controls and cramped Index labels. Two compact acceptance assertions now protect ordinary disclosure and Instrument control bounds. Numbers/form/relationship edits are invoked in Measure/Precision; Owner/Source/Reach is a disclosure beside that writer. Head/Index/Stage/Card remain
legible; Instrument overlays Stage, Card keeps canonical identity, technical target stays separately
named, and narrow sheets preserve the standpoint. Ochre selection, vellum work surfaces, slate
view-only marks and local refusal/repair explanations survive the shell adoption.

Keyboard proof exercises selection/search/invocation, line seed/slide/turn/side/depth/Open,
curvature/typed edits, sheet focus return, refusal announcements, gap preview/cancel, Repair,
Resume and unwind. Live OS reduced motion is independent of user override and Motion speed.
Screen-reader listening, assistive-device/usability trials and gesture feel are outside this bounded
acceptance; there are no promised outstanding manual acceptance rows.

## Coverage and harvest

Predecessor paths below are historical evidence recovered through the preservation anchor.

<!-- EVIDENCE-PATHS: start -->
| Predecessor behavior/evidence | Current successor proof / specimen | Decision |
| --- | --- | --- |
| Reconciliation: isometry, legibility, per-axis scale, one-beat/direct gesture, exact return, histories | Implementer §§1–8; Interaction/Flows/Journey; unroll half/inside/outside/flat/step-back, exit-summary | Harvested rules; comparative prose retired to Git |
| Screens 01–08, 19–20c: overview/tilt/Plan/face/mid-peel/inside/outside/scale | Journey A/E + real Interaction/Flows; world-window, plan-edit, tilted-edit and unroll specimens | Replaced old-shell rasters |
| Screens 09–13, 24: knife preview/slide, mid-part, depth/locator, nested return, Reveal, wall relation | Journey B + Flows/Browse/Correctness; section-aim/slid/mid/depth/nested/reveal | Replaced; finite depth/Reveal and exact cut return asserted |
| Screens 14–18: partial Lift/gap consequences/mid-Look-up/mirror/refusal | Journey C + Precision/Responsive/Correctness; ceiling-partial/gap-preview, lookup-mid/mirrored, precision-refusal | Replaced; frozen focus/hover preview and cancellation asserted |
| Screens 21–26: Plan/tilted manipulation/summary/Search/behind reason | Journey E/F + Interaction/Flows/Browse/Correctness; plan-edit, tilted-edit, exit-summary, world-search | Replaced; visibility reasons and all recovery verbs are executable assertions |
| review/test-plan.sh and test-flows.sh | Current Flows + Interaction; same pointer/math/return defects, Shell/Lens mutation proof | Assertions harvested; scripts deleted |
| review/audit.sh and B/D/predecessor/n-series comparison PNGs | Current shell/spatial axes and named intermediate specimens | Old comparative servers/selectors/boards retired; no unique behavioral proof lost |
| Visual-refinement baseline/revised/compare/capture and old run reports | Current specimens, Responsive/Interaction/Journey and shared capture generator | Redundant old-shell evidence/tooling retired; journey/interaction routes forward to live QA |
| Material calibration, contrast-table/check, paper-slew probes and before/after transition images | Original material acceptance §§3–8, paper-surface brief, unique retained probes/data/transition HTML | Retained: numeric/owner evidence is not reproduced by shell screenshots |
| #111 ten-board QA and finalized syntheses | PLATE §0.8 destination design + frozen design package | Retained as design evidence; never presented as executable acceptance |
<!-- EVIDENCE-PATHS: end -->

The lens switch is currently beside Museum Editor at the top left. The centered position shown in the design boards has not been adopted; the shared Head landmark and switching behavior are implemented.

## Limits and handoff

No new wall/opening/ceiling drawing, vertical crop/cut-only, multi-level/reusable-source model,
internal component identity, shared-source overrides or production persistence. Dense records lack
geometry explicitly. Analytic caps, circular fixture, separate clipping/membership, tiny-FOV flat
projection, one-ray occlusion, per-frame retessellation and snapshot Undo remain prototype shortcuts.
Touch/pen/trackpad feel, screen-reader listening, dense/cubic performance and extreme-zoom moiré
remain unperformed product studies. Prior paper-selection composition was resolved by owner material
calibration before this adoption; PLATE's open owner calls are not ratified here.

**#113:** replace the visibly read-only continuity bridge with finalized Experience V2 executable
behavior and prove both directions, including Experience procedure parking, foreign identity and
shared Camera/source continuity. F exact interfaces and T1/T2/T3/T4 production authorization remain
unchanged. No P26 major-phase close is claimed.

## Preservation

CLOSEOUT PRESERVATION — World Authoring Prototype (2026-10-02)

- Prose compacted: 1, the accepted implementation plan retains a stub at its original path.
- Reference promotions: 0; prototype mechanics belong beside the executable, never production authority.
- Renderable evidence archived: 0, per the plan's explicit Git-retirement rule; 27 current captures replace redundant boards.
- Transient/predecessor artifacts removed: 148 files / 35,278,506 bytes, each mapped above; unique material/contrast/transition evidence retained.
- Historical anchor: `7c9bc81b6edb54cc5ec3ce37f3f45011b6050504` · annotated `closed/world-authoring-prototype`, local only, not pushed. Full plan body and every retired artifact are reachable there.
- New live → archived-prose links: 0. Manual-owed acceptance rows: 0.
- Deferred scopes: #113 Experience/two-way continuity; F/production tracks; model expansion/reuse/component identity; product/device/performance studies. Top-left switch placement is disclosed above.

Working and complete base-to-head whitespace, Markdown routes, relative HTML/image links and scope
are checked after retirement. Full architecture recheck: 24 files / 276 tests; docs gate: 22 tests.
The plan is compacted only after its full accepted body was committed and tagged. The preservation
tag is verified locally; P1 merge-commit and post-merge main reachability remain outside this local
commit request. No merge-ready or merged-main claim is made.
