/**
 * P23.1 precise semantic operations for the wall-first Layout document.
 *
 * These planners are deliberately small and operation-specific. They build a
 * complete candidate from an immutable document, run the wall-first codec,
 * topology/opening checks, and the shared geometry compiler, then return one
 * result for the editor transaction runner to commit. There is no persistent
 * constraint solver and no snap state involved in an exact operation.
 *
 * P23.10 extends this module with `planRigidWallMove` and moves every
 * canonical Junction-coordinate operation (Junction position, Wall length,
 * Wall angle, rigid Wall move, exact rectangle dimensions and Wall
 * subdivision) onto `finalizeWallGeometryCandidate`, which adds explicit 1→1
 * Room reconciliation and the portal/Opening gates. Metadata and object
 * operations keep the generic `finalizeCandidate` path.
 *
 * Angles use the document's X/Z convention: `atan2(z, x)` in radians. A wall
 * keeps its canonical start → end direction for length and angle edits; the
 * selected fixed endpoint is never silently swapped.
 */
import type { LayoutDocumentIssue } from './layout-codec';
import { canonicalBoundaryCycleKey, extractBoundaryCandidateFaces } from './layout-face-extraction';
import { compileWallFirstLayoutGeometry } from './layout-geometry';
import { LAYOUT_GEOMETRY_EPSILON } from './layout-geometry-openings';
import type { LayoutGeometryIssue } from './layout-geometry-types';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import { validateWallFirstOpeningSet } from './layout-opening-set';
import { validateWallFirstPortalRelations } from './layout-portals';
import {
	reconcileRooms,
	type ComponentLineage,
	type ReconciliationFailure,
	type ReconciliationResult,
	type RoomIdAllocator
} from './layout-room-reconciliation';
import type { LayoutDocumentWallFirst, LayoutJunction, LayoutWall } from './layout-wall-first-types';
import {
	planWallSplit,
	type NodingIdAllocator,
	type NodingPlan
} from './layout-wall-noding';
import { coincidesAsJunction } from './layout-junction-identity';
import { classifyWallIntersection, type TopologySegment } from './layout-wall-topology';
import type { LayoutObject, LayoutVec2 } from './layout-types';
import type { Vec3 } from './types';

const POINT_EPSILON = LAYOUT_GEOMETRY_EPSILON;

export type FixedWallEndpoint = 'start' | 'end';

export type WallLengthIntent = {
	wallId: string;
	length: number;
	fixed?: FixedWallEndpoint;
	fixedEndpoint?: FixedWallEndpoint;
};

export type WallAngleIntent = {
	wallId: string;
	angle: number;
	fixed?: FixedWallEndpoint;
	fixedEndpoint?: FixedWallEndpoint;
};

/**
 * P23.10 — one rigid straight-Wall translation: both endpoint Junctions
 * receive the identical X/Z delta. Endpoint order, role, thickness, height,
 * length and angle are all preserved.
 */
export type WallMoveIntent = {
	wallId: string;
	delta: LayoutVec2;
};

export type RectangleResizeOptions = {
	/** Explicit anchor reference. Omission uses the smallest stable corner ID. */
	anchorJunctionId?: string;
	/** Explicit width edge reference. Omission uses the smallest stable edge ID. */
	widthWallId?: string;
};

export type ResolvedRectangle = {
	anchorJunctionId: string;
	widthEndpointId: string;
	depthEndpointId: string;
	corners: LayoutJunction[];
	roomWallIds: string[];
	widthWallId: string;
	depthWallId: string;
};

export type RectangleResolution = ResolvedRectangle | { rejection: PrecisionRejection };

export type LayoutObjectTransformPatch = Partial<
	Pick<LayoutObject, 'position' | 'rotation' | 'dimensions' | 'roomId'>
>;

export type PrecisionOperation =
	| 'junction-position'
	| 'wall-length'
	| 'wall-angle'
	/** P23.10 — rigid straight-Wall translation (planner: `planRigidWallMove`). */
	| 'wall-move'
	| 'wall-thickness'
	| 'wall-height'
	| 'wall-role'
	/** P23.6c — canonical Wall deletion (planner: `planDeleteWall`). */
	| 'wall-delete'
	/** P23.6d — canonical Room metadata update (planner: `planRoomMetadataUpdate`). */
	| 'room-metadata'
	/** P23.6d — Room removal through the Wall pipeline (planner: `planRemoveRoom`). */
	| 'room-remove'
	| 'wall-subdivision'
	| 'rectangle-dimensions'
	| 'layout-object-transform'
	| 'layout-object-delete'
	| 'layout-object-preset-create';

export type PrecisionRejection = {
	code:
		| 'unknown_junction'
		| 'unknown_wall'
		| 'unknown_room'
		| 'unknown_object'
		| 'invalid_value'
		| 'invalid_endpoint'
		| 'invalid_reference'
		| 'unsupported_geometry'
		| 'shared_boundary_resize_ambiguous'
		| 'topology_invalid'
		/**
		 * P23.10 — the geometry edit could not map every baseline Room to exactly
		 * one candidate face through explicit boundary-cycle lineage. Direct
		 * coordinate edits and subdivision never authorize Room birth, retirement,
		 * split or merge.
		 */
		| 'room_identity_lost'
		/** P23.10 — the candidate failed the canonical whole-document Opening set. */
		| 'opening_set_invalid'
		/** P23.10 — the candidate failed the canonical portal-relation (adjacency) gate. */
		| 'portal_relation_invalid'
		/**
		 * P23.6H — the edit would cap a Wall below the top of a hosted Opening. The
		 * canonical Opening validator owns the rule; this code only names the
		 * rejection so the message stays actionable.
		 */
		| 'wall_height_below_opening'
		| 'geometry_invalid'
		| 'no_op'
		| 'split_at_existing_endpoint'
		| 'split_distance_out_of_range'
		| 'split_through_opening_interior'
		| 'junction_point_mismatch';
	message: string;
	targetIds?: readonly string[];
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[];
};

export type PrecisionPlan =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			operation: PrecisionOperation;
			changedJunctionIds: readonly string[];
			changedWallIds: readonly string[];
			changedObjectIds?: readonly string[];
			/** P23.5 — the object a preset create birthed (its stored ID). */
			createdObjectId?: string;
		}
	| {
			kind: 'rejected';
			rejection: PrecisionRejection;
		};

/** Move one canonical Junction exactly in document X/Z space. */
export function planExactJunctionMove(
	document: LayoutDocumentWallFirst,
	junctionId: string,
	point: LayoutVec2
): PrecisionPlan {
	const junction = document.junctions.find((candidate) => candidate.id === junctionId);
	if (!junction) return reject('unknown_junction', `Unknown junction '${junctionId}'`, [junctionId]);
	if (!finitePoint(point)) return reject('invalid_value', 'Junction X/Z must be finite', [junctionId]);
	if (coincidesAsJunction(junction.point, point)) return reject('no_op', `Junction '${junctionId}' is already at that point`, [junctionId]);

	const candidate = cloneDocument(document);
	const moved = candidate.junctions.find((entry) => entry.id === junctionId)!;
	moved.point = [point[0], point[1]];
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'junction-position',
		changedJunctionIds: [junctionId],
		changedWallIds: incidentWallIds(document, junctionId)
	});
}

/**
 * P23.10 — translate one canonical straight Wall rigidly in X/Z: both endpoint
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
	deltaArgument?: LayoutVec2
): PrecisionPlan {
	const intent: WallMoveIntent = typeof wallOrIntent === 'string'
		? { wallId: wallOrIntent, delta: (deltaArgument ?? [0, 0]) as LayoutVec2 }
		: { wallId: wallOrIntent.wallId, delta: wallOrIntent.delta };
	const wall = document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${intent.wallId}'`, [intent.wallId]);
	if (!finitePoint(intent.delta)) return reject('invalid_value', 'Wall move delta must be finite X/Z', [wall.id]);
	if (intent.delta[0] === 0 && intent.delta[1] === 0) return reject('no_op', `Wall '${wall.id}' already has that position`, [wall.id]);

	const endpoints = wallEndpoints(document, wall);
	if (!endpoints) return reject('unsupported_geometry', `Wall '${wall.id}' has unresolved junction geometry`, [wall.id]);
	if (!(endpoints.length > POINT_EPSILON)) return reject('unsupported_geometry', `Wall '${wall.id}' has zero effective length`, [wall.id]);

	// Canonical endpoint order, de-duplicated: a degenerate self-loop Wall
	// carries one Junction, not two.
	const changedJunctionIds = [...new Set([wall.startJunctionId, wall.endJunctionId])];
	const candidate = cloneDocument(document);
	for (const junction of candidate.junctions) {
		if (!changedJunctionIds.includes(junction.id)) continue;
		junction.point = [junction.point[0] + intent.delta[0], junction.point[1] + intent.delta[1]];
	}
	// Deterministic document-order union of every Wall incident to either moved
	// endpoint: those neighbours reshape because their shared Junction ID moved.
	const changedWallIds = document.walls
		.filter((candidate) =>
			changedJunctionIds.some(
				(junctionId) =>
					candidate.startJunctionId === junctionId || candidate.endJunctionId === junctionId
			)
		)
		.map((candidate) => candidate.id);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'wall-move',
		changedJunctionIds,
		changedWallIds
	});
}

/** Set a straight Wall's exact physical length while keeping one endpoint fixed. */
export function planExactWallLength(
	document: LayoutDocumentWallFirst,
	wallOrIntent: string | WallLengthIntent,
	lengthArgument?: number,
	fixedArgument: FixedWallEndpoint = 'start'
): PrecisionPlan {
	const intent = typeof wallOrIntent === 'string'
		? { wallId: wallOrIntent, length: lengthArgument, fixed: fixedArgument }
		: {
				wallId: wallOrIntent.wallId,
				length: wallOrIntent.length,
				fixed: wallOrIntent.fixedEndpoint ?? wallOrIntent.fixed ?? 'start'
			};
	const wall = document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${intent.wallId}'`, [intent.wallId]);
	if (!validFixedEndpoint(intent.fixed)) return reject('invalid_endpoint', "Fixed endpoint must be 'start' or 'end'", [wall.id]);
	if (!finitePositive(intent.length)) return reject('invalid_value', 'Wall length must be finite and greater than zero', [wall.id]);

	const endpoints = wallEndpoints(document, wall);
	if (!endpoints) return reject('unsupported_geometry', `Wall '${wall.id}' has unresolved junction geometry`, [wall.id]);
	if (!(endpoints.length > POINT_EPSILON)) return reject('unsupported_geometry', `Wall '${wall.id}' has zero effective length`, [wall.id]);
	if (intent.length === endpoints.length) return reject('no_op', `Wall '${wall.id}' already has that length`, [wall.id]);

	const direction: LayoutVec2 = [
		(endpoints.end[0] - endpoints.start[0]) / endpoints.length,
		(endpoints.end[1] - endpoints.start[1]) / endpoints.length
	];
	const movedJunctionId = intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId;
	const fixedPoint = intent.fixed === 'start' ? endpoints.start : endpoints.end;
	const movedPoint: LayoutVec2 = intent.fixed === 'start'
		? [fixedPoint[0] + direction[0] * intent.length, fixedPoint[1] + direction[1] * intent.length]
		: [fixedPoint[0] - direction[0] * intent.length, fixedPoint[1] - direction[1] * intent.length];
	if (coincidesAsJunction(currentJunctionPoint(document, movedJunctionId), movedPoint)) return reject('no_op', `Wall '${wall.id}' already has that length`, [wall.id]);

	const candidate = moveJunction(document, movedJunctionId, movedPoint);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'wall-length',
		changedJunctionIds: [movedJunctionId],
		changedWallIds: incidentWallIds(document, movedJunctionId)
	});
}

/** Set a supported straight Wall's exact X/Z angle in radians. */
export function planExactWallAngle(
	document: LayoutDocumentWallFirst,
	wallOrIntent: string | WallAngleIntent,
	angleArgument?: number,
	fixedArgument: FixedWallEndpoint = 'start'
): PrecisionPlan {
	const intent = typeof wallOrIntent === 'string'
		? { wallId: wallOrIntent, angle: angleArgument, fixed: fixedArgument }
		: {
				wallId: wallOrIntent.wallId,
				angle: wallOrIntent.angle,
				fixed: wallOrIntent.fixedEndpoint ?? wallOrIntent.fixed ?? 'start'
			};
	const wall = document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${intent.wallId}'`, [intent.wallId]);
	if (!validFixedEndpoint(intent.fixed)) return reject('invalid_endpoint', "Fixed endpoint must be 'start' or 'end'", [wall.id]);
	const angle = intent.angle;
	if (typeof angle !== 'number' || !Number.isFinite(angle)) return reject('invalid_value', 'Wall angle must be finite radians', [wall.id]);

	const endpoints = wallEndpoints(document, wall);
	if (!endpoints) return reject('unsupported_geometry', `Wall '${wall.id}' has unresolved junction geometry`, [wall.id]);
	if (!(endpoints.length > POINT_EPSILON)) return reject('unsupported_geometry', `Wall '${wall.id}' has zero effective length`, [wall.id]);
	const direction: LayoutVec2 = [Math.cos(angle), Math.sin(angle)];
	const fixedPoint = intent.fixed === 'start' ? endpoints.start : endpoints.end;
	const movedJunctionId = intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId;
	const movedPoint: LayoutVec2 = intent.fixed === 'start'
		? [fixedPoint[0] + direction[0] * endpoints.length, fixedPoint[1] + direction[1] * endpoints.length]
		: [fixedPoint[0] - direction[0] * endpoints.length, fixedPoint[1] - direction[1] * endpoints.length];
	if (coincidesAsJunction(currentJunctionPoint(document, movedJunctionId), movedPoint)) return reject('no_op', `Wall '${wall.id}' already has that angle`, [wall.id]);

	const candidate = moveJunction(document, movedJunctionId, movedPoint);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'wall-angle',
		changedJunctionIds: [movedJunctionId],
		changedWallIds: incidentWallIds(document, movedJunctionId)
	});
}

/** Set a Wall-owned physical thickness, preserving Wall and Opening identity. */
export function planExactWallThickness(
	document: LayoutDocumentWallFirst,
	wallId: string,
	thickness: number
): PrecisionPlan {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	if (!finitePositive(thickness)) return reject('invalid_value', 'Wall thickness must be finite and greater than zero', [wallId]);
	if (wall.thickness === thickness) return reject('no_op', `Wall '${wallId}' already has that thickness`, [wallId]);

	const candidate = cloneDocument(document);
	candidate.walls.find((entry) => entry.id === wallId)!.thickness = thickness;
	return finalizeCandidate(candidate, 'wall-thickness', [], [wallId]);
}

/**
 * Set a Wall's authoritative physical height (P23.6H, unbounded since P23.6I),
 * preserving Wall, Junction, Opening and Room identity.
 *
 * Height is independent of X/Z topology: the Wall stays the same authored Wall
 * with the same `role` and the same Room participation; only its vertical extent
 * changes (`topY = floor.elevation + height`). There is **no upper bound** — the
 * canonical Floor has no storey scalar to cap against — so any finite positive
 * value is accepted, including values taller than neighbouring Walls. A Wall
 * shortened below a hosted Opening's top still rejects atomically with the Opening
 * untouched (the canonical Opening validator owns that rule), and nothing is ever
 * clamped.
 */
export function planExactWallHeight(
	document: LayoutDocumentWallFirst,
	wallId: string,
	height: number
): PrecisionPlan {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	if (!finitePositive(height)) return reject('invalid_value', 'Wall height must be finite and greater than zero', [wallId]);
	if (wall.height === height) return reject('no_op', `Wall '${wallId}' already has that height`, [wallId]);

	const candidate = cloneDocument(document);
	candidate.walls.find((entry) => entry.id === wallId)!.height = height;
	return finalizeCandidate(candidate, 'wall-height', [], [wallId]);
}

/**
 * Add one explicit Vertex by subdividing a Wall at a physical meter offset.
 * The existing P23.8 noder owns deterministic IDs, opening rebasing, and
 * forward/reverse Room-boundary rewrites; this planner adds the P23.1 final
 * candidate gates around that result.
 */
export function planWallSubdivision(
	document: LayoutDocumentWallFirst,
	wallId: string,
	splitDistance: number,
	allocator: NodingIdAllocator
): PrecisionPlan {
	const planned: NodingPlan = planWallSplit(document, wallId, splitDistance, allocator);
	if (planned.kind === 'rejected') {
		return reject(planned.rejection.code, planned.rejection.message, [wallId]);
	}
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate: planned.document,
		operation: 'wall-subdivision',
		changedJunctionIds: [planned.junctionId],
		changedWallIds: planned.splitWallIds,
		createdWallIds: planned.createdWallIds
	});
}

/** P23.1 naming alias for callers that describe the operation as Add Vertex. */
export const planAddWallVertex = planWallSubdivision;

/** Resize a four-edge straight Room boundary into an exact rectangle. */
export function planExactRectangleDimensions(
	document: LayoutDocumentWallFirst,
	roomId: string,
	width: number,
	depth: number,
	options: RectangleResizeOptions = {}
): PrecisionPlan {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) return reject('unknown_room', `Unknown room '${roomId}'`, [roomId]);
	if (!finitePositive(width) || !finitePositive(depth)) return reject('invalid_value', 'Rectangle width and depth must be finite and greater than zero', [roomId]);
	if (room.boundary.length !== 4) return reject('unsupported_geometry', 'Exact rectangle dimensions require four straight boundary Walls', [roomId]);

	const resolved = resolveRectangle(document, roomId, options);
	if ('rejection' in resolved) return { kind: 'rejected', rejection: resolved.rejection };
	const { corners, roomWallIds, widthWallId, depthWallId } = resolved;
	if (roomWallIds.some((wallId) => document.walls.find((wall) => wall.id === wallId)?.role !== 'boundary')) {
		return reject('unsupported_geometry', 'Rectangle boundaries must use boundary Walls', [roomId]);
	}
	if (hasAmbiguousSharedBoundary(document, roomId, roomWallIds, corners.map((corner) => corner.id))) {
		return reject('shared_boundary_resize_ambiguous', 'Rectangle resize would ambiguously deform a shared Wall network', [roomId, ...roomWallIds]);
	}

	const anchor = corners.find((corner) => corner.id === resolved.anchorJunctionId)!;
	const widthCorner = corners.find((corner) => corner.id === resolved.widthEndpointId)!;
	const depthCorner = corners.find((corner) => corner.id === resolved.depthEndpointId)!;
	const opposite = corners.find((corner) =>
		corner.id !== anchor.id && corner.id !== widthCorner.id && corner.id !== depthCorner.id
	)!;
	const widthLength = distance(anchor.point, widthCorner.point);
	const depthLength = distance(anchor.point, depthCorner.point);
	if (!(widthLength > POINT_EPSILON) || !(depthLength > POINT_EPSILON)) return reject('unsupported_geometry', 'Rectangle edges must have non-zero length', [roomId]);
	const widthAxis = normalize(subtract(widthCorner.point, anchor.point));
	const depthAxis = normalize(subtract(depthCorner.point, anchor.point));
	if (!widthAxis || !depthAxis || Math.abs(dot(widthAxis, depthAxis)) > 1e-5) {
		return reject('unsupported_geometry', 'Rectangle edges must meet at a right angle', [roomId]);
	}
	const expectedOpposite = add(widthCorner.point, scale(depthAxis, depthLength));
	if (distance(expectedOpposite, opposite.point) > 1e-5) {
		return reject('unsupported_geometry', 'Room boundary is not a rectangle; exact rectangle resize is unsupported', [roomId]);
	}

	const targetPoints = new Map<string, LayoutVec2>([
		[anchor.id, [anchor.point[0], anchor.point[1]]],
		[widthCorner.id, add(anchor.point, scale(widthAxis, width))],
		[depthCorner.id, add(anchor.point, scale(depthAxis, depth))],
		[opposite.id, add(add(anchor.point, scale(widthAxis, width)), scale(depthAxis, depth))]
	]);
	if ([...targetPoints].every(([id, point]) => coincidesAsJunction(currentJunctionPoint(document, id), point))) {
		return reject('no_op', `Room '${roomId}' already has those rectangle dimensions`, [roomId]);
	}

	const candidate = cloneDocument(document);
	for (const junction of candidate.junctions) {
		const point = targetPoints.get(junction.id);
		if (point) junction.point = point;
	}
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'rectangle-dimensions',
		changedJunctionIds: [...targetPoints.keys()],
		changedWallIds: [...new Set([...roomWallIds, widthWallId, depthWallId])]
	});
}

// =====================================================================
// P23.5 — small architectural preset set (creation defaults only).
//
// A preset is never a serialized kind, linked instance, library service or
// renderer branch (P23.5 contract): it resolves to ONE ordinary document-level
// LayoutObject of an existing primitive kind with finite/positive default
// dimensions, floor-relative placement, and no roomId. After creation the
// object edits/compiles/renders through the exact same P23.1 object controls
// and canonical compiler as every manually created primitive.
// =====================================================================

/** P23.5 preset identifiers. No `Partition` preset: partitions are first-class wall-first Walls (P23.9). */
export type LayoutArchitecturalPresetId = 'column' | 'platform' | 'plinth';

export type LayoutArchitecturalPreset = {
	id: LayoutArchitecturalPresetId;
	/** Human label for tool buttons (toolbar / Inspector Place accordion). */
	label: string;
	/** Ordinary `LayoutObject.kind` the preset creates — never a new kind. */
	kind: 'cylinder' | 'box';
	/** Finite/positive X/Z/Y meters (eye-call defaults, not constraints). */
	dimensions: Vec3;
};

/**
 * The three shipped architectural presets.
 *
 * Column → cylinder (0.4 m diameter, 3 m tall); Platform → low wide box;
 * Plinth → small display base. Defaults are an implementation/product
 * eye-call and stay editable through the existing object dimension controls
 * after creation.
 */
export const LAYOUT_ARCHITECTURAL_PRESETS: readonly LayoutArchitecturalPreset[] = [
	{ id: 'column', label: 'Column', kind: 'cylinder', dimensions: [0.4, 3, 0.4] },
	{ id: 'platform', label: 'Platform', kind: 'box', dimensions: [3, 0.2, 3] },
	{ id: 'plinth', label: 'Plinth', kind: 'box', dimensions: [0.8, 1, 0.8] }
] as const;

export function layoutArchitecturalPreset(
	id: string
): LayoutArchitecturalPreset | undefined {
	return LAYOUT_ARCHITECTURAL_PRESETS.find((preset) => preset.id === id);
}

/**
 * Floor-relative placement for one preset: the object's stored world position
 * sits half a height above the floor elevation (matching how the compiler
 * centers primitives). Returns `undefined` for non-finite/zero-height input.
 */
export function layoutPresetPlacement(
	preset: LayoutArchitecturalPreset,
	point: LayoutVec2,
	floorElevation: number
): Vec3 | undefined {
	const height = preset.dimensions[1];
	if (!Number.isFinite(height) || !(height > 0) || !Number.isFinite(floorElevation)) return undefined;
	return [point[0], floorElevation + height / 2, point[1]];
}

/**
 * P23.5 — create one ordinary LayoutObject from a preset on a wall-first
 * document. Click point is the object's X/Z center (document meters); the
 * stored transform stays project/world-local with no Room containment and no
 * preset metadata. Rejection codes reuse the canonical set so the shared
 * status/message path needs no new surface.
 */
export function planCommitLayoutObjectPreset(
	document: LayoutDocumentWallFirst,
	presetId: LayoutArchitecturalPresetId,
	point: LayoutVec2,
	floorElevation: number
): PrecisionPlan {
	const preset = layoutArchitecturalPreset(presetId);
	if (!preset) return reject('invalid_reference', `Unknown architectural preset '${presetId}'`, [presetId]);
	if (!finitePoint(point)) return reject('invalid_value', 'Preset placement point must be finite', [presetId]);
	if (!preset.dimensions.every((value) => Number.isFinite(value) && value > 0)) {
		return reject('invalid_value', 'Preset dimensions must be finite and greater than zero', [presetId]);
	}
	const position = layoutPresetPlacement(preset, point, floorElevation);
	if (!position) return reject('invalid_value', 'Preset placement requires a finite floor elevation', [presetId]);

	const candidate = cloneDocument(document);
	const objectId = nextLayoutObjectIdIn(candidate);
	const object: LayoutObject = {
		id: objectId,
		kind: preset.kind,
		position,
		rotation: [0, 0, 0],
		dimensions: [...preset.dimensions] as Vec3
	};
	candidate.objects = [...candidate.objects, object];
	const finalized = finalizeCandidate(candidate, 'layout-object-preset-create', [], [], [objectId]);
	return finalized.kind === 'success' ? { ...finalized, createdObjectId: objectId } : finalized;
}

/** Deterministic `layout-object-N` allocation from the pre-commit candidate. */
function nextLayoutObjectIdIn(document: LayoutDocumentWallFirst): string {
	const taken = new Set(document.objects.map((object) => object.id));
	let index = document.objects.length + 1;
	while (taken.has(`layout-object-${index}`)) index += 1;
	return `layout-object-${index}`;
}

/** Set exact document-level LayoutObject transform fields in a wall-first document. */
export function planExactLayoutObjectTransform(
	document: LayoutDocumentWallFirst,
	objectId: string,
	patch: LayoutObjectTransformPatch
): PrecisionPlan {
	const object = document.objects.find((candidate) => candidate.id === objectId);
	if (!object) return reject('unknown_object', `Unknown layout object '${objectId}'`, [objectId]);
	const vectorFields = (['position', 'rotation', 'dimensions'] as const).filter((field) => patch[field] !== undefined);
	const roomChanged = 'roomId' in patch && patch.roomId !== object.roomId;
	if (patch.roomId && !document.rooms.some((room) => room.id === patch.roomId)) {
		return reject('invalid_reference', `Unknown roomId '${patch.roomId}'`, [objectId, patch.roomId]);
	}
	if (vectorFields.length === 0 && !roomChanged) return reject('no_op', `Layout object '${objectId}' has no transform changes`, [objectId]);
	if (patch.position && !finiteVector(patch.position)) return reject('invalid_value', 'Object position must be finite', [objectId]);
	if (patch.rotation && !finiteVector(patch.rotation)) return reject('invalid_value', 'Object rotation must be finite radians', [objectId]);
	if (patch.dimensions && (!finiteVector(patch.dimensions) || patch.dimensions.some((value) => value <= 0))) {
		return reject('invalid_value', 'Object dimensions must be finite and greater than zero', [objectId]);
	}
	const unchanged = vectorFields.every((field) => vectorEqual(object[field] as readonly number[], patch[field] as readonly number[]));
	if (unchanged && !roomChanged) return reject('no_op', `Layout object '${objectId}' already has those values`, [objectId]);

	const candidate = cloneDocument(document);
	const target = candidate.objects.find((entry) => entry.id === objectId)!;
	if (patch.position) target.position = [...patch.position] as typeof target.position;
	if (patch.rotation) target.rotation = [...patch.rotation] as typeof target.rotation;
	if (patch.dimensions) target.dimensions = [...patch.dimensions] as typeof target.dimensions;
	if ('roomId' in patch) {
		if (patch.roomId) target.roomId = patch.roomId;
		else delete target.roomId;
	}
	return finalizeCandidate(candidate, 'layout-object-transform', [], [], [objectId]);
}

/** Delete one editable document-level LayoutObject through the same candidate gates. */
export function planDeleteLayoutObject(
	document: LayoutDocumentWallFirst,
	objectId: string
): PrecisionPlan {
	const object = document.objects.find((candidate) => candidate.id === objectId);
	if (!object) return reject('unknown_object', `Unknown layout object '${objectId}'`, [objectId]);
	if (object.kind === 'profile') return reject('invalid_reference', 'Profile objects are read-only', [objectId]);

	const candidate = cloneDocument(document);
	candidate.objects = candidate.objects.filter((entry) => entry.id !== objectId);
	return finalizeCandidate(candidate, 'layout-object-delete', [], [], [objectId]);
}

function finalizeCandidate(
	candidate: LayoutDocumentWallFirst,
	operation: PrecisionOperation,
	changedJunctionIds: readonly string[],
	changedWallIds: readonly string[],
	changedObjectIds?: readonly string[],
	createdWallIds?: readonly string[]
): PrecisionPlan {
	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		return reject('geometry_invalid', `Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`, undefined, structural.issues);
	}
	const topologyIssue = validateWallFirstTopology(structural.document);
	if (topologyIssue) {
		// P23.6H — a Wall-vs-Opening vertical conflict keeps its own rejection
		// code; every other topology failure stays `topology_invalid`.
		const topologyCode: PrecisionRejection['code'] =
			topologyIssue.code === 'wall_height_below_opening'
				? 'wall_height_below_opening'
				: 'topology_invalid';
		return reject(topologyCode, topologyIssue.message, topologyIssue.targetId ? [topologyIssue.targetId] : undefined, [topologyIssue]);
	}
	const compiled = compileWallFirstLayoutGeometry(structural.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject('geometry_invalid', compiled.issues[0]?.message ?? 'Candidate geometry does not compile', undefined, compiled.issues);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		changedJunctionIds: [...changedJunctionIds],
		changedWallIds: [...new Set([...changedWallIds, ...(createdWallIds ?? [])])],
		...(changedObjectIds ? { changedObjectIds: [...changedObjectIds] } : {})
	};
}

/**
 * P23.8 result narrowing: `RoomReconciliation` carries no `kind` discriminant,
 * so a type predicate is what lets the success branch expose `document`.
 */
function isReconciliationFailure(
	result: ReconciliationResult
): result is ReconciliationFailure {
	return 'kind' in result && result.kind === 'rejected';
}

/**
 * P23.10 — the canonical **geometry-edit acceptance path**.
 *
 * Every operation that edits canonical Junction coordinates or subdivides a
 * Wall runs the same seam, so a pointer gesture and the Inspector's exact
 * fields can never reach acceptance by different routes:
 *
 * ```text
 * candidate (immutable baseline → cloned coordinate edit, or planWallSplit)
 *   → pre-reconciliation structural/topology gate (canonical rejection codes)
 *   → candidate faces (extractBoundaryCandidateFaces)
 *   → explicit 1→1 Room boundary-cycle lineage declared from authored IDs
 *   → reconcileRooms with an allocator that records — never grants — a birth
 *   → assert exact Room identity preservation (no birth/retire/split/merge)
 *   → wall-first codec → topology → Opening set → portal relations → compiler
 * ```
 *
 * Lineage is declared from the candidate document's own authored boundary
 * cycles, never from nearest-polygon geometry: a coordinate edit leaves every
 * cycle key invariant, and `planWallSplit` has already rewritten the split
 * Room's cycle to its successor fragments. Both therefore map 1→1 by key
 * equality, which is why arbitrarily large valid moves stay exact.
 *
 * The pre-reconciliation gate runs first so a malformed reference or an
 * invalid crossing/overlap keeps its canonical rejection instead of being
 * misreported as a correspondence failure. Metadata/object operations stay on
 * the generic `finalizeCandidate` path — Room reconciliation is never forced
 * onto an operation that cannot change topology.
 */
function finalizeWallGeometryCandidate(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	operation: PrecisionOperation;
	changedJunctionIds: readonly string[];
	changedWallIds: readonly string[];
	createdWallIds?: readonly string[];
}): PrecisionPlan {
	const { baseline, candidate, operation, changedJunctionIds, changedWallIds } = options;

	const preStructural = validateWallFirstLayoutDocument(candidate);
	if (!preStructural.success) {
		return reject('geometry_invalid', `Candidate failed wall-first validation: ${preStructural.issues[0]?.message ?? 'unknown issue'}`, undefined, preStructural.issues);
	}
	const preTopology = validateWallFirstTopology(preStructural.document);
	if (preTopology) {
		return reject(
			preTopology.code === 'wall_height_below_opening' ? 'wall_height_below_opening' : 'topology_invalid',
			preTopology.message,
			preTopology.targetId ? [preTopology.targetId] : undefined,
			[preTopology]
		);
	}

	const document = preStructural.document;
	const extraction = extractBoundaryCandidateFaces(document);
	const candidateRoomById = new Map(document.rooms.map((room) => [room.id, room]));
	const components: ComponentLineage[] = [];
	for (const room of baseline.rooms) {
		const candidateRoom = candidateRoomById.get(room.id);
		if (!candidateRoom) {
			return reject('room_identity_lost', `Room '${room.id}' has no candidate boundary`, [room.id]);
		}
		components.push({
			candidateFaceKeys: [canonicalBoundaryCycleKey(candidateRoom.boundary)],
			predecessorRoomIds: [room.id]
		});
	}

	const allocationAttempted = { value: false };
	const reconciliation: ReconciliationResult = reconcileRooms({
		baseline,
		candidateDocument: document,
		extraction,
		components,
		allocator: guardedRoomAllocator(allocationAttempted)
	});
	if (isReconciliationFailure(reconciliation)) {
		const { rejection } = reconciliation;
		return reject('room_identity_lost', rejection.message, rejection.roomIds);
	}

	const identityIssue = assertWallGeometryRoomIdentityPreserved(
		baseline,
		document,
		reconciliation,
		allocationAttempted.value
	);
	if (identityIssue) {
		return reject('room_identity_lost', identityIssue.message, identityIssue.targetIds);
	}

	const reconciled = reconciliation.document;
	const structural = validateWallFirstLayoutDocument(reconciled);
	if (!structural.success) {
		return reject('geometry_invalid', `Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`, undefined, structural.issues);
	}
	const topologyIssue = validateWallFirstTopology(structural.document);
	if (topologyIssue) {
		return reject(
			topologyIssue.code === 'wall_height_below_opening' ? 'wall_height_below_opening' : 'topology_invalid',
			topologyIssue.message,
			topologyIssue.targetId ? [topologyIssue.targetId] : undefined,
			[topologyIssue]
		);
	}
	const setIssues = validateWallFirstOpeningSet(structural.document);
	if (setIssues.length > 0) {
		const first = setIssues[0]!;
		return reject('opening_set_invalid', first.message, [first.wallId, first.openingId], setIssues);
	}
	const relationIssues = validateWallFirstPortalRelations(structural.document);
	if (relationIssues.length > 0) {
		const first = relationIssues[0]!;
		return reject('portal_relation_invalid', first.message, [first.openingId], relationIssues);
	}
	const compiled = compileWallFirstLayoutGeometry(structural.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject('geometry_invalid', compiled.issues[0]?.message ?? 'Candidate geometry does not compile', undefined, compiled.issues);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		changedJunctionIds: [...changedJunctionIds],
		changedWallIds: [...new Set([...changedWallIds, ...(options.createdWallIds ?? [])])]
	};
}

/**
 * An allocator that must never be reached: a coordinate edit or subdivision
 * preserves global Room identity, so a reconciliation branch that allocates a
 * Room ID/name is proof the operation was not identity-preserving. It records
 * the attempt instead of throwing so the planner rejects through its ordinary
 * result contract.
 */
function guardedRoomAllocator(attempted: { value: boolean }): RoomIdAllocator {
	return {
		nextRoomId(_document, faceKey) {
			attempted.value = true;
			return `unreachable-wall-edit.${faceKey}`;
		},
		nextRoomName() {
			attempted.value = true;
			return 'Unreachable Wall Edit';
		}
	};
}

/**
 * Prove the geometry edit preserved **global** Room identity: every baseline
 * Room survives with the same ID and name, no Room was born, retired, split or
 * merged, the declared candidate boundary cycle was honored, and reconciliation
 * never reached an allocating branch.
 */
function assertWallGeometryRoomIdentityPreserved(
	baseline: LayoutDocumentWallFirst,
	candidate: LayoutDocumentWallFirst,
	reconciliation: {
		document: LayoutDocumentWallFirst;
		lineage: readonly {
			faceKey: string;
			roomId: string;
			predecessorRoomIds: readonly string[];
			kind: 'preserved' | 'split-survivor' | 'merge-survivor' | 'created';
		}[];
		retiredRoomIds: readonly string[];
	},
	allocationAttempted: boolean
): { message: string; targetIds?: readonly string[] } | null {
	if (allocationAttempted) {
		return {
			message: 'Geometry edit reached a Room allocation branch; direct Wall/Junction edits preserve Room identity'
		};
	}
	if (reconciliation.retiredRoomIds.length > 0) {
		return {
			message: `Geometry edit retired Room(s) ${reconciliation.retiredRoomIds.join(', ')}`,
			targetIds: [...reconciliation.retiredRoomIds]
		};
	}
	if (reconciliation.lineage.length !== baseline.rooms.length) {
		return {
			message: `Geometry edit produced ${reconciliation.lineage.length} lineage record(s) for ${baseline.rooms.length} Room(s)`
		};
	}
	for (const record of reconciliation.lineage) {
		if (record.kind !== 'preserved' || record.predecessorRoomIds.length !== 1) {
			return {
				message: `Geometry edit produced a '${record.kind}' lineage record for Room '${record.roomId}'`,
				targetIds: [record.roomId]
			};
		}
	}
	if (reconciliation.document.rooms.length !== baseline.rooms.length) {
		return {
			message: `Room count changed during the geometry edit (${baseline.rooms.length} → ${reconciliation.document.rooms.length})`
		};
	}
	const finalByRoomId = new Map(reconciliation.document.rooms.map((room) => [room.id, room]));
	const candidateById = new Map(candidate.rooms.map((room) => [room.id, room]));
	for (const room of baseline.rooms) {
		const finalRoom = finalByRoomId.get(room.id);
		if (!finalRoom) {
			return { message: `Room '${room.id}' did not survive the geometry edit`, targetIds: [room.id] };
		}
		if (finalRoom.name !== room.name) {
			return { message: `Room '${room.id}' name changed during the geometry edit`, targetIds: [room.id] };
		}
		const declared = candidateById.get(room.id);
		if (
			!declared ||
			canonicalBoundaryCycleKey(finalRoom.boundary) !== canonicalBoundaryCycleKey(declared.boundary)
		) {
			return {
				message: `Room '${room.id}' boundary lineage changed during the geometry edit`,
				targetIds: [room.id]
			};
		}
	}
	return null;
}

/**
 * The one canonical **wall-first topology gate** for wall-first candidates:
 * no duplicate Junction points, non-zero Wall lengths, explicit-junction-only
 * Wall relationships (collinear overlap rejected), Room boundary
 * connectivity/role, and translation of the first canonical Opening-set
 * issue. Shared by the P23.1 precision planners (via `finalizeCandidate`) and
 * the P23.6a Room-move planner — never copied.
 */
export function validateWallFirstTopology(
	document: LayoutDocumentWallFirst
): LayoutGeometryIssue | undefined {
	for (let first = 0; first < document.junctions.length; first += 1) {
		for (let second = first + 1; second < document.junctions.length; second += 1) {
			if (coincidesAsJunction(document.junctions[first]!.point, document.junctions[second]!.point)) {
				return {
					path: `junctions[${second}].point`,
					code: 'duplicate_junction_point',
					message: `Junction '${document.junctions[second]!.id}' duplicates the point of '${document.junctions[first]!.id}'`,
					targetId: document.junctions[second]!.id
				};
			}
		}
	}

	const wallSegments = new Map<string, TopologySegment>();
	for (const wall of document.walls) {
		const endpoints = wallEndpoints(document, wall);
		if (!endpoints || !(endpoints.length > POINT_EPSILON)) {
			return {
				path: `walls.${wall.id}`,
				code: 'zero_length_wall',
				message: `Wall '${wall.id}' must have a non-zero effective length`,
				targetId: wall.id
			};
		}
		wallSegments.set(wall.id, { id: wall.id, start: endpoints.start, end: endpoints.end });
	}

	const walls = document.walls;
	for (let first = 0; first < walls.length; first += 1) {
		for (let second = first + 1; second < walls.length; second += 1) {
			const a = walls[first]!;
			const b = walls[second]!;
			const segmentA = wallSegments.get(a.id)!;
			const segmentB = wallSegments.get(b.id)!;
			const shared = sharedJunctionIds(a, b);
			const intersection = classifyWallIntersection(segmentA, segmentB, shared);
			if (intersection.kind === 'shared-explicit-junction') {
				// The classifier intentionally gives explicit connectivity priority;
				// still reject two collinear spans that overlap beyond the shared
				// endpoint, which is not a valid graph edge.
				const geometric = classifyWallIntersection(segmentA, segmentB, []);
				if (geometric.kind === 'collinear-overlap') {
					return topologyFailure(a.id, b.id, 'Walls overlap beyond their explicit shared Junction');
				}
				continue;
			}
			if (intersection.kind !== 'none') {
				return topologyFailure(a.id, b.id, `Walls '${a.id}' and '${b.id}' have unsupported ${intersection.kind}`);
			}
		}
	}

	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	for (const room of document.rooms) {
		if (room.boundary.length < 3) {
			return topologyFailure(room.id, undefined, `Room '${room.id}' needs at least three boundary Walls`);
		}
		let previousEnd: string | undefined;
		let firstStart: string | undefined;
		for (const [index, ref] of room.boundary.entries()) {
			const wall = wallById.get(ref.wallId)!;
			if (wall.role !== 'boundary') {
				return topologyFailure(room.id, ref.wallId, `Room '${room.id}' references non-boundary Wall '${ref.wallId}'`);
			}
			const start = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
			const end = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
			if (index === 0) firstStart = start;
			if (previousEnd !== undefined && previousEnd !== start) {
				return topologyFailure(room.id, ref.wallId, `Room '${room.id}' boundary is disconnected at Wall '${ref.wallId}'`);
			}
			previousEnd = end;
		}
		if (previousEnd !== firstStart) return topologyFailure(room.id, undefined, `Room '${room.id}' boundary is not closed`);
	}

	// Whole-hosting-Wall opening set: ONE canonical validator shared with the
	// P23.3 opening create/edit/drag/resize paths
	// (`layout-opening-set.ts`). Do not duplicate fit/overlap/vertical checks
	// here — this gate only translates the first canonical issue.
	const openingIssue = validateWallFirstOpeningSet(document)[0];
	if (openingIssue) {
		// P23.6H — the host-Wall vertical-fit issue gets a dedicated code so a
		// Wall-height edit can report it as `wall_height_below_opening` instead of
		// a generic topology failure. The canonical Opening validator owns the
		// rule; this branch only translates its issue.
		if (openingIssue.code === 'opening_exceeds_wall_height') {
			return {
				path: `walls.${openingIssue.wallId}.height`,
				code: 'wall_height_below_opening',
				message: openingIssue.message,
				targetId: openingIssue.wallId
			};
		}
		return topologyFailure(
			openingIssue.openingId,
			openingIssue.wallId,
			openingIssue.message
		);
	}
	return undefined;
}

/** Resolve the canonical rectangle anchor, incident width edge, and endpoints. */
export function resolveRectangle(
	document: LayoutDocumentWallFirst,
	roomId: string,
	options: RectangleResizeOptions = {}
): RectangleResolution {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) return { rejection: makeRejection('unknown_room', `Unknown room '${roomId}'`, [roomId]) };
	if (room.boundary.length !== 4) {
		return { rejection: makeRejection('unsupported_geometry', 'Rectangle resize requires four straight boundary Walls', [roomId]) };
	}
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const directed = room.boundary.map((ref) => {
		const wall = wallById.get(ref.wallId);
		if (!wall) return undefined;
		return {
			wall,
			wallId: wall.id,
			startId: ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId,
			endId: ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId
		};
	});
	if (directed.some((entry) => !entry)) return { rejection: makeRejection('invalid_reference', `Room '${roomId}' has an unresolved boundary Wall`, [roomId]) };
	const edges = directed as Array<NonNullable<(typeof directed)[number]>>;
	if (new Set(edges.flatMap((edge) => [edge.startId, edge.endId])).size !== 4) {
		return { rejection: makeRejection('unsupported_geometry', 'Rectangle resize requires four distinct corner Junctions', [roomId]) };
	}
	for (let index = 0; index < edges.length; index += 1) {
		if (edges[index]!.endId !== edges[(index + 1) % edges.length]!.startId) {
			return { rejection: makeRejection('unsupported_geometry', `Room '${roomId}' boundary is not a connected four-edge cycle`, [roomId]) };
		}
	}

	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const cornerIds = [...new Set(edges.flatMap((edge) => [edge.startId, edge.endId]))].sort((a, b) => a.localeCompare(b));
	const corners = cornerIds.map((id) => junctionById.get(id));
	if (corners.some((junction) => !junction)) {
		return { rejection: makeRejection('invalid_reference', `Room '${roomId}' has an unresolved corner Junction`, [roomId]) };
	}
	const anchorJunctionId = options.anchorJunctionId ?? cornerIds[0];
	if (!anchorJunctionId || !cornerIds.includes(anchorJunctionId)) {
		return { rejection: makeRejection('invalid_reference', `Anchor Junction '${options.anchorJunctionId ?? ''}' is not a corner of Room '${roomId}'`, [roomId]) };
	}
	const incident = edges.filter((edge) => edge.startId === anchorJunctionId || edge.endId === anchorJunctionId).sort((a, b) => a.wallId.localeCompare(b.wallId));
	if (incident.length !== 2) return { rejection: makeRejection('unsupported_geometry', `Room '${roomId}' anchor must have exactly two incident boundary Walls`, [roomId]) };
	const widthEdge = options.widthWallId
		? incident.find((edge) => edge.wallId === options.widthWallId)
		: incident[0];
	if (!widthEdge) return { rejection: makeRejection('invalid_reference', `Width Wall '${options.widthWallId ?? ''}' is not incident to the anchor`, [roomId]) };
	const depthEdge = incident.find((edge) => edge.wallId !== widthEdge.wallId)!;
	const widthEndpointId = widthEdge.startId === anchorJunctionId ? widthEdge.endId : widthEdge.startId;
	const depthEndpointId = depthEdge.startId === anchorJunctionId ? depthEdge.endId : depthEdge.startId;
	return {
		anchorJunctionId,
		widthEndpointId,
		depthEndpointId,
		corners: corners as LayoutJunction[],
		roomWallIds: edges.map((edge) => edge.wallId),
		widthWallId: widthEdge.wallId,
		depthWallId: depthEdge.wallId
	};
}

function hasAmbiguousSharedBoundary(
	document: LayoutDocumentWallFirst,
	roomId: string,
	roomWallIds: readonly string[],
	cornerIds: readonly string[]
): boolean {
	const roomWalls = new Set(roomWallIds);
	if (document.rooms.some((room) => room.id !== roomId && room.boundary.some((ref) => roomWalls.has(ref.wallId)))) return true;
	return cornerIds.some((junctionId) =>
		document.walls.some((wall) =>
			(wall.startJunctionId === junctionId || wall.endJunctionId === junctionId) && !roomWalls.has(wall.id)
		)
	);
}

function topologyFailure(firstId: string, secondId: string | undefined, message: string): LayoutGeometryIssue {
	return {
		path: `topology.${firstId}`,
		code: 'unsupported_wall_topology',
		message,
		targetId: secondId ?? firstId
	};
}

function wallEndpoints(
	document: LayoutDocumentWallFirst,
	wall: LayoutWall
): { start: LayoutVec2; end: LayoutVec2; length: number } | undefined {
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)?.point;
	const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)?.point;
	if (!start || !end) return undefined;
	return { start, end, length: distance(start, end) };
}

function currentJunctionPoint(document: LayoutDocumentWallFirst, junctionId: string): LayoutVec2 {
	return document.junctions.find((junction) => junction.id === junctionId)!.point;
}

function moveJunction(document: LayoutDocumentWallFirst, junctionId: string, point: LayoutVec2): LayoutDocumentWallFirst {
	const candidate = cloneDocument(document);
	candidate.junctions.find((junction) => junction.id === junctionId)!.point = [point[0], point[1]];
	return candidate;
}

function incidentWallIds(document: LayoutDocumentWallFirst, junctionId: string): string[] {
	return document.walls
		.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
		.map((wall) => wall.id);
}

function sharedJunctionIds(a: LayoutWall, b: LayoutWall): string[] {
	return [a.startJunctionId, a.endJunctionId].filter((id) => id === b.startJunctionId || id === b.endJunctionId);
}

function cloneDocument(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return {
		...document,
		floor: { ...document.floor },
		junctions: document.junctions.map((junction) => ({ ...junction, point: [junction.point[0], junction.point[1]] })),
		walls: document.walls.map((wall) => ({ ...wall })),
		rooms: document.rooms.map((room) => ({ ...room, boundary: room.boundary.map((ref) => ({ ...ref })) })),
		openings: document.openings.map((opening) => ({
			...opening,
			...(opening.connectsRoomIds ? { connectsRoomIds: [...opening.connectsRoomIds] as [string, string] } : {})
		})),
		objects: document.objects.map((object) => ({
			...object,
			position: [...object.position] as typeof object.position,
			rotation: [...object.rotation] as typeof object.rotation,
			dimensions: [...object.dimensions] as typeof object.dimensions,
			...(object.profile
				? {
						profile: {
							...object.profile,
							segments: object.profile.segments.map((segment) => ({
								...segment,
								start: [...segment.start] as LayoutVec2,
								end: [...segment.end] as LayoutVec2,
								...(segment.kind === 'auto-bezier'
									? { interiorAnchors: segment.interiorAnchors.map((anchor) => ({ ...anchor, point: [...anchor.point] as LayoutVec2 })) }
									: {})
							}))
						}
					}
				: {})
		}))
	};
}

function reject(
	code: PrecisionRejection['code'],
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[]
): PrecisionPlan {
	return { kind: 'rejected', rejection: makeRejection(code, message, targetIds, issues) };
}

function makeRejection(
	code: PrecisionRejection['code'],
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[]
): PrecisionRejection {
	return { code, message, ...(targetIds ? { targetIds } : {}), ...(issues ? { issues } : {}) };
}

function finitePositive(value: number | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > POINT_EPSILON;
}

function finitePoint(point: readonly number[]): point is LayoutVec2 {
	return point.length === 2 && point.every((value) => Number.isFinite(value));
}

function finiteVector(vector: readonly number[]): boolean {
	return vector.length === 3 && vector.every((value) => Number.isFinite(value));
}

function validFixedEndpoint(value: unknown): value is FixedWallEndpoint {
	return value === 'start' || value === 'end';
}

function distance(a: LayoutVec2, b: LayoutVec2): number {
	return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function subtract(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] - b[0], a[1] - b[1]];
}

function add(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] + b[0], a[1] + b[1]];
}

function scale(a: LayoutVec2, factor: number): LayoutVec2 {
	return [a[0] * factor, a[1] * factor];
}

function normalize(a: LayoutVec2): LayoutVec2 | undefined {
	const length = Math.hypot(a[0], a[1]);
	return length > POINT_EPSILON ? [a[0] / length, a[1] / length] : undefined;
}

function dot(a: LayoutVec2, b: LayoutVec2): number {
	return a[0] * b[0] + a[1] * b[1];
}

function vectorEqual(a: readonly number[], b: readonly number[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}
