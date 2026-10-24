/**
 * `layout-path.ts` — the authored plan-path records.
 *
 * A `DraftPath` is a closed ordered chain of `DraftSegment`s, each either a
 * straight line or an auto-bezier through explicit interior anchors. T1.P02.S05
 * moved these records here from the retired legacy document barrel: they are
 * live authored vocabulary — a Layout object's `profile` is a `DraftPath`, and
 * the compiler's sampling kernel accepts a line or auto-bezier segment — but
 * they are not a document, a Room or a Floor.
 *
 * Wall centerlines are **not** expressed here. A wall-first Wall owns its
 * centerline in `layout-wall-first-types.ts` (`LayoutWallCenterline`), and the
 * derived cubic-chain sampling records live in `layout-geometry-curve.ts`.
 */
import type { LayoutVec2 } from './layout-coordinates';

export type LayoutInteriorAnchor = {
	id: string;
	point: LayoutVec2;
};

export type DraftSegment =
	| { id: string; kind: 'line'; start: LayoutVec2; end: LayoutVec2 }
	| {
			id: string;
			kind: 'auto-bezier';
			start: LayoutVec2;
			end: LayoutVec2;
			interiorAnchors: LayoutInteriorAnchor[];
	  };

export type DraftPath = {
	closed: true;
	segments: DraftSegment[];
};
