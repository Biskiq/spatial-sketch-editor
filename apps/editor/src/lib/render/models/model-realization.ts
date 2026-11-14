/**
 * E8/R5 + R2c — one drawn instance of an approved model, on this Canvas's stores.
 *
 * A loaded GLB is a template. Every drawn instance is a clone of its hierarchy:
 *
 * - **Geometry is shared.** A clone keeps the template's buffers; nothing here
 *   copies or disposes a geometry.
 * - **Skeletons are not.** A hierarchy with skinned meshes is cloned with
 *   `SkeletonUtils.clone`, which rebinds every skinned mesh to its own bones, so
 *   one instance's pose never moves another's. A static hierarchy takes the plain
 *   `Object3D.clone`, which is cheaper and has no bones to rebind.
 * - **Surfaces are leases on the Canvas's `MaterialStore`.** An instance holds one
 *   lease per mesh slot. The store decides identity: N instances of one model hold
 *   one material per (mesh, slot, remap), not N. A remap is the resolved look,
 *   which replaces the asset's material on that mesh (E8/R2c).
 * - **Textures are leases on the texture store.** A textured look takes one
 *   variant lease per instance, released with the instance; the store's deferred
 *   release keeps a variant alive while any instance still names it.
 *
 * Releasing an instance gives back exactly the leases it took. It never disposes
 * the template's geometry or materials, which the loader's cache owns and every
 * other instance still draws. The store's own clone of an imported material is
 * disposed only when its last lease goes.
 *
 * The module is framework-free: the Svelte host supplies the template, the store
 * and the look, and mounts the root it gets back.
 */
import { Mesh, type Material, type Object3D, type SkinnedMesh, type Texture } from 'three';
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { EffectiveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
import type { MaterialLease, MaterialStore, MaterialTextureMaps } from '../resources/material-store';
import {
	MATERIAL_TEXTURE_SLOTS,
	type MaterialTextureKeys,
	type MaterialTextureSlotKey,
	type StandardMaterialDescriptor
} from '../resources/material-descriptor';
import {
	acquireEffectiveVariant,
	effectiveTextureVariantKey,
	releaseEffectiveVariant,
	type TextureLoadScope
} from '../resources/texture-store';
import type { TextureVariantSource } from '../resources/texture-variant';

/** The surface look a model's meshes wear, and the texture variant it binds, if any. */
export type ModelLook = {
	readonly material: Omit<StandardMaterialDescriptor, 'kind' | 'textures'>;
	/** The loaded texture source and its cache namespace; null for an untextured look. */
	readonly texture: {
		readonly source: TextureVariantSource;
		readonly repeat: readonly [number, number];
		readonly scope: TextureLoadScope | null;
	} | null;
};

/** How a drawn instance's surfaces and shadows are styled. */
export type ModelStyle = {
	/** The resolved look, or null to keep the asset's own materials. */
	readonly look: ModelLook | null;
	readonly wireframe: boolean;
	readonly castShadow: boolean;
	readonly receiveShadow: boolean;
};

export type ModelRealizationOptions = ModelStyle & {
	/** The approved asset's identity: the URL its bytes were loaded from. */
	readonly asset: string;
	readonly store: MaterialStore;
};

export type ModelRealization = {
	/** The clone of the template hierarchy. The host mounts it; it is never replaced. */
	readonly root: Object3D;
	/**
	 * Re-style every surface. Acquires the new leases before releasing the old, so a
	 * look that is unchanged never leaves its material unleased for a moment.
	 */
	restyle(style: ModelStyle): void;
	/** Give back every lease this instance holds. Idempotent. */
	release(): void;
	/** Leases held now: material leases plus at most one texture variant lease. */
	leaseCount(): number;
};

type SurfaceHold = {
	readonly mesh: Mesh;
	/** The material slot on an array-material mesh, or -1 for a single material. */
	readonly slot: number;
	readonly lease: MaterialLease;
};

type VariantHold = {
	readonly seed: string;
	readonly rx: number;
	readonly ry: number;
	readonly scope: TextureLoadScope | null;
};

const CONTROL = { nextId: 0 };

/** A process-unique id for one host, so its caster events name one caster. */
export function nextModelEntityId(): number {
	CONTROL.nextId += 1;
	return CONTROL.nextId;
}

/** Every mesh under `object`, in depth-first order: the index a remap names. */
export function meshesOf(object: Object3D): Mesh[] {
	const meshes: Mesh[] = [];
	object.traverse((candidate) => {
		if (candidate instanceof Mesh) meshes.push(candidate);
	});
	return meshes;
}

/**
 * A clone of a template hierarchy that shares its geometry and, until a surface is
 * styled, its materials. Skinned hierarchies are cloned with their own skeletons.
 */
export function cloneModelHierarchy(template: Object3D): Object3D {
	let skinned = false;
	template.traverse((candidate) => {
		if ((candidate as SkinnedMesh).isSkinnedMesh === true) skinned = true;
	});
	return skinned ? cloneSkinnedHierarchy(template) : template.clone(true);
}

/**
 * Whether a texture load produced maps a look may bind. A failed or absent load keeps
 * the untextured surface, as the GLB's own material did.
 */
export function texturesReady(result: { readonly status: string } | undefined): boolean {
	return result?.status === 'ready' || result?.status === 'partial';
}

/**
 * The look of an approved creator model's effective material, as a surface look.
 * The variant repeat is the unit repeat a model's surfaces always used.
 */
export function modelLookFor(
	effective: EffectiveSceneMaterial,
	scope: TextureLoadScope | null,
	textured: boolean
): ModelLook {
	return {
		material: { color: effective.color, roughness: effective.roughness, metalness: effective.metalness },
		texture: textured ? { source: effective, repeat: [1, 1], scope } : null
	};
}

/**
 * Acquire the texture variant a look binds and the descriptor fragment that names
 * it. A variant with no loaded slot binds nothing, so the surface stays untextured
 * rather than naming a texture the store would refuse.
 */
function bindLook(look: ModelLook): {
	readonly remap: Omit<StandardMaterialDescriptor, 'kind'>;
	readonly maps: MaterialTextureMaps;
	readonly hold: VariantHold | null;
} {
	const base = { ...look.material };
	if (look.texture === null) return { remap: base, maps: {}, hold: null };
	const { source, repeat, scope } = look.texture;
	const [rx, ry] = repeat;
	const loaded = acquireEffectiveVariant(source, rx, ry, 0, scope);
	const variantKey = effectiveTextureVariantKey(source.variantSeed, rx, ry, 0, scope);
	const keys: Partial<Record<MaterialTextureSlotKey, string>> = {};
	const maps: Partial<Record<MaterialTextureSlotKey, Texture>> = {};
	let bound = false;
	for (const slot of MATERIAL_TEXTURE_SLOTS) {
		const map = loaded[slot];
		if (map === undefined) continue;
		keys[slot] = variantKey;
		maps[slot] = map;
		bound = true;
	}
	if (!bound) {
		releaseEffectiveVariant(source.variantSeed, rx, ry, 0, scope);
		return { remap: base, maps: {}, hold: null };
	}
	const textures: MaterialTextureKeys = keys;
	return {
		remap: { ...base, textures },
		maps,
		hold: { seed: source.variantSeed, rx, ry, scope }
	};
}

export function realizeModel(template: Object3D, options: ModelRealizationOptions): ModelRealization {
	const templateMeshes = meshesOf(template);
	const root = cloneModelHierarchy(template);
	const drawnMeshes = meshesOf(root);
	let holds: SurfaceHold[] = [];
	let variant: VariantHold | null = null;
	let released = false;

	function applyShadows(style: ModelStyle): void {
		for (const mesh of drawnMeshes) {
			mesh.castShadow = style.castShadow;
			mesh.receiveShadow = style.receiveShadow;
		}
	}

	function surfaceFor(
		meshIndex: number,
		slot: number,
		templateMaterial: Material,
		bound: ReturnType<typeof bindLook> | null,
		wireframe: boolean
	): MaterialLease {
		const identity = {
			kind: 'imported' as const,
			asset: options.asset,
			mesh: meshIndex,
			slot,
			...(wireframe ? { wireframe: true } : {})
		};
		if (bound === null) return options.store.acquire(identity, undefined, templateMaterial);
		return options.store.acquire({ ...identity, remap: bound.remap }, bound.maps);
	}

	/**
	 * Acquire the new surfaces, then give back the old ones. Shared materials keep a
	 * lease while the new look takes its own, so nothing is disposed in between.
	 */
	function apply(style: ModelStyle): void {
		applyShadows(style);
		const bound = style.look === null ? null : bindLook(style.look);
		const next: SurfaceHold[] = [];
		templateMeshes.forEach((templateMesh, meshIndex) => {
			const drawn = drawnMeshes[meshIndex];
			if (drawn === undefined) return;
			if (Array.isArray(templateMesh.material)) {
				templateMesh.material.forEach((templateMaterial, slot) => {
					next.push({
						mesh: drawn,
						slot,
						lease: surfaceFor(meshIndex, slot, templateMaterial, bound, style.wireframe)
					});
				});
				return;
			}
			next.push({
				mesh: drawn,
				slot: -1,
				lease: surfaceFor(meshIndex, 0, templateMesh.material, bound, style.wireframe)
			});
		});
		for (const hold of next) {
			if (hold.slot < 0) hold.mesh.material = hold.lease.material;
			else (hold.mesh.material as Material[])[hold.slot] = hold.lease.material;
		}
		for (const previous of holds) previous.lease.release();
		holds = next;

		const previousVariant = variant;
		variant = bound?.hold ?? null;
		if (previousVariant !== null) {
			releaseEffectiveVariant(
				previousVariant.seed,
				previousVariant.rx,
				previousVariant.ry,
				0,
				previousVariant.scope
			);
		}
	}

	apply({
		look: options.look,
		wireframe: options.wireframe,
		castShadow: options.castShadow,
		receiveShadow: options.receiveShadow
	});

	return {
		root,
		restyle(style) {
			if (released) throw new Error('the model instance has been released');
			apply(style);
		},
		release() {
			if (released) return;
			released = true;
			for (const hold of holds) hold.lease.release();
			holds = [];
			if (variant !== null) {
				releaseEffectiveVariant(variant.seed, variant.rx, variant.ry, 0, variant.scope);
				variant = null;
			}
		},
		leaseCount() {
			return holds.length + (variant === null ? 0 : 1);
		}
	};
}

/**
 * Stale-arrival rejection. A host begins a token for each load it starts; an
 * arrival may mount only while its token is still the current one. Closing the
 * gate, which a host does on teardown, invalidates every outstanding token.
 */
export type ArrivalGate = {
	begin(): number;
	accepts(token: number): boolean;
	close(): void;
};

export function createArrivalGate(): ArrivalGate {
	let current = 0;
	return {
		begin() {
			current += 1;
			return current;
		},
		accepts(token) {
			return token === current;
		},
		close() {
			current += 1;
		}
	};
}
