// @vitest-environment jsdom
/**
 * E8/R5 — models mounted through the real `VisitorEntityGroups` under a real
 * Threlte `<T>` tree with the Canvas stores, as Stage and Preview mount them. Only
 * `useThrelte` (there is no WebGL Canvas) and the GLB bytes are faked. These pin
 * what the handler unit tests cannot reach:
 *
 * - Stage: the fallback is drawn and pickable before the lazily imported model
 *   support arrives; its arrival starts the load; the drawn model invalidates,
 *   notifies and stays pickable under the same root;
 * - Preview: support present at mount, approved bytes from the runtime URL map;
 * - unmounting the world leaves zero material and geometry leases, publishes the
 *   release and ignores bytes that arrive afterwards.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	HTMLCanvasElement.prototype.getContext = (() => null) as never;
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
	});
});

const threlte = vi.hoisted(() => ({ scene: null as unknown, invalidate: (() => {}) as () => void }));
vi.mock('@threlte/core', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@threlte/core')>();
	return { ...actual, useThrelte: () => ({ ...actual, scene: threlte.scene, invalidate: () => threlte.invalidate() }) };
});

import { flushSync, mount, tick, unmount } from 'svelte';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene, type Object3D } from 'three';
import type { RuntimeScene, SceneModelEntity } from '@portfolio/project-model';
import Harness, { type WorldHarnessHandle } from './fixtures/ArtworkWorldHarness.svelte';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { createModelTemplateLoader, sceneModelSupport } from '$lib/render/models/scene-model-support';
import type { ModelTemplate, SceneModelSupport } from '$lib/render/scene-model-representation';
import type { CasterEvent } from '$lib/render/resources/caster-channel';

const URL_A = 'https://models.test/creator.glb';

function modelEntity(id: string, x: number): SceneModelEntity {
	return {
		kind: 'model',
		id,
		name: id,
		assetId: 'creator-model',
		fallback: 'generic',
		position: [x, 0, 0],
		rotation: [0, 0, 0],
		scale: 1
	} as SceneModelEntity;
}

function runtime(entities: SceneModelEntity[]): RuntimeScene {
	return {
		textures: [],
		materials: [],
		entities,
		objects: [],
		modelFootprints: new Map([['creator-model', { width: 1, depth: 1 }]])
	} as unknown as RuntimeScene;
}

function fakeSupport() {
	const waiting: Array<(value: ModelTemplate) => void> = [];
	const requests: string[] = [];
	const support: SceneModelSupport = {
		...sceneModelSupport,
		createLoader: () =>
			createModelTemplateLoader((url) => {
				requests.push(url);
				return new Promise((resolve) => waiting.push(resolve));
			})
	};
	return {
		support,
		requests,
		deliver() {
			for (const resolve of waiting.splice(0)) {
				const template = new Group();
				template.add(new Mesh(new BoxGeometry(0.6, 0.6, 0.6), new MeshStandardMaterial({ color: 0x336699 })));
				resolve({ template, animationNames: [] });
			}
		}
	};
}

function meshCount(root: Object3D | null | undefined): number {
	let count = 0;
	root?.traverse((node) => node instanceof Mesh && (count += 1));
	return count;
}

function fallbackOf(root: Object3D | null | undefined): Object3D | undefined {
	let found: Object3D | undefined;
	root?.traverse((node) => {
		if (node.name.startsWith('SceneModelFallback:')) found = node;
	});
	return found;
}

async function settle(): Promise<void> {
	for (let i = 0; i < 6; i += 1) {
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		await tick();
	}
	flushSync();
}

let app: ReturnType<typeof mount> | null = null;
afterEach(() => {
	if (app !== null) unmount(app);
	app = null;
});

function mountWorld(scene: RuntimeScene, props: { modelSupport?: SceneModelSupport | null; modelUrls?: ReadonlyMap<string, string> | null }) {
	threlte.scene = new Scene();
	const invalidate = vi.fn();
	threlte.invalidate = invalidate;
	const drawn = vi.fn();
	const pick = createScenePickSource();
	pick.setSource(scene);
	const handle = {} as WorldHarnessHandle;
	app = mount(Harness, {
		target: document.body,
		props: {
			scene,
			artworkScope: null,
			handle,
			environment: false,
			onModelDrawn: drawn,
			onEntityRoot: (id: string, root: Object3D) => pick.register(id, root),
			...props
		}
	});
	flushSync();
	const events: CasterEvent[] = [];
	handle.resources.casters.subscribe((event) => events.push(event));
	return { handle, invalidate, drawn, pick, events };
}

const DOWN_THE_X_AXIS = { origin: [-10, 0.3, 0] as [number, number, number], direction: [1, 0, 0] as [number, number, number] };

describe('E8 mounted: models through VisitorEntityGroups', () => {
	it('Stage: the fallback draws and picks before the lazy support; its arrival loads, invalidates and keeps the root', async () => {
		const bytes = fakeSupport();
		const scene = runtime([modelEntity('m1', 0)]);
		const { handle, invalidate, drawn, pick, events } = mountWorld(scene, {
			modelSupport: null,
			modelUrls: new Map([['creator-model', URL_A]])
		});
		const root = pick.entityObject('m1');
		expect(root?.name).toBe('SceneEntity:m1');
		expect(fallbackOf(root)).toBeDefined();
		expect(pick.hasPickableBody('m1')).toBe(true);
		expect(pick.pick(DOWN_THE_X_AXIS, scene)?.entityId).toBe('m1');
		expect(bytes.requests).toEqual([]);

		handle.set({ modelSupport: bytes.support });
		flushSync();
		expect(bytes.requests).toEqual([URL_A]);
		invalidate.mockClear();
		bytes.deliver();
		await settle();
		expect(pick.entityObject('m1')).toBe(root);
		expect(fallbackOf(root)).toBeUndefined();
		expect(meshCount(root)).toBe(1);
		expect(drawn).toHaveBeenCalledTimes(1);
		expect(invalidate).toHaveBeenCalled();
		expect(events.map((event) => event.kind)).toEqual(['arrived']);
		expect(pick.pick(DOWN_THE_X_AXIS, scene)?.entityId).toBe('m1');
	});

	it('Preview: support at mount; two instances share one request and one material; unmount releases everything', async () => {
		const bytes = fakeSupport();
		const scene = runtime([modelEntity('m1', 0), modelEntity('m2', 2)]);
		const { handle, events } = mountWorld(scene, {
			modelSupport: bytes.support,
			modelUrls: new Map([['creator-model', URL_A]])
		});
		expect(bytes.requests).toEqual([URL_A]);
		bytes.deliver();
		await settle();
		const roots = handle.root.getObjectByName('SceneModels')!;
		expect(roots.children).toHaveLength(2);
		expect(handle.resources.materials.stats().live).toBe(1);
		expect(handle.resources.geometry.stats().live).toBe(0);
		expect(events.map((event) => event.kind)).toEqual(['arrived', 'arrived']);

		unmount(app!);
		app = null;
		flushSync();
		expect(handle.resources.materials.stats().live).toBe(0);
		expect(handle.resources.geometry.stats().live).toBe(0);
		expect(events.map((event) => event.kind)).toEqual(['arrived', 'arrived', 'released', 'released']);
	});

	it('unmounting while bytes are in flight releases the fallback and mounts nothing when they arrive', async () => {
		const bytes = fakeSupport();
		const { handle, events } = mountWorld(runtime([modelEntity('m1', 0)]), {
			modelSupport: bytes.support,
			modelUrls: new Map([['creator-model', URL_A]])
		});
		expect(handle.resources.geometry.stats().live).toBe(1);
		unmount(app!);
		app = null;
		flushSync();
		expect(handle.resources.materials.stats().live).toBe(0);
		expect(handle.resources.geometry.stats().live).toBe(0);
		bytes.deliver();
		await settle();
		expect(handle.resources.materials.stats().live).toBe(0);
		expect(events).toEqual([]);
	});
});
