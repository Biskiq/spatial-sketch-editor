import type { LayoutWall } from './types';
import type { LayoutVec2 } from '../geometry/coordinates';
import { wallCubicChain } from './centerline';
import { JUNCTION_COINCIDENCE_EPSILON } from './junction-identity';

/**
 * A3 — one **drawn Arc** leg: the chain leg starting at `pointIndex` bulges
 * through `apex`.
 *
 * The apex is the creator's bulge point on the working plane. Only its
 * perpendicular distance from the chord is geometry (the rise), measured on the
 * chord's midpoint normal, so the drawn arc is always a circular arc through the
 * two endpoints. Nothing here is a new centerline kind: the leg is committed as
 * the canonical `cubic-chain` every bent Wall already uses.
 */
export type WallChainArc = {
	readonly pointIndex: number;
	readonly apex: LayoutVec2;
};

/**
 * The least rise (sagitta) an Arc may carry.
 *
 * Below it the two endpoints and the bulge are indistinguishable from a straight
 * leg, so the same stroke commits a `line` Wall instead of a nearly-flat cubic.
 * This is the one minimum the interaction and the planner share.
 */
export const MIN_WALL_ARC_RISE = 0.02;

/** What an Arc's two endpoints and its bulge point state physically. */
export type WallArcMeasures = {
	/** The straight endpoint-to-endpoint distance. */
	readonly chord: number;
	/** Signed perpendicular distance from the chord midpoint to the bulge. */
	readonly rise: number;
	/** The circular radius the three points state, never a fitted tolerance. */
	readonly radius: number;
	/** The bulge projected onto the chord's midpoint normal. */
	readonly apex: LayoutVec2;
};

/**
 * Measure one drawn Arc exactly from its start, end and bulge point.
 *
 * `rise` keeps its sign (which side of the chord bulges) and `radius` is the
 * circumradius of the three stated points. A degenerate chord has no arc to
 * measure and answers `null` rather than an invented radius.
 */
export function measureWallArc(
	start: LayoutVec2,
	end: LayoutVec2,
	apex: LayoutVec2,
): WallArcMeasures | null {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const chord = Math.hypot(dx, dz);
	if (!(chord > JUNCTION_COINCIDENCE_EPSILON)) return null;
	if (![apex[0], apex[1]].every(Number.isFinite)) return null;
	const nx = -dz / chord;
	const nz = dx / chord;
	const mx = (start[0] + end[0]) / 2;
	const mz = (start[1] + end[1]) / 2;
	const rise = (apex[0] - mx) * nx + (apex[1] - mz) * nz;
	const magnitude = Math.abs(rise);
	return {
		chord,
		rise,
		radius:
			magnitude > JUNCTION_COINCIDENCE_EPSILON
				? (chord * chord) / (8 * magnitude) + magnitude / 2
				: Number.POSITIVE_INFINITY,
		apex: [mx + nx * rise, mz + nz * rise],
	};
}

/**
 * The canonical centerline one Arc leg commits.
 *
 * A rise below {@link MIN_WALL_ARC_RISE} is the straight fallback. Otherwise the
 * leg is one cubic span whose controls are the standard circular-arc control
 * distance, so it is stored exactly like every other `cubic-chain` Wall and no
 * bend-point identity is minted (there is nothing to replay). A bulge past the
 * semicircle is refused: a single cubic cannot describe a major arc, and the
 * minor arc is the shape a bulge means.
 */
export function wallChainArcCenterline(
	start: LayoutVec2,
	end: LayoutVec2,
	apex: LayoutVec2,
): { readonly centerline: LayoutWall['centerline']; readonly measures: WallArcMeasures } | null {
	const measures = measureWallArc(start, end, apex);
	if (measures === null) return null;
	const rise = measures.rise;
	const magnitude = Math.abs(rise);
	if (magnitude < MIN_WALL_ARC_RISE) return { centerline: { kind: 'line' }, measures };
	if (magnitude > measures.chord / 2 + JUNCTION_COINCIDENCE_EPSILON) return null;
	const radius = measures.radius;
	// The arc's half-angle; the cubic control distance is the standard circular
	// approximation, exact at the endpoints and tangent at both ends.
	const halfAngle = Math.asin(Math.min(1, measures.chord / 2 / radius));
	const control = (4 / 3) * radius * Math.tan(halfAngle / 2);
	const dx = (end[0] - start[0]) / measures.chord;
	const dz = (end[1] - start[1]) / measures.chord;
	const turn = Math.sign(rise) * halfAngle;
	const rotate = (angle: number): LayoutVec2 => [
		dx * Math.cos(angle) - dz * Math.sin(angle),
		dx * Math.sin(angle) + dz * Math.cos(angle),
	];
	const startTangent = rotate(turn);
	const endTangent = rotate(-turn);
	return {
		centerline: wallCubicChain(
			[],
			[
				{
					handleOut: [start[0] + startTangent[0] * control, start[1] + startTangent[1] * control],
					handleIn: [end[0] - endTangent[0] * control, end[1] - endTangent[1] * control],
				},
			],
		),
		measures,
	};
}
