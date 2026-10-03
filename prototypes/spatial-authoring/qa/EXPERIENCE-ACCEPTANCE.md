# Unified Experience V2 acceptance (#113)

Prototype evidence only; no production contract cutover or phase closure.
Execution authority: [accepted plan](../../../docs/roadmap/p25-experience/design/experience-v2-prototype/implementation-plan.md).
Status (2026-10-03): S0–S9 implemented and self-reviewed. Required prototype proof
passes; repository-wide final gates and closeout remain blocked by the missing
P23B fixture described below. This record does not claim merge readiness.

## S0 — preflight (2026-10-03)

Base: `e9ebe60a` (merged #112); owner plan commit `a38c534b` is present on the current branch.
Donor `npm test`: 62/62; `npm run typecheck`: pass.
World `QA_SHOT=0 bash qa/run-all.sh`: all eleven axes pass.

Topology: `spatial-authoring` is the unified native ESM executable. Donor remains runnable.
Fixture map: Garden window retains `gwin`; Presentation `pres-highlights` references it.
New capability fixtures belong to Scene; Experience references their identities.

Retained: all A–F source/interaction axes, validators, numeric capture, source isolation,
nested return, cancellation, keyboard/motion/narrow desktop. Eleven World axes remain required.
Superseded: read-only bridge shell assertions and implicit first-ordered-View entry.
Successor wiring: `qa/experience-check.sh`; broader continuity proof is added at S8.
Donor pure algorithms/rows A0–A22 are mapped by the accepted plan's Harvest table;
S7 adds executable successor probes. No donor test is deleted.
Known planned deltas: aggregate domain history, unordered Set/explicit entry,
visit/run ownership, capability replacement policy, missing-View repair and neutral Resume.

## Slice evidence

S1–S9 records are appended as each slice passes. No acceptance is inferred from implementation.

S1: one focused test; browser 8/8. Explicit opening/rename, inert lens crossing,
canonical identity, shared Undo/Redo and no ordinary Deck. The exact S1 index
snapshot was exported and rerun before its commit, preserving later working changes.

S2: focused 3/3; exact slice snapshot browser 11/11. Unordered three-View Set,
explicit roles, no implicit Guide/edge, standalone visitor takeover and frozen-source
return. Camera kernel is beneath navigation; region creation is an explicit Stage task.

S3: focused 4/4; exact slice snapshot browser 15/15. Guide starts at Peek, Overview
and expanded occurrence keep Camera, repeated Stops share their Presentation's Set,
and reorder only changes editorial order. Stage Overview pins contain occurrence numbers.

S4: focused 5/5; browser 22/22. Seam opening preserves pose/projection, per-origin
coverage proves 2/3 then explicit 3/3 repair, Cut adds no edge and Travel exposes gaps.
Explicit route work enters Plan with a canonical return crumb. Connections store only
interior anchors; generated endpoints and the common evaluator own estimate/execution.

S5: focused 6/6; exact slice snapshot browser 27/27. Outside starts without movement;
Through remains authoring; one grip owns one numeric tape. Ask Rule in the Card names
uses/Stops before acceptance. Explicit Stop-entry detach/retarget is one source step;
Undo reunites the entry. Shared Set choices remain shared, as the reach report states.
Browser proof uses strict command failures. Bounded cards and compact controls repair
clipped/covered controls found by actual clicks. Outside default remains an experiment.

S6: focused 7/7; browser 30/30. Stage adds an interior anchor; local coordination
selects only stable departure/anchor/arrival/named stations. Pace and anchor edits
rederive timing without changing beat references; missing stations remain repairable.
The strip edits holds and pace, never path geometry; shared route reach is explicit.

S7: focused 29/29 (explicit A0–A22 harvest rows), visitor browser 13/13, existing
Experience wiring 30/30, root `npm run test:arch` 276/276. Retained algorithms are
native ESM adaptations of donor arm/begin/close, interruption, cue queue, readiness,
Next and bounded .25s stepping; regression oracle stays untouched. New tests cover
visit/run ownership, declared fixture replacement, missing framing/cycles, source
isolation, fixed/relative framing review, and station-bound holds/invocations.
Visitor controls prove viewport takeover, independent Piano, Switch → Light,
keyboard Gate parity, captions/cues, exploration/rejoin and exact ordinary return.
Presenter Skip observes only; explicit Load Example initializes deterministic source
and never plays. Media is a deterministic fixture simulation, as in the donor,
not a production audio/video system. Detour pause remains characterization.

S8: continuity browser 52/52; lens 81/81; Experience 30/30; all thirteen then-wired
axes passed without World rebaseline; focused 29/29; architecture 276/276.
One lens-keyed parking mechanism retains accepted procedure parameters and no
Camera snapshot. Both directions revalidate identity, View binding, Seam bookends,
connection and station; Resume is neutral at the current realized standpoint.
Live framing drag crosses from the keyboard because clicking a different lens
first ends pointer capture. Preview uses its own isolated return token and restores
ordinary and invoked authoring inspection. World-only footer controls refuse in
Experience without changing shell layout or Stage rect.

S9: F1–F3/F5–F9 and shared-shell acceptance implemented. Head Preview and active
Experience name occupy the existing 40px Head row; Scene subjects are locators;
examples live outside the product Index. View-use and Stop Cards name owner and
shared/local reach. Accepted Entry, Next and Pacing values survive reopening and
Undo; local coordination exposes stable stations on Stage and editable holds.
Through exposes a reachable Camera grip and one numeric tape. Invalid framing
refuses locally with source/history frozen. Narrow Deck and visitor proof includes
resize without refit and exact Preview return. Bridge-only helpers/assertions were
removed after successor coverage, while #112 evidence and donor tests remain.

## Review fixes and final verification

Review through S1–S8 found and repaired these in-scope defects:

- Multi-origin Seams applied beats from an untraversed connection, and Cut applied
  route beats. Execution now lowers only the selected Travel connection's beats
  through the same timing function as the coordination strip.
- Auto readiness underestimated cues queued after a held route. It now uses the
  actual entry movement and then the queued Camera requests.
- Same-Presentation detour return allowed the detour run to supersede the paused
  original narration. Return restores original visit/run ownership without entry
  duplication; detour policy itself remains observational.
- Missing Focus, explicit missing Stop-entry use, and deleted station references
  could silently degrade execution. They now remain repairable and refuse locally.
- Creation reused an existing Presentation by Focus instead of creating explicitly;
  route Resume accepted a rebound connection; several Stop controls displayed
  defaults instead of accepted values; holds were not editable; Through hid its
  own grip. The relevant source commands, revalidation and controls are repaired.
- Switch → Light changed intensity on a black emissive material, producing no
  visible effect. The real material now reflects the temporary runtime effect.
  Visitor rendering also suppresses authoring hover/selection highlights.

Five added pure regressions failed against the original implementation before
passing with the fixes. Existing runtime algorithms and World assertions were
retained. Final commands and results on the reviewed tree:

| Verification | Result |
|---|---|
| `node --test prototypes/spatial-authoring/tests/*.test.mjs` | 34/34 |
| `QA_SHOT=0 bash prototypes/spatial-authoring/qa/run-all.sh` | 15 axes, 612 assertions, zero failures |
| `bash prototypes/spatial-authoring/qa/mutation-check.sh` | all 3 intentional defects rejected: host selection, Camera reset, implicit lens selection; unaffected controls remain green |
| Donor `npm test` / `npm run typecheck` | 62/62 / pass; donor unchanged |
| Root `npm run test:arch` | 24 files, 276/276 |
| `git diff --check` | pass |

Browser axis counts: journeys 59, interaction 56, flows 44, policy 41, shell 47,
precision 38, browse 60, repair 47, lens 81, Experience 30, visitor 14,
reconciliation 17, continuity 52, responsive 15, correctness 11. Every axis is
wired into `run-all.sh`; visitor and reconciliation were missing from that command
before this sweep. `lens-check.sh` owns World parking/refusal; continuity owns both
directions, Preview and history. Replacement mutations use disposable copies,
not baseline changes. All browser runs use owned sessions/servers and clean up.

## Canonical visual specimens

All eleven specimens were deliberately inspected. They illustrate working states,
not pixel assertions. Regenerate with the command in [QA README](README.md).

| V2 synthesis §22 / extra proof | Specimen |
|---|---|
| QA-1 ordinary Presentation, no Guide | [ordinary](../screens/experience-v2/qa-1-ordinary.png) |
| QA-2 Guide Overview and entry pins | [Overview](../screens/experience-v2/qa-2-overview.png) |
| QA-3 expanded occurrence and shared Set | [occurrence](../screens/experience-v2/qa-3-occurrence.png) |
| QA-4 Seam bookends and explicit Camera route | [route](../screens/experience-v2/qa-4-route.png) |
| QA-5 station-bound local coordination | [coordination](../screens/experience-v2/qa-5-coordination.png) |
| QA-6 precise Camera through authoring | [precision](../screens/experience-v2/qa-6-precise.png) |
| Visitor takeover | [visitor](../screens/experience-v2/visitor.png) |
| Experience identity carried into World | [foreign selection](../screens/experience-v2/foreign-selection.png) |
| Ordinary return with inactive accepted work | [parked procedure](../screens/experience-v2/parked-procedure.png) |
| 1024×768 accepted Deck, no refit | [narrow Deck](../screens/experience-v2/narrow-deck.png) |
| 1024×768 full visitor surface | [narrow visitor](../screens/experience-v2/narrow-visitor.png) |

## Experiments and handoff

Outside remains the initial precision posture experiment. Through is explicit
authoring. Deck crop-docking and distant/near/expanded density, coordination
comprehension, legacy cursor/checkpoint and detour pause expectations remain
observational; green characterization does not ratify them. Top-left non-amber
lenses and Stage-rect-preserving overlays retain the accepted composition.
No Paper rail, Card rewrite, Head-search retirement, topology or creation adoption
was added. Paper PA0 must reconcile against this unified executable, current
Camera/selection/history/cancellation seams and both-lens regression axes.

## Repository-wide gate blocker

Broader final verification exposes a pre-existing failure outside #113's scope:
PR #98 commit `49e1b231e4a79aba4a25bb3a7f0bdc151abfa430` deleted
`docs/roadmap/p23b-geometry-performance/40-walls.json`, still imported by
`apps/editor/src/lib/bench/p23b-fixtures.ts`. It is also absent at #113's base
`e9ebe60a`; no production source or configuration changed in #113.

- Root `npm test`: 33 files failed, 339 passed, 1 skipped; 4951 tests passed,
  1 failed, 1 skipped. The missing import prevents collection of dependent suites.
- Root `npm run check`: 1 missing-module error, 0 warnings.
- Root `npm run build`: unresolved import of the same fixture.

The exact original was recovered from Git (61,140 bytes; SHA-256
`63f15ed8745d08bf5f65ab2c85829d1b9f1df6f36b3a9137147b70d5d09f5e05`),
matching the fixture ledger. Restoration is awaiting owner scope approval under
AGENTS.md rule 11. No replacement fixture or production refactor was invented.
Required prototype acceptance passes, but slice-closeout requires these broader
gate results to pass before reporting merge readiness. Pushes remain unauthorized;
#113 remains open and unmerged.
