import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	duplicateRoomSurfaceLineage,
	joinWallSurfaceLineage,
	normalizeLayoutSurfaceLineage,
	planDuplicateIsolatedRoom,
	roomSurfaceLineage,
	splitWallSurfaceLineage,
	spaceOfSurface,
	surfaceKey,
	surfacesOfSpace,
	wallSideAt,
	planWallChain,
	type LayoutDocumentWallFirst,
	type LayoutSurfaceRef
} from '@portfolio/layout-core';
import {
	applySurfaceLineage,
	newlyRetiredSurfaceReferenceKeys,
	surfaceLineageConsequence
} from '@portfolio/project-model/scene-planning';
import type { CameraFreeSceneDocument } from '@portfolio/project-model/units';
import { SCENE_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';
import { g1DocumentWithRooms, g1RoomPolygon } from '../layout/__fixtures__/layout-g1-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

function wallLayout(ids: readonly string[]): LayoutDocumentWallFirst {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.walls = ids.map((id, index) => ({
		id,
		startJunctionId: `${id}:start`,
		endJunctionId: `${id}:end`,
		thickness: 0.2,
		height: 3,
		centerline: { kind: 'line' as const }
	}));
	return layout;
}

function scene(assignments: CameraFreeSceneDocument['surfaceFinishes'] = []): CameraFreeSceneDocument {
	return { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities: [], surfaceFinishes: assignments };
}

describe('Layout surface identity and lineage', () => {
	it('maps reversed-survivor orientation before applying Join Finish precedence', () => {
		const beforeLayout = wallLayout(['a-survivor', 'b-absorbed']);
		const afterLayout = wallLayout(['a-survivor']);
		const lineage = joinWallSurfaceLineage({
			survivorWallId: 'a-survivor', absorbedWallId: 'b-absorbed', survivorForward: false, absorbedForward: true
		});
		const beforeScene = scene([
			{ surface: { kind: 'wall-side', wallId: 'a-survivor', side: 'left' }, finish: { materialId: 'paper-aged' } },
			{ surface: { kind: 'wall-side', wallId: 'a-survivor', side: 'right' }, finish: { materialId: 'marble-light' } },
			{ surface: { kind: 'wall-side', wallId: 'b-absorbed', side: 'left' }, finish: { materialId: 'velvet-dark' } },
			{ surface: { kind: 'wall-side', wallId: 'b-absorbed', side: 'right' }, finish: { materialId: 'brass-aged' } }
		]);
		const result = applySurfaceLineage({ beforeScene, beforeLayout, afterLayout, lineage });
		expect(result.kind).toBe('ready');
		if (result.kind !== 'ready') return;
		const byKey = new Map(result.scene.surfaceFinishes?.map((entry) => [surfaceKey(entry.surface), entry.finish]));
		expect(byKey.get(surfaceKey({ kind: 'wall-side', wallId: 'a-survivor', side: 'left' }))).toEqual({ materialId: 'marble-light' });
		expect(byKey.get(surfaceKey({ kind: 'wall-side', wallId: 'a-survivor', side: 'right' }))).toEqual({ materialId: 'paper-aged' });
		expect(result.report.replaced).toEqual([
		{
			target: { kind: 'wall-side', wallId: 'a-survivor', side: 'left' },
			winner: { kind: 'wall-side', wallId: 'a-survivor', side: 'right' },
			losing: { kind: 'wall-side', wallId: 'b-absorbed', side: 'left' }
		},
		{
			target: { kind: 'wall-side', wallId: 'a-survivor', side: 'right' },
			winner: { kind: 'wall-side', wallId: 'a-survivor', side: 'left' },
			losing: { kind: 'wall-side', wallId: 'b-absorbed', side: 'right' }
		}
		]);
		expect(surfaceLineageConsequence(result.report)).toContain('replace the Finish from Wall b-absorbed left');
		expect(result.report.pruned).toEqual([
			{ kind: 'wall-side', wallId: 'b-absorbed', side: 'left' },
			{ kind: 'wall-side', wallId: 'b-absorbed', side: 'right' }
		]);
	});

	it('carries an absorbed Finish when the survivor side is unpainted', () => {
		const beforeLayout = wallLayout(['survivor', 'absorbed']);
		const afterLayout = wallLayout(['survivor']);
		const source = { kind: 'wall-side', wallId: 'absorbed', side: 'left' } as const;
		const target = { kind: 'wall-side', wallId: 'survivor', side: 'left' } as const;
		const result = applySurfaceLineage({
			beforeScene: scene([{ surface: source, finish: { materialId: 'velvet-dark' } }]),
			beforeLayout,
			afterLayout,
			lineage: joinWallSurfaceLineage({
				survivorWallId: 'survivor', absorbedWallId: 'absorbed', survivorForward: true, absorbedForward: true
			})
		});
		expect(result.kind).toBe('ready');
		if (result.kind !== 'ready') return;
		expect(result.scene.surfaceFinishes).toEqual([{ surface: target, finish: { materialId: 'velvet-dark' } }]);
		expect(result.report.replaced).toEqual([]);
	});

	it('copies split sides and Room floor/lid lineage without cloning Finish identity', () => {
		expect(splitWallSurfaceLineage('old-wall', 'new-wall')).toEqual([
			{ to: { kind: 'wall-side', wallId: 'new-wall', side: 'left' }, from: [{ kind: 'wall-side', wallId: 'old-wall', side: 'left' }] },
			{ to: { kind: 'wall-side', wallId: 'new-wall', side: 'right' }, from: [{ kind: 'wall-side', wallId: 'old-wall', side: 'right' }] }
		]);
		expect(roomSurfaceLineage([{ roomId: 'new-room', predecessorRoomIds: ['old-room'], kind: 'created' }])).toEqual([
			{ to: { kind: 'room-floor', roomId: 'new-room' }, from: [{ kind: 'room-floor', roomId: 'old-room' }] },
			{ to: { kind: 'room-lid', roomId: 'new-room' }, from: [{ kind: 'room-lid', roomId: 'old-room' }] }
		]);
		const duplicated = duplicateRoomSurfaceLineage(new Map([['wall-a', 'wall-copy']]), 'room-a', 'room-copy');
		expect(duplicated).toContainEqual({
			to: { kind: 'room-floor', roomId: 'room-copy' }, from: [{ kind: 'room-floor', roomId: 'room-a' }]
		});
		expect(duplicated).toContainEqual({
			to: { kind: 'room-lid', roomId: 'room-copy' }, from: [{ kind: 'room-lid', roomId: 'room-a' }]
		});
	});

	it('carries noded Wall sides and both Room planes through an actual Room divide', () => {
		const beforeLayout = g1DocumentWithRooms([g1RoomPolygon('source-space', [[0, 0], [6, 0], [6, 4], [0, 4]])]);
		const sourceRoom = beforeLayout.rooms[0]!;
		const bottom = sourceRoom.boundary[0]!.wallId;
		const top = sourceRoom.boundary[2]!.wallId;
		const divide = planWallChain({
			baseline: beforeLayout,
			points: [[2, 0], [2, 4]],
			close: false,
			capture: freshCapture(),
			levelId: beforeLayout.floor.id,
			endpointHostSnaps: [
				{ pointIndex: 0, wallId: bottom },
				{ pointIndex: 1, wallId: top }
			]
		});
		expect(divide.kind, divide.kind === 'rejected' ? divide.rejection.message : '').toBe('success');
		if (divide.kind !== 'success') return;
		expect(divide.document.rooms).toHaveLength(2);
		const createdRoomId = divide.document.rooms.find((room) => room.id !== sourceRoom.id)!.id;
		const dividerWallId = divide.authoredWallIds[0]!;
		const sourceScene = scene([
			{ surface: { kind: 'room-floor', roomId: sourceRoom.id }, finish: { materialInstanceId: 'shared-finish' } },
			{ surface: { kind: 'room-lid', roomId: sourceRoom.id }, finish: { materialInstanceId: 'shared-finish' } },
			{ surface: { kind: 'wall-side', wallId: bottom, side: 'left' }, finish: { materialId: 'marble-light' } },
			{ surface: { kind: 'wall-side', wallId: top, side: 'right' }, finish: { materialId: 'velvet-dark' } }
		]);
		const applied = applySurfaceLineage({
			beforeScene: sourceScene, beforeLayout, afterLayout: divide.document, lineage: divide.surfaceLineage
		});
		expect(applied.kind).toBe('ready');
		if (applied.kind !== 'ready') return;
		const byKey = new Map(applied.scene.surfaceFinishes?.map((entry) => [surfaceKey(entry.surface), entry.finish]));
		expect(byKey.get(surfaceKey({ kind: 'room-floor', roomId: createdRoomId }))).toEqual({ materialInstanceId: 'shared-finish' });
		expect(byKey.get(surfaceKey({ kind: 'room-lid', roomId: createdRoomId }))).toEqual({ materialInstanceId: 'shared-finish' });
		expect(byKey.get(surfaceKey({ kind: 'wall-side', wallId: dividerWallId, side: 'left' }))).toBeUndefined();
		expect(byKey.get(surfaceKey({ kind: 'wall-side', wallId: dividerWallId, side: 'right' }))).toBeUndefined();
		const nodedFragmentId = divide.createdWallIds.find((id) => id !== dividerWallId)!;
		expect(byKey.get(surfaceKey({ kind: 'wall-side', wallId: nodedFragmentId, side: 'left' }))).toEqual({ materialId: 'marble-light' });
		expect(byKey.get(surfaceKey({ kind: 'wall-side', wallId: nodedFragmentId, side: 'right' }))).toBeUndefined();
	});

	it('duplicates assignments by identity while keeping the same project Finish reference', () => {
		const beforeLayout = g1DocumentWithRooms([g1RoomPolygon('source-space', [[0, 0], [6, 0], [6, 4], [0, 4]])]);
		const sourceRoom = beforeLayout.rooms[0]!;
		const duplicate = planDuplicateIsolatedRoom(
			beforeLayout, { roomId: sourceRoom.id, delta: [12, 0] }, freshCapture(), beforeLayout.floor.id
		);
		expect(duplicate.kind).toBe('success');
		if (duplicate.kind !== 'success') return;
		const cloneRoomId = duplicate.document.rooms.find((room) => room.id !== sourceRoom.id)!.id;
		const cloneWallId = duplicate.createdWallIds[0]!;
		const sourceWallSide = { kind: 'wall-side', wallId: sourceRoom.boundary[0]!.wallId, side: 'left' } as const;
		const cloneWallSide = { kind: 'wall-side', wallId: cloneWallId, side: 'left' } as const;
		const shared = { materialInstanceId: 'shared-finish' } as const;
		const beforeScene = scene([
			{ surface: sourceWallSide, finish: shared },
			{ surface: { kind: 'room-floor', roomId: sourceRoom.id }, finish: shared },
			{ surface: { kind: 'room-lid', roomId: sourceRoom.id }, finish: shared }
		]);
		const result = applySurfaceLineage({
			beforeScene, beforeLayout, afterLayout: duplicate.document, lineage: duplicate.surfaceLineage
		});
		expect(result.kind).toBe('ready');
		if (result.kind !== 'ready') return;
		const byKey = new Map(result.scene.surfaceFinishes?.map((entry) => [surfaceKey(entry.surface), entry.finish]));
		expect(byKey.get(surfaceKey(cloneWallSide))).toEqual(shared);
		expect(byKey.get(surfaceKey({ kind: 'room-floor', roomId: cloneRoomId }))).toEqual(shared);
		expect(byKey.get(surfaceKey({ kind: 'room-lid', roomId: cloneRoomId }))).toEqual(shared);
		expect(result.scene.materials).toEqual(beforeScene.materials);
	});

	it('prunes retired assignments in the accepted Scene and detects new orphan identities as a set', () => {
		const beforeLayout = wallLayout(['wall-kept', 'wall-erased']);
		const afterLayout = wallLayout(['wall-kept']);
		const erased = { kind: 'wall-side', wallId: 'wall-erased', side: 'left' } as const;
		const beforeScene = scene([{ surface: erased, finish: { materialId: 'brass-aged' } }]);
		const result = applySurfaceLineage({ beforeScene, beforeLayout, afterLayout, lineage: [] });
		expect(result.kind).toBe('ready');
		if (result.kind === 'ready') {
			expect(result.scene.surfaceFinishes).toBeUndefined();
			expect(result.report.dropped).toEqual([erased]);
		}

		const oldOrphan = { kind: 'wall-side', wallId: 'old-orphan', side: 'left' } as const;
		const newOrphan = { kind: 'wall-side', wallId: 'new-orphan', side: 'right' } as const;
		const oldLayout = wallLayout([]);
		const candidateLayout = wallLayout([]);
		const before = scene([{ surface: oldOrphan, finish: { materialId: 'paper-aged' } }]);
		const after = scene([{ surface: newOrphan, finish: { materialId: 'paper-aged' } }]);
		expect(newlyRetiredSurfaceReferenceKeys({
			beforeScene: before, beforeLayout: oldLayout, afterScene: after, afterLayout: candidateLayout
		})).toEqual([surfaceKey(newOrphan)]);
	});

	it('composes operation-born intermediate lineage back to accepted identities and rejects assigned orphans', () => {
		const beforeLayout = wallLayout(['kept', 'source']);
		const afterLayout = wallLayout(['kept', 'source', 'target']);
		const intermediate = { kind: 'wall-side', wallId: 'operation-born-wall', side: 'left' } as const;
		const source = { kind: 'wall-side', wallId: 'source', side: 'left' } as const;
		const target = { kind: 'wall-side', wallId: 'target', side: 'left' } as const;
		const lineage = [
			{ to: intermediate, from: [source] },
			{ to: target, from: [intermediate] }
		];
		const normalized = normalizeLayoutSurfaceLineage({ beforeLayout, afterLayout, lineage });
		expect(normalized).toEqual({ kind: 'ready', lineage: [{ to: target, from: [source] }] });
		const noAssignment = applySurfaceLineage({
			beforeScene: scene([{ surface: source, finish: { materialId: 'paper-aged' } }]),
			beforeLayout, afterLayout, lineage
		});
		expect(noAssignment).toMatchObject({ kind: 'ready' });
		if (noAssignment.kind === 'ready') {
			expect(noAssignment.scene.surfaceFinishes).toEqual([
				{ surface: source, finish: { materialId: 'paper-aged' } },
				{ surface: target, finish: { materialId: 'paper-aged' } }
			]);
		}

		const stale = applySurfaceLineage({
			beforeScene: scene([{ surface: intermediate, finish: { materialId: 'paper-aged' } }]),
			beforeLayout, afterLayout, lineage: [{ to: target, from: [intermediate] }]
		});
		expect(stale).toMatchObject({ kind: 'rejected', code: 'surface_lineage_invalid' });
	});

	it('expands an L-shaped Space to its oriented boundary without the adjacent Space side', () => {
		const document = g1DocumentWithRooms([
			g1RoomPolygon('L', [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]]),
			g1RoomPolygon('neighbour', [[6, 0], [8, 0], [8, 2], [6, 2]])
		]);
		const primary = document.rooms.find((room) => room.id === 'L')!;
		const neighbour = document.rooms.find((room) => room.id === 'neighbour')!;
		const primaryShared = primary.boundary[1]!;
		const neighbourShared = neighbour.boundary[3]!;
		const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
		const primaryWall = wallById.get(primaryShared.wallId)!;
		const neighbourWall = wallById.get(neighbourShared.wallId)!;
		const junctionMap = new Map([
			[neighbourWall.startJunctionId, primaryWall.endJunctionId],
			[neighbourWall.endJunctionId, primaryWall.startJunctionId]
		]);
		for (const wall of document.walls) {
			if (!wall.id.startsWith('neighbour:') || wall.id === neighbourShared.wallId) continue;
			wall.startJunctionId = junctionMap.get(wall.startJunctionId) ?? wall.startJunctionId;
			wall.endJunctionId = junctionMap.get(wall.endJunctionId) ?? wall.endJunctionId;
		}
		document.walls = document.walls.filter((wall) => wall.id !== neighbourShared.wallId);
		neighbour.boundary[3] = { wallId: primaryShared.wallId, direction: 'reverse' };
		document.junctions = document.junctions.filter((junction) => !junctionMap.has(junction.id));

		const membership = surfacesOfSpace(document, primary.id);
		const ownSides = primary.boundary.map((edge) => ({
			kind: 'wall-side' as const,
			wallId: edge.wallId,
			side: edge.direction === 'forward' ? 'left' as const : 'right' as const
		}));
		expect(membership.surfaces).toEqual([
			...ownSides,
			{ kind: 'room-floor', roomId: primary.id },
			{ kind: 'room-lid', roomId: primary.id }
		]);
		const primarySide = primaryShared.direction === 'forward' ? 'left' : 'right';
		const neighbourSide = 'right';
		expect(membership.surfaces).toContainEqual({ kind: 'wall-side', wallId: primaryShared.wallId, side: primarySide });
		expect(membership.surfaces).not.toContainEqual({ kind: 'wall-side', wallId: primaryShared.wallId, side: neighbourSide });
		expect(surfacesOfSpace(document, neighbour.id).surfaces).toContainEqual({
			kind: 'wall-side', wallId: primaryShared.wallId, side: neighbourSide
		});
		expect(spaceOfSurface(document, { kind: 'wall-side', wallId: primaryShared.wallId, side: primarySide })).toEqual({ kind: 'unique', roomId: primary.id });
		expect(spaceOfSurface(document, { kind: 'wall-side', wallId: primaryShared.wallId, side: neighbourSide })).toEqual({ kind: 'unique', roomId: neighbour.id });
	});

	it('maps Plan picks by signed lateral offset, not a rendered face normal', () => {
		const document = g1DocumentWithRooms([g1RoomPolygon('room', [[0, 0], [6, 0], [6, 4], [0, 4]])]);
		const compiled = compileWallFirstLayoutGeometry(document).geometry;
		expect(wallSideAt(compiled, 'room:wall:0', [3, 1])).toBe('left');
		expect(wallSideAt(compiled, 'room:wall:0', [3, -1])).toBe('right');
		expect(wallSideAt(compiled, 'room:wall:0', [3, 0])).toBeNull();
	});
});
