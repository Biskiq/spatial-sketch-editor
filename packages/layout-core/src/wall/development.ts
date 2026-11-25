/**
 * `layout-wall-development.ts` — the one development map for a Wall.
 *
 * This module owns the data/geometry proof surface only; it
 * has no editor imports and no UI state. One mechanism serves every valid Wall:
 * straight, multi-Bézier, S-curve, inflection and closed self-connected chains.
 *
 * ## Reference surface
 *
 * The development is isometric along the **centerline**. Stations, Opening
 * offsets/widths and Wall length are centerline quantities. Wall faces at
 * signed offset `w` are *not* isometric: at `u = 1` both face polylines have the
 * centerline's developed length, so the inner face stretches and the outer face
 * shrinks. No code here labels a face length as true, and
 * {@link wallDevelopmentFaceLengths} reports the measured source lengths for
 * evidence only.
 *
 * ## Station mapping
 *
 * At `u = 1` a centerline station `s` sits `s - anchorStation` from the anchor
 * along the developed straight line. Open Walls use that coordinate directly
 * (`anchorStation` is normally 0). A closed Wall rotates the sheet so the
 * **display cut** is at the sheet ends: `sheet = wrap(s - cutStation, L)`.
 * `cutStation` is opposite the anchor and the canonical seam remains
 * station 0; the seam is a tick at `wrap(-cutStation, L)`, never a moved
 * Junction or a changed canonical station.
 *
 * ## Mesh attribution
 *
 * Every developed vertex and triangle carries the canonical station and the
 * source span (`startKnotId`/`endKnotId`). A validation issue from a bad span
 * or triangle therefore names the violating span, never a bare coordinate.
 */

export {
	WALL_DEVELOPMENT_TOLERANCE,
	WALL_DEVELOPMENT_STATION_TOLERANCE
} from './development/types';
export type {
	WallDevelopmentRefusal,
	WallDevelopmentSourceSpan,
	WallDevelopment,
	WallDevelopmentBuffers,
	WallDevelopmentPoint,
	WallDevelopmentFace,
	WallDevelopmentIssueCode,
	WallDevelopmentIssue,
	WallDevelopmentOpeningInput,
	WallDevelopmentOpeningFragment,
	WallDevelopmentOpening,
	WallDevelopmentMeshVertex,
	WallDevelopmentMeshTriangle,
	WallDevelopmentMesh,
	WallDevelopmentMeshHole,
	WallDevelopmentMeshOptions,
	WallDevelopmentSheetBuffers,
	WallDevelopmentDisplaySample,
	WallDevelopmentInversePoint,
	WallDevelopmentFaceFrame,
	WallDevelopmentOpeningBand
} from './development/types';
export { isWallDevelopmentRefusal, prepareWallDevelopment, evaluateWallDevelopment, createWallDevelopmentBuffers } from './development/core';
export {
	createWallDevelopmentSheetBuffers,
	evaluateWallDevelopmentSheet,
	developmentPointAtSheetFromBuffers,
	developmentPointAtStation,
	developmentPointAtStationFromBuffers,
	developmentStationDistanceFromAnchor,
	developmentSheetCoordinate,
	developmentSheetToStation,
	mapAttributedVertices
} from './development/sheet';
export { developmentDisplaySamples, developmentInversePoint, developmentFaceFrame } from './development/display';
export {
	developmentOpeningTopAt,
	developmentOpeningIdentity,
	wallDevelopmentFaceLengths,
	developmentOpeningFragments
} from './development/openings';
export { buildDevelopedWallMesh } from './development/mesh';
export { validateWallDevelopment, validateDevelopedMesh, developmentOverlap } from './development/validate';
export { spanForStation, orderedDevelopmentSamples } from './development/shared';
