/**
 * Scene 9's Look schema at the unit boundary.
 *
 * The Scene codec owns one document's strict shape. This suite covers what only
 * the unit reader knows: the palette, the follower check and the stored Sky and
 * Treatment, plus the one environment writer that installs a preset start.
 */
import { describe, expect, it } from 'vitest';
import {
	SCENE_ENVIRONMENT_SET_KIND,
	SCENE_SKY_UPDATE_KIND,
	SCENE_SKY_DEFAULT,
	createSceneSkyUpdatePlanner,
	skyFromPreset,
	SCENE_UNIT_FORMAT_VERSION,
	createSceneEnvironmentSetPlanner,
	type CameraFreeSceneDocument,
	type ProjectEnvelope,
	type SceneEnvironment
} from '@portfolio/project-model/units';
import type { AcceptedSnapshot, AuthoringIntent } from '@portfolio/project-model';
import { validateCameraFreeScenePayload } from '@portfolio/project-model/units';
import {
	admitUnitProject,
	createUnitProject
} from '../authoring/__fixtures__/unit-envelope-fixtures';

const PALETTE = [
	{ id: 'wall', name: 'Wall', color: '#aabbcc' },
	{ id: 'accent', name: 'Accent', color: '#112233' }
];

function payload(extra: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [{ id: 'tex-1', name: 'One', uri: '/textures/one.png' }],
		materials: [],
		entities: [],
		...extra
	};
}

function issues(input: unknown) {
	const result = validateCameraFreeScenePayload(input);
	if (result.success) return [];
	return result.issues.map((issue) => ({ code: issue.code, path: issue.path }));
}

describe('Scene 9 unit payload', () => {
	it('admits format 9 and refuses format 8 strictly', () => {
		expect(validateCameraFreeScenePayload(payload()).success).toBe(true);
		expect(issues({ ...payload(), formatVersion: 8 })).toContainEqual(
			expect.objectContaining({ code: 'unsupported_format_version', path: '$.formatVersion' })
		);
	});

	it('drops an empty palette and an empty environment from the normalized value', () => {
		const result = validateCameraFreeScenePayload(
			payload({ palette: [], environment: {} })
		);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect('palette' in result.value).toBe(false);
		expect('environment' in result.value).toBe(false);
	});

	it('admits eight palette slots and refuses nine', () => {
		const eight = Array.from({ length: 8 }, (_, index) => ({
			id: `slot-${index}`,
			name: `Slot ${index}`,
			color: '#aabbcc'
		}));
		expect(validateCameraFreeScenePayload(payload({ palette: eight })).success).toBe(true);
		expect(issues(payload({ palette: [...eight, { id: 'slot-8', name: 'Slot 8', color: '#aabbcc' }] }))).toContainEqual(
			expect.objectContaining({ code: 'invalid_palette', path: '$.palette' })
		);
	});

	it('refuses duplicate palette ids, blank names and over-long ids', () => {
		expect(
			issues(payload({ palette: [PALETTE[0], { ...PALETTE[0], name: 'Other' }] }))
		).toContainEqual(expect.objectContaining({ code: 'duplicate_id', path: '$.palette[1].id' }));
		expect(
			issues(payload({ palette: [{ id: 'wall', name: '   ', color: '#aabbcc' }] }))
		).toContainEqual(expect.objectContaining({ code: 'invalid_value', path: '$.palette[0].name' }));
		expect(
			issues(payload({ palette: [{ id: 'x'.repeat(65), name: 'Wall', color: '#aabbcc' }] }))
		).toContainEqual(expect.objectContaining({ code: 'invalid_value', path: '$.palette[0].id' }));
	});

	it('admits a literal and a follower colour, and refuses an unknown follower', () => {
		const literal = validateCameraFreeScenePayload(
			payload({
				materials: [
					{ id: 'm', name: 'M', baseMaterialId: 'plaster-warm', color: '#aabbcc' }
				]
			})
		);
		expect(literal.success).toBe(true);

		const follower = validateCameraFreeScenePayload(
			payload({
				palette: PALETTE,
				materials: [
					{ id: 'm', name: 'M', baseMaterialId: 'plaster-warm', color: { slot: 'accent' } }
				]
			})
		);
		expect(follower.success).toBe(true);
		if (follower.success) expect(follower.value.palette).toEqual(PALETTE);

		expect(
			issues(
				payload({
					materials: [
						{ id: 'm', name: 'M', baseMaterialId: 'plaster-warm', color: { slot: 'missing' } }
					]
				})
			)
		).toContainEqual(
			expect.objectContaining({ code: 'unknown_palette_slot', path: '$.materials[0].color.slot' })
		);
	});

	it('admits the full stored Sky and refuses every out-of-bounds field', () => {
		const start = structuredClone(skyFromPreset('dusk', 0));
		const admitted = validateCameraFreeScenePayload(payload({ environment: { sky: start } }));
		expect(admitted.success).toBe(true);
		if (admitted.success) expect(admitted.value.environment?.sky).toEqual(start);

		const cases = [
			['time', { time: 24 }], ['heading', { heading: 360 }],
			['arcHeight', { arcHeight: 19 }], ['arcHeight', { arcHeight: 81 }],
			['haze', { haze: -1 }], ['haze', { haze: 101 }],
			['exposure', { exposure: -2.1 }], ['exposure', { exposure: 2.1 }],
			['softness', { softness: Infinity }], ['skyColor', { skyColor: '#ABCDEF' }],
			['sunShadows', { sunShadows: 1 }], ['moon.color', { moon: { strength: 0.1 } }]
		] as const;
		for (const [field, patch] of cases) {
			expect(issues(payload({ environment: { sky: { ...start, ...patch } } }))).toContainEqual({
				code: 'invalid_sky_field', path: `$.environment.sky.${field}`
			});
		}
		expect(issues(payload({ environment: { sky: { ...start, sun: {} } } }))).toContainEqual({
			code: 'unknown-key', path: '$.environment.sky.sun'
		});

	});

	it('admits Flat colour and Clay, and refuses natural as a tag', () => {
		expect(
			validateCameraFreeScenePayload(payload({ environment: { treatment: 'flat-colour' } })).success
		).toBe(true);
		expect(validateCameraFreeScenePayload(payload({ environment: { treatment: 'clay' } })).success).toBe(
			true
		);
		expect(issues(payload({ environment: { treatment: 'natural' } }))).toContainEqual(
			expect.objectContaining({ code: 'invalid_value', path: '$.environment.treatment' })
		);
	});

	it('hashes the same content regardless of key order', async () => {
		const sceneA = {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [{ id: 'tex-1', name: 'One', uri: '/textures/one.png' }],
			materials: [
				{
					id: 'm',
					name: 'M',
					baseMaterialId: 'plaster-warm' as const,
					maps: { color: 'tex-1', normal: 'tex-1' },
					mapping: { rotation: 0.25, offset: [0.1, 0.2] as [number, number], tileMeters: [1, 2] as [number, number] }
				}
			],
			entities: [],
			palette: [{ id: 'accent', name: 'Accent', color: '#112233' }],
			environment: { treatment: 'clay' as const, sky: structuredClone(skyFromPreset('daylight', 0)) }
		};
		const sceneB: CameraFreeSceneDocument = {
			environment: { sky: structuredClone(skyFromPreset('daylight', 0)), treatment: 'clay' },
			palette: [{ color: '#112233', name: 'Accent', id: 'accent' }],
			entities: [],
			materials: [
				{
					mapping: { tileMeters: [1, 2], offset: [0.1, 0.2], rotation: 0.25 },
					maps: { normal: 'tex-1', color: 'tex-1' },
					baseMaterialId: 'plaster-warm',
					name: 'M',
					id: 'm'
				}
			],
			textures: [{ uri: '/textures/one.png', name: 'One', id: 'tex-1' }],
			formatVersion: SCENE_UNIT_FORMAT_VERSION
		};

		const first = await createUnitProject({ id: 'project-order-a', name: 'A', scene: sceneA });
		const second = await createUnitProject({ id: 'project-order-b', name: 'B', scene: sceneB });
		expect(first.units.scene.header.contentRevision).toBe(second.units.scene.header.contentRevision);
	});
});

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
