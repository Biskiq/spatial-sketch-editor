/**
 * `layout-closed-wall.ts` — the canonical closed-Wall foundation (D6).
 *
 * A closed Wall is **one ordinary Wall record whose start and end Junction IDs
 * are equal**. It is not a parametric circle kind: the persisted centerline is
 * the same `cubic-chain` representation used by every open curved Wall, with
 * exactly 16 cubic spans and 15 interior bend points. Keeping one representation
 * is what lets identity, Room tracing, Openings and Save/Load consume closed
 * Walls without a second geometry vocabulary.
 *
 * The authored seam is the Wall's single Junction. D9 authors it at the rim
 * point (centre → rim), and because the seam is a Junction ID rather than a
 * sampled coordinate it survives Save/Load exactly. The later display cut
 * (D11) is a presentation decision derived from the unfold anchor; it never
 * moves this canonical seam.
 *
 * The 16-span arc approximation uses the standard cubic circular-arc control
 * distance `k = 4/3 * tan(θ/4)` for `θ = 2π/16`. Measured at the contract's
 * reference radius of 5 m (dense radial sampling plus true cubic arc length):
 *
 * - maximum radial error: 3.3162e-7 m
 * - circumference error:   1.0716e-6 m
 *
 * `CLOSED_WALL_CIRCLE_ACCURACY` records tolerances of 1e-6 m and 2e-6 m: tight
 * enough that a chord, an 8-span chain or a changed handle rule fails, and
 * still measured headroom over the 16-span construction. Do not widen these
 * without replacing the representation decision.
 */
import type { LayoutVec2 } from './layout-coordinates';
import type {
	LayoutDocumentWallFirst,
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallCubicSpan,
	LayoutWallCurveKnot
} from './layout-wall-first-types';
import { CLOSED_WALL_CIRCLE_KNOT_COUNT, CLOSED_WALL_CIRCLE_SPAN_COUNT } from './layout-wall-first-types';
import { createEmptyWallFirstLayoutDocument } from './layout-wall-first-codec';
import { wallCubicChain } from './layout-wall-centerline';

/** A closed Wall is exactly a Wall whose endpoint Junction identity is equal. */
export function isClosedWall(wall: Pick<LayoutWall, 'startJunctionId' | 'endJunctionId'>): boolean {
	return wall.startJunctionId === wall.endJunctionId;
}

export type ClosedWallCircleAccuracy = {
	/** Radius the tolerances were measured at, in metres. */
	referenceRadius: number;
	/** Dense radial deviation from the exact circle, in metres. */
	maxRadialError: number;
	/** `|chain length − 2πr|`, in metres. */
	maxLengthError: number;
	/** Recorded measurement at `referenceRadius`, in metres. */
	measured: {
		radialError: number;
		lengthError: number;
	};
};

/**
 * Explicit accuracy contract for the approved 16-span closed Bézier Wall.
 *
 * This is a product contract, not a sampler detail: the closed Wall must be a
 * circle to better than a micrometre at a 5 m radius. Tests evaluate the
 * persisted cubics directly (dense parameter sampling and true cubic arc
 * length), so they cannot pass by consuming a coarse render polyline.
 */
export const CLOSED_WALL_CIRCLE_ACCURACY: ClosedWallCircleAccuracy = {
	referenceRadius: 5,
	maxRadialError: 1e-6,
	maxLengthError: 2e-6,
	measured: {
		radialError: 3.3162019885679683e-7,
		lengthError: 1.0715859062315758e-6
	}
};

export type ClosedWallCircleRejection = {
	code: 'degenerate_radius' | 'invalid_dimension';
	message: string;
};

export type ClosedWallCircleConstruction =
	| {
			kind: 'success';
			centerline: Extract<LayoutWallCenterline, { kind: 'cubic-chain' }>;
			radius: number;
			/** Authored rim point, i.e. the canonical seam's coordinate. */
			seam: LayoutVec2;
	  }
	| { kind: 'rejected'; rejection: ClosedWallCircleRejection };

function finitePoint(point: LayoutVec2 | undefined): point is LayoutVec2 {
	return (
		point !== undefined &&
		Number.isFinite(point[0]) &&
		Number.isFinite(point[1])
	);
}

/**
 * Build the canonical 16-span closed cubic chain for one centre → rim gesture.
 *
 * Knot and handle identity is derived from `wallId`, never from coordinates or
 * traversal order. The first span starts at the authored rim point and the last
 * span ends at that exact same object value, so the chain closes without a
 * floating-point snap and the seam does not drift through serialization.
 */
export function buildClosedWallCircleCenterline(options: {
	center: LayoutVec2;
	rim: LayoutVec2;
	wallId: string;
}): ClosedWallCircleConstruction {
	const { center, rim, wallId } = options;
	if (!finitePoint(center) || !finitePoint(rim)) {
		return {
			kind: 'rejected',
			rejection: { code: 'degenerate_radius', message: 'A closed Wall needs finite centre and rim points' }
		};
	}
	const radius = Math.hypot(rim[0] - center[0], rim[1] - center[1]);
	if (!(radius > 1e-9) || !Number.isFinite(radius)) {
		return {
			kind: 'rejected',
			rejection: { code: 'degenerate_radius', message: 'The authored rim must be farther than 1e-9 m from the centre' }
		};
	}

	const seam: LayoutVec2 = [rim[0], rim[1]];
	const startAngle = Math.atan2(rim[1] - center[1], rim[0] - center[0]);
	const step = (Math.PI * 2) / CLOSED_WALL_CIRCLE_SPAN_COUNT;
	// Standard circular-arc cubic control distance for an arc of `step`.
	const handleDistance = (4 / 3) * Math.tan(step / 4) * radius;
	const pointAt = (angle: number): LayoutVec2 => [
		center[0] + radius * Math.cos(angle),
		center[1] + radius * Math.sin(angle)
	];
	const tangentAt = (angle: number): LayoutVec2 => [-Math.sin(angle), Math.cos(angle)];

	const knots: LayoutWallCurveKnot[] = [];
	const spans: LayoutWallCubicSpan[] = [];
	let spanStart = seam;
	for (let index = 0; index < CLOSED_WALL_CIRCLE_SPAN_COUNT; index += 1) {
		const startAngleOfSpan = startAngle + index * step;
		const endAngleOfSpan = startAngle + (index + 1) * step;
		// The final endpoint reuses the authored seam object value, not a
		// trigonometric recomputation, so closure is exact even after a JSON round
		// trip. Every interior boundary point remains an ordinary authored knot.
		const end =
			index === CLOSED_WALL_CIRCLE_SPAN_COUNT - 1
				? seam
				: pointAt(endAngleOfSpan);
		const startTangent = tangentAt(startAngleOfSpan);
		const endTangent = tangentAt(endAngleOfSpan);
		spans.push({
			handleOut: [
				spanStart[0] + handleDistance * startTangent[0],
				spanStart[1] + handleDistance * startTangent[1]
			],
			handleIn: [
				end[0] - handleDistance * endTangent[0],
				end[1] - handleDistance * endTangent[1]
			]
		});
		if (index < CLOSED_WALL_CIRCLE_SPAN_COUNT - 1) {
			knots.push({
				id: `${wallId}:knot:${index + 1}`,
				point: [end[0], end[1]]
			});
		}
		spanStart = end;
	}
	if (knots.length !== CLOSED_WALL_CIRCLE_KNOT_COUNT || spans.length !== CLOSED_WALL_CIRCLE_SPAN_COUNT) {
		throw new Error('closed Wall construction invariant failed');
	}
	const centerline = wallCubicChain(knots, spans);
	if (centerline.kind !== 'cubic-chain') throw new Error('closed Wall construction invariant failed');
	return { kind: 'success', centerline, radius, seam };
}

export type ClosedWallCircleDocumentResult =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			wall: LayoutWall;
			seam: LayoutVec2;
			radius: number;
	  }
	| { kind: 'rejected'; rejection: ClosedWallCircleRejection };

/**
 * Build the one-Junction, one-Wall candidate for a closed circle. Room identity
 * is deliberately NOT created here: the caller runs the existing face-tracing
 * and Room-birth path, so a closed Wall encloses for the same reason every other
 * ring does.
 */
export function createClosedWallCircleDocument(options: {
	center: LayoutVec2;
	rim: LayoutVec2;
	junctionId: string;
	wallId: string;
	thickness: number;
	height: number;
}): ClosedWallCircleDocumentResult {
	const { junctionId, wallId, thickness, height } = options;
	if (
		!Number.isFinite(thickness) ||
		thickness <= 0 ||
		!Number.isFinite(height) ||
		height <= 0
	) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'invalid_dimension',
				message: 'A closed Wall needs a finite, strictly positive thickness and height'
			}
		};
	}
	const construction = buildClosedWallCircleCenterline(options);
	if (construction.kind === 'rejected') return construction;
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [{ id: junctionId, point: [construction.seam[0], construction.seam[1]] }];
	const wall: LayoutWall = {
		id: wallId,
		startJunctionId: junctionId,
		endJunctionId: junctionId,
		thickness,
		height,
		centerline: construction.centerline
	};
	document.walls = [wall];
	return {
		kind: 'success',
		document,
		wall,
		seam: [construction.seam[0], construction.seam[1]],
		radius: construction.radius
	};
}
