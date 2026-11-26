import { describe, expect, it } from 'vitest';
import { SCENE_SKY_DEFAULT, skyFromPreset, SCENE_UNIT_FORMAT_VERSION, type ProjectEnvelope, type SceneEnvironment } from '@portfolio/project-model/units';
import { SCENE_ENVIRONMENT_SET_KIND, SCENE_SKY_UPDATE_KIND, createSceneSkyUpdatePlanner, createSceneEnvironmentSetPlanner } from '@portfolio/project-model/units/planning';
import type { AcceptedSnapshot, AuthoringIntent } from '@portfolio/project-model/f4';
import { validateCameraFreeScenePayload } from '@portfolio/project-model/units';
import {
	admitUnitProject,
	createUnitProject
} from '../authoring/__fixtures__/unit-envelope-fixtures';

function payload(extra: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [{ id: 'tex-1', name: 'One', uri: '/textures/one.png' }],
		materials: [],
		entities: [],
		...extra
	};
}

async function snapshotOf(environment?: SceneEnvironment): Promise<AcceptedSnapshot<ProjectEnvelope>> {
	const project = await createUnitProject({
		id: 'project-look',
		name: 'Look',
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: [],
			entities: [],
			...(environment === undefined ? {} : { environment })
		}
	});
	const admitted = await admitUnitProject(project, {
		projectId: project.id,
		revisionId: 'revision-1'
	});
	if (admitted.kind !== 'admitted') {
		throw new Error(`the fixture was not admitted: ${JSON.stringify(admitted.issues)}`);
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

function request(
	snapshot: AcceptedSnapshot<ProjectEnvelope>,
	preset: AuthoringIntent['payload']
): AuthoringIntent {
	return {
		version: 1,
		kind: SCENE_ENVIRONMENT_SET_KIND,
		operationId: 'operation-environment',
		expectedRevision: snapshot.acceptedRevision,
		targets: [],
		payload: preset,
		capturedInputs: [],
		allocatedIds: []
	};
}

async function plan(preset: 'paper' | 'studio' | 'daylight' | 'golden-hour' | 'dusk', environment?: SceneEnvironment) {
	const snapshot = await snapshotOf(environment);
	const intent = request(snapshot, { preset });
	return createSceneEnvironmentSetPlanner().prepare({
		snapshot,
		intent,
		capturedInputs: intent.capturedInputs,
		allocatedIds: intent.allocatedIds
	});
}

describe('scene-environment-set', () => {
	it('writes a fresh preset start, preserving the Studio heading', async () => {
		const outcome = await plan('golden-hour', { sky: skyFromPreset('studio', 137) });
		expect(outcome.kind).toBe('prepared');
		if (outcome.kind !== 'prepared') return;
		const sky = outcome.candidate.source.units.scene.data.environment?.sky;
		expect(sky).toEqual(skyFromPreset('golden-hour', 137));
	});

	it('keeps the Treatment through a preset write and through Studio', async () => {
		const dusk = await plan('dusk', { treatment: 'clay' });
		expect(dusk.kind).toBe('prepared');
		if (dusk.kind === 'prepared') {
			expect(dusk.candidate.source.units.scene.data.environment).toEqual({
				treatment: 'clay',
				sky: skyFromPreset('dusk', 0)
			});
		}

		const paper = await plan('studio', {
			treatment: 'clay',
			sky: structuredClone(skyFromPreset('dusk', 0))
		});
		expect(paper.kind).toBe('prepared');
		if (paper.kind === 'prepared') {
			expect(paper.candidate.source.units.scene.data.environment).toEqual({ treatment: 'clay' });
		}
	});

	it('removes the environment entirely when Studio drops the last field', async () => {
		const paper = await plan('studio', { sky: structuredClone(skyFromPreset('daylight', 0)) });
		expect(paper.kind).toBe('prepared');
		if (paper.kind === 'prepared') {
			expect('environment' in paper.candidate.source.units.scene.data).toBe(false);
		}
	});

	it('answers no-change for Studio on Studio and for a Sky equal to its start', async () => {
		const paper = await plan('studio');
		expect(paper).toMatchObject({ kind: 'rejected', code: 'no-change' });

		const same = await plan('daylight', { sky: structuredClone(skyFromPreset('daylight', 0)) });
		expect(same).toMatchObject({ kind: 'rejected', code: 'no-change' });
	});

	it('treats the current preset as Reset on an edited Sky', async () => {
		const base = skyFromPreset('daylight', 0);
		const edited = {
			...base,
			skyColor: '#010101',
			exposure: 1.05
		};
		const reset = await plan('daylight', { sky: edited });
		expect(reset.kind).toBe('prepared');
		if (reset.kind !== 'prepared') return;
		expect(reset.candidate.source.units.scene.data.environment?.sky).toEqual(
			skyFromPreset('daylight', 0)
		);
		expect(reset.candidate.changes).toEqual([
			{ kind: 'scene.environment.updated', subjectIds: [], fields: ['environment'] }
		]);
	});
});

describe('Scene 9 Sky patch planner', () => {
	async function update(patch: unknown, environment?: SceneEnvironment) {
		const snapshot = await snapshotOf(environment);
		const intent = {
			...request(snapshot, patch as AuthoringIntent['payload']),
			kind: SCENE_SKY_UPDATE_KIND
		};
		return createSceneSkyUpdatePlanner().prepare({
			snapshot, intent, capturedInputs: intent.capturedInputs, allocatedIds: intent.allocatedIds
		});
	}

	it('normalizes Studio at heading zero only', () => {
		const validate = (heading: number) => validateCameraFreeScenePayload(payload({
			environment: { sky: { ...SCENE_SKY_DEFAULT, heading } }
		}));
		const empty = validate(0);
		const aimed = validate(90);
		expect(empty.success && empty.value.environment).toBeUndefined();
		expect(aimed.success && aimed.value.environment?.sky?.heading).toBe(90);
	});

	it('refuses the retired Paper choice and admits only heading edits in Studio', async () => {
		expect(await plan('paper')).toMatchObject({ kind: 'rejected', code: 'invalid-payload' });
		expect(await update({ time: 12 })).toMatchObject({ kind: 'rejected', code: 'unsupported-operation' });
		const result = await update({ heading: 45 });
		expect(result.kind === 'prepared' && result.candidate.source.units.scene.data.environment?.sky)
			.toEqual(skyFromPreset('studio', 45));
	});

	it('merges one nested Moon field and validates the merged Sky', async () => {
		const sky = skyFromPreset('moonlit', 151);
		const environment = { sky, treatment: 'clay' } as const;
		const result = await update({ moon: { strength: 0.6 } }, environment);
		expect(result.kind === 'prepared' && result.candidate.source.units.scene.data.environment).toEqual({
			sky: { ...sky, moon: { ...sky.moon, strength: 0.6 } }, treatment: 'clay'
		});
		for (const patch of [{}, { moon: {} }, { preset: 'dusk' }, { time: 24 }, { moon: { color: '#FFFFFF' } }]) {
			expect(await update(patch, environment)).toMatchObject({ kind: 'rejected', code: 'invalid-payload' });
		}
		expect(await update({ heading: 151 }, environment)).toMatchObject({ kind: 'rejected', code: 'no-change' });
	});
});
