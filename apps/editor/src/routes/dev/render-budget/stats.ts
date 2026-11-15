/**
 * E7's descriptive statistics and the proposed D9 budget classifier.
 *
 * Timing is descriptive evidence, never a test gate. `summarize` reports the
 * measured distribution; `budgetVerdict` applies the owner-facing proposal and
 * names the refusal in words. Nothing here caps a renderer at runtime.
 */
import type { FrameSample } from './probe';

export type Percentiles = {
	readonly p50: number;
	readonly p95: number;
	readonly max: number;
	readonly mean: number;
};

export type RunSummary = {
	readonly surface: 'stage' | 'preview';
	readonly world: string;
	readonly pattern: 'orbit' | 'drag' | 'rest';
	readonly windowMs: number;
	readonly renderedFrames: number;
	readonly frameIntervalsMs: Percentiles | null;
	readonly rafIntervalsMs: Percentiles | null;
	readonly calls: number;
	readonly triangles: number;
	readonly textures: number;
	readonly programs: number;
	readonly shadowPasses: number;
	readonly shadowMaps: number;
	readonly shadowPassesPerFrame: number;
	readonly shadowMapsPerFrame: number;
	readonly shadows: boolean;
	readonly callsP50: number;
	readonly callsP95: number;
	readonly trianglesP50: number;
	readonly trianglesP95: number;
};

function sorted(values: readonly number[]): number[] {
	return [...values].sort((left, right) => left - right);
}

/** Nearest-rank percentile: no interpolation, so a p95 is always an observed value. */
export function percentile(values: readonly number[], fraction: number): number {
	if (values.length === 0) return 0;
	const index = Math.min(values.length - 1, Math.max(0, Math.ceil(fraction * values.length) - 1));
	return sorted(values)[index]!;
}

export function percentiles(values: readonly number[]): Percentiles | null {
	if (values.length === 0) return null;
	const total = values.reduce((sum, value) => sum + value, 0);
	return {
		p50: percentile(values, 0.5),
		p95: percentile(values, 0.95),
		max: Math.max(...values),
		mean: total / values.length
	};
}

function intervals(times: readonly number[]): number[] {
	const result: number[] = [];
	for (let index = 1; index < times.length; index += 1) result.push(times[index]! - times[index - 1]!);
	return result;
}

export function summarize(input: {
	readonly surface: 'stage' | 'preview';
	readonly world: string;
	readonly pattern: 'orbit' | 'drag' | 'rest';
	readonly windowMs: number;
	readonly samples: readonly FrameSample[];
	readonly rafTimes: readonly number[];
	readonly shadows?: boolean;
}): RunSummary {
	const { samples } = input;
	const intervalsMs = intervals(samples.map((sample) => sample.time));
	const calls = samples.map((sample) => sample.calls);
	const triangles = samples.map((sample) => sample.triangles);
	const shadowPasses = samples.reduce((sum, sample) => sum + sample.shadowPasses, 0);
	const shadowMaps = samples.reduce((sum, sample) => sum + sample.shadowMaps, 0);
	const renderedFrames = samples.length;
	return {
		surface: input.surface,
		world: input.world,
		pattern: input.pattern,
		windowMs: input.windowMs,
		renderedFrames,
		frameIntervalsMs: percentiles(intervalsMs),
		rafIntervalsMs: percentiles(intervals(Array.from(input.rafTimes))),
		calls: calls.reduce((sum, value) => sum + value, 0),
		triangles: triangles.reduce((sum, value) => sum + value, 0),
		textures: samples.at(-1)?.textures ?? 0,
		programs: samples.at(-1)?.programs ?? 0,
		shadowPasses,
		shadowMaps,
		shadowPassesPerFrame: renderedFrames === 0 ? 0 : shadowPasses / renderedFrames,
		shadowMapsPerFrame: renderedFrames === 0 ? 0 : shadowMaps / renderedFrames,
		shadows: input.shadows ?? true,
		callsP50: percentile(calls, 0.5),
		callsP95: percentile(calls, 0.95),
		trianglesP50: percentile(triangles, 0.5),
		trianglesP95: percentile(triangles, 0.95)
	};
}

/** The proposed D9 budget. Display periods are milliseconds at the measured refresh. */
export type ShadowBudget = {
	readonly displayPeriodMs: number;
	readonly stageDragP95Ms: number;
	readonly visitIdleP95Ms: number;
	readonly galleryP95Ms: number;
	readonly shadowMapEdgePx: number;
	readonly castingLights: number;
};

export const PROPOSED_D9_BUDGET: ShadowBudget = {
	displayPeriodMs: 1000 / 60,
	stageDragP95Ms: (1000 / 60) * 2,
	visitIdleP95Ms: 1000 / 60,
	galleryP95Ms: 33,
	shadowMapEdgePx: 2048,
	castingLights: 1
};

export type BudgetVerdict = {
	readonly within: boolean;
	readonly label: string;
	readonly reason: string;
};

/**
 * Apply the proposal to one measured run. A run is within budget only when its
 * p95 exists and is at or below the named surface target; missing frames are
 * never a pass.
 */
export function budgetVerdict(summary: RunSummary, budget: ShadowBudget = PROPOSED_D9_BUDGET): BudgetVerdict {
	const target =
		summary.surface === 'stage'
			? summary.pattern === 'orbit'
				? budget.stageDragP95Ms
				: budget.stageDragP95Ms
			: summary.pattern === 'rest'
				? budget.visitIdleP95Ms
				: budget.visitIdleP95Ms;
	const p95 = summary.frameIntervalsMs?.p95;
	if (p95 === undefined) return { within: false, label: 'unmeasured', reason: 'no rendered frame in the window' };
	const within = p95 <= target;
	return {
		within,
		label: within ? 'within' : 'over',
		reason: `${summary.surface}/${summary.pattern} p95 ${p95.toFixed(2)} ms against ${target.toFixed(2)} ms`
	};
}
