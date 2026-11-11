/**
 * S2 Space conversion spike — TEST-ONLY harness.
 *
 * This module is experimental evidence for the approved T1 S2 spike. It is
 * deliberately outside `packages/layout-core` and is never imported by `src/`.
 * It does not add a production planner, schema field or editor intent.
 *
 * Two kinds of result are kept apart on purpose:
 *
 * - **Production verdict** — a real exported `layout-core` API run against a
 *   document. `productionVerdicts()` is the only place those are collected.
 * - **Simulation** — the harness policy below (keep an opened Room, derive
 *   virtual edges from boundary gaps, restore/retire through the same policy).
 *   A passing simulation is feasibility evidence, never production acceptance.
 *
 * The representation hypotheses are R0 (no new Room field; virtual edges are
 * the straight gaps between consecutive ordered boundary refs) and R1 (an
 * explicit `virtualEdges` Room field, which production does not accept today).
 * R1 is expressed only as a test-local shape and probed through the real codec.
 */
import {
	compileWallFirstLayoutGeometry,
	ensureLayoutWorldIndex,
	extractBoundaryCandidateFaces,
	faceArea,
	hasBlockingLayoutIssues,
	planDeleteWall,
	planWallChain,
	roomBoundaryPolygon,
	validateWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutDocumentIssue,
	type LayoutIdCapture,
	type LayoutVec2,
	type LayoutWallFirstRoom,
	type WallFirstOpPlan
} from '@portfolio/layout-core';

import { freshCapture } from '../__fixtures__/layout-id-capture';

/** One straight gap between consecutive ordered Wall refs. Never a subject. */
export type DerivedVirtualEdge = {
	readonly kind: 'virtual';
	/** Ref index immediately before the gap. `boundary.length - 1` means wrap. */
	readonly afterBoundaryIndex: number;
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
};

/** R1 test-local shape. Production's Room codec does not accept this key. */
export type ExplicitVirtualEdge = {
	readonly startJunctionId: string;
	readonly endJunctionId: string;
};

export type SpaceBoundaryEdge =
	| {
			readonly kind: 'wall';
			readonly wallId: string;
			readonly direction: 'forward' | 'reverse';
			readonly startJunctionId: string;
			readonly endJunctionId: string;
			readonly start: LayoutVec2;
			readonly end: LayoutVec2;
	  }
	| DerivedVirtualEdge;

export type OpenedSpace = {
	/** Candidate document with the opened Room still in `rooms`. */
	readonly document: LayoutDocumentWallFirst;
	readonly openedRoomIds: readonly string[];
	readonly retiredRoomIds: readonly string[];
	readonly virtualEdgesByRoomId: ReadonlyMap<string, readonly DerivedVirtualEdge[]>;
};

export type ProductionVerdicts = {
	readonly codec: {
		readonly success: boolean;
		readonly issueCodes: readonly string[];
	};
	readonly compiler: {
		readonly blocking: boolean;
		readonly roomCount: number;
		readonly issueCodes: readonly string[];
	};
	readonly worldIndex: {
		readonly certified: boolean;
		readonly roomCount: number;
	};
	readonly faceCount: number;
	/** The existing production helper's answer; wrong for an open boundary. */
	readonly roomBoundaryPolygonArea: number | null;
	/** The R0 composed boundary's answer (the intended outline). */
	readonly composedBoundaryArea: number | null;
};

export type ExplicitEdgeVerdict = {
	readonly success: boolean;
	readonly issueCodes: readonly string[];
};

export type LetGoPlan = ReturnType<typeof planWallChain>;

function junctionPoint(
	document: LayoutDocumentWallFirst,
	junctionId: string
): LayoutVec2 | undefined {
	return document.junctions.find((junction) => junction.id === junctionId)?.point;
}

function wallEdge(
	document: LayoutDocumentWallFirst,
	ref: { wallId: string; direction: 'forward' | 'reverse' }
): Extract<SpaceBoundaryEdge, { kind: 'wall' }> | undefined {
	const wall = document.walls.find((candidate) => candidate.id === ref.wallId);
	if (!wall) return undefined;
	const startJunctionId =
		ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
	const endJunctionId =
		ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
	const start = junctionPoint(document, startJunctionId);
	const end = junctionPoint(document, endJunctionId);
	if (!start || !end) return undefined;
	return {
		kind: 'wall',
		wallId: wall.id,
		direction: ref.direction,
		startJunctionId,
		endJunctionId,
		start: [...start] as LayoutVec2,
		end: [...end] as LayoutVec2
	};
}

/**
 * R0 derivation: every discontinuity between consecutive ordered boundary refs
 * is one straight virtual edge. A closed Room yields exactly zero.
 */
export function deriveVirtualEdges(
	document: LayoutDocumentWallFirst,
	roomOrId: LayoutWallFirstRoom | string
): DerivedVirtualEdge[] {
	const room =
		typeof roomOrId === 'string'
			? document.rooms.find((candidate) => candidate.id === roomOrId)
			: roomOrId;
	if (!room || room.boundary.length === 0) return [];
	const edges: DerivedVirtualEdge[] = [];
	for (let index = 0; index < room.boundary.length; index += 1) {
		const current = wallEdge(document, room.boundary[index]!);
		const nextRef = room.boundary[(index + 1) % room.boundary.length]!;
		const next = wallEdge(document, nextRef);
		if (!current || !next) continue;
		if (current.endJunctionId === next.startJunctionId) continue;
		edges.push({
			kind: 'virtual',
			afterBoundaryIndex: index,
			startJunctionId: current.endJunctionId,
			endJunctionId: next.startJunctionId,
			start: [...current.end] as LayoutVec2,
			end: [...next.start] as LayoutVec2
		});
	}
	return edges;
}

/**
 * Compose the R0 boundary in traversal order. The production
 * `roomBoundaryPolygon()` helper does NOT do this correctly for an open
 * boundary: it assumes contiguous refs and drops each Wall's end vertex. This
 * view names every Wall edge and every gap.
 */
export function composeSpaceBoundary(
	document: LayoutDocumentWallFirst,
	roomOrId: LayoutWallFirstRoom | string
): SpaceBoundaryEdge[] {
	const room =
		typeof roomOrId === 'string'
			? document.rooms.find((candidate) => candidate.id === roomOrId)
			: roomOrId;
	if (!room) return [];
	const edges: SpaceBoundaryEdge[] = [];
	for (let index = 0; index < room.boundary.length; index += 1) {
		const edge = wallEdge(document, room.boundary[index]!);
		if (!edge) continue;
		edges.push(edge);
		const nextRef = room.boundary[(index + 1) % room.boundary.length]!;
		const next = wallEdge(document, nextRef);
		if (next && edge.endJunctionId !== next.startJunctionId) {
			edges.push({
				kind: 'virtual',
				afterBoundaryIndex: index,
				startJunctionId: edge.endJunctionId,
				endJunctionId: next.startJunctionId,
				start: [...edge.end] as LayoutVec2,
				end: [...next.start] as LayoutVec2
			});
		}
	}
	return edges;
}

/** Area of the R0 composed boundary; `null` when the loop is not closed. */
export function composedBoundaryArea(
	document: LayoutDocumentWallFirst,
	roomId: string
): number | null {
	const edges = composeSpaceBoundary(document, roomId);
	if (!boundaryIsClosed(edges)) return null;
	return faceArea({ polygon: edges.map((edge) => edge.start) as LayoutVec2[] });
}

/** True when every edge starts where the previous one ended and the loop closes. */
export function boundaryIsClosed(edges: readonly SpaceBoundaryEdge[]): boolean {
	if (edges.length < 2) return false;
	for (let index = 0; index < edges.length; index += 1) {
		const current = edges[index]!;
		const next = edges[(index + 1) % edges.length]!;
		if (current.endJunctionId !== next.startJunctionId) return false;
	}
	return true;
}

/**
 * Simulation policy: when one removed Wall bounds exactly one Room, keep that
 * Room with its surviving ordered refs instead of retiring it. Shared Walls
 * (two Rooms) are left to production's ordinary merge; zero surviving refs
 * retire.
 *
 * Production `planDeleteWall` has already run. Its candidate cleared object
 * associations for a retired Room, so the harness restores the association for
 * a kept Room from the baseline. Every returned value is simulation state.
 */
export function applyOpenRoomPolicy(
	baseline: LayoutDocumentWallFirst,
	productionPlan: WallFirstOpPlan
): OpenedSpace {
	if (productionPlan.kind !== 'success') {
		throw new Error(`S2 harness needs a successful production plan: ${productionPlan.rejection.message}`);
	}
	const removedWallIds = baseline.walls
		.filter((wall) => !productionPlan.document.walls.some((candidate) => candidate.id === wall.id))
		.map((wall) => wall.id);
	const removedSet = new Set(removedWallIds);
	const openedRoomIds: string[] = [];
	const retiredRoomIds: string[] = [];
	const keptRooms: LayoutWallFirstRoom[] = [];

	for (const room of baseline.rooms) {
		const removedForRoom = room.boundary
			.filter((ref) => removedSet.has(ref.wallId))
			.map((ref) => ref.wallId);
		if (removedForRoom.length === 0) continue;
		// A shared Wall bounds another Room too: production merge is the answer.
		const hasSharedRemovedWall = removedForRoom.some((removedWallId) => {
			const boundingRoomCount = baseline.rooms.filter((candidate) =>
				candidate.boundary.some((ref) => ref.wallId === removedWallId)
			).length;
			return boundingRoomCount > 1;
		});
		if (hasSharedRemovedWall) continue;
		const survivingBoundary = room.boundary.filter((ref) => !removedSet.has(ref.wallId));
		if (survivingBoundary.length === 0) {
			retiredRoomIds.push(room.id);
			continue;
		}
		openedRoomIds.push(room.id);
		keptRooms.push({
			...room,
			boundary: survivingBoundary.map((ref) => ({ ...ref }))
		});
	}

	const keptRoomIdSet = new Set(keptRooms.map((room) => room.id));
	const baselineObjectById = new Map(baseline.objects.map((object) => [object.id, object]));
	const objects = productionPlan.document.objects.map((object) => {
		const baselineObject = baselineObjectById.get(object.id);
		if (!baselineObject?.roomId || !keptRoomIdSet.has(baselineObject.roomId)) return object;
		return { ...object, roomId: baselineObject.roomId };
	});
	const document: LayoutDocumentWallFirst = {
		...productionPlan.document,
		rooms: [
			...productionPlan.document.rooms.filter(
				(room) => !keptRoomIdSet.has(room.id) && !retiredRoomIds.includes(room.id)
			),
			...keptRooms
		],
		objects
	};
	// A production merge can already own the same id; keep one record.
	const seenRoomIds = new Set<string>();
	document.rooms = document.rooms.filter((room) => {
		if (seenRoomIds.has(room.id)) return false;
		seenRoomIds.add(room.id);
		return true;
	});

	const virtualEdgesByRoomId = new Map<string, readonly DerivedVirtualEdge[]>();
	for (const room of keptRooms) {
		virtualEdgesByRoomId.set(room.id, deriveVirtualEdges(document, room));
	}
	// Production retirements survive unless the harness kept that same Room.
	for (const roomId of productionPlan.retiredRoomIds) {
		if (openedRoomIds.includes(roomId) || retiredRoomIds.includes(roomId)) continue;
		retiredRoomIds.push(roomId);
	}
	return {
		document,
		openedRoomIds,
		retiredRoomIds,
		virtualEdgesByRoomId
	};
}

/**
 * Simulation: redraw one derived virtual edge. The real `planWallChain` runs
 * over the synthetic open-Room baseline and adopts both existing Junctions.
 * This is a feasibility probe for the 1→1 correspondence, not a production
 * path: nothing in production produces that baseline today.
 */
export function redrawVirtualEdge(
	document: LayoutDocumentWallFirst,
	edge: DerivedVirtualEdge,
	capture: LayoutIdCapture = freshCapture(),
	height = 3
): LetGoPlan {
	return planWallChain({
		baseline: document,
		points: [edge.start, edge.end],
		close: false,
		height,
		capture,
		levelId: document.floor.id,
		endpointJunctionSnaps: [
			{ pointIndex: 0, junctionId: edge.startJunctionId },
			{ pointIndex: 1, junctionId: edge.endJunctionId }
		]
	});
}

export type RemovedWallFromSpace = {
	readonly document: LayoutDocumentWallFirst;
	readonly retired: boolean;
	readonly remainingVirtualEdges: readonly DerivedVirtualEdge[];
};

/**
 * Simulation: remove one surviving boundary Wall from an open Space. Geometry
 * deletion goes through the real `planDeleteWall` on a roomless copy (so the
 * production retirement branch cannot pre-empt the experiment); the harness
 * then keeps or retires the Space record.
 */
export function removeWallFromOpenSpace(
	document: LayoutDocumentWallFirst,
	roomId: string,
	wallId: string,
	capture: LayoutIdCapture = freshCapture()
): RemovedWallFromSpace {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) throw new Error(`Unknown Space '${roomId}'`);
	const roomless: LayoutDocumentWallFirst = {
		...document,
		rooms: [],
		objects: []
	};
	const plan = planDeleteWall(roomless, wallId, capture, document.floor.id);
	if (plan.kind !== 'success') {
		throw new Error(`S2 harness wall removal failed: ${plan.rejection.message}`);
	}
	const survivingBoundary = room.boundary.filter((ref) => ref.wallId !== wallId);
	const objects = document.objects.map((object) =>
		object.roomId === roomId ? { ...object, roomId: undefined } : object
	);
	if (survivingBoundary.length === 0) {
		return {
			document: {
				...plan.document,
				rooms: [],
				objects
			},
			retired: true,
			remainingVirtualEdges: []
		};
	}
	const keptRoom: LayoutWallFirstRoom = {
		...room,
		boundary: survivingBoundary.map((ref) => ({ ...ref }))
	};
	const next: LayoutDocumentWallFirst = {
		...plan.document,
		rooms: [keptRoom],
		objects: document.objects.map((object) => ({ ...object }))
	};
	return {
		document: next,
		retired: false,
		remainingVirtualEdges: deriveVirtualEdges(next, keptRoom)
	};
}

/**
 * REAL PRODUCTION VERDICTS, collected independently. A compiled polygon is not
 * a valid or certified Space; each line is reported separately in the spike.
 */
export function productionVerdicts(document: LayoutDocumentWallFirst): ProductionVerdicts {
	const codec = validateWallFirstLayoutDocument(document);
	const compile = compileWallFirstLayoutGeometry(document);
	const worldIndex = ensureLayoutWorldIndex(document);
	const faceExtraction = extractBoundaryCandidateFaces(document);
	const roomId = document.rooms[0]?.id;
	const polygon = roomId ? roomBoundaryPolygon(document, roomId) : null;
	return {
		codec: {
			success: codec.success,
			issueCodes: codec.success ? [] : codec.issues.map((issue) => issue.code)
		},
		compiler: {
			blocking: hasBlockingLayoutIssues(compile.issues),
			roomCount: compile.geometry.rooms.length,
			issueCodes: compile.issues.map((issue: LayoutDocumentIssue) => issue.code)
		},
		worldIndex: {
			certified: worldIndex !== undefined,
			roomCount: worldIndex?.roomsRef?.length ?? 0
		},
		faceCount: faceExtraction.faces.length,
		roomBoundaryPolygonArea: polygon ? faceArea({ polygon }) : null,
		composedBoundaryArea: roomId ? composedBoundaryArea(document, roomId) : null
	};
}

/** Real codec verdict for the R1 shape; production is expected to reject the key. */
export function probeExplicitVirtualEdges(
	document: LayoutDocumentWallFirst,
	roomId: string,
	edges: readonly ExplicitVirtualEdge[]
): ExplicitEdgeVerdict {
	const candidate = {
		...document,
		rooms: document.rooms.map((room) =>
			room.id === roomId
				? {
						...room,
						// R1 test-local shape only. Never a production type.
						virtualEdges: edges.map((edge) => ({ ...edge }))
					}
				: room
		)
	} as unknown as LayoutDocumentWallFirst;
	const result = validateWallFirstLayoutDocument(candidate);
	return {
		success: result.success,
		issueCodes: result.success ? [] : result.issues.map((issue) => issue.code)
	};
}

/**
 * Simulation: perpendicular mid-grip move. Both gap endpoints are Junctions
 * shared with the adjacent Walls, so moving them stretches those Walls and the
 * derived edge follows. No edge id and no selectable subject is created.
 */
export function moveVirtualEdgePerpendicular(
	document: LayoutDocumentWallFirst,
	edge: DerivedVirtualEdge,
	distance: number
): LayoutDocumentWallFirst {
	const dx = edge.end[0] - edge.start[0];
	const dz = edge.end[1] - edge.start[1];
	const length = Math.hypot(dx, dz);
	if (!(length > 0)) throw new Error('Virtual edge has no direction');
	const nx = -dz / length;
	const nz = dx / length;
	const moved = structuredClone(document);
	for (const junctionId of [edge.startJunctionId, edge.endJunctionId]) {
		const junction = moved.junctions.find((candidate) => candidate.id === junctionId);
		if (!junction) throw new Error(`Missing virtual-edge Junction '${junctionId}'`);
		junction.point = [
			junction.point[0] + nx * distance,
			junction.point[1] + nz * distance
		] as LayoutVec2;
	}
	return moved;
}

/**
 * Simulation: one end knob slides along its adjacent surviving Wall. The shared
 * Junction moves on that Wall's line; the gap edge endpoints follow.
 */
export function slideVirtualEdgeEnd(
	document: LayoutDocumentWallFirst,
	roomId: string,
	edge: DerivedVirtualEdge,
	distance: number
): LayoutDocumentWallFirst {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) throw new Error(`Unknown Space '${roomId}'`);
	const before = composeSpaceBoundary(document, room)[
		composeSpaceBoundary(document, room).findIndex(
			(candidate) => candidate.kind === 'virtual' && candidate.startJunctionId === edge.startJunctionId
		) - 1
	];
	if (!before || before.kind !== 'wall') throw new Error('No adjacent Wall before the virtual edge');
	const dx = before.end[0] - before.start[0];
	const dz = before.end[1] - before.start[1];
	const length = Math.hypot(dx, dz);
	if (!(length > 0)) throw new Error('Adjacent Wall has no direction');
	const moved = structuredClone(document);
	const junction = moved.junctions.find((candidate) => candidate.id === before.endJunctionId);
	if (!junction) throw new Error(`Missing adjacent Junction '${before.endJunctionId}'`);
	junction.point = [
		junction.point[0] + (dx / length) * distance,
		junction.point[1] + (dz / length) * distance
	] as LayoutVec2;
	return moved;
}

/** Explicit R1 composition for the adjacent-Wall probe (test-local only). */
export function composeExplicitBoundary(
	document: LayoutDocumentWallFirst,
	roomId: string,
	edges: readonly ExplicitVirtualEdge[]
): SpaceBoundaryEdge[] {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) return [];
	const edgeByStart = new Map(edges.map((edge) => [edge.startJunctionId, edge]));
	const result: SpaceBoundaryEdge[] = [];
	for (const ref of room.boundary) {
		const wall = wallEdge(document, ref);
		if (!wall) continue;
		result.push(wall);
		let cursor = wall.endJunctionId;
		// R1 can bridge several removed Walls through an intermediate Junction.
		for (let guard = 0; guard < edges.length; guard += 1) {
			const explicit = edgeByStart.get(cursor);
			if (!explicit) break;
			const start = junctionPoint(document, explicit.startJunctionId);
			const end = junctionPoint(document, explicit.endJunctionId);
			if (!start || !end) break;
			result.push({
				kind: 'virtual',
				afterBoundaryIndex: 0,
				startJunctionId: explicit.startJunctionId,
				endJunctionId: explicit.endJunctionId,
				start: [...start] as LayoutVec2,
				end: [...end] as LayoutVec2
			});
			cursor = explicit.endJunctionId;
		}
	}
	return result;
}
