import { validateClosedWallContacts } from '../topology/wall-first';
/**
 * `layout-circular-room.ts` — product planners for the canonical closed Wall.
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
import type { LayoutDocumentWallFirst, LayoutWall } from '../wall/types';
import type { LayoutVec2 } from '../geometry/coordinates';
import { createClosedWallCircleDocument, isClosedWall } from '../wall/closed-wall';
import { buildRoundRoomGeometryFromCertified, type CertifiedRoundRoom, certifyRoundRoom, findEnclosingRoundRoomForWall } from './round-room';
import { allocateCapturedId, layoutWorkingLevelIssue, LayoutIdCollisionError, type LayoutIdCapture } from '../plan/id-capture';
import { validateWallFirstLayoutDocument } from '../wall/codec';
import { compileWallFirstLayoutGeometry } from '../geometry/compiler';
import { hasBlockingLayoutIssues } from '../geometry/validation';
import { validateWallFirstOpeningSet, validateWallFirstOpeningSubset, wallFirstWallLength, type WallFirstWallIndex } from '../wall/opening-set';
import { extractBoundaryCandidateFaces } from '../geometry/face-extraction';
import { buildCorrespondenceComponents } from './reconciliation-correspondence'
import { createRoomBoundaryLookup, interiorWitness, roomBoundaryPolygon } from './reconciliation-boundary'
import { reconcileRooms } from './reconciliation'
import { type ComponentLineage } from './reconciliation-types';
import { createAuthoringRoomAllocator } from '../wall/topology-ops';
import type { LayoutSurfaceLineage } from '../plan/surface-reference';

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
				readonly surfaceLineage: LayoutSurfaceLineage;
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
 * Read the centre and radius of a canonical closed Wall from its enclosing
 * Round Room's authored `round` fact. Never fits or infers centre/radius from
 * Wall control points.
 */
export function readClosedWallCircle(
	document: LayoutDocumentWallFirst,
	wallId: string
): ClosedWallCircleFacts | null {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (wall === undefined || !isClosedWall(wall) || wall.centerline.kind !== 'cubic-chain') return null;
	const room = findEnclosingRoundRoomForWall(document, wallId);
	if (room === undefined || room.round === undefined) return null;
	const seam = document.junctions.find((junction) => junction.id === wall.startJunctionId)?.point;
	if (seam === undefined) return null;
	const { center, radius } = room.round;
	if (!(radius > 0) || !Number.isFinite(radius)) return null;
	return {
		center: [center[0], center[1]],
		radius,
		seam: [seam[0], seam[1]],
		angleRadians: Math.atan2(seam[1] - center[1], seam[0] - center[0])
	};
}

type Refused = Extract<CircularRoomPlan, { kind: 'rejected' }>;

function reject(code: CircularRoomRejectionCode, message: string): Refused {
	return { kind: 'rejected', rejection: { code, message } };
}

/**
 * The final codec/compile gates shared by creation and radius edits.
 *
 * A closed Wall is subject to the same canonical document and compile authority
 * as every other Wall; a radius that folds the chain or an Opening that no
 * longer fits refuses rather than installing a repaired candidate.
 */
function validateCandidate(document: LayoutDocumentWallFirst): CircularRoomPlan {
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
		createdRoomIds: [],
		surfaceLineage: []
	};
}

type CircularRoomCreateOptions = {
	readonly baseline: LayoutDocumentWallFirst;
	readonly center: LayoutVec2;
	readonly rim: LayoutVec2;
	readonly capture: LayoutIdCapture;
	readonly levelId: string;
	readonly thickness?: number;
	readonly height?: number;
	readonly roomNamePrefix?: string;
};

type CircularWallCandidate = {
	kind: 'proposed';
	candidate: LayoutDocumentWallFirst;
	wallId: string;
	junctionId: string;
	radius: number;
};

function circularWallCandidate(options: CircularRoomCreateOptions): CircularWallCandidate | Refused {
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
		if (created.radius <= created.wall.thickness / 2 + 1e-6) {
			return reject('invalid_radius', 'Radius must be finite and greater than half the Wall thickness.');
		}
		const contact = validateClosedWallContacts(candidate, new Set([wallId]));
		if (contact) return reject('closed_wall_isolated', contact.message);
		return { kind: 'proposed', candidate, wallId, junctionId, radius: created.radius };
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) return reject('captured_id_in_use', error.message);
		throw error;
	}
}

/** A live Circle attempt uses the same Wall builder and contact check as release. */
export function proposeCreateCircularWall(options: CircularRoomCreateOptions): CircularRoomPlan {
	const built = circularWallCandidate(options);
	if (built.kind === 'rejected') return built;
	return { kind: 'success', document: built.candidate, wallId: built.wallId, junctionId: built.junctionId, createdRoomIds: [], surfaceLineage: [] };
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
export function planCreateCircularRoom(options: CircularRoomCreateOptions): CircularRoomPlan {
	const { baseline, capture } = options;
	const built = circularWallCandidate(options);
	if (built.kind === 'rejected') return built;
	const { candidate, wallId, junctionId, radius } = built;
	try {
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
			// Creating a circle is non-removal: preserve an existing open Space.
			candidateRooms: candidate.rooms,
			allocator: createAuthoringRoomAllocator(capture, options.roomNamePrefix ?? 'Draft Room')
		});
		if ('rejection' in result) {
			return reject('invalid_candidate_document', result.rejection.message);
		}
		const withRound: LayoutDocumentWallFirst = {
			...result.document,
			rooms: result.document.rooms.map((room) =>
				room.boundary.length === 1 && room.boundary[0]!.wallId === wallId
					? {
							...room,
							round: {
								center: [options.center[0], options.center[1]],
								radius
							}
						}
					: room
			)
		};
		const gated = validateCandidate(withRound);
		if (gated.kind === 'rejected') return gated;
		return {
			kind: 'success',
			document: gated.document,
			wallId,
			junctionId,
			createdRoomIds: result.lineage
				.filter((record) => record.kind === 'created')
				.map((record) => record.roomId),
			surfaceLineage: []
		};
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return reject('captured_id_in_use', error.message);
		}
		throw error;
	}
}

type ClosedCircleEdit = {
	kind: 'prepared';
	document: LayoutDocumentWallFirst;
	wall: LayoutWall;
	roomId: string;
	certified: CertifiedRoundRoom;
	length: number | undefined;
	openingIndexes: readonly number[];
};

function prepareCircleEdit(document: LayoutDocumentWallFirst, wallId: string): ClosedCircleEdit | Refused {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Wall '${wallId}' does not exist`);
	if (!isClosedWall(wall) || wall.centerline.kind !== 'cubic-chain') {
		return reject('not_closed_wall', `Wall '${wallId}' is not a closed Wall`);
	}
	const room = findEnclosingRoundRoomForWall(document, wallId);
	if (!room) return reject('not_closed_wall', `Wall '${wallId}' has no enclosing Round Room`);
	const certification = certifyRoundRoom(document, room);
	if (certification.kind === 'invalid') return reject('invalid_candidate_document', certification.issue.message);
	return {
		kind: 'prepared',
		document,
		wall,
		roomId: room.id,
		certified: certification.certified,
		length: wallFirstWallLength(document, wallId),
		openingIndexes: document.openings.flatMap((opening, i) => opening.wallId === wallId ? [i] : [])
	};
}

/** Capture Round certification once, before the first live gesture move. */
export function prepareClosedCircleProposal(document: LayoutDocumentWallFirst, wallId: string) {
	const edit = prepareCircleEdit(document, wallId);
	if (edit.kind === 'rejected') return edit;
	return {
		kind: 'prepared' as const,
		resize: (radius: number) => resizeCircle(edit, radius),
		translate: (delta: LayoutVec2) => translateCircle(edit, delta)
	};
}

function circleProposal(document: LayoutDocumentWallFirst, wallId: string, junctionId: string): CircularRoomPlan {
	const contact = validateClosedWallContacts(document, new Set([wallId]));
	if (contact) return reject('closed_wall_isolated', contact.message);
	return { kind: 'success', document, wallId, junctionId, createdRoomIds: [], surfaceLineage: [] };
}

function finishCircleEdit(proposal: CircularRoomPlan): CircularRoomPlan {
	if (proposal.kind === 'rejected') return proposal;
	const gated = validateCandidate(proposal.document);
	if (gated.kind === 'rejected') return gated;
	return { ...proposal, document: gated.document };
}

/** Resize to the stated radius, preserving Opening angular stations and widths. */
export function planResizeClosedWallRadius(options: {
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly radius: number;
}): CircularRoomPlan {
	const edit = prepareCircleEdit(options.document, options.wallId);
	return edit.kind === 'rejected' ? edit : finishCircleEdit(resizeCircle(edit, options.radius));
}

function resizeCircle(edit: ClosedCircleEdit, radius: number): CircularRoomPlan {
	const { document, wall, roomId, certified, length: oldLength, openingIndexes } = edit;
	const wallId = wall.id;
	if (!Number.isFinite(radius) || radius <= wall.thickness / 2 + 1e-6) {
		return reject(
			'invalid_radius',
			'Radius must be finite and greater than half the Wall thickness.'
		);
	}
	const rebuilt = buildRoundRoomGeometryFromCertified({
		document,
		certified,
		center: certified.center,
		radius,
		seamDirection: certified.seamDirection
	});
	const nextCenterline = rebuilt.wallCenterlines.get(wallId);
	const newJunctionPoint = rebuilt.junctionPoints.get(wall.startJunctionId);
	if (!nextCenterline || !newJunctionPoint) {
		return reject('invalid_candidate_document', `Failed to rebuild closed Wall '${wallId}'`);
	}
	if (!(oldLength !== undefined && oldLength > 0)) {
		return reject('invalid_candidate_document', `Wall '${wallId}' has no resolvable length`);
	}
	const newLength = (oldLength / certified.radius) * radius;
	const scale = radius / certified.radius;
	const candidateWall: LayoutWall = {
		...wall,
		centerline: nextCenterline
	};
	const candidate: LayoutDocumentWallFirst = {
		...document,
		junctions: document.junctions.map((junction) =>
			junction.id === wall.startJunctionId ? { ...junction, point: newJunctionPoint } : junction
		),
		walls: document.walls.map((entry) => (entry.id === wallId ? candidateWall : entry)),
		rooms: document.rooms.map((entry) =>
			entry.id === roomId ? { ...entry, round: rebuilt.round } : entry
		),
		openings: document.openings.map((opening) => {
			if (opening.wallId !== wallId) return opening;
			// Authored offsets stay in `[0, circumference)`: wrap once after scaling,
			// never store the circumference itself as an alias of the seam.
			const offset = (opening.offset * scale) % newLength;
			return { ...opening, offset: offset < 0 ? offset + newLength : offset };
		})
	};
	const entries = openingIndexes.map((index) => ({ index, opening: candidate.openings[index]! }));
	for (const { opening } of entries) {
		if (opening.width >= newLength - 1e-6) {
			return reject(
				'opening_does_not_fit',
				`Opening '${opening.id}' is ${opening.width} m wide and no longer fits the resized closed Wall`
			);
		}
	}
	const openingIssues = validateWallFirstOpeningSubset(candidate, entries, {
		wallById: new Map([[wallId, candidateWall]]),
		pointById: new Map([[wall.startJunctionId, newJunctionPoint]])
	});
	if (openingIssues.length > 0) return reject('opening_does_not_fit', openingIssues[0]!.message);
	return circleProposal(candidate, wallId, wall.startJunctionId);
}

/**
 * A circular Wall's body drag is a rigid translation.
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
	const edit = prepareCircleEdit(options.document, options.wallId);
	return edit.kind === 'rejected' ? edit : finishCircleEdit(translateCircle(edit, options.delta));
}

function translateCircle(edit: ClosedCircleEdit, delta: LayoutVec2): CircularRoomPlan {
	const { document, wall, roomId, certified } = edit;
	const wallId = wall.id;
	if (!Number.isFinite(delta[0]) || !Number.isFinite(delta[1])) {
		return reject('invalid_delta', 'A closed Wall move needs a finite X/Z delta in meters.');
	}
	if (delta[0] === 0 && delta[1] === 0) {
		return reject('invalid_delta', 'A closed Wall move needs a non-zero delta.');
	}
	const newCenter: LayoutVec2 = [certified.center[0] + delta[0], certified.center[1] + delta[1]];
	const rebuilt = buildRoundRoomGeometryFromCertified({
		document,
		certified,
		center: newCenter,
		radius: certified.radius,
		seamDirection: certified.seamDirection
	});
	const nextCenterline = rebuilt.wallCenterlines.get(wallId);
	const nextSeam = rebuilt.junctionPoints.get(wall.startJunctionId);
	if (!nextCenterline || !nextSeam) {
		return reject('invalid_candidate_document', `Wall '${wallId}' has no resolvable seam Junction`);
	}
	const candidate: LayoutDocumentWallFirst = {
		...document,
		junctions: document.junctions.map((junction) =>
			junction.id === wall.startJunctionId ? { ...junction, point: nextSeam } : junction
		),
		walls: document.walls.map((entry) =>
			entry.id === wallId ? { ...entry, centerline: nextCenterline } : entry
		),
		rooms: document.rooms.map((entry) =>
			entry.id === roomId ? { ...entry, round: rebuilt.round } : entry
		)
	};
	return circleProposal(candidate, wallId, wall.startJunctionId);
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
