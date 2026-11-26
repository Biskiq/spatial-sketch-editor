import { cowCreateObject, cowDeleteObject, cowMoveJunctions, cowUpdateObject } from '../world/cow'
import { ensureLayoutWorldIndex, peekLayoutWorldIndex } from '../world/lookups';
import { layoutWorkingLevelIssue } from '../plan/id-capture';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { LayoutJunction } from '../wall/types';
import type { LayoutObject } from '../wall/types';
import { ROUND_ROOM_MEMBER_EDIT_MESSAGE, guardRoundRoomMemberGeometryEdit } from '../room/round-room';
import { coincidesAsJunction } from '../wall/junction-identity';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { LayoutArchitecturalPreset, LayoutArchitecturalPresetId, LayoutObjectTransformPatch, PrecisionPlan, RectangleResizeOptions, RectangleResolution } from './types';
import type { Vec3 } from '../kernel/types';
import { POINT_EPSILON, add, distance, dot, normalize, scale, subtract, vectorEqual } from '../vec2';
import { currentJunctionPoint } from './document';
import { finalizeCandidate, finalizeWallGeometryCandidate } from './finalization';
import { finitePoint, finitePositive, finiteVector, makeRejection, reject, rejectRoundMember } from './rejections';

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
	if (room.round !== undefined) {
		return rejectRoundMember({
			code: 'round_room_member_locked',
			message: ROUND_ROOM_MEMBER_EDIT_MESSAGE,
			roomId: room.id,
			wallIds: room.boundary.map((ref) => ref.wallId),
			junctionIds: []
		});
	}
			if (!finitePositive(width) || !finitePositive(depth)) return reject('invalid_value', 'Rectangle width and depth must be finite and greater than zero', [roomId]);
	if (room.virtualEdges.length > 0) return reject('unsupported_geometry', 'Exact rectangle dimensions apply to enclosed Rooms only', [roomId]);
	if (room.boundary.length !== 4) return reject('unsupported_geometry', 'Exact rectangle dimensions require four straight boundary Walls', [roomId]);

	const resolved = resolveRectangle(document, roomId, options);
	if ('rejection' in resolved) return { kind: 'rejected', rejection: resolved.rejection };
	const { corners, roomWallIds, widthWallId, depthWallId } = resolved;
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
	const movedCornerIds = [widthCorner.id, depthCorner.id, opposite.id];
	const rectRoundHit = guardRoundRoomMemberGeometryEdit(document, {
		wallIds: roomWallIds,
		junctionIds: movedCornerIds
	});
	if (rectRoundHit) return rejectRoundMember(rectRoundHit);
	if ([...targetPoints].every(([id, point]) => coincidesAsJunction(currentJunctionPoint(document, id), point))) {
		return reject('no_op', `Room '${roomId}' already has those rectangle dimensions`, [roomId]);
	}

	const changedWallIds = [...new Set([...roomWallIds, widthWallId, depthWallId])];
	const worldIndex = ensureLayoutWorldIndex(document);
	const candidate = cowMoveJunctions(document, targetPoints, changedWallIds, worldIndex);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'rectangle-dimensions',
		changedJunctionIds: [...targetPoints.keys()],
		changedWallIds
	});
}


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
 * Create one ordinary LayoutObject from a preset on a wall-first
 * document. Click point is the object's X/Z center (document meters); the
 * stored transform stays project/world-local with no Room containment and no
 * preset metadata. Rejection codes reuse the canonical set so the shared
 * status/message path needs no new surface.
 */
export function planCommitLayoutObjectPreset(
	document: LayoutDocumentWallFirst,
	presetId: LayoutArchitecturalPresetId,
	point: LayoutVec2,
	floorElevation: number,
	/** The identity captured before evaluation. */
	capturedObjectId: string,
	/** Explicit working level; must name `document.floor.id`. */
	levelId: string
): PrecisionPlan {
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) return reject('invalid_value', levelIssue, [presetId]);
	const preset = layoutArchitecturalPreset(presetId);
	if (!preset) return reject('invalid_reference', `Unknown architectural preset '${presetId}'`, [presetId]);
	if (!finitePoint(point)) return reject('invalid_value', 'Preset placement point must be finite', [presetId]);
	if (!preset.dimensions.every((value) => Number.isFinite(value) && value > 0)) {
		return reject('invalid_value', 'Preset dimensions must be finite and greater than zero', [presetId]);
	}
	const position = layoutPresetPlacement(preset, point, floorElevation);
	if (!position) return reject('invalid_value', 'Preset placement requires a finite floor elevation', [presetId]);

	if (typeof capturedObjectId !== 'string' || capturedObjectId.length === 0) {
		return reject('invalid_value', 'Preset creation requires a captured object id', [presetId]);
	}
	const worldIndex = ensureLayoutWorldIndex(document);
	const alreadyExists = worldIndex
		? worldIndex.objectById.has(capturedObjectId)
		: document.objects.some((object) => object.id === capturedObjectId);
	if (alreadyExists) {
		return reject('invalid_value', `Captured Layout object id '${capturedObjectId}' is already in use`, [capturedObjectId]);
	}
	const objectId = capturedObjectId;
	const object: LayoutObject = {
		id: objectId,
		kind: preset.kind,
		position,
		rotation: [0, 0, 0],
		dimensions: [...preset.dimensions] as Vec3
	};
	const candidate = cowCreateObject(document, object);
	const finalized = finalizeCandidate(candidate, 'layout-object-preset-create', [], [], [objectId]);
	return finalized.kind === 'success' ? { ...finalized, createdObjectId: objectId } : finalized;
}


/** Set exact document-level LayoutObject transform fields in a wall-first document. */
export function planExactLayoutObjectTransform(
	document: LayoutDocumentWallFirst,
	objectId: string,
	patch: LayoutObjectTransformPatch
): PrecisionPlan {
	const worldIndex = ensureLayoutWorldIndex(document);
	const object = worldIndex
		? worldIndex.objectById.get(objectId)
		: document.objects.find((candidate) => candidate.id === objectId);
	if (!object) return reject('unknown_object', `Unknown layout object '${objectId}'`, [objectId]);
	const vectorFields = (['position', 'rotation', 'dimensions'] as const).filter((field) => patch[field] !== undefined);
	const roomChanged = 'roomId' in patch && patch.roomId !== object.roomId;
	const roomExists = patch.roomId
		? worldIndex
			? worldIndex.roomById.has(patch.roomId)
			: document.rooms.some((room) => room.id === patch.roomId)
		: true;
	if (patch.roomId && !roomExists) {
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

	const candidate = cowUpdateObject(
		document,
		objectId,
		(existing) => {
			const next: LayoutObject = {
				...existing,
				position: patch.position
					? ([...patch.position] as typeof existing.position)
					: existing.position,
				rotation: patch.rotation
					? ([...patch.rotation] as typeof existing.rotation)
					: existing.rotation,
				dimensions: patch.dimensions
					? ([...patch.dimensions] as typeof existing.dimensions)
					: existing.dimensions
			};
			if ('roomId' in patch) {
				if (patch.roomId) next.roomId = patch.roomId;
				else delete next.roomId;
			}
			return next;
		},
		worldIndex
	);
	return finalizeCandidate(candidate, 'layout-object-transform', [], [], [objectId]);
}


/** Delete one editable document-level LayoutObject through the same candidate gates. */
export function planDeleteLayoutObject(
	document: LayoutDocumentWallFirst,
	objectId: string
): PrecisionPlan {
	const worldIndex = ensureLayoutWorldIndex(document);
	const object = worldIndex
		? worldIndex.objectById.get(objectId)
		: document.objects.find((candidate) => candidate.id === objectId);
	if (!object) return reject('unknown_object', `Unknown layout object '${objectId}'`, [objectId]);
	if (object.kind === 'profile') return reject('invalid_reference', 'Profile objects are read-only', [objectId]);

	const candidate = cowDeleteObject(document, objectId);
	return finalizeCandidate(candidate, 'layout-object-delete', [], [], [objectId]);
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
