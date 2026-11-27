import type { CompiledLayoutGeometry } from '../../geometry/types';
import { LAYOUT_SLICE_CONTACT_METERS } from '../../room/region-validation';
import type { LayoutVec2 } from '../../geometry/coordinates';
import {
	boundsOf,
	compareFragments,
	compareSourceIds,
	hasPlanGeometry,
	objectCandidates,
	openingCandidates,
	planDistance,
	roomFloorCandidates,
	streamFor,
	wallCandidates,
} from './geometry';
import { regionCandidatesOf, regionSectionPlan } from './region-section';
import type {
	Candidate,
	Evaluated,
	PlanEvaluation,
	PlanEvaluationResult,
	PlanFragment,
	PlanIssue,
	PlanMembershipReason,
	PlanParameters,
	PlanSourceContext,
	PlanSourceKind,
	PlanSourceMembership,
	PlanStream,
	PlanStreams,
	PlanSubRef,
	SourcePlan,
} from './types';
import { PLAN_SOURCE_KINDS } from './types';

export function isFiniteNumber(value: number): boolean {
	return typeof value === 'number' && Number.isFinite(value);
}

export function finiteVec2(value: LayoutVec2 | undefined): boolean {
	return value !== undefined && isFiniteNumber(value[0]) && isFiniteNumber(value[1]);
}

/** Parameter validation is a defensive boundary, not a second schema for the family. */
export function parameterIssues(
	parameters: PlanParameters,
	context: PlanSourceContext,
): PlanIssue[] {
	const issues: PlanIssue[] = [];
	const push = (path: string, code: string, message: string): void => {
		issues.push({ path, code, message });
	};
	if (!isFiniteNumber(parameters.cutHeightMeters)) {
		push(
			'$.cutHeightMeters',
			'non-finite-number',
			'the cut height must be a finite number of meters relative to the level datum',
		);
	}
	if (!isFiniteNumber(parameters.depthMeters) || parameters.depthMeters <= 0) {
		push(
			'$.depthMeters',
			'out-of-range',
			'the depth is required and must be a finite number of meters greater than zero',
		);
	}
	if (parameters.lateralSpanHalfWidthMeters !== null) {
		if (
			!isFiniteNumber(parameters.lateralSpanHalfWidthMeters) ||
			parameters.lateralSpanHalfWidthMeters <= 0
		) {
			push(
				'$.lateralSpanHalfWidthMeters',
				'out-of-range',
				'a declared lateral span must be a finite half-width greater than zero, or null for unbounded coverage',
			);
		}
	}
	if (parameters.sourceKindFilter !== null) {
		if (parameters.sourceKindFilter.length === 0) {
			push(
				'$.sourceKindFilter',
				'invalid-value',
				'a declared source-kind filter must admit at least one kind, or be null for no filter',
			);
		}
		for (const [index, kind] of parameters.sourceKindFilter.entries()) {
			if (!(PLAN_SOURCE_KINDS as readonly string[]).includes(kind)) {
				push(
					`$.sourceKindFilter[${index}]`,
					'unknown-tag',
					`"${kind}" is not an admitted plan source kind`,
				);
			}
		}
	}
	if (context.generationId.trim() === '') {
		push(
			'$.context.generationId',
			'invalid-identity',
			'the compile generation must be a nonempty identity',
		);
	}
	if (!finiteVec2(context.target)) {
		push(
			'$.context.target',
			'invalid-vector',
			'the inspection target must be a finite project-world XZ pair',
		);
	}
	if (!isFiniteNumber(context.datumMeters)) {
		push(
			'$.context.datumMeters',
			'non-finite-number',
			'the level datum must be a finite number of project-world meters',
		);
	}
	return issues;
}

/**
 * Source-indexed access to one evaluation, for the evaluator that produced it.
 *
 * A retainer keeps each source's derivation, so "where is source X" and "what is X's
 * membership" do not require the complete `fragments` or `membership` arrays to exist.
 * This is what lets an interactive host ask the two questions it actually asks — the
 * selected subject's fragment, the selected subject's row — without materializing the
 * whole output on every accepted edit. The arrays still exist for any consumer that
 * asks for them; they are built on first read and then cached.
 */
type PlanView = {
	readonly fragmentOf: (sourceId: string) => PlanFragment | undefined;
	readonly membershipOf: (sourceId: string) => PlanSourceMembership | null;
};

export const PLAN_VIEWS = new WeakMap<PlanEvaluation, PlanView>();

/**
 * Does this evaluation read `context.target` for anything but its own echo?
 *
 * The evaluator measures `planDistance(target, candidate.plan)` in exactly one
 * place: the `lateral-span` membership stage. With explicit unbounded lateral
 * coverage (`lateralSpanHalfWidthMeters === null`, the provider default) the only
 * target-dependent field of the result is `PlanEvaluation.target` itself.
 *
 * This is the predicate a host caches on, not an optimisation knob: a caller that
 * retains one evaluation while the inspection target moves is exact **iff** this
 * returns `false`. It says nothing about a non-finite target, which the parameter
 * boundary refuses before any candidate is measured; a host that may see one must
 * not serve it from a retained evaluation.
 */
export function planDependsOnTarget(parameters: PlanParameters): boolean {
	return parameters.lateralSpanHalfWidthMeters !== null;
}

/**
 * The same Plan evaluation with a live inspection target.
 *
 * The fragments, membership, streams, bounds and every measurement are the ones
 * already computed — this adds no geometry and re-derives nothing — so it is only
 * exact for an evaluation whose `planDependsOnTarget` is `false`. It exists so a
 * host can keep one evaluation object's **identity** stable across a pan (nothing
 * downstream re-derives) while `plan.target` still reports where the inspection
 * actually is, rather than the target it was first evaluated at.
 *
 * `readTarget` is consulted on every property read and must return the live
 * project-world XZ. A non-finite reading falls back to the evaluated target: the
 * parameter boundary refuses a non-finite target, so an evaluated plan can never
 * honestly report one.
 */
export function planTargetsLiveView(
	plan: PlanEvaluation,
	readTarget: () => LayoutVec2,
): PlanEvaluation {
	const evaluatedTarget = plan.target;
	// The descriptors are copied, **not** the values: a spread would force every lazy
	// field of the evaluation it wraps, which is exactly the work a pan must not cause.
	const live = Object.create(
		Object.getPrototypeOf(plan) as object,
		Object.getOwnPropertyDescriptors(plan),
	) as PlanEvaluation;
	Object.defineProperty(live, 'target', {
		configurable: true,
		enumerable: true,
		get(): LayoutVec2 {
			const current = readTarget();
			return isFiniteNumber(current[0]) && isFiniteNumber(current[1]) ? current : evaluatedTarget;
		},
	});
	// The live view answers the same source questions as the evaluation it wraps.
	const view = PLAN_VIEWS.get(plan);
	if (view !== undefined) PLAN_VIEWS.set(live, view);
	return live;
}

/**
 * Everything one candidate's membership measurement reads, resolved once per
 * evaluation. Shared by the reference evaluator and the incremental retainer so
 * the stages a candidate passes through have exactly one definition.
 */
export type MeasurementContext = {
	readonly datumMeters: number;
	readonly cutElevation: number;
	readonly depthMeters: number;
	readonly lateralSpanHalfWidthMeters: number | null;
	readonly filter: ReadonlySet<PlanSourceKind> | null;
	readonly reveal: ReadonlySet<string>;
	readonly target: LayoutVec2;
};

export function measurementContext(
	parameters: PlanParameters,
	context: PlanSourceContext,
): MeasurementContext {
	return {
		datumMeters: context.datumMeters,
		cutElevation: context.datumMeters + parameters.cutHeightMeters,
		depthMeters: parameters.depthMeters,
		lateralSpanHalfWidthMeters: parameters.lateralSpanHalfWidthMeters,
		filter: parameters.sourceKindFilter === null ? null : new Set(parameters.sourceKindFilter),
		reveal: new Set(parameters.reveal),
		target: context.target,
	};
}

/** Measure one candidate: the declared reason it earned, and the placement it places. */
export function measureCandidate(candidate: Candidate, context: MeasurementContext): Evaluated {
	const verticalExtent = candidate.extent.maxY - candidate.extent.minY;
	const depthBelowCut =
		candidate.extent.maxY >= context.cutElevation
			? null
			: context.cutElevation - candidate.extent.maxY;
	const lateralDistance =
		context.lateralSpanHalfWidthMeters === null
			? null
			: planDistance(context.target, candidate.plan);
	const hasGeometry = hasPlanGeometry(candidate.plan);

	// One declared reason per candidate, in a fixed precedence order, so a consumer never
	// has to guess which of two true exclusions was reported. The measured values are
	// reported beside the reason either way.
	let reason: PlanMembershipReason = 'included';
	if (context.filter !== null && !context.filter.has(candidate.sourceKind)) {
		reason = 'filtered-type';
	} else if (
		depthBelowCut !== null &&
		depthBelowCut > context.depthMeters + (candidate.regionRole ? LAYOUT_SLICE_CONTACT_METERS : 0)
	) {
		reason = 'outside-depth';
	} else if (
		context.lateralSpanHalfWidthMeters !== null &&
		lateralDistance !== null &&
		lateralDistance > context.lateralSpanHalfWidthMeters
	) {
		reason = 'outside-span';
	} else if (!hasGeometry || !Number.isFinite(verticalExtent) || verticalExtent < 0) {
		reason = 'no-meaningful-projection';
	}

	const revealed = context.reveal.has(candidate.sourceId);
	const eligible = reason === 'included' || revealed;
	// No geometry means no stream: a revealed source with nothing to project stays a
	// membership row and never becomes an empty primitive a consumer must defend against.
	const stream: PlanStream | null = hasGeometry
		? candidate.symbolOnly
			? 'symbol'
			: streamFor(candidate, context.cutElevation)
		: null;
	const placement =
		!eligible || stream === null
			? null
			: {
					stream,
					elevationMeters:
						stream === 'cut'
							? context.cutElevation
							: candidate.regionRole
								? stream === 'hidden'
									? candidate.extent.minY
									: candidate.extent.maxY
								: stream === 'projected'
									? candidate.extent.minY
									: candidate.extent.maxY,
				};
	if (candidate.regionRole && stream !== null) {
		const face =
			stream === 'cut'
				? 'edge'
				: candidate.regionRole === 'overhead' &&
						(stream === 'hidden' ||
							context.cutElevation <= candidate.extent.minY + LAYOUT_SLICE_CONTACT_METERS)
					? 'underside'
					: 'top';
		const plan =
			stream === 'cut' ? regionSectionPlan(candidate, context.cutElevation) : candidate.plan;
		const outlined =
			stream === 'hidden' || (stream === 'projected' && candidate.regionRole === 'overhead');
		candidate = {
			...candidate,
			subRef: { kind: 'component', componentId: face },
			plan:
				outlined && plan.kind === 'polygon'
					? { kind: 'polyline', polyline: [...plan.polygon, plan.polygon[0]!] }
					: plan,
		};
		if (placement && face === 'underside') placement.elevationMeters = candidate.extent.minY;
	}
	return { candidate, reason, depthBelowCut, lateralDistance, eligible, revealed, placement };
}

/**
 * One membership row for a source, from its measured candidates in declared order.
 *
 * Membership is a **per-source** fact while a compiled source can have several
 * placements — a Wall has one row for all of its solid spans — so the row aggregates
 * them: included when any placement is, the declared reason of the first included one
 * (else the first), the deepest extent that fell out of the depth window, and the
 * nearest witness to the inspection target.
 */
export function sourceMembership(
	sourceId: string,
	entries: readonly Evaluated[],
): PlanSourceMembership {
	const first = entries[0]!;
	const included = entries.find((entry) => entry.reason === 'included');
	const reason = included?.reason ?? first.reason;
	const revealed = entries.some((entry) => entry.revealed);
	const depths = entries
		.map((entry) => entry.depthBelowCut)
		.filter((value): value is number => value !== null);
	const laterals = entries
		.map((entry) => entry.lateralDistance)
		.filter((value): value is number => value !== null);
	return {
		sourceId,
		sourceKind: first.candidate.sourceKind,
		reason,
		eligible: reason === 'included' || revealed,
		revealed,
		// The source-level measurements are the ones a consumer needs to act on: the
		// deepest extent that fell out of the window, and the nearest witness to the target.
		depthBelowCutMeters: depths.length > 0 ? Math.max(...depths) : null,
		lateralDistanceMeters: laterals.length > 0 ? Math.min(...laterals) : null,
	};
}

/**
 * Evaluate the ordinary horizontal Plan for one compiled Layout.
 *
 * Pure and deterministic: the same compiled geometry, parameters and context give
 * byte-identical output, the compiled input is never written, and ordering depends
 * only on stable source identity, never on array order or a display label.
 *
 * This is the **normative** definition of the family: it measures every candidate, sorts
 * the sources and the fragments, and materializes everything. `createPlanRetainer`
 * computes the same output incrementally; this function is its oracle, and the one a
 * caller that has a single evaluation to make should use.
 */
export function evaluateLayoutPlan(
	compiled: CompiledLayoutGeometry,
	parameters: PlanParameters,
	context: PlanSourceContext,
): PlanEvaluationResult {
	const issues = parameterIssues(parameters, context);
	if (issues.length > 0) {
		const invalidContext = issues.every((issue) => issue.path.startsWith('$.context'));
		return {
			kind: 'refused',
			code: invalidContext ? 'invalid-context' : 'invalid-parameters',
			issues,
		};
	}

	const measurement = measurementContext(parameters, context);
	const candidates: readonly Candidate[] = [
		...wallCandidates(compiled, context.datumMeters),
		...openingCandidates(compiled, context.datumMeters),
		...objectCandidates(compiled),
		...roomFloorCandidates(compiled),
		...compiled.regions
			.flatMap(regionCandidatesOf)
			.sort(compareSourceIds((candidate) => candidate.sourceId)),
	];

	const fragments: PlanFragment[] = [];
	const membership: PlanSourceMembership[] = [];

	// Stage one: measure each candidate independently and record the placement it earned.
	// Nothing is emitted yet, because membership is a **per-source** fact while a compiled
	// source can have several placements — a Wall has one row for all of its solid spans.
	const evaluated: Evaluated[] = candidates.map((candidate) =>
		measureCandidate(candidate, measurement),
	);

	// Stage two: one membership row per source, and a fragment only where that source's
	// eligible placement exists. A source is included when **any** of its placements is: the
	// depth window excludes the parts of a Wall that fall outside it, not the whole Wall.
	const sourceOrder: string[] = [];
	const bySource = new Map<string, Evaluated[]>();
	for (const entry of evaluated) {
		const list = bySource.get(entry.candidate.sourceId);
		if (list === undefined) {
			bySource.set(entry.candidate.sourceId, [entry]);
			sourceOrder.push(entry.candidate.sourceId);
		} else {
			list.push(entry);
		}
	}

	for (const sourceId of sourceOrder) {
		const entries = bySource.get(sourceId) ?? [];
		if (entries.length === 0) continue;
		const row = sourceMembership(sourceId, entries);
		membership.push(row);
		for (const entry of entries) {
			if (!entry.eligible || entry.placement === null) continue;
			fragments.push(
				fragmentFor(
					context.generationId,
					entry.candidate.sourceId,
					entry.candidate.sourceKind,
					entry.candidate.subRef,
					entry.candidate.plan,
					entry.placement.stream,
					row.reason,
					entry.placement.elevationMeters,
				),
			);
		}
	}

	fragments.sort(compareFragments);
	const streams: PlanStreams = {
		cut: fragments.filter((fragment) => fragment.ref.stream === 'cut'),
		projected: fragments.filter((fragment) => fragment.ref.stream === 'projected'),
		hidden: fragments.filter((fragment) => fragment.ref.stream === 'hidden'),
		symbol: fragments.filter((fragment) => fragment.ref.stream === 'symbol'),
	};

	return {
		kind: 'evaluated',
		plan: {
			generationId: context.generationId,
			datumMeters: context.datumMeters,
			cutHeightMeters: parameters.cutHeightMeters,
			cutElevationMeters: measurement.cutElevation,
			depthMeters: parameters.depthMeters,
			lateralSpanHalfWidthMeters: parameters.lateralSpanHalfWidthMeters,
			target: context.target,
			sourceKindFilter:
				parameters.sourceKindFilter === null ? null : [...parameters.sourceKindFilter],
			reveal: [...parameters.reveal],
			streams,
			fragments,
			membership,
			// A reveal id matches when it names a compiled source. Every compiled source
			// produces at least one candidate, so the candidate grouping is the same set.
			unmatchedRevealIds: [...measurement.reveal].filter((id) => !bySource.has(id)).sort(),
			bounds: boundsOf(fragments),
		},
	};
}

/** One fragment, from the fields both evaluators already hold. */
export function fragmentFor(
	generationId: string,
	sourceId: string,
	sourceKind: PlanSourceKind,
	subRef: PlanSubRef | null,
	plan: SourcePlan,
	stream: PlanStream,
	membership: PlanMembershipReason,
	elevationMeters: number,
): PlanFragment {
	return {
		ref: { sourceId, sourceKind, generationId, stream, subRef },
		elevationMeters,
		geometry: plan,
		membership,
	};
}

/**
 * Every fragment whose source is eligible for display and hit testing.
 *
 * The host must hit-test through this projection rather than the raw streams: a
 * hidden or excluded target that reachable input could select is the defect this
 * one derivation prevents, and it is the reason eligibility is a field instead of
 * a filter each caller re-invents.
 */
export function eligiblePlanFragments(plan: PlanEvaluation): readonly PlanFragment[] {
	const eligible = new Set(
		plan.membership.filter((row) => row.eligible).map((row) => row.sourceId),
	);
	return plan.fragments.filter((fragment) => eligible.has(fragment.ref.sourceId));
}

/**
 * One source's membership row, or `null` when it is not a compiled source.
 *
 * Like `planFragmentOf`, this is a **local** question asked per presented frame (the
 * Inspector reports the selected source's eligibility), so it is indexed against the
 * membership array itself rather than scanning it.
 */
export const membershipIndexes = new WeakMap<
	readonly PlanSourceMembership[],
	Map<string, PlanSourceMembership>
>();

export function planMembershipOf(
	plan: PlanEvaluation,
	sourceId: string,
): PlanSourceMembership | null {
	const view = PLAN_VIEWS.get(plan);
	if (view !== undefined) return view.membershipOf(sourceId);
	let index = membershipIndexes.get(plan.membership);
	if (index === undefined) {
		index = new Map<string, PlanSourceMembership>();
		for (const row of plan.membership) if (!index.has(row.sourceId)) index.set(row.sourceId, row);
		membershipIndexes.set(plan.membership, index);
	}
	return index.get(sourceId) ?? null;
}

/**
 * One source's first fragment, or `undefined`.
 *
 * A fragment lookup is a **local** question — "where is the thing I selected" —
 * asked on every presented frame while something is selected, not only when the
 * Plan changes. Scanning `plan.fragments` for it makes a selection cost the whole
 * project once per frame, so the index is retained against the fragment array
 * itself: two evaluations never share one, and an abandoned evaluation's index is
 * collectable with it.
 */
export const fragmentIndexes = new WeakMap<readonly PlanFragment[], Map<string, PlanFragment>>();

export function planFragmentOf(plan: PlanEvaluation, sourceId: string): PlanFragment | undefined {
	const view = PLAN_VIEWS.get(plan);
	if (view !== undefined) return view.fragmentOf(sourceId);
	let index = fragmentIndexes.get(plan.fragments);
	if (index === undefined) {
		index = new Map<string, PlanFragment>();
		// First wins, exactly as `fragments.find` does: the array is already in the
		// declared order, so the index reproduces its answer without rescanning.
		for (const fragment of plan.fragments) {
			if (!index.has(fragment.ref.sourceId)) index.set(fragment.ref.sourceId, fragment);
		}
		fragmentIndexes.set(plan.fragments, index);
	}
	return index.get(sourceId);
}
