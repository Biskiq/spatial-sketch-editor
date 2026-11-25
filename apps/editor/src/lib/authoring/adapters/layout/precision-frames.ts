/**
 * Layout pointer, station and frame geometry.
 *
 * These readings are pure functions of one authored Layout document: frame
 * construction, arc-length stations, pointer inversion and knot previews. They
 * carry no planner, no intent and no mutable state, so the precision planners
 * and the gesture sessions can read them without loading the operation set.
 */
import { lookupIndexedJunction, lookupIndexedWall } from '@portfolio/layout-core/world';
import { planConvertWallToLine, planDeleteWallCurveKnot, projectPointToWallCenterline, wallCenterlineSamples, type FixedWallEndpoint, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';

/**
 * The canonical frame of a **straight** Wall, read from the authored document.
 *
 * `null` for a curved Wall: exact length and exact angle are straight-Wall
 * solves (the retained planners refuse a curve with `curved_wall_unsupported`),
 * so no such handle is offered for one; its precision scalar edits remain.
 * Direction is canonical start → end; the angle is the same `atan2(z, x)` the
 * planner solves in.
 */
export type WallFrame = {
	readonly wallId: string;
	/** The canonical Junctions the Wall's endpoints name. */
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	readonly direction: LayoutVec2;
	readonly length: number;
	readonly angleRadians: number;
};

export function wallFrame(document: LayoutDocumentWallFirst, wallId: string): WallFrame | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined || wall.centerline.kind !== 'line') return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const length = Math.hypot(dx, dz);
	if (!(length > 0)) return null;
	return {
		wallId,
		startJunctionId: wall.startJunctionId,
		endJunctionId: wall.endJunctionId,
		start: [start[0], start[1]],
		end: [end[0], end[1]],
		direction: [dx / length, dz / length],
		length,
		angleRadians: Math.atan2(dz, dx)
	};
}

/**
 * The canonical frame of a **curved** open Wall: its sampled centerline read
 * through the one geometry authority, with physical arc distances.
 *
 * A straight Wall has no curved frame (`wallFrame` owns it), and a resolved
 * sample derivation is required: a chain that cannot be sampled is not
 * addressable, so the caller gets `null` rather than a guessed polyline.
 */
export type CurvedWallFrame = {
	readonly wallId: string;
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	/** Exact sampled arc length, not the chord. */
	readonly length: number;
	readonly samples: readonly {
		readonly point: LayoutVec2;
		readonly distance: number;
		readonly tangent: LayoutVec2;
	}[];
};

/** One open Wall's sampled frame, straight or curved. */
export type OpenWallFrame = CurvedWallFrame;

/**
 * The frame the Bend gesture consumes. Unlike `curvedWallFrame` it also
 * resolves a straight Wall, because a body press must bend it on the spot; the
 * sampled length of a `line` centerline is its chord.
 */
export function openWallFrame(document: LayoutDocumentWallFirst, wallId: string): OpenWallFrame | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined) return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	if (wall.startJunctionId === wall.endJunctionId) return null;
	const sampled = wallCenterlineSamples(
		{ id: wall.id, centerline: wall.centerline },
		[start[0], start[1]],
		[end[0], end[1]],
		'forward'
	);
	if (sampled === undefined || !(sampled.length > 0) || sampled.samples.length < 2) return null;
	return {
		wallId,
		startJunctionId: wall.startJunctionId,
		endJunctionId: wall.endJunctionId,
		start: [start[0], start[1]],
		end: [end[0], end[1]],
		length: sampled.length,
		samples: sampled.samples.map((sample) => ({
			point: [sample.point[0], sample.point[1]] as LayoutVec2,
			distance: sample.distance,
			tangent: [sample.tangent[0], sample.tangent[1]] as LayoutVec2
		}))
	};
}

export function curvedWallFrame(document: LayoutDocumentWallFirst, wallId: string): CurvedWallFrame | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined || wall.centerline.kind === 'line') return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const sampled = wallCenterlineSamples(
		{ id: wall.id, centerline: wall.centerline },
		[start[0], start[1]],
		[end[0], end[1]],
		'forward'
	);
	if (sampled === undefined || !(sampled.length > 0) || sampled.samples.length < 2) return null;
	return {
		wallId,
		startJunctionId: wall.startJunctionId,
		endJunctionId: wall.endJunctionId,
		start: [start[0], start[1]],
		end: [end[0], end[1]],
		length: sampled.length,
		samples: sampled.samples.map((sample) => ({
			point: [sample.point[0], sample.point[1]] as LayoutVec2,
			distance: sample.distance,
			tangent: [sample.tangent[0], sample.tangent[1]] as LayoutVec2
		}))
	};
}

/**
 * The centerline point at one physical arc distance, with its tangent.
 *
 * This is the arc-length inverse the Opening marks and the Bend gesture need:
 * a station names the same place on a curved host that it names on a straight
 * one. A distance outside `[0, length]` is refused, never clamped.
 */
export function curvedWallPointAt(
	frame: CurvedWallFrame,
	distance: number
): { readonly point: LayoutVec2; readonly tangent: LayoutVec2 } | null {
	if (!Number.isFinite(distance) || distance < 0 || distance > frame.length) return null;
	for (let index = 1; index < frame.samples.length; index += 1) {
		const previous = frame.samples[index - 1]!;
		const next = frame.samples[index]!;
		if (distance > next.distance) continue;
		const span = next.distance - previous.distance;
		const t = span > 0 ? (distance - previous.distance) / span : 0;
		return {
			point: [
				previous.point[0] + (next.point[0] - previous.point[0]) * t,
				previous.point[1] + (next.point[1] - previous.point[1]) * t
			],
			tangent: [
				previous.tangent[0] + (next.tangent[0] - previous.tangent[0]) * t,
				previous.tangent[1] + (next.tangent[1] - previous.tangent[1]) * t
			]
		};
	}
	const last = frame.samples.at(-1)!;
	return { point: [last.point[0], last.point[1]], tangent: [last.tangent[0], last.tangent[1]] };
}

/**
 * The explicit parameter one pointer position names, given the endpoint that
 * **stays fixed**. This is the inverse the pointer path uses; it never builds a
 * document and never decides validity — the canonical planner does both.
 *
 * Dragging the start keeps the end fixed (`fixed: 'end'`), so each helper takes
 * the fixed endpoint explicitly rather than assuming which end is held.
 */
export function wallLengthFromPointer(
	frame: WallFrame,
	fixed: FixedWallEndpoint,
	point: readonly [number, number]
): number {
	const fixedPoint = fixed === 'start' ? frame.start : frame.end;
	// Signed distance **from the fixed endpoint toward the moving one**. The
	// planner always places the moved endpoint on the side of the fixed point the
	// Wall already extends to, so a pointer on the other side is not a length: a
	// magnitude here would mirror the preview across the fixed endpoint (and
	// install a Wall the pointer never named). Negative means the pointer crossed
	// the fixed endpoint; the adapter refuses it instead of clamping.
	const along =
		(point[0] - fixedPoint[0]) * frame.direction[0] + (point[1] - fixedPoint[1]) * frame.direction[1];
	return fixed === 'start' ? along : -along;
}

export function wallAngleFromPointer(
	fixedPoint: readonly [number, number],
	point: readonly [number, number],
	fixed: FixedWallEndpoint
): number {
	// The planner's angle is always the Wall's canonical **start → end**
	// direction. With `start` fixed, the pointer names that direction directly.
	// With `end` fixed it names the opposite ray, so the vector is reversed here —
	// otherwise dragging the start would rotate the Wall 180° away from the hand.
	const x = fixed === 'start' ? point[0] - fixedPoint[0] : fixedPoint[0] - point[0];
	const z = fixed === 'start' ? point[1] - fixedPoint[1] : fixedPoint[1] - point[1];
	return Math.atan2(z, x);
}

export type WallManipulationRequest =
	| { readonly kind: 'length'; readonly length: number }
	| { readonly kind: 'angle'; readonly angleRadians: number }
	| { readonly kind: 'move'; readonly delta: LayoutVec2 }
	| { readonly kind: 'junction'; readonly junctionId: string; readonly point: LayoutVec2 };

/** One Wall reshaped by a shared-Junction edit, at its candidate endpoint. */
export type WallNeighbourPreview = {
	readonly wallId: string;
	/** The point the edited junction moved this neighbour to. */
	readonly point: LayoutVec2;
};

/**
 * The station frame Opening marks consume: one `pointAt` that is linear on a
 * straight Wall (byte-identical to `framePoint`) and arc-length on a curved
 * one, so an Opening handle lands on the curve instead of on its chord.
 */
export type WallStationFrame = {
	readonly wallId: string;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	readonly length: number;
	readonly direction: LayoutVec2;
	readonly curved: boolean;
	readonly pointAt: (distance: number) => { readonly point: LayoutVec2; readonly tangent: LayoutVec2 } | null;
};

export function wallStationFrame(document: LayoutDocumentWallFirst, wallId: string): WallStationFrame | null {
	const curved = curvedWallFrame(document, wallId);
	if (curved !== null) {
		return {
			wallId,
			start: curved.start,
			end: curved.end,
			length: curved.length,
			direction: [
				(curved.end[0] - curved.start[0]) / Math.hypot(curved.end[0] - curved.start[0], curved.end[1] - curved.start[1]),
				(curved.end[1] - curved.start[1]) / Math.hypot(curved.end[0] - curved.start[0], curved.end[1] - curved.start[1])
			],
			curved: true,
			pointAt: (distance) => curvedWallPointAt(curved, distance)
		};
	}
	const straight = wallFrame(document, wallId);
	if (straight === null) return null;
	return {
		wallId,
		start: straight.start,
		end: straight.end,
		length: straight.length,
		direction: straight.direction,
		curved: false,
		pointAt: (distance) =>
			distance < 0 || distance > straight.length
				? null
				: {
						point: [
							straight.start[0] + straight.direction[0] * distance,
							straight.start[1] + straight.direction[1] * distance
						],
						tangent: straight.direction
					}
	};
}

/**
 * The physical station a document point names on one Wall, straight or curved.
 * `null` when the Wall is unresolved or its centerline cannot be sampled.
 */
export function wallStationAtPoint(
	document: LayoutDocumentWallFirst,
	wallId: string,
	point: readonly [number, number]
): number | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined) return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const projected = projectPointToWallCenterline(
		{ id: wall.id, centerline: wall.centerline },
		[start[0], start[1]],
		[end[0], end[1]],
		[point[0], point[1]]
	);
	return projected === undefined ? null : projected.distance;
}

/**
 * The physical station a document point names, only when the point actually
 * lies within `maxDistanceToPath` of the sampled centerline.
 *
 * A body press is resolved against the Wall's own samples rather than a scene
 * pick: a curved face has no chord to pick, and nearness is measured in the
 * same metres every station uses. A point outside the tolerance is not the
 * Wall's body and returns `null`.
 */
export function wallStationNearPoint(
	document: LayoutDocumentWallFirst,
	wallId: string,
	point: readonly [number, number],
	maxDistanceToPath: number
): number | null {
	const wall = lookupIndexedWall(document, wallId);
	if (wall === undefined) return null;
	const start = lookupIndexedJunction(document, wall.startJunctionId)?.point;
	const end = lookupIndexedJunction(document, wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const projected = projectPointToWallCenterline(
		{ id: wall.id, centerline: wall.centerline },
		[start[0], start[1]],
		[end[0], end[1]],
		[point[0], point[1]]
	);
	if (projected === undefined || projected.distanceToPath > maxDistanceToPath) return null;
	return projected.distance;
}

/**
 * The exact candidate a Card knot action would install, or its refusal.
 * The action runs this before acceptance, so a refused edit is named without a
 * write and the accepted edit is the same planner's document.
 */
export function previewWallKnotDelete(
	document: LayoutDocumentWallFirst,
	wallId: string,
	knotId: string
):
	| { readonly kind: 'planned'; readonly document: LayoutDocumentWallFirst }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string } {
	const plan = planDeleteWallCurveKnot(document, wallId, knotId);
	return plan.kind === 'rejected'
		? { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message }
		: { kind: 'planned', document: plan.document };
}

/** The exact Straighten candidate, or its refusal. */
export function previewWallStraighten(
	document: LayoutDocumentWallFirst,
	wallId: string
):
	| { readonly kind: 'planned'; readonly document: LayoutDocumentWallFirst }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string } {
	const plan = planConvertWallToLine(document, wallId);
	return plan.kind === 'rejected'
		? { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message }
		: { kind: 'planned', document: plan.document };
}
