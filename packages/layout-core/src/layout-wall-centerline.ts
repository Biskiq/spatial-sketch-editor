/**
 * `layout-wall-centerline.ts` — P23.11 canonical Wall-centerline helpers.
 *
 * One seam between the canonical Wall representation and the curve kernel:
 * every consumer that needs Wall centerline geometry (compiler, topology,
 * Opening sets, planners) reads it through this module or the sampled output
 * of {@link wallCenterlineSegment}. Curve evaluation is never duplicated.
 *
 * Deep-clone helpers exist because candidate planners must never share anchor
 * arrays or points with the baseline document.
 */
import type { LayoutVec2 } from './layout-types';
import type {
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallCurveAnchor
} from './layout-wall-first-types';
import {
	sampleSegment,
	type SampledSegment
} from './layout-geometry-curve';

/** Deep-copy one canonical centerline (anchors cloned point-wise). */
export function cloneWallCenterline(centerline: LayoutWallCenterline): LayoutWallCenterline {
	if (centerline.kind === 'line') return { kind: 'line' };
	return {
		kind: 'auto-bezier',
		interiorAnchors: centerline.interiorAnchors.map((anchor) => ({
			id: anchor.id,
			point: [anchor.point[0], anchor.point[1]] as LayoutVec2
		}))
	};
}

/** The canonical Wall centerline mapped onto the curve-kernel segment shape. */
export type WallCenterlineSegment =
	| { id: string; kind: 'line'; start: LayoutVec2; end: LayoutVec2 }
	| {
			id: string;
			kind: 'auto-bezier';
			start: LayoutVec2;
			end: LayoutVec2;
			interiorAnchors: LayoutWallCurveAnchor[];
	  };

/**
 * Map the canonical Wall representation onto the existing curve kernel.
 *
 * Returns the `DraftSegment`-shaped input `sampleSegment()` consumes: a
 * `line` segment between the resolved endpoint Junction points, or an
 * `auto-bezier` segment carrying the Wall's ordered interior anchors. This is
 * the ONE adapter — no compiler/topology/Opening code builds Wall curve
 * segments by hand.
 */
export function wallCenterlineSegment(
	wall: Pick<LayoutWall, 'id' | 'centerline'>,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2
): WallCenterlineSegment {
	if (wall.centerline.kind === 'line') {
		return {
			id: wall.id,
			kind: 'line',
			start: [startPoint[0], startPoint[1]] as LayoutVec2,
			end: [endPoint[0], endPoint[1]] as LayoutVec2
		};
	}
	return {
		id: wall.id,
		kind: 'auto-bezier',
		start: [startPoint[0], startPoint[1]] as LayoutVec2,
		end: [endPoint[0], endPoint[1]] as LayoutVec2,
		interiorAnchors: wall.centerline.interiorAnchors.map((anchor) => ({
			id: anchor.id,
			point: [anchor.point[0], anchor.point[1]] as LayoutVec2
		}))
	};
}

/**
 * Sample a Wall's canonical centerline through the single curve evaluator.
 * `undefined` when the endpoints are unresolved or sampling rejects.
 */
export function wallCenterlineSamples(
	wall: Pick<LayoutWall, 'id' | 'centerline'>,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2
): SampledSegment | undefined {
	try {
		return sampleSegment(wallCenterlineSegment(wall, startPoint, endPoint));
	} catch {
		return undefined;
	}
}
