# T5 E0 withdrawal and Object Focus planning — 2026-10-27

**Status:** the owner's E0 withdrawal is recorded as a ruling. The planning direction, the
registration of `T5.P01` and the approval of its first slice plan are proposed by the T5 planning
PR and take effect only when the owner merges it. Merging releases nothing: the
[release list](../../roadmap/now.md) is unchanged and owner-written.

This record owns what was decided and what merging does. The
[T5 umbrella plan](../../roadmap/t5-expressive-geometry/umbrella-plan.md) owns the architecture and
roadmap; the [T5 track README](../../roadmap/t5-expressive-geometry/README.md) owns objectives and
the phase register; [T5.P01](../../roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/README.md)
owns its slice register.

## Owner ruling: E0 withdrawn

The owner rejected the E0 guide/arrangement experiment as insufficiently valuable for T5's
direction. The [E0 execution plan](../../roadmap/t5-expressive-geometry/e0-execution-plan.md)
(PR #205) is withdrawn and superseded; it stays at its path as historical evidence with a
withdrawal notice. [PR #206](https://github.com/Biskiq/spatial-sketch-editor/pull/206), which
implemented its disposable `prototypes/e0-spatial-playground`, was closed without merge on
2026-10-27. Nothing from E0 is product, contract, format or roadmap authority.

**Preserved evidence.** PR #206's head `12821a1d8b1f9d48261ea66ce51be9efc55bc33f` remains
retrievable through the pull request (30 files: the playground, 20 model tests, example designs, a
blank decision-note template and its run instructions). Its own report recorded the finding worth
keeping: with one guide per document, the explicit path's source was always unambiguous and
prefilled, so once a source was chosen the two entry paths converged; what remained was a
persistent context against tools plus an inspector. Relocating controls is not a creative
advantage, and composable guide context did not earn T5's first investment. No owner decision note
or creator result was recorded.

**What stays.** The [North Star's creative-freedom principles](../north-star.md#creative-freedom-and-depth),
the [architecture obligations](../architecture.md#expressive-creation-and-revision-destination) and
the Scene, persistence and assets destination sections promoted by the
[G0 ratification](./t5-g0-ratification-2026-10-27.md) are unchanged. Contextual creation and
composable relationships remain principles; they are no longer T5's first experiment. The G0
proposals remain historical evidence.

## Working direction and planning response

The owner's working direction is a dedicated Object Focus workspace for creating, shaping and
refining 3D objects, sharing Biskiq's visual language and project architecture, treated as a
design hypothesis. The umbrella plan answers it with native forms: Scene-owned objects whose shape
is authored source, created by drawing in World and refined in Object Focus. It challenges one part
of the hypothesis: Object Focus becomes a **scope on the one Stage**, not a separate workspace,
because PLATE and the architecture require one Stage, selection, history and Camera, and a
separate studio would be built twice. The studio qualities — isolation, framing, sections on paper,
a bounded tool set and a faithful return — are kept inside that scope.

## Effect of merging the planning PR

Merging is the owner's approval of:

1. this record of the E0 withdrawal and the evidence above;
2. the [umbrella plan](../../roadmap/t5-expressive-geometry/umbrella-plan.md) as T5's planning
   direction. It is roadmap authority, not a reference contract: the North Star, architecture,
   Scene, persistence and assets contracts, F, PLATE and the performance contract are not amended,
   apart from repairing the North Star's routing sentence that named E0;
3. registration of `T5.P01` — Drawn native objects — with its slice register, its final gate and the
   T5 runbook and baton, and the approval of the
   [first slice plan](../../roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/implementation-plan.md);
4. the execution-structure gate's admission of T5 batons, runbooks and release-list rows
   (`apps/editor/tests/docs/parallel-track-gates.test.ts`), so a T5 release row can be written
   without a further test change.

It does not release any scope, install a dependency, amend an F contract or gate, change PLATE,
admit a Scene format, or authorize the later phases the umbrella plan describes. The first slice
declares two libraries already resident in the lockfile as direct dependencies of
`@portfolio/geometry-core` — `robust-predicates` 3.0.3 (Unlicense, already used by Layout) and
`earcut` 2.2.4 (ISC, today transitive) — and its acceptance records their versions and licences.

## Owner decisions

Each decision has the default the merged plan uses. Changing a default in review changes the plan
before merge.

| # | Decision | Default on merge |
| --- | --- | --- |
| D1 | Object Focus is a scope on the one Stage, with a state pill and Put back, rather than a separate workspace, route or shell | Scope on the one Stage |
| D2 | T5 implements native-form semantics inside the Scene unit, codec and planners under T2 review; T2 keeps Scene authority, other entity kinds and definitions/instances | T5 implements under T2 review |
| D3 | A new T5-owned runtime-safe workspace package, `@portfolio/geometry-core`, holds reusable numerics with no domain meaning; its only libraries are the resident `robust-predicates` and `earcut` | Admitted with `T5.P01.S01` |
| D4 | Scene unit format 3 → 4 adds the `form` entity; strict readers refuse 3; fixtures regenerate; the slice starts after `T2.P02.S03` merges or T2 hands over the Scene-unit files | As stated |
| D5 | Ink becomes one Pen with readings from more than one domain; the Scene **Shape** reading lands in `T5.P01` slice S02 through a bounded seam T1 reviews (alternative: T1 delivers the seam first) | Bounded T1-reviewed seam in S02 |
| D6 | Revision promise for P02: shaping is bound to object space, so a later outline or size edit re-evaluates it where it is in the object, or refuses | Object-space binding |
| D7 | Section presentation in Focus — PLATE's default reading takeover versus the Shape focus specification's split pane (PLATE's retained inset) — is a named P02 design-loop decision | Decided in P02 |

Decisions owned by a later phase stay there: Manifold admission and any asynchronous F4 preparation
for composite forms, any licensing ruling for implicit-field kernels, and T2 definition/attachment
consumption.

## Release step for the first slice

When the owner chooses to start `T5.P01.S01`, the release is one owner edit: add its row to the
[release list](../../roadmap/now.md) — condition "starts after `T2.P02.S03` merges on `main` (or T2
records a Scene-unit writer handoff to this slice); recheck consumed gates and active scopes at its
own trusted base" — linking its plan. The coding agent then starts through the
[T5 runbook](../../operations/t5-expressive-geometry/README.md) start step.
