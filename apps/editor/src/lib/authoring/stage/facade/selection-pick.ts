import type { ViewportEvaluation, WorkingPlane } from '@portfolio/camera-core';
import { perfMark, perfMarksEnabled } from '$lib/platform/perf-marks';
import { sameReference, type StageSelectionEntry } from '../semantic-selection';
import { hitStageMark, type StageMarkView } from '../stage-handles';
import { resolveStagePick } from '../stage-pick';
import type { AdapterContextHandle, BoundAdapter } from './adapter-bindings';
import type { ResolvedStageHit, StageFacade } from './view-contract';

/** The working plane the Plan hit path intersects: the level datum, unbounded. */
export function datumWorkingPlane(datumMeters: number): WorkingPlane {
	return {
		originMeters: [0, datumMeters, 0],
		normal: [0, 1, 0],
		yawRadians: 0,
		datumMeters,
		supportedLocalExtent: null
	};
}

/**
 * The binding that publishes the selected subject.
 *
 * A reference's domain is not always the adapter id: T2's Light adapter owns
 * light entities inside the Scene domain, while the Scene adapter deliberately
 * excludes them. Prefer a binding whose subject list contains the reference;
 * fall back to the domain binding for subjects an adapter does not enumerate.
 */
export function adapterForSelection(adapters: ReadonlyMap<string, BoundAdapter>, entry: StageSelectionEntry) {
	const direct = adapters.get(entry.reference.domain);
	const owns = (candidate: NonNullable<typeof direct>): boolean =>
		candidate.contributions.subjects?.some((subject) =>
			sameReference(subject.reference, entry.reference)
		) ?? false;
	if (direct !== undefined && (direct.contributions.subjects === undefined || owns(direct))) {
		return direct;
	}
	for (const [adapterId, candidate] of adapters) {
		if (adapterId !== entry.reference.domain && owns(candidate)) return candidate;
	}
	return direct;
}

type SelectionPickPort = {
	readonly adapters: ReadonlyMap<string, BoundAdapter>;
	readonly adapterContext: () => AdapterContextHandle | null;
	readonly ensureBindings: () => void;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly idOf: (evaluation: ViewportEvaluation) => string;
	readonly isLive: () => boolean;
	readonly selectionMarks: () => readonly StageMarkView[];
	readonly idleMarks: () => readonly StageMarkView[];
	readonly toolOwner: () => string | null;
};

/** Qualify hits against the live viewport and the current domain pick providers. */
export function createSelectionPick(input: SelectionPickPort) {
	const { adapters, adapterContext, ensureBindings, isLive } = input;

	const resolvePick: StageFacade['resolvePick'] = (query, toolOwner = null) => {
		const started = perfMarksEnabled() ? performance.now() : null;
		let result: ResolvedStageHit = { kind: 'none', reason: 'no-fragment' };
		try {
			const evaluation = input.evaluation();
			if (evaluation === null || input.idOf(evaluation) !== query.evaluationId) return result = { kind: 'failed', code: 'stale-evaluation' };
			if (!query.css.every(Number.isFinite)) return result = { kind: 'failed', code: 'invalid-css-point' };
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return result;
			// The mark tier sits above world candidates. A host tool (Measure, Eraser)
			// asks the world, not the selection's manipulation language.
			if (query.purpose !== 'tool') {
				const mark = hitStageMark(input.selectionMarks(), { css: query.css, coarse: query.coarse === true });
				if (mark !== null) return result = { kind: 'mark', mark: mark.mark };
			}
			const winner = resolveStagePick(query, [...adapters].map(([adapterId, entry]) => ({ adapterId, binding: entry.contributions })), handle.context, evaluation.renderedReading === 'plan' ? 'plan' : '3d', toolOwner ?? input.toolOwner() ?? null);
			if (winner === null) return result;
			return result = winner.pick.refusal === null
				? { kind: 'resolved', hit: winner.pick.hit }
				: { kind: 'refused', hit: winner.pick.hit, message: winner.pick.refusal };
		} finally {
			if (started !== null) perfMark('stage:pick', { elapsedMs: performance.now() - started, outcome: result.kind,
				sourceId: result.kind === 'resolved' ? result.hit.sourceId : null,
				sourceKind: result.kind === 'resolved' ? result.hit.sourceKind : null });
		}
	};
	const hostToolTarget: StageFacade['hostToolTarget'] = (query) => {
		const evaluation = input.evaluation();
		if (evaluation === null || input.idOf(evaluation) !== query.evaluationId) return { kind: 'failed', code: 'stale-evaluation' };
		if (!query.css.every(Number.isFinite)) return { kind: 'failed', code: 'invalid-css-point' };
		ensureBindings();
		const handle = adapterContext();
		if (handle === null) return { kind: 'none', datumPoint: null };
		try {
			const context = handle.context;
			const ray = context.ray([query.css[0] + evaluation.rect.left, query.css[1] + evaluation.rect.top]);
			const plane = ray === null ? null : context.intersect(ray, datumWorkingPlane(context.snapshot.domain.datumMeters));
			const datumPoint = plane?.kind === 'intersected' ? plane.worldPoint : null;
			const winner = resolveStagePick(
				{ evaluationId: query.evaluationId, css: query.css, purpose: 'tool', tool: { kind: query.tool, scope: 'host' }, ...(query.coarse === undefined ? {} : { coarse: query.coarse }) },
				[...adapters].map(([adapterId, entry]) => ({ adapterId, binding: entry.contributions })),
				context,
				evaluation.renderedReading === 'plan' ? 'plan' : '3d'
			);
			if (winner === null) return { kind: 'none', datumPoint };
			return { kind: 'hit', adapterId: winner.adapterId, hit: winner.pick.hit, refusal: winner.pick.refusal, datumPoint };
		} finally {
			handle.end();
		}
	};
	const eraseAnswer: StageFacade['eraseAnswer'] = (adapterId, hit) => {
		if (!isLive()) return null;
		const entry = adapters.get(adapterId);
		if (entry === undefined || !entry.contributions.hostTools?.includes('erase')) return null;
		try {
			return entry.contributions.eraseAction?.(hit) ?? null;
		} catch {
			// A throwing contributor erases nothing, as everywhere else in this host.
			return null;
		}
	};
	const hitMark: StageFacade['hitMark'] = (query) => {
		return hitStageMark(input.selectionMarks(), query);
	};

	return {
		resolvePick,
		hostToolTarget,
		eraseAnswer,
		hitMark,
		hitIdleMark: (css: readonly [number, number]) => hitStageMark(input.idleMarks(), { css, coarse: false }),
	};
}
