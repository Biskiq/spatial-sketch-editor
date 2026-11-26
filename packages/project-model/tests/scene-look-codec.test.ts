import { describe, expect, it } from 'vitest';
import {
	SCENE_SKY_DEFAULT,
	SCENE_UNIT_FORMAT_VERSION,
	skyFromPreset,
	validateCameraFreeScenePayload,
	type CameraFreeSceneDocument
} from '@portfolio/project-model/units';
import { createUnitProject } from './__fixtures__/unit-envelope';

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

describe('Scene unit payload', () => {
	it('admits the current Scene format and refuses any other version', () => {
		expect(validateCameraFreeScenePayload(payload()).success).toBe(true);
		for (const formatVersion of [SCENE_UNIT_FORMAT_VERSION - 1, SCENE_UNIT_FORMAT_VERSION + 1]) {
			expect(issues({ ...payload(), formatVersion })).toContainEqual(
				expect.objectContaining({ code: 'unsupported_format_version', path: '$.formatVersion' })
			);
		}
	});

	it('admits Wall-side and Region-face Finishes and refuses non-normal surface assignments', () => {
		const left = { surface: { kind: 'wall-side', wallId: 'a-wall', side: 'left' }, finish: { materialId: 'marble-light' } };
		const right = { surface: { kind: 'wall-side', wallId: 'z-wall', side: 'right' }, finish: { materialId: 'velvet-dark' } };
		const top = { surface: { kind: 'region-face', regionId: 'r', face: 'top' }, finish: { materialId: 'marble-light' } };
		const underside = { surface: { kind: 'region-face', regionId: 'r', face: 'underside' }, finish: { materialId: 'velvet-dark' } };
		const admitted = validateCameraFreeScenePayload(payload({ surfaceFinishes: [top, underside, left, right] }));
		expect(admitted.success).toBe(true);
		if (admitted.success) expect(admitted.value.surfaceFinishes).toEqual([top, underside, left, right]);

		const cases: Array<{ readonly assignments: unknown[]; readonly code: string }> = [
			{ assignments: [right, left], code: 'surface_finish_not_normal' },
			{ assignments: [left, left], code: 'duplicate_surface_finish' },
			{ assignments: [{ ...left, surface: { ...left.surface, side: 'top' } }], code: 'unknown-tag' },
			{ assignments: [{ ...top, surface: { ...top.surface, face: 'edge' } }], code: 'unknown_surface_face' },
			{ assignments: [{ ...top, surface: { ...top.surface, face: 'side' } }], code: 'unknown_surface_face' },
			{ assignments: [{ ...top, surface: { kind: 'region' } }], code: 'unknown_surface_kind' },
			{
				assignments: [{ surface: left.surface, finish: { materialInstanceId: 'pristine' } }],
				code: 'surface_finish_not_normal'
			}
		];
		for (const item of cases) {
			const materials = JSON.stringify(item.assignments).includes('pristine')
				? [{ id: 'pristine', name: 'Pristine', base: { catalogue: 'plaster-warm' } }]
				: [];
			expect(issues(payload({ surfaceFinishes: item.assignments, materials }))).toContainEqual(
				expect.objectContaining({ code: item.code })
			);
		}
		expect(issues(payload({ surfaceFinishes: [] }))).toContainEqual(
			expect.objectContaining({ code: 'surface_finish_not_normal' })
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
					{ id: 'm', name: 'M', base: { catalogue: 'plaster-warm' }, overrides: { color: '#aabbcc' } }
				]
			})
		);
		expect(literal.success).toBe(true);

		const follower = validateCameraFreeScenePayload(
			payload({
				palette: PALETTE,
				materials: [
					{ id: 'm', name: 'M', base: { catalogue: 'plaster-warm' }, overrides: { color: { slot: 'accent' } } }
				]
			})
		);
		expect(follower.success).toBe(true);
		if (follower.success) expect(follower.value.palette).toEqual(PALETTE);

		expect(
			issues(
				payload({
					materials: [
						{ id: 'm', name: 'M', base: { catalogue: 'plaster-warm' }, overrides: { color: { slot: 'missing' } } }
					]
				})
			)
		).toContainEqual(
			expect.objectContaining({ code: 'unknown_palette_slot', path: '$.materials[0].overrides.color.slot' })
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
				{ id: 'm', name: 'M', base: { catalogue: 'plaster-warm' as const }, overrides: { maps: { color: { image: { textureId: 'tex-1' } }, normal: { image: { textureId: 'tex-1' }, convention: '+Y' as const } }, mapping: { kind: 'target' as const, metric: { rotation: 0.25, offset: [0.1, 0.2] as [number, number], tileMeters: [1, 2] as [number, number] } } } }
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
				{ name: 'M', id: 'm', base: { catalogue: 'plaster-warm' }, overrides: { mapping: { kind: 'target' as const, metric: { tileMeters: [1, 2], offset: [0.1, 0.2], rotation: 0.25 } }, maps: { normal: { image: { textureId: 'tex-1' }, convention: '+Y' as const }, color: { image: { textureId: 'tex-1' } } } } }
			],
			textures: [{ uri: '/textures/one.png', name: 'One', id: 'tex-1' }],
			formatVersion: SCENE_UNIT_FORMAT_VERSION
		};

		const first = await createUnitProject({ id: 'project-order-a', name: 'A', scene: sceneA });
		const second = await createUnitProject({ id: 'project-order-b', name: 'B', scene: sceneB });
		expect(first.units.scene.header.contentRevision).toBe(second.units.scene.header.contentRevision);
	});
});
