/**
 * T2.S3 — the pure light operation planners.
 *
 * These cases pin the claims the editor builds on: one creation appends one
 * light, one update owns only the fields it names, duplicate copies at the
 * shared offset, and no planner touches the Camera-bearing bytes. The rendered
 * target/cutoff behavior is covered by the editor's aim tests and the focused
 * browser check, not by a fake Scene.
 */
import { describe, expect, it } from 'vitest';
import {
	createScenePlanners,
	planCreateLight,
	planDuplicateLight,
	planUpdateLight,
	SCENE_NAME_LIMIT,
	type SceneOperationContext
} from '@portfolio/project-model/scene-planning';
import {
	type AcceptedSnapshot,
	type AuthoringIntent,
	type SceneEntity,
	type SceneLightEntity,
	type SemanticReference
} from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	type CameraFreeSceneDocument,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createUnitProject, admitUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';

function sceneWith(entities: readonly SceneEntity[]): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [...entities]
	};
}

function spot(overrides: Partial<Extract<SceneLightEntity, { light: 'spot' }>> = {}): SceneLightEntity {
	return {
		kind: 'light',
		light: 'spot',
		id: 'spot-a',
		name: 'Spot A',
		color: '#ffffff',
		intensity: Math.PI,
		angle: Math.PI / 6,
		castShadow: false,
		position: [2, 3, 2],
		rotation: [0.4, 0, 0],
		...overrides
	};
}

async function projectWith(entities: readonly SceneEntity[]): Promise<ProjectEnvelope> {
	return createUnitProject({ id: 'project-lights', name: 'Lights', scene: sceneWith(entities) });
}

async function snapshotOf(project: ProjectEnvelope): Promise<AcceptedSnapshot<ProjectEnvelope>> {
	const admitted = await admitUnitProject(project, {
		projectId: project.id,
		revisionId: 'revision-lights'
	});
	if (admitted.kind !== 'admitted') {
		throw new Error(`fixture refused: ${JSON.stringify(admitted.issues)}`);
	}
	return {
		acceptedRevision: admitted.snapshot.acceptedRevision,
		sourceContentId: admitted.snapshot.sourceContentId,
		sourceKind: admitted.snapshot.sourceKind,
		sourceVersion: admitted.snapshot.sourceVersion,
		domain: {
			identity: {
				acceptedRevision: admitted.snapshot.acceptedRevision,
				sourceContentId: admitted.snapshot.sourceContentId
			},
			source: project
		}
	};
}

function target(snapshot: AcceptedSnapshot<ProjectEnvelope>, entityId: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: {
			kind: 'exact',
			contentRevision: snapshot.domain.source.units.scene.header.contentRevision
		},
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function intent(input: {
	readonly kind: string;
	readonly operationId: string;
	readonly snapshot: AcceptedSnapshot<ProjectEnvelope>;
	readonly payload: unknown;
	readonly targets?: readonly SemanticReference[];
	readonly allocatedIds?: readonly { readonly kind: string; readonly id: string }[];
}): AuthoringIntent {
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId,
		expectedRevision: input.snapshot.acceptedRevision,
		targets: input.targets ?? [],
		payload: input.payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds: input.allocatedIds ?? []
	};
}

function prepare(kind: string, snapshot: AcceptedSnapshot<ProjectEnvelope>, captured: AuthoringIntent) {
	const planner = createScenePlanners().find((candidate) => candidate.kind === kind);
	if (planner === undefined) throw new Error(`no planner for ${kind}`);
	return planner.prepare({
		snapshot,
		intent: captured,
		capturedInputs: captured.capturedInputs,
		allocatedIds: captured.allocatedIds
	});
}

const CREATION = {
	light: 'spot',
	name: 'Key light',
	color: '#ffd6a5',
	intensity: Math.PI,
	castShadow: false,
	position: [2, 3, 2],
	rotation: [0.4, 0.2, 0],
	angle: Math.PI / 6
} as const;

describe('S3 light planners', () => {
	it('creates one light with a captured id and preserves the Camera bytes', async () => {
		const project = await projectWith([]);
		const before = JSON.stringify(project.units.camera.data);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'create-light',
			snapshot,
			intent({
				kind: 'create-light',
				operationId: 'op-create-light',
				snapshot,
				payload: CREATION,
				allocatedIds: [{ kind: 'scene-entity', id: 'light-new' }]
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const light = result.candidate.source.units.scene.data.entities[0] as SceneLightEntity;
		expect(light).toMatchObject({
			kind: 'light',
			light: 'spot',
			id: 'light-new',
			name: 'Key light',
			angle: Math.PI / 6
		});
		expect(JSON.stringify(result.candidate.source.units.camera.data)).toBe(before);
	});

	it('refuses a spot without an angle and a directional with range', async () => {
		const project = await projectWith([]);
		const snapshot = await snapshotOf(project);
		for (const [payload, message] of [
			[{ ...CREATION, angle: undefined }, 'angle'],
			[{ ...CREATION, light: 'directional' }, 'range']
		] as const) {
			const result = prepare(
				'create-light',
				snapshot,
				intent({
					kind: 'create-light',
					operationId: `op-create-${message}`,
					snapshot,
					payload,
					allocatedIds: [{ kind: 'scene-entity', id: `light-${message}` }]
				})
			);
			expect(result.kind, message).toBe('rejected');
		}
	});

	it('updates only the named light fields and clears a range with null', async () => {
		const project = await projectWith([spot({ range: 5 })]);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'update-light',
			snapshot,
			intent({
				kind: 'update-light',
				operationId: 'op-update-light',
				snapshot,
				targets: [target(snapshot, 'spot-a')],
				payload: {
					entityId: 'spot-a',
					rotation: [0.7, 0.1, 0],
					range: null,
					intensity: Math.PI * 2,
					castShadow: false
				}
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const light = result.candidate.source.units.scene.data.entities[0] as SceneLightEntity;
		expect(light).toMatchObject({ id: 'spot-a', intensity: Math.PI * 2 });
		expect('range' in light).toBe(false);
		expect(light.rotation).toEqual([0.7, 0.1, 0]);
	});

	it('duplicates a light at +0.5 m X/Z with a captured id', async () => {
		const project = await projectWith([spot()]);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'duplicate-light',
			snapshot,
			intent({
				kind: 'duplicate-light',
				operationId: 'op-duplicate-light',
				snapshot,
				targets: [target(snapshot, 'spot-a')],
				payload: { entityId: 'spot-a' },
				allocatedIds: [{ kind: 'scene-entity', id: 'spot-b' }]
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const copy = result.candidate.source.units.scene.data.entities[1] as SceneLightEntity;
		expect(copy.id).toBe('spot-b');
		expect(copy.position).toEqual([2.5, 3, 2.5]);
		expect(copy.rotation).toEqual([0.4, 0, 0]);
	});

	it('keeps name validation shared with set-name', () => {
		const context = {
			layout: { rooms: [], walls: [], openings: [], objects: [], floor: { elevation: 0 } },
			scene: sceneWith([]),
			sourceContentId: 'source'
		} as unknown as SceneOperationContext;
		expect(
			planCreateLight({
				context,
				entityId: 'light-a',
				light: 'point',
				name: ' '.repeat(3),
				color: '#ffffff',
				intensity: Math.PI,
				castShadow: false,
				position: [0, 2, 0],
				rotation: [0, 0, 0]
			})
		).toMatchObject({ kind: 'rejected', code: 'invalid-value' });
		expect(
			planCreateLight({
				context,
				entityId: 'light-a',
				light: 'point',
				name: 'x'.repeat(SCENE_NAME_LIMIT + 1),
				color: '#ffffff',
				intensity: Math.PI,
				castShadow: false,
				position: [0, 2, 0],
				rotation: [0, 0, 0]
			})
		).toMatchObject({ kind: 'rejected', code: 'invalid-value' });
	});

	it('refuses an update that owns no light field', async () => {
		const project = await projectWith([spot()]);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'update-light',
			snapshot,
			intent({
				kind: 'update-light',
				operationId: 'op-empty-update',
				snapshot,
				targets: [target(snapshot, 'spot-a')],
				payload: { entityId: 'spot-a' }
			})
		);
		expect(result).toMatchObject({ kind: 'rejected' });
	});

	it('does not let a non-light use the light update planner', async () => {
		const box: SceneEntity = {
			kind: 'primitive',
			primitive: 'box',
			id: 'box-a',
			name: 'Box',
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			position: [1, 0.5, 1],
			rotation: [0, 0, 0],
			scale: 1
		};
		const project = await projectWith([box]);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'update-light',
			snapshot,
			intent({
				kind: 'update-light',
				operationId: 'op-box-light',
				snapshot,
				targets: [target(snapshot, 'box-a')],
				payload: { entityId: 'box-a', intensity: 2 }
			})
		);
		expect(result).toMatchObject({ kind: 'rejected', code: 'unsupported-transform' });
	});

	it('rejects duplicate for a non-light without touching it', async () => {
		const context = {
			layout: { rooms: [], walls: [], openings: [], objects: [], floor: { elevation: 0 } },
			scene: sceneWith([
				{
					kind: 'primitive',
					primitive: 'box',
					id: 'box-a',
					name: 'Box',
					dimensions: { width: 1, height: 1, depth: 1 },
					materialId: 'plaster-warm',
					castShadow: true,
					receiveShadow: true,
					position: [1, 0.5, 1],
					rotation: [0, 0, 0],
					scale: 1
				}
			]),
			sourceContentId: 'source'
		} as unknown as SceneOperationContext;
		expect(
			planDuplicateLight({ context, entityId: 'box-a', newEntityId: 'box-b' })
		).toMatchObject({ kind: 'rejected', code: 'unsupported-transform' });
	});

	it('update refuses a point angle instead of writing an unused field', () => {
		const context = {
			layout: { rooms: [], walls: [], openings: [], objects: [], floor: { elevation: 0 } },
			scene: sceneWith([
				{
					kind: 'light',
					light: 'point',
					id: 'point-a',
					name: 'Point',
					color: '#ffffff',
					intensity: Math.PI,
					castShadow: false,
					position: [1, 2, 1],
					rotation: [0, 0, 0]
				}
			]),
			sourceContentId: 'source'
		} as unknown as SceneOperationContext;
		expect(
			planUpdateLight({ context, entityId: 'point-a', update: { angle: 0.2 } })
		).toMatchObject({ kind: 'rejected', code: 'invalid-value' });
	});
});
