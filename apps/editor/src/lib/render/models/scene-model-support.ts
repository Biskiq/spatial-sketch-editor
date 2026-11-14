/**
 * E8/R5 — the model support the Scene model handler loads lazily.
 *
 * Everything a drawn model needs beyond plain data is here: the glTF loader with
 * its Meshopt decoder, the skeleton-aware realization and the read-only model
 * inspection. The handler (`scene-model-representation`) is part of every Stage
 * and visitor graph, so it reaches these only through this module: the editor
 * Stage imports it dynamically (an enclosure-only Stage never downloads the
 * loader or SkeletonUtils), and the visitor imports it statically, which is the
 * first-load graph its static model renderer always had.
 *
 * **The loader is per Canvas.** It replaces Threlte's `useGltf` cache with the
 * same policy: one request per URL for the Canvas's lifetime, and one template per
 * URL that every instance clones. Each drawn instance holds a lease on its URL, so
 * replacement and teardown give back exactly what they took and the counts are
 * observable. A template stays cached after its last lease (a re-placed model
 * does not refetch, as before); a failed load is evicted so a later placement can
 * try again. Disposing the loader frees the cached templates' geometry and
 * textures; it runs after every instance on the Canvas has been released.
 */
import { Mesh, type Material, type Object3D, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { inspectModel } from '$lib/museum/assets/model-utils';
import { realizeModel } from './model-realization';
import type {
	ModelTemplate,
	ModelTemplateLease,
	ModelTemplateLoader,
	SceneModelSupport
} from '../scene-model-representation';

/** Where a template's bytes come from: a GLB URL in, a parsed scene out. */
export type ModelTemplateFetch = (url: string) => Promise<ModelTemplate>;

function gltfFetch(): ModelTemplateFetch {
	const loader = new GLTFLoader();
	loader.setMeshoptDecoder(MeshoptDecoder);
	return async (url) => {
		const gltf = await loader.loadAsync(url);
		return {
			template: gltf.scene,
			animationNames: gltf.animations.map((animation) => animation.name).filter(Boolean)
		};
	};
}

type CacheEntry = {
	readonly promise: Promise<ModelTemplate>;
	template: Object3D | null;
};

function texturesOf(material: Material): Texture[] {
	const found: Texture[] = [];
	for (const value of Object.values(material)) {
		if (value !== null && typeof value === 'object' && (value as Texture).isTexture === true) {
			found.push(value as Texture);
		}
	}
	return found;
}

/** Free one cached template's buffers and textures. Only ever at loader disposal. */
function freeTemplate(template: Object3D): void {
	template.traverse((node) => {
		if (!(node instanceof Mesh)) return;
		node.geometry.dispose();
		const materials: Material[] = Array.isArray(node.material) ? node.material : [node.material];
		for (const material of materials) for (const texture of texturesOf(material)) texture.dispose();
	});
}

export function createModelTemplateLoader(fetch: ModelTemplateFetch = gltfFetch()): ModelTemplateLoader {
	const cache = new Map<string, CacheEntry>();
	let requested = 0;
	let failed = 0;
	let leases = 0;
	let disposed = false;

	function entryFor(url: string): CacheEntry {
		const hit = cache.get(url);
		if (hit !== undefined) return hit;
		requested += 1;
		const entry: CacheEntry = {
			promise: fetch(url).then((loaded) => {
				// A template that arrives after the Canvas went away is never drawn.
				if (disposed) freeTemplate(loaded.template);
				else entry.template = loaded.template;
				return loaded;
			}),
			template: null
		};
		entry.promise.catch(() => {
			failed += 1;
			if (cache.get(url) === entry) cache.delete(url);
		});
		cache.set(url, entry);
		return entry;
	}

	return {
		acquire(url): ModelTemplateLease {
			if (disposed) throw new Error('the model loader has been disposed');
			const entry = entryFor(url);
			leases += 1;
			let released = false;
			return {
				ready: entry.promise,
				release() {
					if (released) return;
					released = true;
					leases -= 1;
				}
			};
		},
		stats() {
			let templates = 0;
			for (const entry of cache.values()) if (entry.template !== null) templates += 1;
			return { requested, failed, templates, leases };
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			for (const entry of cache.values()) if (entry.template !== null) freeTemplate(entry.template);
			cache.clear();
		}
	};
}

export const sceneModelSupport: SceneModelSupport = {
	createLoader: () => createModelTemplateLoader(),
	realize: realizeModel,
	inspect: (root, animationNames) => inspectModel(root, [...animationNames])
};
