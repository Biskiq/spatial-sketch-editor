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

import { pointInPolygon } from './layout-geometry-objects';
import type {
	CompiledLayoutGeometry,
	CompiledLayoutObject,
	CompiledOpening,
	CompiledPhysicalWall,
	CompiledRoom,
	LayoutBounds2
} from './layout-geometry-types';
import type { LayoutVec2 } from './layout-coordinates';

/** The four plan streams. Every emitted fragment belongs to exactly one. */
export const PLAN_STREAMS = ['cut', 'projected', 'hidden', 'symbol'] as const;

export type PlanStream = (typeof PLAN_STREAMS)[number];

/** The source kinds this representation can place in a stream. */
export const PLAN_SOURCE_KINDS = ['wall', 'opening', 'object', 'room-floor'] as const;

export type PlanSourceKind = (typeof PLAN_SOURCE_KINDS)[number];

/**
 * Membership reasons. `included` means the source passed every stage; each other
 * value names the one stage that excluded it.
 */
export const PLAN_MEMBERSHIP_REASONS = [
	'included',
	'filtered-type',
	'outside-depth',
	'outside-span',
	'no-meaningful-projection'
] as const;

export type PlanMembershipReason = (typeof PLAN_MEMBERSHIP_REASONS)[number];

/** The landed sub-reference kinds, mirrored field for field. */
export const PLAN_SUB_REF_KINDS = ['component', 'interval'] as const;

export type PlanSubRef =
	| { readonly kind: 'component'; readonly componentId: string }
	/** A distance range in meters along the owning source's canonical sampled arc. */
	| { readonly kind: 'interval'; readonly start: number; readonly end: number };

/**
 * Layout-native correspondence for one plan fragment. Qualified into the landed
 * `DerivedSourceRef` above this package; never persisted.
 */
export type PlanSourceRef = {
	readonly sourceId: string;
	readonly sourceKind: PlanSourceKind;
	readonly generationId: string;
	readonly stream: PlanStream;
	readonly subRef: PlanSubRef | null;
};

/** Parameters of one Plan evaluation (the landed `layout.plan@1` family values). */
export type PlanParameters = {
	/** Cut height in meters, **relative to the level datum**. */
	readonly cutHeightMeters: number;
	/** Required finite depth in meters, strictly greater than zero, measured downward. */
	readonly depthMeters: number;
	/**
	 * Optional lateral half-width in meters around `context.target`, strictly
	 * greater than zero; `null` is explicit unbounded lateral coverage.
	 */
	readonly lateralSpanHalfWidthMeters: number | null;
	/** Admitted source kinds; `null` admits all of them. */
	readonly sourceKindFilter: readonly PlanSourceKind[] | null;
	/** Declared source ids whose display/hit eligibility is temporarily widened. */
	readonly reveal: readonly string[];
};

/** What the host supplies beside the parameters: identity, target and level datum. */
export type PlanSourceContext = {
	/** Opaque compile/representation generation the fragments belong to. */
	readonly generationId: string;
	/**
	 * Project-world XZ the lateral span is measured around (the inspection target).
	 *
	 * **Only `lateralSpanHalfWidthMeters !== null` reads it** (see
	 * `planDependsOnTarget`). With the shipped default of explicit unbounded
	 * lateral coverage it is validated and echoed, and it changes no fragment, no
	 * membership reason, no stream and no bound. A host may therefore retain one
	 * evaluation while an inspection target moves — a pan — without re-evaluating.
	 */
	readonly target: LayoutVec2;
	/** The evaluated level's datum in project-world meters. */
	readonly datumMeters: number;
};

export type PlanFragmentGeometry =
	| { readonly kind: 'span'; readonly start: LayoutVec2; readonly end: LayoutVec2 }
	| { readonly kind: 'polyline'; readonly polyline: readonly LayoutVec2[] }
	| { readonly kind: 'polygon'; readonly polygon: readonly LayoutVec2[] };

/** One placeable plan fragment. It always carries its source's declared membership. */
export type PlanFragment = {
	readonly ref: PlanSourceRef;
	/** Project-world meters the fragment is drawn from. */
	readonly elevationMeters: number;
	readonly geometry: PlanFragmentGeometry;
	/**
	 * The owning source's declared membership reason. Carried on the fragment so no
	 * consumer can hold a primitive whose membership has been lost in a merge.
	 */
	readonly membership: PlanMembershipReason;
};

/** One compiled source's membership in this evaluation. */
export type PlanSourceMembership = {
	readonly sourceId: string;
	readonly sourceKind: PlanSourceKind;
	/** The declared reason. `reveal` never rewrites it. */
	readonly reason: PlanMembershipReason;
	/** Display/hit eligibility: `included`, or a revealed source. */
	readonly eligible: boolean;
	readonly revealed: boolean;
	/** How far the source's highest point sits below the cut plane, or `null` when it reaches it. */
	readonly depthBelowCutMeters: number | null;
	/** Plan distance from the inspection target, or `null` when lateral coverage is unbounded. */
	readonly lateralDistanceMeters: number | null;
};

export type PlanStreams = {
	readonly cut: readonly PlanFragment[];
	readonly projected: readonly PlanFragment[];
	readonly hidden: readonly PlanFragment[];
	readonly symbol: readonly PlanFragment[];
};

export type PlanEvaluation = {
	readonly generationId: string;
	readonly datumMeters: number;
	readonly cutHeightMeters: number;
	readonly cutElevationMeters: number;
	readonly depthMeters: number;
	readonly lateralSpanHalfWidthMeters: number | null;
	/**
	 * The inspection target this evaluation was asked for. It is a **record**, not
	 * an input to the result unless `lateralSpanHalfWidthMeters` is non-null; see
	 * `planDependsOnTarget` and `planTargetsLiveView`.
	 */
	readonly target: LayoutVec2;
	readonly sourceKindFilter: readonly PlanSourceKind[] | null;
	readonly reveal: readonly string[];
	readonly streams: PlanStreams;
	/** Every fragment in the streams' deterministic order. */
	readonly fragments: readonly PlanFragment[];
	readonly membership: readonly PlanSourceMembership[];
	/** Reveal ids that name no compiled source. Union semantics ignore them; they are reported. */
	readonly unmatchedRevealIds: readonly string[];
	readonly bounds: LayoutBounds2 | null;
};

export type PlanIssue = { path: string; code: string; message: string };

export type PlanEvaluationResult =
	| { readonly kind: 'evaluated'; readonly plan: PlanEvaluation }
	| {
			readonly kind: 'refused';
			readonly code: 'invalid-parameters' | 'invalid-context';
			readonly issues: readonly PlanIssue[];
	  };

type SourceExtent = {
	readonly minY: number;
	readonly maxY: number;
};

type SourcePlan =
	| { readonly kind: 'span'; readonly start: LayoutVec2; readonly end: LayoutVec2 }
	| { readonly kind: 'polyline'; readonly polyline: readonly LayoutVec2[] }
	| { readonly kind: 'polygon'; readonly polygon: readonly LayoutVec2[] };

type Candidate = {
	readonly sourceKind: PlanSourceKind;
	readonly sourceId: string;
	readonly extent: SourceExtent;
	readonly plan: SourcePlan;
	readonly subRef: PlanSubRef | null;
	/** A symbol-only source (an Opening) never contributes a cut/projected/hidden stroke. */
	readonly symbolOnly: boolean;
};

/** One candidate after the membership stages: measurement plus the placement it earned. */
type Evaluated = {
	readonly candidate: Candidate;
	readonly reason: PlanMembershipReason;
	readonly depthBelowCut: number | null;
	readonly lateralDistance: number | null;
	readonly eligible: boolean;
	readonly revealed: boolean;
	/** The stream and elevation this candidate places, or `null` when it places nothing. */
	readonly placement: { readonly stream: PlanStream; readonly elevationMeters: number } | null;
};

function isFiniteNumber(value: number): boolean {
	return typeof value === 'number' && Number.isFinite(value);
}

function finiteVec2(value: LayoutVec2 | undefined): boolean {
	return value !== undefined && isFiniteNumber(value[0]) && isFiniteNumber(value[1]);
}

/** Parameter validation is a defensive boundary, not a second schema for the family. */
function parameterIssues(parameters: PlanParameters, context: PlanSourceContext): PlanIssue[] {
	const issues: PlanIssue[] = [];
	const push = (path: string, code: string, message: string): void => {
		issues.push({ path, code, message });
	};
	if (!isFiniteNumber(parameters.cutHeightMeters)) {
		push('$.cutHeightMeters', 'non-finite-number', 'the cut height must be a finite number of meters relative to the level datum');
	}
	if (!isFiniteNumber(parameters.depthMeters) || parameters.depthMeters <= 0) {
		push('$.depthMeters', 'out-of-range', 'the depth is required and must be a finite number of meters greater than zero');
	}
	if (parameters.lateralSpanHalfWidthMeters !== null) {
		if (!isFiniteNumber(parameters.lateralSpanHalfWidthMeters) || parameters.lateralSpanHalfWidthMeters <= 0) {
			push('$.lateralSpanHalfWidthMeters', 'out-of-range', 'a declared lateral span must be a finite half-width greater than zero, or null for unbounded coverage');
		}
	}
	if (parameters.sourceKindFilter !== null) {
		if (parameters.sourceKindFilter.length === 0) {
			push('$.sourceKindFilter', 'invalid-value', 'a declared source-kind filter must admit at least one kind, or be null for no filter');
		}
		for (const [index, kind] of parameters.sourceKindFilter.entries()) {
			if (!(PLAN_SOURCE_KINDS as readonly string[]).includes(kind)) {
				push(`$.sourceKindFilter[${index}]`, 'unknown-tag', `"${kind}" is not an admitted plan source kind`);
			}
		}
	}
	if (context.generationId.trim() === '') {
		push('$.context.generationId', 'invalid-identity', 'the compile generation must be a nonempty identity');
	}
	if (!finiteVec2(context.target)) {
		push('$.context.target', 'invalid-vector', 'the inspection target must be a finite project-world XZ pair');
	}
	if (!isFiniteNumber(context.datumMeters)) {
		push('$.context.datumMeters', 'non-finite-number', 'the level datum must be a finite number of project-world meters');
	}
	return issues;
}

function distanceToSegment(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const squared = dx * dx + dz * dz;
	if (squared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
	const raw = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared;
	const amount = Math.min(1, Math.max(0, raw));
	return Math.hypot(point[0] - (start[0] + dx * amount), point[1] - (start[1] + dz * amount));
}

/** Minimum plan distance from the target to a source's extent; `null` when it has none. */
function planDistance(target: LayoutVec2, plan: SourcePlan): number | null {
	switch (plan.kind) {
		case 'span':
			return distanceToSegment(target, plan.start, plan.end);
		case 'polyline': {
			if (plan.polyline.length === 0) return null;
			if (plan.polyline.length === 1) {
				const only = plan.polyline[0]!;
				return Math.hypot(target[0] - only[0], target[1] - only[1]);
			}
			let best = Infinity;
			for (let index = 1; index < plan.polyline.length; index += 1) {
				best = Math.min(best, distanceToSegment(target, plan.polyline[index - 1]!, plan.polyline[index]!));
			}
			return best;
		}
		case 'polygon': {
			if (plan.polygon.length === 0) return null;
			// Inside the footprint is zero distance: the target is inside this source's extent.
			if (pointInPolygon(target, plan.polygon)) return 0;
			let best = Infinity;
			for (let index = 0; index < plan.polygon.length; index += 1) {
				const start = plan.polygon[index]!;
				const end = plan.polygon[(index + 1) % plan.polygon.length]!;
				best = Math.min(best, distanceToSegment(target, start, end));
			}
			return best;
		}
	}
}

function planPoints(plan: SourcePlan): readonly LayoutVec2[] {
	switch (plan.kind) {
		case 'span':
			return [plan.start, plan.end];
		case 'polyline':
			return plan.polyline;
		case 'polygon':
			return plan.polygon;
	}
}

/**
 * Whether a source's plan extent can produce a fragment at all.
 *
 * A span always has two endpoints; a polyline needs two points to be a line; a
 * polygon needs three to enclose an area. The check is deliberately about the
 * *extent*, not about a rendered subdivision: a Wall whose compiled solids are
 * empty has nothing to place in a plan, and saying so is `no-meaningful-projection`
 * rather than emitting an empty stroke a consumer would have to defend against.
 */
function hasPlanGeometry(plan: SourcePlan): boolean {
	switch (plan.kind) {
		case 'span':
			return finiteVec2(plan.start) && finiteVec2(plan.end);
		case 'polyline':
			return plan.polyline.length >= 2 && plan.polyline.every((point) => finiteVec2(point));
		case 'polygon':
			return plan.polygon.length >= 3 && plan.polygon.every((point) => finiteVec2(point));
	}
}

function boundsOf(fragments: readonly PlanFragment[]): LayoutBounds2 | null {
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	let seen = false;
	for (const fragment of fragments) {
		for (const point of planPoints(fragment.geometry)) {
			if (!isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) continue;
			seen = true;
			minX = Math.min(minX, point[0]);
			minZ = Math.min(minZ, point[1]);
			maxX = Math.max(maxX, point[0]);
			maxZ = Math.max(maxZ, point[1]);
		}
	}
	if (!seen) return null;
	return { min: [minX, minZ], max: [maxX, maxZ] };
}

/**
 * Stream placement of one source, from its vertical extent against the cut plane.
 *
 * - `cut`: the cut plane passes through the solid (`minY < cutElevation <= maxY`) —
 *   the wall/solid the section actually cuts.
 * - `projected`: the solid is shown by projection onto the Plan. Every `room-floor`
 *   is projected whatever its datum: a floor is the surface the Plan looks at, never
 *   overhead geometry hidden behind the cut plane. Remaining sources are projected
 *   when their whole extent sits at or above the cut (a lintel, a high object).
 * - `hidden`: the whole extent is below the cut plane and is drawn hidden.
 */
function streamFor(candidate: Candidate, cutElevation: number): Exclude<PlanStream, 'symbol'> {
	if (candidate.sourceKind === 'room-floor') return 'projected';
	const extent = candidate.extent;
	if (extent.minY < cutElevation && cutElevation <= extent.maxY) return 'cut';
	return extent.minY >= cutElevation ? 'projected' : 'hidden';
}

function wallCandidates(geometry: CompiledLayoutGeometry, datumMeters: number): Candidate[] {
	const candidates: Candidate[] = [];
	const walls: readonly CompiledPhysicalWall[] = [...geometry.walls].sort((left, right) => (left.wallId < right.wallId ? -1 : left.wallId > right.wallId ? 1 : 0));
	for (const wall of walls) {
		const extent: SourceExtent = { minY: datumMeters, maxY: datumMeters + wall.height };
		if (wall.solidSpans.length === 0) {
			candidates.push({
				sourceKind: 'wall',
				sourceId: wall.wallId,
				extent,
				plan: { kind: 'polyline', polyline: [] },
				subRef: null,
				symbolOnly: false
			});
			continue;
		}
		// Compiled spans are ordered by distance along the Wall, so a Wall's placements are
		// deterministic without depending on the order the compiler happened to emit them.
		const spans = [...wall.solidSpans].sort((left, right) => left.startDistance - right.startDistance);
		for (const span of spans) {
			candidates.push({
				sourceKind: 'wall',
				sourceId: wall.wallId,
				extent: { minY: datumMeters + span.bottomY, maxY: datumMeters + span.topY },
				plan: { kind: 'span', start: span.start, end: span.end },
				subRef: { kind: 'interval', start: span.startDistance, end: span.endDistance },
				symbolOnly: false
			});
		}
	}
	return candidates;
}

function openingCandidates(geometry: CompiledLayoutGeometry, datumMeters: number): Candidate[] {
	const byId = new Map<string, CompiledOpening>();
	for (const wall of geometry.walls) {
		for (const opening of wall.openings) {
			if (!byId.has(opening.openingId)) byId.set(opening.openingId, opening);
		}
	}
	return [...byId.values()]
		.sort((left, right) => (left.openingId < right.openingId ? -1 : left.openingId > right.openingId ? 1 : 0))
		.map((opening) => ({
			sourceKind: 'opening' as const,
			sourceId: opening.openingId,
			extent: { minY: datumMeters + opening.sillHeight, maxY: datumMeters + opening.sillHeight + opening.height },
			plan: { kind: 'polyline', polyline: opening.centerPolyline } satisfies SourcePlan,
			subRef: { kind: 'interval' as const, start: opening.offset, end: opening.offset + opening.width },
			// An Opening is a void with a plan symbol: it never becomes a cut stroke.
			symbolOnly: true
		}));
}

function objectCandidates(geometry: CompiledLayoutGeometry): Candidate[] {
	const objects: readonly CompiledLayoutObject[] = [...geometry.objects].sort((left, right) =>
		left.objectId < right.objectId ? -1 : left.objectId > right.objectId ? 1 : 0
	);
	return objects.map((object) => ({
		sourceKind: 'object' as const,
		sourceId: object.objectId,
		extent: { minY: object.worldAabb.min[1], maxY: object.worldAabb.max[1] },
		plan: { kind: 'polygon', polygon: object.planFootprint } satisfies SourcePlan,
		subRef: null,
		symbolOnly: false
	}));
}

function roomFloorCandidates(geometry: CompiledLayoutGeometry): Candidate[] {
	const rooms: readonly CompiledRoom[] = [...geometry.rooms].sort((left, right) =>
		left.roomId < right.roomId ? -1 : left.roomId > right.roomId ? 1 : 0
	);
	return rooms.map((room) => ({
		sourceKind: 'room-floor' as const,
		sourceId: room.roomId,
		// A floor polygon is planar at the Room's compiled datum; it is never cut.
		extent: { minY: room.floorElevation, maxY: room.floorElevation },
		plan: { kind: 'polygon', polygon: room.floorPolygon } satisfies SourcePlan,
		subRef: null,
		symbolOnly: false
	}));
}

const SOURCE_KIND_ORDER: Readonly<Record<PlanSourceKind, number>> = {
	wall: 0,
	opening: 1,
	object: 2,
	'room-floor': 3
};

function compareFragments(left: PlanFragment, right: PlanFragment): number {
	const leftKind = SOURCE_KIND_ORDER[left.ref.sourceKind];
	const rightKind = SOURCE_KIND_ORDER[right.ref.sourceKind];
	if (leftKind !== rightKind) return leftKind - rightKind;
	if (left.ref.sourceId !== right.ref.sourceId) return left.ref.sourceId < right.ref.sourceId ? -1 : 1;
	const leftStart = left.ref.subRef?.kind === 'interval' ? left.ref.subRef.start : 0;
	const rightStart = right.ref.subRef?.kind === 'interval' ? right.ref.subRef.start : 0;
	if (leftStart !== rightStart) return leftStart - rightStart;
	const leftEnd = left.ref.subRef?.kind === 'interval' ? left.ref.subRef.end : 0;
	const rightEnd = right.ref.subRef?.kind === 'interval' ? right.ref.subRef.end : 0;
	return leftEnd - rightEnd;
}

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
	readTarget: () => LayoutVec2
): PlanEvaluation {
	const evaluatedTarget = plan.target;
	return {
		...plan,
		get target(): LayoutVec2 {
			const live = readTarget();
			return isFiniteNumber(live[0]) && isFiniteNumber(live[1]) ? live : evaluatedTarget;
		}
	};
}

/**
 * Evaluate the ordinary horizontal Plan for one compiled Layout.
 *
 * Pure and deterministic: the same compiled geometry, parameters and context give
 * byte-identical output, the compiled input is never written, and ordering depends
 * only on stable source identity, never on array order or a display label.
 */
export function evaluateLayoutPlan(
	compiled: CompiledLayoutGeometry,
	parameters: PlanParameters,
	context: PlanSourceContext
): PlanEvaluationResult {
	const issues = parameterIssues(parameters, context);
	if (issues.length > 0) {
		const invalidContext = issues.every((issue) => issue.path.startsWith('$.context'));
		return { kind: 'refused', code: invalidContext ? 'invalid-context' : 'invalid-parameters', issues };
	}

	const cutElevation = context.datumMeters + parameters.cutHeightMeters;
	const reveal = new Set(parameters.reveal);
	const filter = parameters.sourceKindFilter === null ? null : new Set(parameters.sourceKindFilter);
	const candidates: readonly Candidate[] = [
		...wallCandidates(compiled, context.datumMeters),
		...openingCandidates(compiled, context.datumMeters),
		...objectCandidates(compiled),
		...roomFloorCandidates(compiled)
	];

	const fragments: PlanFragment[] = [];
	const membership: PlanSourceMembership[] = [];
	const matchedReveal = new Set<string>();

	// Stage one: measure each candidate independently and record the placement it earned.
	// Nothing is emitted yet, because membership is a **per-source** fact while a compiled
	// source can have several placements — a Wall has one row for all of its solid spans.
	const evaluated: Evaluated[] = candidates.map((candidate) => {
		const verticalExtent = candidate.extent.maxY - candidate.extent.minY;
		const depthBelowCut = candidate.extent.maxY >= cutElevation ? null : cutElevation - candidate.extent.maxY;
		const lateralDistance = parameters.lateralSpanHalfWidthMeters === null ? null : planDistance(context.target, candidate.plan);
		const hasGeometry = hasPlanGeometry(candidate.plan);

		// One declared reason per candidate, in a fixed precedence order, so a consumer never
		// has to guess which of two true exclusions was reported. The measured values are
		// reported beside the reason either way.
		let reason: PlanMembershipReason = 'included';
		if (filter !== null && !filter.has(candidate.sourceKind)) {
			reason = 'filtered-type';
		} else if (depthBelowCut !== null && depthBelowCut > parameters.depthMeters) {
			reason = 'outside-depth';
		} else if (
			parameters.lateralSpanHalfWidthMeters !== null &&
			lateralDistance !== null &&
			lateralDistance > parameters.lateralSpanHalfWidthMeters
		) {
			reason = 'outside-span';
		} else if (!hasGeometry || !Number.isFinite(verticalExtent) || verticalExtent < 0) {
			reason = 'no-meaningful-projection';
		}

		const revealed = reveal.has(candidate.sourceId);
		if (revealed) matchedReveal.add(candidate.sourceId);
		const eligible = reason === 'included' || revealed;
		// No geometry means no stream: a revealed source with nothing to project stays a
		// membership row and never becomes an empty primitive a consumer must defend against.
		const stream: PlanStream | null = hasGeometry
			? candidate.symbolOnly
				? 'symbol'
				: streamFor(candidate, cutElevation)
			: null;
		const placement =
			!eligible || stream === null
				? null
				: {
						stream,
						elevationMeters:
							stream === 'cut'
								? cutElevation
								: stream === 'projected'
									? candidate.extent.minY
									: candidate.extent.maxY
					};
		return { candidate, reason, depthBelowCut, lateralDistance, eligible, revealed, placement };
	});

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
		const first = entries[0];
		if (first === undefined) continue;
		const included = entries.find((entry) => entry.reason === 'included');
		const reason = included?.reason ?? first.reason;
		const revealed = entries.some((entry) => entry.revealed);
		const depths = entries.map((entry) => entry.depthBelowCut).filter((value): value is number => value !== null);
		const laterals = entries.map((entry) => entry.lateralDistance).filter((value): value is number => value !== null);
		membership.push({
			sourceId,
			sourceKind: first.candidate.sourceKind,
			reason,
			eligible: reason === 'included' || revealed,
			revealed,
			// The source-level measurements are the ones a consumer needs to act on: the
			// deepest extent that fell out of the window, and the nearest witness to the target.
			depthBelowCutMeters: depths.length > 0 ? Math.max(...depths) : null,
			lateralDistanceMeters: laterals.length > 0 ? Math.min(...laterals) : null
		});
		for (const entry of entries) {
			if (!entry.eligible || entry.placement === null) continue;
			fragments.push(
				fragmentOf(context.generationId, entry.candidate, entry.placement.stream, reason, entry.placement.elevationMeters)
			);
		}
	}

	fragments.sort(compareFragments);
	const streams: PlanStreams = {
		cut: fragments.filter((fragment) => fragment.ref.stream === 'cut'),
		projected: fragments.filter((fragment) => fragment.ref.stream === 'projected'),
		hidden: fragments.filter((fragment) => fragment.ref.stream === 'hidden'),
		symbol: fragments.filter((fragment) => fragment.ref.stream === 'symbol')
	};

	return {
		kind: 'evaluated',
		plan: {
			generationId: context.generationId,
			datumMeters: context.datumMeters,
			cutHeightMeters: parameters.cutHeightMeters,
			cutElevationMeters: cutElevation,
			depthMeters: parameters.depthMeters,
			lateralSpanHalfWidthMeters: parameters.lateralSpanHalfWidthMeters,
			target: context.target,
			sourceKindFilter: parameters.sourceKindFilter === null ? null : [...parameters.sourceKindFilter],
			reveal: [...parameters.reveal],
			streams,
			fragments,
			membership,
			unmatchedRevealIds: [...reveal].filter((id) => !matchedReveal.has(id)).sort(),
			bounds: boundsOf(fragments)
		}
	};
}

function fragmentOf(
	generationId: string,
	candidate: Candidate,
	stream: PlanStream,
	membership: PlanMembershipReason,
	elevationMeters: number
): PlanFragment {
	return {
		ref: {
			sourceId: candidate.sourceId,
			sourceKind: candidate.sourceKind,
			generationId,
			stream,
			subRef: candidate.subRef
		},
		elevationMeters,
		geometry: candidate.plan,
		membership
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
	const eligible = new Set(plan.membership.filter((row) => row.eligible).map((row) => row.sourceId));
	return plan.fragments.filter((fragment) => eligible.has(fragment.ref.sourceId));
}

/** The declared membership of one source id, or `null` when it is not a compiled source. */
export function planMembershipOf(plan: PlanEvaluation, sourceId: string): PlanSourceMembership | null {
	return plan.membership.find((row) => row.sourceId === sourceId) ?? null;
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
const fragmentIndexes = new WeakMap<readonly PlanFragment[], Map<string, PlanFragment>>();

export function planFragmentOf(plan: PlanEvaluation, sourceId: string): PlanFragment | undefined {
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
