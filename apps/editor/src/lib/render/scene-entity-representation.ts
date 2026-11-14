/**
 * E7/R4 — the retained Scene entity representation for primitives and Forms.
 *
 * Scene content used to mount one Svelte component (and one geometry/material
 * component) per entity: at L that is a component tree for content that changes
 * once per accepted edit. Walls, objects and Rooms already prove the alternative,
 * and this module applies it to the first two Scene families — the ones E7 owns.
 *
 * The contract is the same representation interface E6 established:
 *
 * - **One root, mounted once.** `object3d` is the subtree the shell mounts; it is
 *   never replaced.
 * - **Patched by item key.** `update` compares each item's content key and
 *   touches only what changed. An unchanged entity keeps its group, mesh, buffer,
 *   material and texture lease.
 * - **Geometry and materials come from the stores.** The unit/Form buffer is a
 *   lease on the Canvas `GeometryStore`; the surface is a lease on the Canvas
 *   `MaterialStore`. Equal looks share one material, so 196 primitives with three
 *   looks hold three instances.
 * - **`objectOf` and `onRoot` replace a subtree search.** The host's pick source
 *   registers each item's root; selection reads the same object.
 *
 * Texture variants are loaded per look and bound to the shared material when they
 * arrive. A failed or partial load keeps the untextured surface, which is what
 * the per-entity component rendered while its maps were missing. Releases are
 * deferred by the texture store, so a rebuilt entity that reuses a look does not
 * delete and re-upload its bytes inside one update.
 *
 * Deliberately not owned here: models (E8), artwork (E9), lights (E10) and any
 * editor affordance. Those keep their existing components until their own packet
 * installs a handler, so one Scene entity is never drawn twice.
 */
import { Group, Mesh, type Object3D } from 'three';
import { countWork } from '@portfolio/layout-core';
import type { MaterialLease, MaterialStore, MaterialTextureMaps } from './resources/material-store';
import type { GeometryLease, GeometryStore } from './resources/geometry-store';
import {
	MATERIAL_TEXTURE_SLOTS,
	type MaterialTextureKeys,
	type StandardMaterialDescriptor
} from './resources/material-descriptor';
import type { SceneRenderDescription, SceneRenderItem } from './resources/scene-render-item';
import {
	acquireEffectiveVariant,
	effectiveTextureVariantKey,
	loadEffectiveTextures,
	releaseEffectiveVariant,
	type LoadedTextureMaps,
	type TextureLoadScope
} from './resources/texture-store';

/** What one update did, as counts — the R2b/R4 oracles read these, never a stopwatch. */
export type SceneEntityRepresentationStats = {
	/** Drawable items after the update. */
	readonly items: number;
	/** Items rebuilt by this update (new or changed). */
	readonly built: number;
	/** Items kept from the previous update. */
	readonly retained: number;
	/** Items removed and released because the Scene no longer has them. */
	readonly released: number;
	/** Of the built items, how many are Forms: the arrival notification's count. */
	readonly forms: number;
	/** Of the built items, how many acquired a texture variant in this update. */
	readonly textured: number;
};

export type SceneEntityRepresentationOptions = {
	/** The Canvas material store: the one factory for a world surface. */
	readonly store: MaterialStore;
	/** The Canvas geometry store: unit buffers and canonical Form buffers. */
	readonly geometry: GeometryStore;
	/** The texture cache namespace this Canvas loads under (release scope). */
	readonly scope?: () => TextureLoadScope | null;
	/**
	 * Register an item's root with the host's pick index. The representation
	 * calls it when an item is built and the returned unregister when it is
	 * released, so the pick source never walks a subtree to find an entity.
	 */
	readonly onRoot?: (id: string, root: Object3D) => (() => void) | void;
};

export type SceneEntityRepresentation = {
	/** The subtree to mount; it is never replaced, only reconciled. */
	readonly object3d: Group;
	update(description: SceneRenderDescription): SceneEntityRepresentationStats;
	/** The retained root drawing this entity, or null. Reads the owned index. */
	objectOf(id: string): Object3D | null;
	/** Resolves when no texture variant is still arriving. Observation only. */
	idle(): Promise<void>;
	/** Release every retained item, its leases and its pick registration. Idempotent. */
	dispose(): void;
};

type VariantLease = {
	readonly seed: string;
	readonly rx: number;
	readonly ry: number;
	readonly rotation: number;
	readonly scope: TextureLoadScope | null;
};

type RetainedItem = {
	readonly key: string;
	readonly group: Group;
	readonly mesh: Mesh;
	readonly geometry: GeometryLease;
	material: MaterialLease;
	readonly textures: boolean;
	variant: VariantLease | null;
	/** Bumped whenever the item is rebuilt or released, so a late load cannot patch it. */
	generation: number;
	unregister: (() => void) | null;
};

/**
 * The descriptor a textured material is acquired under.
 *
 * The variant key is the texture store's own name for the loaded maps, so the
 * material key records the texture identity and two entities sharing a look (and
 * therefore a variant) share one material instance.
 */
function texturedDescriptor(
	base: StandardMaterialDescriptor,
	maps: LoadedTextureMaps,
	variantKey: string
): StandardMaterialDescriptor | null {
	const textures: Partial<Record<(typeof MATERIAL_TEXTURE_SLOTS)[number], string>> = {};
	let bound = false;
	for (const slot of MATERIAL_TEXTURE_SLOTS) {
		if (maps[slot] === undefined) continue;
		textures[slot] = variantKey;
		bound = true;
	}
	if (!bound) return null;
	const keys: MaterialTextureKeys = textures;
	return { ...base, textures: keys } satisfies StandardMaterialDescriptor;
}

export function createSceneEntityRepresentation(
	options: SceneEntityRepresentationOptions
): SceneEntityRepresentation {
	const object3d = new Group();
	object3d.name = 'SceneEntities';
	const retained = new Map<string, RetainedItem>();
	const pending = new Set<Promise<void>>();
	let disposed = false;
	let previous: SceneRenderDescription | null = null;

	function releaseItem(entry: RetainedItem): void {
		entry.generation += 1;
		entry.unregister?.();
		entry.unregister = null;
		entry.group.removeFromParent();
		// The material lease goes back before the variant it binds, so the store
		// never constructs a material whose maps are already on their way out.
		entry.material.release();
		if (entry.variant !== null) {
			releaseEffectiveVariant(
				entry.variant.seed,
				entry.variant.rx,
				entry.variant.ry,
				entry.variant.rotation,
				entry.variant.scope
			);
			entry.variant = null;
		}
		entry.geometry.release();
	}

	function loadTextures(entry: RetainedItem, item: SceneRenderItem): void {
		const textures = item.textures;
		if (textures === null) return;
		const scope = options.scope?.() ?? null;
		const [rx, ry] = textures.repeat;
		const generation = entry.generation;
		const job: Promise<void> = loadEffectiveTextures(textures, scope)
			.then((result) => {
				// A released or rebuilt item, or a disposed representation, must not be
				// patched by a late arrival.
				if (disposed || entry.generation !== generation) return;
				if (result.status !== 'ready' && result.status !== 'partial') return;
				const maps = acquireEffectiveVariant(textures, rx, ry, 0, scope);
				const variantKey = effectiveTextureVariantKey(textures.variantSeed, rx, ry, 0, scope);
				const descriptor = texturedDescriptor(item.material, maps, variantKey);
				if (descriptor === null) {
					releaseEffectiveVariant(textures.variantSeed, rx, ry, 0, scope);
					return;
				}
				const next: MaterialLease = options.store.acquire(descriptor, maps as MaterialTextureMaps);
				const base = entry.material;
				entry.material = next;
				entry.variant = { seed: textures.variantSeed, rx, ry, rotation: 0, scope };
				entry.mesh.material = next.material;
				// The untextured surface is no longer this item's look. Another entity
				// still holding it keeps the instance alive.
				base.release();
			})
			.catch(() => {
				/* A failed load keeps the untextured surface, as the component did. */
			});
		pending.add(job);
		const settle = (): void => {
			pending.delete(job);
		};
		void job.then(settle, settle);
	}

	function build(item: SceneRenderItem): RetainedItem {
		countWork('representation:scene-entity-entry-test');
		const group = new Group();
		group.name = `SceneEntity:${item.id}`;
		group.position.set(...item.transform.position);
		group.rotation.set(...item.transform.rotation);
		group.scale.set(...item.transform.scale);

		const geometry = options.geometry.acquire(item.geometry);
		const material = options.store.acquire(item.material);
		const mesh = new Mesh(geometry.geometry, material.material);
		mesh.name = `SceneEntityBody:${item.id}`;
		mesh.scale.set(...item.geometryScale);
		mesh.castShadow = item.castShadow;
		mesh.receiveShadow = item.receiveShadow;
		group.add(mesh);
		object3d.add(group);

		const entry: RetainedItem = {
			key: item.key,
			group,
			mesh,
			geometry,
			material,
			textures: item.textures !== null,
			variant: null,
			generation: 0,
			unregister: options.onRoot?.(item.id, group) ?? null
		};
		loadTextures(entry, item);
		return entry;
	}

	return {
		object3d,

		update(description) {
			if (disposed) throw new Error('the scene entity representation has been disposed');
			if (previous === description) {
				return {
					items: retained.size,
					built: 0,
					retained: retained.size,
					released: 0,
					forms: 0,
					textured: 0
				};
			}
			previous = description;
			let built = 0;
			let kept = 0;
			let forms = 0;
			let textured = 0;
			const present = new Set<string>();

			for (const item of description.items) {
				present.add(item.id);
				const existing = retained.get(item.id);
				if (existing !== undefined && existing.key === item.key) {
					kept += 1;
					continue;
				}
				if (existing !== undefined) {
					releaseItem(existing);
					retained.delete(item.id);
				}
				const entry = build(item);
				retained.set(item.id, entry);
				built += 1;
				if (item.geometry.kind === 'form') forms += 1;
				if (entry.textures) textured += 1;
			}

			let released = 0;
			for (const [id, entry] of retained) {
				if (present.has(id)) continue;
				releaseItem(entry);
				retained.delete(id);
				released += 1;
			}

			return { items: retained.size, built, retained: kept, released, forms, textured };
		},

		objectOf(id) {
			return retained.get(id)?.group ?? null;
		},

		async idle() {
			// A handler can enqueue another job (a variant that resolves into a
			// material acquire), so the loop drains until nothing is pending.
			while (pending.size > 0) await Promise.all([...pending]);
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			previous = null;
			for (const entry of retained.values()) releaseItem(entry);
			retained.clear();
		}
	};
}
