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

/**
 * Deep-copy one canonical centerline with every interior anchor translated by
 * `delta` (document X/Z, meters). A rigid copy of a Wall must move its anchors
 * with its endpoint Junctions — an anchor left at the source position no
 * longer describes the same shape and can swing the curve across neighbouring
 * Walls. Flat `line` centerlines carry no absolute data.
 */
export function translateWallCenterline(
	centerline: LayoutWallCenterline,
	delta: LayoutVec2
): LayoutWallCenterline {
	if (centerline.kind === 'line') return { kind: 'line' };
	return {
		kind: 'auto-bezier',
		interiorAnchors: centerline.interiorAnchors.map((anchor) => ({
			id: anchor.id,
			point: [anchor.point[0] + delta[0], anchor.point[1] + delta[1]] as LayoutVec2
		}))
	};
}

/**
 * Which way a consumer walks a Wall: `forward` follows
 * `startJunctionId → endJunctionId`, `reverse` walks it back.
 */
export type WallCenterlineTraversal = 'forward' | 'reverse';

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
 *
 * `traversal` is required rather than defaulted: a reverse walk that forgot it
 * would silently trace a different curve, which is exactly the class of bug
 * this seam exists to prevent.
 */
export function wallCenterlineSegment(
	wall: Pick<LayoutWall, 'id' | 'centerline'>,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	traversal: WallCenterlineTraversal
): WallCenterlineSegment {
	const start = [startPoint[0], startPoint[1]] as LayoutVec2;
	const end = [endPoint[0], endPoint[1]] as LayoutVec2;
	if (wall.centerline.kind === 'line') {
		return { id: wall.id, kind: 'line', start, end };
	}
	// A reverse traversal walks the SAME curve from the end Junction back to
	// the start, so the interior anchors must be reversed too. Swapping only
	// the endpoints would chain the anchors in their persisted order and trace
	// a different curve — with two or more anchors a self-swallowing loop whose
	// arc length, area and samples are all wrong.
	const orderedAnchors =
		traversal === 'reverse'
			? [...wall.centerline.interiorAnchors].reverse()
			: wall.centerline.interiorAnchors;
	return {
		id: wall.id,
		kind: 'auto-bezier',
		start,
		end,
		interiorAnchors: orderedAnchors.map((anchor) => ({
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
	endPoint: LayoutVec2,
	traversal: WallCenterlineTraversal
): SampledSegment | undefined {
	try {
		return sampleSegment(wallCenterlineSegment(wall, startPoint, endPoint, traversal));
	} catch {
		return undefined;
	}
}
