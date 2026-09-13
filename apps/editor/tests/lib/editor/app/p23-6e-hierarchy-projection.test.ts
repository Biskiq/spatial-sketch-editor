import { describe, expect, it } from 'vitest';
import type { MaterialId, SceneDocument } from '$lib/content/scene';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst
} from '$lib/layout/layout-wall-first-types';
import type { LayoutDocument } from '$lib/layout/layout-types';
import type { ActiveEditorSelection } from '$lib/editor/app/active-editor-selection.svelte';
import {
	buildHierarchySourceIndex,
	hierarchyEntityKeyEquals,
	junctionEntityKey,
	layoutObjectEntityKey,
	openingEntityKey,
	roomEntityKey,
	sceneClusterEntityKey,
	sceneEntityKey,
	wallEntityKey,
	type HierarchyEntityKey,
	type HierarchySourceIndex
} from '$lib/editor/hierarchy/hierarchy-source-index';
import {
	buildHierarchyPageProjection,
	boundaryJunctionIds,
	canonicalHierarchyHome,
	explainHierarchyExclusion,
	findHierarchyRepresentation,
	isHierarchyRowSelectable,
	layoutSelectionToHierarchyEntity,
	activeSelectionToHierarchyEntity,
	WALL_FILTER_LABELS,
	WALL_FILTER_PREDICATES,
	OPENING_FILTER_LABELS,
	type HierarchyPage,
	type HierarchyPageOptions,
	type HierarchyPageProjection,
	type HierarchyProjectedRow
} from '$lib/editor/hierarchy/hierarchy-page-projection';
import {
	buildHierarchySearchProjection,
	hierarchySearchMatches,
	normalizeHierarchyQuery
} from '$lib/editor/hierarchy/hierarchy-search';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = fileURLToPath(new URL('../../../../src/lib', import.meta.url));

function readLibSource(relativePath: string): string {
	return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

/**
 * Slice-1 fixture (P23.6e plan §Manual browser scenario, scaled down to pure
 * projection coverage): Gallery A/B/C where `w2` bounds all three Rooms, Doors
 * and Windows, partitions that bound no Room, assigned and unassigned Layout
 * Objects, boundary and non-boundary Junctions, and clustered/standalone Scene
 * entities.
 */
function fixtureLayout(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j1', point: [0, 0] },
			{ id: 'j2', point: [5, 0] },
			{ id: 'j3', point: [5, 4] },
			{ id: 'j4', point: [0, 4] },
			{ id: 'j5', point: [10, 0] },
			{ id: 'j6', point: [10, 4] },
			{ id: 'j7', point: [15, 4] },
			{ id: 'j8', point: [15, 8] },
			{ id: 'j9', point: [5, 8] },
			{ id: 'j10', point: [1, 1] },
			{ id: 'j11', point: [2, 1] },
			{ id: 'j12', point: [3, 1] }
		],
		walls: [
			{ id: 'w1', startJunctionId: 'j1', endJunctionId: 'j2', role: 'boundary', thickness: 0.15, height: 2.8 },
			// Shared by Gallery A, B and C.
			{ id: 'w2', startJunctionId: 'j2', endJunctionId: 'j3', role: 'boundary', thickness: 0.15, height: 3.4 },
			{ id: 'w3', startJunctionId: 'j3', endJunctionId: 'j4', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w4', startJunctionId: 'j4', endJunctionId: 'j1', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w5', startJunctionId: 'j3', endJunctionId: 'j6', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w6', startJunctionId: 'j6', endJunctionId: 'j5', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w7', startJunctionId: 'j5', endJunctionId: 'j2', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w8', startJunctionId: 'j3', endJunctionId: 'j7', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w9', startJunctionId: 'j7', endJunctionId: 'j8', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w10', startJunctionId: 'j8', endJunctionId: 'j9', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w11', startJunctionId: 'j9', endJunctionId: 'j3', role: 'boundary', thickness: 0.15, height: 2.8 },
			// Partitions: bound no Room; w12 hosts a door.
			{ id: 'w12', startJunctionId: 'j10', endJunctionId: 'j11', role: 'partition', thickness: 0.1, height: 2.2 },
			{ id: 'w13', startJunctionId: 'j11', endJunctionId: 'j12', role: 'partition', thickness: 0.1, height: 2.2 }
		],
		rooms: [
			{
				id: 'room-a',
				name: 'Gallery A',
				boundary: [
					{ wallId: 'w1', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			{
				id: 'room-b',
				name: 'Gallery B',
				// w2 is traversed against its canonical orientation here.
				boundary: [
					{ wallId: 'w2', direction: 'reverse' },
					{ wallId: 'w5', direction: 'forward' },
					{ wallId: 'w6', direction: 'forward' },
					{ wallId: 'w7', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			{
				id: 'room-c',
				name: 'Gallery C',
				boundary: [
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w8', direction: 'forward' },
					{ wallId: 'w9', direction: 'forward' },
					{ wallId: 'w10', direction: 'forward' },
					{ wallId: 'w11', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [
			{ id: 'op-door-1', wallId: 'w1', kind: 'door', offset: 1, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' },
			{ id: 'op-win-2', wallId: 'w2', kind: 'window', offset: 0.5, width: 0.9, height: 1.2, sillHeight: 0.9, profile: 'rectangular' },
			{ id: 'op-door-3', wallId: 'w12', kind: 'door', offset: 0.3, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' }
		],
		objects: [
			{ id: 'object-1', kind: 'box', position: [1, 0, 1], rotation: [0, 0, 0], dimensions: [1, 1, 1], roomId: 'room-a' },
			{ id: 'object-2', kind: 'sphere', position: [2, 0, 2], rotation: [0, 0, 0], dimensions: [1, 1, 1], roomId: 'room-c' },
			// Deliberately unassigned.
			{ id: 'object-3', kind: 'cylinder', position: [3, 0, 3], rotation: [0, 0, 0], dimensions: [1, 1, 1] }
		]
	};
}

function sceneEntity(id: string, name: string, roomId: string) {
	return {
		kind: 'primitive' as const,
		primitive: 'box' as const,
		id,
		name,
		roomId,
		position: [0, 0, 0] as [number, number, number],
		rotation: [0, 0, 0] as [number, number, number],
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm' as MaterialId,
		castShadow: true,
		receiveShadow: true
	};
}

function fixtureScene(): SceneDocument {
	return {
		textures: [],
		materials: [],
		entities: [
			sceneEntity('entity-a1', 'Sculpture A', 'room-a'),
			sceneEntity('entity-b1', 'Grand Piano', 'room-b'),
			sceneEntity('entity-standalone', 'Bench', 'room-a')
		],
		clusters: [
			{ id: 'cluster-1', name: 'Statue Group', roomId: 'room-a', memberIds: ['entity-a1'] },
			{ id: 'cluster-empty', name: 'Empty Case', roomId: 'room-a', memberIds: [] }
		],
		navigationNodes: [],
		connections: []
	};
}

function legacyLayout(): LayoutDocument {
	return {
		units: 'meters',
		floors: [
			{
				id: 'floor-1',
				name: 'Floor 1',
				elevation: 0,
				height: 3,
				rooms: [
					{
						id: 'room-legacy',
						name: 'Atrium',
						frame: { origin: [0, 0], yaw: 0 },
						boundary: {
							closed: true,
							segments: [{ id: 'wall-a', kind: 'line', start: [0, 0], end: [4, 0] }]
						},
						wallThickness: 0.2,
						floorThickness: 0.1,
						ceilingThickness: 0.1,
						openings: []
					}
				]
			}
		],
		objects: [{ id: 'object-legacy', kind: 'box', position: [1, 0, 1], rotation: [0, 0, 0], dimensions: [1, 1, 1] }]
	};
}

function fixtureIndex(): HierarchySourceIndex {
	return buildHierarchySourceIndex({ layout: fixtureLayout(), scene: fixtureScene() });
}

function project(
	page: HierarchyPage,
	options?: HierarchyPageOptions,
	index: HierarchySourceIndex = fixtureIndex()
): HierarchyPageProjection {
	return buildHierarchyPageProjection(index, page, options);
}

function walk(rows: readonly HierarchyProjectedRow[]): HierarchyProjectedRow[] {
	const out: HierarchyProjectedRow[] = [];
	const visit = (row: HierarchyProjectedRow) => {
		out.push(row);
		for (const child of row.children ?? []) visit(child);
	};
	for (const row of rows) visit(row);
	return out;
}

function rowByKey(rows: readonly HierarchyProjectedRow[], rowKey: string): HierarchyProjectedRow {
	const row = walk(rows).find((candidate) => candidate.rowKey === rowKey);
	expect(row, `missing row ${rowKey}`).toBeDefined();
	return row!;
}

function indexSnapshot(index: HierarchySourceIndex): string {
	return JSON.stringify({
		format: index.format,
		rooms: index.orderedRooms,
		walls: index.orderedWalls,
		openings: index.orderedOpenings,
		junctions: index.orderedJunctions,
		objects: index.orderedLayoutObjects,
		clusters: index.orderedSceneClusters,
		entities: index.orderedSceneEntities,
		openingsByWallId: [...index.openingsByWallId],
		roomIdsByWallId: [...index.roomIdsByWallId],
		incidentWallIdsByJunctionId: [...index.incidentWallIdsByJunctionId],
		boundaryRoomIdsByJunctionId: [...index.boundaryRoomIdsByJunctionId],
		assignedObjectIdsByRoomId: [...index.assignedObjectIdsByRoomId],
		clusterByMemberId: [...index.clusterByMemberId]
	});
}

describe('P23.6e slice 1 — source index relationships', () => {
	it('indexes every canonical collection in authoritative document order', () => {
		const index = fixtureIndex();
		expect(index.format).toBe('wall-first');
		expect(index.orderedRooms.map((room) => room.roomId)).toEqual(['room-a', 'room-b', 'room-c']);
		expect(index.orderedWalls.map((wall) => wall.wallId)).toEqual([
			'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11', 'w12', 'w13'
		]);
		expect(index.orderedOpenings.map((opening) => opening.openingId)).toEqual([
			'op-door-1', 'op-win-2', 'op-door-3'
		]);
		expect(index.orderedJunctions.map((junction) => junction.junctionId)).toEqual([
			'j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8', 'j9', 'j10', 'j11', 'j12'
		]);
		expect(index.orderedLayoutObjects.map((object) => object.objectId)).toEqual([
			'object-1', 'object-2', 'object-3'
		]);
		expect(index.orderedSceneClusters.map((cluster) => cluster.clusterId)).toEqual([
			'cluster-1', 'cluster-empty'
		]);
		expect(index.orderedSceneEntities.map((entity) => entity.entityId)).toEqual([
			'entity-a1', 'entity-b1', 'entity-standalone'
		]);
	});

	it('preserves Room boundary order and direction, and drops dangling refs only', () => {
		const index = fixtureIndex();
		const roomB = index.roomById.get('room-b')!;
		expect(roomB.boundary).toEqual([
			{ wallId: 'w2', direction: 'reverse' },
			{ wallId: 'w5', direction: 'forward' },
			{ wallId: 'w6', direction: 'forward' },
			{ wallId: 'w7', direction: 'forward' }
		]);

		const layout = fixtureLayout();
		layout.rooms[0]!.boundary.push({ wallId: 'w-missing', direction: 'forward' });
		const withDangling = buildHierarchySourceIndex({ layout, scene: fixtureScene() });
		expect(withDangling.roomById.get('room-a')!.boundary.map((ref) => ref.wallId)).toEqual([
			'w1', 'w2', 'w3', 'w4'
		]);
	});

	it('derives Wall → Rooms as the inverse of explicit boundary refs (shared Wall once)', () => {
		const index = fixtureIndex();
		expect(index.roomIdsByWallId.get('w2')).toEqual(['room-a', 'room-b', 'room-c']);
		expect(index.roomIdsByWallId.get('w1')).toEqual(['room-a']);
		// Partitions bound no Room.
		expect(index.roomIdsByWallId.get('w12')).toBeUndefined();
	});

	it('nests each Opening under its single host Wall', () => {
		const index = fixtureIndex();
		expect(index.openingsByWallId.get('w1')).toEqual(['op-door-1']);
		expect(index.openingsByWallId.get('w2')).toEqual(['op-win-2']);
		expect(index.openingsByWallId.get('w12')).toEqual(['op-door-3']);
		expect(index.openingsByWallId.get('w3')).toBeUndefined();
		expect(index.openingById.get('op-win-2')!.wallId).toBe('w2');
	});

	it('derives Junction → incident Walls in Wall document order', () => {
		const index = fixtureIndex();
		expect(index.incidentWallIdsByJunctionId.get('j1')).toEqual(['w1', 'w4']);
		expect(index.incidentWallIdsByJunctionId.get('j3')).toEqual(['w2', 'w3', 'w5', 'w8', 'w11']);
		expect(index.incidentWallIdsByJunctionId.get('j11')).toEqual(['w12', 'w13']);
		expect(index.incidentWallIdsByJunctionId.get('j12')).toEqual(['w13']);
	});

	it('derives Junction → boundary Rooms strictly from explicit boundary Wall refs', () => {
		const index = fixtureIndex();
		expect(index.boundaryRoomIdsByJunctionId.get('j1')).toEqual(['room-a']);
		expect(index.boundaryRoomIdsByJunctionId.get('j2')).toEqual(['room-a', 'room-b', 'room-c']);
		expect(index.boundaryRoomIdsByJunctionId.get('j3')).toEqual(['room-a', 'room-b', 'room-c']);
		expect(index.boundaryRoomIdsByJunctionId.get('j5')).toEqual(['room-b']);
		expect(index.boundaryRoomIdsByJunctionId.get('j7')).toEqual(['room-c']);
		// Partition endpoints meet no Room boundary.
		expect(index.boundaryRoomIdsByJunctionId.get('j10') ?? []).toEqual([]);
		expect(index.boundaryRoomIdsByJunctionId.get('j11') ?? []).toEqual([]);
	});

	it('maps Room → Layout Objects by explicit roomId only (zero included)', () => {
		const index = fixtureIndex();
		expect(index.assignedObjectIdsByRoomId.get('room-a')).toEqual(['object-1']);
		expect(index.assignedObjectIdsByRoomId.get('room-c')).toEqual(['object-2']);
		expect(index.assignedObjectIdsByRoomId.get('room-b') ?? []).toEqual([]);
		// object-3 is unassigned: it belongs to no Room page.
		for (const ids of index.assignedObjectIdsByRoomId.values()) {
			expect(ids).not.toContain('object-3');
		}
	});

	it('resolves cluster membership and leaves unclustered entities standalone', () => {
		const index = fixtureIndex();
		expect(index.clusterByMemberId.get('entity-a1')).toBe('cluster-1');
		expect(index.clusterByMemberId.has('entity-b1')).toBe(false);
		expect(index.clusterByMemberId.has('entity-standalone')).toBe(false);
	});

	it('keeps a legacy document out of the canonical collections but indexes shared content', () => {
		const index = buildHierarchySourceIndex({ layout: legacyLayout(), scene: fixtureScene() });
		expect(index.format).toBe('legacy');
		expect(index.orderedRooms).toEqual([]);
		expect(index.orderedWalls).toEqual([]);
		expect(index.orderedOpenings).toEqual([]);
		expect(index.orderedJunctions).toEqual([]);
		expect(index.orderedLayoutObjects.map((object) => object.objectId)).toEqual(['object-legacy']);
		expect(index.orderedSceneEntities.map((entity) => entity.entityId)).toEqual([
			'entity-a1', 'entity-b1', 'entity-standalone'
		]);
	});

	it('is pure and repeatable: inputs untouched, repeated builds deep-equal', () => {
		const layout = fixtureLayout();
		const scene = fixtureScene();
		const before = JSON.stringify({ layout, scene });
		const first = buildHierarchySourceIndex({ layout, scene });
		const second = buildHierarchySourceIndex({ layout, scene });
		expect(indexSnapshot(second)).toBe(indexSnapshot(first));
		expect(JSON.stringify({ layout, scene })).toBe(before);
		// Copied relation data is not aliased back into the input.
		expect(first.roomById.get('room-a')!.boundary[0]).not.toBe(layout.rooms[0]!.boundary[0]);
	});
});

describe('P23.6e slice 1 — entity keys', () => {
	it('carries the owner so layout and scene identities cannot collide', () => {
		expect(roomEntityKey('x').id).toBe('layout:room:x');
		expect(wallEntityKey('x').id).toBe('layout:wall:x');
		expect(junctionEntityKey('x').id).toBe('layout:junction:x');
		expect(layoutObjectEntityKey('x').id).toBe('layout:object:x');
		expect(sceneClusterEntityKey('x').id).toBe('scene:cluster:x');
		expect(sceneEntityKey('x').id).toBe('scene:entity:x');
		expect(layoutObjectEntityKey('x').id).not.toBe(sceneEntityKey('x').id);
	});

	it('percent-encodes segments so IDs containing separators cannot forge a key', () => {
		// Canonical allocators really produce ids such as `opening:door:1`.
		expect(openingEntityKey('wall:1', 'opening:door:1').id).toBe(
			'layout:opening:wall%3A1:opening%3Adoor%3A1'
		);
		expect(openingEntityKey('w', 'a:b').id).not.toBe(openingEntityKey('w:a', 'b').id);
	});

	it('compares by canonical id', () => {
		expect(hierarchyEntityKeyEquals(wallEntityKey('w2'), wallEntityKey('w2'))).toBe(true);
		expect(hierarchyEntityKeyEquals(wallEntityKey('w2'), wallEntityKey('w3'))).toBe(false);
	});
});

describe('P23.6e slice 1 — root page', () => {
	it('lists direct destinations under presentational eyebrow headings', () => {
		const projection = project({ kind: 'root' });
		expect(projection.rows.map((row) => row.rowKey)).toEqual([
			'root:rooms',
			'root:heading:architecture',
			'root:walls',
			'root:openings',
			'root:junctions',
			'root:heading:placed-content',
			'root:layoutObjects',
			'root:sceneContent'
		]);
		const headings = projection.rows.filter((row) => row.kind === 'heading');
		expect(headings.map((row) => row.label)).toEqual(['ARCHITECTURE', 'PLACED CONTENT']);
		for (const heading of headings) {
			expect(heading.destination).toBeUndefined();
			expect(heading.entity).toBeUndefined();
		}
	});

	it('counts every destination from authoritative arrays', () => {
		const counts = Object.fromEntries(
			project({ kind: 'root' }).rows
				.filter((row) => row.kind === 'destination')
				.map((row) => [row.rowKey, row.count])
		);
		expect(counts).toEqual({
			'root:rooms': 3,
			'root:walls': 13,
			'root:openings': 3,
			'root:junctions': 12,
			'root:layoutObjects': 3,
			'root:sceneContent': 3
		});
	});

	it('counts Scene Content by canonical entities: clusters add zero even when empty', () => {
		const scene = fixtureScene();
		const entities = scene.entities.length;
		const clusterMembers = (scene.clusters ?? []).flatMap((cluster) => cluster.memberIds).length;
		const index = buildHierarchySourceIndex({ layout: fixtureLayout(), scene });
		const root = buildHierarchyPageProjection(index, { kind: 'root' });
		expect(root.rows.find((row) => row.rowKey === 'root:sceneContent')!.count).toBe(entities);
		// Three entities and one clustered member: no double count, no inflation.
		expect(entities).toBe(3);
		expect(clusterMembers).toBe(1);
	});

	it('routes each destination row to its page and is navigation-only', () => {
		const projection = project({ kind: 'root' });
		for (const row of projection.rows.filter((candidate) => candidate.kind === 'destination')) {
			expect(row.destination?.reveal).toBeNull();
			expect(isHierarchyRowSelectable(row)).toBe(false);
		}
		expect(projection.representations.size).toBe(0);
		expect(projection.unfilteredRepresentations.size).toBe(0);
	});
});

describe('P23.6e slice 1 — Rooms page', () => {
	it('separates Room selection from the explicit Open action', () => {
		const projection = project({ kind: 'rooms' });
		expect(projection.rows.map((row) => row.rowKey)).toEqual([
			'rooms:room:room-a',
			'rooms:room:room-b',
			'rooms:room:room-c'
		]);
		const roomB = rowByKey(projection.rows, 'rooms:room:room-b');
		expect(roomB.label).toBe('Gallery B');
		expect(roomB.canonicalId).toBe('room-b');
		expect(roomB.entity).toEqual(roomEntityKey('room-b'));
		expect(isHierarchyRowSelectable(roomB)).toBe(true);
		expect(roomB.actions).toEqual([
			{
				actionKey: 'rooms:open:room-b',
				label: 'Open Gallery B ›',
				// Ordinary entry: no reveal, no selection, no history push.
				destination: { page: { kind: 'room', roomId: 'room-b' }, reveal: null }
			}
		]);
		expect(roomB.destination).toBeUndefined();
	});

	it('represents exactly the listed Rooms with the row (never the action) as primary', () => {
		const projection = project({ kind: 'rooms' });
		expect([...projection.representations.keys()].sort()).toEqual([
			roomEntityKey('room-a').id,
			roomEntityKey('room-b').id,
			roomEntityKey('room-c').id
		]);
		const representation = findHierarchyRepresentation(projection, roomEntityKey('room-a'));
		expect(representation).toEqual({
			rowKey: 'rooms:room:room-a',
			entity: roomEntityKey('room-a'),
			ancestorDisclosureKeys: [],
			primary: true
		});
	});
});

describe('P23.6e slice 1 — Room page', () => {
	it('resolves the boundary in authoritative order, with the same single Wall identity', () => {
		const projection = project({ kind: 'room', roomId: 'room-a' });
		const boundary = rowByKey(projection.rows, 'room:room-a:section:boundary');
		expect(boundary.label).toBe('Boundary (4 walls)');
		expect(boundary.defaultOpen).toBe(true);
		expect(boundary.children!.map((row) => row.rowKey)).toEqual([
			'room:room-a:wall:w1',
			'room:room-a:wall:w2',
			'room:room-a:wall:w3',
			'room:room-a:wall:w4'
		]);
		expect(boundary.children!.map((row) => row.label)).toEqual(['W1', 'W2', 'W3', 'W4']);
		expect(boundary.children!.map((row) => row.canonicalId)).toEqual(['w1', 'w2', 'w3', 'w4']);
		// Identity is the canonical document-global Wall, not a Room-owned copy.
		expect(boundary.children![1]!.entity).toEqual(wallEntityKey('w2'));
	});

	it('names other participating Rooms on a shared Wall, bounded to two names plus +n', () => {
		const projection = project({ kind: 'room', roomId: 'room-a' });
		expect(rowByKey(projection.rows, 'room:room-a:wall:w2').secondary).toBe(
			'also in Gallery B, Gallery C'
		);
		expect(rowByKey(projection.rows, 'room:room-a:wall:w1').secondary).toBeUndefined();

		// `+n` bound: a fourth participating Room keeps the row metadata calm.
		const layout = fixtureLayout();
		layout.rooms.push({
			id: 'room-d',
			name: 'Gallery D',
			boundary: [{ wallId: 'w2', direction: 'forward' }],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		});
		const withFourth = buildHierarchyPageProjection(
			buildHierarchySourceIndex({ layout, scene: fixtureScene() }),
			{ kind: 'room', roomId: 'room-a' }
		);
		expect(rowByKey(withFourth.rows, 'room:room-a:wall:w2').secondary).toBe(
			'also in Gallery B, Gallery C, +1'
		);
	});

	it('nests hosted Openings under their Wall and ends with one oriented relation row', () => {
		const projection = project({ kind: 'room', roomId: 'room-a' });
		const w1 = rowByKey(projection.rows, 'room:room-a:wall:w1');
		expect(w1.children!.map((row) => row.rowKey)).toEqual([
			'room:room-a:wall:w1:opening:op-door-1',
			'room:room-a:wall:w1:ends'
		]);
		expect(rowByKey(projection.rows, 'room:room-a:wall:w1:opening:op-door-1').secondary).toBe('Door');
		expect(rowByKey(projection.rows, 'room:room-a:wall:w1:ends').label).toBe('Ends J1 · J2');
		expect(rowByKey(projection.rows, 'room:room-a:wall:w1:ends').kind).toBe('relation');
		expect(isHierarchyRowSelectable(rowByKey(projection.rows, 'room:room-a:wall:w1:ends'))).toBe(
			false
		);
	});

	it('uses the boundary ref direction for the oriented Ends row', () => {
		const reversed = project({ kind: 'room', roomId: 'room-b' });
		expect(rowByKey(reversed.rows, 'room:room-b:wall:w2:ends').label).toBe('Ends J3 · J2');
		const forward = project({ kind: 'room', roomId: 'room-a' });
		expect(rowByKey(forward.rows, 'room:room-a:wall:w2:ends').label).toBe('Ends J2 · J3');
	});

	it('derives Boundary Junctions from oriented boundary starts, in first-encounter order', () => {
		const projection = project({ kind: 'room', roomId: 'room-a' });
		const junctions = rowByKey(projection.rows, 'room:room-a:section:junctions');
		expect(junctions.label).toBe('Boundary Junctions (4)');
		expect(junctions.defaultOpen).toBe(false);
		expect(junctions.children!.map((row) => row.rowKey)).toEqual([
			'room:room-a:junction:j1',
			'room:room-a:junction:j2',
			'room:room-a:junction:j3',
			'room:room-a:junction:j4'
		]);
		// Malformed intermediate projection stays renderable and deterministic.
		expect(boundaryJunctionIds(fixtureIndex(), fixtureLayout().rooms[1]!.boundary)).toEqual([
			'j3', 'j6', 'j5', 'j2'
		]);
	});

	it('always carries Assigned Layout Objects with the pinned tooltip, including (0)', () => {
		const roomA = project({ kind: 'room', roomId: 'room-a' });
		const objectsA = rowByKey(roomA.rows, 'room:room-a:section:objects');
		expect(objectsA.label).toBe('Assigned Layout Objects (1)');
		expect(objectsA.tooltip).toBe('Layout Objects explicitly assigned to Gallery A.');
		expect(objectsA.children!.map((row) => row.rowKey)).toEqual([
			'room:room-a:object:object-1'
		]);

		const roomB = project({ kind: 'room', roomId: 'room-b' });
		const objectsB = rowByKey(roomB.rows, 'room:room-b:section:objects');
		expect(objectsB.label).toBe('Assigned Layout Objects (0)');
		expect(objectsB.children).toEqual([]);
		expect(objectsB.tooltip).toBe('Layout Objects explicitly assigned to Gallery B.');
	});

	it('never infers Room ownership for unassigned objects or Scene content', () => {
		const roomA = project({ kind: 'room', roomId: 'room-a' });
		const keys = walk(roomA.rows).map((row) => row.rowKey);
		expect(keys).not.toContain('room:room-a:object:object-3');
		expect(keys.some((key) => key.includes('scene:'))).toBe(false);
		// The unassigned object exists only on its own page.
		expect(
			project({ kind: 'layoutObjects' }).rows.map((row) => row.rowKey)
		).toContain('layoutObjects:object:object-3');
	});

	it('represents the Room title and nested entities with exact ancestor disclosures', () => {
		const projection = project({ kind: 'room', roomId: 'room-a' });
		expect(findHierarchyRepresentation(projection, roomEntityKey('room-a'))).toEqual({
			rowKey: 'room:room-a:title',
			entity: roomEntityKey('room-a'),
			ancestorDisclosureKeys: [],
			primary: true
		});
		expect(
			findHierarchyRepresentation(projection, openingEntityKey('w1', 'op-door-1'))!
				.ancestorDisclosureKeys
		).toEqual(['room:room-a:section:boundary', 'room:room-a:wall:w1']);
		expect(findHierarchyRepresentation(projection, junctionEntityKey('j2'))).toEqual({
			rowKey: 'room:room-a:junction:j2',
			entity: junctionEntityKey('j2'),
			ancestorDisclosureKeys: ['room:room-a:section:junctions'],
			primary: true
		});
		expect(findHierarchyRepresentation(projection, layoutObjectEntityKey('object-1'))).toEqual({
			rowKey: 'room:room-a:object:object-1',
			entity: layoutObjectEntityKey('object-1'),
			ancestorDisclosureKeys: ['room:room-a:section:objects'],
			primary: true
		});
	});

	it('projects an empty page for a missing Room without inventing rows', () => {
		const projection = project({ kind: 'room', roomId: 'room-missing' });
		expect(projection.rows).toEqual([]);
		expect(projection.representations.size).toBe(0);
	});
});

describe('P23.6e slice 1 — Walls page and facets', () => {
	it('lists every Wall in document order with only useful resting metadata', () => {
		const projection = project({ kind: 'walls' });
		expect(projection.rows.map((row) => row.rowKey)).toEqual(
			['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11', 'w12', 'w13'].map(
				(wallId) => `walls:wall:${wallId}`
			)
		);
		expect(rowByKey(projection.rows, 'walls:wall:w1').secondary).toBe('▸ 1 opening');
		expect(rowByKey(projection.rows, 'walls:wall:w12').secondary).toBe('▸ 1 opening');
		expect(rowByKey(projection.rows, 'walls:wall:w3').secondary).toBeUndefined();
		expect(rowByKey(projection.rows, 'walls:wall:w2').facet).toBe('boundary');
		expect(rowByKey(projection.rows, 'walls:wall:w12').facet).toBe('partition');
	});

	it('nests each Opening under its host Wall and represents it there', () => {
		const projection = project({ kind: 'walls' });
		expect(rowByKey(projection.rows, 'walls:wall:w2').children!.map((row) => row.rowKey)).toEqual([
			'walls:wall:w2:opening:op-win-2'
		]);
		expect(findHierarchyRepresentation(projection, openingEntityKey('w2', 'op-win-2'))).toEqual({
			rowKey: 'walls:wall:w2:opening:op-win-2',
			entity: openingEntityKey('w2', 'op-win-2'),
			ancestorDisclosureKeys: ['walls:wall:w2'],
			primary: true
		});
		// Junctions have no representation on this page.
		expect(projection.representations.has(junctionEntityKey('j1').id)).toBe(false);
	});

	it('partitions by the pure Wall facet predicates', () => {
		expect(WALL_FILTER_PREDICATES['multiple-rooms']({ roomIds: ['a', 'b'], openingIds: [] })).toBe(
			true
		);
		expect(WALL_FILTER_PREDICATES['one-room']({ roomIds: ['a'], openingIds: [] })).toBe(true);
		expect(WALL_FILTER_PREDICATES['no-room']({ roomIds: [], openingIds: ['op'] })).toBe(true);
		expect(WALL_FILTER_PREDICATES['with-openings']({ roomIds: [], openingIds: ['op'] })).toBe(true);
		expect(WALL_FILTER_PREDICATES['all']({ roomIds: [], openingIds: [] })).toBe(true);

		const rowsFor = (wallFilter: HierarchyPageOptions['wallFilter']) =>
			project({ kind: 'walls' }, { wallFilter }).rows.map((row) => row.canonicalId);
		expect(rowsFor('multiple-rooms')).toEqual(['w2']);
		expect(rowsFor('one-room')).toEqual(['w1', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11']);
		expect(rowsFor('no-room')).toEqual(['w12', 'w13']);
		expect(rowsFor('with-openings')).toEqual(['w1', 'w2', 'w12']);
	});

	it('spells out room participation only under the multiple-Room facet', () => {
		const multiple = project({ kind: 'walls' }, { wallFilter: 'multiple-rooms' });
		expect(rowByKey(multiple.rows, 'walls:wall:w2').secondary).toBe(
			'in Gallery A, Gallery B, +1 · ▸ 1 opening'
		);
		const all = project({ kind: 'walls' });
		expect(rowByKey(all.rows, 'walls:wall:w2').secondary).not.toContain('in Gallery');
	});

	it('reports filtered-out entities as represented at the calm filters', () => {
		const projection = project({ kind: 'walls' }, { wallFilter: 'with-openings' });
		expect(projection.representations.has(wallEntityKey('w8').id)).toBe(false);
		expect(projection.unfilteredRepresentations.has(wallEntityKey('w8').id)).toBe(true);
		expect(projection.unfilteredRepresentations.has(roomEntityKey('room-a').id)).toBe(false);
	});

	it('exposes the pinned facet labels', () => {
		expect(WALL_FILTER_LABELS).toEqual({
			all: 'All Walls',
			'multiple-rooms': 'In multiple rooms',
			'one-room': 'In one room',
			'no-room': 'No room participation',
			'with-openings': 'With openings'
		});
		expect(OPENING_FILTER_LABELS).toEqual({
			all: 'All Openings',
			door: 'Doors',
			window: 'Windows'
		});
	});
});

describe('P23.6e slice 1 — Openings page', () => {
	it('is an index in document order showing type and host, never a second owner', () => {
		const projection = project({ kind: 'openings' });
		expect(projection.rows.map((row) => row.rowKey)).toEqual([
			'openings:opening:op-door-1',
			'openings:opening:op-win-2',
			'openings:opening:op-door-3'
		]);
		expect(rowByKey(projection.rows, 'openings:opening:op-win-2').secondary).toBe('Window on W2');
		expect(rowByKey(projection.rows, 'openings:opening:op-door-1').secondary).toBe('Door on W1');
		expect([...projection.representations.keys()].sort()).toEqual(
			[openingEntityKey('w1', 'op-door-1').id, openingEntityKey('w2', 'op-win-2').id, openingEntityKey('w12', 'op-door-3').id].sort()
		);
	});

	it('filters by the authoritative typed facet (gate 3)', () => {
		expect(project({ kind: 'openings' }, { openingFilter: 'door' }).rows.map((row) => row.canonicalId)).toEqual([
			'op-door-1', 'op-door-3'
		]);
		expect(project({ kind: 'openings' }, { openingFilter: 'window' }).rows.map((row) => row.canonicalId)).toEqual([
			'op-win-2'
		]);
		const windows = project({ kind: 'openings' }, { openingFilter: 'window' });
		expect(windows.representations.has(openingEntityKey('w1', 'op-door-1').id)).toBe(false);
		expect(windows.unfilteredRepresentations.has(openingEntityKey('w1', 'op-door-1').id)).toBe(true);
	});

	it('exposes one Show in Walls action carrying the exact host reveal chain', () => {
		const projection = project({ kind: 'openings' });
		const action = rowByKey(projection.rows, 'openings:opening:op-win-2').actions![0]!;
		expect(action.label).toBe('Show in Walls ›');
		expect(action.destination.page).toEqual({ kind: 'walls' });
		expect(action.destination.reveal).toEqual({
			entity: openingEntityKey('w2', 'op-win-2'),
			rowKey: 'walls:wall:w2:opening:op-win-2',
			ancestorDisclosureKeys: ['walls:wall:w2']
		});
	});
});

describe('P23.6e slice 1 — Junctions page', () => {
	it('lists Junctions with their factual incident-Wall count and no filter', () => {
		const projection = project({ kind: 'junctions' });
		expect(projection.rows.map((row) => row.canonicalId)).toEqual([
			'j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8', 'j9', 'j10', 'j11', 'j12'
		]);
		expect(rowByKey(projection.rows, 'junctions:junction:j3').secondary).toBe('5 walls');
		expect(rowByKey(projection.rows, 'junctions:junction:j10').secondary).toBe('1 wall');
		for (const row of projection.rows) {
			expect(row.children ?? []).toEqual([]);
			expect(row.destination).toBeUndefined();
		}
	});
});

describe('P23.6e slice 1 — Layout Objects page', () => {
	it('shows the explicit Room assignment only when roomId resolves', () => {
		const projection = project({ kind: 'layoutObjects' });
		expect(projection.rows.map((row) => row.rowKey)).toEqual([
			'layoutObjects:object:object-1',
			'layoutObjects:object:object-2',
			'layoutObjects:object:object-3'
		]);
		expect(rowByKey(projection.rows, 'layoutObjects:object:object-1').secondary).toBe(
			'assigned to Gallery A'
		);
		expect(rowByKey(projection.rows, 'layoutObjects:object:object-2').secondary).toBe(
			'assigned to Gallery C'
		);
		expect(rowByKey(projection.rows, 'layoutObjects:object:object-3').secondary).toBeUndefined();
		expect(rowByKey(projection.rows, 'layoutObjects:object:object-3').facet).toBe('cylinder');
	});
});

describe('P23.6e slice 1 — Scene Content page', () => {
	it('lists clusters in Scene order, then unclustered entities in document order', () => {
		const projection = project({ kind: 'sceneContent' });
		expect(projection.rows.map((row) => row.rowKey)).toEqual([
			'scene:cluster:cluster-1',
			'scene:cluster:cluster-empty',
			'scene:entity:entity-b1',
			'scene:entity:entity-standalone'
		]);
		expect(rowByKey(projection.rows, 'scene:cluster:cluster-1').children!.map((row) => row.rowKey)).toEqual([
			'scene:cluster:cluster-1:entity:entity-a1'
		]);
		expect(rowByKey(projection.rows, 'scene:cluster:cluster-1').secondary).toBe('1 item');
		expect(rowByKey(projection.rows, 'scene:cluster:cluster-empty').children).toEqual([]);
		expect(rowByKey(projection.rows, 'scene:cluster:cluster-empty').secondary).toBe('0 items');
		// A clustered member is never also a standalone row.
		expect(projection.rows.map((row) => row.rowKey)).not.toContain('scene:entity:entity-a1');
	});

	it('represents clustered members with their cluster in the reveal chain', () => {
		const projection = project({ kind: 'sceneContent' });
		expect(
			findHierarchyRepresentation(projection, sceneEntityKey('entity-a1'))!.ancestorDisclosureKeys
		).toEqual(['scene:cluster:cluster-1']);
		expect(findHierarchyRepresentation(projection, sceneEntityKey('entity-b1'))).toEqual({
			rowKey: 'scene:entity:entity-b1',
			entity: sceneEntityKey('entity-b1'),
			ancestorDisclosureKeys: [],
			primary: true
		});
	});
});

describe('P23.6e slice 1 — representation, home and exclusion helpers', () => {
	const index = fixtureIndex();

	it('resolves the canonical home page for every entity owner', () => {
		expect(canonicalHierarchyHome(index, roomEntityKey('room-a'))).toEqual({
			page: { kind: 'rooms' },
			reveal: {
				entity: roomEntityKey('room-a'),
				rowKey: 'rooms:room:room-a',
				ancestorDisclosureKeys: []
			}
		});
		expect(canonicalHierarchyHome(index, wallEntityKey('w2'))!.page).toEqual({ kind: 'walls' });
		expect(canonicalHierarchyHome(index, wallEntityKey('w2'))!.reveal!.rowKey).toBe('walls:wall:w2');
		// Wall page ↔ Openings page: an Opening's home is Walls under its host row.
		expect(canonicalHierarchyHome(index, openingEntityKey('w12', 'op-door-3'))).toEqual({
			page: { kind: 'walls' },
			reveal: {
				entity: openingEntityKey('w12', 'op-door-3'),
				rowKey: 'walls:wall:w12:opening:op-door-3',
				ancestorDisclosureKeys: ['walls:wall:w12']
			}
		});
		expect(canonicalHierarchyHome(index, junctionEntityKey('j3'))!.page).toEqual({
			kind: 'junctions'
		});
		expect(canonicalHierarchyHome(index, layoutObjectEntityKey('object-1'))!.page).toEqual({
			kind: 'layoutObjects'
		});
		expect(canonicalHierarchyHome(index, sceneClusterEntityKey('cluster-1'))!.page).toEqual({
			kind: 'sceneContent'
		});
		expect(canonicalHierarchyHome(index, sceneEntityKey('entity-a1'))).toEqual({
			page: { kind: 'sceneContent' },
			reveal: {
				entity: sceneEntityKey('entity-a1'),
				rowKey: 'scene:cluster:cluster-1:entity:entity-a1',
				ancestorDisclosureKeys: ['scene:cluster:cluster-1']
			}
		});
	});

	it('returns no home for an identity the documents no longer contain', () => {
		expect(canonicalHierarchyHome(index, wallEntityKey('w-missing'))).toBeNull();
		expect(canonicalHierarchyHome(index, roomEntityKey('room-missing'))).toBeNull();
		expect(canonicalHierarchyHome(index, sceneEntityKey('entity-missing'))).toBeNull();
	});

	it('pins exclusion reasons in search → filter → Room → page priority', () => {
		const walls = buildHierarchyPageProjection(index, { kind: 'walls' });
		const filtered = buildHierarchyPageProjection(index, { kind: 'walls' }, { wallFilter: 'no-room' });
		const w8 = wallEntityKey('w8');
		expect(
			explainHierarchyExclusion({
				page: { kind: 'walls' },
				current: filtered,
				base: walls,
				entity: w8,
				queryActive: false
			})
		).toEqual({ kind: 'filter', text: 'Outside active filter' });
		// Search outranks filter.
		expect(
			explainHierarchyExclusion({
				page: { kind: 'walls' },
				current: filtered,
				base: walls,
				entity: w8,
				queryActive: true
			})
		).toEqual({ kind: 'search', text: 'Not in search results' });
		// Room page outranks the generic page reason.
		const roomPage = buildHierarchyPageProjection(index, { kind: 'room', roomId: 'room-a' });
		expect(
			explainHierarchyExclusion({
				page: { kind: 'room', roomId: 'room-a' },
				current: roomPage,
				base: roomPage,
				entity: wallEntityKey('w7'),
				queryActive: false,
				roomName: 'Gallery A'
			})
		).toEqual({ kind: 'room', text: 'Not in Gallery A' });
		expect(
			explainHierarchyExclusion({
				page: { kind: 'sceneContent' },
				current: project({ kind: 'sceneContent' }),
				base: project({ kind: 'sceneContent' }),
				entity: wallEntityKey('w7'),
				queryActive: false
			})
		).toEqual({ kind: 'page', text: 'Not on this page' });
	});

	it('never pins a represented entity, even off-screen or collapsed', () => {
		const walls = buildHierarchyPageProjection(index, { kind: 'walls' });
		expect(
			explainHierarchyExclusion({
				page: { kind: 'walls' },
				current: walls,
				base: walls,
				// Represented but collapsed under its Wall row / outside the viewport.
				entity: openingEntityKey('w2', 'op-win-2'),
				queryActive: true
			})
		).toBeNull();
	});

	it('maps canonical selection to exactly one Navigator entity', () => {
		expect(layoutSelectionToHierarchyEntity({ kind: 'room', roomId: 'room-a' })).toEqual(
			roomEntityKey('room-a')
		);
		expect(layoutSelectionToHierarchyEntity({ kind: 'physicalWall', wallId: 'w2' })).toEqual(
			wallEntityKey('w2')
		);
		expect(
			layoutSelectionToHierarchyEntity({ kind: 'wallOpening', wallId: 'w2', openingId: 'op-win-2' })
		).toEqual(openingEntityKey('w2', 'op-win-2'));
		expect(layoutSelectionToHierarchyEntity({ kind: 'junction', junctionId: 'j3' })).toEqual(
			junctionEntityKey('j3')
		);
		expect(layoutSelectionToHierarchyEntity({ kind: 'object', objectId: 'object-1' })).toEqual(
			layoutObjectEntityKey('object-1')
		);
		// Legacy Room-qualified kinds have no canonical Navigator identity.
		expect(
			layoutSelectionToHierarchyEntity({ kind: 'wall', roomId: 'room-a', segmentId: 'wall-a' })
		).toBeNull();
		expect(layoutSelectionToHierarchyEntity({ kind: 'none' })).toBeNull();
	});

	it('projects the one active selection domain; Scene multi-select uses the primary id', () => {
		const sceneMulti: ActiveEditorSelection = {
			domain: 'scene',
			selection: {
				kind: 'placement',
				ids: ['entity-a1', 'entity-b1'],
				clusterId: null,
				roomId: 'room-a'
			}
		};
		expect(activeSelectionToHierarchyEntity(sceneMulti)).toEqual(sceneEntityKey('entity-b1'));
		expect(
			activeSelectionToHierarchyEntity({
				domain: 'scene',
				selection: { kind: 'cluster', clusterId: 'cluster-1', roomId: 'room-a' }
			})
		).toEqual(sceneClusterEntityKey('cluster-1'));
		expect(
			activeSelectionToHierarchyEntity({
				domain: 'scene',
				selection: { kind: 'placement', ids: [], clusterId: null, roomId: 'room-a' }
			})
		).toBeNull();
		expect(
			activeSelectionToHierarchyEntity({
				domain: 'layout',
				selection: { kind: 'physicalWall', wallId: 'w2' }
			})
		).toEqual(wallEntityKey('w2'));
		// Gate 4: Camera selections have no Scene Navigator entity.
		expect(
			activeSelectionToHierarchyEntity({
				domain: 'camera',
				selection: { kind: 'node', nodeId: 'node-1', handle: 'position' }
			})
		).toBeNull();
		expect(activeSelectionToHierarchyEntity({ domain: 'none' })).toBeNull();
	});
});

describe('P23.6e slice 1 — determinism and authority purity', () => {
	it('repeated builds over deep-equal inputs and options are deep-equal', () => {
		const pages: HierarchyPage[] = [
			{ kind: 'root' },
			{ kind: 'rooms' },
			{ kind: 'room', roomId: 'room-a' },
			{ kind: 'walls' },
			{ kind: 'openings' },
			{ kind: 'junctions' },
			{ kind: 'layoutObjects' },
			{ kind: 'sceneContent' }
		];
		for (const page of pages) {
			const first = project(page);
			const second = project(page);
			expect(JSON.stringify(second.rows)).toBe(JSON.stringify(first.rows));
			expect([...second.representations]).toEqual([...first.representations]);
		}
		expect(indexSnapshot(fixtureIndex())).toBe(indexSnapshot(fixtureIndex()));
	});

	it('never mutates the source documents while projecting every page', () => {
		const layout = fixtureLayout();
		const scene = fixtureScene();
		const before = JSON.stringify({ layout, scene });
		const index = buildHierarchySourceIndex({ layout, scene });
		for (const page of [
			{ kind: 'root' },
			{ kind: 'rooms' },
			{ kind: 'room', roomId: 'room-a' },
			{ kind: 'walls' },
			{ kind: 'openings' },
			{ kind: 'junctions' },
			{ kind: 'layoutObjects' },
			{ kind: 'sceneContent' }
		] satisfies HierarchyPage[]) {
			buildHierarchyPageProjection(index, page, { wallFilter: 'multiple-rooms', openingFilter: 'door' });
			canonicalHierarchyHome(index, wallEntityKey('w2'));
		}
		expect(JSON.stringify({ layout, scene })).toBe(before);
	});

	it('changes only with documents or options', () => {
		const index = fixtureIndex();
		const renamed = fixtureLayout();
		renamed.rooms[0]!.name = 'Hall A';
		const renamedIndex = buildHierarchySourceIndex({ layout: renamed, scene: fixtureScene() });
		expect(buildHierarchyPageProjection(index, { kind: 'room', roomId: 'room-a' }).rows[0]!.label).toBe(
			'Gallery A'
		);
		expect(
			buildHierarchyPageProjection(renamedIndex, { kind: 'room', roomId: 'room-a' }).rows[0]!.label
		).toBe('Hall A');
		expect(project({ kind: 'walls' }, { wallFilter: 'multiple-rooms' }).rows.map((row) => row.canonicalId)).toEqual([
			'w2'
		]);
	});

	it('presents raw canonical ids and display labels without inventing ordinals', () => {
		const layout = fixtureLayout();
		layout.walls[0]!.id = 'wall:chain:9';
		layout.rooms[0]!.boundary[0] = { wallId: 'wall:chain:9', direction: 'forward' };
		const index = buildHierarchySourceIndex({ layout, scene: fixtureScene() });
		const row = buildHierarchyPageProjection(index, { kind: 'walls' }).rows.find(
			(candidate) => candidate.canonicalId === 'wall:chain:9'
		)!;
		// Gate 1: no `W044`-style ordinal registry — the raw canonical ID plus a
		// readable label is the safest existing presentation.
		expect(row.canonicalId).toBe('wall:chain:9');
		expect(row.label).toBe('Wall:chain:9');
		expect(row.label).not.toMatch(/^W\d+$/);
	});

	it('is a pure render model: no Svelte state, mutation, history or Camera imports', () => {
		const sourceIndex = readLibSource('editor/hierarchy/hierarchy-source-index.ts');
		const projection = readLibSource('editor/hierarchy/hierarchy-page-projection.ts');
		const searchSource = readLibSource('editor/hierarchy/hierarchy-search.ts');
		for (const source of [sourceIndex, projection, searchSource]) {
			expect(source).not.toMatch(/\$state|\$derived|\$effect/);
			expect(source).not.toContain('history-controller');
			expect(source).not.toContain('layout-mutation-runner');
			expect(source).not.toContain('layout-preview-state');
			expect(source).not.toContain('CameraFlowPanel');
			expect(source).not.toContain('editor-store');
		}
		expect(sourceIndex).not.toContain('svelte');
	});
});

describe('P23.6e slice 2 — bounded relationship search', () => {
	const search = (query: string, index: HierarchySourceIndex = fixtureIndex()) =>
		buildHierarchySearchProjection(index, query);

	const categories = (projection: ReturnType<typeof search>) =>
		projection.blocks.map((block) => block.category);

	const groupRows = (
		projection: ReturnType<typeof search>,
		category: string,
		kind: string
	) =>
		projection.blocks
			.find((block) => block.category === category)
			?.groups.find((group) => group.kind === kind)?.rows ?? [];

	it('normalizes and matches case/whitespace-insensitively', () => {
		expect(normalizeHierarchyQuery('  Gallery B  ')).toBe('gallery b');
		expect(hierarchySearchMatches('gallery b', 'Gallery B')).toBe(true);
		expect(hierarchySearchMatches('gallery b', 'gallery-b')).toBe(false);
		expect(hierarchySearchMatches('', 'Gallery B')).toBe(false);
	});

	it('returns an empty projection for an empty query without becoming a page', () => {
		for (const query of ['', '   ']) {
			const projection = search(query);
			expect(projection.blocks).toEqual([]);
			expect(projection.empty).toBe(true);
			expect(projection.representations.size).toBe(0);
		}
	});

	it('retrieves a Room with its boundary Walls, nested dependents and summarized topology', () => {
		const projection = search('Gallery B');
		expect(categories(projection)).toEqual(['rooms', 'walls']);

		const directRooms = groupRows(projection, 'rooms', 'direct');
		expect(directRooms.map((row) => row.label)).toEqual(['Gallery B']);
		const relatedWalls = groupRows(projection, 'walls', 'related');
		expect(relatedWalls.map((row) => row.canonicalId)).toEqual(['w2', 'w5', 'w6', 'w7']);
		// Dependents nested only: the hosted Opening and the oriented Ends row.
		expect(relatedWalls[0]!.children!.map((row) => row.rowKey)).toEqual([
			'search:walls:wall:w2:opening:op-win-2',
			'search:walls:wall:w2:ends'
		]);
		// Orientation comes from the Room boundary ref (w2 is reversed in B).
		expect(relatedWalls[0]!.children![1]!.label).toBe('Ends J3 · J2');

		// Topology summarized: a count row, never a Junction inventory.
		const topology = groupRows(projection, 'rooms', 'topology');
		expect(topology.map((row) => row.label)).toEqual(['Boundary Junctions (4)']);
		expect(topology[0]!.actions![0]!.destination).toEqual({
			page: { kind: 'room', roomId: 'room-b' },
			reveal: {
				entity: roomEntityKey('room-b'),
				rowKey: 'room:room-b:section:junctions',
				ancestorDisclosureKeys: []
			}
		});
		expect(categories(projection)).not.toContain('junctions');
	});

	it('retrieves a Wall with its participating Rooms and stops there', () => {
		const projection = search('w2');
		expect(categories(projection)).toEqual(['rooms', 'walls']);
		expect(groupRows(projection, 'walls', 'direct').map((row) => row.canonicalId)).toEqual(['w2']);
		expect(groupRows(projection, 'rooms', 'related').map((row) => row.label)).toEqual([
			'Gallery A', 'Gallery B', 'Gallery C'
		]);
		// STOP: the related Rooms never expand into their other Walls.
		expect(groupRows(projection, 'walls', 'related')).toEqual([]);
		expect(
			walk(projection.blocks.flatMap((block) => block.groups.flatMap((group) => group.rows))).map(
				(row) => row.canonicalId
			)
		).not.toContain('w1');
		// The hosted Opening is a dependent of the matched Wall, not a new result.
		expect(categories(projection)).not.toContain('openings');
		expect(
			groupRows(projection, 'walls', 'direct')[0]!.children!
				.filter((row) => row.kind === 'entity')
				.map((row) => row.canonicalId)
		).toEqual(['op-win-2']);
	});

	it('retrieves an Opening with its host Wall, and the host back from the Opening end', () => {
		const projection = search('op-win-2');
		expect(categories(projection)).toEqual(['walls', 'openings']);
		const direct = groupRows(projection, 'openings', 'direct');
		expect(direct.map((row) => row.canonicalId)).toEqual(['op-win-2']);
		expect(direct[0]!.secondary).toBe('on W2');
		// Show in Walls keeps the canonical home (real page rowKeys, not search ones).
		expect(direct[0]!.actions![0]!.destination).toEqual({
			page: { kind: 'walls' },
			reveal: {
				entity: openingEntityKey('w2', 'op-win-2'),
				rowKey: 'walls:wall:w2:opening:op-win-2',
				ancestorDisclosureKeys: ['walls:wall:w2']
			}
		});
		const relatedWalls = groupRows(projection, 'walls', 'related');
		expect(relatedWalls.map((row) => row.canonicalId)).toEqual(['w2']);
		expect(relatedWalls[0]!.secondary).toBe('in Gallery A, Gallery B, +1');
	});

	it('retrieves a Junction with incident Walls and its explicit boundary Rooms, then stops', () => {
		const projection = search('j3');
		expect(categories(projection)).toEqual(['rooms', 'walls', 'junctions']);
		expect(groupRows(projection, 'junctions', 'direct').map((row) => row.canonicalId)).toEqual(['j3']);
		expect(groupRows(projection, 'walls', 'related').map((row) => row.canonicalId)).toEqual([
			'w2', 'w3', 'w5', 'w8', 'w11'
		]);
		expect(groupRows(projection, 'rooms', 'related').map((row) => row.label)).toEqual([
			'Gallery A', 'Gallery B', 'Gallery C'
		]);
		// STOP: no Room → other-Wall recursion and no Junction → neighbour hops.
		const allIds = walk(
			projection.blocks.flatMap((block) => block.groups.flatMap((group) => group.rows))
		).map((row) => row.canonicalId);
		for (const forbidden of ['w1', 'w4', 'w7', 'j2', 'j1']) {
			expect(allIds, `search expanded into ${forbidden}`).not.toContain(forbidden);
		}
		// A related Room is terminal: no topology summary is produced for it.
		expect(groupRows(projection, 'rooms', 'topology')).toEqual([]);
	});

	it('retrieves an assigned Layout Object from the Room end and the Room from the Object end', () => {
		const byObject = search('object-1');
		expect(categories(byObject)).toEqual(['rooms', 'layoutObjects']);
		expect(groupRows(byObject, 'layoutObjects', 'direct')[0]!.secondary).toBe('assigned to Gallery A');
		expect(groupRows(byObject, 'rooms', 'related').map((row) => row.label)).toEqual(['Gallery A']);

		const byRoom = search('Gallery A');
		expect(groupRows(byRoom, 'rooms', 'direct').map((row) => row.label)).toEqual(['Gallery A']);
		expect(groupRows(byRoom, 'layoutObjects', 'related').map((row) => row.canonicalId)).toEqual([
			'object-1'
		]);
		// w2 is shared, so a Room retrieval reaches it and names the other Rooms.
		expect(groupRows(byRoom, 'walls', 'related').map((row) => row.canonicalId)).toEqual([
			'w1', 'w2', 'w3', 'w4'
		]);
	});

	it('retrieves a cluster from its members and its members from the cluster', () => {
		const byCluster = search('Statue Group');
		const directClusters = groupRows(byCluster, 'scene', 'direct');
		expect(directClusters.map((row) => row.canonicalId)).toEqual(['cluster-1']);
		expect(directClusters[0]!.children!.map((row) => row.canonicalId)).toEqual(['entity-a1']);
		expect(groupRows(byCluster, 'scene', 'related')).toEqual([]);

		const byMember = search('Sculpture A');
		expect(groupRows(byMember, 'scene', 'direct').map((row) => row.canonicalId)).toEqual([
			'entity-a1'
		]);
		// The member's cluster is related and holds the member row; the member is
		// not duplicated as a second related row.
		const relatedClusters = groupRows(byMember, 'scene', 'related');
		expect(relatedClusters.map((row) => row.canonicalId)).toEqual(['cluster-1']);
		expect(relatedClusters[0]!.children!.map((row) => row.canonicalId)).toEqual(['entity-a1']);
	});

	it('stops at Scene content unless Scene itself matched', () => {
		const sceneOnly = search('Grand Piano');
		expect(categories(sceneOnly)).toEqual(['scene']);
		expect(groupRows(sceneOnly, 'scene', 'direct').map((row) => row.canonicalId)).toEqual([
			'entity-b1'
		]);
		expect(categories(search('w2'))).not.toContain('scene');
		expect(categories(search('Gallery A'))).not.toContain('scene');
	});

	it('matches raw canonical IDs and display labels without inventing references', () => {
		expect(groupRows(search('w2'), 'walls', 'direct')).toHaveLength(1);
		// Display label match: 'Op Door 1' from the canonical id `op-door-1`.
		expect(
			groupRows(search('op door 1'), 'openings', 'direct').map((row) => row.canonicalId)
		).toEqual(['op-door-1']);
		// Type facet match.
		expect(
			groupRows(search('window'), 'openings', 'direct').map((row) => row.canonicalId)
		).toEqual(['op-win-2']);
		// An imported id containing separators stays addressable verbatim.
		const layout = fixtureLayout();
		layout.walls[0]!.id = 'wall:chain:9';
		layout.rooms[0]!.boundary[0] = { wallId: 'wall:chain:9', direction: 'forward' };
		const index = buildHierarchySourceIndex({ layout, scene: fixtureScene() });
		expect(
			groupRows(buildHierarchySearchProjection(index, 'wall:chain:9'), 'walls', 'direct').map(
				(row) => row.canonicalId
			)
		).toEqual(['wall:chain:9']);
		expect(
			groupRows(buildHierarchySearchProjection(index, 'Wall:chain:9'), 'walls', 'direct')
		).toHaveLength(1);
	});

	it('rebuilds live after rename, split, Opening rebase and Undo-shaped replacement', () => {
		// Rename.
		const renamed = fixtureLayout();
		renamed.rooms[0]!.name = 'Hall A';
		const renamedIndex = buildHierarchySourceIndex({ layout: renamed, scene: fixtureScene() });
		expect(categories(buildHierarchySearchProjection(renamedIndex, 'Gallery A'))).not.toContain('rooms');
		expect(
			groupRows(buildHierarchySearchProjection(renamedIndex, 'Hall A'), 'rooms', 'direct').map(
				(row) => row.canonicalId
			)
		).toEqual(['room-a']);

		// Split-shaped document edit: a new Wall appears with a new canonical id.
		const split = fixtureLayout();
		split.walls.push({
			id: 'w14',
			startJunctionId: 'j4',
			endJunctionId: 'j10',
			role: 'partition',
			thickness: 0.1,
			height: 2.2
		});
		const splitIndex = buildHierarchySourceIndex({ layout: split, scene: fixtureScene() });
		expect(
			groupRows(buildHierarchySearchProjection(splitIndex, 'w14'), 'walls', 'direct').map(
				(row) => row.canonicalId
			)
		).toEqual(['w14']);

		// Opening rebase: the host changes, and both directions follow it.
		const rebased = fixtureLayout();
		rebased.openings = rebased.openings.map((opening) =>
			opening.id === 'op-win-2' ? { ...opening, wallId: 'w3' } : opening
		);
		const rebasedIndex = buildHierarchySourceIndex({ layout: rebased, scene: fixtureScene() });
		const rebasedSearch = buildHierarchySearchProjection(rebasedIndex, 'op-win-2');
		expect(groupRows(rebasedSearch, 'walls', 'related')[0]!.canonicalId).toBe('w3');
		expect(
			groupRows(buildHierarchySearchProjection(rebasedIndex, 'w3'), 'walls', 'direct')[0]!.children!
				.filter((row) => row.kind === 'entity')
				.map((row) => row.canonicalId)
		).toEqual(['op-win-2']);

		// Undo-shaped document replacement: the removed Opening is gone, not stale.
		const undone = fixtureLayout();
		undone.openings = undone.openings.filter((opening) => opening.id !== 'op-door-3');
		const undoneIndex = buildHierarchySourceIndex({ layout: undone, scene: fixtureScene() });
		expect(buildHierarchySearchProjection(undoneIndex, 'op-door-3').empty).toBe(true);
	});

	it('produces byte-stable ordering for the same documents and query', () => {
		const first = buildHierarchySearchProjection(fixtureIndex(), 'Gallery B');
		const second = buildHierarchySearchProjection(fixtureIndex(), 'Gallery B');
		expect(JSON.stringify(second.blocks)).toBe(JSON.stringify(first.blocks));
		expect([...second.representations]).toEqual([...first.representations]);
	});

	it('never mutates the documents and exposes the shared representation registry', () => {
		const layout = fixtureLayout();
		const scene = fixtureScene();
		const before = JSON.stringify({ layout, scene });
		const projection = buildHierarchySearchProjection(
			buildHierarchySourceIndex({ layout, scene }),
			'Statue Group'
		);
		expect(JSON.stringify({ layout, scene })).toBe(before);
		// The search registry is usable by the same reveal/exclusion helpers.
		expect(
			findHierarchyRepresentation(projection, sceneEntityKey('entity-a1'))!.ancestorDisclosureKeys
		).toEqual(['search:scene:cluster:cluster-1']);
		expect(
			explainHierarchyExclusion({
				page: { kind: 'root' },
				current: projection,
				base: projection,
				entity: wallEntityKey('w1'),
				queryActive: true
			})
		).toEqual({ kind: 'search', text: 'Not in search results' });
	});
});

describe('P23.6e slice 4 — page Navigator UI migration', () => {
	const navigatorSource = readLibSource('editor/hierarchy/HierarchyNavigator.svelte');
	const rowSource = readLibSource('editor/hierarchy/HierarchyRow.svelte');
	const treeSource = readLibSource('editor/UnifiedProjectTree.svelte');

	it('isolates the legacy accordion behind the wall-first gate', () => {
		const gate = treeSource.indexOf('{#if wallFirstLayout}');
		expect(gate).toBeGreaterThan(-1);
		const navigatorMount = treeSource.indexOf('<HierarchyNavigator', gate);
		const legacyRoot = treeSource.indexOf('class="tree-filter"');
		expect(navigatorMount).toBeGreaterThan(gate);
		// The legacy search/accordion markup stays reachable but only after the
		// canonical branch's `{:else}`.
		expect(legacyRoot).toBeGreaterThan(navigatorMount);
		expect(treeSource).toMatch(/\{:else\}/);
	});

	it('renders headings as non-interactive eyebrows, never destinations or buttons', () => {
		expect(rowSource).toContain('<p class="hierarchy-heading">{row.label}</p>');
		expect(rowSource).not.toMatch(/row\.kind === 'heading'[\s\S]{0,140}?<button/);
		for (const row of buildHierarchyPageProjection(fixtureIndex(), { kind: 'root' }).rows.filter(
			(candidate) => candidate.kind === 'heading'
		)) {
			expect(row.destination).toBeUndefined();
			expect(row.entity).toBeUndefined();
			expect(row.disclosureKey).toBeUndefined();
			expect(row.actions).toBeUndefined();
		}
	});

	it('routes root destinations directly and never through a disclosure row', () => {
		const rows = buildHierarchyPageProjection(fixtureIndex(), { kind: 'root' }).rows;
		const destinations = rows.filter((row) => row.kind === 'destination');
		expect(destinations.map((row) => row.destination!.page.kind)).toEqual([
			'rooms',
			'walls',
			'openings',
			'junctions',
			'layoutObjects',
			'sceneContent'
		]);
		for (const row of destinations) {
			expect(row.disclosureKey).toBeUndefined();
			expect(row.defaultOpen).toBeUndefined();
			// Navigation-only: no entity, so an activation cannot select.
			expect(isHierarchyRowSelectable(row)).toBe(false);
			expect(row.destination!.reveal).toBeNull();
		}
		// Every destination is a real `<button type="button">`, so keyboard entry
		// is native rather than a click-only div.
		expect(rowSource).toMatch(/row\.kind === 'destination'[\s\S]{0,120}?<button type="button"/);
	});

	it('separates Room (and every entity) selection from the navigation action', () => {
		// Two distinct affordances on the entity line: the row itself selects via
		// `onSelect`, action buttons navigate via `onAction`.
		expect(rowSource).toMatch(/onclick=\{interactive \? \(\) => onSelect\(row\) : undefined\}/);
		expect(rowSource).toMatch(/onclick=\{\(\) => onAction\(action\.destination\)\}/);
		expect(navigatorSource).toContain('function selectRow(');
		expect(navigatorSource).toContain('function runAction(');
		expect(navigatorSource).toMatch(/function runAction\(destination: HierarchyDestination\)[\s\S]{0,220}navigator\.showIn\(destination\)/);
		// Disabled rows stay mounted and focusable with an honest ARIA state.
		expect(rowSource).toContain('aria-disabled={!interactive}');
		expect(rowSource).toMatch(/aria-expanded=\{open\}/);
	});

	it('writes selection only through the canonical layout interaction helpers', () => {
		for (const writer of [
			'selectLayoutRoom',
			'selectLayoutPhysicalWall',
			'selectLayoutWallOpening',
			'selectLayoutJunction',
			'selectLayoutObject'
		]) {
			expect(navigatorSource).toContain(writer);
		}
		expect(navigatorSource).toMatch(/from '\.\.\/layout\/layout-interaction'/);
		// No direct selection writes, no document mutation, no history controller.
		expect(navigatorSource).not.toMatch(/activeSelection\.active\s*=/);
		expect(navigatorSource).not.toContain('layout-mutation-runner');
		expect(navigatorSource).not.toContain('history-controller');
	});

	it('keeps Scene and Layout owners separate, with mutations gated to 3D Scene', () => {
		// Scene row extras (visibility/frame/delete/cluster) are Scene-owned and
		// 3D-gated; Layout rows only expose the owner selection/context paths.
		expect(navigatorSource).toMatch(/entity\?\.owner === 'scene' && entity\.kind === 'entity' && sceneInteractive/);
		expect(navigatorSource).toMatch(/if \(entity\.owner === 'layout'\)/);
		expect(navigatorSource).toContain('const sceneInteractive = $derived(domain === \'scene\' && view === \'3d\')');
		expect(navigatorSource).toContain('store.toggleEntityVisibility');
		expect(navigatorSource).toContain('store.focusPlacement');
		expect(navigatorSource).toContain('store.deletePlacements');
		expect(navigatorSource).toContain('store.addMemberToCluster');
		expect(navigatorSource).toContain('store.removeMemberFromCluster');
	});

	it('keeps P23.6c / P23.6d context menus reachable on the canonical rows', () => {
		expect(treeSource).toContain('onWallContextMenu={onWallRowContextMenu}');
		expect(treeSource).toContain('onRoomContextMenu={onWallFirstRoomRowContextMenu}');
		expect(navigatorSource).toMatch(/entity\.kind === 'wall'\) onWallContextMenu\(event, entity\.wallId\)/);
		expect(navigatorSource).toMatch(/entity\.kind === 'room'\) onRoomContextMenu\(event, entity\.roomId\)/);
		expect(rowSource).toMatch(/oncontextmenu=\{onContextMenu \? \(event\) => onContextMenu\(event, row\) : undefined\}/);
	});

	it('carries no Camera dependency in the Navigator surface', () => {
		for (const source of [navigatorSource, rowSource]) {
			expect(source).not.toContain('Camera');
			expect(source).not.toContain('camera');
		}
	});
});
