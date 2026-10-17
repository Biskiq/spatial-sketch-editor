/**
 * Host-owned calibration for the landed `layout.plan@1` family.
 *
 * The Plan parameters are **provider calibration**, not authored Layout. The
 * default cut height (1.2 m above the level datum) and depth (100 m below it)
 * live here, with the host, and are copyable into no authored document: the
 * `evaluateLayoutPlan` evaluator takes them as input, and authored Layout keeps
 * carrying only walls, openings and objects.
 *
 * Lateral coverage defaults to **explicit unbounded** (`lateralSpanHalfWidthMeters`
 * `null`). The evaluator's own contract defines a finite `lateral-span` as a
 * half-width around the inspection target; the host only supplies the value when a
 * producer actually asks for a bounded plan.
 */
import type { PlanParameters, PlanSourceKind } from '@portfolio/layout-core';

/** The calibrated default cut height above the level datum, in meters. */
export const PLAN_DEFAULT_CUT_HEIGHT_METERS = 1.2;

/** The calibrated default depth below the cut plane, in meters (required, > 0). */
export const PLAN_DEFAULT_DEPTH_METERS = 100;

export type PlanParameterOverrides = {
	readonly cutHeightMeters?: number;
	readonly depthMeters?: number;
	readonly lateralSpanHalfWidthMeters?: number | null;
	readonly sourceKindFilter?: readonly PlanSourceKind[] | null;
	readonly reveal?: readonly string[];
};

/**
 * Compose one Plan evaluation's parameters from the calibrated defaults.
 *
 * A reveal set is carried through verbatim (it is a union of declared source
 * ids); the defaults never invent one, so Reveal is always an explicit creator
 * action.
 */
export function planParameters(overrides: PlanParameterOverrides = {}): PlanParameters {
	return {
		cutHeightMeters: overrides.cutHeightMeters ?? PLAN_DEFAULT_CUT_HEIGHT_METERS,
		depthMeters: overrides.depthMeters ?? PLAN_DEFAULT_DEPTH_METERS,
		lateralSpanHalfWidthMeters:
			overrides.lateralSpanHalfWidthMeters === undefined ? null : overrides.lateralSpanHalfWidthMeters,
		sourceKindFilter:
			overrides.sourceKindFilter === undefined ? null : overrides.sourceKindFilter,
		reveal: overrides.reveal ?? []
	};
}
