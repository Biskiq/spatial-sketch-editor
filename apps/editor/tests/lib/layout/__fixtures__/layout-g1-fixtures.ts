/**
 * G1 canonical Layout fixtures — wall-first documents.
 *
 * T1.P02.S05 converted this family from the retired legacy Room-owned document
 * to the canonical format-6 wall-first document. Each fixture authors Junctions,
 * Walls, persistent Rooms (boundary = oriented Wall references) and Wall-hosted
 * Openings; the compiler derives everything else, including each Room's ceiling
 * from its boundary Wall heights.
 *
 * The pre-conversion compiled observations for every case are committed at
 * `docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s05-legacy-layout-retirement/observations/legacy-compiled-observations.json`
 * (captured at the trusted base `fff7dc14`) so a semantic delta is reviewable.
 *
 * Identities deliberately keep the previous names: a Wall is
 * `${roomId}:wall:${edgeIndex}`, so a compiled physical Wall's `wallId` is the
 * id the retained expectations already named, and an Opening's hosting edge is
 * readable from its id. Junctions are `${roomId}:j${n}` and are deduplicated by
 * coordinate **within a Room**, because Junction identity *is* connectivity.
 */
import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	wallCubicChain,
	type DraftPath,
	type LayoutDocumentWallFirst,
	type LayoutObject,
	type LayoutVec2,
	type LayoutWallCenterline,
	type LayoutWallOpening
} from '@portfolio/layout-core';

/** One authored Wall edge of a fixture Room, in boundary-traversal order. */
export type G1Edge = {
	start: LayoutVec2;
	end: LayoutVec2;
	/** Optional interior bend point: turns the Wall into a cubic chain. */
	knot?: LayoutVec2;
};

/** An Opening authored on one of the Room's edges (by index). */
export type G1OpeningSpec = Omit<LayoutWallOpening, 'wallId'> & { wallIndex: number };

export type G1RoomSpec = {
	id: string;
	name: string;
	edges: readonly G1Edge[];
	openings: readonly G1OpeningSpec[];
	wallThickness?: number;
	/** Authored Wall height for every edge of this Room (meter, from the datum). */
	wallHeight?: number;
	floorThickness?: number;
	ceilingThickness?: number;
};

const DEFAULT_WALL_THICKNESS = 0.16;
const DEFAULT_WALL_HEIGHT = 3;

export type G1DocumentOptions = {
	/** Floor Y datum; default 0. */
	elevation?: number;
	/** Authored Wall height for every Wall without its own; default 3. */
	wallHeight?: number;
	objects?: readonly LayoutObject[];
};

/** Build a wall-first document from authored Room specs. */
export function g1DocumentWithRooms(
	rooms: readonly G1RoomSpec[],
	objects: readonly LayoutObject[] = [],
	options: G1DocumentOptions = {}
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.floor.id = 'floor-ground';
	document.floor.name = 'Ground Floor';
	document.floor.elevation = options.elevation ?? 0;
	for (const roomSpec of rooms) {
		appendRoom(document, roomSpec, options);
	}
	document.objects.push(...objects);
	return document;
}

function appendRoom(
	document: LayoutDocumentWallFirst,
	roomSpec: G1RoomSpec,
	options: G1DocumentOptions
): void {
	const junctionIdByPoint = new Map<string, string>();
	const junctionFor = (point: LayoutVec2): string => {
		const key = `${point[0]},${point[1]}`;
		const existing = junctionIdByPoint.get(key);
		if (existing) return existing;
		const id = `${roomSpec.id}:j${junctionIdByPoint.size}`;
		junctionIdByPoint.set(key, id);
		document.junctions.push({ id, point: [point[0], point[1]] });
		return id;
	};

	const wallIds: string[] = [];
	roomSpec.edges.forEach((edge, index) => {
		wallIds.push(`${roomSpec.id}:wall:${index}`);
	});
	roomSpec.edges.forEach((edge, index) => {
		document.walls.push({
			id: wallIds[index]!,
			startJunctionId: junctionFor(edge.start),
			endJunctionId: junctionFor(edge.end),
			thickness: roomSpec.wallThickness ?? DEFAULT_WALL_THICKNESS,
			height: roomSpec.wallHeight ?? options.wallHeight ?? DEFAULT_WALL_HEIGHT,
			centerline: edge.knot ? g1CurvedCenterline(edge.start, edge.end, edge.knot, wallIds[index]!) : { kind: 'line' }
		});
	});

	document.rooms.push({
		id: roomSpec.id,
		name: roomSpec.name,
		boundary: wallIds.map((wallId) => ({ wallId, direction: 'forward' as const })),
		floorThickness: roomSpec.floorThickness ?? 0.1,
		ceilingThickness: roomSpec.ceilingThickness ?? 0.1
	});

	for (const opening of roomSpec.openings) {
		const { wallIndex, ...rest } = opening;
		document.openings.push({ ...rest, wallId: wallIds[wallIndex]! });
	}
}

function g1CurvedCenterline(
	start: LayoutVec2,
	end: LayoutVec2,
	knot: LayoutVec2,
	wallId: string
): LayoutWallCenterline {
	return wallCubicChain([{ id: `${wallId}:knot:0`, point: [knot[0], knot[1]] }], deriveChainSpans([start, knot, end]));
}

/** Closed polygon Room: one line Wall per edge, all forward from `points`. */
export function g1RoomPolygon(
	id: string,
	points: readonly LayoutVec2[],
	overrides: Partial<Omit<G1RoomSpec, 'id' | 'edges'>> = {}
): G1RoomSpec {
	return {
		id,
		name: overrides.name ?? id,
		edges: points.map((start, index) => ({ start, end: points[(index + 1) % points.length]! })),
		openings: overrides.openings ?? [],
		...(overrides.wallThickness === undefined ? {} : { wallThickness: overrides.wallThickness }),
		...(overrides.wallHeight === undefined ? {} : { wallHeight: overrides.wallHeight }),
		...(overrides.floorThickness === undefined ? {} : { floorThickness: overrides.floorThickness }),
		...(overrides.ceilingThickness === undefined ? {} : { ceilingThickness: overrides.ceilingThickness })
	};
}

/** Explicit-edge Room: expresses chains a polygon cannot (gaps, crossing edges). */
export function g1RoomEdges(
	id: string,
	edges: readonly G1Edge[],
	overrides: Partial<Omit<G1RoomSpec, 'id' | 'edges'>> = {}
): G1RoomSpec {
	return {
		id,
		name: overrides.name ?? id,
		edges,
		openings: overrides.openings ?? [],
		...(overrides.wallThickness === undefined ? {} : { wallThickness: overrides.wallThickness }),
		...(overrides.wallHeight === undefined ? {} : { wallHeight: overrides.wallHeight }),
		...(overrides.floorThickness === undefined ? {} : { floorThickness: overrides.floorThickness }),
		...(overrides.ceilingThickness === undefined ? {} : { ceilingThickness: overrides.ceilingThickness })
	};
}

export function g1RectangleRoom(
	id: string,
	x: number,
	z: number,
	width: number,
	depth: number,
	openings: readonly G1OpeningSpec[] = []
): G1RoomSpec {
	return g1RoomPolygon(
		id,
		[
			[x, z],
			[x + width, z],
			[x + width, z + depth],
			[x, z + depth]
		],
		{ openings }
	);
}

export function g1LineRectangleDocument(): LayoutDocumentWallFirst {
	return g1DocumentWithRooms([g1RectangleRoom('room-rectangle', 0, 0, 6, 4)]);
}

export function g1LShapedDocument(): LayoutDocumentWallFirst {
	return g1DocumentWithRooms([
		g1RoomPolygon(
			'room-l',
			[
				[0, 0],
				[6, 0],
				[6, 3],
				[3, 3],
				[3, 6],
				[0, 6]
			],
			{ name: 'L Room' }
		)
	]);
}

export function g1AutoBezierDocument(): LayoutDocumentWallFirst {
	const room = g1RectangleRoom('room-rectangle', 0, 0, 6, 4);
	const [first, ...rest] = room.edges;
	return g1DocumentWithRooms([{ ...room, edges: [{ ...first!, knot: [3, -1] }, ...rest] }]);
}

export function g1Opening(
	id: string,
	wallId: string,
	kind: LayoutWallOpening['kind'],
	offset: number,
	width: number,
	height: number,
	sillHeight: number,
	profile: LayoutWallOpening['profile'] = 'rectangular'
): G1OpeningSpec {
	// `wallId` keeps the historical `${roomId}:wall:${edgeIndex}` form, so call
	// sites name the hosting edge exactly as before.
	const wallIndex = Number(wallId.slice(wallId.lastIndexOf(':') + 1));
	if (!Number.isInteger(wallIndex)) throw new Error(`g1Opening needs a ':wall:<index>' hosting id, got '${wallId}'`);
	return { id, kind, offset, width, height, sillHeight, profile, wallIndex };
}

export function g1MultipleOpeningsDocument(): LayoutDocumentWallFirst {
	const room = g1RectangleRoom('room-openings', 0, 0, 10, 4, [
		g1Opening('door-1', 'room-openings:wall:0', 'door', 1, 0.9, 2.1, 0),
		g1Opening('window-1', 'room-openings:wall:0', 'window', 4, 1.2, 1.2, 1),
		g1Opening('door-2', 'room-openings:wall:1', 'door', 0.5, 0.9, 2.1, 0)
	]);
	return g1DocumentWithRooms([room]);
}

export function g1ProfileMatrixDocument(): LayoutDocumentWallFirst {
	const room = g1RectangleRoom('room-profiles', 0, 0, 12, 4, [
		g1Opening('rect', 'room-profiles:wall:0', 'door', 0.5, 1.4, 2.4, 0, 'rectangular'),
		g1Opening('rounded', 'room-profiles:wall:0', 'window', 4, 1.4, 1.8, 1, 'rounded'),
		g1Opening('pointed', 'room-profiles:wall:0', 'window', 8, 1.4, 1.8, 1, 'pointed')
	]);
	return g1DocumentWithRooms([room]);
}

export function g1ElevatedFloorDocument(): LayoutDocumentWallFirst {
	return g1DocumentWithRooms(
		[
			{
				...g1RectangleRoom('room-rectangle', 0, 0, 6, 4),
				wallHeight: 4
			}
		],
		[],
		{ elevation: 2.5 }
	);
}

export function g1Object(kind: LayoutObject['kind'], id: string, overrides: Partial<LayoutObject> = {}): LayoutObject {
	const base: LayoutObject = {
		id,
		kind,
		position: [1, 0.5, 1],
		rotation: [0, 0, 0],
		dimensions: kind === 'plane' ? [2, 0.01, 2] : [1, 1, 1],
		roomId: 'room-objects'
	};
	return { ...base, ...overrides };
}

function g1ProfilePath(id: string, points: readonly LayoutVec2[]): DraftPath {
	return {
		closed: true,
		segments: points.map((start, index) => ({
			id: `${id}:${index}`,
			kind: 'line' as const,
			start: [...start] as LayoutVec2,
			end: [...points[(index + 1) % points.length]!] as LayoutVec2
		}))
	};
}

export function g1ObjectMatrixDocument(): LayoutDocumentWallFirst {
	const room = g1RectangleRoom('room-objects', 0, 0, 10, 8);
	const objects: LayoutObject[] = [
		g1Object('box', 'obj-box', { position: [1, 0.5, 1] }),
		g1Object('plane', 'obj-plane', { position: [3, 0, 3] }),
		g1Object('cylinder', 'obj-cylinder', { position: [5, 0.5, 1], rotation: [0, Math.PI / 4, 0] }),
		g1Object('sphere', 'obj-sphere', { position: [7, 0.5, 3], dimensions: [1.2, 0.8, 1.2] }),
		g1Object('profile', 'obj-profile', {
			position: [2, 0.25, 6],
			profile: g1ProfilePath('obj-profile:path', [
				[0, 0],
				[1, 0],
				[1, 0.5],
				[0, 0.5]
			])
		})
	];
	return g1DocumentWithRooms([room], objects);
}

export function g1InvalidGeometryDocument(): LayoutDocumentWallFirst {
	const good = g1RectangleRoom('room-good', 0, 0, 6, 4);
	// A boundary whose edges never share a Junction: the chain cannot close.
	const disconnected = g1RoomEdges('room-disconnected', [
		{ start: [0, 0], end: [6, 0] },
		{ start: [7, 0], end: [7, 4] },
		{ start: [7, 4], end: [0, 4] },
		{ start: [0, 4], end: [0, 0] }
	]);
	// A closed chain whose second edge crosses the first (bow-tie).
	const selfIntersecting = g1RoomEdges('room-self-intersect', [
		{ start: [0, 0], end: [4, 4] },
		{ start: [4, 4], end: [4, 0] },
		{ start: [4, 0], end: [0, 4] },
		{ start: [0, 4], end: [0, 0] }
	]);
	return g1DocumentWithRooms([good, disconnected, selfIntersecting]);
}
