/**
 * T2.S4a — the Finish and palette planners.
 *
 * Every write is one F.4 intent. These tests pin the plan's assignment normal
 * form, the shared-Finish reach rules, palette follower preservation and the
 * record-scope grants, at the active Scene unit format read from the package
 * (never a literal version).
 */
import { describe, expect, it } from 'vitest';
import type {
	AuthoringIntent,
	SemanticReference,
	SceneEntity,
	SceneMaterialInstance
} from '@portfolio/project-model';
import {
	createEmptyWallFirstLayoutDocument,
	surfaceKey,
	surfacesOfSpace,
	type LayoutDocumentWallFirst,
	type LayoutSurfaceRef
} from '@portfolio/layout-core';
import {
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type CameraFreeSceneDocument,
	type ProjectEnvelope,
	type ScenePaletteSlot
} from '@portfolio/project-model/units';
import { serializeProjectEnvelope } from '@portfolio/project-model/units';
import { NEUTRAL_RECIPE, catalogueRecipe, type Recipe } from '@portfolio/project-model/materials';
import {
	applyFinishEdit,
	checkSceneRecordScope,
	createFinishPlanners,
	effectiveColorOf,
	findIdenticalFinish,
	SCENE_FINISH_ASSIGN,
	SCENE_SURFACE_FINISH_ASSIGN,
	finishOf,
	isPristineInstance,
	withFinishInstancePreview,
	FINISH_PREVIEW_INSTANCE_ID,
	usersOfFinish
} from '@portfolio/project-model/scene-planning';
import {
	admitUnitContent,
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject,
	unitRevision
} from '../authoring/__fixtures__/unit-envelope-fixtures';
import { g1DocumentWithRooms, g1RoomPolygon } from '../layout/__fixtures__/layout-g1-fixtures';

const LABELS: Record<string, string> = {
	'wood-walnut': 'Walnut Wood',
	'plaster-warm': 'Warm Plaster',
	'brass-aged': 'Aged Brass',
	'marble-light': 'Light Marble',
	'velvet-dark': 'Dark Velvet',
	'paper-aged': 'Aged Paper'
};

type SceneInput = {
	readonly entities: readonly SceneEntity[];
	readonly layout?: LayoutDocumentWallFirst;
	readonly materials?: readonly SceneMaterialInstance[];
	readonly surfaceFinishes?: CameraFreeSceneDocument['surfaceFinishes'];
	readonly palette?: readonly ScenePaletteSlot[];
	readonly textures?: CameraFreeSceneDocument['textures'];
	readonly resources?: ProjectEnvelope['units']['resources']['data'];
};

function box(id: string, materialId = 'plaster-warm', instanceId?: string): SceneEntity {
	return {
		kind: 'primitive',
		id,
		name: id,
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId,
		castShadow: true,
		receiveShadow: true,
		...(instanceId === undefined ? {} : { materialInstanceId: instanceId })
	} as SceneEntity;
}

function model(id: string, instanceId?: string): SceneEntity {
	return {
		kind: 'model',
		id,
		name: id,
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		assetId: 'paris-salon-chair',
		fallback: 'chair',
		...(instanceId === undefined ? {} : { materialInstanceId: instanceId })
	} as unknown as SceneEntity;
}

function light(id: string): SceneEntity {
	return {
		kind: 'light',
		id,
		name: id,
		position: [0, 2, 0],
		rotation: [0, 0, 0],
		light: 'point',
		color: '#ffffff',
		intensity: 1,
		castShadow: false
	} as SceneEntity;
}

function wallLayout(ids: readonly string[] = ['wall-a']): LayoutDocumentWallFirst {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.junctions = ids.flatMap((id, index) => [
		{ id: `${id}:start`, point: [index * 5, 0] as [number, number] },
		{ id: `${id}:end`, point: [index * 5 + 4, 0] as [number, number] }
	]);
	layout.walls = ids.map((id) => ({
		id, startJunctionId: `${id}:start`, endJunctionId: `${id}:end`, thickness: 0.2, height: 3, centerline: { kind: 'line' }
	}));
	return layout;
}

function wallSideTarget(project: ProjectEnvelope, wallId: string, side: 'left' | 'right'): SemanticReference {
	return surfaceTarget(project, { kind: 'wall-side', wallId, side });
}

function surfaceTarget(project: ProjectEnvelope, surface: LayoutSurfaceRef): SemanticReference {
	const layout = project.units.layout.data;
	const subject = surface.kind === 'wall-side'
		? { kind: 'wall' as const, id: surface.wallId }
		: surface.kind === 'region-face'
			? { kind: 'region' as const, id: surface.regionId }
			: { kind: 'room' as const, id: surface.roomId };
	const componentId = surface.kind === 'wall-side'
		? `side:${surface.side}`
		: surface.kind === 'region-face'
			? surface.face
			: surface.kind === 'room-floor' ? 'floor' : 'lid';
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: project.units.layout.header.contentRevision },
		subject,
		instancePath: [],
		location: { kind: 'layout-location', levelId: layout.floor.id, structureInstancePath: [] },
		componentId,
		capabilityId: null
	};
}

function regionLayout(): LayoutDocumentWallFirst {
	const layout = g1DocumentWithRooms([g1RoomPolygon('paint-space', [[0, 0], [6, 0], [6, 4], [0, 4]])]);
	layout.regions.push({
		id: 'terrace',
		role: 'floor',
		footprint: { kind: 'polygon', points: [[1, 1], [5, 1], [5, 3], [1, 3]] },
		elevation: 0.2,
		thickness: 0.2,
		form: { kind: 'flat' },
		intendedGaps: []
	});
	return layout;
}

function sceneDocument(input: SceneInput): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [...(input.textures ?? [])],
		materials: [...(input.materials ?? [])],
		entities: [...input.entities],
		...(input.surfaceFinishes === undefined ? {} : { surfaceFinishes: [...input.surfaceFinishes] }),
		...(input.palette === undefined ? {} : { palette: input.palette })
	};
}

async function sceneEnvelope(input: SceneInput): Promise<ProjectEnvelope> {
	return createUnitProject({
		id: 'project-finish',
		name: 'Finish',
		...(input.layout === undefined ? {} : { layout: input.layout }),
		scene: sceneDocument(input),
		...(input.resources === undefined ? {} : { resources: input.resources })
	});
}

async function directPlan(
	input: SceneInput,
	kind: string,
	payload: unknown,
	entityIds: readonly string[] = [],
	allocatedIds: readonly { kind: string; id: string }[] = [],
	targetsFor?: (project: ProjectEnvelope) => readonly SemanticReference[],
	materialProof?: (request: never) => import('@portfolio/project-model/materials').MaterialDigestProof
) {
	const project = await createUnitProject({
		id: 'project-finish', name: 'Finish',
		...(input.layout === undefined ? {} : { layout: input.layout }),
		scene: sceneDocument(input),
		...(input.resources === undefined ? {} : { resources: input.resources })
	});
	const header = project.units.scene.header;
	const acceptedRevision = { projectId: project.id, revisionId: 'revision-1' };
	const identity = { acceptedRevision, sourceContentId: 'source-content' };
	const intent: AuthoringIntent = {
		version: 1,
		kind,
		operationId: `${kind}-direct`,
		expectedRevision: acceptedRevision,
		targets: targetsFor?.(project) ?? entityIds.map((id) => ({
			version: 1 as const,
			domain: 'scene' as const,
			revision: { kind: 'exact' as const, contentRevision: header.contentRevision },
			subject: { kind: 'entity' as const, id },
			instancePath: [],
			location: { kind: 'project-root' as const },
			componentId: null,
			capabilityId: null
		})),
		payload: payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds
	};
	const planner = createFinishPlanners({
		labelForMaterial: (id) => LABELS[id] ?? id,
		...(materialProof === undefined ? {} : { materialProof: materialProof as never })
	}).find(
		(candidate) => candidate.kind === kind
	)!;
	return planner.prepare({
		snapshot: {
			acceptedRevision,
			sourceContentId: identity.sourceContentId,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			domain: { identity, source: project }
		},
		intent,
		capturedInputs: [],
		allocatedIds
	});
}

function plannedScene(outcome: Awaited<ReturnType<typeof directPlan>>): CameraFreeSceneDocument {
	if (outcome.kind !== 'prepared') {
		throw new Error(`expected a prepared candidate, received ${JSON.stringify(outcome)}`);
	}
	return outcome.candidate.source.units.scene.data;
}

async function boot(input: SceneInput) {
	const project = await createUnitProject({
		id: 'project-finish',
		name: 'Finish',
		...(input.layout === undefined ? {} : { layout: input.layout }),
		scene: sceneDocument(input),
		...(input.resources === undefined ? {} : { resources: input.resources })
	});
	const revision = unitRevision(project.id);
	const admitted = await admitUnitProject(project, revision);
	if (admitted.kind !== 'admitted') {
		throw new Error(`the Finish fixture was not admitted: ${JSON.stringify(admitted.issues)}`);
	}
	const coordinator = await createUnitCoordinator({
		baseline: {
			revision,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId
		},
		planners: createFinishPlanners({ labelForMaterial: (id) => LABELS[id] ?? id }),
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`
	});
	return coordinator;
}

type Coordinator = Awaited<ReturnType<typeof boot>>;

function sourceScene(coordinator: Coordinator): CameraFreeSceneDocument {
	return coordinator.current().source.units.scene.data;
}

function reference(coordinator: Coordinator, id: string) {
	return {
		version: 1 as const,
		domain: 'scene' as const,
		revision: {
			kind: 'exact' as const,
			contentRevision: coordinator.current().source.units.scene.header.contentRevision
		},
		subject: { kind: 'entity' as const, id },
		instancePath: [],
		location: { kind: 'project-root' as const },
		componentId: null,
		capabilityId: null
	};
}

function intentOf(
	coordinator: Coordinator,
	kind: string,
	payload: unknown,
	entityIds: readonly string[] = [],
	allocatedIds: readonly { kind: string; id: string }[] = []
): AuthoringIntent {
	return {
		version: 1,
		kind,
		operationId: `${kind}-${Math.random().toString(16).slice(2)}`,
		expectedRevision: coordinator.acceptedRevision(),
		targets: entityIds.map((id) => reference(coordinator, id)),
		payload: payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds
	};
}

async function accept(coordinator: Coordinator, intent: AuthoringIntent) {
	const result = await coordinator.accept(intent);
	return result;
}

function acceptedScene(result: Awaited<ReturnType<typeof accept>>): CameraFreeSceneDocument {
	if (result.kind !== 'accepted') {
		throw new Error(`expected an accepted result, received ${JSON.stringify(result)}`);
	}
	return result.snapshot.domain.source.units.scene.data;
}

function finishKeyOf(scene: CameraFreeSceneDocument, entityId: string): string | null {
	const entity = scene.entities.find((candidate) => candidate.id === entityId)!;
	return finishOf(entity, scene.materials);
}

describe('scene-surface-finish-assign', () => {
	it('writes sorted shared Wall-side assignments through exact qualified Layout references', async () => {
		const layout = wallLayout(['wall-a', 'z-wall']);
		const surfaces = [
			{ kind: 'wall-side' as const, wallId: 'z-wall', side: 'right' as const },
			{ kind: 'wall-side' as const, wallId: 'wall-a', side: 'left' as const }
		];
		const outcome = await directPlan(
			{ entities: [], layout },
			SCENE_SURFACE_FINISH_ASSIGN,
			{ finish: { curated: 'marble-light' }, surfaces },
			[],
			[],
			(project) => surfaces.map((surface) => wallSideTarget(project, surface.wallId, surface.side))
		);
		expect(outcome.kind).toBe('prepared');
		const assignments = plannedScene(outcome).surfaceFinishes ?? [];
		expect(assignments).toEqual([
			{ surface: { kind: 'wall-side', wallId: 'wall-a', side: 'left' }, finish: { materialId: 'marble-light' } },
			{ surface: { kind: 'wall-side', wallId: 'z-wall', side: 'right' }, finish: { materialId: 'marble-light' } }
		]);
		expect(assignments.map((entry) => surfaceKey(entry.surface))).toEqual(
			[...assignments.map((entry) => surfaceKey(entry.surface))].sort()
		);
	});

	it('assigns a Space-expanded Wall, floor, lid and Region set in one byte-exact Undo/Redo entry', async () => {
		const layout = regionLayout();
		const room = layout.rooms[0]!;
		const surfaces = surfacesOfSpace(layout, room.id).surfaces;
		expect(surfaces).toContainEqual({ kind: 'room-floor', roomId: room.id });
		expect(surfaces).toContainEqual({ kind: 'room-lid', roomId: room.id });
		expect(surfaces).toContainEqual({ kind: 'region-face', regionId: 'terrace', face: 'top' });
		const coordinator = await boot({ entities: [], layout });
		const source = coordinator.current().source;
		const beforeBytes = serializeProjectEnvelope(source);
		const result = await accept(coordinator, {
			version: 1,
			kind: SCENE_SURFACE_FINISH_ASSIGN,
			operationId: 'space-paint-all-surfaces',
			expectedRevision: coordinator.acceptedRevision(),
			targets: surfaces.map((surface) => surfaceTarget(source, surface)),
			payload: { finish: { curated: 'velvet-dark' }, surfaces },
			capturedInputs: [],
			allocatedIds: []
		});
		expect(result.kind).toBe('accepted');
		const paintedBytes = serializeProjectEnvelope(coordinator.current().source);
		const assignments = sourceScene(coordinator).surfaceFinishes ?? [];
		expect(assignments).toEqual([...surfaces]
			.sort((left, right) => surfaceKey(left).localeCompare(surfaceKey(right)))
			.map((surface) => ({ surface, finish: { materialId: 'velvet-dark' } })));
		expect(assignments).toHaveLength(surfaces.length);

		expect((await coordinator.undo()).kind).toBe('restored');
		expect(serializeProjectEnvelope(coordinator.current().source)).toBe(beforeBytes);
		expect(sourceScene(coordinator).surfaceFinishes).toBeUndefined();
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(serializeProjectEnvelope(coordinator.current().source)).toBe(paintedBytes);
	});

	it('paints a Region top and underside in separate exact entries with Undo/Redo', async () => {
		const layout = regionLayout();
		const coordinator = await boot({ entities: [], layout });
		const paint = async (surface: LayoutSurfaceRef, curated: string) => {
			const source = coordinator.current().source;
			return accept(coordinator, {
				version: 1,
				kind: SCENE_SURFACE_FINISH_ASSIGN,
				operationId: `paint-${surface.kind}`,
				expectedRevision: coordinator.acceptedRevision(),
				targets: [surfaceTarget(source, surface)],
				payload: { finish: { curated }, surfaces: [surface] },
				capturedInputs: [],
				allocatedIds: []
			});
		};
		const top = { kind: 'region-face', regionId: 'terrace', face: 'top' } as const;
		const underside = { kind: 'region-face', regionId: 'terrace', face: 'underside' } as const;
		expect(await paint(top, 'velvet-dark')).toMatchObject({ kind: 'accepted' });
		expect(sourceScene(coordinator).surfaceFinishes).toEqual([
			{ surface: top, finish: { materialId: 'velvet-dark' } }
		]);
		expect(await paint(underside, 'marble-light')).toMatchObject({ kind: 'accepted' });
		const painted = sourceScene(coordinator).surfaceFinishes;
		expect(painted).toEqual([
			{ surface: top, finish: { materialId: 'velvet-dark' } },
			{ surface: underside, finish: { materialId: 'marble-light' } }
		]);
		expect(await coordinator.undo()).toMatchObject({ kind: 'restored' });
		expect(sourceScene(coordinator).surfaceFinishes).toEqual([
			{ surface: top, finish: { materialId: 'velvet-dark' } }
		]);
		expect(await coordinator.undo()).toMatchObject({ kind: 'restored' });
		expect(sourceScene(coordinator).surfaceFinishes).toBeUndefined();
		expect(await coordinator.redo()).toMatchObject({ kind: 'restored' });
		expect(await coordinator.redo()).toMatchObject({ kind: 'restored' });
		expect(sourceScene(coordinator).surfaceFinishes).toEqual(painted);
	});

	it('refuses an open-to-sky lid and a Region edge without writing Scene', async () => {
		const layout = regionLayout();
		layout.rooms[0]!.overhead = 'open-to-sky';
		const lid = { kind: 'room-lid', roomId: layout.rooms[0]!.id } as const;
		const dormant = await directPlan(
			{ entities: [], layout },
			SCENE_SURFACE_FINISH_ASSIGN,
			{ finish: { curated: 'velvet-dark' }, surfaces: [lid] },
			[], [],
			(project) => [surfaceTarget(project, lid)]
		);
		expect(dormant).toMatchObject({ kind: 'rejected', code: 'surface_not_present' });

		const edge = { kind: 'region-face', regionId: 'terrace', face: 'edge' } as const;
		const unbounded = await directPlan(
			{ entities: [], layout: regionLayout() },
			SCENE_SURFACE_FINISH_ASSIGN,
			{ finish: { curated: 'velvet-dark' }, surfaces: [edge] },
			[], [],
			(project) => [surfaceTarget(project, edge)]
		);
		expect(unbounded.kind).toBe('rejected');
		if (unbounded.kind === 'rejected') expect(unbounded.message).toContain("'top' or 'underside'");
	});

	it('refuses stale or mismatched component targets without writing Scene', async () => {
		const layout = wallLayout();
		const surface = { kind: 'wall-side' as const, wallId: 'wall-a', side: 'left' as const };
		const outcome = await directPlan(
			{ entities: [], layout },
			SCENE_SURFACE_FINISH_ASSIGN,
			{ finish: { curated: 'brass-aged' }, surfaces: [surface] },
			[],
			[],
			(project) => [wallSideTarget(project, surface.wallId, 'right')]
		);
		expect(outcome).toMatchObject({ kind: 'rejected', code: 'invalid-target' });
	});
});

describe('surface Finish reach', () => {
	it('counts a shared Wall-side user and updates it with the shared Finish edit', async () => {
		const assignment = {
			surface: { kind: 'wall-side' as const, wallId: 'wall-a', side: 'left' as const },
			finish: { materialInstanceId: 'shared-finish' }
		};
		const input: SceneInput = {
			entities: [box('object-a', 'plaster-warm', 'shared-finish')],
			layout: wallLayout(),
			materials: [{ id: 'shared-finish', name: 'Shared Finish', base: { catalogue: 'plaster-warm' }, overrides: { color: '#aabbcc' } }],
			surfaceFinishes: [assignment]
		};
		const project = await sceneEnvelope(input);
		const scene = project.units.scene.data;
		expect(usersOfFinish(scene, 'project:shared-finish')).toHaveLength(2);
		const outcome = await directPlan(input, 'scene-finish-edit', {
			entityId: 'object-a', from: 'project:shared-finish', reach: 2, mode: 'all', edit: { roughness: 0.3 }
		}, ['object-a']);
		expect(outcome.kind).toBe('prepared');
		const after = plannedScene(outcome);
		expect(after.materials[0]).toMatchObject({ id: 'shared-finish', overrides: { roughness: 0.3 } });
		expect(after.surfaceFinishes).toEqual([assignment]);
	});

	it('writes Original as a curated surface Finish when a shared tint is cleared to pristine', async () => {
		const assignment = {
			surface: { kind: 'wall-side' as const, wallId: 'wall-a', side: 'left' as const },
			finish: { materialInstanceId: 'shared-finish' }
		};
		const input: SceneInput = {
			entities: [box('object-a', 'plaster-warm', 'shared-finish')],
			layout: wallLayout(),
			materials: [{ id: 'shared-finish', name: 'Shared Finish', base: { catalogue: 'plaster-warm' }, overrides: { color: '#aabbcc' } }],
			surfaceFinishes: [assignment]
		};
		const outcome = await directPlan(input, 'scene-finish-edit', {
			entityId: 'object-a', from: 'project:shared-finish', reach: 2, mode: 'all', edit: { color: null }
		}, ['object-a']);
		expect(outcome.kind).toBe('prepared');
		const after = plannedScene(outcome);
		expect(after.materials[0]).toMatchObject({ id: 'shared-finish', name: 'Shared Finish', base: { catalogue: 'plaster-warm' } });
		expect(isPristineInstance(after.materials[0]!)).toBe(true);
		expect(after.surfaceFinishes).toEqual([{
			surface: assignment.surface,
			finish: { materialId: 'plaster-warm' }
		}]);
	});

	it('counts present and dormant surfaces but excludes retired loaded assignments from reach and edits', async () => {
		const layout = wallLayout();
		const space = g1RoomPolygon('roof-room', [[8, 0], [12, 0], [12, 3], [8, 3]]);
		const spaceLayout = g1DocumentWithRooms([space]);
		spaceLayout.rooms[0]!.overhead = 'open-to-sky';
		layout.junctions.push(...spaceLayout.junctions);
		layout.walls.push(...spaceLayout.walls);
		layout.rooms.push(...spaceLayout.rooms);
		const assignments = [
			{ surface: { kind: 'wall-side' as const, wallId: 'wall-a', side: 'left' as const }, finish: { materialInstanceId: 'shared-finish' } },
			{ surface: { kind: 'room-lid' as const, roomId: 'roof-room' }, finish: { materialInstanceId: 'shared-finish' } },
			{ surface: { kind: 'wall-side' as const, wallId: 'wall-retired', side: 'right' as const }, finish: { materialInstanceId: 'shared-finish' } }
		].sort((left, right) => {
			const leftKey = surfaceKey(left.surface);
			const rightKey = surfaceKey(right.surface);
			return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
		});
		const input: SceneInput = {
			entities: [box('object-a', 'plaster-warm', 'shared-finish')],
			layout,
			materials: [{ id: 'shared-finish', name: 'Shared Finish', base: { catalogue: 'plaster-warm' }, overrides: { color: '#aabbcc' } }],
			surfaceFinishes: assignments
		};
		const project = await sceneEnvelope(input);
		const scene = project.units.scene.data;
		expect(usersOfFinish(scene, 'project:shared-finish', layout).map((user) => user.kind)).toEqual([
			'entity', 'surface', 'surface'
		]);
		expect(usersOfFinish(scene, 'project:shared-finish')).toHaveLength(4);

		const outcome = await directPlan(input, 'scene-finish-edit', {
			entityId: 'object-a', from: 'project:shared-finish', reach: 3, mode: 'all', edit: { roughness: 0.3 }
		}, ['object-a']);
		expect(outcome.kind).toBe('prepared');
		expect(plannedScene(outcome).surfaceFinishes).toEqual(assignments);
	});

	it('lets a single live object edit in place when its only other assignment is retired', async () => {
		const input: SceneInput = {
			entities: [box('object-a', 'plaster-warm', 'shared-finish')],
			layout: wallLayout(),
			materials: [{ id: 'shared-finish', name: 'Shared Finish', base: { catalogue: 'plaster-warm' }, overrides: { color: '#aabbcc' } }],
			surfaceFinishes: [{
				surface: { kind: 'wall-side', wallId: 'wall-retired', side: 'left' },
				finish: { materialInstanceId: 'shared-finish' }
			}]
		};
		const project = await sceneEnvelope(input);
		expect(usersOfFinish(project.units.scene.data, 'project:shared-finish', input.layout)).toHaveLength(1);
		const outcome = await directPlan(input, 'scene-finish-edit', {
			entityId: 'object-a', from: 'project:shared-finish', reach: 1, mode: 'in-place', edit: { roughness: 0.3 }
		}, ['object-a']);
		expect(outcome.kind).toBe('prepared');
	});
});

describe('scene-finish-assign', () => {
	it('gives a primitive a curated Finish through materialId alone, one Undo', async () => {
		const coordinator = await boot({ entities: [box('a')] });
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-assign', {
				finish: { curated: 'wood-walnut' },
				entityIds: ['a']
			}, ['a'])
		);
		const scene = acceptedScene(result);
		expect(scene.entities[0]).toMatchObject({ materialId: 'wood-walnut' });
		expect('materialInstanceId' in scene.entities[0]!).toBe(false);
		expect(scene.materials).toEqual([]);
		expect(finishKeyOf(scene, 'a')).toBe('curated:wood-walnut');

		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		expect(sourceScene(coordinator).entities[0]).toMatchObject({ materialId: 'plaster-warm' });
		const redone = await coordinator.redo();
		expect(redone.kind).toBe('restored');
		expect(sourceScene(coordinator).entities[0]).toMatchObject({ materialId: 'wood-walnut' });
	});

	it('installs one pristine Finish for models and reuses it on the next paint', async () => {
		const first = plannedScene(
			await directPlan(
				{ entities: [model('m1'), model('m2')] },
				'scene-finish-assign',
				{ finish: { curated: 'wood-walnut' }, entityIds: ['m1', 'm2'] },
				['m1', 'm2'],
				[{ kind: 'scene-finish', id: 'pristine-walnut' }]
			)
		);
		expect(first.materials).toEqual([
			{ id: 'pristine-walnut', name: 'Walnut Wood', base: { catalogue: 'wood-walnut' } }
		]);
		expect(isPristineInstance(first.materials[0]!)).toBe(true);
		expect(
			first.entities.every(
				(entity) => (entity as { materialInstanceId?: string }).materialInstanceId === 'pristine-walnut'
			)
		).toBe(true);

		const reused = plannedScene(
			await directPlan(
				{
					entities: [model('m1', 'pristine-walnut'), model('m2')],
					materials: [
						{ id: 'pristine-walnut', name: 'Walnut Wood', base: { catalogue: 'wood-walnut' } }
					]
				},
				'scene-finish-assign',
				{ finish: { curated: 'wood-walnut' }, entityIds: ['m2'] },
				['m2']
			)
		);
		expect(reused.materials).toHaveLength(1);
		expect(
			(reused.entities.find((entity) => entity.id === 'm2') as { materialInstanceId?: string })
				.materialInstanceId
		).toBe('pristine-walnut');
	});

	it('collects the pristine instance a write leaves with no user', async () => {
		const scene = plannedScene(
			await directPlan(
				{
					entities: [model('m1', 'pristine-old')],
					materials: [
						{ id: 'pristine-old', name: 'Warm Plaster', base: { catalogue: 'plaster-warm' } }
					]
				},
				'scene-finish-assign',
				{ finish: { curated: 'brass-aged' }, entityIds: ['m1'] },
				['m1'],
				[{ kind: 'scene-finish', id: 'pristine-brass' }]
			)
		);
		expect(scene.materials.map((material) => material.id)).toEqual(['pristine-brass']);
	});

	it('assigns a project Finish to a primitive and a model in one write', async () => {
		const scene = plannedScene(
			await directPlan(
				{
					entities: [box('a'), model('m')],
					materials: [
						{ id: 'p1', name: 'Walnut 2', base: { catalogue: 'wood-walnut' }, overrides: { roughness: 0.7 } }
					]
				},
				'scene-finish-assign',
				{ finish: { project: 'p1' }, entityIds: ['a', 'm'] },
				['a', 'm']
			)
		);
		expect(scene.entities.find((entity) => entity.id === 'a')).toMatchObject({
			materialId: 'wood-walnut',
			materialInstanceId: 'p1'
		});
		expect(scene.entities.find((entity) => entity.id === 'm')).toMatchObject({
			materialInstanceId: 'p1'
		});
	});

	it("returns a model to Model's own by deleting the instance", async () => {
		const scene = plannedScene(
			await directPlan(
				{
					entities: [model('m', 'p1')],
					materials: [
						{ id: 'p1', name: 'Walnut 2', base: { catalogue: 'wood-walnut' }, overrides: { color: '#111111' } }
					]
				},
				'scene-finish-assign',
				{ finish: 'model-own', entityIds: ['m'] },
				['m']
			)
		);
		expect('materialInstanceId' in scene.entities[0]!).toBe(false);
		expect(finishKeyOf(scene, 'm')).toBe('model-own');
	});

	it('refuses a light, Model’s own on a primitive and a no-change paint', async () => {
		const coordinator = await boot({ entities: [box('a'), light('l')] });
		const lit = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-assign', {
				finish: { curated: 'wood-walnut' },
				entityIds: ['l']
			}, ['l'])
		);
		expect(lit).toMatchObject({ kind: 'rejected', reason: 'not-paintable' });

		const own = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-assign', {
				finish: 'model-own',
				entityIds: ['a']
			}, ['a'])
		);
		expect(own).toMatchObject({ kind: 'rejected', reason: 'not-paintable' });

		const same = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-assign', {
				finish: { curated: 'plaster-warm' },
				entityIds: ['a']
			}, ['a'])
		);
		expect(same).toMatchObject({ kind: 'rejected', reason: 'no-change' });
	});
});

describe('the Finish Card preview', () => {
	it('is a render-only synthetic instance on every listed user and leaves the accepted Scene untouched', () => {
		const accepted = sceneDocument({
			entities: [box('a', 'wood-walnut', 'p1'), box('b', 'wood-walnut', 'p1'), box('c', 'wood-walnut')],
			materials: [
				{ id: 'p1', name: 'Walnut', base: { catalogue: 'wood-walnut' }, overrides: { color: '#111111' } }
			]
		});
		const instance = { id: FINISH_PREVIEW_INSTANCE_ID, name: 'Walnut', base: { catalogue: 'wood-walnut' }, overrides: { color: '#ff0000' } } as const;
		expect(withFinishInstancePreview(accepted, null)).toBe(accepted);
		const preview = withFinishInstancePreview(accepted, { users: ['entity:a', 'entity:b'], instance });
		expect(accepted.materials).toHaveLength(1);
		expect(accepted.entities[0]).toMatchObject({ materialInstanceId: 'p1' });
		for (const id of ['a', 'b']) {
			const entity = preview.entities.find((candidate) => candidate.id === id)!;
			expect((entity as { materialInstanceId?: string }).materialInstanceId).toBe(FINISH_PREVIEW_INSTANCE_ID);
			expect(effectiveColorOf(entity, preview, () => '#000000')).toBe('#ff0000');
		}
		expect(preview.entities.find((candidate) => candidate.id === 'c')).toBe(accepted.entities[2]);
		expect(preview.materials.find((material) => material.id === FINISH_PREVIEW_INSTANCE_ID)?.overrides?.color).toBe('#ff0000');
	});

	it('previews a first Finish on a surface that has none yet, and leaves the accepted Scene unassigned', () => {
		const accepted = sceneDocument({ entities: [], materials: [] });
		const instance = { id: FINISH_PREVIEW_INSTANCE_ID, name: 'Oak', base: { catalogue: 'wood-oak-veneer' } } as const;
		const wall = JSON.stringify(['wall-side', 'w1', 'left']);
		const preview = withFinishInstancePreview(accepted, { users: [`surface:${wall}`, 'surface:not-a-key'], instance });
		expect(accepted.surfaceFinishes ?? []).toHaveLength(0);
		expect(preview.surfaceFinishes).toEqual([
			{ surface: { kind: 'wall-side', wallId: 'w1', side: 'left' }, finish: { materialInstanceId: FINISH_PREVIEW_INSTANCE_ID } }
		]);
	});
});

describe('scene-finish-edit and the shared-Finish Ask', () => {
	it('copies a shared curated Finish for Just this, leaving the other users on the base', async () => {
		const coordinator = await boot({
			entities: [box('a', 'wood-walnut'), box('b', 'wood-walnut'), box('c', 'wood-walnut')]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-edit', {
				entityId: 'a',
				from: 'curated:wood-walnut',
				reach: 3,
				mode: 'just-this',
				edit: { roughness: 0.3 }
			}, ['a'], [{ kind: 'scene-finish', id: 'walnut-gloss' }])
		);
		const scene = acceptedScene(result);
		expect(scene.materials).toEqual([
			{ id: 'walnut-gloss', name: 'Walnut Wood 2', base: { catalogue: 'wood-walnut' }, overrides: { roughness: 0.3 } }
		]);
		expect(finishKeyOf(scene, 'a')).toBe('project:walnut-gloss');
		expect(finishKeyOf(scene, 'b')).toBe('curated:wood-walnut');
		expect(finishKeyOf(scene, 'c')).toBe('curated:wood-walnut');
	});

	it('copies a shared curated Finish for All N and never mutates the catalogue', async () => {
		const coordinator = await boot({
			entities: [box('a', 'wood-walnut'), box('b', 'wood-walnut')]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-edit', {
				entityId: 'a',
				from: 'curated:wood-walnut',
				reach: 2,
				mode: 'all',
				edit: { color: '#2b1a10', metalness: 1 }
			}, ['a'], [{ kind: 'scene-finish', id: 'walnut-shared' }])
		);
		const scene = acceptedScene(result);
		expect(scene.materials).toEqual([
			{ id: 'walnut-shared', name: 'Walnut Wood 2', base: { catalogue: 'wood-walnut' }, overrides: { color: '#2b1a10', metalness: 1 } }
		]);
		expect(finishKeyOf(scene, 'a')).toBe('project:walnut-shared');
		expect(finishKeyOf(scene, 'b')).toBe('project:walnut-shared');
	});

	it('edits a single-user project Finish in place without allocating an id', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', base: { catalogue: 'plaster-warm' }, overrides: { roughness: 0.5 } }]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-edit', {
				entityId: 'a',
				from: 'project:p1',
				reach: 1,
				mode: 'in-place',
				edit: { roughness: 0.1, metalness: 1 }
			}, ['a'])
		);
		const scene = acceptedScene(result);
		expect(scene.materials[0]).toMatchObject({ id: 'p1', overrides: { roughness: 0.1, metalness: 1 } });
		expect(scene.entities[0]).toMatchObject({ materialId: 'plaster-warm', materialInstanceId: 'p1' });
	});

	it('clones a shared project Finish for Just this, keeping the original users', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1'), box('b', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', base: { catalogue: 'plaster-warm' }, overrides: { roughness: 0.5 } }]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-edit', {
				entityId: 'a',
				from: 'project:p1',
				reach: 2,
				mode: 'just-this',
				edit: { color: '#abcdef' }
			}, ['a'], [{ kind: 'scene-finish', id: 'p1-copy' }])
		);
		const scene = acceptedScene(result);
		expect(scene.materials).toEqual([
			{ id: 'p1', name: 'Plaster 2', base: { catalogue: 'plaster-warm' }, overrides: { roughness: 0.5 } },
			{ id: 'p1-copy', name: 'Plaster 2 2', base: { catalogue: 'plaster-warm' }, overrides: { roughness: 0.5, color: '#abcdef' } }
		]);
		expect(finishKeyOf(scene, 'a')).toBe('project:p1-copy');
		expect(finishKeyOf(scene, 'b')).toBe('project:p1');
	});

	it('refuses a stale reach and a mismatched mode', async () => {
		const coordinator = await boot({
			entities: [box('a', 'wood-walnut'), box('b', 'wood-walnut')]
		});
		const stale = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-edit', {
				entityId: 'a',
				from: 'curated:wood-walnut',
				reach: 3,
				mode: 'just-this',
				edit: { roughness: 0.3 }
			}, ['a'], [{ kind: 'scene-finish', id: 'unused' }])
		);
		expect(stale).toMatchObject({ kind: 'rejected', reason: 'stale-reach' });

		const mismatch = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-edit', {
				entityId: 'a',
				from: 'curated:wood-walnut',
				reach: 2,
				mode: 'in-place',
				edit: { roughness: 0.3 }
			}, ['a'])
		);
		expect(mismatch).toMatchObject({ kind: 'rejected', reason: 'mode-mismatch' });
	});
});

describe('the palette', () => {
	it('creates scene.palette on the first slot and names it Colour 1', async () => {
		const coordinator = await boot({ entities: [box('a')] });
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-palette-slot-add', { color: '#aabbcc' }, [], [
				{ kind: 'scene-palette-slot', id: 'slot-a' }
			])
		);
		const scene = acceptedScene(result);
		expect(scene.palette).toEqual([{ id: 'slot-a', name: 'Colour 1', color: '#aabbcc' }]);
	});

	it('adopts a literal into a follower in the same write', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', base: { catalogue: 'plaster-warm' }, overrides: { color: '#aabbcc' } }]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-palette-slot-add', {
				color: '#aabbcc',
				adoptEntityId: 'a',
				reach: 1,
				mode: 'in-place'
			}, ['a'], [{ kind: 'scene-palette-slot', id: 'slot-a' }])
		);
		const scene = acceptedScene(result);
		expect(scene.palette).toEqual([{ id: 'slot-a', name: 'Colour 1', color: '#aabbcc' }]);
		expect(scene.materials[0]!.overrides?.color).toEqual({ slot: 'slot-a' });
	});

	it('recolours a slot globally and its followers resolve the new colour', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1'), box('b', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', base: { catalogue: 'plaster-warm' }, overrides: { color: { slot: 'slot-a' } } }],
			palette: [{ id: 'slot-a', name: 'Accent', color: '#aabbcc' }]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-palette-slot-set', { slotId: 'slot-a', color: '#112233' })
		);
		const scene = acceptedScene(result);
		expect(scene.palette).toEqual([{ id: 'slot-a', name: 'Accent', color: '#112233' }]);
		expect(scene.materials[0]).toMatchObject({ overrides: { color: { slot: 'slot-a' } } });
	});

	it('renames a slot without changing its id, position or followers', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', base: { catalogue: 'plaster-warm' }, overrides: { color: { slot: 'slot-a' } } }],
			palette: [
				{ id: 'slot-a', name: 'Accent', color: '#aabbcc' },
				{ id: 'slot-b', name: 'Second', color: '#ddeeff' }
			]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-palette-slot-rename', { slotId: 'slot-a', name: '  Warm accent  ' })
		);
		const scene = acceptedScene(result);
		expect(scene.palette).toEqual([
			{ id: 'slot-a', name: 'Warm accent', color: '#aabbcc' },
			{ id: 'slot-b', name: 'Second', color: '#ddeeff' }
		]);
		expect(scene.materials[0]!.overrides?.color).toEqual({ slot: 'slot-a' });
	});

	it('publishes preserved correspondence for untouched entities on a palette-only write', async () => {
		const plan = await directPlan(
			{
				entities: [box('a', 'plaster-warm', 'p1'), box('b', 'plaster-warm', 'p1')],
				materials: [{ id: 'p1', name: 'Plaster 2', base: { catalogue: 'plaster-warm' }, overrides: { color: { slot: 'slot-a' } } }],
				palette: [{ id: 'slot-a', name: 'Accent', color: '#aabbcc' }]
			},
			'scene-palette-slot-set',
			{ slotId: 'slot-a', color: '#112233' }
		);
		if (plan.kind !== 'prepared') throw new Error('expected a prepared palette write');
		expect(plan.candidate.correspondence.map((entry) => [entry.before?.subject.id, entry.after?.subject.id])).toEqual([
			['a', 'a'],
			['b', 'b']
		]);
	});

	it('removes a slot, literalises its followers and drops an empty palette', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', base: { catalogue: 'plaster-warm' }, overrides: { color: { slot: 'slot-a' } } }],
			palette: [{ id: 'slot-a', name: 'Accent', color: '#aabbcc' }]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-palette-slot-remove', { slotId: 'slot-a' })
		);
		const scene = acceptedScene(result);
		expect('palette' in scene).toBe(false);
		expect(scene.materials[0]!.overrides?.color).toBe('#aabbcc');
	});

	it('refuses a ninth slot and an over-long name', async () => {
		const eight: ScenePaletteSlot[] = Array.from({ length: 8 }, (_, index) => ({
			id: `slot-${index}`,
			name: `Colour ${index + 1}`,
			color: '#aabbcc'
		}));
		const coordinator = await boot({ entities: [], palette: eight });
		const full = await accept(
			coordinator,
			intentOf(coordinator, 'scene-palette-slot-add', { color: '#aabbcc' }, [], [
				{ kind: 'scene-palette-slot', id: 'slot-nine' }
			])
		);
		expect(full).toMatchObject({ kind: 'rejected', reason: 'palette-full' });

		const rename = await accept(
			coordinator,
			intentOf(coordinator, 'scene-palette-slot-rename', {
				slotId: 'slot-0',
				name: 'x'.repeat(41)
			})
		);
		expect(rename).toMatchObject({ kind: 'rejected', reason: 'invalid-name' });
	});
});

describe('record scope', () => {
	const before = sceneDocument({
		entities: [box('a')],
		materials: [{ id: 'p1', name: 'P', base: { catalogue: 'plaster-warm' }, overrides: { color: '#111111' } }],
		palette: [{ id: 'slot-a', name: 'A', color: '#111111' }]
	});

	it('still refuses an ungranted environment or material write', () => {
		const environment = {
			...before,
			environment: { treatment: 'clay' as const }
		};
		expect(
			checkSceneRecordScope(before, environment, {
				operationKind: 'probe',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			}).map((issue) => issue.path)
		).toContain('$.scene.environment');

		const recoloured = {
			...before,
			materials: [{ ...before.materials[0]!, color: '#222222' }]
		};
		expect(
			checkSceneRecordScope(before, recoloured, {
				operationKind: 'probe',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			}).map((issue) => issue.path)
		).toContain('$.scene.materials');
	});

	it('admits the material and palette grants and still refuses reordering', () => {
		const granted = {
			...before,
			materials: [{ ...before.materials[0]!, color: '#222222' }],
			palette: [{ id: 'slot-a', name: 'Renamed', color: '#111111' }]
		};
		expect(
			checkSceneRecordScope(before, granted, {
				operationKind: 'probe',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false,
				materials: { added: [], changed: ['p1'], removed: [] },
				palette: { change: 'slots' }
			})
		).toEqual([]);

		const reordered: CameraFreeSceneDocument = {
			...before,
			materials: [
				{ id: 'p2', name: 'Second', base: { catalogue: 'plaster-warm' } },
				...before.materials
			]
		};
		expect(
			checkSceneRecordScope(before, reordered, {
				operationKind: 'probe',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false,
				materials: { added: ['p2'], changed: [], removed: [] }
			}).length
		).toBeGreaterThan(0);
	});
});

/**
 * T2.S4b — `scene-finish-from-image` and the texture grant.
 *
 * The upload is outside the Scene; this write adds the texture record, its
 * pinned `texture` resource and the Finish together, or nothing. Undo removes
 * exactly what the intent added, and the same bytes always reuse the same two
 * records.
 */
const IMAGE_ASSET = '00000000-0000-4000-8000-0000000000aa';
const IMAGE_PIN = {
	hash: `sha256-${'a'.repeat(64)}`,
	mime: 'image/png',
	size: 1024,
	locator: `/project-assets/${IMAGE_ASSET}`
};
const IMAGE_URI = `/project-assets/${IMAGE_ASSET}`;

function fromImagePayload(entityIds: readonly string[], name = 'Brick') {
	return { name, texture: { assetId: IMAGE_ASSET, pin: IMAGE_PIN }, entityIds };
}

function acceptedSnapshot(result: Awaited<ReturnType<typeof accept>>) {
	if (result.kind !== 'accepted') throw new Error('expected an accepted result');
	return result.snapshot;
}

function resourcesOf(result: Awaited<ReturnType<typeof accept>>) {
	return acceptedSnapshot(result).domain.source.units.resources.data.resources;
}

describe('scene-finish-from-image', () => {
	it('adds the texture record, the pinned resource, the Finish and its assignment in one intent', async () => {
		const coordinator = await boot({ entities: [box('a')] });
		const result = await accept(
			coordinator,
			intentOf(
				coordinator,
				'scene-finish-from-image',
				fromImagePayload(['a']),
				['a'],
				[{ kind: 'scene-finish', id: 'finish-image' }]
			)
		);
		const scene = acceptedScene(result);
		expect(scene.textures).toEqual([{ id: IMAGE_ASSET, name: 'Brick', uri: IMAGE_URI }]);
		expect(scene.materials).toEqual([
			{ id: 'finish-image', name: 'Brick', base: { catalogue: 'paper-aged' }, overrides: { color: '#ffffff', maps: { color: { image: { textureId: IMAGE_ASSET } } } } }
		]);
		expect(finishKeyOf(scene, 'a')).toBe('project:finish-image');
		expect(scene.entities[0]).toMatchObject({ materialId: 'paper-aged', materialInstanceId: 'finish-image' });
		// The resource's content revision is its byte identity, and a texture needs
		// no dependency-lock entry (unlike an approved model).
		expect(resourcesOf(result)).toEqual([
			{ kind: 'texture', id: IMAGE_ASSET, contentRevision: IMAGE_PIN.hash, pin: IMAGE_PIN, unresolved: null }
		]);
		const snapshot = acceptedSnapshot(result);
		expect(snapshot.domain.source.dependencyLock.entries ?? []).toEqual([]);
		// The candidate passes source admission, so the texture resource really
		// closes the Scene's new texture record.
		expect((await admitUnitContent(snapshot.domain.source)).kind).toBe('admitted');
	});

	it('is one Undo: the Scene returns byte-identical and the texture records disappear together', async () => {
		const coordinator = await boot({ entities: [box('a')] });
		const before = structuredClone(sourceScene(coordinator));
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-from-image', fromImagePayload(['a']), ['a'], [
				{ kind: 'scene-finish', id: 'finish-image' }
			])
		);
		expect(acceptedScene(result).textures).toHaveLength(1);
		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		expect(sourceScene(coordinator)).toEqual(before);
		expect(coordinator.current().source.units.resources.data.resources).toEqual([]);
		const redone = await coordinator.redo();
		expect(redone.kind).toBe('restored');
		// Redo restores the allocated id and both records exactly.
		expect(sourceScene(coordinator).textures).toEqual([{ id: IMAGE_ASSET, name: 'Brick', uri: IMAGE_URI }]);
		expect(finishKeyOf(sourceScene(coordinator), 'a')).toBe('project:finish-image');
	});

	it('reuses the image records for a second Finish and never duplicates them', async () => {
		const coordinator = await boot({ entities: [box('a'), box('b')] });
		await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-from-image', fromImagePayload(['a']), ['a'], [
				{ kind: 'scene-finish', id: 'finish-one' }
			])
		);
		const second = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-from-image', { ...fromImagePayload(['b'], 'Brick 3') }, ['b'], [
				{ kind: 'scene-finish', id: 'finish-two' }
			])
		);
		const scene = acceptedScene(second);
		expect(scene.textures).toHaveLength(1);
		expect(scene.materials.map((material) => material.id)).toEqual(['finish-one', 'finish-two']);
		expect(scene.materials[1]).toMatchObject({ name: 'Brick 3', overrides: { maps: { color: { image: { textureId: IMAGE_ASSET } } } } });
		expect(resourcesOf(second)).toHaveLength(1);
		expect(finishKeyOf(scene, 'a')).toBe('project:finish-one');
		expect(finishKeyOf(scene, 'b')).toBe('project:finish-two');
	});

	it('refuses a texture record with the same id but another URI', async () => {
		const coordinator = await boot({
			entities: [box('a')],
			textures: [{ id: IMAGE_ASSET, name: 'Brick', uri: '/textures/brick.png' }],
			resources: {
				formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
				resources: [
					{
						kind: 'texture',
						id: IMAGE_ASSET,
						contentRevision: IMAGE_PIN.hash,
						pin: { ...IMAGE_PIN, locator: '/textures/brick.png' },
						unresolved: null
					}
				]
			}
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-from-image', fromImagePayload(['a']), ['a'], [
				{ kind: 'scene-finish', id: 'finish-image' }
			])
		);
		expect(result.kind).toBe('rejected');
		if (result.kind === 'rejected') expect(result.reason).toBe('texture-mismatch');
		expect(sourceScene(coordinator).textures).toEqual([{ id: IMAGE_ASSET, name: 'Brick', uri: '/textures/brick.png' }]);
	});

	it('refuses a pin that names another locator', async () => {
		const coordinator = await boot({ entities: [box('a')] });
		const result = await accept(
			coordinator,
			intentOf(
				coordinator,
				'scene-finish-from-image',
				{
					...fromImagePayload(['a']),
					texture: { assetId: IMAGE_ASSET, pin: { ...IMAGE_PIN, locator: '/project-assets/another' } }
				},
				['a'],
				[{ kind: 'scene-finish', id: 'finish-image' }]
			)
		);
		expect(result.kind).toBe('rejected');
		if (result.kind === 'rejected') expect(result.reason).toBe('invalid-pin');
		expect(sourceScene(coordinator).textures).toEqual([]);
	});

	it('creates a Finish with no user when the Library had no selection', async () => {
		const coordinator = await boot({ entities: [box('a')] });
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-from-image', fromImagePayload([]), [], [
				{ kind: 'scene-finish', id: 'finish-image' }
			])
		);
		const scene = acceptedScene(result);
		expect(scene.materials.map((material) => material.id)).toEqual(['finish-image']);
		expect(finishKeyOf(scene, 'a')).toBe('curated:plaster-warm');
	});

	it('replaces an image through the Finish edit rules: Just this clones and All N edits in place', async () => {
		const coordinator = await boot({
			entities: [box('a'), box('b')],
			materials: [
				{ id: 'shared', name: 'Shared', base: { catalogue: 'plaster-warm' }, overrides: { roughness: 0.4 } },
				{ id: 'single', name: 'Single', base: { catalogue: 'wood-walnut' } }
			]
		});
		await accept(coordinator, intentOf(coordinator, 'scene-finish-assign', { finish: { project: 'shared' }, entityIds: ['a', 'b'] }, ['a', 'b']));
		// A replacement on the shared Finish asks for a clone and addresses only `a`.
		const cloned = await accept(
			coordinator,
			intentOf(
				coordinator,
				'scene-finish-from-image',
				{
					...fromImagePayload([], 'Brick'),
					replaceFinishOf: { entityId: 'a', reach: 2, mode: 'just-this' }
				},
				['a'],
				[{ kind: 'scene-finish', id: 'shared-clone' }]
			)
		);
		const scene = acceptedScene(cloned);
		expect(scene.textures).toEqual([{ id: IMAGE_ASSET, name: 'Brick', uri: IMAGE_URI }]);
		expect(scene.materials.find((material) => material.id === 'shared')).toMatchObject({ overrides: { roughness: 0.4 } });
		expect(scene.materials.find((material) => material.id === 'shared-clone')).toMatchObject({
			name: 'Shared 2',
			overrides: { maps: { color: { image: { textureId: IMAGE_ASSET } } } }
		});
		expect(finishKeyOf(scene, 'a')).toBe('project:shared-clone');
		expect(finishKeyOf(scene, 'b')).toBe('project:shared');
		// The same bytes on the other user edit the shared Finish in place.
		const replaced = await accept(
			coordinator,
			intentOf(
				coordinator,
				'scene-finish-from-image',
				{
					...fromImagePayload([], 'Brick'),
					replaceFinishOf: { entityId: 'b', reach: 1, mode: 'in-place' }
				},
				['b'],
				[]
			)
		);
		const replacedScene = acceptedScene(replaced);
		expect(replacedScene.materials.find((material) => material.id === 'shared')).toMatchObject({
			overrides: { maps: { color: { image: { textureId: IMAGE_ASSET } } } }
		});
		expect(replacedScene.textures).toHaveLength(1);
	});

	it('removes the image, restores the base colour rule and keeps the orphan texture record', async () => {
		const coordinator = await boot({
			entities: [box('a')],
			materials: [
				{ id: 'image-finish', name: 'Brick', base: { catalogue: 'paper-aged' }, overrides: { color: '#ffffff', maps: { color: { image: { textureId: IMAGE_ASSET } } } } }
			],
			textures: [{ id: IMAGE_ASSET, name: 'Brick', uri: IMAGE_URI }],
			resources: {
				formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
				resources: [
					{ kind: 'texture', id: IMAGE_ASSET, contentRevision: IMAGE_PIN.hash, pin: IMAGE_PIN, unresolved: null }
				]
			}
		});
		await accept(coordinator, intentOf(coordinator, 'scene-finish-assign', { finish: { project: 'image-finish' }, entityIds: ['a'] }, ['a']));
		const removed = await accept(
			coordinator,
			intentOf(
				coordinator,
				'scene-finish-edit',
				{ entityId: 'a', from: 'project:image-finish', reach: 1, mode: 'in-place', edit: { colorMap: null } },
				['a']
			)
		);
		const scene = acceptedScene(removed);
		const instance = scene.materials.find((material) => material.id === 'image-finish')!;
		expect(instance.overrides?.maps).toBeUndefined();
		// The white tint was only there to let the image through; removing it lets
		// the base material's own colour rule return.
		expect(instance.overrides?.color).toBeUndefined();
		// Orphan textures follow the asset's retention; the Scene write never
		// deletes bytes it cannot see.
		expect(scene.textures).toHaveLength(1);
	});
});

describe('scene-finish-edit — Scale and Direction', () => {
	it('writes tileMetres and a normalised rotation through the ordinary Ask rules', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p')],
			materials: [{ id: 'p', name: 'P', base: { catalogue: 'plaster-warm' }, overrides: { roughness: 0.5 } }]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-edit', {
				entityId: 'a',
				from: 'project:p',
				reach: 1,
				mode: 'in-place',
				edit: { tileMeters: [0.5, 0.25], rotation: -Math.PI / 2 }
			}, ['a'])
		);
		const scene = acceptedScene(result);
		const instance = scene.materials.find((material) => material.id === 'p')!;
		const mapping = instance.overrides?.mapping;
		expect(mapping?.kind === 'target' ? mapping.metric.tileMeters : undefined).toEqual([0.5, 0.25]);
		expect(mapping?.kind === 'target' ? mapping.metric.rotation : undefined).toBeCloseTo((3 * Math.PI) / 2, 10);
	});

	it('deletes the mapping when a null edit leaves nothing', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p')],
			materials: [
				{ id: 'p', name: 'P', base: { catalogue: 'plaster-warm' }, overrides: { mapping: { kind: 'target', metric: { tileMeters: [1, 2], rotation: 0, offset: [0, 0] } } } }
			]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-finish-edit', {
				entityId: 'a',
				from: 'project:p',
				reach: 1,
				mode: 'in-place',
				edit: { tileMeters: null }
			}, ['a'])
		);
		const instance = acceptedScene(result).materials.find((material) => material.id === 'p')!;
		expect(instance.overrides?.mapping).toBeUndefined();
	});
});

describe('applyFinishEdit preserves authored mapping meaning', () => {
	it('keeps an explicit value even when it equals the catalogue base', () => {
		const base = catalogueRecipe('plaster-warm')!.mapping;
		if (base.kind !== 'target') throw new Error('fixture base is not target-mapped');
		const edited = applyFinishEdit(
			{ id: 'p', name: 'P', base: { catalogue: 'plaster-warm' } },
			{ tileMeters: [base.metric.tileMeters[0], base.metric.tileMeters[1]] }
		);
		expect(edited.overrides?.mapping).toEqual({ kind: 'target', metric: base.metric });
	});

	it('preserves an existing surface mapping kind and its offset', () => {
		const edited = applyFinishEdit(
			{
				id: 'p',
				name: 'P',
				base: { catalogue: 'plaster-warm' },
				overrides: { mapping: { kind: 'surface', metric: { tileMeters: [2, 2], rotation: 0.1, offset: [0.2, 0.3] } } }
			},
			{ rotation: 0.4 }
		);
		expect(edited.overrides?.mapping).toEqual({
			kind: 'surface',
			metric: { tileMeters: [2, 2], rotation: 0.4, offset: [0.2, 0.3] }
		});
	});

	it('does not reinterpret a uv repeat as metres', () => {
		const existing: SceneMaterialInstance = {
			id: 'p', name: 'P', base: { catalogue: 'plaster-warm' },
			overrides: { mapping: { kind: 'uv', set: 0, repeat: [2, 3], rotation: 0.1, offset: [0, 0] } }
		};
		const rotated = applyFinishEdit(existing, { rotation: 0.4 });
		expect(rotated.overrides?.mapping).toEqual({
			kind: 'uv', set: 0, repeat: [2, 3], rotation: 0.4, offset: [0, 0]
		});
		const metric = applyFinishEdit(existing, { tileMeters: [0.5, 0.75] });
		const mapping = metric.overrides?.mapping;
		expect(mapping?.kind).toBe('target');
		expect(mapping?.kind === 'target' ? mapping.metric.tileMeters : null).toEqual([0.5, 0.75]);
	});

	it('preserves inherited uv mapping (set: 1, repeat, offset) when rotating a resource-backed Finish', () => {
		const baseRecipe: Recipe = {
			...NEUTRAL_RECIPE,
			mapping: { kind: 'uv', set: 1, repeat: [3, 4], rotation: 0.1, offset: [0.25, 0.5] }
		};
		const resourceFinish: SceneMaterialInstance = {
			id: 'p',
			name: 'P',
			base: { material: `sha256-${'a'.repeat(64)}` }
		};
		const rotated = applyFinishEdit(resourceFinish, { rotation: 0.75 }, baseRecipe);
		expect(rotated.overrides?.mapping).toEqual({
			kind: 'uv',
			set: 1,
			repeat: [3, 4],
			rotation: 0.75,
			offset: [0.25, 0.5]
		});
		const metric = applyFinishEdit(resourceFinish, { tileMeters: [0.5, 0.5] }, baseRecipe);
		expect(metric.overrides?.mapping).toEqual({
			kind: 'target',
			metric: { tileMeters: [0.5, 0.5], rotation: 0, offset: [0, 0] }
		});
		expect(applyFinishEdit(metric, { tileMeters: null }, baseRecipe).overrides?.mapping).toBeUndefined();
	});

	it('preserves inherited surface mapping kind when rotating or scaling a resource-backed Finish', () => {
		const baseRecipe: Recipe = {
			...NEUTRAL_RECIPE,
			mapping: { kind: 'surface', metric: { tileMeters: [2, 3], rotation: 0.1, offset: [0.2, 0.4] } }
		};
		const resourceFinish: SceneMaterialInstance = {
			id: 'p',
			name: 'P',
			base: { material: `sha256-${'b'.repeat(64)}` }
		};
		const rotated = applyFinishEdit(resourceFinish, { rotation: 0.9 }, baseRecipe);
		expect(rotated.overrides?.mapping).toEqual({
			kind: 'surface',
			metric: { tileMeters: [2, 3], rotation: 0.9, offset: [0.2, 0.4] }
		});
		const scaled = applyFinishEdit(resourceFinish, { tileMeters: [4, 5] }, baseRecipe);
		expect(scaled.overrides?.mapping).toEqual({
			kind: 'surface',
			metric: { tileMeters: [4, 5], rotation: 0.1, offset: [0.2, 0.4] }
		});
	});

	it('resets only the cleared mapping field when another authored field remains', () => {
		const instance: SceneMaterialInstance = {
			id: 'p',
			name: 'P',
			base: { catalogue: 'plaster-warm' },
			overrides: {
				mapping: { kind: 'target', metric: { tileMeters: [3, 4], rotation: 0.5, offset: [0, 0] } }
			}
		};
		const clearedRotation = applyFinishEdit(instance, { rotation: null });
		expect(clearedRotation.overrides?.mapping).toEqual({
			kind: 'target',
			metric: { tileMeters: [3, 4], rotation: 0, offset: [0, 0] }
		});
		const clearedTile = applyFinishEdit(instance, { tileMeters: null });
		expect(clearedTile.overrides?.mapping).toEqual({
			kind: 'target',
			metric: { tileMeters: [2, 2], rotation: 0.5, offset: [0, 0] }
		});
		const clearedBoth = applyFinishEdit(clearedRotation, { tileMeters: null });
		expect(clearedBoth.overrides?.mapping).toBeUndefined();
	});
});

describe('the textures record-scope grant', () => {
	const operationKind = 'probe-textures';
	const baseScope = {
		operationKind,
		changedEntityIds: [],
		changedEntityFields: [],
		createdEntityIds: [],
		removedEntityIds: [],
		allowClusterCleanup: false
	} as const;

	const before = (): CameraFreeSceneDocument => ({
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [{ id: 'one', name: 'One', uri: '/textures/one.png' }],
		materials: [],
		entities: []
	});

	it('admits an append and keeps the accepted order', () => {
		const after = {
			...before(),
			textures: [
				...before().textures,
				{ id: 'two', name: 'Two', uri: '/textures/two.png' }
			]
		};
		expect(checkSceneRecordScope(before(), after, { ...baseScope, textures: { added: ['two'] } })).toEqual([]);
	});

	it('refuses a grant-less change and a changed existing record', () => {
		const appended = { ...before(), textures: [...before().textures, { id: 'two', name: 'Two', uri: '/textures/two.png' }] };
		expect(checkSceneRecordScope(before(), appended, baseScope).length).toBeGreaterThan(0);
		const changed = { ...before(), textures: [{ id: 'one', name: 'Changed', uri: '/textures/one.png' }] };
		expect(checkSceneRecordScope(before(), changed, { ...baseScope, textures: { added: [] } }).length).toBeGreaterThan(0);
	});

	it('refuses removal and reordering', () => {
		const removed = { ...before(), textures: [] };
		expect(checkSceneRecordScope(before(), removed, { ...baseScope, textures: { added: [] } }).length).toBeGreaterThan(0);
		const reordered = {
			...before(),
			textures: [{ id: 'two', name: 'Two', uri: '/textures/two.png' }, ...before().textures]
		};
		expect(checkSceneRecordScope(before(), reordered, { ...baseScope, textures: { added: ['two'] } }).length).toBeGreaterThan(0);
	});
});

describe('derived-recipe assign and findIdenticalFinish (T2.S8 U6)', () => {
	it('findIdenticalFinish matches first non-pristine Finish in document order, ignoring name', () => {
		const materials: SceneMaterialInstance[] = [
			{ id: 'pristine', name: 'Walnut', base: { catalogue: 'wood-walnut' } },
			{ id: 'fin-a', name: 'First Name', base: { catalogue: 'wood-walnut' }, overrides: { roughness: 0.4, color: '#224466' } },
			{ id: 'fin-b', name: 'Second Name', base: { catalogue: 'wood-walnut' }, overrides: { color: '#224466', roughness: 0.4 } }
		];
		expect(findIdenticalFinish(materials, { catalogue: 'wood-walnut' }, { color: '#224466', roughness: 0.4 })?.id).toBe('fin-a');
		expect(findIdenticalFinish(materials, { catalogue: 'wood-walnut' }, undefined)).toBeNull();
		expect(findIdenticalFinish(materials, { catalogue: 'wood-walnut' }, { roughness: 0.9 })).toBeNull();
	});

	it('scene-finish-assign derive reuse creates one Finish when none matches, and reuses it on a second target', async () => {
		const coordinator = await boot({ entities: [box('a'), box('b')] });
		const first = await coordinator.accept(
			intentOf(
				coordinator,
				SCENE_FINISH_ASSIGN,
				{
					finish: { curated: 'wood-walnut' },
					entityIds: ['a'],
					derive: { edits: [{ field: 'roughness', op: 'set', value: 0.4 }], identity: 'reuse' }
				},
				['a'],
				[{ kind: 'scene-finish', id: 'fin-derived-1' }]
			)
		);
		expect(first.kind).toBe('accepted');
		const created = sourceScene(coordinator).materials.find((m) => m.id === 'fin-derived-1');
		expect(created?.base).toEqual({ catalogue: 'wood-walnut' });
		expect(created?.overrides).toEqual({ roughness: 0.4 });
		const entityFinishId = (scene: ReturnType<typeof sourceScene>, id: string) => {
			const e = scene.entities.find((entry) => entry.id === id);
			return e && 'materialInstanceId' in e ? e.materialInstanceId : undefined;
		};
		expect(entityFinishId(sourceScene(coordinator), 'a')).toBe('fin-derived-1');

		// Unexpected allocation when an identical Finish already exists
		const overAllocated = await coordinator.accept(
			intentOf(
				coordinator,
				SCENE_FINISH_ASSIGN,
				{
					finish: { curated: 'wood-walnut' },
					entityIds: ['b'],
					derive: { edits: [{ field: 'roughness', op: 'set', value: 0.4 }], identity: 'reuse' }
				},
				['b'],
				[{ kind: 'scene-finish', id: 'fin-unused' }]
			)
		);
		expect(overAllocated.kind).toBe('rejected');
		if (overAllocated.kind === 'rejected') expect(overAllocated.reason).toBe('unexpected-allocation');

		// Reuse succeeds with no allocation
		const reused = await coordinator.accept(
			intentOf(
				coordinator,
				SCENE_FINISH_ASSIGN,
				{
					finish: { curated: 'wood-walnut' },
					entityIds: ['b'],
					derive: { edits: [{ field: 'roughness', op: 'set', value: 0.4 }], identity: 'reuse' }
				},
				['b']
			)
		);
		expect(reused.kind).toBe('accepted');
		expect(entityFinishId(sourceScene(coordinator), 'b')).toBe('fin-derived-1');
		expect(sourceScene(coordinator).materials).toHaveLength(1);
	});

	it('scene-finish-assign derive reuse resolving to curated with no overrides takes the curated/pristine path', async () => {
		const existing: SceneMaterialInstance = {
			id: 'fin-rough',
			name: 'Rough Walnut',
			base: { catalogue: 'wood-walnut' },
			overrides: { roughness: 0.4 }
		};
		const outcome = await directPlan(
			{ entities: [model('m1')], materials: [existing] },
			SCENE_FINISH_ASSIGN,
			{
				finish: { project: 'fin-rough' },
				entityIds: ['m1'],
				derive: { edits: [{ field: 'roughness', op: 'reset' }], identity: 'reuse' }
			},
			['m1'],
			[{ kind: 'scene-finish', id: 'fin-pristine-walnut' }]
		);
		const sceneAfter = plannedScene(outcome);
		const m1 = sceneAfter.entities.find((e) => e.id === 'm1');
		expect(m1 && 'materialInstanceId' in m1 ? m1.materialInstanceId : undefined).toBe('fin-pristine-walnut');
		const pristine = sceneAfter.materials.find((m) => m.id === 'fin-pristine-walnut');
		expect(pristine && isPristineInstance(pristine)).toBe(true);
	});

	it('scene-finish-assign derive fresh with empty edits always creates a new id and leaves other users untouched', async () => {
		const shared: SceneMaterialInstance = {
			id: 'fin-shared',
			name: 'Custom Walnut',
			base: { catalogue: 'wood-walnut' },
			overrides: { roughness: 0.35 }
		};
		const coordinator = await boot({ entities: [box('a', 'plaster-warm', 'fin-shared'), box('b', 'plaster-warm', 'fin-shared')], materials: [shared] });

		const missingAlloc = await coordinator.accept(
			intentOf(
				coordinator,
				SCENE_FINISH_ASSIGN,
				{
					finish: { project: 'fin-shared' },
					entityIds: ['a'],
					derive: { edits: [], identity: 'fresh' }
				},
				['a']
			)
		);
		expect(missingAlloc.kind).toBe('rejected');
		if (missingAlloc.kind === 'rejected') expect(missingAlloc.reason).toBe('missing-allocation');

		const copy = await coordinator.accept(
			intentOf(
				coordinator,
				SCENE_FINISH_ASSIGN,
				{
					finish: { project: 'fin-shared' },
					entityIds: ['a'],
					derive: { edits: [], identity: 'fresh' }
				},
				['a'],
				[{ kind: 'scene-finish', id: 'fin-own-copy' }]
			)
		);
		expect(copy.kind).toBe('accepted');
		const scene = sourceScene(coordinator);
		const entA = scene.entities.find((e) => e.id === 'a');
		const entB = scene.entities.find((e) => e.id === 'b');
		expect(entA && 'materialInstanceId' in entA ? entA.materialInstanceId : undefined).toBe('fin-own-copy');
		expect(entB && 'materialInstanceId' in entB ? entB.materialInstanceId : undefined).toBe('fin-shared');
		expect(scene.materials.find((m) => m.id === 'fin-shared')).toEqual(shared);
		expect(scene.materials.find((m) => m.id === 'fin-own-copy')?.overrides).toEqual({ roughness: 0.35 });
	});

	it('scene-surface-finish-assign supports derive reuse, fresh, and refuses inadmissible edits', async () => {
		const layout = wallLayout(['wall-a']);
		const left: LayoutSurfaceRef = { kind: 'wall-side', wallId: 'wall-a', side: 'left' };
		const right: LayoutSurfaceRef = { kind: 'wall-side', wallId: 'wall-a', side: 'right' };
		const coordinator = await boot({ entities: [], layout });
		const surfaceIntent = (
			payload: unknown,
			surfaces: readonly LayoutSurfaceRef[],
			allocatedIds: readonly { kind: string; id: string }[] = []
		) => ({
			...intentOf(coordinator, SCENE_SURFACE_FINISH_ASSIGN, payload, [], allocatedIds),
			targets: surfaces.map((surface) => surfaceTarget(coordinator.current().source, surface))
		});

		const bad = await coordinator.accept(
			surfaceIntent(
				{
					finish: { curated: 'wood-walnut' },
					surfaces: [left],
					derive: { edits: [{ field: 'roughness', op: 'set', value: 99 }], identity: 'reuse' }
				},
				[left],
				[{ kind: 'scene-finish', id: 'fin-bad' }]
			)
		);
		expect(bad.kind).toBe('rejected');
		if (bad.kind === 'rejected') expect(bad.reason).toBe('invalid-value');

		const first = await coordinator.accept(
			surfaceIntent(
				{
					finish: { curated: 'wood-walnut' },
					surfaces: [left],
					derive: { edits: [{ field: 'roughness', op: 'set', value: 0.5 }], identity: 'reuse' }
				},
				[left],
				[{ kind: 'scene-finish', id: 'fin-surf-1' }]
			)
		);
		expect(acceptedScene(first).materials.some((m) => m.id === 'fin-surf-1')).toBe(true);

		const second = await coordinator.accept(
			surfaceIntent(
				{
					finish: { curated: 'wood-walnut' },
					surfaces: [right],
					derive: { edits: [{ field: 'roughness', op: 'set', value: 0.5 }], identity: 'reuse' }
				},
				[right]
			)
		);
		expect(second.kind).toBe('accepted');
		expect(sourceScene(coordinator).materials).toHaveLength(1);

		const ownCopy = await coordinator.accept(
			surfaceIntent(
				{
					finish: { project: 'fin-surf-1' },
					surfaces: [right],
					derive: { edits: [], identity: 'fresh' }
				},
				[right],
				[{ kind: 'scene-finish', id: 'fin-surf-copy' }]
			)
		);
		expect(ownCopy.kind).toBe('accepted');
		const finishes = sourceScene(coordinator).surfaceFinishes ?? [];
		expect(finishes.find((s) => surfaceKey(s.surface) === surfaceKey(left))?.finish).toEqual({ materialInstanceId: 'fin-surf-1' });
		expect(finishes.find((s) => surfaceKey(s.surface) === surfaceKey(right))?.finish).toEqual({ materialInstanceId: 'fin-surf-copy' });
	});
});
