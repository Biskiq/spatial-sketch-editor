import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallCenterline
} from '@portfolio/layout-core';
import owner40Payload from '../../../../../docs/roadmap/p23b-geometry-performance/40-walls.json';

export type P23BSemanticClass = 2 | 3 | 4 | 5;
export type P23BFixtureRole = 'control' | 'timing-target' | 'owner-responsiveness' | 'regression' | 'positive' | 'negative';
export type P23BMatrixSize = '12-wall' | '40-wall';
export type P23BCurvature = 'straight' | 'target-curved' | 'all-curved';

export type P23BMatrixSpec = {
	id: string;
	semanticClass: 5;
	role: 'control' | 'timing-target';
	size: P23BMatrixSize;
	curvature: P23BCurvature;
	rooms: 3 | 10;
	walls: 12 | 40;
	curvedWalls: number;
};

const MATRIX_SIZES = {
	'12-wall': { rooms: 3, walls: 12 },
	'40-wall': { rooms: 10, walls: 40 }
} as const;

export const P23B_MATRIX_SPECS: readonly P23BMatrixSpec[] = (['12-wall', '40-wall'] as const).flatMap((size) =>
	(['straight', 'target-curved', 'all-curved'] as const).map((curvature) => {
		const counts = MATRIX_SIZES[size];
		const curvedWalls = curvature === 'straight' ? 0 : curvature === 'target-curved' ? 1 : counts.walls;
		return {
			id: `p23b-${size}-${curvature}-v1`,
			semanticClass: 5,
			// The two all-curved cells are the bounded timing targets. Straight and
			// single-curved cells are controls that isolate size from curvature.
			role: curvature === 'all-curved' ? 'timing-target' : 'control',
			size,
			curvature,
			rooms: counts.rooms,
			walls: counts.walls,
			curvedWalls
		};
	})
);

export const P23B_OWNER_FIXTURE_ID = 'owner-40-curved-v1';
export const P23B_OWNER_LAYOUT = owner40Payload as unknown as LayoutDocumentWallFirst;

export type P23BCorrectnessCaseId =
	| 'd12-exact-coincidence-v1'
	| 'd12-partial-overlap-v1'
	| 'd12-full-containment-v1'
	| 'N-2'
	| 'N-2i'
	| 'class4-self-intersection-v1'
	| 'class4-zero-length-wall-v1'
	| 'class4-open-room-boundary-v1'
	| 'class4-component-duplicate-junction-v1';

export type P23BCorrectnessSpec = {
	id: P23BCorrectnessCaseId;
	semanticClass: 2 | 3 | 4;
	role: 'regression' | 'positive' | 'negative';
	case: string;
};

export const P23B_CORRECTNESS_SPECS: readonly P23BCorrectnessSpec[] = [
	{ id: 'd12-exact-coincidence-v1', semanticClass: 2, role: 'regression', case: 'independent rooms share coordinates; unrelated identity survives role change' },
	{ id: 'd12-partial-overlap-v1', semanticClass: 2, role: 'regression', case: 'independent rooms partially overlap; unrelated identity survives role change' },
	{ id: 'd12-full-containment-v1', semanticClass: 2, role: 'regression', case: 'one independent room is contained; unrelated identity survives role change' },
	{ id: 'N-2', semanticClass: 3, role: 'positive', case: 'curved crossing between independent Wall/Junction components is admitted' },
	{ id: 'N-2i', semanticClass: 4, role: 'negative', case: 'same-component curved crossing remains rejected' },
	{ id: 'class4-self-intersection-v1', semanticClass: 4, role: 'negative', case: 'one curved Wall self-intersects and is rejected' },
	{ id: 'class4-zero-length-wall-v1', semanticClass: 4, role: 'negative', case: 'coincident endpoint Junctions form an invalid zero-length Wall' },
	{ id: 'class4-open-room-boundary-v1', semanticClass: 4, role: 'negative', case: 'Room references a non-closing boundary and compilation reports the invalid face' },
	{ id: 'class4-component-duplicate-junction-v1', semanticClass: 4, role: 'negative', case: 'coincident Junctions inside one connected component remain rejected' }
];

function curve(start: LayoutVec2, end: LayoutVec2, knot: LayoutVec2, knotId: string): LayoutWallCenterline {
	return wallCubicChain([{ id: knotId, point: knot }], deriveChainSpans([start, knot, end]));
}

function appendRoom(
	document: LayoutDocumentWallFirst,
	roomIndex: number,
	options: { curved: 'none' | 'first' | 'all' }
): void {
	const columnCount = 4;
	const x = (roomIndex % columnCount) * 20;
	const z = Math.floor(roomIndex / columnCount) * 18;
	const vertices: LayoutVec2[] = [[x, z], [x + 12, z], [x + 12, z + 10], [x, z + 10]];
	const junctionIds = vertices.map((_, corner) => `room-${roomIndex}:j${corner}`);
	for (let corner = 0; corner < vertices.length; corner += 1) {
		document.junctions.push({ id: junctionIds[corner]!, point: vertices[corner]! });
	}
	const wallIds: string[] = [];
	for (let edge = 0; edge < vertices.length; edge += 1) {
		const start = vertices[edge]!;
		const end = vertices[(edge + 1) % vertices.length]!;
		const wallId = `room-${roomIndex}:wall-${edge}`;
		wallIds.push(wallId);
		const curved = options.curved === 'all' || (options.curved === 'first' && roomIndex === 0 && edge === 0);
		const midpoint: LayoutVec2 = [
			(start[0] + end[0]) / 2 + (edge === 1 ? 0.35 : edge === 3 ? -0.35 : 0),
			(start[1] + end[1]) / 2 + (edge === 0 ? -0.35 : edge === 2 ? 0.35 : 0)
		];
		document.walls.push({
			id: wallId,
			startJunctionId: junctionIds[edge]!,
			endJunctionId: junctionIds[(edge + 1) % vertices.length]!,
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: curved ? curve(start, end, midpoint, `${wallId}:knot:1`) : { kind: 'line' }
		});
	}
	document.rooms.push({
		id: `room-${roomIndex}`,
		name: `Room ${roomIndex}`,
		boundary: wallIds.map((wallId) => ({ wallId, direction: 'forward' })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	});
}

export function buildP23BMatrixFixture(spec: P23BMatrixSpec): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	for (let roomIndex = 0; roomIndex < spec.rooms; roomIndex += 1) {
		appendRoom(document, roomIndex, {
			curved: spec.curvature === 'straight' ? 'none' : spec.curvature === 'target-curved' ? 'first' : 'all'
		});
	}
	return document;
}

function appendRectangle(
	document: LayoutDocumentWallFirst,
	prefix: string,
	x: number,
	z: number,
	width: number,
	depth: number
): void {
	const points: LayoutVec2[] = [[x, z], [x + width, z], [x + width, z + depth], [x, z + depth]];
	const junctionIds = ['a', 'b', 'c', 'd'].map((suffix) => `${prefix}-${suffix}`);
	for (let index = 0; index < points.length; index += 1) {
		document.junctions.push({ id: junctionIds[index]!, point: points[index]! });
	}
	const wallIds = ['a1', 'b1', 'c1', 'd1'].map((suffix) => `${prefix}-${suffix}`);
	for (let edge = 0; edge < points.length; edge += 1) {
		document.walls.push({
			id: wallIds[edge]!,
			startJunctionId: junctionIds[edge]!,
			endJunctionId: junctionIds[(edge + 1) % points.length]!,
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' }
		});
	}
	document.rooms.push({
		id: `room-${prefix}`,
		name: `Room ${prefix}`,
		boundary: wallIds.map((wallId) => ({ wallId, direction: 'forward' })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	});
}

function buildD12Fixture(kind: 'exact' | 'partial' | 'containment'): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	appendRectangle(document, 'k', 0, 0, 6, 4);
	appendRectangle(
		document,
		'c',
		kind === 'exact' ? 0 : kind === 'partial' ? 3 : 1,
		kind === 'containment' ? 1 : 0,
		kind === 'containment' ? 4 : 6,
		kind === 'containment' ? 2 : 4
	);
	document.openings.push({
		id: 'opening:k:door:1', wallId: 'k-a1', kind: 'door', offset: 1, width: 0.9,
		height: 2.1, sillHeight: 0, profile: 'rectangular'
	});
	document.objects.push({
		id: 'obj-k', kind: 'box', position: [3, 0.5, 2], rotation: [0, 0, 0], dimensions: [1, 1, 1], roomId: 'room-k'
	});
	return document;
}

function buildN2Fixture(sameComponent: boolean): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	if (sameComponent) {
		document.junctions.push(
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-m', point: [6, 0] },
			{ id: 'j-b', point: [6, 4] }
		);
		document.walls.push(
			{ id: 'wall-straight', startJunctionId: 'j-a', endJunctionId: 'j-m', role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'wall-curved', startJunctionId: 'j-m', endJunctionId: 'j-b', role: 'partition', thickness: 0.2, height: 3, centerline: curve([6, 0], [6, 4], [1, -2], 'wall-curved:knot:1') }
		);
		return document;
	}
	document.junctions.push(
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [8, 0] },
		{ id: 'j-c', point: [0, 4] },
		{ id: 'j-d', point: [8, 4] }
	);
	document.walls.push(
		{ id: 'wall-straight', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
		{ id: 'wall-curved', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'partition', thickness: 0.2, height: 3, centerline: curve([0, 4], [8, 4], [4, -4], 'wall-curved:knot:1') }
	);
	return document;
}

function buildSelfIntersectionFixture(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions.push({ id: 'j-a', point: [0, 0] }, { id: 'j-b', point: [1, 0] });
	document.walls.push({
		id: 'wall-self-crossing', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'partition',
		thickness: 0.2, height: 3, centerline: curve([0, 0], [1, 0], [5, 0], 'wall-self-crossing:knot:1')
	});
	return document;
}

function buildZeroLengthFixture(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions.push({ id: 'j-a', point: [0, 0] }, { id: 'j-b', point: [0, 0] });
	document.walls.push({
		id: 'wall-zero-length', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'partition',
		thickness: 0.2, height: 3, centerline: { kind: 'line' }
	});
	return document;
}

function buildOpenRoomBoundaryFixture(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	const points: LayoutVec2[] = [[0, 0], [6, 0], [6, 4], [0, 4]];
	for (let index = 0; index < points.length; index += 1) document.junctions.push({ id: `j-${index}`, point: points[index]! });
	const wallIds = ['wall-0', 'wall-1', 'wall-2'];
	for (let edge = 0; edge < wallIds.length; edge += 1) {
		document.walls.push({
			id: wallIds[edge]!, startJunctionId: `j-${edge}`, endJunctionId: `j-${edge + 1}`,
			role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' }
		});
	}
	document.rooms.push({
		id: 'room-open', name: 'Open Room', boundary: wallIds.map((wallId) => ({ wallId, direction: 'forward' })),
		floorThickness: 0.1, ceilingThickness: 0.1
	});
	return document;
}

function buildComponentDuplicateJunctionFixture(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions.push(
		{ id: 'p-a', point: [0, 0] }, { id: 'p-b', point: [6, 0] },
		{ id: 'p-c', point: [6, 4] }, { id: 'p-d', point: [0, 4] },
		{ id: 'p-dup', point: [6, 0] }
	);
	const boundaryWalls = [
		['p-a1', 'p-a', 'p-b'], ['p-b1', 'p-b', 'p-c'],
		['p-c1', 'p-c', 'p-d'], ['p-d1', 'p-d', 'p-a']
	] as const;
	for (const [id, startJunctionId, endJunctionId] of boundaryWalls) {
		document.walls.push({ id, startJunctionId, endJunctionId, role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } });
	}
	document.walls.push({
		id: 'p-fold', startJunctionId: 'p-a', endJunctionId: 'p-dup', role: 'partition',
		thickness: 0.2, height: 3, centerline: { kind: 'line' }
	});
	document.rooms.push({
		id: 'room-p', name: 'Room p', boundary: boundaryWalls.map(([wallId]) => ({ wallId, direction: 'forward' })),
		floorThickness: 0.1, ceilingThickness: 0.1
	});
	return document;
}

export function buildP23BCorrectnessFixture(spec: P23BCorrectnessSpec): LayoutDocumentWallFirst {
	switch (spec.id) {
		case 'd12-exact-coincidence-v1': return buildD12Fixture('exact');
		case 'd12-partial-overlap-v1': return buildD12Fixture('partial');
		case 'd12-full-containment-v1': return buildD12Fixture('containment');
		case 'N-2': return buildN2Fixture(false);
		case 'N-2i': return buildN2Fixture(true);
		case 'class4-self-intersection-v1': return buildSelfIntersectionFixture();
		case 'class4-zero-length-wall-v1': return buildZeroLengthFixture();
		case 'class4-open-room-boundary-v1': return buildOpenRoomBoundaryFixture();
		case 'class4-component-duplicate-junction-v1': return buildComponentDuplicateJunctionFixture();
		default: return assertNever(spec.id);
	}
}

export function p23bMatrixFixtureById(id: string): P23BMatrixSpec | undefined {
	return P23B_MATRIX_SPECS.find((spec) => spec.id === id);
}

export function p23bCorrectnessFixtureById(id: string): P23BCorrectnessSpec | undefined {
	return P23B_CORRECTNESS_SPECS.find((spec) => spec.id === id);
}

function assertNever(value: never): never {
	throw new Error(`Unknown P23B fixture: ${JSON.stringify(value)}`);
}
