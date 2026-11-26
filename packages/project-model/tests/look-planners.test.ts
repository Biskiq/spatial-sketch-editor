/**
 * T2.S6 — the three Look writers.
 *
 * A Look writes its Sky at the World's heading, its Treatment, and a palette
 * seed only when the World has none. It never rewrites a Finish, a material or a
 * light. Treatment changes only the resolve-time tag; Previous restores exactly
 * one captured environment. Each is one change record, so each is one Undo.
 */
import { describe, expect, it } from 'vitest';
import type { AcceptedSnapshot, AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneMaterialInstance } from '@portfolio/project-model/scene';
import { SCENE_UNIT_FORMAT_VERSION, SCENE_SKY_DEFAULT, UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION, skyFromPreset, type CameraFreeSceneDocument, type ProjectEnvelope, type SceneEnvironment } from '@portfolio/project-model/units';
import { SCENE_LOOK_APPLY_KIND, SCENE_LOOK_RESTORE_KIND, SCENE_TREATMENT_SET_KIND, createSceneLookApplyPlanner, createSceneLookRestorePlanner, createSceneTreatmentSetPlanner } from '@portfolio/project-model/units/planning';
import { createUnitProject } from './__fixtures__/unit-envelope';

const MATERIAL: SceneMaterialInstance = { id: 'finish-1', name: 'Coral paint', base: { catalogue: 'plaster-warm' }, overrides: { color: '#ee6c4d', roughness: 0.8 } };

function sceneDocument(environment?: SceneEnvironment): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [structuredClone(MATERIAL)],
		entities: [
			{
				kind: 'primitive',
				id: 'box-1',
				name: 'Box',
				position: [0, 0, 0],
				rotation: [0, 0, 0],
				primitive: 'box',
				dimensions: { width: 1, height: 1, depth: 1 },
				materialId: 'plaster-warm',
				materialInstanceId: 'finish-1',
				castShadow: true,
				receiveShadow: true
			} as CameraFreeSceneDocument['entities'][number],
			{
				kind: 'light',
				id: 'light-1',
				name: 'Lamp',
				position: [0, 2, 0],
				rotation: [0, 0, 0],
				light: 'point',
				color: '#ffffff',
				intensity: 3,
				castShadow: false
			} as CameraFreeSceneDocument['entities'][number]
		],
		...(environment === undefined ? {} : { environment })
	};
}

function snapshotOf(project: ProjectEnvelope): AcceptedSnapshot<ProjectEnvelope> {
	return {
		domain: { source: project },
		sourceKind: UNIT_SOURCE_KIND,
		sourceVersion: UNIT_SOURCE_VERSION
	} as unknown as AcceptedSnapshot<ProjectEnvelope>;
}

async function plan(
	planner: { prepare: (request: never) => unknown },
	kind: string,
	payload: unknown,
	environment?: SceneEnvironment
): Promise<{ kind: string; code?: string; candidate?: { source: ProjectEnvelope; changes?: unknown[] }; changes?: unknown[] }> {
	const project = await createUnitProject({
		id: 'project-look',
		name: 'Look',
		scene: sceneDocument(environment)
	});
	const snapshot = snapshotOf(project);
	const intent: AuthoringIntent = {
		version: 1,
		kind,
		operationId: `${kind}-1`,
		expectedRevision: { projectId: project.id, revisionId: 'revision-1' },
		targets: [],
		payload: payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds: []
	};
	return (planner as { prepare: (request: unknown) => unknown }).prepare({
		snapshot,
		intent,
		capturedInputs: [],
		allocatedIds: []
	}) as never;
}

describe('T2.S6 — scene-look-apply', () => {
	it('writes the Look Sky at the World heading, its Treatment and a seed palette', async () => {
		const outcome = await plan(createSceneLookApplyPlanner(), SCENE_LOOK_APPLY_KIND, { look: 'riso' }, {
			sky: skyFromPreset('studio', 137)
		});
		expect(outcome.kind).toBe('prepared');
		if (outcome.kind !== 'prepared') return;
		const data = outcome.candidate!.source.units.scene.data;
		expect(data.environment).toEqual({
			sky: { ...structuredClone(requireRisoSky()), heading: 137 },
			treatment: 'flat-colour'
		});
		expect(data.palette).toEqual([
			{ id: 'look-riso-1', name: 'Coral', color: '#ee6c4d' },
			{ id: 'look-riso-2', name: 'Ink', color: '#293241' },
			{ id: 'look-riso-3', name: 'Gold', color: '#f4d35e' }
		]);
		expect(outcome.candidate!.changes).toEqual([
			{ kind: 'scene.look.applied', subjectIds: [], fields: ['environment', 'palette'] }
		]);
	});

	it('never rewrites a Finish, an object or a light', async () => {
		const before = sceneDocument();
		const outcome = await plan(createSceneLookApplyPlanner(), SCENE_LOOK_APPLY_KIND, { look: 'clay' });
		expect(outcome.kind).toBe('prepared');
		if (outcome.kind !== 'prepared') return;
		const data = outcome.candidate!.source.units.scene.data;
		expect(data.materials).toEqual(before.materials);
		expect(data.entities).toEqual(before.entities);
		expect(data.palette).toBeUndefined();
	});

	it('keeps an existing palette instead of seeding the Look palette', async () => {
		const project = await createUnitProject({
			id: 'project-look',
			name: 'Look',
			scene: {
				...sceneDocument(),
				palette: [{ id: 'wall', name: 'Wall', color: '#aabbcc' }]
			}
		});
		const snapshot = snapshotOf(project);
		const outcome = createSceneLookApplyPlanner().prepare({
			snapshot,
			intent: {
				version: 1,
				kind: SCENE_LOOK_APPLY_KIND,
				operationId: 'apply',
				expectedRevision: { projectId: project.id, revisionId: 'revision-1' },
				targets: [],
				payload: { look: 'riso' },
				capturedInputs: [],
				allocatedIds: []
			},
			capturedInputs: [],
			allocatedIds: []
		});
		expect(outcome.kind).toBe('prepared');
		if (outcome.kind !== 'prepared') return;
		expect(outcome.candidate.source.units.scene.data.palette).toEqual([
			{ id: 'wall', name: 'Wall', color: '#aabbcc' }
		]);
		expect(outcome.candidate!.changes).toEqual([
			{ kind: 'scene.look.applied', subjectIds: [], fields: ['environment'] }
		]);
	});

	it('refuses an unknown Look and a repeated apply', async () => {
		expect(await plan(createSceneLookApplyPlanner(), SCENE_LOOK_APPLY_KIND, { look: 'vaporwave' }))
			.toMatchObject({ kind: 'rejected', code: 'unknown-look' });
		expect(await plan(createSceneLookApplyPlanner(), SCENE_LOOK_APPLY_KIND, {}))
			.toMatchObject({ kind: 'rejected', code: 'invalid-payload' });

		const riso = requireRisoSky();
		const again = await plan(createSceneLookApplyPlanner(), SCENE_LOOK_APPLY_KIND, { look: 'riso' }, {
			sky: riso,
			treatment: 'flat-colour'
		});
		// The World has no palette yet, so a second Riso apply still seeds it.
		expect(again.kind).toBe('prepared');
		const seeded = await createUnitProject({
			id: 'project-look-2',
			name: 'Look',
			scene: {
				...sceneDocument({ sky: riso, treatment: 'flat-colour' }),
				palette: [{ id: 'look-riso-1', name: 'Coral', color: '#ee6c4d' }]
			}
		});
		const outcome = createSceneLookApplyPlanner().prepare({
			snapshot: snapshotOf(seeded),
			intent: {
				version: 1, kind: SCENE_LOOK_APPLY_KIND, operationId: 'again',
				expectedRevision: { projectId: seeded.id, revisionId: 'revision-1' },
				targets: [], payload: { look: 'riso' }, capturedInputs: [], allocatedIds: []
			},
			capturedInputs: [], allocatedIds: []
		});
		expect(outcome).toMatchObject({ kind: 'rejected', code: 'no-change' });
	});
});

describe('T2.S6 — scene-treatment-set', () => {
	const environment: SceneEnvironment = { sky: skyFromPreset('dusk', 42) };

	it('changes only the Treatment and keeps the Sky', async () => {
		const outcome = await plan(createSceneTreatmentSetPlanner(), SCENE_TREATMENT_SET_KIND, {
			treatment: 'clay'
		}, environment);
		expect(outcome.kind).toBe('prepared');
		if (outcome.kind !== 'prepared') return;
		expect(outcome.candidate!.source.units.scene.data.environment).toEqual({
			...environment,
			treatment: 'clay'
		});
		expect(outcome.candidate!.changes).toEqual([
			{ kind: 'scene.environment.updated', subjectIds: [], fields: ['environment'] }
		]);
	});

	it('Natural deletes the tag and keeps the Sky; a repeated choice is no-change', async () => {
		const natural = await plan(createSceneTreatmentSetPlanner(), SCENE_TREATMENT_SET_KIND, {
			treatment: 'natural'
		}, { ...environment, treatment: 'clay' });
		expect(natural.kind).toBe('prepared');
		if (natural.kind === 'prepared') {
			expect(natural.candidate!.source.units.scene.data.environment).toEqual(environment);
		}
		expect(await plan(createSceneTreatmentSetPlanner(), SCENE_TREATMENT_SET_KIND, {
			treatment: 'natural'
		}, environment)).toMatchObject({ kind: 'rejected', code: 'no-change' });
		expect(await plan(createSceneTreatmentSetPlanner(), SCENE_TREATMENT_SET_KIND, {
			treatment: 'sepia'
		}, environment)).toMatchObject({ kind: 'rejected', code: 'invalid-payload' });
	});
});

describe('T2.S6 — scene-look-restore', () => {
	it('restores exactly the captured environment and answers no-change when equal', async () => {
		const captured: SceneEnvironment = { sky: skyFromPreset('golden-hour', 15), treatment: 'clay' };
		const outcome = await plan(createSceneLookRestorePlanner(), SCENE_LOOK_RESTORE_KIND, {
			sky: captured.sky,
			treatment: captured.treatment
		}, { sky: skyFromPreset('dusk', 15) });
		expect(outcome.kind).toBe('prepared');
		if (outcome.kind !== 'prepared') return;
		expect(outcome.candidate!.source.units.scene.data.environment).toEqual(captured);
		expect(outcome.candidate!.changes).toEqual([
			{ kind: 'scene.look.restored', subjectIds: [], fields: ['environment'] }
		]);

		expect(await plan(createSceneLookRestorePlanner(), SCENE_LOOK_RESTORE_KIND, {
			sky: captured.sky,
			treatment: captured.treatment
		}, captured)).toMatchObject({ kind: 'rejected', code: 'no-change' });
	});

	it('restores Natural Paper as an absent environment', async () => {
		const outcome = await plan(createSceneLookRestorePlanner(), SCENE_LOOK_RESTORE_KIND, {
			sky: null
		}, { sky: skyFromPreset('dusk', 0), treatment: 'flat-colour' });
		expect(outcome.kind).toBe('prepared');
		if (outcome.kind === 'prepared') {
			expect('environment' in outcome.candidate!.source.units.scene.data).toBe(false);
		}
		expect(await plan(createSceneLookRestorePlanner(), SCENE_LOOK_RESTORE_KIND, {
			sky: structuredClone(SCENE_SKY_DEFAULT)
		})).toMatchObject({ kind: 'rejected', code: 'no-change' });
	});
});

function requireRisoSky() {
	return {
		preset: 'daylight' as const,
		time: 13,
		heading: 0,
		arcHeight: 55,
		haze: 5,
		exposure: 0.15,
		softness: 0.05,
		sunShadows: true,
		moon: { color: '#c9d6ff', strength: 0.25 },
		skyColor: '#f4d35e',
		groundColor: '#3d5a80'
	};
}
