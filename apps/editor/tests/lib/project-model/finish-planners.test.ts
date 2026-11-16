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
	SceneEntity,
	SceneMaterialInstance
} from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type CameraFreeSceneDocument,
	type ProjectEnvelope,
	type ScenePaletteSlot
} from '@portfolio/project-model/units';
import {
	checkSceneRecordScope,
	createFinishPlanners,
	effectiveColorOf,
	finishOf,
	isPristineInstance,
	withFinishPreviews
} from '@portfolio/project-model/scene-planning';
import { createUnitCoordinator, createUnitProject, admitUnitProject, unitRevision } from '../authoring/__fixtures__/unit-envelope-fixtures';

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
	readonly materials?: readonly SceneMaterialInstance[];
	readonly palette?: readonly ScenePaletteSlot[];
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

function sceneDocument(input: SceneInput): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [...(input.materials ?? [])],
		entities: [...input.entities],
		...(input.palette === undefined ? {} : { palette: input.palette })
	};
}

async function sceneEnvelope(input: SceneInput): Promise<ProjectEnvelope> {
	return createUnitProject({
		id: 'project-finish',
		name: 'Finish',
		scene: sceneDocument(input)
	});
}

async function directPlan(
	input: SceneInput,
	kind: string,
	payload: unknown,
	entityIds: readonly string[] = [],
	allocatedIds: readonly { kind: string; id: string }[] = []
) {
	const project = await sceneEnvelope(input);
	const header = project.units.scene.header;
	const acceptedRevision = { projectId: project.id, revisionId: 'revision-1' };
	const identity = { acceptedRevision, sourceContentId: 'source-content' };
	const intent: AuthoringIntent = {
		version: 1,
		kind,
		operationId: `${kind}-direct`,
		expectedRevision: acceptedRevision,
		targets: entityIds.map((id) => ({
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
	const planner = createFinishPlanners({ labelForMaterial: (id) => LABELS[id] ?? id }).find(
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
		scene: sceneDocument(input)
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
			{ id: 'pristine-walnut', name: 'Walnut Wood', baseMaterialId: 'wood-walnut' }
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
						{ id: 'pristine-walnut', name: 'Walnut Wood', baseMaterialId: 'wood-walnut' }
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
						{ id: 'pristine-old', name: 'Warm Plaster', baseMaterialId: 'plaster-warm' }
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
						{ id: 'p1', name: 'Walnut 2', baseMaterialId: 'wood-walnut', roughness: 0.7 }
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
						{ id: 'p1', name: 'Walnut 2', baseMaterialId: 'wood-walnut', color: '#111111' }
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

describe('the picker preview', () => {
	it('is a render-only synthetic instance and leaves the accepted Scene untouched', () => {
		const accepted = sceneDocument({
			entities: [box('a', 'wood-walnut', 'p1'), box('b', 'wood-walnut')],
			materials: [
				{ id: 'p1', name: 'Walnut', baseMaterialId: 'wood-walnut', color: '#111111' }
			]
		});
		const preview = withFinishPreviews(accepted, new Map([['a', '#ff0000']]));
		expect(withFinishPreviews(accepted, new Map())).toBe(accepted);
		expect(accepted.materials).toHaveLength(1);
		expect(accepted.entities[0]).toMatchObject({ materialInstanceId: 'p1' });
		const entity = preview.entities.find((candidate) => candidate.id === 'a')!;
		const instanceId = (entity as { materialInstanceId?: string }).materialInstanceId!;
		expect(instanceId).not.toBe('p1');
		expect(preview.materials.find((material) => material.id === instanceId)?.color).toBe('#ff0000');
		expect(effectiveColorOf(entity, preview, () => '#000000')).toBe('#ff0000');
	});

	it('creates a synthetic instance from a curated primitive without writing one', () => {
		const accepted = sceneDocument({ entities: [box('a', 'wood-walnut')] });
		const preview = withFinishPreviews(accepted, new Map([['a', '#00ff00']]));
		expect(accepted.materials).toHaveLength(0);
		expect(preview.materials).toHaveLength(1);
		expect(preview.materials[0]).toMatchObject({ baseMaterialId: 'wood-walnut', color: '#00ff00' });
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
			{
				id: 'walnut-gloss',
				name: 'Walnut Wood 2',
				baseMaterialId: 'wood-walnut',
				roughness: 0.3
			}
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
			{
				id: 'walnut-shared',
				name: 'Walnut Wood 2',
				baseMaterialId: 'wood-walnut',
				color: '#2b1a10',
				metalness: 1
			}
		]);
		expect(finishKeyOf(scene, 'a')).toBe('project:walnut-shared');
		expect(finishKeyOf(scene, 'b')).toBe('project:walnut-shared');
	});

	it('edits a single-user project Finish in place without allocating an id', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', baseMaterialId: 'plaster-warm', roughness: 0.5 }]
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
		expect(scene.materials[0]).toMatchObject({ id: 'p1', roughness: 0.1, metalness: 1 });
		expect(scene.entities[0]).toMatchObject({ materialId: 'plaster-warm', materialInstanceId: 'p1' });
	});

	it('clones a shared project Finish for Just this, keeping the original users', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1'), box('b', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', baseMaterialId: 'plaster-warm', roughness: 0.5 }]
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
			{ id: 'p1', name: 'Plaster 2', baseMaterialId: 'plaster-warm', roughness: 0.5 },
			{
				id: 'p1-copy',
				name: 'Plaster 2 2',
				baseMaterialId: 'plaster-warm',
				roughness: 0.5,
				color: '#abcdef'
			}
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
			materials: [{ id: 'p1', name: 'Plaster 2', baseMaterialId: 'plaster-warm', color: '#aabbcc' }]
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
		expect(scene.materials[0]!.color).toEqual({ slot: 'slot-a' });
	});

	it('recolours a slot globally and its followers resolve the new colour', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1'), box('b', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', baseMaterialId: 'plaster-warm', color: { slot: 'slot-a' } }],
			palette: [{ id: 'slot-a', name: 'Accent', color: '#aabbcc' }]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-palette-slot-set', { slotId: 'slot-a', color: '#112233' })
		);
		const scene = acceptedScene(result);
		expect(scene.palette).toEqual([{ id: 'slot-a', name: 'Accent', color: '#112233' }]);
		expect(scene.materials[0]).toMatchObject({ color: { slot: 'slot-a' } });
	});

	it('renames a slot without changing its id, position or followers', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', baseMaterialId: 'plaster-warm', color: { slot: 'slot-a' } }],
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
		expect(scene.materials[0]!.color).toEqual({ slot: 'slot-a' });
	});

	it('removes a slot, literalises its followers and drops an empty palette', async () => {
		const coordinator = await boot({
			entities: [box('a', 'plaster-warm', 'p1')],
			materials: [{ id: 'p1', name: 'Plaster 2', baseMaterialId: 'plaster-warm', color: { slot: 'slot-a' } }],
			palette: [{ id: 'slot-a', name: 'Accent', color: '#aabbcc' }]
		});
		const result = await accept(
			coordinator,
			intentOf(coordinator, 'scene-palette-slot-remove', { slotId: 'slot-a' })
		);
		const scene = acceptedScene(result);
		expect('palette' in scene).toBe(false);
		expect(scene.materials[0]!.color).toBe('#aabbcc');
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
		materials: [{ id: 'p1', name: 'P', baseMaterialId: 'plaster-warm', color: '#111111' }],
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
				{ id: 'p2', name: 'Second', baseMaterialId: 'plaster-warm' },
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
