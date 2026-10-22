/**
 * RR-4 disposable probe support. NOT production code, NOT an owner contract.
 *
 * Everything geometric here is composed from exported `@portfolio/layout-core`
 * primitives; the only probe-local rules are the (unratified) binding shape and
 * the consumer-side transport, which exist to measure what the owner does and
 * does not publish. Nothing here reconstructs topology or matches by proximity.
 */
import {
	CURVE_ARC_LENGTH_TOLERANCE,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	cubicBezierDerivative,
	deriveChainSpans,
	resolveWallCurveSplit,
	wallCurveChainCubics,
	wallCurveChainLength,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCurveKnot,
	type NodingIdAllocator,
	type WallCurveChain
} from '@portfolio/layout-core';

export { CURVE_ARC_LENGTH_TOLERANCE };

export type Side = 'left' | 'right';

/**
 * Probe-only evaluated attachment (alternative B). `s` is the arc distance of the
 * footprint centre from the host's canonical start; `side` is relative to the
 * canonical start→end tangent. Unratified sketch.
 */
export type Binding = {
	readonly id: string;
	readonly hostWallId: string;
	readonly s: number;
	readonly side: Side;
	readonly width: number;
	readonly standoff: number;
};

export type Pose = { readonly position: LayoutVec2; readonly facing: LayoutVec2 };

/** The occupancy-only allocator shape the landed noding adapter uses (taken = live IDs). */
export const occupancyAllocator: NodingIdAllocator = {
	nextWallId(document, seed) {
		const taken = new Set(document.walls.map((wall) => wall.id));
		if (!taken.has(seed)) return seed;
		let index = 2;
		while (taken.has(`${seed}.${index}`)) index += 1;
		return `${seed}.${index}`;
	},
	nextJunctionId(document, seed) {
		const taken = new Set(document.junctions.map((junction) => junction.id));
		if (!taken.has(seed)) return seed;
		let index = 2;
		while (taken.has(`${seed}.${index}`)) index += 1;
		return `${seed}.${index}`;
	}
};

export function emptyDoc(
	junctions: Record<string, LayoutVec2>,
	walls: LayoutWall[]
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: Object.entries(junctions).map(([id, point]) => ({ id, point: [point[0], point[1]] })),
		walls,
		rooms: [],
		openings: [],
		objects: []
	} as LayoutDocumentWallFirst;
}

export function lineWall(id: string, start: string, end: string): LayoutWall {
	return { id, startJunctionId: start, endJunctionId: end, role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } };
}

export function curvedWall(
	id: string,
	start: string,
	end: string,
	points: Record<string, LayoutVec2>,
	interior: LayoutVec2[]
): LayoutWall {
	const knots: LayoutWallCurveKnot[] = interior.map((point, index) => ({ id: `${id}:knot:${index + 1}`, point: [point[0], point[1]] }));
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		role: 'boundary',
		thickness: 0.2,
		height: 3,
		centerline: { kind: 'cubic-chain', knots, spans: deriveChainSpans([points[start]!, ...interior, points[end]!]) }
	};
}

function junctionPoint(document: LayoutDocumentWallFirst, id: string): LayoutVec2 {
	const junction = document.junctions.find((entry) => entry.id === id);
	if (!junction) throw new Error(`unknown junction ${id}`);
	return junction.point;
}

export function wallOf(document: LayoutDocumentWallFirst, id: string): LayoutWall | undefined {
	return document.walls.find((wall) => wall.id === id);
}

function chainOf(document: LayoutDocumentWallFirst, wall: LayoutWall): WallCurveChain {
	if (wall.centerline.kind !== 'cubic-chain') throw new Error('not a curve');
	return {
		startPoint: junctionPoint(document, wall.startJunctionId),
		endPoint: junctionPoint(document, wall.endJunctionId),
		knots: wall.centerline.knots,
		spans: wall.centerline.spans
	};
}

/** Owner arc length (straight chord or canonical cubic chain). */
export function arcLength(document: LayoutDocumentWallFirst, wallId: string): number {
	const wall = wallOf(document, wallId)!;
	if (wall.centerline.kind === 'line') {
		const a = junctionPoint(document, wall.startJunctionId);
		const b = junctionPoint(document, wall.endJunctionId);
		return Math.hypot(b[0] - a[0], b[1] - a[1]);
	}
	return wallCurveChainLength(chainOf(document, wall));
}

/**
 * Centerline point + unit tangent at arc distance `s` from the canonical start.
 * Curved Walls use the owner's single arc-length inverter (`resolveWallCurveSplit`)
 * and the owner cubic derivative. A missing owner query: there is no exported
 * `wallSurfaceFrameAt(wall, s, side)`; this composition stands in for it.
 */
export function frameAt(document: LayoutDocumentWallFirst, wallId: string, s: number): { point: LayoutVec2; tangent: LayoutVec2 } | null {
	const wall = wallOf(document, wallId);
	if (!wall) return null;
	if (wall.centerline.kind === 'line') {
		const a = junctionPoint(document, wall.startJunctionId);
		const b = junctionPoint(document, wall.endJunctionId);
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		const tangent: LayoutVec2 = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
		return { point: [a[0] + tangent[0] * s, a[1] + tangent[1] * s], tangent };
	}
	const chain = chainOf(document, wall);
	const resolved = resolveWallCurveSplit(chain, s);
	if (resolved.kind !== 'resolved') return null;
	const cubic = wallCurveChainCubics(chain)[resolved.result.spanIndex]!;
	const d = cubicBezierDerivative(cubic, resolved.result.t);
	const n = Math.hypot(d[0], d[1]);
	return { point: resolved.result.point, tangent: [d[0] / n, d[1] / n] };
}

/** Evaluated pose of one binding: the only pose authority under alternative B. */
export function evaluate(document: LayoutDocumentWallFirst, binding: Binding): Pose | null {
	const frame = frameAt(document, binding.hostWallId, binding.s);
	if (!frame) return null;
	const wall = wallOf(document, binding.hostWallId)!;
	const left: LayoutVec2 = [-frame.tangent[1], frame.tangent[0]];
	const normal: LayoutVec2 = binding.side === 'left' ? left : [-left[0], -left[1]];
	const offset = wall.thickness / 2 + binding.standoff;
	return { position: [frame.point[0] + normal[0] * offset, frame.point[1] + normal[1] * offset], facing: normal };
}

export function residual(a: Pose, b: Pose): { position: number; facingDot: number } {
	return {
		position: Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]),
		facingDot: a.facing[0] * b.facing[0] + a.facing[1] * b.facing[1]
	};
}

export type TransportOutcome =
	| { kind: 'transported'; binding: Binding }
	| { kind: 'needs-review'; cause: 'straddles-split' | 'over-opening'; binding: Binding };

/**
 * Consumer-side split transport derived from the owner's split result. The owner
 * keeps `W` on `A→X`, gives `X→B` one new ID and never reverses orientation; the
 * resolved split distance is NOT returned, so it is read back as the owner arc
 * length of the retained fragment.
 */
export function transportSplit(
	after: LayoutDocumentWallFirst,
	splitWallId: string,
	createdWallId: string,
	binding: Binding
): TransportOutcome {
	if (binding.hostWallId !== splitWallId) return { kind: 'transported', binding };
	const d = arcLength(after, splitWallId);
	const lo = binding.s - binding.width / 2;
	const hi = binding.s + binding.width / 2;
	if (hi <= d) return { kind: 'transported', binding };
	if (lo >= d) return { kind: 'transported', binding: { ...binding, hostWallId: createdWallId, s: binding.s - d } };
	return { kind: 'needs-review', cause: 'straddles-split', binding };
}

/**
 * Consumer-side dissolve transport derived from (before, after, survivor, retired).
 * Mirrors the owner's private Opening arithmetic; adds the side flip a face-bound
 * subject needs and an Opening has no notion of.
 */
export function transportDissolve(
	before: LayoutDocumentWallFirst,
	after: LayoutDocumentWallFirst,
	plan: { survivorWallId: string; retiredWallId: string; retiredJunctionId: string },
	binding: Binding,
	options: { flipSide: boolean } = { flipSide: true }
): TransportOutcome {
	if (binding.hostWallId !== plan.survivorWallId && binding.hostWallId !== plan.retiredWallId) return { kind: 'transported', binding };
	const survivorBefore = wallOf(before, plan.survivorWallId)!;
	const otherBefore = wallOf(before, plan.retiredWallId)!;
	const joined = wallOf(after, plan.survivorWallId)!;
	const survivorForward = survivorBefore.startJunctionId === joined.startJunctionId;
	const otherForward = otherBefore.startJunctionId === plan.retiredJunctionId;
	const survivorLength = arcLength(before, plan.survivorWallId);
	const otherLength = arcLength(before, plan.retiredWallId);
	const onSurvivor = binding.hostWallId === plan.survivorWallId;
	const start = onSurvivor ? 0 : survivorLength;
	const length = onSurvivor ? survivorLength : otherLength;
	const forward = onSurvivor ? survivorForward : otherForward;
	const s = forward ? start + binding.s : start + length - binding.s;
	const side: Side = forward || !options.flipSide ? binding.side : binding.side === 'left' ? 'right' : 'left';
	return { kind: 'transported', binding: { ...binding, hostWallId: plan.survivorWallId, s, side } };
}

/** Footprint overlap with any Opening interval on the host (consumer check; no owner query exists). */
export function overOpening(document: LayoutDocumentWallFirst, binding: Binding): boolean {
	const lo = binding.s - binding.width / 2;
	const hi = binding.s + binding.width / 2;
	return document.openings.some((opening) => opening.wallId === binding.hostWallId && lo < opening.offset + opening.width && hi > opening.offset);
}
