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

import {
	diffCompiledSources,
	forEachRetainedCompiledRoom,
	forEachRetainedCompiledWall,
	type CompiledSourceDelta
} from './layout-geometry-delta';
import { pointInPolygon } from './layout-geometry-objects';
import { PersistentMap } from './persistent-store';
import { countWork } from './p2311-perf';
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

/** Running plan bound; the one place a fragment's points are folded into `bounds`. */
type BoundsAccumulator = {
	minX: number;
	minZ: number;
	maxX: number;
	maxZ: number;
	seen: boolean;
};

function emptyBounds(): BoundsAccumulator {
	return { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity, seen: false };
}

function accumulateBounds(state: BoundsAccumulator, plan: SourcePlan): void {
	for (const point of planPoints(plan)) {
		if (!isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) continue;
		state.seen = true;
		state.minX = Math.min(state.minX, point[0]);
		state.minZ = Math.min(state.minZ, point[1]);
		state.maxX = Math.max(state.maxX, point[0]);
		state.maxZ = Math.max(state.maxZ, point[1]);
	}
}

function finishedBounds(state: BoundsAccumulator): LayoutBounds2 | null {
	if (!state.seen) return null;
	return { min: [state.minX, state.minZ], max: [state.maxX, state.maxZ] };
}

function boundsOf(fragments: readonly PlanFragment[]): LayoutBounds2 | null {
	const state = emptyBounds();
	for (const fragment of fragments) accumulateBounds(state, fragment.geometry);
	return finishedBounds(state);
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

/**
 * One compiled Wall's candidates, in the order its placements are declared.
 *
 * Shared by the reference evaluator and the incremental retainer, so a Wall's
 * candidate set has exactly one definition. Compiled spans are ordered by distance
 * along the Wall, so a Wall's placements are deterministic without depending on the
 * order the compiler happened to emit them.
 */
function wallCandidatesOf(wall: CompiledPhysicalWall, datumMeters: number): Candidate[] {
	if (wall.solidSpans.length === 0) {
		return [
			{
				sourceKind: 'wall',
				sourceId: wall.wallId,
				extent: { minY: datumMeters, maxY: datumMeters + wall.height },
				plan: { kind: 'polyline', polyline: [] },
				subRef: null,
				symbolOnly: false
			}
		];
	}
	const spans = [...wall.solidSpans].sort((left, right) => left.startDistance - right.startDistance);
	const candidates: Candidate[] = [];
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
	return candidates;
}

function openingCandidate(opening: CompiledOpening, datumMeters: number): Candidate {
	return {
		sourceKind: 'opening',
		sourceId: opening.openingId,
		extent: { minY: datumMeters + opening.sillHeight, maxY: datumMeters + opening.sillHeight + opening.height },
		plan: { kind: 'polyline', polyline: opening.centerPolyline },
		subRef: { kind: 'interval', start: opening.offset, end: opening.offset + opening.width },
		// An Opening is a void with a plan symbol: it never becomes a cut stroke.
		symbolOnly: true
	};
}

function objectCandidate(object: CompiledLayoutObject): Candidate {
	return {
		sourceKind: 'object',
		sourceId: object.objectId,
		extent: { minY: object.worldAabb.min[1], maxY: object.worldAabb.max[1] },
		plan: { kind: 'polygon', polygon: object.planFootprint },
		subRef: null,
		symbolOnly: false
	};
}

function roomFloorCandidate(room: CompiledRoom): Candidate {
	return {
		sourceKind: 'room-floor',
		sourceId: room.roomId,
		// A floor polygon is planar at the Room's compiled datum; it is never cut.
		extent: { minY: room.floorElevation, maxY: room.floorElevation },
		plan: { kind: 'polygon', polygon: room.floorPolygon },
		subRef: null,
		symbolOnly: false
	};
}

function wallCandidates(geometry: CompiledLayoutGeometry, datumMeters: number): Candidate[] {
	const walls: readonly CompiledPhysicalWall[] = [...geometry.walls].sort(compareSourceIds((wall) => wall.wallId));
	const candidates: Candidate[] = [];
	for (const wall of walls) for (const candidate of wallCandidatesOf(wall, datumMeters)) candidates.push(candidate);
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
		.sort(compareSourceIds((opening) => opening.openingId))
		.map((opening) => openingCandidate(opening, datumMeters));
}

function objectCandidates(geometry: CompiledLayoutGeometry): Candidate[] {
	const objects: readonly CompiledLayoutObject[] = [...geometry.objects].sort(compareSourceIds((object) => object.objectId));
	return objects.map((object) => objectCandidate(object));
}

function roomFloorCandidates(geometry: CompiledLayoutGeometry): Candidate[] {
	const rooms: readonly CompiledRoom[] = [...geometry.rooms].sort(compareSourceIds((room) => room.roomId));
	return rooms.map((room) => roomFloorCandidate(room));
}

/** Ascending code-unit order on a source id — the only order a Plan may depend on. */
function compareSourceIds<T>(id: (record: T) => string): (left: T, right: T) => number {
	return (left, right) => {
		const leftId = id(left);
		const rightId = id(right);
		return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
	};
}

/**
 * The declared source order, **derived** from `PLAN_SOURCE_KINDS` rather than restated.
 *
 * The fragment comparator, the membership order and the incremental retainer's assembly
 * order all have to agree about where a kind sits; deriving it here is what makes that
 * agreement structural instead of a convention three places must remember.
 */
const SOURCE_KIND_ORDER: Readonly<Record<PlanSourceKind, number>> = Object.fromEntries(
	PLAN_SOURCE_KINDS.map((kind, index) => [kind, index])
) as Record<PlanSourceKind, number>;

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

const PLAN_VIEWS = new WeakMap<PlanEvaluation, PlanView>();

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
	// The descriptors are copied, **not** the values: a spread would force every lazy
	// field of the evaluation it wraps, which is exactly the work a pan must not cause.
	const live = Object.create(
		Object.getPrototypeOf(plan) as object,
		Object.getOwnPropertyDescriptors(plan)
	) as PlanEvaluation;
	Object.defineProperty(live, 'target', {
		configurable: true,
		enumerable: true,
		get(): LayoutVec2 {
			const current = readTarget();
			return isFiniteNumber(current[0]) && isFiniteNumber(current[1]) ? current : evaluatedTarget;
		}
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
type MeasurementContext = {
	readonly datumMeters: number;
	readonly cutElevation: number;
	readonly depthMeters: number;
	readonly lateralSpanHalfWidthMeters: number | null;
	readonly filter: ReadonlySet<PlanSourceKind> | null;
	readonly reveal: ReadonlySet<string>;
	readonly target: LayoutVec2;
};

function measurementContext(parameters: PlanParameters, context: PlanSourceContext): MeasurementContext {
	return {
		datumMeters: context.datumMeters,
		cutElevation: context.datumMeters + parameters.cutHeightMeters,
		depthMeters: parameters.depthMeters,
		lateralSpanHalfWidthMeters: parameters.lateralSpanHalfWidthMeters,
		filter: parameters.sourceKindFilter === null ? null : new Set(parameters.sourceKindFilter),
		reveal: new Set(parameters.reveal),
		target: context.target
	};
}

/** Measure one candidate: the declared reason it earned, and the placement it places. */
function measureCandidate(candidate: Candidate, context: MeasurementContext): Evaluated {
	const verticalExtent = candidate.extent.maxY - candidate.extent.minY;
	const depthBelowCut = candidate.extent.maxY >= context.cutElevation ? null : context.cutElevation - candidate.extent.maxY;
	const lateralDistance = context.lateralSpanHalfWidthMeters === null ? null : planDistance(context.target, candidate.plan);
	const hasGeometry = hasPlanGeometry(candidate.plan);

	// One declared reason per candidate, in a fixed precedence order, so a consumer never
	// has to guess which of two true exclusions was reported. The measured values are
	// reported beside the reason either way.
	let reason: PlanMembershipReason = 'included';
	if (context.filter !== null && !context.filter.has(candidate.sourceKind)) {
		reason = 'filtered-type';
	} else if (depthBelowCut !== null && depthBelowCut > context.depthMeters) {
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
							: stream === 'projected'
								? candidate.extent.minY
								: candidate.extent.maxY
				};
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
function sourceMembership(sourceId: string, entries: readonly Evaluated[]): PlanSourceMembership {
	const first = entries[0]!;
	const included = entries.find((entry) => entry.reason === 'included');
	const reason = included?.reason ?? first.reason;
	const revealed = entries.some((entry) => entry.revealed);
	const depths = entries.map((entry) => entry.depthBelowCut).filter((value): value is number => value !== null);
	const laterals = entries.map((entry) => entry.lateralDistance).filter((value): value is number => value !== null);
	return {
		sourceId,
		sourceKind: first.candidate.sourceKind,
		reason,
		eligible: reason === 'included' || revealed,
		revealed,
		// The source-level measurements are the ones a consumer needs to act on: the
		// deepest extent that fell out of the window, and the nearest witness to the target.
		depthBelowCutMeters: depths.length > 0 ? Math.max(...depths) : null,
		lateralDistanceMeters: laterals.length > 0 ? Math.min(...laterals) : null
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
	context: PlanSourceContext
): PlanEvaluationResult {
	const issues = parameterIssues(parameters, context);
	if (issues.length > 0) {
		const invalidContext = issues.every((issue) => issue.path.startsWith('$.context'));
		return { kind: 'refused', code: invalidContext ? 'invalid-context' : 'invalid-parameters', issues };
	}

	const measurement = measurementContext(parameters, context);
	const candidates: readonly Candidate[] = [
		...wallCandidates(compiled, context.datumMeters),
		...openingCandidates(compiled, context.datumMeters),
		...objectCandidates(compiled),
		...roomFloorCandidates(compiled)
	];

	const fragments: PlanFragment[] = [];
	const membership: PlanSourceMembership[] = [];

	// Stage one: measure each candidate independently and record the placement it earned.
	// Nothing is emitted yet, because membership is a **per-source** fact while a compiled
	// source can have several placements — a Wall has one row for all of its solid spans.
	const evaluated: Evaluated[] = candidates.map((candidate) => measureCandidate(candidate, measurement));

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
					entry.placement.elevationMeters
				)
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
			cutElevationMeters: measurement.cutElevation,
			depthMeters: parameters.depthMeters,
			lateralSpanHalfWidthMeters: parameters.lateralSpanHalfWidthMeters,
			target: context.target,
			sourceKindFilter: parameters.sourceKindFilter === null ? null : [...parameters.sourceKindFilter],
			reveal: [...parameters.reveal],
			streams,
			fragments,
			membership,
			// A reveal id matches when it names a compiled source. Every compiled source
			// produces at least one candidate, so the candidate grouping is the same set.
			unmatchedRevealIds: [...measurement.reveal].filter((id) => !bySource.has(id)).sort(),
			bounds: boundsOf(fragments)
		}
	};
}

/** One fragment, from the fields both evaluators already hold. */
function fragmentFor(
	generationId: string,
	sourceId: string,
	sourceKind: PlanSourceKind,
	subRef: PlanSubRef | null,
	plan: SourcePlan,
	stream: PlanStream,
	membership: PlanMembershipReason,
	elevationMeters: number
): PlanFragment {
	return {
		ref: { sourceId, sourceKind, generationId, stream, subRef },
		elevationMeters,
		geometry: plan,
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

/**
 * One source's membership row, or `null` when it is not a compiled source.
 *
 * Like `planFragmentOf`, this is a **local** question asked per presented frame (the
 * Inspector reports the selected source's eligibility), so it is indexed against the
 * membership array itself rather than scanning it.
 */
const membershipIndexes = new WeakMap<readonly PlanSourceMembership[], Map<string, PlanSourceMembership>>();

export function planMembershipOf(plan: PlanEvaluation, sourceId: string): PlanSourceMembership | null {
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
const fragmentIndexes = new WeakMap<readonly PlanFragment[], Map<string, PlanFragment>>();

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

/* ------------------------------------------------------------------------- *
 * Incremental evaluation
 * ------------------------------------------------------------------------- */

/**
 * One candidate's measured placement, retained **independently of any generation**.
 *
 * This is the unit of reuse. Nothing here depends on the compile generation (only the
 * fragment's `ref` does), so a new generation — every accepted edit — reuses it and
 * recreates only the fragments. Nothing here depends on the parameters either, which is
 * why a parameter change re-derives and a geometry change does not.
 *
 * `extent` is kept although the fragment does not expose it: it is how the next
 * evaluation recognises that this placement is still the one the compiled record
 * describes, without re-deriving it (see `wallUnchanged` and friends).
 */
type PlanEntry = {
	readonly reason: PlanMembershipReason;
	readonly subRef: PlanSubRef | null;
	readonly plan: SourcePlan;
	readonly extent: SourceExtent;
	readonly placement: { readonly stream: PlanStream; readonly elevationMeters: number } | null;
};

/** One source's retained derivation: its membership row and its placements. */
type SourceRecord = {
	readonly entries: readonly PlanEntry[];
	readonly membership: PlanSourceMembership;
	/** The reconciliation pass that last confirmed this record; duplicate detection only. */
	stamp: number;
};

type KindIndex = {
	/**
	 * Source ids in declared order — ascending by code unit.
	 *
	 * **Replaced, never mutated.** An assembled evaluation captures this array so its lazy
	 * getters can be read later; a `splice` in place would change what an already-returned
	 * plan sees. Copy-on-write shifts the same `O(S)` tail a `splice` would, so the cost is
	 * the same and the captured reference stays honest.
	 */
	ids: readonly string[];
	/**
	 * Derived records, in a persistent map so an assembled evaluation can capture the map
	 * with `fork()` — `O(1)` — instead of copying one entry per source. The retainer keeps
	 * writing through its own handle; every fork keeps the root it was taken from.
	 */
	byId: PersistentMap<string, SourceRecord>;
};

/**
 * Two placements of one source, in the order the fragment comparator declares.
 *
 * Within a source every fragment shares its kind and id, so the interval is the whole
 * remaining order — which is why a source's placements can be sorted once, when they are
 * derived, instead of on every evaluation.
 */
function compareEntries(left: PlanEntry, right: PlanEntry): number {
	const leftStart = left.subRef?.kind === 'interval' ? left.subRef.start : 0;
	const rightStart = right.subRef?.kind === 'interval' ? right.subRef.start : 0;
	if (leftStart !== rightStart) return leftStart - rightStart;
	const leftEnd = left.subRef?.kind === 'interval' ? left.subRef.end : 0;
	const rightEnd = right.subRef?.kind === 'interval' ? right.subRef.end : 0;
	return leftEnd - rightEnd;
}

function compareCodeUnits(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

/** The index `id` occupies in a sorted id list, by binary search (`ids` stays sorted). */
function insertionPoint(ids: readonly string[], id: string): number {
	let low = 0;
	let high = ids.length;
	while (low < high) {
		const middle = (low + high) >>> 1;
		if (compareCodeUnits(ids[middle]!, id) < 0) low = middle + 1;
		else high = middle;
	}
	return low;
}

function samePoint(left: LayoutVec2, right: LayoutVec2): boolean {
	return left[0] === right[0] && left[1] === right[1];
}

function samePoints(left: readonly LayoutVec2[], right: readonly LayoutVec2[]): boolean {
	if (left === right) return true;
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		const a = left[index]!;
		const b = right[index]!;
		if (a[0] !== b[0] || a[1] !== b[1]) return false;
	}
	return true;
}

/**
 * Does a retained Wall still describe this compiled Wall?
 *
 * The comparison reads **exactly the fields the derivation reads** — the attributes a
 * source's placement is made of — so "unchanged" here means "re-deriving would produce
 * these same entries". It allocates nothing, which is the whole point: an untouched
 * source costs a handful of numeric comparisons instead of a candidate object, a measured
 * candidate, a membership row and a sort insertion.
 *
 * Spans are compared **by interval**, not by array position. The derivation sorts its
 * placements by interval (`compareEntries`), while `solidSpans` arrives in whatever order
 * the compiler emitted, so pairing index to index is only valid when the two orders agree.
 * When they do not, the positional pass fails and the interval-keyed pass decides — which
 * is why an untouched Wall is proved unchanged rather than re-derived. The positional pass
 * exists because it allocates nothing and is the common case.
 */
function wallUnchanged(entries: readonly PlanEntry[], wall: CompiledPhysicalWall, datumMeters: number): boolean {
	if (wall.solidSpans.length === 0) {
		// A solid-less Wall still has a **declared height**, and the derivation reads it
		// for the candidate's extent — which is what the depth window measures. Checking
		// only the (empty) plan geometry here would let a height change keep a stale
		// `reason` and `depthBelowCutMeters` on the membership row.
		const entry = entries[0];
		return (
			entries.length === 1 &&
			entry !== undefined &&
			entry.plan.kind === 'polyline' &&
			entry.extent.minY === datumMeters &&
			entry.extent.maxY === datumMeters + wall.height
		);
	}
	if (entries.length !== wall.solidSpans.length) return false;
	let positional = true;
	for (let index = 0; index < wall.solidSpans.length; index += 1) {
		if (!spanMatchesEntry(entries[index]!, wall.solidSpans[index]!, datumMeters)) {
			positional = false;
			break;
		}
	}
	if (positional) return true;
	// Same set, different order — or two spans that share an interval at different
	// elevations, which a Wall genuinely has where a lower and an upper solid start and end
	// together. Pair by the **whole derived placement** instead: interval, elevation and
	// plan points. Two spans agreeing on all three are interchangeable, so a bucket is not
	// a guess.
	const expected = new Map<string, number>();
	for (const span of wall.solidSpans) {
		const key = `${span.startDistance}|${span.endDistance}|${datumMeters + span.bottomY}|${datumMeters + span.topY}|${span.start[0]}|${span.start[1]}|${span.end[0]}|${span.end[1]}`;
		expected.set(key, (expected.get(key) ?? 0) + 1);
	}
	for (const entry of entries) {
		const plan = entry.plan;
		if (entry.subRef?.kind !== 'interval' || plan.kind !== 'span') return false;
		const key = `${entry.subRef.start}|${entry.subRef.end}|${entry.extent.minY}|${entry.extent.maxY}|${plan.start[0]}|${plan.start[1]}|${plan.end[0]}|${plan.end[1]}`;
		const remaining = expected.get(key) ?? 0;
		if (remaining === 0) return false;
		expected.set(key, remaining - 1);
	}
	return true;
}

/** Does this retained placement still describe that compiled span, field for field? */
function spanMatchesEntry(
	entry: PlanEntry,
	span: CompiledPhysicalWall['solidSpans'][number],
	datumMeters: number
): boolean {
	if (entry.extent.minY !== datumMeters + span.bottomY || entry.extent.maxY !== datumMeters + span.topY) return false;
	if (entry.subRef?.kind !== 'interval' || entry.subRef.start !== span.startDistance || entry.subRef.end !== span.endDistance) return false;
	const plan = entry.plan;
	return plan.kind === 'span' && samePoint(plan.start, span.start) && samePoint(plan.end, span.end);
}

function openingUnchanged(
	entries: readonly PlanEntry[],
	opening: CompiledOpening,
	datumMeters: number
): boolean {
	if (entries.length !== 1) return false;
	const entry = entries[0]!;
	const plan = entry.plan;
	return (
		entry.extent.minY === datumMeters + opening.sillHeight &&
		entry.extent.maxY === datumMeters + opening.sillHeight + opening.height &&
		entry.subRef?.kind === 'interval' &&
		entry.subRef.start === opening.offset &&
		entry.subRef.end === opening.offset + opening.width &&
		plan.kind === 'polyline' &&
		samePoints(plan.polyline, opening.centerPolyline)
	);
}

function objectUnchanged(entries: readonly PlanEntry[], object: CompiledLayoutObject): boolean {
	if (entries.length !== 1) return false;
	const entry = entries[0]!;
	const plan = entry.plan;
	return (
		entry.extent.minY === object.worldAabb.min[1] &&
		entry.extent.maxY === object.worldAabb.max[1] &&
		entry.subRef === null &&
		plan.kind === 'polygon' &&
		samePoints(plan.polygon, object.planFootprint)
	);
}

function roomFloorUnchanged(entries: readonly PlanEntry[], room: CompiledRoom): boolean {
	if (entries.length !== 1) return false;
	const entry = entries[0]!;
	const plan = entry.plan;
	return (
		entry.extent.minY === room.floorElevation &&
		entry.extent.maxY === room.floorElevation &&
		entry.subRef === null &&
		plan.kind === 'polygon' &&
		samePoints(plan.polygon, room.floorPolygon)
	);
}

/** A retainer's handle; see `createPlanRetainer`. */
export type PlanRetainer = {
	/** The Plan for this compiled Layout, parameters and context — exactly what
	 * `evaluateLayoutPlan` returns, reusing the sources that did not change. */
	evaluate(
		compiled: CompiledLayoutGeometry,
		parameters: PlanParameters,
		context: PlanSourceContext
	): PlanEvaluationResult;
	/** Drop every retained record; the next evaluation derives every source again. */
	clear(): void;
};

/**
 * Create an evaluator that retains what the previous evaluation derived.
 *
 * **Why this exists.** `evaluateLayoutPlan` is a pure function of the whole compiled
 * Layout: every call re-sorts every source id, re-measures every candidate and sorts
 * every fragment, so changing one Wall costs the same as changing all of them. That is
 * `O(N log N)` work for a `k = 1` edit, and it is the last whole-project term left in the
 * interaction path after the compiler stopped recompiling unaffected geometry.
 *
 * A retainer keeps, per source, the **derivation** (membership row and placements) rather
 * than the evaluation. The only per-generation work is the fragment objects themselves,
 * because each one carries the generation it was compiled at; that is a property of the
 * ratified correspondence, not of this implementation, so the materialized
 * `O(F)` fragment pass is a genuine floor and is charged exactly once per generation.
 *
 * **What it does per evaluation.**
 *
 * - *Nothing changed* — same derivation inputs, same generation, same compiled object —
 *   returns the retained result: `O(1)`.	 * - *New generation, same derivation inputs* (every accepted edit): asks the compiler's
	 *   root difference which records changed and re-derives exactly those; with no provable
	 *   difference it walks every source once instead. **No sort of any kind**: the declared
	 *   order is maintained with the records, so the fragment array is produced by walking
	 *   it, not by sorting into it — and it is produced only if someone reads it.
 * - *Parameters changed* (cut height, depth, lateral span, filter, reveal): re-derives
 *   every source — the order is still maintained, so nothing is sorted.
 * - *Source ids added or removed*: the id list is updated by binary-search insertion when
 *   a few ids change, and rebuilt (one sort) when many do.
 *
 * It remembers **one** derivation signature. A caller that alternates between two
 * parameter sets would re-derive on every call, so a host with genuinely interleaved
 * consumers should hold one retainer per set; the editor reads one set per evaluation.
 *
 * **What it cannot remove.** Without evidence, the walk over the compiled sources is
 * `Omega(N)`: proving that an untouched source really is untouched means reading it. It
 * does not ask that question when the compiler can answer it: `diffCompiledSources`
 * compares the two compiled snapshots' persistent roots, so an ordinary accepted edit
 * re-derives only the records whose identity changed and compares nothing. Everything
 * that difference cannot prove — a cold snapshot, an insertion or removal, an Opening
 * that changed host, a Room that stopped compiling, a hand-built geometry — falls back to
 * the complete walk, which is still allocation-free per source and still sorts nothing.
 * The output itself is produced on demand (see `assemble`), so an edit that is never
 * rendered costs neither the comparison walk nor the fragment pass.
 *
 * **Exactness.** This is not a second definition of the family. It uses the same
 * candidate builders, the same `measureCandidate`, the same `sourceMembership` and the
 * same `fragmentFor` as `evaluateLayoutPlan`; it differs only in *how it reaches the
 * declared order* (maintained, not sorted) and in *when it does the work* (on the source
 * that changed). Anything it cannot prove it reproduces — a source id shared by two
 * kinds, or duplicated within one — is handed to the reference evaluator and the retained
 * state is dropped, so a disagreement is impossible rather than unlikely.
 *
 * `compiled` is assumed immutable, like every other consumer of compiled geometry, and
 * the generation is assumed to describe the content it was compiled from (the host
 * already relies on both: it keys its own retention on the generation).
 */
export function createPlanRetainer(): PlanRetainer {
	let derivation: string | null = null;
	let generation: string | null = null;
	let retainedSource: WeakRef<CompiledLayoutGeometry> | null = null;
	let result: PlanEvaluationResult | null = null;
	let pass = 0;
	/** False when two Walls host the same Opening id, whose record is derived by first host. */
	let openingsAreUnique = true;
	const indexes = new Map<PlanSourceKind, KindIndex>();
	for (const kind of PLAN_SOURCE_KINDS) {
		indexes.set(kind, { ids: [], byId: PersistentMap.from<string, SourceRecord>([]) });
	}

	function clear(): void {
		derivation = null;
		generation = null;
		retainedSource = null;
		result = null;
		pass = 0;
		openingsAreUnique = true;
		for (const kind of PLAN_SOURCE_KINDS) {
			const index = indexes.get(kind)!;
			index.ids = [];
			// A fresh map, not a cleared one: evaluations already assembled keep the root
			// their own fork captured.
			index.byId = PersistentMap.from<string, SourceRecord>([]);
		}
	}

	/** The same compiled object as last time, when the runtime can still see it. */
	function sameSource(compiled: CompiledLayoutGeometry): boolean {
		return retainedSource !== null && retainedSource.deref() === compiled;
	}

	function rememberSource(compiled: CompiledLayoutGeometry): void {
		retainedSource = typeof WeakRef === 'function' ? new WeakRef(compiled) : null;
	}

	/**
	 * Reconcile one kind against its compiled records, in one walk.
	 *
	 * Returns the ids this pass added, or `null` when this kind cannot be reproduced
	 * incrementally — a source id appears twice in the kind, which the reference evaluator
	 * merges into one membership row and this retainer does not model.
	 */
	/** Derive one source's entries and membership row from its candidates, and retain it. */
	function derive(kind: PlanSourceKind, id: string, candidates: readonly Candidate[], measurement: MeasurementContext): void {
		const measured = candidates.map((candidate) => measureCandidate(candidate, measurement));
		const entries: PlanEntry[] = measured.map((entry) => ({
			reason: entry.reason,
			subRef: entry.candidate.subRef,
			plan: entry.candidate.plan,
			extent: entry.candidate.extent,
			placement: entry.placement
		}));
		// Within one source every placement sorts by the same interval the fragment
		// comparator uses, so the maintained order is the declared order.
		entries.sort(compareEntries);
		indexes.get(kind)!.byId.set(id, { entries, membership: sourceMembership(id, measured), stamp: pass });
		countWork('plan:source-derived');
		countWork(`plan:source-derived:${kind}`);
	}

	function walkWalls(geometry: CompiledLayoutGeometry, visit: (wall: CompiledPhysicalWall) => void): void {
		// The retained world iterates its persistent root in slot order — the same order as
		// `geometry.walls` — without allocating the legacy array. Hand-built snapshots have
		// no world, so they fall back to the array property.
		if (!forEachRetainedCompiledWall(geometry, visit)) for (const wall of geometry.walls) visit(wall);
	}

	function walkRooms(geometry: CompiledLayoutGeometry, visit: (room: CompiledRoom) => void): void {
		if (!forEachRetainedCompiledRoom(geometry, visit)) for (const room of geometry.rooms) visit(room);
	}

	function reconcileKind<T>(
		kind: PlanSourceKind,
		walk: (visit: (record: T) => void) => void,
		idOf: (record: T) => string,
		candidatesOf: (record: T) => readonly Candidate[],
		unchanged: (previous: readonly PlanEntry[], record: T) => boolean,
		measurement: MeasurementContext,
		rederive: boolean
	): string[] | null {
		const index = indexes.get(kind)!;
		const walked: string[] = [];
		const fresh: string[] = [];
		let duplicate = false;
		walk((record) => {
			if (duplicate) return;
			const id = idOf(record);
			const previous = index.byId.get(id);
			// A second record with a source id this pass already confirmed: the reference
			// merges both into one row, which is not a shape this retainer models.
			if (previous !== undefined && previous.stamp === pass) {
				duplicate = true;
				return;
			}
			walked.push(id);
			// The cold/fallback path's own work: one comparison per compiled source. A proven
			// delta must report **zero** of these, which is what makes "the edit did not walk
			// its neighbours" a falsifiable count rather than a claim.
			countWork('plan:source-compared');
			if (previous !== undefined && !rederive && unchanged(previous.entries, record)) {
				previous.stamp = pass;
				return;
			}
			derive(kind, id, candidatesOf(record), measurement);
			if (previous === undefined) fresh.push(id);
		});
		if (duplicate) return null;

		const removed = index.byId.size - walked.length;
		if (fresh.length === 0 && removed === 0) return fresh;
		if (removed > 0) {
			const stale: string[] = [];
			for (const [id, record] of index.byId) if (record.stamp !== pass) stale.push(id);
			for (const id of stale) index.byId.delete(id);
		}
		// A few new ids are merged into the maintained order by binary-search insertion; a
		// structural change rebuilds it with the one sort this retainer ever performs. The
		// array is replaced rather than spliced: see `KindIndex.ids`.
		if (removed === 0 && fresh.length <= 8) {
			let ids = index.ids;
			for (const id of fresh) {
				const at = insertionPoint(ids, id);
				ids = [...ids.slice(0, at), id, ...ids.slice(at)];
			}
			index.ids = ids;
			return fresh;
		}
		index.ids = [...walked].sort(compareCodeUnits);
		return fresh;
	}

	/**
	 * Build the evaluation an interactive host receives: exact values, produced only when
	 * they are asked for.
	 *
	 * **Why the output is demand-driven.** The ratified output is the complete fragment,
	 * membership and bounds set, and a consumer that asks for it must get exactly that —
	 * `Omega(F)` fragments, each carrying the generation it was compiled at. What the
	 * editor's live path actually asks for on an accepted edit is much smaller: one
	 * selected source's fragment, one source's membership row, and (on a click) the
	 * eligible set. Producing the complete output eagerly charged every edit for what only
	 * a click or a panel needed. The getters below keep the contract exactly as it is and
	 * move the cost to whoever reads it, which is the difference between "the output is
	 * `Omega(F)`" (true, and unavoidable) and "an edit must produce it" (false).
	 *
	 * **Why the sources are captured.** The getters run later than this function, possibly
	 * after the retainer has evaluated a newer generation. They therefore read a snapshot —
	 * each kind's id array (already replaced, never mutated) and a fork of its persistent
	 * record map (`O(1)`, sharing the root) — and never the retainer's live index. Without
	 * that, holding one plan across a later evaluation would materialize the *newer*
	 * sources under the *older* generation, which is exactly the kind of quiet divergence
	 * this file exists to avoid.
	 */
	function assemble(
		parameters: PlanParameters,
		context: PlanSourceContext,
		measurement: MeasurementContext
	): PlanEvaluation {
		let membershipRows: PlanSourceMembership[] | null = null;
		let fragmentRows: PlanFragment[] | null = null;
		let streamRows: PlanStreams | null = null;
		let unmatched: string[] | null = null;
		let bounds: LayoutBounds2 | null = null;
		let boundsReady = false;
		const firstFragment = new Map<string, PlanFragment>();

		// This evaluation's sources, captured now: see the doc block above.
		const sources = PLAN_SOURCE_KINDS.map((kind) => {
			const index = indexes.get(kind)!;
			return { kind, ids: index.ids, byId: index.byId.fork() };
		});

		// Kinds in declared order, ids in ascending order, placements in interval order:
		// the maintained order *is* the order a whole-population sort would produce.
		const eachSource = (visit: (kind: PlanSourceKind, id: string, record: SourceRecord) => void): void => {
			for (const source of sources) {
				for (const id of source.ids) {
					const record = source.byId.get(id);
					if (record !== undefined) visit(source.kind, id, record);
				}
			}
		};

		const fragmentOf = (sourceId: string): PlanFragment | undefined => {
			const cached = firstFragment.get(sourceId);
			if (cached !== undefined) return cached;
			for (const source of sources) {
				const record = source.byId.get(sourceId);
				if (record === undefined) continue;
				for (const entry of record.entries) {
					const placement = entry.placement;
					if (placement === null) continue;
					const fragment = fragmentFor(
						context.generationId,
						sourceId,
						source.kind,
						entry.subRef,
						entry.plan,
						placement.stream,
						record.membership.reason,
						placement.elevationMeters
					);
					firstFragment.set(sourceId, fragment);
					return fragment;
				}
				return undefined;
			}
			return undefined;
		};

		const plan: PlanEvaluation = {
			generationId: context.generationId,
			datumMeters: context.datumMeters,
			cutHeightMeters: parameters.cutHeightMeters,
			cutElevationMeters: measurement.cutElevation,
			depthMeters: parameters.depthMeters,
			lateralSpanHalfWidthMeters: parameters.lateralSpanHalfWidthMeters,
			target: context.target,
			sourceKindFilter: parameters.sourceKindFilter === null ? null : [...parameters.sourceKindFilter],
			reveal: [...parameters.reveal],
			get streams(): PlanStreams {
				if (streamRows === null) {
					const all = plan.fragments;
					streamRows = {
						cut: all.filter((fragment) => fragment.ref.stream === 'cut'),
						projected: all.filter((fragment) => fragment.ref.stream === 'projected'),
						hidden: all.filter((fragment) => fragment.ref.stream === 'hidden'),
						symbol: all.filter((fragment) => fragment.ref.stream === 'symbol')
					};
				}
				return streamRows;
			},
			get fragments(): readonly PlanFragment[] {
				if (fragmentRows !== null) return fragmentRows;
				const rows: PlanFragment[] = [];
				// Which sources already contributed a row, so a source's **first** placement can
				// adopt the object `planFragmentOf` may already have handed out, while its other
				// placements still get their own fragment.
				const emitted = new Set<string>();
				eachSource((kind, id, record) => {
					for (const entry of record.entries) {
						const placement = entry.placement;
						if (placement === null) continue;
						const first = !emitted.has(id);
						emitted.add(id);
						const known = first ? firstFragment.get(id) : undefined;
						const fragment =
							known ??
							fragmentFor(
								context.generationId,
								id,
								kind,
								entry.subRef,
								entry.plan,
								placement.stream,
								record.membership.reason,
								placement.elevationMeters
							);
						if (first) firstFragment.set(id, fragment);
						rows.push(fragment);
					}
				});
				fragmentRows = rows;
				fragmentIndexes.set(rows, firstFragment);
				countWork('plan:output-fragments', rows.length);
				return rows;
			},
			get membership(): readonly PlanSourceMembership[] {
				if (membershipRows !== null) return membershipRows;
				const rows: PlanSourceMembership[] = [];
				const bySource = new Map<string, PlanSourceMembership>();
				eachSource((_kind, id, record) => {
					rows.push(record.membership);
					bySource.set(id, record.membership);
				});
				membershipRows = rows;
				membershipIndexes.set(rows, bySource);
				countWork('plan:output-membership', rows.length);
				return rows;
			},
			get unmatchedRevealIds(): readonly string[] {
				if (unmatched === null) {
					unmatched = [];
					for (const id of measurement.reveal) {
						const hosted = sources.some((source) => source.byId.has(id));
						if (!hosted) unmatched.push(id);
					}
					unmatched.sort();
				}
				return unmatched;
			},
			get bounds(): LayoutBounds2 | null {
				if (!boundsReady) {
					const state = emptyBounds();
					eachSource((_kind, _id, record) => {
						for (const entry of record.entries) if (entry.placement !== null) accumulateBounds(state, entry.plan);
					});
					bounds = finishedBounds(state);
					boundsReady = true;
				}
				return bounds;
			}
		};
		PLAN_VIEWS.set(plan, {
			fragmentOf,
			membershipOf(sourceId) {
				for (const source of sources) {
					const record = source.byId.get(sourceId);
					if (record !== undefined) return record.membership;
				}
				return null;
			}
		});
		return plan;
	}

	/** The compiler's own delta, when it can prove one; `null` means "walk everything". */
	function deltaOf(compiled: CompiledLayoutGeometry): CompiledSourceDelta | null {
		const previous = retainedSource === null ? undefined : retainedSource.deref();
		if (previous === undefined || previous === compiled) return null;
		return diffCompiledSources(previous, compiled) ?? null;
	}

	/**
	 * Apply a proven delta: re-derive exactly the records it names, and nothing else.
	 *
	 * Returns `false` when the delta does not fit the retained source set — an id the
	 * retainer does not host, or an Opening whose first host is not the Wall that changed.
	 * **It validates before it mutates**: a delta that will be refused derives nothing, so
	 * the caller's complete walk starts from the records the delta would have left behind
	 * untouched. (A partial apply would be harmless for output — the walk compares against
	 * whatever it finds — but its own `stamp` bookkeeping would read as a duplicate id and
	 * throw the retention away.)
	 */
	function applyDelta(
		delta: CompiledSourceDelta,
		measurement: MeasurementContext,
		datumMeters: number
	): boolean {
		if (!openingsAreUnique) return false;
		const walls = indexes.get('wall')!.byId;
		const openings = indexes.get('opening')!.byId;
		const rooms = indexes.get('room-floor')!.byId;
		const objects = indexes.get('object')!.byId;

		// 1. Validate. Nothing is derived until every source the delta names is proved to be
		// one this retainer hosts — a refusal must leave the retained state as it was.
		for (const wall of delta.walls) {
			if (!walls.has(wall.wallId)) return false;
			for (const opening of wall.openings) if (!openings.has(opening.openingId)) return false;
		}
		for (const room of delta.rooms) if (!rooms.has(room.roomId)) return false;
		if (delta.objects !== null) for (const object of delta.objects) if (!objects.has(object.objectId)) return false;

		// 2. Derive exactly what the records say changed.
		for (const wall of delta.walls) {
			derive('wall', wall.wallId, wallCandidatesOf(wall, datumMeters), measurement);
			// A Wall record changing does not mean its Openings changed: they are their own
			// compiled records, and the Plan's derivation reads their own fields. Deriving
			// every Opening of a changed Wall would make a Wall's height charge its neighbours'
			// windows for no reason, so the same per-source predicate the fallback uses decides.
			for (const opening of wall.openings) {
				const retained = openings.get(opening.openingId)!;
				if (!openingUnchanged(retained.entries, opening, datumMeters)) {
					derive('opening', opening.openingId, [openingCandidate(opening, datumMeters)], measurement);
				}
			}
		}
		for (const room of delta.rooms) {
			// A Room's compiled record embeds the bounds of the Walls around it, so a Wall edit
			// replaces it without necessarily changing what the Plan reads from it.
			if (!roomFloorUnchanged(rooms.get(room.roomId)!.entries, room)) {
				derive('room-floor', room.roomId, [roomFloorCandidate(room)], measurement);
			}
		}
		if (delta.objects !== null) {
			// The delta names exactly the object records whose reference the rebuild
			// replaced, and the compiler proved the unit's ids are unchanged in order, so
			// every other object's retained derivation still describes that same record.
			for (const object of delta.objects) {
				derive('object', object.objectId, [objectCandidate(object)], measurement);
			}
		}
		countWork('plan:source-delta-applied');
		return true;
	}

	/** The complete walk: the cold path, and the fallback whenever a delta is not proven. */
	function reconcileAll(
		compiled: CompiledLayoutGeometry,
		measurement: MeasurementContext,
		rederive: boolean
	): boolean {
		const openingList: CompiledOpening[] = [];
		const openingIds = new Set<string>();
		openingsAreUnique = true;
		walkWalls(compiled, (wall) => {
			for (const opening of wall.openings) {
				if (openingIds.has(opening.openingId)) {
					openingsAreUnique = false;
					continue;
				}
				openingIds.add(opening.openingId);
				openingList.push(opening);
			}
		});
		const walls = reconcileKind<CompiledPhysicalWall>('wall', (visit) => walkWalls(compiled, visit), (wall) => wall.wallId, (wall) => wallCandidatesOf(wall, measurement.datumMeters), (previous, wall) => wallUnchanged(previous, wall, measurement.datumMeters), measurement, rederive);
		const openingsAdded = walls === null ? null : reconcileKind<CompiledOpening>('opening', (visit) => { for (const opening of openingList) visit(opening); }, (opening) => opening.openingId, (opening) => [openingCandidate(opening, measurement.datumMeters)], (previous, opening) => openingUnchanged(previous, opening, measurement.datumMeters), measurement, rederive);
		const objectsAdded = openingsAdded === null ? null : reconcileKind<CompiledLayoutObject>('object', (visit) => { for (const object of compiled.objects) visit(object); }, (object) => object.objectId, (object) => [objectCandidate(object)], objectUnchanged, measurement, rederive);
		const roomsAdded = objectsAdded === null ? null : reconcileKind<CompiledRoom>('room-floor', (visit) => walkRooms(compiled, visit), (room) => room.roomId, (room) => [roomFloorCandidate(room)], roomFloorUnchanged, measurement, rederive);
		// A source id shared by two kinds is merged into one membership row by the
		// reference and by nothing else; ask it rather than modelling that here.
		const addedIds = [...(walls ?? []), ...(openingsAdded ?? []), ...(objectsAdded ?? []), ...(roomsAdded ?? [])];
		return (
			roomsAdded !== null &&
			!addedIds.some((id) => {
				let kinds = 0;
				for (const kind of PLAN_SOURCE_KINDS) if (indexes.get(kind)!.byId.has(id)) kinds += 1;
				return kinds > 1;
			})
		);
	}

	return {
		evaluate(compiled, parameters, context) {
			const issues = parameterIssues(parameters, context);
			if (issues.length > 0) {
				const invalidContext = issues.every((issue) => issue.path.startsWith('$.context'));
				return { kind: 'refused', code: invalidContext ? 'invalid-context' : 'invalid-parameters', issues };
			}

			// Everything the derivation reads, in one unambiguous string. The generation is
			// deliberately absent: a new generation changes the fragments, never a derivation.
			const nextDerivation = JSON.stringify([
				context.datumMeters,
				parameters.cutHeightMeters,
				parameters.depthMeters,
				parameters.lateralSpanHalfWidthMeters,
				parameters.sourceKindFilter,
				parameters.reveal,
				planDependsOnTarget(parameters) ? context.target : null
			]);
			if (
				result !== null &&
				generation === context.generationId &&
				derivation === nextDerivation &&
				sameSource(compiled)
			) {
				return result;
			}

			pass += 1;
			const measurement = measurementContext(parameters, context);
			const rederive = derivation !== nextDerivation;
			// Ask the compiler's persistent roots first. Their answer is a difference between
			// two proven roots — not a caller's claim about which entities are dirty — and
			// `null` means "cannot prove it", which is the complete walk below.
			const delta = rederive ? null : deltaOf(compiled);
			const applied = delta !== null && applyDelta(delta, measurement, measurement.datumMeters);
			if (!applied && !reconcileAll(compiled, measurement, rederive)) {
				clear();
				return evaluateLayoutPlan(compiled, parameters, context);
			}

			const evaluated: PlanEvaluationResult = { kind: 'evaluated', plan: assemble(parameters, context, measurement) };
			derivation = nextDerivation;
			generation = context.generationId;
			rememberSource(compiled);
			result = evaluated;
			return evaluated;
		},
		clear
	};
}
