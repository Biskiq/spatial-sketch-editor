/**
 * The render adapter and the pure resolver must read one Scene 12 Finish the
 * same way. The adapter now consumes `Finish` directly; this suite proves the
 * shipped `resolveSceneMaterial` projection still agrees with `resolveFinish`
 * for catalogue bases, palette followers, a rotated non-square mapping, normal
 * conventions and every scalar role.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	createImageIndex,
	mergeImageIndexes,
	resolveFinish,
	shippedImageIndex,
	type Finish,
	type FinishOverrides,
	type LocalImage,
	type MaterialRuntimeIndex
} from '@portfolio/project-model/materials';
import { computeTextureRepeat } from '$lib/content/materials';
import {
	resolveSceneMaterial,
	sceneLookFor,
	type LookSource,
	type ResolveTarget
} from '$lib/render/materials/scene-instance-material';
import type { MaterialTextureSlot } from '$lib/types/materials';
import type { SceneColor, SceneTextureAsset } from '$lib/content/scene';
import { contentHash } from './fixtures';

const TEXTURES: SceneTextureAsset[] = [
	{ id: 'tex-color', name: 'Colour', uri: '/project-assets/tex-color' },
	{ id: 'tex-normal', name: 'Normal', uri: '/project-assets/tex-normal' },
	{ id: 'tex-roughness', name: 'Roughness', uri: '/project-assets/tex-roughness' },
	{ id: 'tex-occlusion', name: 'Occlusion', uri: '/project-assets/tex-occlusion' },
	{ id: 'tex-metalness', name: 'Metalness', uri: '/project-assets/tex-metalness' }
];

const TEXTURE_HASH: Readonly<Record<string, string>> = Object.fromEntries(
	TEXTURES.map((texture) => [texture.id, contentHash(`scene-${texture.id}`)])
);

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
	readonly base: { readonly catalogue: string };
	readonly overrides?: FinishOverrides;
	readonly surface: [number, number];
};

const CASES: readonly Case[] = [
	...(
		['plaster-warm', 'wood-walnut', 'brass-aged', 'marble-light', 'velvet-dark', 'paper-aged'] as const
	).map((base): Case => ({ name: `catalogue:${base}`, base: { catalogue: base }, surface: [3.5, 1.25] })),
	{
		name: 's4-single-image:marble',
		base: { catalogue: 'marble-light' },
		overrides: { maps: { color: { image: { textureId: 'tex-color' } } } },
		surface: [2.4, 1.1]
	},
	{
		name: 'palette-follower',
		base: { catalogue: 'marble-light' },
		overrides: { color: { slot: 'slot-walnut' } },
		surface: [2, 2]
	},
	{
		name: 'rotated-non-square-mapping',
		base: { catalogue: 'wood-walnut' },
		overrides: {
			mapping: { kind: 'target', metric: { tileMeters: [0.8, 1.6], rotation: 0.42, offset: [0.25, 0.5] } }
		},
		surface: [3.2, 1.6]
	},
	{
		name: 'normal-minus-y',
		base: { catalogue: 'plaster-warm' },
		overrides: {
			maps: { normal: { image: { textureId: 'tex-normal' }, convention: '-Y' } },
			normalScale: 0.6
		},
		surface: [2, 2]
	},
	{
		name: 'all-scalar-roles',
		base: { catalogue: 'wood-walnut' },
		overrides: {
			roughness: 0,
			metalness: 1,
			maps: {
				roughness: { image: { textureId: 'tex-roughness' }, component: 'r', invert: false },
				occlusion: { image: { textureId: 'tex-occlusion' }, component: 'r', invert: false },
				metalness: { image: { textureId: 'tex-metalness' }, component: 'r', invert: false }
			}
		},
		surface: [1.5, 3]
	}
];

function finishFor(testCase: Case): Finish | undefined {
	if (testCase.overrides === undefined) return undefined;
	return {
		id: `instance:${testCase.name}`,
		name: testCase.name,
		base: testCase.base,
		overrides: testCase.overrides
	};
}

function materialIndex(): MaterialRuntimeIndex {
	return {
		definitions: new Map(),
		definitionImages: new Map(),
		images: TEXTURES.map((texture) => ({
			hash: TEXTURE_HASH[texture.id]!,
			source: { textureId: texture.id }
		}))
	};
}

function lookSource(testCase: Case): LookSource {
	const finish = finishFor(testCase);
	return {
		textures: TEXTURES,
		materials: finish === undefined ? [] : [finish],
		palette: [{ id: 'slot-walnut', name: 'Walnut', color: '#5a3a22' }],
		materialIndex: materialIndex()
	};
}

function targetFor(testCase: Case): ResolveTarget {
	const finish = finishFor(testCase);
	return {
		materialInstanceId: finish?.id ?? null,
		fallbackCatalogueId: testCase.base.catalogue as never
	};
}

function pureResolution(testCase: Case) {
	const finish = finishFor(testCase);
	const resolved = resolveFinish(
		(finish?.base ?? testCase.base) as { catalogue: string },
		finish?.overrides,
		[{ id: 'slot-walnut', name: 'Walnut', color: '#5a3a22' }],
		sceneImageIndex()
	);
	if (resolved.inputs === null) throw new Error('the base did not resolve');
	return resolved;
}

function pureSlotUris(inputs: NonNullable<ReturnType<typeof pureResolution>['inputs']>) {
	const uris: Partial<Record<MaterialTextureSlot, string>> = {};
	for (const role of ['color', 'normal', 'roughness', 'occlusion', 'metalness'] as const) {
		const binding = inputs.maps[role];
		if (binding === undefined || binding.image === null) continue;
		const uri = textureUri(binding.image.source);
		if (uri !== undefined) uris[SLOT_OF_ROLE[role]] = uri;
	}
	return uris;
}

describe('Scene 12 Finish → render projection', () => {
	it.each(CASES)('$name resolves to the same effective readings', (testCase) => {
		const current = resolveSceneMaterial(lookSource(testCase), targetFor(testCase));
		const resolved = pureResolution(testCase);
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
		const resolved = pureResolution(testCase);
		const look = sceneLookFor(lookSource(testCase), targetFor(testCase), testCase.surface);
		const expected = computeTextureRepeat(testCase.surface, current.defaultTileSizeMeters);
		if (Object.keys(current.slotUris).length === 0) {
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

	it('keeps a shared Finish identical on a Form, a Wall and a rotated model remap', () => {
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
		expect(readings[0].catalogue).toBe('wood-walnut');
		expect(readings[0].defaultTileSizeMeters).toEqual([0.8, 1.6]);
		expect(readings[0].rotation).toBe(0.42);
	});

	it('keeps the base roughness map when only colour is overridden', () => {
		const resolved = resolveFinish(
			{ catalogue: 'plaster-warm' },
			{ maps: { color: { image: { textureId: 'tex-color' } } } },
			undefined,
			sceneImageIndex()
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.maps.color?.image?.source).toEqual({ textureId: 'tex-color' });
		expect(resolved.inputs?.maps.roughness?.image?.source).toEqual({
			shipped: '/textures/plaster-warm/roughness.png'
		});
	});

	it.each([
		['the only image', { color: { image: { textureId: 'tex-lost' } } }],
		[
			'one of two images',
			{ color: { image: { textureId: 'tex-lost' } }, occlusion: { image: { textureId: 'tex-occlusion' }, component: 'r', invert: false } }
		]
	] as const)('keeps disabled maps disabled when %s is lost', (_, maps) => {
		vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
		const testCase: Case = {
			name: 'lost-beside-disabled',
			base: { catalogue: 'plaster-warm' },
			overrides: { maps: { ...maps, normal: null, roughness: null } },
			surface: [2, 2]
		};
		const { slotUris } = resolveSceneMaterial(lookSource(testCase), targetFor(testCase));
		expect(slotUris.map).toBeDefined();
		expect(slotUris.normalMap).toBeUndefined();
		expect(slotUris.roughnessMap).toBeUndefined();
	});

	it('keeps an authored zero factor', () => {
		const resolved = resolveFinish(
			{ catalogue: 'wood-walnut' },
			{ roughness: 0, metalness: 0 },
			undefined,
			sceneImageIndex()
		);
		expect(resolved.inputs?.roughness).toBe(0);
		expect(resolved.inputs?.metalness).toBe(0);
		expect(resolved.inputs?.provenance.roughness).toEqual({ source: 'override' });
	});

	it('reads a normal convention and authored scale directly', () => {
		const overrides: FinishOverrides = {
			maps: { normal: { image: { textureId: 'tex-normal' }, convention: '-Y' } },
			normalScale: 0.6
		};
		const resolved = resolveFinish({ catalogue: 'plaster-warm' }, overrides, undefined, sceneImageIndex());
		expect(resolved.inputs?.maps.normal?.convention).toBe('-Y');
		expect(resolved.inputs?.normalScale).toBe(0.6);
	});

	it('still refuses an unknown catalogue base at the contract boundary', () => {
		const resolved = resolveFinish(
			{ catalogue: 'not-a-catalogue-base' },
			undefined,
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
