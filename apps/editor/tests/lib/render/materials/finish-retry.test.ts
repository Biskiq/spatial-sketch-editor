/**
 * A creator's Retry reaches every consumer of a failed image: Layout surfaces
 * and models as well as Scene items.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { g1DocumentWithRooms, g1RoomPolygon } from '../../layout/__fixtures__/layout-g1-fixtures';
import { createWallRepresentation } from '$lib/render/layout-wall-representation';
import { createRoomRepresentation } from '$lib/render/layout-room-representation';
import { createRegionRepresentation } from '$lib/render/layout-region-representation';
import { createSceneEntityRepresentation } from '$lib/render/scene-entity-representation';
import { createModelTemplateLoader, sceneModelSupport } from '$lib/render/models/scene-model-support';
import { describeSceneModel } from '$lib/render/scene-render-description';
import { createMaterialStore, type MaterialStore } from '$lib/render/resources/material-store';
import { createGeometryStore } from '$lib/render/resources/geometry-store';
import { createCasterChannel } from '$lib/render/resources/caster-channel';
import type { StandardFinishPlan } from '$lib/render/resources/material-descriptor';
import type { SceneSurfaceLook, SceneSurfaceLookResolver } from '$lib/render/layout/surface-look';
import {
	finishViewStats,
	invalidateFinishViewsForSource,
	resetFinishViewsForTests
} from '$lib/render/resources/finish-views';
import {
	flushDeferredTextureReleases,
	invalidateTextureSource,
	resetTextureCachesForTests,
	type TextureLoadScope
} from '$lib/render/resources/texture-store';

const URI = '/retry.png';
const plan: StandardFinishPlan = {
	profile: 'pbr-metallic-roughness/v1',
	entries: [{ role: 'color', view: 'colour', uvSet: 0, origin: 'legacy', repeat: [1, 1], rotation: 0, offset: [0, 0] }],
	occlusionStrength: 1,
	normalScale: 1
};
const COLOR = '#c4b4a0';
const views = [{ view: 'colour', uri: URI, role: 'color' as const }];

function lookOf(path: 'sampled' | 'mapped'): SceneSurfaceLook {
	return {
		material: {
			kind: 'standard',
			color: COLOR,
			roughness: 0.6,
			metalness: 0,
			...(path === 'sampled' ? { finish: plan } : {})
		},
		textures: {
			variantSeed: 'retry',
			slotUris: path === 'sampled' ? {} : { map: URI },
			repeat: [1, 1],
			rotation: 0,
			offset: [0, 0],
			...(path === 'sampled' ? { views } : {})
		}
	};
}

function geometry() {
	const document = g1DocumentWithRooms([g1RoomPolygon('room', [[0, 0], [8, 0], [8, 6], [0, 6]])]);
	document.regions.push({
		id: 'terrace',
		role: 'floor',
		footprint: { kind: 'polygon', points: [[1, 1], [7, 1], [7, 5], [1, 5]] },
		elevation: 0.2,
		thickness: 0.2,
		form: { kind: 'flat' },
		intendedGaps: []
	});
	return compileWallFirstLayoutGeometry(document).geometry;
}

const settle = async () => {
	for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** An image that fails until `recover`, as a blocked request does. */
function failingImage() {
	let failing = true;
	let loads = 0;
	const scope: TextureLoadScope = {
		scopeId: 'project:retry-reach',
		loader: async () => {
			loads += 1;
			if (failing) throw new Error('blocked');
			const texture = new Texture();
			(texture as unknown as { image: object }).image = { width: 8, height: 8 };
			return texture;
		}
	};
	const recover = () => {
		failing = false;
		invalidateFinishViewsForSource(scope.scopeId, URI);
		invalidateTextureSource(scope.scopeId, URI);
	};
	return { scope, recover, loads: () => loads };
}

afterEach(() => {
	flushDeferredTextureReleases();
	resetTextureCachesForTests();
	resetFinishViewsForTests();
	vi.restoreAllMocks();
});

type Build = (
	store: MaterialStore,
	scope: TextureLoadScope,
	changed: () => void,
	resolve: SceneSurfaceLookResolver
) => { reloadTextures(): void; dispose(): void };

const LAYOUT: readonly [string, Build][] = [
	['Walls', (store, scope, changed, resolve) => {
		const walls = createWallRepresentation(store, undefined, {}, scope, changed, resolve);
		walls.update(geometry());
		return walls;
	}],
	['cut Walls', (store, scope, changed, resolve) => {
		const walls = createWallRepresentation(store, undefined, {}, scope, changed, resolve);
		const compiled = geometry();
		walls.setCutaway(new Set(compiled.walls.map((wall) => wall.wallId)));
		walls.update(compiled);
		return walls;
	}],
	['Rooms', (store, scope, changed, resolve) => {
		const rooms = createRoomRepresentation(store, undefined, {}, scope, changed, resolve);
		rooms.update(geometry());
		return rooms;
	}],
	['Regions', (store, scope, changed, resolve) => {
		const regions = createRegionRepresentation(store, scope, changed, resolve);
		regions.update(geometry());
		return regions;
	}]
];

describe.each(['sampled', 'mapped'] as const)('Retry of a failed %s image', (path) => {
	it.each(LAYOUT)('reaches %s, and leaves them alone once loaded', async (_name, build) => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { scope, recover, loads } = failingImage();
		const store = createMaterialStore();
		const changed = vi.fn();
		const look = lookOf(path);
		const surfaces = build(store, scope, changed, () => look);
		await settle();
		expect(loads()).toBe(1);
		const { created } = store.stats();
		changed.mockClear();

		recover();
		surfaces.reloadTextures();
		await settle();
		expect(loads()).toBe(2);
		expect(changed).toHaveBeenCalled();
		expect(store.stats().created).toBeGreaterThan(created);
		if (path === 'sampled') expect(finishViewStats().live).toBe(1);

		changed.mockClear();
		recover();
		surfaces.reloadTextures();
		await settle();
		expect(loads()).toBe(2);
		expect(changed).not.toHaveBeenCalled();
		surfaces.dispose();
		store.dispose();
	});

	it('reaches models through the Scene entities', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { scope, recover, loads } = failingImage();
		const store = createMaterialStore();
		const template = new Group();
		template.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
		const drawn = vi.fn();
		const entities = createSceneEntityRepresentation({
			store,
			geometry: createGeometryStore(),
			casters: createCasterChannel(),
			scope: () => scope,
			modelUrls: () => new Map([['paris-salon-chair', 'https://models.test/retry.glb']]),
			modelSupport: () => ({
				...sceneModelSupport,
				createLoader: () => createModelTemplateLoader(async () => ({ template, animationNames: [] }))
			}),
			onModelDrawn: drawn
		});
		const { material, textures } = lookOf(path);
		entities.update({
			items: [],
			artworks: [],
			models: [describeSceneModel({
				id: 'chair',
				assetId: 'paris-salon-chair',
				position: [0, 0, 0],
				rotation: [0, 0, 0],
				scale: 1,
				look: {
					color: COLOR,
					roughness: material.roughness,
					metalness: material.metalness,
					variantSeed: textures!.variantSeed,
					slotUris: textures!.slotUris,
					...(path === 'sampled' ? { finish: plan, views } : {})
				}
			})]
		});
		await settle();
		expect(loads()).toBe(1);
		drawn.mockClear();

		recover();
		entities.reloadTextures();
		await settle();
		expect(loads()).toBe(2);
		expect(drawn).toHaveBeenCalledTimes(1);

		recover();
		entities.reloadTextures();
		await settle();
		expect(loads()).toBe(2);
		expect(drawn).toHaveBeenCalledTimes(1);
		entities.dispose();
		store.dispose();
	});
});

it.each(LAYOUT)('keeps one lease when %s are retried while their image loads', async (_name, build) => {
	let deliver!: (texture: Texture) => void;
	const loader = vi.fn(() => new Promise<Texture>((resolve) => (deliver = resolve)));
	const store = createMaterialStore();
	const look = lookOf('sampled');
	const surfaces = build(store, { scopeId: 'project:retry-pending', loader }, () => {}, () => look);
	await settle();
	surfaces.reloadTextures();
	await settle();
	expect(loader).toHaveBeenCalledTimes(1);
	deliver(new Texture());
	await settle();
	expect(finishViewStats().live).toBe(1);
	surfaces.dispose();
	expect(finishViewStats().live).toBe(0);
	store.dispose();
});
