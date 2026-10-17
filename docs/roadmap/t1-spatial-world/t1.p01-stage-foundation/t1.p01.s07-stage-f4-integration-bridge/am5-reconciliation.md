# AM-5 conformance reconciliation and bounded completion

**2026-10-17 · PR #137 · owner-approved bounded completion, implemented, reviewed, verified and accepted; merge withheld.**
The [approved S07 plan](./implementation-plan.md) and [AM-5 interface](../interfaces.md#viewport-projection-v1)
remain the acceptance contract. Passing a probe does not waive an unimplemented row.

## Remaining requirements and their completion

| Requirement | Present limitation (before this increment) | Implementation now on the branch |
| --- | --- | --- |
| Source-independent accepted read boundary | `StageReadSnapshot` fixed `sourceKind: 'project-current'` and required `domain.project: ProjectDocument`; the host and adapter services depended on that encoding. | [`accepted-read.ts`](../../../../../apps/editor/src/lib/authoring/stage/accepted-read.ts) is the common snapshot: `sourceKind`/`sourceVersion` as `string`/`number`, the F.1 `references` read context, `name`, `layoutLevelId` and immutable resolved domain views, with no `ProjectDocument` field and no decoder. [`current-stage-source.ts`](../../../../../apps/editor/src/lib/authoring/stage/current-stage-source.ts) is the **explicit** current adapter (`currentStageSource`, `attachCurrentStageSource`, `currentStagePlanner`), refusing a wrong kind/version rather than decoding. Every in-repo caller migrated; a test consumer reads a `test-read-port@27` snapshot with no source or decoder import. **Scope:** this is the serialization boundary, not a free-form domain port — the domain read still publishes the current Layout/Scene projections the interface row names (compiled geometry, authored level, datum, runtime Scene, Room registry, navigation graph), and Camera access stays reference/inspection-based. |
| F.1 ordered selection and primary identity | `StageSelection` held one Layout `PlanSourceRef`; its kind set could not name a Scene entity. | [`semantic-selection.ts`](../../../../../apps/editor/src/lib/authoring/stage/semantic-selection.ts) holds ordered entries of F.1 `SemanticReference` plus an optional Layout representation, one explicit primary, deterministic first-occurrence dedup on the resolver's **canonical** identity, and refusal of an unknown/stale reference, an invalid representation or a primary outside the ordered value. The session owns one value; the retained Layout `selection()/select()` are projections of it, not a second store. The facade and adapter context add `selectionState()/setSelection()`, bindings add `selectionChanged`, Card subjects accept an F.1 reference, and the host requalifies every entry through accepted correspondence. |
| Lens/task exit lifetime | The route's lens setter only changed `lens`; no cancellation, no inactive task, no Resume. | The session owns lens, task status and a writer generation: `changeLens` parks the task and then cancels registered task/gesture/command/Camera writers exactly once; `resumeTask` requalifies the target against current content, refuses the wrong lens and an invalid configuration, and requires the owning adapter's `revalidate` **for a contributed task** (a directly opened host task carries no adapter configuration and resumes on target requalification alone). It never restores selection, view or proposals. The facade rebinds factory bindings on a lens transition and on a successful Resume, the coordinator gains an additive `cancelPending()`, the host registers pending accepts **and restores** as command writers (so work cancelled at lens exit cannot commit), and the route shows the inactive task with explicit Resume/Close in the lens where Resume can succeed. |

The three rows are implemented, exercised, reviewed and accepted: focused suites, the arch/full
lanes, the DB-backed API suites, a recorded browser session and four independent review rounds whose
findings were fixed across `4127b63f`, `4c831fc5`, `933bf285` and `ab8504aa` (see
[verification](./evidence/verification.md) and the [review section](./acceptance.md#independent-review)).
Nothing here is a new gate version, waiver, storage migration, second source/selection/history/Camera
authority or production Layout/Scene writer.

## What the review round changed

Independent passes over the increment raised lifetime, identity, refusal-message, robustness,
narrow-shell and reentrant-lens-exit findings; all were fixed across `4127b63f`, `4c831fc5`,
`933bf285` and `ab8504aa` (requalified
identities are canonical, accepted content cancels real task writers, task open/close no longer
aborts a concurrent accept, contributor throws are isolated, refusal messages name the actual
condition, the parked panel no longer covers the toolbar or the notice, and only a genuinely cleared
task is restored across a lens transition). The findings and their dispositions are listed in
[verification](./evidence/verification.md#am-5-increment--independent-review-round), and the scope
limits they clarified are in the [acceptance record](./acceptance.md#known-limits).

## What the browser run found and what was fixed

The new UI surfaces exposed three real defects, each fixed in code and re-verified in the same run:

1. **Panel buttons were unreachable.** The Experience-lens panel and the inactive-task banner sat
   inside the pointer-driven Stage without stopping pointer events, so the Stage captured the press
   and the button never received its click. Both panels now stop their own pointer/click events
   (the same rule the Stage toolbar already followed).
2. **The parked-task notice was covered.** It sat at the bottom-left of the Stage, underneath the
   selection Card, so Resume could not be clicked. It now sits at the top-left, away from the Card
   and the instrument.
3. **A Scene subject showed Layout-only Card facts.** `Eligible`, `Reveal` and `Datum` are Plan
   projections. A non-Layout subject now shows its `domain` and lets its own adapter contribute
   facts; the route's Plan-membership task refuses a non-Layout subject instead of opening a
   meaningless one. (The refusal lives in the route that owns that task kind, not in the session.)

## Bounded API amendment (approved)

The owner approved the bounded, backward-compatible extension in this file:

- a domain-neutral ordered/primary selection value using the existing F.1 reference, with the
  Layout helper preserved as a compatibility consumer (no `PlanSourceKind` growth);
- a source-independent accepted-read port, with explicit current-source adapters for
  current-format planners;
- explicit task active/inactive/Resume lifecycle and lens-exit cancellation at the single session
  owner.

The one public shape change is a widening, not a replacement: `StageAdapterServices.authoring.registerPlanner`
now accepts `DomainPlanner<unknown>` (a current-format planner stays assignable), and the host's
`registerPlanner` widened with it. `StageDomainRead.project`/`current` were **removed**; that is the
one intentional incompatibility, documented in the [acceptance record](./acceptance.md).

## Browser hook disposition

The approved plan explicitly permits a test-only conformance route hook when there is no production
writer. `vite.stage-conformance.config.ts` is selected only by an explicit local command. It injects
one test-owned adapter into the domain catalogue and a visible **Replace conformance starter** button
calling the existing replacement guard. The adapter now also contributes a Scene entity create
planner, a Scene scalar planner, an ordered-selection control, Scene Card facts, a selection echo,
and a Scene task whose configuration is revalidated on explicit Resume.

This hook needs no new exception: it uses the plan's existing allowance. Production output excludes
the probe writer, planners, instrument and replacement button —
[production-exclusion.json](./evidence/production-exclusion.json) scans every emitted file for all
probe sentinels and finds zero matches. No test-only hook is promoted to production or used to
excuse a contract requirement.
