/**
 * T2.S8 U3 — colour coats (decision D3).
 *
 * A colour painted with Paint keeps the target's relief, sheen and tiling and
 * replaces only its colour, through one deduplicated derived Finish per source
 * and colour. These tests pin the recipe, the dedupe identity, the planner's
 * allocation contract, palette following, Undo/Redo and save/reopen.
 */
import { describe, expect, it } from 'vitest';
import type { AuthoringIntent, SceneEntity, SceneMaterialInstance, SemanticReference } from '@portfolio/project-model';
import {
	createEmptyWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutSurfaceRef
} from '@portfolio/layout-core';
import {
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	serializeProjectEnvelope,
	type CameraFreeSceneDocument,
	type ProjectEnvelope,
	type ScenePaletteSlot
} from '@portfolio/project-model/units';
import {
	MODEL_OWN_COAT_REFUSAL,
	SCENE_COLOUR_COAT,
	UNASSIGNED_SURFACE_COAT_BASE,
	coatKeepsRelief,
	coatRecipe,
	createFinishPlanners,
	planColourCoats,
	sameCoatRecipe,
	type CoatTarget
} from '@portfolio/project-model/scene-planning';
import {
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject,
	unitRevision
} from '../authoring/__fixtures__/unit-envelope-fixtures';

const LABELS: Record<string, string> = {
	'wood-walnut': 'Walnut Wood',
	'plaster-warm': 'Warm Plaster',
	'concrete-smooth': 'Smooth Concrete',
	'marble-light': 'Light Marble'
};
const SAGE: ScenePaletteSlot = { id: 'slot-sage', name: 'Sage', color: '#8a9a7b' };

function box(id: string, materialId = 'wood-walnut', instanceId?: string): SceneEntity {
	return {
		kind: 'primitive', id, name: id, position: [0, 0, 0], rotation: [0, 0, 0], primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 }, materialId, castShadow: true, receiveShadow: true,
		...(instanceId === undefined ? {} : { materialInstanceId: instanceId })
	} as SceneEntity;
}

function model(id: string, instanceId?: string): SceneEntity {
	return {
		kind: 'model', id, name: id, position: [0, 0, 0], rotation: [0, 0, 0],
		assetId: 'paris-salon-chair', fallback: 'chair',
		...(instanceId === undefined ? {} : { materialInstanceId: instanceId })
	} as unknown as SceneEntity;
}

function wallLayout(count: number): LayoutDocumentWallFirst {
	const layout = createEmptyWallFirstLayoutDocument();
	const ids = Array.from({ length: count }, (_, index) => `wall-${index}`);
	layout.junctions = ids.flatMap((id, index) => [
		{ id: `${id}:start`, point: [index * 5, 0] as [number, number] },
		{ id: `${id}:end`, point: [index * 5 + 4, 0] as [number, number] }
	]);
	layout.walls = ids.map((id) => ({
		id, startJunctionId: `${id}:start`, endJunctionId: `${id}:end`, thickness: 0.2, height: 3, centerline: { kind: 'line' }
	}));
	return layout;
}

function side(index: number, which: 'left' | 'right' = 'left'): LayoutSurfaceRef {
	return { kind: 'wall-side', wallId: `wall-${index}`, side: which };
}

type SceneInput = {
	readonly entities?: readonly SceneEntity[];
	readonly materials?: readonly SceneMaterialInstance[];
	readonly surfaceFinishes?: CameraFreeSceneDocument['surfaceFinishes'];
	readonly palette?: readonly ScenePaletteSlot[];
	readonly layout?: LayoutDocumentWallFirst;
};

function sceneDocument(input: SceneInput): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [...(input.materials ?? [])],
		entities: [...(input.entities ?? [])],
		...(input.surfaceFinishes === undefined ? {} : { surfaceFinishes: [...input.surfaceFinishes] }),
		...(input.palette === undefined ? {} : { palette: input.palette })
	};
}

async function boot(input: SceneInput) {
	const project = await createUnitProject({
		id: 'project-coat', name: 'Coat',
		...(input.layout === undefined ? {} : { layout: input.layout }),
		scene: sceneDocument(input)
	});
	const revision = unitRevision(project.id);
	const admitted = await admitUnitProject(project, revision);
	if (admitted.kind !== 'admitted') throw new Error(`fixture not admitted: ${JSON.stringify(admitted.issues)}`);
	return createUnitCoordinator({
		baseline: { revision, source: admitted.project, canonicalJson: admitted.canonicalJson, sourceContentId: admitted.sourceContentId },
		planners: createFinishPlanners({ labelForMaterial: (id) => LABELS[id] ?? id }),
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`
	});
}

type Coordinator = Awaited<ReturnType<typeof boot>>;

function scene(coordinator: Coordinator): CameraFreeSceneDocument {
	return coordinator.current().source.units.scene.data;
}

function entityTarget(source: ProjectEnvelope, id: string): SemanticReference {
	return {
		version: 1, domain: 'scene',
		revision: { kind: 'exact', contentRevision: source.units.scene.header.contentRevision },
		subject: { kind: 'entity', id }, instancePath: [], location: { kind: 'project-root' },
		componentId: null, capabilityId: null
	};
}

function surfaceTarget(source: ProjectEnvelope, surface: LayoutSurfaceRef): SemanticReference {
	if (surface.kind !== 'wall-side') throw new Error('wall sides only');
	return {
		version: 1, domain: 'layout',
		revision: { kind: 'exact', contentRevision: source.units.layout.header.contentRevision },
		subject: { kind: 'wall', id: surface.wallId }, instancePath: [],
		location: { kind: 'layout-location', levelId: source.units.layout.data.floor.id, structureInstancePath: [] },
		componentId: `side:${surface.side}`, capabilityId: null
	};
}

/** The intent the editor's port sends: it allocates exactly the ids the shared plan asks for. */
function coatIntent(
	coordinator: Coordinator,
	colour: string | { slot: string },
	targets: { entityIds: readonly string[] } | { surfaces: readonly LayoutSurfaceRef[] },
	allocationDelta = 0
): AuthoringIntent {
	const source = coordinator.current().source;
	const coatTargets: CoatTarget[] = 'entityIds' in targets
		? targets.entityIds.map((id) => ({ kind: 'entity', id }))
		: targets.surfaces.map((surface) => ({ kind: 'surface', surface }));
	const plan = planColourCoats(source.units.scene.data, {
		colour, targets: coatTargets, labelForMaterial: (id) => LABELS[id] ?? id
	});
	const count = Math.max(0, (plan.kind === 'planned' ? plan.creates.length : 0) + allocationDelta);
	return {
		version: 1,
		kind: SCENE_COLOUR_COAT,
		operationId: `coat-${Math.random().toString(16).slice(2)}`,
		expectedRevision: coordinator.acceptedRevision(),
		targets: 'entityIds' in targets
			? targets.entityIds.map((id) => entityTarget(source, id))
			: targets.surfaces.map((surface) => surfaceTarget(source, surface)),
		payload: { colour, ...targets } as unknown as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds: Array.from({ length: count }, (_, index) => ({ kind: 'scene-finish', id: `coat-${index}-${Math.random().toString(16).slice(2, 8)}` }))
	};
}

function instanceOfSurface(document: CameraFreeSceneDocument, surface: LayoutSurfaceRef): SceneMaterialInstance {
	const key = JSON.stringify(surface);
	const assignment = document.surfaceFinishes?.find((entry) => JSON.stringify(entry.surface) === key);
	if (assignment === undefined || !('materialInstanceId' in assignment.finish)) throw new Error('surface has no project Finish');
	const id = assignment.finish.materialInstanceId;
	return document.materials.find((material) => material.id === id)!;
}

function instanceOfEntity(document: CameraFreeSceneDocument, id: string): SceneMaterialInstance {
	const entity = document.entities.find((candidate) => candidate.id === id) as SceneEntity & { materialInstanceId?: string };
	return document.materials.find((material) => material.id === entity.materialInstanceId)!;
}

describe('coat recipe', () => {
	it('keeps every override, sets the colour and disables a base colour image', () => {
		const recipe = coatRecipe(
			{ base: { catalogue: 'concrete-smooth' }, overrides: { roughness: 0.3, normalScale: 0.5, maps: { occlusion: null } } },
			{ slot: 'slot-sage' }
		);
		expect(recipe).toEqual({
			base: { catalogue: 'concrete-smooth' },
			overrides: { color: { slot: 'slot-sage' }, roughness: 0.3, normalScale: 0.5, maps: { occlusion: null, color: null } }
		});
	});

	it('drops an override colour image when the base binds none, and writes no empty maps', () => {
		const recipe = coatRecipe(
			{ base: { catalogue: 'marble-light' }, overrides: { color: '#ffffff', maps: { color: { image: { textureId: 'photo' } } } } },
			'#aa3322'
		);
		expect(recipe).toEqual({ base: { catalogue: 'marble-light' }, overrides: { color: '#aa3322' } });
	});

	it('coating a coat re-derives from the same base', () => {
		const sage = coatRecipe({ base: { catalogue: 'wood-walnut' } }, { slot: 'slot-sage' });
		const roseOverSage = coatRecipe(sage, '#c06070');
		expect(sameCoatRecipe(roseOverSage, coatRecipe({ base: { catalogue: 'wood-walnut' } }, '#c06070'))).toBe(true);
	});

	it('names what keeps relief: a normal, roughness or occlusion image', () => {
		expect(coatKeepsRelief({ base: { catalogue: 'concrete-smooth' } })).toBe(true);
		expect(coatKeepsRelief({ base: { catalogue: 'marble-light' } })).toBe(false);
		expect(coatKeepsRelief({ base: { catalogue: 'wood-walnut' }, overrides: { maps: { roughness: null } } })).toBe(false);
	});

	it('refuses a model wearing its own materials, a light and a removed slot', () => {
		const document = sceneDocument({ entities: [model('chair')], palette: [SAGE] });
		expect(planColourCoats(document, { colour: '#112233', targets: [{ kind: 'entity', id: 'chair' }] }))
			.toEqual({ kind: 'refused', code: 'not-paintable', message: MODEL_OWN_COAT_REFUSAL });
		expect(planColourCoats(document, { colour: { slot: 'gone' }, targets: [{ kind: 'entity', id: 'chair' }] }))
			.toMatchObject({ kind: 'refused', code: 'unknown-slot' });
	});
});

describe('scene-colour-coat', () => {
	it('ten unassigned walls painted Sage make one Finish over plaster, following the slot', async () => {
		const layout = wallLayout(10);
		const coordinator = await boot({ layout, palette: [SAGE] });
		const surfaces = Array.from({ length: 10 }, (_, index) => side(index));
		const result = await coordinator.accept(coatIntent(coordinator, { slot: SAGE.id }, { surfaces }));
		expect(result.kind).toBe('accepted');
		const after = scene(coordinator);
		expect(after.materials).toHaveLength(1);
		expect(after.materials[0]).toMatchObject({
			name: 'Warm Plaster · Sage',
			base: { catalogue: UNASSIGNED_SURFACE_COAT_BASE },
			overrides: { color: { slot: SAGE.id }, maps: { color: null } }
		});
		expect(new Set(after.surfaceFinishes!.map((entry) => JSON.stringify(entry.finish)))).toEqual(
			new Set([JSON.stringify({ materialInstanceId: after.materials[0]!.id })])
		);
	});

	it('a second stroke of the same colour reuses the coat; different sources get one coat each', async () => {
		const layout = wallLayout(4);
		const coordinator = await boot({
			layout,
			palette: [SAGE],
			surfaceFinishes: [
				{ surface: side(0), finish: { materialId: 'wood-walnut' } },
				{ surface: side(1), finish: { materialId: 'wood-walnut' } },
				{ surface: side(2), finish: { materialId: 'concrete-smooth' } }
			]
		});
		expect((await coordinator.accept(coatIntent(coordinator, { slot: SAGE.id }, { surfaces: [side(0), side(2)] }))).kind).toBe('accepted');
		expect(scene(coordinator).materials.map((material) => material.name).sort()).toEqual(['Smooth Concrete · Sage', 'Walnut Wood · Sage']);
		const walnutCoat = instanceOfSurface(scene(coordinator), side(0)).id;
		expect((await coordinator.accept(coatIntent(coordinator, { slot: SAGE.id }, { surfaces: [side(1)] }))).kind).toBe('accepted');
		expect(scene(coordinator).materials).toHaveLength(2);
		expect(instanceOfSurface(scene(coordinator), side(1)).id).toBe(walnutCoat);
	});

	it('a slot follower and a literal of the same hex are different coats', async () => {
		const coordinator = await boot({ entities: [box('a'), box('b')], palette: [SAGE] });
		await coordinator.accept(coatIntent(coordinator, { slot: SAGE.id }, { entityIds: ['a'] }));
		await coordinator.accept(coatIntent(coordinator, SAGE.color, { entityIds: ['b'] }));
		const after = scene(coordinator);
		expect(after.materials).toHaveLength(2);
		expect(after.materials.map((material) => material.name).sort()).toEqual(['Walnut Wood · #8A9A7B', 'Walnut Wood · Sage']);
	});

	it('keeps a project Finish’s sheen and tiling and reuses an equal existing Finish', async () => {
		const oiled: SceneMaterialInstance = {
			id: 'oiled', name: 'Oiled walnut', base: { catalogue: 'wood-walnut' },
			overrides: { roughness: 0.25, mapping: { kind: 'target', metric: { tileMeters: [0.5, 0.5], rotation: 0, offset: [0, 0] } } }
		} as SceneMaterialInstance;
		const existing: SceneMaterialInstance = {
			id: 'mine', name: 'My green oak', base: { catalogue: 'wood-walnut' },
			overrides: { color: '#226633', maps: { color: null } }
		} as SceneMaterialInstance;
		const coordinator = await boot({ entities: [box('a', 'wood-walnut', 'oiled'), box('b')], materials: [oiled, existing] });
		await coordinator.accept(coatIntent(coordinator, '#226633', { entityIds: ['a', 'b'] }));
		const after = scene(coordinator);
		expect(instanceOfEntity(after, 'a').overrides).toEqual({ ...oiled.overrides, color: '#226633', maps: { color: null } });
		expect(instanceOfEntity(after, 'b').id).toBe('mine');
		expect(after.materials.find((material) => material.id === 'oiled')).toEqual(oiled);
	});

	it('one stroke is one Undo entry, and Redo restores the exact bytes', async () => {
		const coordinator = await boot({ entities: [box('a'), box('b'), box('c', 'concrete-smooth')], palette: [SAGE] });
		const before = serializeProjectEnvelope(coordinator.current().source);
		expect((await coordinator.accept(coatIntent(coordinator, { slot: SAGE.id }, { entityIds: ['a', 'b', 'c'] }))).kind).toBe('accepted');
		expect(scene(coordinator).materials.map((material) => material.name)).toEqual(['Walnut Wood · Sage', 'Smooth Concrete · Sage']);
		const painted = serializeProjectEnvelope(coordinator.current().source);
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(serializeProjectEnvelope(coordinator.current().source)).toBe(before);
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(serializeProjectEnvelope(coordinator.current().source)).toBe(painted);
	});

	it('a model leaving a pristine curated instance releases it in the same write', async () => {
		const project = await createUnitProject({
			id: 'project-coat', name: 'Coat',
			scene: sceneDocument({
				entities: [model('chair', 'pristine')],
				materials: [{ id: 'pristine', name: 'Walnut Wood', base: { catalogue: 'wood-walnut' } } as SceneMaterialInstance]
			})
		});
		const acceptedRevision = unitRevision(project.id);
		const identity = { acceptedRevision, sourceContentId: 'source' };
		const allocatedIds = [{ kind: 'scene-finish', id: 'coat-1' }];
		const planner = createFinishPlanners({ labelForMaterial: (id) => LABELS[id] ?? id }).find((entry) => entry.kind === SCENE_COLOUR_COAT)!;
		const outcome = await planner.prepare({
			snapshot: {
				acceptedRevision, sourceContentId: 'source', sourceKind: UNIT_SOURCE_KIND, sourceVersion: UNIT_SOURCE_VERSION,
				domain: { identity, source: project }
			},
			intent: {
				version: 1, kind: SCENE_COLOUR_COAT, operationId: 'coat-chair', expectedRevision: acceptedRevision,
				targets: [entityTarget(project, 'chair')],
				payload: { colour: '#334455', entityIds: ['chair'] } as unknown as AuthoringIntent['payload'],
				capturedInputs: [], allocatedIds
			},
			capturedInputs: [],
			allocatedIds
		});
		if (outcome.kind !== 'prepared') throw new Error(JSON.stringify(outcome));
		const after = outcome.candidate.source.units.scene.data;
		expect(after.materials).toEqual([
			{ id: 'coat-1', name: 'Walnut Wood · #334455', base: { catalogue: 'wood-walnut' }, overrides: { color: '#334455', maps: { color: null } } }
		]);
		expect((after.entities[0] as SceneEntity & { materialInstanceId?: string }).materialInstanceId).toBe('coat-1');
	});

	it('refuses an allocation count the shared plan does not ask for, and a repeat as no-change', async () => {
		const coordinator = await boot({ entities: [box('a')], palette: [SAGE] });
		expect(await coordinator.accept(coatIntent(coordinator, '#123456', { entityIds: ['a'] }, -1)))
			.toMatchObject({ kind: 'rejected' });
		expect(await coordinator.accept(coatIntent(coordinator, '#123456', { entityIds: ['a'] }, 1)))
			.toMatchObject({ kind: 'rejected' });
		expect((await coordinator.accept(coatIntent(coordinator, '#123456', { entityIds: ['a'] }))).kind).toBe('accepted');
		const repeat = await coordinator.accept(coatIntent(coordinator, '#123456', { entityIds: ['a'] }));
		expect(repeat.kind).toBe('rejected');
		expect(JSON.stringify(repeat)).toContain('no-change');
	});

	it('a palette edit recolours every follower coat; removing the slot keeps its last colour', async () => {
		const coordinator = await boot({ entities: [box('a'), box('b', 'concrete-smooth')], palette: [SAGE] });
		await coordinator.accept(coatIntent(coordinator, { slot: SAGE.id }, { entityIds: ['a', 'b'] }));
		const set = await coordinator.accept({
			version: 1, kind: 'scene-palette-slot-set', operationId: 'set-sage',
			expectedRevision: coordinator.acceptedRevision(), targets: [],
			payload: { slotId: SAGE.id, color: '#556b2f' } as unknown as AuthoringIntent['payload'],
			capturedInputs: [], allocatedIds: []
		});
		expect(set.kind).toBe('accepted');
		const recoloured = scene(coordinator);
		expect(recoloured.palette?.[0]?.color).toBe('#556b2f');
		expect(recoloured.materials.every((material) => JSON.stringify(material.overrides?.color) === JSON.stringify({ slot: SAGE.id }))).toBe(true);
		const removed = await coordinator.accept({
			version: 1, kind: 'scene-palette-slot-remove', operationId: 'remove-sage',
			expectedRevision: coordinator.acceptedRevision(), targets: [],
			payload: { slotId: SAGE.id } as unknown as AuthoringIntent['payload'],
			capturedInputs: [], allocatedIds: []
		});
		expect(removed.kind).toBe('accepted');
		expect(scene(coordinator).materials.map((material) => material.overrides?.color)).toEqual(['#556b2f', '#556b2f']);
	});

	it('a coated project saves and reopens byte-identical', async () => {
		const coordinator = await boot({ entities: [box('a')], layout: wallLayout(2), palette: [SAGE] });
		await coordinator.accept(coatIntent(coordinator, { slot: SAGE.id }, { entityIds: ['a'] }));
		await coordinator.accept(coatIntent(coordinator, { slot: SAGE.id }, { surfaces: [side(0), side(1, 'right')] }));
		const saved = serializeProjectEnvelope(coordinator.current().source);
		const reopened = await admitUnitProject(JSON.parse(saved), unitRevision('project-coat', 'revision-reopen'));
		expect(reopened.kind).toBe('admitted');
		if (reopened.kind !== 'admitted') return;
		expect(serializeProjectEnvelope(reopened.project)).toBe(saved);
		expect(reopened.project.units.scene.data.materials).toHaveLength(2);
	});
});
