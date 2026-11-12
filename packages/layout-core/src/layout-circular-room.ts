import { validateClosedWallContacts } from './layout-wall-first-precision';
/**
 * `layout-circular-room.ts` — C2 product planners for the canonical closed Wall.
 *
 * Creation is deliberately two ordinary facts composed here, never a parallel
 * circle object: one closed Wall built by `buildClosedWallCircleCenterline`, and
 * the ordinary Room reconciliation every enclosed ring already runs. The
 * authored centre → rim gesture therefore yields exactly one Wall and one Room,
 * and the rim point is the canonical seam.
 *
 * Radius edits use the same construction with a new radius. The seam angle is
 * retained, so an Opening's angular station is `offset / circumference` and is
 * preserved by scaling its offset with the radius. Opening widths are physical
 * metres and stay unchanged (D3b); a result whose widths no longer fit is
 * refused, never clamped.
 */
import type { LayoutDocumentWallFirst, LayoutWall } from './layout-wall-first-types';
import type { LayoutVec2 } from './layout-coordinates';
import { translateWallCenterline } from './layout-wall-centerline';
import {
	buildClosedWallCircleCenterline,
	createClosedWallCircleDocument,
	isClosedWall
} from './layout-closed-wall';
import {
	allocateCapturedId,
	layoutWorkingLevelIssue,
	LayoutIdCollisionError,
	type LayoutIdCapture
} from './layout-id-capture';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import { compileWallFirstLayoutGeometry } from './layout-geometry';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import {
	validateWallFirstOpeningSet,
	wallFirstWallLength,
	type WallFirstWallIndex
} from './layout-opening-set';
import { extractBoundaryCandidateFaces } from './layout-face-extraction';
import {
	buildCorrespondenceComponents,
	createRoomBoundaryLookup,
	interiorWitness,
	reconcileRooms,
	roomBoundaryPolygon,
	type ComponentLineage
} from './layout-room-reconciliation';
import { createAuthoringRoomAllocator } from './layout-wall-topology-ops';

/** Why a circular-Wall product edit refused; stable machine codes. */
export type CircularRoomRejectionCode =
	| 'closed_wall_isolated'
	| 'unknown_wall'
	| 'not_closed_wall'
	| 'invalid_radius'
	| 'invalid_delta'
	| 'opening_does_not_fit'
	| 'invalid_candidate_document'
	| 'candidate_does_not_compile'
	| 'captured_id_in_use';

export type CircularRoomRejection = {
	readonly code: CircularRoomRejectionCode;
	readonly message: string;
};

export type CircularRoomPlan =
	| {
			readonly kind: 'success';
			readonly document: LayoutDocumentWallFirst;
			readonly wallId: string;
			readonly junctionId: string;
			readonly createdRoomIds: readonly string[];
	  }
	| { readonly kind: 'rejected'; readonly rejection: CircularRoomRejection };

/** The geometric facts a canonical closed Wall stores, read back without a second shape kind. */
export type ClosedWallCircleFacts = {
	readonly center: LayoutVec2;
	readonly radius: number;
	readonly seam: LayoutVec2;
	readonly angleRadians: number;
};

/**
 * Read the centre and radius of a canonical closed Wall.
 *
 * The 16 boundary points are equally spaced by construction, so their mean is
 * the centre and every point is the same radius from it. This deliberately
 * reads the persisted cubic chain rather than any remembered gesture state.
 */
export function readClosedWallCircle(
	document: LayoutDocumentWallFirst,
	wallId: string
): ClosedWallCircleFacts | null {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (wall === undefined || !isClosedWall(wall) || wall.centerline.kind !== 'cubic-chain') return null;
	const seam = document.junctions.find((junction) => junction.id === wall.startJunctionId)?.point;
	if (seam === undefined) return null;
	const points: LayoutVec2[] = [seam, ...wall.centerline.knots.map((knot) => knot.point)];
	const center: LayoutVec2 = [
		points.reduce((sum, point) => sum + point[0], 0) / points.length,
		points.reduce((sum, point) => sum + point[1], 0) / points.length
	];
	const radius =
		points.reduce((sum, point) => sum + Math.hypot(point[0] - center[0], point[1] - center[1]), 0) /
		points.length;
	if (!(radius > 0) || !Number.isFinite(radius)) return null;
	return {
		center,
		radius,
		seam: [seam[0], seam[1]],
		angleRadians: Math.atan2(seam[1] - center[1], seam[0] - center[0])
	};
}

function reject(code: CircularRoomRejectionCode, message: string): CircularRoomPlan {
	return { kind: 'rejected', rejection: { code, message } };
}

/**
 * The final codec/compile gates shared by creation and radius edits.
 *
 * A closed Wall is subject to the same canonical document and compile authority
 * as every other Wall; a radius that folds the chain or an Opening that no
 * longer fits refuses rather than installing a repaired candidate.
 */
function validateCandidate(document: LayoutDocumentWallFirst, wallId: string): CircularRoomPlan {
	const contact = validateClosedWallContacts(document, new Set([wallId]));
	if (contact) return reject('closed_wall_isolated', contact.message);
	const validated = validateWallFirstLayoutDocument(document);
	if (!validated.success) {
		return reject(
			'invalid_candidate_document',
			`Circular Wall failed canonical validation: ${validated.issues[0]?.message ?? 'unknown issue'}`
		);
	}
	const openingIssues = validateWallFirstOpeningSet(validated.document);
	if (openingIssues.length > 0) {
		return reject(
			'opening_does_not_fit',
			openingIssues[0]!.message
		);
	}
	const compiled = compileWallFirstLayoutGeometry(validated.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject(
			'candidate_does_not_compile',
			`Circular Wall does not compile: ${compiled.issues[0]?.message ?? 'unknown geometry issue'}`
		);
	}
	return {
		kind: 'success',
		document: validated.document,
		wallId: '',
		junctionId: '',
		createdRoomIds: []
	};
}

/**
 * Create one closed Wall from a centre → rim gesture and birth its enclosed
 * Room through the existing P23.8 reconciliation.
 *
 * The candidate contains the existing document plus the new isolated Wall, so
 * every pre-existing Room participates in the same correspondence pass. An
 * isolated closed Wall changes no existing face; the new face has no
 * predecessor and therefore becomes exactly one born Room.
 */
export function planCreateCircularRoom(options: {
	readonly baseline: LayoutDocumentWallFirst;
	readonly center: LayoutVec2;
	readonly rim: LayoutVec2;
	readonly capture: LayoutIdCapture;
	readonly levelId: string;
	readonly thickness?: number;
	readonly height?: number;
	readonly roomNamePrefix?: string;
}): CircularRoomPlan {
	const { baseline, capture } = options;
	const levelIssue = layoutWorkingLevelIssue(baseline, options.levelId);
	if (levelIssue !== null) return reject('invalid_candidate_document', levelIssue);

	const taken = new Set([
		...baseline.walls.map((wall) => wall.id),
		...baseline.junctions.map((junction) => junction.id)
	]);
	try {
		const wallId = allocateCapturedId(taken, 'circle-wall', capture);
		taken.add(wallId);
		const junctionId = allocateCapturedId(taken, 'circle-junction', capture);
		const created = createClosedWallCircleDocument({
			center: options.center,
			rim: options.rim,
			junctionId,
			wallId,
			thickness: options.thickness ?? 0.2,
			height: options.height ?? 3
		});
		if (created.kind === 'rejected') {
			return reject(
				created.rejection.code === 'degenerate_radius' ? 'invalid_radius' : 'invalid_candidate_document',
				created.rejection.message
			);
		}

		const candidate: LayoutDocumentWallFirst = {
			...baseline,
			junctions: [...baseline.junctions, ...created.document.junctions],
			walls: [...baseline.walls, ...created.document.walls],
			openings: [...baseline.openings]
		};
		const extraction = extractBoundaryCandidateFaces(candidate);
		if (extraction.faces.length === 0) {
			return reject('invalid_candidate_document', 'The closed Wall encloses no candidate face');
		}
		const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
		const predecessorWitnesses = new Map<string, LayoutVec2>();
		const boundaryLookup = createRoomBoundaryLookup(baseline);
		for (const room of baseline.rooms) {
			const polygon = roomBoundaryPolygon(baseline, room.id, boundaryLookup);
			if (!polygon) {
				return reject(
					'invalid_candidate_document',
					`Predecessor Room '${room.id}' has an unresolvable boundary`
				);
			}
			predecessorPolygons.set(room.id, polygon);
			predecessorWitnesses.set(room.id, interiorWitness(polygon));
		}
		const components: ComponentLineage[] = buildCorrespondenceComponents({
			faces: extraction.faces,
			predecessorRoomIds: baseline.rooms.map((room) => room.id),
			predecessorWitnesses,
			predecessorPolygons,
			candidateDocument: candidate,
			baselineRooms: baseline.rooms
		});
		const result = reconcileRooms({
			baseline,
			candidateDocument: candidate,
			extraction,
			components,
			predecessorWitnesses,
			predecessorPolygons,
			allocator: createAuthoringRoomAllocator(capture, options.roomNamePrefix ?? 'Draft Room')
		});
		if ('rejection' in result) {
			return reject('invalid_candidate_document', result.rejection.message);
		}
		const gated = validateCandidate(result.document, wallId);
		if (gated.kind === 'rejected') return gated;
		return {
			kind: 'success',
			document: gated.document,
			wallId,
			junctionId,
			createdRoomIds: result.lineage
				.filter((record) => record.kind === 'created')
				.map((record) => record.roomId)
		};
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return reject('captured_id_in_use', error.message);
		}
		throw error;
	}
}

/**
 * Resize one closed Wall to an exact radius.
 *
 * D3b semantics: the authored seam angle is retained, every hosted Opening's
 * angular station is retained (`offset` scales with the circumference), and its
 * physical width is unchanged. An Opening whose width no longer fits, or whose
 * scaled interval would overlap a sibling, refuses the whole edit.
 */
export function planResizeClosedWallRadius(options: {
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly radius: number;
}): CircularRoomPlan {
	const { document, wallId, radius } = options;
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (wall === undefined) return reject('unknown_wall', `Wall '${wallId}' does not exist`);
	if (!isClosedWall(wall) || wall.centerline.kind !== 'cubic-chain') {
		return reject('not_closed_wall', `Wall '${wallId}' is not a closed Wall`);
	}
	const facts = readClosedWallCircle(document, wallId);
	if (facts === null) {
		return reject('not_closed_wall', `Wall '${wallId}' has no resolvable circular centre`);
	}
	if (!Number.isFinite(radius) || radius <= wall.thickness / 2 + 1e-6) {
		return reject(
			'invalid_radius',
			'Radius must be finite and greater than half the Wall thickness.'
		);
	}
	const direction: LayoutVec2 = [
		(facts.seam[0] - facts.center[0]) / facts.radius,
		(facts.seam[1] - facts.center[1]) / facts.radius
	];
	const construction = buildClosedWallCircleCenterline({
		center: facts.center,
		rim: [facts.center[0] + direction[0] * radius, facts.center[1] + direction[1] * radius],
		wallId
	});
	if (construction.kind === 'rejected') {
		return reject('invalid_radius', construction.rejection.message);
	}
	const oldLength = wallFirstWallLength(document, wallId);
	if (!(oldLength !== undefined && oldLength > 0)) {
		return reject('invalid_candidate_document', `Wall '${wallId}' has no resolvable length`);
	}
	const newLength = (oldLength / facts.radius) * radius;
	const scale = radius / facts.radius;
	const newJunctionPoint: LayoutVec2 = [construction.seam[0], construction.seam[1]];
	const candidateWall: LayoutWall = {
		...wall,
		centerline: construction.centerline
	};
	const candidate: LayoutDocumentWallFirst = {
		...document,
		junctions: document.junctions.map((junction) =>
			junction.id === wall.startJunctionId ? { ...junction, point: newJunctionPoint } : junction
		),
		walls: document.walls.map((entry) => (entry.id === wallId ? candidateWall : entry)),
		openings: document.openings.map((opening) => {
			if (opening.wallId !== wallId) return opening;
			// Authored offsets stay in `[0, circumference)`: wrap once after scaling,
			// never store the circumference itself as an alias of the seam.
			const offset = (opening.offset * scale) % newLength;
			return { ...opening, offset: offset < 0 ? offset + newLength : offset };
		})
	};
	for (const opening of candidate.openings) {
		if (opening.wallId !== wallId) continue;
		if (opening.width >= newLength - 1e-6) {
			return reject(
				'opening_does_not_fit',
				`Opening '${opening.id}' is ${opening.width} m wide and no longer fits the resized closed Wall`
			);
		}
	}
	const openingIssues = validateWallFirstOpeningSet(candidate);
	if (openingIssues.length > 0) {
		return reject('opening_does_not_fit', openingIssues[0]!.message);
	}
	const gated = validateCandidate(candidate, wallId);
	if (gated.kind === 'rejected') return gated;
	return { ...gated, wallId, junctionId: wall.startJunctionId, createdRoomIds: [] };
}

/**
 * D8 — a circular Wall's body drag is a rigid translation.
 *
 * A closed Wall has one Junction identity, so the straight-Wall chord solve is
 * meaningless (its chord is zero). This planner moves that one Junction and the
 * persisted 16-span chain by the same delta: the seam, radius, knot IDs,
 * Opening offsets/widths and the enclosed Room all stay exactly as they were.
 * A zero or non-finite drag refuses instead of writing a no-op document.
 */
export function planTranslateClosedWall(options: {
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly delta: LayoutVec2;
}): CircularRoomPlan {
	const { document, wallId, delta } = options;
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (wall === undefined) return reject('unknown_wall', `Wall '${wallId}' does not exist`);
	if (!isClosedWall(wall) || wall.centerline.kind !== 'cubic-chain') {
		return reject('not_closed_wall', `Wall '${wallId}' is not a closed Wall`);
	}
	if (!Number.isFinite(delta[0]) || !Number.isFinite(delta[1])) {
		return reject('invalid_delta', 'A closed Wall move needs a finite X/Z delta in meters.');
	}
	if (delta[0] === 0 && delta[1] === 0) {
		return reject('invalid_delta', 'A closed Wall move needs a non-zero delta.');
	}
	const seam = document.junctions.find((junction) => junction.id === wall.startJunctionId);
	if (seam === undefined) {
		return reject('invalid_candidate_document', `Wall '${wallId}' has no resolvable seam Junction`);
	}
	const candidate: LayoutDocumentWallFirst = {
		...document,
		junctions: document.junctions.map((junction) =>
			junction.id === wall.startJunctionId
				? { ...junction, point: [junction.point[0] + delta[0], junction.point[1] + delta[1]] }
				: junction
		),
		walls: document.walls.map((entry) =>
			entry.id === wallId
				? { ...entry, centerline: translateWallCenterline(entry.centerline, delta) }
				: entry
		)
	};
	const gated = validateCandidate(candidate, wallId);
	if (gated.kind === 'rejected') return gated;
	return { ...gated, wallId, junctionId: wall.startJunctionId, createdRoomIds: [] };
}

/** The current radius of one closed Wall, for Card facts and gesture previews. */
export function closedWallRadius(
	document: LayoutDocumentWallFirst,
	wallId: string
): number | null {
	return readClosedWallCircle(document, wallId)?.radius ?? null;
}

/** The indexed length helper, re-exported for callers that already hold wall indexes. */
export function closedWallLength(
	document: LayoutDocumentWallFirst,
	wallId: string,
	index?: WallFirstWallIndex
): number | undefined {
	return wallFirstWallLength(document, wallId, index);
}
