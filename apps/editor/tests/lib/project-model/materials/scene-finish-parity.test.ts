/**
 * The compatibility proof between today's Scene 11 Finish and the v1 grammar.
 *
 * This suite catches an adapter that quietly changes the current appearance:
 * every catalogue base, an S4 single-image Finish, a palette follower, a
 * rotated non-square mapping and the legacy normal scale/flip pair are resolved
 * twice — once by the shipped `resolveSceneMaterial`, once by the pure
 * `sceneFinishToContract` + `resolveFinish` — and the readings must agree.
 *
 * Treatment is intentionally not compared: the pure resolver returns the
 * untreated value, and the render layer applies Treatment once afterwards.
 */
import { describe, expect, it } from 'vitest';
import {
	createImageIndex,
	mergeImageIndexes,
	resolveFinish,
	sceneFinishToContract,
	shippedImageIndex,
	type FinishOverrides,
	type LocalImage
} from '@portfolio/project-model/materials';
import { computeTextureRepeat } from '$lib/content/materials';
import {
	resolveSceneMaterial,
	sceneLookFor,
	type LookSource,
	type ResolveTarget
} from '$lib/render/materials/scene-instance-material';
import type {
	MaterialTextureSlot
} from '$lib/types/materials';
import type { SceneColor, SceneMaterialInstance, SceneTextureAsset } from '$lib/content/scene';
import { IMAGE_HASH, contentHash } from './fixtures';

const TEXTURES: SceneTextureAsset[] = [
	{ id: 'tex-color', name: 'Colour', uri: '/project-assets/tex-color' },
	{ id: 'tex-normal', name: 'Normal', uri: '/project-assets/tex-normal' },
	{ id: 'tex-roughness', name: 'Roughness', uri: '/project-assets/tex-roughness' },
	{ id: 'tex-occlusion', name: 'Occlusion', uri: '/project-assets/tex-occlusion' },
	{ id: 'tex-metalness', name: 'Metalness', uri: '/project-assets/tex-metalness' }
];

const TEXTURE_HASH: Readonly<Record<string, string>> = {
	'tex-color': contentHash('scene-color'),
	'tex-normal': contentHash('scene-normal'),
	'tex-roughness': contentHash('scene-roughness'),
	'tex-occlusion': contentHash('scene-occlusion'),
	'tex-metalness': contentHash('scene-metalness')
};

function sceneImageIndex() {
	const project = TEXTURES.map((texture) => ({
		hash: TEXTURE_HASH[texture.id]!,
		source: { textureId: texture.id } as LocalImage
	}));
	return mergeImageIndexes(shippedImageIndex(), createImageIndex(project));
}

function textureUri(source: LocalImage): string | undefined {
	if ('shipped' in source) return source.shipped;
	return TEXTURES.find((texture) => texture.id === source.textureId)?.uri;
}

const SLOT_OF_ROLE = {
	color: 'map',
	normal: 'normalMap',
	roughness: 'roughnessMap',
	occlusion: 'aoMap',
	metalness: 'metalnessMap'
} as const satisfies Record<string, MaterialTextureSlot>;

type Case = {
	readonly name: string;
	readonly base: SceneMaterialInstance['baseMaterialId'];
	readonly instance?: {
		readonly color?: SceneColor;
		readonly roughness?: number;
		readonly metalness?: number;
		readonly maps?: Partial<Record<'color' | 'normal' | 'roughness' | 'occlusion' | 'metalness', string>>;
		readonly mapping?: { tileMeters?: [number, number]; rotation?: number; offset?: [number, number] };
		readonly normalScale?: number;
		readonly normalFlipY?: boolean;
	};
	readonly surface: [number, number];
};

const CASES: readonly Case[] = [
	...(
		['plaster-warm', 'wood-walnut', 'brass-aged', 'marble-light', 'velvet-dark', 'paper-aged'] as const
	).map((base): Case => ({ name: `catalogue:${base}`, base, surface: [3.5, 1.25] })),
	{
		name: 's4-single-image:marble',
		base: 'marble-light',
		instance: { maps: { color: 'tex-color' } },
		surface: [2.4, 1.1]
	},
	{
		name: 's4-single-image:brass',
		base: 'brass-aged',
		instance: { maps: { color: 'tex-color' }, roughness: 0.31 },
		surface: [0.75, 1.8]
	},
	{
		name: 'palette-follower',
		base: 'marble-light',
		instance: { color: { slot: 'slot-walnut' } },
		surface: [2, 2]
	},
	{
		name: 'rotated-non-square-mapping',
		base: 'wood-walnut',
		instance: {
			mapping: { tileMeters: [0.8, 1.6], rotation: 0.42, offset: [0.25, 0.5] }
		},
		surface: [3.2, 1.6]
	},
	{
		name: 'normal-plus-y',
		base: 'plaster-warm',
		instance: { maps: { normal: 'tex-normal' }, normalScale: 0.6, normalFlipY: false },
		surface: [2, 2]
	},
	{
		name: 'normal-minus-y',
		base: 'plaster-warm',
		instance: { maps: { normal: 'tex-normal' }, normalScale: 0.6, normalFlipY: true },
		surface: [2, 2]
	},
	{
		name: 'normal-scale-without-map-is-ignored',
		base: 'velvet-dark',
		instance: { normalScale: 0.4, normalFlipY: true },
		surface: [1, 1]
	},
	{
		name: 'all-scalar-roles',
		base: 'wood-walnut',
		instance: {
			roughness: 0,
			metalness: 1,
			maps: { roughness: 'tex-roughness', occlusion: 'tex-occlusion', metalness: 'tex-metalness' }
		},
		surface: [1.5, 3]
	}
];

function instanceFor(testCase: Case): SceneMaterialInstance | undefined {
	if (testCase.instance === undefined) return undefined;
	const instance = testCase.instance;
	return {
		id: `instance:${testCase.name}`,
		name: testCase.name,
		baseMaterialId: testCase.base,
		...(instance.color === undefined ? {} : { color: instance.color }),
		...(instance.roughness === undefined ? {} : { roughness: instance.roughness }),
		...(instance.metalness === undefined ? {} : { metalness: instance.metalness }),
		...(instance.maps === undefined ? {} : { maps: instance.maps }),
		...(instance.mapping === undefined ? {} : { mapping: instance.mapping }),
		...(instance.normalScale === undefined ? {} : { normalScale: instance.normalScale }),
		...(instance.normalFlipY === undefined ? {} : { normalFlipY: instance.normalFlipY })
	};
}

function lookSource(testCase: Case): LookSource {
	return {
		textures: TEXTURES,
		materials: instanceFor(testCase) === undefined ? [] : [instanceFor(testCase)!],
		palette: [{ id: 'slot-walnut', name: 'Walnut', color: '#5a3a22' }]
	};
}

function targetFor(testCase: Case): ResolveTarget {
	const instance = instanceFor(testCase);
	return {
		materialInstanceId: instance?.id ?? null,
		fallbackCatalogueId: testCase.base
	};
}

function pureResolution(testCase: Case) {
	const instance = instanceFor(testCase);
	const adapted = sceneFinishToContract(
		instance === undefined
			? { id: `implicit:${testCase.name}`, name: testCase.name, baseMaterialId: testCase.base }
			: {
					id: instance.id,
					name: instance.name,
					baseMaterialId: instance.baseMaterialId,
					...(instance.color === undefined ? {} : { color: instance.color }),
					...(instance.roughness === undefined ? {} : { roughness: instance.roughness }),
					...(instance.metalness === undefined ? {} : { metalness: instance.metalness }),
					...(instance.maps === undefined ? {} : { maps: instance.maps }),
					...(instance.mapping === undefined ? {} : { mapping: instance.mapping }),
					...(instance.normalScale === undefined ? {} : { normalScale: instance.normalScale }),
					...(instance.normalFlipY === undefined ? {} : { normalFlipY: instance.normalFlipY })
				}
	);
	if (!adapted.success) throw new Error(JSON.stringify(adapted.issues));
	const resolved = resolveFinish(
		{ catalogue: testCase.base },
		adapted.finish.overrides,
		[{ id: 'slot-walnut', name: 'Walnut', color: '#5a3a22' }],
		sceneImageIndex()
	);
	if (resolved.inputs === null) throw new Error('the catalogue base did not resolve');
	return { adapted, resolved };
}

function pureSlotUris(inputs: NonNullable<ReturnType<typeof pureResolution>['resolved']['inputs']>) {
	const uris: Partial<Record<MaterialTextureSlot, string>> = {};
	for (const role of ['color', 'normal', 'roughness', 'occlusion', 'metalness'] as const) {
		const binding = inputs.maps[role];
		if (binding === undefined || binding.image === null) continue;
		const uri = textureUri(binding.image.source);
		if (uri !== undefined) uris[SLOT_OF_ROLE[role]] = uri;
	}
	return uris;
}

describe('Scene 11 → v1 compatibility', () => {
	it.each(CASES)('$name resolves to the same effective readings', (testCase) => {
		const current = resolveSceneMaterial(lookSource(testCase), targetFor(testCase));
		const { resolved } = pureResolution(testCase);
		const inputs = resolved.inputs!;
		expect(resolved.issues).toEqual([]);

		expect(inputs.color).toBe(current.color);
		expect(inputs.roughness).toBe(current.roughness);
		expect(inputs.metalness).toBe(current.metalness);
		expect(inputs.mapping.kind).toBe('target');
		if (inputs.mapping.kind !== 'target') return;
		expect(inputs.mapping.metric.tileMeters).toEqual(current.defaultTileSizeMeters);
		expect(inputs.mapping.metric.rotation).toBe(current.rotation);
		expect(inputs.mapping.metric.offset).toEqual(current.offset);
		expect(pureSlotUris(inputs)).toEqual(current.slotUris);

		const currentNormal =
			inputs.maps.normal === undefined
				? null
				: [
						inputs.normalScale,
						inputs.maps.normal.convention === '-Y' ? -inputs.normalScale : inputs.normalScale
					];
		expect(currentNormal).toEqual(current.normalScale);
	});

	it.each(CASES)('$name uses the one metric repeat formula', (testCase) => {
		const current = resolveSceneMaterial(lookSource(testCase), targetFor(testCase));
		const { resolved } = pureResolution(testCase);
		const look = sceneLookFor(lookSource(testCase), targetFor(testCase), testCase.surface);
		const expected = computeTextureRepeat(testCase.surface, current.defaultTileSizeMeters);
		if (Object.keys(current.slotUris).length === 0) {
			// An untextured look carries no variant, so there is no repeat to read;
			// the mapping is still resolved for a later map binding.
			expect(look.textures).toBeNull();
		} else {
			expect(look.textures?.repeat).toEqual(expected);
		}
		expect(
			resolved.inputs?.mapping.kind === 'target'
				? [
						Math.max(0.01, testCase.surface[0] / Math.max(0.01, resolved.inputs.mapping.metric.tileMeters[0])),
						Math.max(0.01, testCase.surface[1] / Math.max(0.01, resolved.inputs.mapping.metric.tileMeters[1]))
					]
				: null
		).toEqual(expected);
	});

	it('keeps a shared S4 Finish identical on a Form, a Wall and a rotated model remap', () => {
		const testCase = CASES.find((entry) => entry.name === 'rotated-non-square-mapping')!;
		const document = lookSource(testCase);
		const target = targetFor(testCase);
		const readings = [
			resolveSceneMaterial(document, target),
			resolveSceneMaterial(document, target),
			resolveSceneMaterial(document, target)
		];
		expect(readings[1]).toEqual(readings[0]);
		expect(readings[2]).toEqual(readings[0]);
		// One instance, one effective look: shared identity is what lets the
		// renderer lease one material for every user instead of one per surface.
		expect(readings[0].catalogue).toBe('wood-walnut');
		expect(readings[0].defaultTileSizeMeters).toEqual([0.8, 1.6]);
		expect(readings[0].rotation).toBe(0.42);
	});

	it('adapts an instance-only binding without needing a catalogue base', () => {
		const adapted = sceneFinishToContract({
			id: 'finish-custom',
			name: 'Custom',
			baseMaterialId: 'plaster-warm',
			maps: { color: 'tex-color' }
		});
		expect(adapted.success).toBe(true);
		if (!adapted.success) return;
		expect(adapted.finish.overrides).toEqual({
			maps: { color: { image: { textureId: 'tex-color' } } }
		});

		const resolved = resolveFinish(
			{ catalogue: 'plaster-warm' },
			adapted.finish.overrides,
			undefined,
			sceneImageIndex()
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.maps.color?.image?.source).toEqual({ textureId: 'tex-color' });
		// The base's own roughness map survives a colour-only override.
		expect(resolved.inputs?.maps.roughness?.image?.source).toEqual({
			shipped: '/textures/plaster-warm/roughness.png'
		});
	});

	it('keeps an authored zero factor through the adapter', () => {
		const adapted = sceneFinishToContract({
			id: 'finish-zero',
			name: 'Zero',
			baseMaterialId: 'wood-walnut',
			roughness: 0,
			metalness: 0
		});
		expect(adapted.success).toBe(true);
		if (!adapted.success) return;
		const resolved = resolveFinish(
			{ catalogue: 'wood-walnut' },
			adapted.finish.overrides,
			undefined,
			sceneImageIndex()
		);
		expect(resolved.inputs?.roughness).toBe(0);
		expect(resolved.inputs?.metalness).toBe(0);
		expect(resolved.inputs?.provenance.roughness).toEqual({ source: 'override' });
	});

	it('adapts the legacy normal flip as exactly one Y-sign convention', () => {
		const adapted = sceneFinishToContract({
			id: 'finish-normal',
			name: 'Normal',
			baseMaterialId: 'plaster-warm',
			maps: { normal: 'tex-normal' },
			normalScale: -0.6,
			normalFlipY: true
		});
		expect(adapted.success).toBe(true);
		if (!adapted.success) return;
		const overrides = adapted.finish.overrides as FinishOverrides;
		expect(overrides.normalScale).toBe(0.6);
		expect(overrides.maps?.normal).toEqual({
			image: { textureId: 'tex-normal' },
			convention: '-Y'
		});
		const resolved = resolveFinish(
			{ catalogue: 'plaster-warm' },
			overrides,
			undefined,
			sceneImageIndex()
		);
		expect(resolved.inputs?.maps.normal?.convention).toBe('-Y');
		expect(resolved.inputs?.normalScale).toBe(0.6);
	});

	it('does not let an unreferenced normal control change anything', () => {
		const adapted = sceneFinishToContract({
			id: 'finish-normal-only',
			name: 'Normal only',
			baseMaterialId: 'velvet-dark',
			normalScale: 0.4,
			normalFlipY: true
		});
		expect(adapted.success).toBe(true);
		if (!adapted.success) return;
		expect(adapted.finish.overrides).toBeUndefined();
	});

	it('still refuses an unknown catalogue base at the contract boundary', () => {
		const adapted = sceneFinishToContract({
			id: 'finish-unknown',
			name: 'Unknown',
			baseMaterialId: 'not-a-catalogue-base'
		});
		expect(adapted.success).toBe(true);
		if (!adapted.success) return;
		const resolved = resolveFinish(
			{ catalogue: 'not-a-catalogue-base' },
			adapted.finish.overrides,
			undefined,
			sceneImageIndex()
		);
		expect(resolved.inputs).toBeNull();
		expect(resolved.issues).toEqual([
			{
				code: 'unknown-catalogue-base',
				path: '$.base.catalogue',
				action: 'Use an admitted catalogue base.'
			}
		]);
	});
});
