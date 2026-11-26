/**
 * Layout-owned **ordinary horizontal Plan representation** (the landed
 * `layout.plan@1` family: `cut-height`, required `depth`, optional
 * `lateral-span`, `source-kind-filter` and union `reveal`).
 *
 * This is a representation, not a projection and not a compiler. It reads one
 * already-compiled `CompiledLayoutGeometry` and answers, per source, which plan
 * stream a fragment belongs to, what its correspondence is, and — when the source
 * is excluded — why. Nothing here re-samples a curve, extracts topology, mutates
 * the compiled input or reads `LayoutDocument`: the compiled canonical curves and
 * hosted intervals are the geometry, and cut/hide/show changes neither authored
 * topology nor source ownership.
 *
 * **Why the correspondence is Layout-native.** `@portfolio/layout-core` sits
 * below `@portfolio/project-model`, which depends on it, so this module cannot
 * import the landed F.1 `DerivedSourceRef` and must not introduce a dependency
 * cycle or a copy of that type. `PlanSourceRef` therefore speaks Layout-native
 * source ids plus the caller's opaque compile generation, and mirrors the landed
 * `DerivedSourceRef` **field shape exactly** (`source`/`generationId`/`stream`/
 * `subRef`, and a `subRef` of kind `component` or `interval`) so the
 * project-model/host boundary qualifies it into `DerivedSourceRef` field for
 * field. The sub-reference vocabulary is the landed one and only that one: a Wall
 * side, if a fragment ever needs one, is a Layout-declared `componentId`, and an
 * interval names a distance range along the owning source's canonical sampled arc
 * (an Opening span is one). A new sub-reference kind is an F.1 extension, not
 * latitude this module may take.
 *
 * **Depth is downward from the cut plane.** `cutHeightMeters` is relative to the
 * level datum (never absolute project-world Y); the cut plane is
 * `datumMeters + cutHeightMeters`, and `depthMeters` measures *below* it. A source
 * whose highest point is more than `depthMeters` below the cut plane is
 * `outside-depth`, exactly as a section cut is bounded from below. The
 * provider-calibrated defaults (a 1.2 m cut and a 100 m depth, unbounded lateral
 * coverage when `lateralSpanHalfWidthMeters` is `null`) live in the host, never in
 * authored Layout.
 *
 * **Membership is measured, then revealed.** One membership row per compiled
 * source reports the *declared* reason (`included`, `filtered-type`,
 * `outside-depth`, `outside-span`, `no-meaningful-projection`) plus the measured
 * values behind it, so an excluded source is discoverable without parsing a
 * reason string. `reveal` is the union of declared source identities whose
 * display/hit eligibility is temporarily widened: it flips `eligible` and marks
 * `revealed`, and it never rewrites the declared reason, never changes `depth` or
 * `lateral-span`, and never enters history. A revealed source with nothing to draw
 * still emits no fragment — eligibility is not geometry.
 *
 * Runtime-safe and pure: relative package-internal imports only, no editor,
 * renderer, Svelte or Three dependency, and no mutation of the supplied compiled
 * geometry.
 */

export {
	PLAN_STREAMS,
	PLAN_SOURCE_KINDS,
	PLAN_MEMBERSHIP_REASONS,
	PLAN_SUB_REF_KINDS,
} from './representation/types';
export type {
	PlanStream,
	PlanSourceKind,
	PlanMembershipReason,
	PlanSubRef,
	PlanSourceRef,
	PlanParameters,
	PlanSourceContext,
	PlanFragmentGeometry,
	PlanFragment,
	PlanSourceMembership,
	PlanStreams,
	PlanEvaluation,
	PlanIssue,
	PlanEvaluationResult,
} from './representation/types';
export {
	planDependsOnTarget,
	planTargetsLiveView,
	evaluateLayoutPlan,
	eligiblePlanFragments,
	planMembershipOf,
	planFragmentOf,
} from './representation/membership';
export { createPlanRetainer } from './representation/retainer';
export type { PlanRetainer } from './representation/retainer';
export { openingPlanSymbol, openingAttemptSymbolSource } from './representation/symbols';
export type {
	OpeningPlanSymbolSource,
	OpeningPlanSymbolSegment,
	OpeningPlanSymbol,
} from './representation/symbols';
