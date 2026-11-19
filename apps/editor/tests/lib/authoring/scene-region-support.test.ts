/**
 * T1 V1d — floor-region tops are genuine, snapshot-qualified Scene supports,
 * and Layout surface references resolve without becoming Scene attachment.
 *
 * These suites run the production seam, not a parallel one:
 *
 * - pointer support resolves the nearest *visible* upward face (Room floor or
 *   floor-region top) through the same occluders the Stage draws;
 * - the hit's own Y is only a required elevation for the Layout query at the
 *   snapped X/Z, and the committed pose reads the planner's resolved Y;
 * - F1 placement evidence names the region subject and `layout:region-top`;
 * - Layout references keep resolving after edits and refuse after deletion;
 * - a Layout-only region edit leaves Scene bytes untouched while the derived
 *   contact count follows the geometry.
 */
import { describe, expect, it } from 'vitest';
import type { SceneEntity, Vec3 } from '@portfolio/project-model';
import {
	FLOOR_SUPPORT_TOLERANCES,
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	floorSupportSnapshotOf,
	overheadSupportSnapshotOf,
	planCreateRegion,
	planMoveRegion,
	planRemoveRegion,
	planRoomMetadataUpdate,
	planSetRegionElevation,
	planWallChain,
	queryFloorSupports,
	queryOverheadSupports,
	resolveLayoutSurfaceReference,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	preparePlaceObjectCandidate,
	type LocalInputFrame,
	type NormalizedPlacementDefinition,
	type PlaceObjectInput
} from '@portfolio/project-model/scene-planning';
import {
	countSceneRootsOnFloorRegion,
	resolveSceneSupportOnGeometry,
	sceneSupportGenerationId
} from '@portfolio/project-model/scene-planning';
import { createEmptyUnitSceneDocument } from '@portfolio/project-model/units';

import {
	floorSupport,
	supportOccluders,
	upwardSupportFaces
} from '$lib/authoring/adapters/scene/support-occlusion';
import { snappedPlaceSupport } from '$lib/authoring/adapters/scene/pointer-support';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const GENERATION = 'generation-v1d';
const FRAME: LocalInputFrame = { origin: [0, 0, 0], yaw: 0 };

function enclosure(): LayoutDocumentWallFirst {
	const empty = createEmptyWallFirstLayoutDocument();
	const walls = planWallChain({
		baseline: empty,
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		capture: freshCapture(),
		levelId: empty.floor.id
	});
	if (walls.kind !== 'success') throw new Error(`the enclosure fixture was refused: ${walls.rejection.message}`);
	return walls.document;
}

function addRegion(
	baseline: LayoutDocumentWallFirst,
	input: {
		footprint: [number, number][];
		elevation: number;
		thickness?: number;
		role?: 'floor' | 'overhead';
	}
): { document: LayoutDocumentWallFirst; regionId: string } {
	const plan = planCreateRegion({
		baseline,
		capture: freshCapture(),
		intent: {
			role: input.role ?? 'floor',
			footprint: input.footprint,
			elevation: input.elevation,
			thickness: input.thickness ?? 0.2
		}
	});
	if (plan.kind !== 'success') throw new Error(`the region fixture was refused: ${plan.rejection.message}`);
	return { document: plan.document, regionId: plan.regionId };
}

function terraceLayout(): {
	document: LayoutDocumentWallFirst;
	geometry: CompiledLayoutGeometry;
	regionId: string;
} {
	const withRegion = addRegion(enclosure(), {
		footprint: [
			[2, 1],
			[5, 1],
			[5, 4],
			[2, 4]
		],
		elevation: 0.6
	});
	return {
		document: withRegion.document,
		geometry: compileWallFirstLayoutGeometry(withRegion.document).geometry,
		regionId: withRegion.regionId
	};
}

function regionOnly(role: 'floor' | 'overhead', elevation: number) {
	const withRegion = addRegion(createEmptyWallFirstLayoutDocument(), {
		footprint: [
			[1, 1],
			[5, 1],
			[5, 4],
			[1, 4]
		],
		elevation,
		role
	});
	return {
		document: withRegion.document,
		geometry: compileWallFirstLayoutGeometry(withRegion.document).geometry,
		regionId: withRegion.regionId
	};
}

function ray(origin: Vec3, towards: Vec3) {
	const delta: Vec3 = [
		towards[0] - origin[0],
		towards[1] - origin[1],
		towards[2] - origin[2]
	];
	const length = Math.hypot(delta[0], delta[1], delta[2]);
	return {
		origin,
		direction: [delta[0] / length, delta[1] / length, delta[2] / length] as Vec3
	};
}

function box(id: string, position: Vec3): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: 'Block',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0]
	};
}

function sceneWith(entities: readonly SceneEntity[]) {
	return { ...createEmptyUnitSceneDocument(), entities: [...entities], objects: [] };
}

describe('V1d pointer support — visible upward faces', () => {
	it('selects a raised floor-region top before the Room floor under the same ray', () => {
		const { geometry, regionId } = terraceLayout();
		const hit = floorSupport(
			ray([3, 5, 2], [3, 0.6, 2]),
			0,
			supportOccluders(geometry, sceneWith([])),
			upwardSupportFaces(geometry)
		);
		expect(hit).toMatchObject({
			kind: 'floor',
			worldPoint: [3, 0.6, 2],
			surface: { kind: 'region-top', regionId }
		});
	});

	it('uses the Room floor outside the raised top and still falls back to the datum outside enclosure', () => {
		const { geometry } = terraceLayout();
		const faces = upwardSupportFaces(geometry);
		const occluders = supportOccluders(geometry, sceneWith([]));

		expect(floorSupport(ray([1, 5, 1], [1, 0, 1]), 0, occluders, faces)).toMatchObject({
			kind: 'floor',
			worldPoint: [1, 0, 1],
			surface: { kind: 'room-floor' }
		});
		expect(floorSupport(ray([30, 5, 30], [30, 0, 30]), 0, occluders, faces)).toMatchObject({
			kind: 'floor',
			surface: { kind: 'datum' }
		});
	});

	it('keeps a Wall nearer than the face as occlusion', () => {
		const { geometry } = terraceLayout();
		const hit = floorSupport(
			ray([8, 1, 3], [5, 0, 3]),
			0,
			supportOccluders(geometry, sceneWith([])),
			upwardSupportFaces(geometry)
		);
		expect(hit.kind).toBe('occluded');
		if (hit.kind !== 'occluded') return;
		expect(hit.occluderId).toContain('wall:');
	});

	it('keeps a Scene body resting on the terrace as occlusion', () => {
		const { geometry } = terraceLayout();
		const hit = floorSupport(
			ray([3, 5, 2], [3, 0.6, 2]),
			0,
			supportOccluders(geometry, sceneWith([box('scene-box', [3, 1.1, 2])])),
			upwardSupportFaces(geometry)
		);
		expect(hit.kind).toBe('occluded');
		if (hit.kind !== 'occluded') return;
		expect(hit.occluderId).toBe('scene:scene-box');
	});

	it('lets a floor-region slab side hide the datum behind it', () => {
		const { geometry } = regionOnly('floor', 0.6);
		const hit = floorSupport(
			ray([8, 2, 3], [4, 0, 3]),
			0,
			supportOccluders(geometry, sceneWith([])),
			upwardSupportFaces(geometry)
		);
		expect(hit.kind).toBe('occluded');
		if (hit.kind !== 'occluded') return;
		expect(hit.occluderId).toContain('layout-region:');
	});

	it('never offers an overhead region as upward support, and its underside blocks the ray', () => {
		const { geometry } = regionOnly('overhead', 2.5);
		expect(upwardSupportFaces(geometry).some((face) => face.kind === 'region-top')).toBe(false);
		const hit = floorSupport(
			ray([3, 5, 2], [3, 0, 2]),
			0,
			supportOccluders(geometry, sceneWith([])),
			upwardSupportFaces(geometry)
		);
		expect(hit.kind).toBe('occluded');
		if (hit.kind !== 'occluded') return;
		expect(hit.occluderId).toContain('layout-region:');
	});
});

describe('V1d snapped Place support', () => {
	it('snaps the hit X/Z, requeries there, and pins the accepted support elevation', () => {
		const { geometry, regionId } = terraceLayout();
		const support = snappedPlaceSupport({
			geometry,
			generationId: GENERATION,
			hitElevation: 0.6,
			hitX: 3.4,
			hitZ: 2.6,
			hitSurface: { kind: 'region-top', regionId },
			snapStep: 1
		});
		expect(support).toEqual({
			x: 3,
			z: 3,
			elevation: 0.6,
			choice: { kind: 'elevation', elevation: 0.6, generationId: GENERATION }
		});
		const resolved = resolveSceneSupportOnGeometry({
			geometry,
			generationId: GENERATION,
			point: [3, 3],
			requiredElevation: null,
			choice: support?.choice
		});
		expect(resolved).toMatchObject({ kind: 'resolved', support: { elevation: 0.6 } });
		if (resolved.kind !== 'resolved') return;
		expect(resolved.support.witnesses).toContainEqual(
			expect.objectContaining({ source: { kind: 'region', regionId } })
		);
	});

	it('refuses when snapping moves the pose off the raised top instead of dropping to the floor below', () => {
		// The terrace stops just short of x = 4; a hit at 3.85 is on it, but a
		// 1 m snap moves the pose to 4.0, where only the Room floor remains.
		const withRegion = addRegion(enclosure(), {
			footprint: [
				[2, 1],
				[3.9, 1],
				[3.9, 4],
				[2, 4]
			],
			elevation: 0.6
		});
		const geometry = compileWallFirstLayoutGeometry(withRegion.document).geometry;
		expect(
			snappedPlaceSupport({
				geometry,
				generationId: GENERATION,
				hitElevation: 0.6,
				hitX: 3.85,
				hitZ: 2.5,
				hitSurface: { kind: 'region-top', regionId: withRegion.regionId },
				snapStep: 1
			})
		).toBeNull();
	});

	it('keeps the datum and Room placement unchanged outside the terrace', () => {
		const { geometry } = terraceLayout();
		const roomId = geometry.rooms[0]!.roomId;
		expect(
			snappedPlaceSupport({
				geometry,
				generationId: GENERATION,
				hitElevation: 0,
				hitX: 1.2,
				hitZ: 1.4,
				hitSurface: { kind: 'room-floor', roomId },
				snapStep: null
			})
		).toMatchObject({ x: 1.2, z: 1.4, elevation: 0, choice: { kind: 'elevation', elevation: 0 } });
		expect(
			snappedPlaceSupport({
				geometry,
				generationId: GENERATION,
				hitElevation: 0,
				hitX: 30,
				hitZ: 30,
				hitSurface: { kind: 'datum' },
				snapStep: null
			})
		).toMatchObject({ elevation: 0, choice: { kind: 'elevation', elevation: 0 } });
	});

	it('refuses a snap that lands on a different floor region at the same elevation', () => {
		let baseline = createEmptyWallFirstLayoutDocument();
		const first = addRegion(baseline, {
			footprint: [
				[2, 1],
				[3.9, 1],
				[3.9, 4],
				[2, 4]
			],
			elevation: 0.6
		});
		baseline = first.document;
		const second = addRegion(baseline, {
			footprint: [
				[3.9, 1],
				[5.9, 1],
				[5.9, 4],
				[3.9, 4]
			],
			elevation: 0.6
		});
		const geometry = compileWallFirstLayoutGeometry(second.document).geometry;

		// The hit is on the first region; a 1 m snap moves it onto the second at
		// the same elevation. The query at the snapped point still resolves, but
		// the visible witness is gone, so the preview must refuse.
		const snapped = resolveSceneSupportOnGeometry({
			geometry,
			generationId: GENERATION,
			point: [4, 2.5],
			requiredElevation: 0.6
		});
		expect(snapped.kind).toBe('resolved');
		if (snapped.kind !== 'resolved') return;
		expect(snapped.support.witnesses).toContainEqual(
			expect.objectContaining({ source: { kind: 'region', regionId: second.regionId } })
		);
		expect(
			snappedPlaceSupport({
				geometry,
				generationId: GENERATION,
				hitElevation: 0.6,
				hitX: 3.85,
				hitZ: 2.5,
				hitSurface: { kind: 'region-top', regionId: first.regionId },
				snapStep: 1
			})
		).toBeNull();

		// The same hit without the edge-crossing snap remains valid.
		expect(
			snappedPlaceSupport({
				geometry,
				generationId: GENERATION,
				hitElevation: 0.6,
				hitX: 3.2,
				hitZ: 2.5,
				hitSurface: { kind: 'region-top', regionId: first.regionId },
				snapStep: null
			})
		).toMatchObject({ elevation: 0.6 });
	});

	it('refuses a snap from a coplanar region onto the Room floor at the same elevation', () => {
		const withRegion = addRegion(enclosure(), {
			footprint: [
				[2, 1],
				[3.9, 1],
				[3.9, 4],
				[2, 4]
			],
			elevation: 0
		});
		const geometry = compileWallFirstLayoutGeometry(withRegion.document).geometry;
		const roomId = geometry.rooms[0]!.roomId;

		const snapped = resolveSceneSupportOnGeometry({
			geometry,
			generationId: GENERATION,
			point: [4, 2.5],
			requiredElevation: 0
		});
		expect(snapped.kind).toBe('resolved');
		if (snapped.kind !== 'resolved') return;
		expect(snapped.support.witnesses).toContainEqual(
			expect.objectContaining({ source: { kind: 'room', roomId } })
		);
		expect(snapped.support.witnesses).not.toContainEqual(
			expect.objectContaining({ source: { kind: 'region', regionId: withRegion.regionId } })
		);

		expect(
			snappedPlaceSupport({
				geometry,
				generationId: GENERATION,
				hitElevation: 0,
				hitX: 3.85,
				hitZ: 2.5,
				hitSurface: { kind: 'region-top', regionId: withRegion.regionId },
				snapStep: 1
			})
		).toBeNull();
	});
});

describe('V1d place-object support evidence', () => {
	function definition(): NormalizedPlacementDefinition {
		return {
			definitionKey: 'native:box',
			metadataContentId:
				'sha256-0000000000000000000000000000000000000000000000000000000000000000',
			admission: {
				operations: ['place-object'],
				supportedSurfaces: ['floor'],
				uprightOnly: true,
				provenance: { kind: 'analytical', detail: 'Centered primitive: contactMinY = -height/2.' },
				exclusions: []
			},
			footprintMeters: [
				[-0.5, -0.5],
				[0.5, -0.5],
				[0.5, 0.5],
				[-0.5, 0.5]
			],
			contactMinY: -0.5,
			creationDefaults: {
				kind: 'primitive',
				primitive: 'box',
				name: 'Block',
				dimensions: { width: 1, height: 1, depth: 1 },
				materialId: 'plaster-warm',
				castShadow: true,
				receiveShadow: true
			},
			renderNormalization: { defaultScale: 0.032 }
		};
	}

	const snapshot = {
		acceptedRevision: { projectId: 'project-v1d', revisionId: 'revision-1' },
		sourceContentId: 'content-v1d'
	};
	const generationId = sceneSupportGenerationId(snapshot.sourceContentId);
	const frameReference = {
		version: 1 as const,
		kind: 'owner-frame' as const,
		owner: 'scene' as const,
		frameId: 'supplied-input-frame',
		revision: 'content-v1d'
	};

	function placementInput(
		geometry: CompiledLayoutGeometry,
		support: PlaceObjectInput['support']
	): PlaceObjectInput {
		return {
			snapshot,
			supportSnapshot: snapshot,
			frameSnapshot: snapshot,
			frameReference,
			document: createEmptyUnitSceneDocument(),
			entityId: 'entity-v1d',
			definition: definition(),
			worldXZ: [3, 2],
			yaw: 0,
			frame: FRAME,
			generationId,
			support
		};
	}

	it('commits the planner-resolved region-top Y and names the region in F1 evidence', () => {
		const { geometry, regionId } = terraceLayout();
		const resolved = resolveSceneSupportOnGeometry({
			geometry,
			generationId,
			point: [3, 2],
			requiredElevation: null,
			choice: { kind: 'elevation', elevation: 0.6, generationId }
		});
		expect(resolved.kind).toBe('resolved');
		if (resolved.kind !== 'resolved') return;
		const result = preparePlaceObjectCandidate(placementInput(geometry, resolved));
		expect(result.kind).toBe('candidate');
		if (result.kind !== 'candidate') return;

		expect(result.candidate.worldPose.position).toEqual([3, 1.1, 2]);
		expect(result.candidate.support).toMatchObject({
			elevation: 0.6,
			generationId,
			roomId: null
		});
		expect(result.candidate.support.witnesses).toContainEqual(
			expect.objectContaining({ source: { kind: 'region', regionId } })
		);
		expect(result.candidate.support.fragments).toContainEqual(
			expect.objectContaining({
				stream: 'layout:region-top',
				generationId,
				source: expect.objectContaining({
					domain: 'layout',
					subject: { kind: 'region', id: regionId }
				})
			})
		);
	});

	it('refuses an ambiguous two-elevation point instead of choosing one', () => {
		const { geometry } = terraceLayout();
		const selection = resolveSceneSupportOnGeometry({
			geometry,
			generationId,
			point: [3, 2],
			requiredElevation: null
		});
		expect(selection).toMatchObject({ kind: 'refused', code: 'support-choice-required' });
		if (selection.kind !== 'refused') return;
		const result = preparePlaceObjectCandidate(
			placementInput(geometry, { kind: 'choice-required', candidates: selection.candidates })
		);
		expect(result).toMatchObject({ kind: 'refusal', code: 'support-choice-required' });
	});

	it('refuses stale evidence from another generation', () => {
		const { geometry } = terraceLayout();
		const stale = resolveSceneSupportOnGeometry({
			geometry,
			generationId: 'generation-other',
			point: [3, 2],
			requiredElevation: null,
			choice: { kind: 'elevation', elevation: 0.6, generationId: 'generation-other' }
		});
		expect(stale.kind).toBe('resolved');
		if (stale.kind !== 'resolved') return;
		const result = preparePlaceObjectCandidate(placementInput(geometry, stale));
		expect(result).toMatchObject({ kind: 'refusal', code: 'stale-generation' });
	});

	it('keeps Room evidence and the Room-only membership fields for a non-region point', () => {
		const { geometry } = terraceLayout();
		const resolved = resolveSceneSupportOnGeometry({
			geometry,
			generationId,
			point: [1, 1],
			requiredElevation: null
		});
		expect(resolved.kind).toBe('resolved');
		if (resolved.kind !== 'resolved') return;
		const input = placementInput(geometry, resolved);
		input.worldXZ = [1, 1];
		const result = preparePlaceObjectCandidate(input);
		expect(result.kind).toBe('candidate');
		if (result.kind !== 'candidate') return;
		expect(result.candidate.support.roomId).not.toBeNull();
		expect(result.candidate.support.witnesses.every((witness) => witness.source.kind === 'room')).toBe(true);
		expect(result.candidate.support.fragments.every((fragment) => fragment.stream === 'layout:room-floor')).toBe(true);
	});
});

describe('V1d Layout surface references', () => {
	it('resolves region top, underside and the whole edge from authored identity', () => {
		const { geometry, regionId } = terraceLayout();
		expect(resolveLayoutSurfaceReference(geometry, { regionId, surface: 'top' })).toMatchObject({
			kind: 'resolved',
			subject: { kind: 'region', id: regionId },
			elevation: 0.6,
			faces: [expect.objectContaining({ surface: 'top', normal: [0, 1, 0] })]
		});
		const underside = resolveLayoutSurfaceReference(geometry, { regionId, surface: 'underside' });
		expect(underside).toMatchObject({
			kind: 'resolved',
			faces: [expect.objectContaining({ surface: 'underside', normal: [0, -1, 0] })]
		});
		if (underside.kind !== 'resolved') return;
		expect(underside.elevation).toBeCloseTo(0.4, 9);
		const edge = resolveLayoutSurfaceReference(geometry, { regionId, surface: 'edge' });
		expect(edge).toMatchObject({ kind: 'resolved', elevation: null });
		if (edge.kind !== 'resolved') return;
		expect(edge.faces).toHaveLength(4);
	});

	it('survives move, elevation and thickness edits; deletion leaves the reference unresolved', () => {
		const start = terraceLayout();
		const moved = planMoveRegion(start.document, start.regionId, [1, 0]);
		expect(moved.kind).toBe('success');
		if (moved.kind !== 'success') return;
		const movedGeometry = compileWallFirstLayoutGeometry(moved.document).geometry;
		const movedTop = resolveLayoutSurfaceReference(movedGeometry, {
			regionId: start.regionId,
			surface: 'top'
		});
		expect(movedTop).toMatchObject({ kind: 'resolved', elevation: 0.6 });
		if (movedTop.kind !== 'resolved') return;
		expect(movedTop.faces[0]!.polygon).toContainEqual([3, 0.6, 1]);

		const raised = planSetRegionElevation(moved.document, start.regionId, 1.2);
		expect(raised.kind).toBe('success');
		if (raised.kind !== 'success') return;
		const raisedGeometry = compileWallFirstLayoutGeometry(raised.document).geometry;
		expect(
			resolveLayoutSurfaceReference(raisedGeometry, { regionId: start.regionId, surface: 'top' })
		).toMatchObject({ kind: 'resolved', elevation: 1.2 });
		const raisedUnderside = resolveLayoutSurfaceReference(raisedGeometry, {
			regionId: start.regionId,
			surface: 'underside'
		});
		expect(raisedUnderside).toMatchObject({ kind: 'resolved' });
		if (raisedUnderside.kind !== 'resolved') return;
		expect(raisedUnderside.elevation).toBeCloseTo(1, 9);

		const removed = planRemoveRegion(raised.document, start.regionId);
		expect(removed.kind).toBe('success');
		if (removed.kind !== 'success') return;
		const removedGeometry = compileWallFirstLayoutGeometry(removed.document).geometry;
		expect(
			resolveLayoutSurfaceReference(removedGeometry, { regionId: start.regionId, surface: 'top' })
		).toMatchObject({ kind: 'unresolved', code: 'missing-region' });
	});

	it('resolves a closed Space floor and lid, and refuses an open-to-sky lid while keeping its floor', () => {
		const layout = enclosure();
		const roomId = layout.rooms[0]!.id;
		const closed = compileWallFirstLayoutGeometry(layout).geometry;
		const room = closed.rooms.find((candidate) => candidate.roomId === roomId);
		expect(room).toBeDefined();
		expect(resolveLayoutSurfaceReference(closed, { roomId, surface: 'floor' })).toMatchObject({
			kind: 'resolved',
			elevation: room!.floorElevation,
			faces: [expect.objectContaining({ surface: 'floor', normal: [0, 1, 0] })]
		});
		expect(resolveLayoutSurfaceReference(closed, { roomId, surface: 'lid' })).toMatchObject({
			kind: 'resolved',
			elevation: room!.ceilingElevation,
			faces: [expect.objectContaining({ surface: 'lid', normal: [0, -1, 0] })]
		});

		const open = planRoomMetadataUpdate(layout, roomId, { overhead: 'open-to-sky' });
		expect(open.kind).toBe('success');
		if (open.kind !== 'success') return;
		const openGeometry = compileWallFirstLayoutGeometry(open.document).geometry;
		expect(resolveLayoutSurfaceReference(openGeometry, { roomId, surface: 'lid' })).toMatchObject({
			kind: 'unresolved',
			code: 'open-to-sky'
		});
		expect(resolveLayoutSurfaceReference(openGeometry, { roomId, surface: 'floor' })).toMatchObject({
			kind: 'resolved',
			elevation: room!.floorElevation
		});
	});

	it('reports missing authored subjects rather than resolving by coincidence', () => {
		const { geometry } = terraceLayout();
		expect(
			resolveLayoutSurfaceReference(geometry, { regionId: 'missing-region', surface: 'top' })
		).toMatchObject({ kind: 'unresolved', code: 'missing-region' });
		expect(
			resolveLayoutSurfaceReference(geometry, { roomId: 'missing-room', surface: 'floor' })
		).toMatchObject({ kind: 'unresolved', code: 'missing-space' });
	});
});

describe('V1d overhead queries and derived contact', () => {
	it('offers an overhead region underside to a downward query and no upward face to a floor region', () => {
		const overhead = regionOnly('overhead', 2.5);
		const down = queryOverheadSupports(overheadSupportSnapshotOf(overhead.geometry), {
			generationId: GENERATION,
			x: 3,
			z: 2
		});
		expect(down.kind).toBe('candidates');
		if (down.kind !== 'candidates') return;
		expect(down.candidates).toContainEqual(
			expect.objectContaining({
				elevation: 2.5,
				downNormal: [0, -1, 0],
				witnesses: [expect.objectContaining({ source: { kind: 'region', regionId: overhead.regionId } })]
			})
		);

		const floor = regionOnly('floor', 0.6);
		expect(
			queryOverheadSupports(overheadSupportSnapshotOf(floor.geometry), {
				generationId: GENERATION,
				x: 3,
				z: 2
			}).kind
		).toBe('none');
	});

	it('counts roots on a floor region, changes with Layout-only geometry, and leaves Scene bytes identical', () => {
		const start = terraceLayout();
		const scene = sceneWith([
			box('terrace-a', [3, 1.1, 2]),
			box('terrace-b', [4, 1.1, 2]),
			box('room-floor', [1, 0.5, 1]),
			box('lifted', [3, 2.6, 2])
		]);
		const beforeBytes = JSON.stringify(scene);
		expect(
			countSceneRootsOnFloorRegion({
				geometry: start.geometry,
				generationId: GENERATION,
				scene,
				regionId: start.regionId
			})
		).toBe(2);

		const moved = planMoveRegion(start.document, start.regionId, [10, 0]);
		expect(moved.kind).toBe('success');
		if (moved.kind !== 'success') return;
		const movedGeometry = compileWallFirstLayoutGeometry(moved.document).geometry;
		expect(
			countSceneRootsOnFloorRegion({
				geometry: movedGeometry,
				generationId: GENERATION,
				scene,
				regionId: start.regionId
			})
		).toBe(0);
		expect(JSON.stringify(scene)).toBe(beforeBytes);
	});

	it('merges a coplanar Room floor and region top into one counted support', () => {
		const withRegion = addRegion(enclosure(), {
			footprint: [
				[2, 1],
				[5, 1],
				[5, 4],
				[2, 4]
			],
			elevation: 0
		});
		const coplanar = {
			geometry: compileWallFirstLayoutGeometry(withRegion.document).geometry,
			regionId: withRegion.regionId
		};
		const scene = sceneWith([box('floor-box', [3, 0.5, 2])]);
		expect(
			countSceneRootsOnFloorRegion({
				geometry: coplanar.geometry,
				generationId: GENERATION,
				scene,
				regionId: coplanar.regionId
			})
		).toBe(1);
		const queried = queryFloorSupports(floorSupportSnapshotOf(coplanar.geometry), {
			generationId: GENERATION,
			x: 3,
			z: 2
		});
		expect(queried.kind).toBe('candidates');
		if (queried.kind !== 'candidates') return;
		expect(queried.candidates).toHaveLength(1);
		expect(queried.candidates[0]!.witnesses.map((witness) => witness.source.kind).sort()).toEqual([
			'region',
			'room'
		]);
	});

	it('keeps a required elevation while moving across a region top and refuses a different one', () => {
		const { geometry } = terraceLayout();
		expect(
			resolveSceneSupportOnGeometry({
				geometry,
				generationId: GENERATION,
				point: [3, 2],
				requiredElevation: 0.6
			})
		).toMatchObject({ kind: 'resolved', support: { elevation: 0.6 } });
		expect(
			resolveSceneSupportOnGeometry({
				geometry,
				generationId: GENERATION,
				point: [3, 2],
				requiredElevation: 0.6 + FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters * 2
			})
		).toMatchObject({ kind: 'refused', code: 'no-support' });
	});
});
