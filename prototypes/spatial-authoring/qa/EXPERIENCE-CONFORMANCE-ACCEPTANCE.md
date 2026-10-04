# Experience V2 replacement conformance review

**Status: draft, paused by owner during C8. Acceptance incomplete; external review pending.**
Resume from the [conformance checkpoint](../../../docs/operations/checkpoints/experience-v2-conformance.md).
This record belongs to the [active C1–C8 replacement contract](../../../docs/roadmap/p25-experience/design/experience-v2-prototype/conformance-plan.md).
The [S0–S9 acceptance](./EXPERIENCE-ACCEPTANCE.md), its plan and specimens remain historical evidence;
their passes confer no acceptance here. This prototype introduces no production format or cutover.

## Revision and reproducibility

Worktree: `prototype-v2`, base HEAD `4d5e3c3eadf79c505ec6fbdab054563815888d27`.
Implementation and new evidence are uncommitted and unpushed. The owner’s initial dirty conformance-plan
changes were retained. [PR #113](https://github.com/Biskiq/spatial-sketch-editor/pull/113) remains open;
its remote head is the same base revision. No commit, push, merge, PR closure or major-phase closure
was authorized or performed.

Canonical viewport: **1440×900, DPR 1**; harness query `shot=1&motion=instant`.
The [fixture](../app/conformance-fixture.js) loads authored content only: the accepted World building,
six Stops including a repeated Presentation, three unequal Machine Views, a distinct Gallery light
destination and an Open casing contribution. It creates no connection, anchor, beat, active task,
selection, reading or authoring standpoint. The ordinary and precise no-Guide recipes start from
the product Reset and build their Presentation/Views through controls.

Run the [product transcript](./conformance-check.sh) for canonical and companion captures, then
[narrow reconciliation](./reconciliation-check.sh). Read-only snapshots record canonical selection,
task/depth, full rendered Camera and aggregate authored source alongside each canonical capture.
These observations do not establish the captured state. Fixtures are the only source-loading
exception; every claimed state thereafter is reached through DOM controls, pointer or keyboard.

```sh
QA_OUT=prototypes/spatial-authoring/screens/experience-conformance QA_SESSION=v2-captures bash prototypes/spatial-authoring/qa/conformance-check.sh
QA_OUT=prototypes/spatial-authoring/screens/experience-conformance QA_SESSION=v2-narrow bash prototypes/spatial-authoring/qa/reconciliation-check.sh
```

## Implemented slices and material decisions

| Slice | Result |
|---|---|
| C1 | Authored-only stress fixture, six-state manifest, product transcripts, read-only snapshots and successor boundary mutations. Old proof/captures retained. |
| C2 | Camera kernel owns resolved framing, observer routes, stations, timing, interpolation and realization; navigation owns input, projection, detents, neutral invocation and opaque returns. Existing World motion profiles preserved. |
| C3 | Quiet Meaning/Focus/Show Card, spatial unordered Set, derived Auto/Hints and explicit atomic Capture, PLATE semantic roles, shared Meaning/Set-role confirmation. |
| C4 | Peek awareness, L0/L1 overview, distinct repeated pins, L2 schematic/spatial Set, explicit local entry and canonical occurrence selection. |
| C5 | Real scoped Plan observer graph, multiple origins, destination, 2/3 coverage/gap, generated endpoints versus authored anchors, normal pace, pointer/keyboard authoring and aggregate Undo. |
| C6 | Same route plus stable spatial/temporal stations, local beat/hold lanes, explicit multi-route resolution, saved disclosure, timing/ref preservation and shared route confirmation. |
| C7 | No-Guide Stage framing instrument, real Through gate/horizon/target, Outside observer/frustum, truthful Plan/Outside/Through, one active grip/tape, scope and neutral returns. |
| C8 | Incomplete: final frozen-revision integrated/mutation/narrow proof, all-six visual verdicts and final acceptance/handoff remain. |

- Anchors mean **observer positions in project space**. Camera converts them with the interpolated
  observer-to-target offset. Stage paths, direct manipulation, samples, station estimates and
  visitor evaluation use the same Camera path. Generated endpoints are never authored anchors.
- Coverage includes the actual Stop entry plus independently reachable shared choice/cue Views.
  A specialized entry replaces a shared entry that is no longer independently reachable.
- Auto/Hints are derived intent; Capture authors one Camera View and its Experience use in one
  transaction. Relative framing is resolved against current World facts by Camera, including
  explicit unresolved/fixed-framing review. Neither authoring nor Preview keeps an alternate resolver.
- Navigation freezes the current realization before neutral activation and blocks setup writes.
  Parked work contains accepted identity/parameters, never old poses/return tokens. Explicit
  spatial invocation takes a fresh return from now; Preview has its own suspension/return.
- Travel waits for the actual departure View. It refuses locally during an unfinished move or
  exploration, rather than inventing a route from the current eye to the authored origin.
- Source operations recalculate reach at proposal and acceptance. Supported Stop-entry detach
  is atomic; unsupported Presentation forks are not offered. Cancellation writes no history.
- Source/domain/runtime algorithms stay separate from editor session machinery. The static
  prototype shares its page; production visitor chunks and routes were not changed.

## Final proof

Canonical recipes, full-board comparisons, dimensional verdicts, companions and gate results
are recorded here after the final rendered review. A successful screenshot command does not
constitute visual acceptance.
