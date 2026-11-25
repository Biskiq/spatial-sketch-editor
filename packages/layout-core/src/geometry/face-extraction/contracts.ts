import type { LayoutVec2 } from '../coordinates';

export type TopologyDiagnostic = {
	code:
		| 'boundary_dangle'
		| 'boundary_cut_edge'
		| 'invalid_face_ring'
		| 'zero_area_face'
		| 'nested_boundary_loop'
		| 'touching_nested_loop';
	message: string;
	/** Involved authored IDs where available. */
	wallId?: string;
	faceKey?: string;
};


export type DerivedCandidateFace = {
	/** Deterministic ephemeral topology key; never a Room ID. */
	key: string;
	boundary: ReadonlyArray<{ wallId: string; direction: 'forward' | 'reverse' }>;
	/** Ordered vertices of the oriented cycle (interior on the left). */
	polygon: readonly LayoutVec2[];
	signedArea: number;
};


export type FaceExtractionResult = {
	faces: DerivedCandidateFace[];
	diagnostics: TopologyDiagnostic[];
	/** Boundary wall IDs excluded from the face graph as dangles. */
	danglingWallIds: string[];
	/** Boundary wall IDs that form no bounded face (cut edges / bridges). */
	cutEdgeWallIds: string[];
};


export type HalfEdge = {
	/** Directed edge: from junction `fromId` to junction `toId`. */
	fromId: string;
	toId: string;
	wallId: string;
	direction: 'forward' | 'reverse';
};


/**
 * The adjacency predicates' own slack, in metres. `polygonsShareInteriorArea`
 * treats a point as "on the ring" within this distance (its `withinRing` and
 * `pointNearSegment` probes), so a room and a face whose boundary probes come no
 * closer than this can never share interior area. Exported so a
 * coarse phase can prune only pairs PROVEN farther apart than the predicate's own
 * slack, instead of duplicating the number: one tolerance, one owner.
 */
export const ON_RING_TOLERANCE = 1e-9;
