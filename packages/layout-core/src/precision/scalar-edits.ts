import { LAYOUT_DIMENSION_LIMIT_MESSAGE, exceedsLayoutDimension } from '../geometry/limits';
import { cowMoveJunctions, cowMoveRigidWall, cowSetWallScalar } from '../world/cow';
import { ensureLayoutWorldIndex } from '../world/lookups';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { RoundRoomMemberGuardHit } from '../room/round-room';
import { guardRoundRoomMemberGeometryEdit } from '../room/round-room';
import type { NodingIdAllocator, NodingPlan } from '../wall/noding';
import { planWallSplit } from '../wall/noding';
import { coincidesAsJunction } from '../wall/junction-identity';
import type { LayoutVec2 } from '../geometry/coordinates';
import type {
	FixedWallEndpoint,
	PrecisionPlan,
	WallAngleIntent,
	WallFirstArchitectureProposalIntent,
	WallLengthIntent,
	WallMoveIntent,
} from './types';
import { POINT_EPSILON } from '../vec2';
import { rejectCurvedWall } from './curve-edits';
import { currentJunctionPoint, incidentWallIds, wallEndpoints } from './document';
import { finalizeCandidate, finalizeWallGeometryCandidate } from './finalization';
import {
	finitePoint,
	finitePositive,
	reject,
	rejectRoundMember,
	validFixedEndpoint,
} from './rejections';

export function guardRoundRoomIntent(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent,
): RoundRoomMemberGuardHit | null {
	if (intent.kind === 'junction-move') {
		return guardRoundRoomMemberGeometryEdit(document, { junctionIds: [intent.junctionId] });
	}
	if (intent.kind === 'wall-move') {
		const wall = document.walls.find((entry) => entry.id === intent.wallId);
		const junctionIds = wall ? [wall.startJunctionId, wall.endJunctionId] : [];
		return guardRoundRoomMemberGeometryEdit(document, {
			wallIds: [intent.wallId],
			junctionIds,
		});
	}
	return guardRoundRoomMemberGeometryEdit(document, { wallIds: [intent.wallId] });
}

/** Move one canonical Junction exactly in document X/Z space. */
export function planExactJunctionMove(
	document: LayoutDocumentWallFirst,
	junctionId: string,
	point: LayoutVec2,
): PrecisionPlan {
	const worldIndex = ensureLayoutWorldIndex(document);
	const junction = worldIndex
		? worldIndex.junctionById.get(junctionId)
		: document.junctions.find((candidate) => candidate.id === junctionId);
	if (!junction)
		return reject('unknown_junction', `Unknown junction '${junctionId}'`, [junctionId]);
	const roundHit = guardRoundRoomMemberGeometryEdit(document, { junctionIds: [junctionId] });
	if (roundHit) return rejectRoundMember(roundHit);
	if (!finitePoint(point))
		return reject('invalid_value', 'Junction X/Z must be finite', [junctionId]);
	if (coincidesAsJunction(junction.point, point))
		return reject('no_op', `Junction '${junctionId}' is already at that point`, [junctionId]);

	const changedWallIds = worldIndex
		? (worldIndex.incidentWallIdsByJunctionId.get(junctionId) ?? [])
		: incidentWallIds(document, junctionId);
	const candidate = cowMoveJunctions(
		document,
		new Map([[junctionId, [point[0], point[1]] as LayoutVec2]]),
		changedWallIds,
		worldIndex,
	);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'junction-position',
		changedJunctionIds: [junctionId],
		changedWallIds,
	});
}

/**
 * Translate one canonical Wall rigidly in X/Z: both endpoint
 * Junctions receive the identical delta, so the Wall keeps its ID, role,
 * thickness, height, endpoint order, length and angle, and every hosted Opening
 * keeps its ID, host, offset, width and vertical/profile fields.
 *
 * Walls incident to either moved endpoint reshape because their shared Junction
 * IDs moved; the operation never detaches a shared endpoint. A candidate that
 * breaks a neighbour, an Opening, Room identity, a portal relation or the
 * compiler rejects atomically.
 */
export function planRigidWallMove(
	document: LayoutDocumentWallFirst,
	wallOrIntent: string | WallMoveIntent,
	deltaArgument?: LayoutVec2,
): PrecisionPlan {
	const intent: WallMoveIntent =
		typeof wallOrIntent === 'string'
			? { wallId: wallOrIntent, delta: (deltaArgument ?? [0, 0]) as LayoutVec2 }
			: { wallId: wallOrIntent.wallId, delta: wallOrIntent.delta };
	const worldIndex = ensureLayoutWorldIndex(document);
	const wall = worldIndex
		? worldIndex.wallById.get(intent.wallId)
		: document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${intent.wallId}'`, [intent.wallId]);
	const roundHit = guardRoundRoomMemberGeometryEdit(document, {
		wallIds: [wall.id],
		junctionIds: [wall.startJunctionId, wall.endJunctionId],
	});
	if (roundHit) return rejectRoundMember(roundHit);
	if (!finitePoint(intent.delta))
		return reject('invalid_value', 'Wall move delta must be finite X/Z', [wall.id]);
	if (intent.delta[0] === 0 && intent.delta[1] === 0)
		return reject('no_op', `Wall '${wall.id}' already has that position`, [wall.id]);

	const endpoints = wallEndpoints(document, wall, worldIndex?.pointById);
	if (!endpoints)
		return reject('unsupported_geometry', `Wall '${wall.id}' has unresolved junction geometry`, [
			wall.id,
		]);
	if (!(endpoints.length > POINT_EPSILON))
		return reject('unsupported_geometry', `Wall '${wall.id}' has zero effective length`, [wall.id]);

	// Canonical endpoint order, de-duplicated: a degenerate self-loop Wall
	// carries one Junction, not two.
	const changedJunctionIds = [...new Set([wall.startJunctionId, wall.endJunctionId])];
	const changedWallIds = worldIndex
		? [
				...new Set(
					changedJunctionIds.flatMap(
						(jId) => worldIndex.incidentWallIdsByJunctionId.get(jId) ?? [],
					),
				),
			].sort(
				(a, b) => (worldIndex.wallIndexById.get(a) ?? 0) - (worldIndex.wallIndexById.get(b) ?? 0),
			)
		: document.walls
				.filter((candidate) =>
					changedJunctionIds.some(
						(junctionId) =>
							candidate.startJunctionId === junctionId || candidate.endJunctionId === junctionId,
					),
				)
				.map((candidate) => candidate.id);
	const candidate = cowMoveRigidWall(
		document,
		wall.id,
		intent.delta,
		changedJunctionIds,
		changedWallIds,
		worldIndex,
	);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'wall-move',
		changedJunctionIds,
		changedWallIds,
	});
}

/** Set a straight Wall's exact physical length while keeping one endpoint fixed. */
export function planExactWallLength(
	document: LayoutDocumentWallFirst,
	wallOrIntent: string | WallLengthIntent,
	lengthArgument?: number,
	fixedArgument: FixedWallEndpoint = 'start',
): PrecisionPlan {
	const intent =
		typeof wallOrIntent === 'string'
			? { wallId: wallOrIntent, length: lengthArgument, fixed: fixedArgument }
			: {
					wallId: wallOrIntent.wallId,
					length: wallOrIntent.length,
					fixed: wallOrIntent.fixedEndpoint ?? wallOrIntent.fixed ?? 'start',
				};
	const worldIndex = ensureLayoutWorldIndex(document);
	const wall = worldIndex
		? worldIndex.wallById.get(intent.wallId)
		: document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${intent.wallId}'`, [intent.wallId]);
	if (!validFixedEndpoint(intent.fixed))
		return reject('invalid_endpoint', "Fixed endpoint must be 'start' or 'end'", [wall.id]);
	const angleRoundHit = guardRoundRoomMemberGeometryEdit(document, {
		wallIds: [wall.id],
		junctionIds: [intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId],
	});
	if (angleRoundHit) return rejectRoundMember(angleRoundHit);
	const lengthRoundHit = guardRoundRoomMemberGeometryEdit(document, {
		wallIds: [wall.id],
		junctionIds: [intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId],
	});
	if (lengthRoundHit) return rejectRoundMember(lengthRoundHit);
	// An exact *length* is a chord solve: the endpoint moves along the
	// endpoint direction and the curve would have to be re-solved to keep its
	// shape. Curves use the canonical anchor planners instead.
	if (wall.centerline.kind !== 'line') return rejectCurvedWall('exact length', wall.id);
	if (!finitePositive(intent.length))
		return reject('invalid_value', 'Wall length must be finite and greater than zero', [wall.id]);

	const endpoints = wallEndpoints(document, wall, worldIndex?.pointById);
	if (!endpoints)
		return reject('unsupported_geometry', `Wall '${wall.id}' has unresolved junction geometry`, [
			wall.id,
		]);
	if (!(endpoints.length > POINT_EPSILON))
		return reject('unsupported_geometry', `Wall '${wall.id}' has zero effective length`, [wall.id]);
	if (intent.length === endpoints.length)
		return reject('no_op', `Wall '${wall.id}' already has that length`, [wall.id]);

	const direction: LayoutVec2 = [
		(endpoints.end[0] - endpoints.start[0]) / endpoints.length,
		(endpoints.end[1] - endpoints.start[1]) / endpoints.length,
	];
	const movedJunctionId = intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId;
	const fixedPoint = intent.fixed === 'start' ? endpoints.start : endpoints.end;
	const movedPoint: LayoutVec2 =
		intent.fixed === 'start'
			? [fixedPoint[0] + direction[0] * intent.length, fixedPoint[1] + direction[1] * intent.length]
			: [
					fixedPoint[0] - direction[0] * intent.length,
					fixedPoint[1] - direction[1] * intent.length,
				];
	const existingMovedPoint =
		worldIndex?.pointById.get(movedJunctionId) ?? currentJunctionPoint(document, movedJunctionId);
	if (coincidesAsJunction(existingMovedPoint, movedPoint))
		return reject('no_op', `Wall '${wall.id}' already has that length`, [wall.id]);

	const changedWallIds = worldIndex
		? (worldIndex.incidentWallIdsByJunctionId.get(movedJunctionId) ?? [])
		: incidentWallIds(document, movedJunctionId);
	const candidate = cowMoveJunctions(
		document,
		new Map([[movedJunctionId, movedPoint]]),
		changedWallIds,
		worldIndex,
	);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'wall-length',
		changedJunctionIds: [movedJunctionId],
		changedWallIds,
	});
}

/** Set a supported straight Wall's exact X/Z angle in radians. */
export function planExactWallAngle(
	document: LayoutDocumentWallFirst,
	wallOrIntent: string | WallAngleIntent,
	angleArgument?: number,
	fixedArgument: FixedWallEndpoint = 'start',
): PrecisionPlan {
	const intent =
		typeof wallOrIntent === 'string'
			? { wallId: wallOrIntent, angle: angleArgument, fixed: fixedArgument }
			: {
					wallId: wallOrIntent.wallId,
					angle: wallOrIntent.angle,
					fixed: wallOrIntent.fixedEndpoint ?? wallOrIntent.fixed ?? 'start',
				};
	const worldIndex = ensureLayoutWorldIndex(document);
	const wall = worldIndex
		? worldIndex.wallById.get(intent.wallId)
		: document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${intent.wallId}'`, [intent.wallId]);
	if (!validFixedEndpoint(intent.fixed))
		return reject('invalid_endpoint', "Fixed endpoint must be 'start' or 'end'", [wall.id]);
	const angleRoundHit = guardRoundRoomMemberGeometryEdit(document, {
		wallIds: [wall.id],
		junctionIds: [intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId],
	});
	if (angleRoundHit) return rejectRoundMember(angleRoundHit);
	const lengthRoundHit = guardRoundRoomMemberGeometryEdit(document, {
		wallIds: [wall.id],
		junctionIds: [intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId],
	});
	if (lengthRoundHit) return rejectRoundMember(lengthRoundHit);
	// An exact *angle* is the endpoint-chord direction of a straight
	// Wall; a curve has no single angle to set.
	if (wall.centerline.kind !== 'line') return rejectCurvedWall('exact angle', wall.id);
	const angle = intent.angle;
	if (typeof angle !== 'number' || !Number.isFinite(angle))
		return reject('invalid_value', 'Wall angle must be finite radians', [wall.id]);

	const endpoints = wallEndpoints(document, wall, worldIndex?.pointById);
	if (!endpoints)
		return reject('unsupported_geometry', `Wall '${wall.id}' has unresolved junction geometry`, [
			wall.id,
		]);
	if (!(endpoints.length > POINT_EPSILON))
		return reject('unsupported_geometry', `Wall '${wall.id}' has zero effective length`, [wall.id]);
	const direction: LayoutVec2 = [Math.cos(angle), Math.sin(angle)];
	const fixedPoint = intent.fixed === 'start' ? endpoints.start : endpoints.end;
	const movedJunctionId = intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId;
	const movedPoint: LayoutVec2 =
		intent.fixed === 'start'
			? [
					fixedPoint[0] + direction[0] * endpoints.length,
					fixedPoint[1] + direction[1] * endpoints.length,
				]
			: [
					fixedPoint[0] - direction[0] * endpoints.length,
					fixedPoint[1] - direction[1] * endpoints.length,
				];
	const existingMovedPoint =
		worldIndex?.pointById.get(movedJunctionId) ?? currentJunctionPoint(document, movedJunctionId);
	if (coincidesAsJunction(existingMovedPoint, movedPoint))
		return reject('no_op', `Wall '${wall.id}' already has that angle`, [wall.id]);

	const changedWallIds = worldIndex
		? (worldIndex.incidentWallIdsByJunctionId.get(movedJunctionId) ?? [])
		: incidentWallIds(document, movedJunctionId);
	const candidate = cowMoveJunctions(
		document,
		new Map([[movedJunctionId, movedPoint]]),
		changedWallIds,
		worldIndex,
	);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'wall-angle',
		changedJunctionIds: [movedJunctionId],
		changedWallIds,
	});
}

/** Set a Wall-owned physical thickness, preserving Wall and Opening identity. */
export function planExactWallThickness(
	document: LayoutDocumentWallFirst,
	wallId: string,
	thickness: number,
): PrecisionPlan {
	const worldIndex = ensureLayoutWorldIndex(document);
	const wall = worldIndex
		? worldIndex.wallById.get(wallId)
		: document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	if (!finitePositive(thickness))
		return reject('invalid_value', 'Wall thickness must be finite and greater than zero', [wallId]);
	if (exceedsLayoutDimension(thickness))
		return reject('dimension_out_of_range', LAYOUT_DIMENSION_LIMIT_MESSAGE, [wallId]);
	if (wall.thickness === thickness)
		return reject('no_op', `Wall '${wallId}' already has that thickness`, [wallId]);

	const candidate = cowSetWallScalar(document, wallId, { thickness }, worldIndex);
	return finalizeCandidate(candidate, 'wall-thickness', [], [wallId]);
}

/**
 * Set a Wall's authoritative physical height,
 * preserving Wall, Junction, Opening and Room identity.
 *
 * Height is independent of X/Z topology: the Wall stays the same authored Wall
 * with the same `role` and the same Room participation; only its vertical extent
 * changes (`topY = floor.elevation + height`). The shared 1,000 m geometry
 * envelope applies; there is no Floor-relative or storey-height cap, so a Wall
 * may be shorter or taller than its neighbours within that envelope. A Wall
 * shortened below a hosted Opening's top still rejects atomically with the Opening
 * untouched (the canonical Opening validator owns that rule), and nothing is ever
 * clamped.
 */
export function planExactWallHeight(
	document: LayoutDocumentWallFirst,
	wallId: string,
	height: number,
): PrecisionPlan {
	const worldIndex = ensureLayoutWorldIndex(document);
	const wall = worldIndex
		? worldIndex.wallById.get(wallId)
		: document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	if (!finitePositive(height))
		return reject('invalid_value', 'Wall height must be finite and greater than zero', [wallId]);
	if (exceedsLayoutDimension(height))
		return reject('dimension_out_of_range', LAYOUT_DIMENSION_LIMIT_MESSAGE, [wallId]);
	if (wall.height === height)
		return reject('no_op', `Wall '${wallId}' already has that height`, [wallId]);

	const candidate = cowSetWallScalar(document, wallId, { height }, worldIndex);
	return finalizeCandidate(candidate, 'wall-height', [], [wallId]);
}

/**
 * Add one explicit Vertex by subdividing a Wall at a physical meter offset.
 * The existing noder owns deterministic IDs, opening rebasing, and
 * forward/reverse Room-boundary rewrites; this planner adds the final
 * candidate gates around that result.
 */
export function planWallSubdivision(
	document: LayoutDocumentWallFirst,
	wallId: string,
	splitDistance: number,
	allocator: NodingIdAllocator,
): PrecisionPlan {
	// Curved Walls split exactly through the same noder: the split
	// measures the canonical arc, resolves once, and hands both fragments their
	// own partition of the chain, so no flatten can happen here.
	// Split moves no geometry, so it keeps every Room's derived ceiling.
	const planned: NodingPlan = planWallSplit(document, wallId, splitDistance, allocator, {
		keepRoomCeilings: true,
	});
	if (planned.kind === 'rejected') {
		const { roomId } = planned.rejection;
		return reject(
			planned.rejection.code,
			planned.rejection.message,
			roomId !== undefined ? [wallId, roomId] : [wallId],
		);
	}
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate: planned.document,
		operation: 'wall-subdivision',
		changedJunctionIds: [planned.junctionId],
		changedWallIds: planned.splitWallIds,
		createdWallIds: planned.createdWallIds,
	});
}

/** Naming alias for callers that describe the operation as Add Vertex. */
export const planAddWallVertex = planWallSubdivision;
