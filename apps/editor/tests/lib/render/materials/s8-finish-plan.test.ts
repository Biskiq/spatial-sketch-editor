import { describe, expect, it } from 'vitest';
import {
	bindFinish,
	finishSamplingPlan,
	resolveFinish,
	type FinishOverrides
} from '@portfolio/project-model/materials';
import {
	lookSource
} from './__helpers__/s8-look-source';
import { sceneFinishFor } from '$lib/render/materials/scene-finish';
import { buildRegionMeshGeometry } from '$lib/render/layout/region-mesh-builder';
import {
	compileWallFirstLayoutGeometryFresh,
	createEmptyWallFirstLayoutDocument,
	type LayoutRegion
} from '@portfolio/layout-core';
import {
	TWO_UV_FACTS,
	contentHash,
	fixtureImageIndex,
	fullRecipe
} from '../../project-model/materials/fixtures';

const SWATCH = '/s8-fixtures/checker-asymmetric.png';
const SWATCH_HASH = contentHash('swatch');
const SWATCH_INDEX = {
	definitions: new Map(),
	definitionImages: new Map(),
	images: [{ hash: SWATCH_HASH, source: { textureId: 'swatch' as const } }]
};

describe('sceneFinishFor', () => {
	it('resolves a resource-backed Finish through its definition images, not a same-hash texture', () => {
		const definitionHash = contentHash('definition');
		const document = lookSource({
			textures: [
				{ id: 'swatch', name: 'Swatch', uri: SWATCH },
				{ id: 'wrong', name: 'Unrelated', uri: '/s8-fixtures/wrong.png' }
			],
			materialIndex: {
				definitions: new Map([[definitionHash, { ...fullRecipe(), maps: { color: { image: SWATCH_HASH } } }]]),
				definitionImages: new Map([[definitionHash, [{ hash: SWATCH_HASH, source: { textureId: 'swatch' } }]]]),
				images: [{ hash: SWATCH_HASH, source: { textureId: 'wrong' } }]
			},
			materials: [{ id: 'finish', name: 'Finish', base: { material: definitionHash } }]
		});
		const look = sceneFinishFor(
			document,
			{ materialInstanceId: 'finish', fallbackCatalogueId: 'wood-walnut' },
			{ kind: 'metric', uvMeters: [1, 1], surfaceMeters: [1, 1] }
		);
		expect(look.textures?.slotUris.map).toBe(SWATCH);
		expect(look.material.finish?.entries[0]?.view).toBe('texture:swatch|srgb');
	});

	it('builds the frozen legacy plan for a metric Form with a legacy-UV0 override', () => {
		const document = lookSource({
			textures: [{ id: 'swatch', name: 'Swatch', uri: SWATCH }],
			materialIndex: SWATCH_INDEX,
			materials: [
				{ id: 'wood', name: 'Wood', base: { catalogue: 'wood-walnut' }, overrides: { maps: { color: { image: { textureId: 'swatch' } } }, mapping: { kind: 'target', metric: { tileMeters: [0.8, 1.6], rotation: 0.42, offset: [0.25, 0.5] } } } }
			]
		});
		const look = sceneFinishFor(
			document,
			{ materialInstanceId: 'wood', fallbackCatalogueId: 'wood-walnut' },
			{ kind: 'metric', uvMeters: [1, 1], surfaceMeters: [1, 1] }
		);

		expect(look.material.finish?.entries[0]).toMatchObject({
			role: 'color',
			view: 'texture:swatch|srgb',
			uvSet: 0,
			origin: 'legacy',
			repeat: [1.25, 0.625],
			rotation: 0.42,
			offset: [0.25, 0.5]
		});
		expect(look.textures?.views).toContainEqual({
			view: 'texture:swatch|srgb',
			uri: SWATCH,
			role: 'color'
		});
		expect(look.material.finish?.normalScale).toBe(1);
	});

	it('keeps identity UV0 and the authored rows for a legacy model remap', () => {
		const document = lookSource({
			textures: [{ id: 'swatch', name: 'Swatch', uri: SWATCH }],
			materialIndex: SWATCH_INDEX,
			materials: [
				{ id: 'model', name: 'Model', base: { catalogue: 'wood-walnut' }, overrides: { maps: { color: { image: { textureId: 'swatch' } } } } }
			]
		});
		const look = sceneFinishFor(
			document,
			{ materialInstanceId: 'model', fallbackCatalogueId: 'wood-walnut' },
			{ kind: 'legacy' }
		);

		expect(look.material.finish?.entries[0]).toMatchObject({
			uvSet: 0,
			origin: 'legacy',
			repeat: [1, 1],
			rotation: 0,
			offset: [0, 0]
		});
	});

	it('uses the explicit glTF UV1 mapping on a two-UV target', () => {
		const source = fullRecipe();
		const read = resolveFinish(
			{ material: source },
			{
				mapping: { kind: 'uv', set: 1, repeat: [2, 3], rotation: 1.2, offset: [0.1, 0.9] }
			} as FinishOverrides,
			undefined,
			fixtureImageIndex()
		);
		expect(read.inputs).not.toBeNull();
		const bound = bindFinish(read, { subject: TWO_UV_FACTS.subject, facts: TWO_UV_FACTS });
		expect(bound.bound).not.toBeNull();
		const plan = finishSamplingPlan(bound.bound!);
		expect(plan.entries.map((entry) => entry.role)).toEqual([
			'color',
			'normal',
			'roughness',
			'metalness',
			'occlusion'
		]);
		for (const entry of plan.entries) {
			expect(entry.uvSet).toBe(1);
			expect(entry.origin).toBe('gltf');
			expect(entry.repeat).toEqual([2, 3]);
			expect(entry.rotation).toBe(1.2);
			expect(entry.offset).toEqual([0.1, 0.9]);
		}
	});

	it('falls back to the resolved constants under a Treatment', () => {
		const document = lookSource({
			textures: [{ id: 'swatch', name: 'Swatch', uri: SWATCH }],
			materials: [
				{ id: 'wood', name: 'Wood', base: { catalogue: 'wood-walnut' }, overrides: { maps: { color: { image: { textureId: 'swatch' } } } } }
			],
			environment: { treatment: 'flat-colour' }
		});
		const look = sceneFinishFor(
			document,
			{ materialInstanceId: 'wood', fallbackCatalogueId: 'wood-walnut' },
			{ kind: 'metric', uvMeters: [1, 1], surfaceMeters: [1, 1] }
		);
		expect(look.material.finish).toBeUndefined();
		expect(look.textures).toBeNull();
		expect(look.material.roughness).toBeGreaterThanOrEqual(0.6);
	});
});

describe('Region UVs', () => {
	it('charts top and underside in metres and edges at the origin', () => {
		const region: LayoutRegion = {
			id: 's8-floor',
			role: 'floor',
			elevation: 0,
			thickness: 0.2,
			footprint: {
				kind: 'polygon',
				points: [
					[1, -3],
					[3, -3],
					[3, -1],
					[1, -1]
				]
			},
			form: { kind: 'flat' },
			intendedGaps: []
		};
		const document = { ...createEmptyWallFirstLayoutDocument(), regions: [region] };
		const compiled = compileWallFirstLayoutGeometryFresh(document);
		expect(compiled.issues).toEqual([]);
		const buffer = buildRegionMeshGeometry(compiled.geometry.regions[0]!);
		const uv = buffer.getAttribute('uv');
		expect(uv).toBeDefined();
		const surfaces = buffer.userData.regionSurfaces as readonly string[];
		for (let vertex = 0; vertex < uv.count; vertex += 1) {
			const surface = surfaces[Math.floor(vertex / 3)];
			const u = uv.getX(vertex);
			const v = uv.getY(vertex);
			if (surface === 'edge') {
				expect([u, v]).toEqual([0, 0]);
				continue;
			}
			expect(Number.isFinite(u)).toBe(true);
			expect(Number.isFinite(v)).toBe(true);
			// The top chart's v is the negated compiled z; the underside keeps z.
			const position = buffer.getAttribute('position');
			const z = position.getZ(vertex);
			expect(u).toBe(position.getX(vertex));
			expect(v).toBe(surface === 'top' ? -z : z);
		}
		buffer.dispose();
	});
});
