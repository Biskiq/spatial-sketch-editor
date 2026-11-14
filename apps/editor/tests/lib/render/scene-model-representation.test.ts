/**
 * E8/R5 + R2c + G4 — the retained Scene model handler.
 *
 * The handler replaced the per-entity `AssetModel.svelte` host and its
 * `AssetFallback.svelte` tree. These tests drive it with the real stores, the real
 * realization and inspection, and a fake template fetch whose deliveries the test
 * controls, so every async order is the test's to choose. They pin:
 *
 * - structural parity with the retired path (a baseline recorded from it);
 * - load, failure, missing bytes, replacement, many instances and skinned models;
 * - pick roots, the caster channel, stale-arrival and texture-race rejection;
 * - teardown leaving zero leases, and zero work on unchanged input.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	Bone,
	BoxGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshStandardMaterial,
	Skeleton,
	SkinnedMesh,
	Texture,
	Uint16BufferAttribute,
	type Material,
	type Object3D
} from 'three';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { createGeometryStore } from '$lib/render/resources/geometry-store';
import { createCasterChannel, type CasterEvent } from '$lib/render/resources/caster-channel';
import {
	createSceneModelRepresentation,
	type ModelTemplate,
	type SceneModelContext,
	type SceneModelSupport
} from '$lib/render/scene-model-representation';
import { createModelTemplateLoader, sceneModelSupport } from '$lib/render/models/scene-model-support';
import { describeSceneModel, type SceneModelInput } from '$lib/render/scene-render-description';
import type { SceneModelItem, SceneModelLook } from '$lib/render/resources/scene-render-item';
import {
	__resetDefaultSourceLoaderForTests,
	flushDeferredTextureReleases,
	resetTextureCachesForTests,
	setDefaultTextureSourceLoader,
	type TextureLoadScope
} from '$lib/render/resources/texture-store';
import { summarizeMeshes, type MeshSummary } from './fixtures/model-path-summary';

// ---- a controllable template fetch ---------------------------------------------

type Delivery = { resolve(value: ModelTemplate): void; reject(error: Error): void };

function fakeFetch() {
	const waiting = new Map<string, Delivery[]>();
	const requests: string[] = [];
	const fetch = (url: string): Promise<ModelTemplate> => {
		requests.push(url);
		return new Promise((resolve, reject) => {
			const list = waiting.get(url) ?? [];
			list.push({ resolve, reject });
			waiting.set(url, list);
		});
	};
	return {
		fetch,
		requests,
		deliver(url: string, template: Object3D, animationNames: string[] = []): void {
			for (const pending of waiting.get(url) ?? []) pending.resolve({ template, animationNames });
			waiting.delete(url);
		},
		fail(url: string, message = 'GLB unavailable'): void {
			for (const pending of waiting.get(url) ?? []) pending.reject(new Error(message));
			waiting.delete(url);
		}
	};
}

function supportWith(fetch: (url: string) => Promise<ModelTemplate>): SceneModelSupport {
	return { ...sceneModelSupport, createLoader: () => createModelTemplateLoader(fetch) };
}

// ---- texture requests the test finishes ----------------------------------------

const pendingTextures = new Map<string, (texture: Texture) => void>();
function requestTexture(uri: string): Promise<Texture> {
	return new Promise((resolve) => pendingTextures.set(uri, resolve));
}
function finishTexture(uri: string): void {
	const resolveTexture = pendingTextures.get(uri);
	if (resolveTexture === undefined) throw new Error(`no pending texture for ${uri}`);
	pendingTextures.delete(uri);
	resolveTexture(new Texture());
}
function look(name: string, color: string, uri: string): SceneModelLook {
	return { color: `#${color}`, roughness: 0.8, metalness: 0, variantSeed: `seed-${name}`, slotUris: { map: uri } };
}
function scopeFor(name: string): TextureLoadScope {
	return { scopeId: `scene-model-${name}`, loader: requestTexture };
}

// ---- fixtures -------------------------------------------------------------------

/** A two-mesh GLB: the template every consumer of one URL clones. */
function twoMesh(name: string): Group {
	const scene = new Group();
	scene.name = name;
	for (let index = 0; index < 2; index += 1) {
		const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x808080 }));
		mesh.position.set(index, 0, 0);
		scene.add(mesh);
	}
	return scene;
}

/** The nested, array-material template the baseline was recorded with. */
function baselineTemplate(): Group {
	const scene = new Group();
	scene.position.set(0.2, 0, 0.1);
	const a = new Mesh(new BoxGeometry(1, 2, 3), new MeshStandardMaterial({ color: 0x808080 }));
	a.position.set(1, 0, 0);
	a.rotation.set(0, 0.3, 0);
	const nested = new Group();
	nested.position.set(0, 1, 0);
	nested.scale.set(2, 2, 2);
	const b = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), [
		new MeshStandardMaterial({ color: 0xff0000 }),
		new MeshStandardMaterial({ color: 0x00ff00 })
	]);
	b.geometry.addGroup(0, 18, 0);
	b.geometry.addGroup(18, 18, 1);
	nested.add(b);
	scene.add(a, nested);
	return scene;
}

/** A skinned template: one skinned mesh bound to a two-bone skeleton. */
function skinned(): Group {
	const scene = new Group();
	const geometry = new BoxGeometry(1, 1, 1);
	const count = geometry.getAttribute('position').count;
	geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
	geometry.setAttribute('skinWeight', new Float32BufferAttribute(new Array(count * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
	const root = new Bone();
	const child = new Bone();
	child.position.y = 1;
	root.add(child);
	const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial({ color: 0x808080 }));
	mesh.add(root);
	mesh.bind(new Skeleton([root, child]));
	scene.add(mesh);
	return scene;
}

const PLACE = { position: [1, 0.5, -2] as const, rotation: [0.1, 0.7, -0.2] as const, scale: 1.3 };

function model(id: string, patch: Partial<SceneModelInput> = {}): SceneModelItem {
	return describeSceneModel({
		id,
		assetId: 'paris-salon-chair',
		position: [...PLACE.position],
		rotation: [...PLACE.rotation],
		scale: PLACE.scale,
		look: null,
		...patch
	});
}

const URLS = (entries: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(entries));

async function settle(): Promise<void> {
	for (let i = 0; i < 6; i += 1) await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function harness(overrides: { support?: SceneModelSupport | null } = {}) {
	const store = createMaterialStore();
	const geometry = createGeometryStore();
	const casters = createCasterChannel();
	const events: CasterEvent[] = [];
	casters.subscribe((event) => events.push(event));
	const roots = new Map<string, Object3D>();
	const drawn: string[] = [];
	const fetcher = fakeFetch();
	const support = overrides.support === undefined ? supportWith(fetcher.fetch) : overrides.support;
	const models = createSceneModelRepresentation({
		store,
		geometry,
		casters,
		onRoot: (id, root) => {
			roots.set(id, root);
			return () => roots.delete(id);
		},
		onDrawn: (id) => drawn.push(id)
	});
	const context = (patch: Partial<SceneModelContext> = {}): SceneModelContext => ({
		support,
		urls: null,
		scope: null,
		...patch
	});
	return { store, geometry, casters, events, roots, drawn, fetcher, support, models, context };
}

/** The meshes of a drawn instance: their geometry is the template's. */
function instanceMeshes(root: Object3D, template: Object3D): Mesh[] {
	const geometries = new Set<unknown>();
	template.traverse((node) => {
		if (node instanceof Mesh) geometries.add(node.geometry);
	});
	const found: Mesh[] = [];
	root.traverse((node) => {
		if (node instanceof Mesh && geometries.has(node.geometry)) found.push(node);
	});
	return found;
}

function fallbackOf(root: Object3D): Object3D | undefined {
	let found: Object3D | undefined;
	root.traverse((node) => {
		if (node.name.startsWith('SceneModelFallback:')) found = node;
	});
	return found;
}

function colorsOf(root: Object3D, template: Object3D): string[] {
	return instanceMeshes(root, template).map((mesh) => (mesh.material as MeshStandardMaterial).color.getHexString());
}
function mapsOf(root: Object3D, template: Object3D): (Texture | null)[] {
	return instanceMeshes(root, template).map((mesh) => (mesh.material as MeshStandardMaterial).map);
}

afterEach(() => {
	pendingTextures.clear();
	flushDeferredTextureReleases();
	resetTextureCachesForTests();
	__resetDefaultSourceLoaderForTests();
});

// ---- parity -----------------------------------------------------------------------

const BASELINE = JSON.parse(
	readFileSync(resolve(process.cwd(), 'tests/lib/render/fixtures/model-path-baseline.json'), 'utf8')
) as Record<string, MeshSummary[]> & { modelStore: { live: number; created: number } };

function expectParity(actual: MeshSummary[], expected: MeshSummary[]): void {
	expect(actual).toHaveLength(expected.length);
	actual.forEach((mesh, index) => {
		const old = expected[index]!;
		expect(mesh.vertices).toBe(old.vertices);
		expect(mesh.triangles).toBe(old.triangles);
		expect(mesh.castShadow).toBe(old.castShadow);
		expect(mesh.receiveShadow).toBe(old.receiveShadow);
		expect(mesh.materials).toEqual(old.materials);
		const close = (a: readonly number[], b: readonly number[]) =>
			a.forEach((value, i) => expect(value).toBeCloseTo(b[i]!, 6));
		close(mesh.bounds, old.bounds);
		close(mesh.positionSum, old.positionSum);
		close(mesh.normalSum, old.normalSum);
		close(mesh.uvSum, old.uvSum);
	});
}

const KINDS = ['piano', 'chair', 'sofa', 'table', 'chandelier', 'desk', 'lamp', 'frame', 'book', 'books', 'clock', 'decor', 'rug', 'generic'] as const;
const CATALOGUE = ['paris-grand-piano', 'paris-chandelier', 'paris-salon-rug', 'paris-portrait-frame'] as const;

describe('scene model handler — structural parity with the retired AssetModel/AssetFallback path', () => {
	it('every fallback kind, catalogue fallback and loaded model matches the recorded baseline', async () => {
		const h = harness();
		const items: SceneModelItem[] = [
			...KINDS.map((kind) =>
				model(`fb-${kind}`, {
					assetId: 'creator-x',
					fallback: kind,
					...(kind === 'generic' ? { footprint: { width: 1.7, depth: 0.6 } } : {})
				})
			),
			...CATALOGUE.map((assetId) => model(`cat-${assetId}`, { assetId })),
			model('model')
		];
		const urls = URLS({
			...Object.fromEntries(CATALOGUE.map((id) => [id, 'https://probe.test/never.glb'])),
			'paris-salon-chair': 'https://probe.test/model.glb'
		});
		h.models.update(items, h.context({ urls }));
		for (const kind of KINDS) {
			expectParity(summarizeMeshes(h.models.objectOf(`fb-${kind}`)!), BASELINE[`fb-${kind}`]!);
		}
		for (const assetId of CATALOGUE) {
			expectParity(summarizeMeshes(h.models.objectOf(`cat-${assetId}`)!), BASELINE[`cat-${assetId}`]!);
		}
		h.fetcher.deliver('https://probe.test/model.glb', baselineTemplate());
		await settle();
		expectParity(summarizeMeshes(h.models.objectOf('model')!), BASELINE.model!);
		// Same material identities as the per-part components and the host held.
		expect(h.store.stats()).toMatchObject({ live: BASELINE.modelStore.live, created: BASELINE.modelStore.created });
	});

	it('equal fallback parts share one buffer and one material across instances', () => {
		const h = harness({ support: null });
		h.models.update([model('a', { fallback: 'chair' }), model('b', { fallback: 'chair' })], h.context());
		// Chair: 2 boxes + 4 legs → one unit box; velvet + walnut → two materials.
		expect(h.geometry.stats()).toMatchObject({ live: 1, acquired: 12 });
		expect(h.store.stats()).toMatchObject({ live: 2, acquired: 12 });
	});

	it('keeps the retired host structure: transform-free pick root > placement > presentation', () => {
		const h = harness({ support: null });
		h.models.update([model('a', { assetId: 'paris-grand-piano' })], h.context());
		const root = h.models.objectOf('a')!;
		expect(root.name).toBe('SceneEntity:a');
		expect(root.position.toArray()).toEqual([0, 0, 0]);
		const placement = root.children[0]!;
		expect(placement.position.toArray()).toEqual([...PLACE.position]);
		expect(placement.scale.toArray()).toEqual([PLACE.scale, PLACE.scale, PLACE.scale]);
		const presentation = placement.children[0]!;
		expect(presentation.scale.x).toBe(model('a', { assetId: 'paris-grand-piano' }).presentation.scale);
	});
});

// ---- lifecycle ----------------------------------------------------------------

describe('scene model handler — load, failure and missing bytes', () => {
	it('a successful load retires the fallback, draws the instance on shared geometry and publishes one arrival', async () => {
		const h = harness();
		const url = 'https://models.test/a.glb';
		h.models.update([model('a')], h.context({ urls: URLS({ 'paris-salon-chair': url }) }));
		const root = h.models.objectOf('a')!;
		expect(fallbackOf(root)).toBeDefined();
		expect(h.models.stateOf('a')?.status).toBe('loading');
		const fallbackLeases = h.geometry.stats().live;
		expect(fallbackLeases).toBeGreaterThan(0);

		const template = twoMesh('a');
		h.fetcher.deliver(url, template);
		await settle();
		expect(h.models.stateOf('a')).toMatchObject({ status: 'ready', metrics: { meshCount: 2 } });
		expect(fallbackOf(root)).toBeUndefined();
		expect(h.geometry.stats().live).toBe(0);
		expect(instanceMeshes(root, template)).toHaveLength(2);
		expect(h.events).toEqual([{ kind: 'arrived', entity: expect.stringMatching(/^model-host:\d+$/) }]);
		expect(h.drawn).toEqual(['a']);
		// Original materials are store copies of the template's, never the template's own.
		const templateMaterials = new Set<Material>();
		template.traverse((node) => node instanceof Mesh && templateMaterials.add(node.material as Material));
		for (const mesh of instanceMeshes(root, template)) expect(templateMaterials.has(mesh.material as Material)).toBe(false);
		expect(colorsOf(root, template)).toEqual(['808080', '808080']);
	});

	it('a failed load keeps the fallback, reports the error and publishes nothing; a new URL loads again', async () => {
		const h = harness();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		h.models.update([model('a')], h.context({ urls: URLS({ 'paris-salon-chair': 'https://models.test/bad.glb' }) }));
		h.fetcher.fail('https://models.test/bad.glb', 'HTTP 404');
		await settle();
		expect(h.models.stateOf('a')).toEqual({ status: 'failed', error: 'HTTP 404' });
		expect(fallbackOf(h.models.objectOf('a')!)).toBeDefined();
		expect(h.events).toEqual([]);
		expect(h.models.loaderStats()).toMatchObject({ requested: 1, failed: 1, templates: 0 });

		const template = twoMesh('good');
		h.models.update([model('a')], h.context({ urls: URLS({ 'paris-salon-chair': 'https://models.test/good.glb' }) }));
		h.fetcher.deliver('https://models.test/good.glb', template);
		await settle();
		expect(h.models.stateOf('a')?.status).toBe('ready');
		warn.mockRestore();
	});

	it('a model with no approved bytes draws only its fallback and requests nothing', () => {
		const h = harness();
		// A creator model is absent from the catalogue and has no resolved URL.
		const stats = h.models.update([model('a', { assetId: 'creator-x', footprint: { width: 2, depth: 1 } })], h.context());
		expect(stats).toMatchObject({ built: 1, loads: 0 });
		expect(h.models.stateOf('a')).toEqual({ status: 'fallback' });
		expect(h.models.loaderStats()).toBeNull();
		expect(fallbackOf(h.models.objectOf('a')!)!.children).toHaveLength(1);
	});

	it('before the lazy support arrives the fallback is drawn and the load waits; the arrival starts it', async () => {
		const fetcher = fakeFetch();
		const support = supportWith(fetcher.fetch);
		const h = harness({ support: null });
		const urls = URLS({ 'paris-salon-chair': 'https://models.test/lazy.glb' });
		h.models.update([model('a')], { support: null, urls, scope: null });
		expect(h.models.stateOf('a')?.status).toBe('loading');
		expect(fallbackOf(h.models.objectOf('a')!)).toBeDefined();
		expect(fetcher.requests).toEqual([]);

		const items = [model('a')];
		const stats = h.models.update(items, { support, urls, scope: null });
		expect(stats).toMatchObject({ loads: 1, built: 0 });
		expect(fetcher.requests).toEqual(['https://models.test/lazy.glb']);
		fetcher.deliver('https://models.test/lazy.glb', twoMesh('lazy'));
		await settle();
		expect(h.models.stateOf('a')?.status).toBe('ready');
	});
});

describe('scene model handler — replacement rejects stale arrivals and releases every lease', () => {
	it('a replaced URL releases the instance and its leases; the old bytes arriving late mount nothing', async () => {
		const h = harness();
		const first = 'https://models.test/first.glb';
		const second = 'https://models.test/second.glb';
		h.models.update([model('a')], h.context({ urls: URLS({ 'paris-salon-chair': first }) }));
		const firstTemplate = twoMesh('first');
		h.fetcher.deliver(first, firstTemplate);
		await settle();
		expect(h.store.stats().live).toBe(2);

		const stats = h.models.update([model('a')], h.context({ urls: URLS({ 'paris-salon-chair': second }) }));
		expect(stats).toMatchObject({ replaced: 1, refallbacked: 1, loads: 1 });
		const root = h.models.objectOf('a')!;
		expect(instanceMeshes(root, firstTemplate)).toHaveLength(0);
		expect(fallbackOf(root)).toBeDefined();
		expect(h.events.map((event) => event.kind)).toEqual(['arrived', 'released']);
		// Only the fallback's surfaces are held now: the instance's are back.
		const fallbackMaterials = new Set(
			fallbackOf(root)!.children.map((child) => (child as Mesh).material)
		).size;
		expect(h.store.stats().live).toBe(fallbackMaterials);
		expect(h.models.loaderStats()?.leases).toBe(1);

		// A third URL before the second arrives: the second's arrival is stale.
		const third = 'https://models.test/third.glb';
		h.models.update([model('a')], h.context({ urls: URLS({ 'paris-salon-chair': third }) }));
		h.fetcher.deliver(second, twoMesh('second'));
		await settle();
		expect(h.models.stateOf('a')?.status).toBe('loading');
		expect(fallbackOf(root)).toBeDefined();
		const thirdTemplate = twoMesh('third');
		h.fetcher.deliver(third, thirdTemplate);
		await settle();
		expect(instanceMeshes(root, thirdTemplate)).toHaveLength(2);
		expect(h.events.map((event) => event.kind)).toEqual(['arrived', 'released', 'arrived']);
		expect(h.models.loaderStats()?.leases).toBe(1);
	});

	it('a removed model releases its fallback, instance, template lease and pick root', async () => {
		const h = harness();
		const url = 'https://models.test/gone.glb';
		h.models.update([model('a'), model('b', { assetId: 'creator-x' })], h.context({ urls: URLS({ 'paris-salon-chair': url }) }));
		h.fetcher.deliver(url, twoMesh('gone'));
		await settle();
		expect([...h.roots.keys()].sort()).toEqual(['a', 'b']);

		const stats = h.models.update([], h.context({ urls: URLS({ 'paris-salon-chair': url }) }));
		expect(stats).toMatchObject({ released: 2, items: 0 });
		expect(h.roots.size).toBe(0);
		expect(h.models.object3d.children).toHaveLength(0);
		expect(h.store.stats().live).toBe(0);
		expect(h.geometry.stats().live).toBe(0);
		expect(h.models.loaderStats()?.leases).toBe(0);
		expect(h.events.map((event) => event.kind)).toEqual(['arrived', 'released']);
	});
});

describe('scene model handler — multiple instances and skinned hierarchies', () => {
	it('N instances of one URL make one request and share template geometry and store materials', async () => {
		const h = harness();
		const url = 'https://models.test/many.glb';
		const items = Array.from({ length: 6 }, (_, index) => model(`m${index}`, { position: [index, 0, 0] }));
		h.models.update(items, h.context({ urls: URLS({ 'paris-salon-chair': url }) }));
		const template = twoMesh('many');
		h.fetcher.deliver(url, template);
		await settle();
		expect(h.fetcher.requests).toEqual([url]);
		expect(h.models.loaderStats()).toMatchObject({ requested: 1, templates: 1, leases: 6 });
		const meshes = items.flatMap((item) => instanceMeshes(h.models.objectOf(item.id)!, template));
		expect(meshes).toHaveLength(12);
		expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(2);
		expect(new Set(meshes.map((mesh) => mesh.material)).size).toBe(2);
		expect(h.store.stats().live).toBe(2);
		expect(h.events.filter((event) => event.kind === 'arrived')).toHaveLength(6);
	});

	it('skinned instances get independent skeletons; animation names are reported and nothing plays', async () => {
		const h = harness();
		const url = 'https://models.test/skinned.glb';
		h.models.update([model('a'), model('b')], h.context({ urls: URLS({ 'paris-salon-chair': url }) }));
		const template = skinned();
		h.fetcher.deliver(url, template, ['Idle', 'Wave']);
		await settle();
		const skins = ['a', 'b'].map((id) => {
			let found: SkinnedMesh | undefined;
			h.models.objectOf(id)!.traverse((node) => {
				if ((node as SkinnedMesh).isSkinnedMesh) found = node as SkinnedMesh;
			});
			return found!;
		});
		const templateSkin = template.children[0] as SkinnedMesh;
		expect(skins[0]!.skeleton).not.toBe(skins[1]!.skeleton);
		expect(skins[0]!.skeleton.bones[0]).not.toBe(skins[1]!.skeleton.bones[0]);
		expect(skins[0]!.skeleton.bones[0]).not.toBe(templateSkin.skeleton.bones[0]);
		expect(skins[0]!.geometry).toBe(templateSkin.geometry);
		// Moving one instance's bone never moves the other's.
		skins[0]!.skeleton.bones[1]!.position.y = 5;
		expect(skins[1]!.skeleton.bones[1]!.position.y).toBe(1);
		expect(h.models.stateOf('a')).toMatchObject({ status: 'ready', animationNames: ['Idle', 'Wave'], metrics: { animationNames: ['Idle', 'Wave'] } });
		expect(h.casters.playing()).toBe(0);
		expect(h.events.some((event) => event.kind === 'animating')).toBe(false);
	});
});

describe('scene model handler — selection roots and the caster channel', () => {
	it('registers one pick root per model, the same object objectOf returns, before any model support arrives', () => {
		const h = harness({ support: null });
		h.models.update([model('a'), model('b', { fallback: 'lamp' })], h.context());
		expect(h.roots.get('a')).toBe(h.models.objectOf('a'));
		expect(h.roots.get('b')!.name).toBe('SceneEntity:b');
		let meshes = 0;
		h.roots.get('b')!.traverse((node) => node instanceof Mesh && (meshes += 1));
		expect(meshes).toBe(3);
	});

	it('a moved model moves its group only; a visibility or shadow change of a drawn model is one caster change', async () => {
		const h = harness();
		const url = 'https://models.test/move.glb';
		const context = h.context({ urls: URLS({ 'paris-salon-chair': url }) });
		h.models.update([model('a')], context);
		const template = twoMesh('move');
		h.fetcher.deliver(url, template);
		await settle();
		const root = h.models.objectOf('a')!;
		const instance = instanceMeshes(root, template)[0]!;
		const acquired = h.store.stats().acquired;

		const moved = h.models.update([model('a', { position: [4, 0, 0] })], context);
		expect(moved).toMatchObject({ moved: 1, replaced: 0, restyled: 0, built: 0 });
		expect(root.children[0]!.position.x).toBe(4);
		expect(instanceMeshes(root, template)[0]).toBe(instance);
		expect(h.store.stats().acquired).toBe(acquired);
		expect(h.events.map((event) => event.kind)).toEqual(['arrived']);

		h.models.update([model('a', { position: [4, 0, 0], visible: false })], context);
		expect(root.children[0]!.visible).toBe(false);
		h.models.update([model('a', { position: [4, 0, 0], visible: false, shadows: false })], context);
		expect(instance.castShadow).toBe(false);
		expect(h.events.map((event) => event.kind)).toEqual(['arrived', 'changed', 'changed']);
	});
});

describe('scene model handler — texture races', () => {
	it('a scoped look waits for its textures; a superseded look never mounts or acquires', async () => {
		const h = harness();
		const url = 'https://models.test/race.glb';
		const scope = scopeFor('race');
		const context = h.context({ urls: URLS({ 'paris-salon-chair': url }), scope });
		h.models.update([model('a', { look: look('A', 'ff0000', 'race-a.png') })], context);
		const template = twoMesh('race');
		h.fetcher.deliver(url, template);
		await settle();
		const root = h.models.objectOf('a')!;
		expect(instanceMeshes(root, template)).toHaveLength(0);
		expect(fallbackOf(root)).toBeDefined();

		h.models.update([model('a', { look: look('B', '00ff00', 'race-b.png') })], context);
		await settle();
		finishTexture('race-b.png');
		await settle();
		expect(colorsOf(root, template)).toEqual(['00ff00', '00ff00']);
		expect(mapsOf(root, template).every((map) => map !== null)).toBe(true);

		const acquired = h.store.stats().acquired;
		finishTexture('race-a.png');
		await settle();
		expect(colorsOf(root, template)).toEqual(['00ff00', '00ff00']);
		expect(h.store.stats().acquired).toBe(acquired);
	});

	it('removing a model while its textures are pending mounts nothing when they resolve', async () => {
		const h = harness();
		const url = 'https://models.test/race-3.glb';
		const context = h.context({ urls: URLS({ 'paris-salon-chair': url }), scope: scopeFor('race-3') });
		h.models.update([model('a', { look: look('A', 'ff0000', 'race-3-a.png') })], context);
		h.fetcher.deliver(url, twoMesh('race-3'));
		await settle();
		h.models.update([], context);
		const acquired = h.store.stats().acquired;
		finishTexture('race-3-a.png');
		await settle();
		expect(h.store.stats()).toMatchObject({ live: 0, acquired });
		expect(h.events).toEqual([]);
	});

	describe('unscoped looks', () => {
		beforeEach(() => setDefaultTextureSourceLoader(requestTexture));

		it('mounts at arrival untextured and remaps when its textures resolve; a superseded completion is ignored', async () => {
			const h = harness();
			const url = 'https://models.test/immediate.glb';
			const context = h.context({ urls: URLS({ 'paris-salon-chair': url }) });
			h.models.update([model('a', { look: look('A', 'ff0000', 'imm-a.png') })], context);
			const template = twoMesh('immediate');
			h.fetcher.deliver(url, template);
			await settle();
			const root = h.models.objectOf('a')!;
			expect(colorsOf(root, template)).toEqual(['ff0000', 'ff0000']);
			expect(mapsOf(root, template).every((map) => map === null)).toBe(true);

			h.models.update([model('a', { look: look('B', '00ff00', 'imm-b.png') })], context);
			expect(colorsOf(root, template)).toEqual(['00ff00', '00ff00']);
			finishTexture('imm-a.png');
			await settle();
			expect(mapsOf(root, template).every((map) => map === null)).toBe(true);
			finishTexture('imm-b.png');
			await settle();
			expect(colorsOf(root, template)).toEqual(['00ff00', '00ff00']);
			expect(mapsOf(root, template).every((map) => map !== null)).toBe(true);
		});
	});
});

describe('scene model handler — zero work on unchanged input', () => {
	it('the same items and context do nothing; a new but equal description touches nothing', async () => {
		const h = harness();
		const url = 'https://models.test/still.glb';
		const context = h.context({ urls: URLS({ 'paris-salon-chair': url }) });
		const items = [model('a'), model('b', { fallback: 'desk', assetId: 'creator-x' })];
		h.models.update(items, context);
		h.fetcher.deliver(url, twoMesh('still'));
		await settle();
		const materials = h.store.stats();
		const geometries = h.geometry.stats();
		const loader = h.models.loaderStats();
		const events = h.events.length;

		expect(h.models.update(items, context)).toEqual({
			items: 2, built: 0, kept: 2, moved: 0, replaced: 0, refallbacked: 0, restyled: 0, loads: 0, released: 0
		});
		// A rebuilt description (another entity's edit) with equal keys.
		const again = h.models.update([model('a'), model('b', { fallback: 'desk', assetId: 'creator-x' })], context);
		expect(again).toEqual({
			items: 2, built: 0, kept: 2, moved: 0, replaced: 0, refallbacked: 0, restyled: 0, loads: 0, released: 0
		});
		expect(h.store.stats()).toEqual(materials);
		expect(h.geometry.stats()).toEqual(geometries);
		expect(h.models.loaderStats()).toEqual(loader);
		expect(h.events).toHaveLength(events);
	});
});

describe('scene model handler — teardown', () => {
	it('dispose gives back every lease, unregisters every root and rejects arrivals still in flight', async () => {
		const h = harness();
		const ready = 'https://models.test/ready.glb';
		const late = 'https://models.test/late.glb';
		const template = twoMesh('ready');
		let geometryDisposals = 0;
		template.traverse((node) => {
			if (node instanceof Mesh) node.geometry.addEventListener('dispose', () => (geometryDisposals += 1));
		});
		h.models.update(
			[model('a'), model('b', { assetId: 'paris-grand-piano' })],
			h.context({ urls: URLS({ 'paris-salon-chair': ready, 'paris-grand-piano': late }) })
		);
		h.fetcher.deliver(ready, template);
		await settle();
		expect(geometryDisposals).toBe(0);

		h.models.dispose();
		expect(h.roots.size).toBe(0);
		expect(h.store.stats().live).toBe(0);
		expect(h.geometry.stats().live).toBe(0);
		expect(h.events.map((event) => event.kind)).toEqual(['arrived', 'released']);
		// The per-Canvas loader frees its cached templates once nothing draws them.
		expect(geometryDisposals).toBe(2);
		h.fetcher.deliver(late, twoMesh('late'));
		await settle();
		expect(h.store.stats().live).toBe(0);
		expect(h.events).toHaveLength(2);
		expect(() => h.models.update([], h.context())).toThrow(/disposed/);
		h.models.dispose();
	});
});
