import type { Vec3 } from '@portfolio/camera-core';
import {
	createPlanRetainer, eligiblePlanFragments, planDependsOnTarget, planTargetsLiveView,
	type LayoutVec2, type PlanEvaluationResult, type PlanFragment, type PlanParameters
} from '@portfolio/layout-core';
import type { StageReadSnapshot } from '../accepted-read';
import { planParameters, type PlanParameterOverrides } from '../plan-parameters';

type PlanSource = Pick<StageReadSnapshot, 'compileGeneration'> & {
	readonly domain: Pick<StageReadSnapshot['domain'], 'datumMeters' | 'geometry'>;
};

/** One Plan retainer and its live parameters for the facade lifetime. */
export function createPlanView(input: {
	readonly snapshot: () => PlanSource;
	readonly target: () => Vec3;
}) {
	/** The host's live Plan parameters: calibration defaults plus what the host set. */
	let planOverrides: PlanParameterOverrides = {};
	/**
	 * The retained Plan evaluation, with the exact inputs it was produced from.
	 *
	 * **Why retention is exact.** An evaluation's only target-dependent output is
	 * its echoed `target` unless the lateral span is bounded
	 * (`planDependsOnTarget`), and the shipped provider default is explicit
	 * unbounded coverage. So a moving inspection target — every pan frame — names
	 * the same fragments, the same membership, the same streams and the same
	 * bounds. Re-deriving them is work proportional to the project for a change
	 * that is provably worth none of it.
	 *
	 * The retained evaluation reports the **live** target through
	 * `planTargetsLiveView`, so the field is never stale while the object identity
	 * stays fixed: nothing downstream re-derives on a pan either.
	 *
	 * A non-finite target is never served from here. The parameter boundary refuses
	 * it, and a cache that answered "evaluated" for a target no evaluation could
	 * accept would be a correctness bug dressed as an optimisation.
	 */
	let retainedPlan: { readonly key: string; readonly result: PlanEvaluationResult } | null = null;

	/**
	 * The Plan evaluator, kept across accepted edits.
	 *
	 * The key above answers "is this the same evaluation?". This answers the harder
	 * question a new generation asks: "which sources did the edit actually change?".
	 * An accepted Wall move changes the compile generation, and therefore every
	 * fragment's `ref`, so the fragment array is necessarily rebuilt — but the
	 * *derivation* behind each source (its placement, stream and membership row) is
	 * unchanged for every source the edit did not touch. The retainer keeps those and
	 * is handed only the work that is new, so a commit no longer re-sorts, re-measures
	 * and re-groups the whole project to place one Wall.
	 *
	 * It is one retainer for the facade's lifetime, not one per evaluation: its value
	 * is exactly what it remembers between them.
	 */
	const planRetainer = createPlanRetainer();

	function liveTarget(): LayoutVec2 {
		const target = input.target();
		return [target[0], target[2]];
	}

	/**
	 * Everything an evaluation reads, in one string. `target` appears only when the
	 * parameters or the target itself make it an input.
	 *
	 * Lists are JSON-encoded only when non-empty, so the ordinary frame (no filter,
	 * no reveal) does no serialization at all — and a non-empty list cannot be made
	 * ambiguous by a source id containing the separator.
	 */
	function planRetentionKey(snapshot: PlanSource, parameters: PlanParameters, target: LayoutVec2, targetMatters: boolean): string {
		const span =
			parameters.lateralSpanHalfWidthMeters === null ? 'u' : `b${parameters.lateralSpanHalfWidthMeters}`;
		const filter =
			parameters.sourceKindFilter === null ? '' : `f${JSON.stringify(parameters.sourceKindFilter)}`;
		const reveal = parameters.reveal.length === 0 ? '' : `r${JSON.stringify(parameters.reveal)}`;
		return [
			snapshot.compileGeneration,
			snapshot.domain.datumMeters,
			parameters.cutHeightMeters,
			parameters.depthMeters,
			span,
			filter,
			reveal,
			targetMatters ? `t${target[0]}:${target[1]}` : ''
		].join('|');
	}

	/** The effective Plan parameters, as the retention key sees them. */
	function effectivePlanContext(): { parameters: PlanParameters; target: LayoutVec2; finiteTarget: boolean } {
		const parameters = planParameters(planOverrides);
		const target = liveTarget();
		return { parameters, target, finiteTarget: Number.isFinite(target[0]) && Number.isFinite(target[1]) };
	}

	function planFor(overrides?: PlanParameterOverrides): PlanEvaluationResult {
		const parameters = planParameters(overrides ?? planOverrides);
		const target = liveTarget();
		const finiteTarget = Number.isFinite(target[0]) && Number.isFinite(target[1]);
		const targetMatters = planDependsOnTarget(parameters) || !finiteTarget;
		const currentSnapshot = input.snapshot();
		if (finiteTarget) {
			const key = planRetentionKey(currentSnapshot, parameters, target, targetMatters);
			if (retainedPlan !== null && retainedPlan.key === key) return retainedPlan.result;
			const result = planRetainer.evaluate(currentSnapshot.domain.geometry, parameters, {
				generationId: currentSnapshot.compileGeneration,
				target,
				datumMeters: currentSnapshot.domain.datumMeters
			});
			const retained: PlanEvaluationResult =
				result.kind === 'evaluated' && !targetMatters
					? { kind: 'evaluated', plan: planTargetsLiveView(result.plan, liveTarget) }
					: result;
			retainedPlan = { key, result: retained };
			return retained;
		}
		// A non-finite target is the parameter boundary's refusal to make, not a
		// cache hit's; it is never retained.
		return planRetainer.evaluate(currentSnapshot.domain.geometry, parameters, {
			generationId: currentSnapshot.compileGeneration,
			target,
			datumMeters: currentSnapshot.domain.datumMeters
		});
	}

	function planDependencyKey(): string {
		const snapshot = input.snapshot();
		const { parameters, target, finiteTarget } = effectivePlanContext();
		// A non-finite target is never retained, so its key must differ from every
		// retained one; the boundary refuses it on the next `plan()` call either way.
		if (!finiteTarget) return `${planRetentionKey(snapshot, parameters, target, false)}|non-finite`;
		return planRetentionKey(snapshot, parameters, target, planDependsOnTarget(parameters));
	}

	function setPlanParameters(overrides: PlanParameterOverrides): void {
		planOverrides = { ...planOverrides, ...overrides };
	}

	function eligibleFragments(): readonly PlanFragment[] {
		const result = planFor();
		return result.kind === 'evaluated' ? eligiblePlanFragments(result.plan) : [];
	}

	return {
		plan: planFor,
		planDependencyKey,
		setPlanParameters,
		eligibleFragments
	};
}
