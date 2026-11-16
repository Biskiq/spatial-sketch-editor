/**
 * Scene 8's Look schema at the unit boundary.
 *
 * The Scene codec owns one document's strict shape. This suite covers what only
 * the unit reader knows: the palette, the follower check and the stored Sky and
 * Treatment, plus the one environment writer that installs a preset start.
 */
import { describe, expect, it } from 'vitest';
import {
	SCENE_ENVIRONMENT_SET_KIND,
	SCENE_SKY_PRESET_STARTS,
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

describe('Scene 8 unit payload', () => {
	it('admits format 8 and refuses format 7 strictly', () => {
		expect(validateCameraFreeScenePayload(payload()).success).toBe(true);
		expect(issues({ ...payload(), formatVersion: 7 })).toContainEqual(
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
		const start = structuredClone(SCENE_SKY_PRESET_STARTS.dusk);
		const admitted = validateCameraFreeScenePayload(payload({ environment: { sky: start } }));
		expect(admitted.success).toBe(true);
		if (admitted.success) expect(admitted.value.environment?.sky).toEqual(start);

		const tooSoft = { ...start, sun: { ...start.sun, softness: 1.5 } };
		expect(issues(payload({ environment: { sky: tooSoft } }))).toContainEqual(
			expect.objectContaining({ code: 'invalid_value', path: '$.environment.sky.sun.softness' })
		);

		const tooHigh = { ...start, sun: { ...start.sun, elevation: Math.PI / 2 + 0.01 } };
		expect(issues(payload({ environment: { sky: tooHigh } }))).toContainEqual(
			expect.objectContaining({ code: 'invalid_value', path: '$.environment.sky.sun.elevation' })
		);

		const unreadable = { ...start, haze: { color: start.haze.color, visibility: 1 } };
		expect(issues(payload({ environment: { sky: unreadable } }))).toContainEqual(
			expect.objectContaining({ code: 'invalid_value', path: '$.environment.sky.haze.visibility' })
		);

		const missingHaze = structuredClone(start) as unknown as { haze: Record<string, unknown> };
		delete missingHaze.haze.color;
		expect(issues(payload({ environment: { sky: missingHaze } }))).toContainEqual(
			expect.objectContaining({ path: '$.environment.sky.haze.color' })
		);

		const missingSoftness = structuredClone(start) as unknown as { sun: Record<string, unknown> };
		delete missingSoftness.sun.softness;
		expect(issues(payload({ environment: { sky: missingSoftness } }))).toContainEqual(
			expect.objectContaining({ path: '$.environment.sky.sun.softness' })
		);
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
			environment: { treatment: 'clay' as const, sky: structuredClone(SCENE_SKY_PRESET_STARTS.daylight) }
		};
		const sceneB: CameraFreeSceneDocument = {
			environment: { sky: structuredClone(SCENE_SKY_PRESET_STARTS.daylight), treatment: 'clay' },
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

async function plan(preset: 'paper' | 'daylight' | 'golden-hour' | 'dusk', environment?: SceneEnvironment) {
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
	it('writes a fresh preset start', async () => {
		const outcome = await plan('golden-hour');
		expect(outcome.kind).toBe('prepared');
		if (outcome.kind !== 'prepared') return;
		const sky = outcome.candidate.source.units.scene.data.environment?.sky;
		expect(sky).toEqual(SCENE_SKY_PRESET_STARTS['golden-hour']);
		expect(sky).not.toBe(SCENE_SKY_PRESET_STARTS['golden-hour']);
	});

	it('keeps the Treatment through a preset write and through Paper', async () => {
		const dusk = await plan('dusk', { treatment: 'clay' });
		expect(dusk.kind).toBe('prepared');
		if (dusk.kind === 'prepared') {
			expect(dusk.candidate.source.units.scene.data.environment).toEqual({
				treatment: 'clay',
				sky: SCENE_SKY_PRESET_STARTS.dusk
			});
		}

		const paper = await plan('paper', {
			treatment: 'clay',
			sky: structuredClone(SCENE_SKY_PRESET_STARTS.dusk)
		});
		expect(paper.kind).toBe('prepared');
		if (paper.kind === 'prepared') {
			expect(paper.candidate.source.units.scene.data.environment).toEqual({ treatment: 'clay' });
		}
	});

	it('removes the environment entirely when Paper drops the last field', async () => {
		const paper = await plan('paper', { sky: structuredClone(SCENE_SKY_PRESET_STARTS.daylight) });
		expect(paper.kind).toBe('prepared');
		if (paper.kind === 'prepared') {
			expect('environment' in paper.candidate.source.units.scene.data).toBe(false);
		}
	});

	it('answers no-change for Paper on Paper and for a Sky equal to its start', async () => {
		const paper = await plan('paper');
		expect(paper).toMatchObject({ kind: 'rejected', code: 'no-change' });

		const same = await plan('daylight', { sky: structuredClone(SCENE_SKY_PRESET_STARTS.daylight) });
		expect(same).toMatchObject({ kind: 'rejected', code: 'no-change' });
	});

	it('treats the current preset as Reset on an edited Sky', async () => {
		const base = SCENE_SKY_PRESET_STARTS.daylight;
		const edited = {
			...base,
			zenith: '#010101',
			sun: { ...base.sun, intensity: 1.05 }
		};
		const reset = await plan('daylight', { sky: edited });
		expect(reset.kind).toBe('prepared');
		if (reset.kind !== 'prepared') return;
		expect(reset.candidate.source.units.scene.data.environment?.sky).toEqual(
			SCENE_SKY_PRESET_STARTS.daylight
		);
		expect(reset.candidate.changes).toEqual([
			{ kind: 'scene.environment.updated', subjectIds: [], fields: ['environment'] }
		]);
	});
});
