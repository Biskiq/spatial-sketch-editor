/**
 * The **overlaps, not joined** cue: derived editor state over an accepted
 * Layout document.
 *
 * `independentWallOverlaps` is the one query; this module lifts its stretches
 * onto the level datum and contributes one persistent Stage guide per
 * overlapping pair. The cue is never authored, never written to history, never
 * serialized and never reaches a visitor surface. It reports permitted
 * placement (two independent Wall groups in the same plan location) and
 * changes no connectivity: the doubled Walls keep separate ids and no Junction
 * is adopted. It clears with the next accepted binding, because the binding is
 * rebuilt from the document that no longer overlaps.
 */
import { independentWallOverlaps, type LayoutDocumentWallFirst } from '@portfolio/layout-core';
import type { StageGuideContribution } from '$lib/authoring/stage/stage-adapter-host';

/** The cue's one sentence, shared by the guide label and the tests. */
export const LAYOUT_WALL_OVERLAP_CUE_LABEL = 'overlaps, not joined';

/** Stable guide id prefix; one guide per overlapping Wall pair. */
export const LAYOUT_WALL_OVERLAP_CUE_PREFIX = 'layout-wall-overlap-cue';

type Point3 = [number, number, number];

/** Lift a document X/Z point onto the Plan reading's surface. */
function atDatum(point: readonly [number, number], y: number): Point3 {
	return [point[0], y, point[1]];
}

/**
 * Every independent-Wall overlap as one Stage guide: dashed coincident
 * stretches and one tag at the longest stretch's midpoint. The guides are in
 * document order, so the contribution is deterministic.
 */
export function independentWallOverlapGuides(
	document: LayoutDocumentWallFirst,
	datumMeters: number
): readonly StageGuideContribution[] {
	// Just above the floor so the dashed stretch is not hidden by the Plan fill.
	const y = datumMeters + 0.02;
	return independentWallOverlaps(document).map((overlap) => {
		const derivedSegments: (readonly [Point3, Point3])[] = [];
		for (const stretch of overlap.stretches) {
			for (let index = 1; index < stretch.length; index += 1) {
				derivedSegments.push([
					atDatum(stretch[index - 1]!, y),
					atDatum(stretch[index]!, y)
				]);
			}
		}
		return {
			id: `${LAYOUT_WALL_OVERLAP_CUE_PREFIX}:${overlap.firstWallId}:${overlap.secondWallId}`,
			role: 'relation',
			segments: [],
			derivedSegments,
			labels: [{ world: atDatum(overlap.labelAt, y), text: LAYOUT_WALL_OVERLAP_CUE_LABEL }]
		};
	});
}
