/**
 * One drawn instance of an approved model, on this Canvas's stores.
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
 *   which replaces the asset's material on that mesh.
 * - **Textures are leases on the texture store.** A textured look takes one
 *   variant lease per instance, released with the instance; the store's deferred
 *   release keeps a variant alive while any instance still names it.
 *
 * Releasing an instance gives back exactly the leases it took. It never disposes
 * the template's geometry or materials, which the loader's cache owns and every
 * other instance still draws. The store's own clone of an imported material is
 * disposed only when its last lease goes.
 *
 * The module is framework-free: the Scene model handler supplies the template, the
 * store and the look, and mounts the root it gets back. It is reached only through
 * the lazily loaded model support, because SkeletonUtils is part of its graph; the
 * Three-free presentation rules live in `model-presentation`.
 */
import { Mesh, type BufferGeometry, type Material, type Object3D, type SkinnedMesh, type Texture } from 'three';
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';
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
import type { ModelLook } from './model-presentation';

export {
	createArrivalGate,
	modelLookFor,
	nextModelEntityId,
	texturesReady,
	type ArrivalGate,
	type ModelLook,
	type ModelSurfaceSource
} from './model-presentation';

/** How a drawn instance's surfaces and shadows are styled. */
export type ModelStyle = {
	/** The resolved look, or null to keep the asset's own materials. */
	readonly look: ModelLook | null;
	/**
	 * The resolve-time Treatment for the asset's own materials. A resolved look
	 * already carries its Treatment, so this is read only when `look` is null.
	 */
	readonly treatment?: 'flat-colour' | 'clay';
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
 * Acquire the texture variant a look binds and the descriptor fragment that names
 * it. A variant with no loaded slot binds nothing, so the surface stays untextured
 * rather than naming a texture the store would refuse.
 */
function finitePair(
	attribute: { getX(index: number): number; getY(index: number): number },
	vertex: number
): readonly [number, number] | null {
	const u = attribute.getX(vertex);
	const v = attribute.getY(vertex);
	return Number.isFinite(u) && Number.isFinite(v) ? [u, v] : null;
}

/**
 * The actual draw availability of one imported mesh. This is the render-side
 * half of target qualification: the Scene adapter can only provisionally bind a
 * model remap before its GLB arrives, so the arrived mesh must still prove every
 * UV set and normal frame the plan names.
 *
 * The render layer cannot import the project-model summarizer (E6's boundary), so
 * this checks the same predicates against the live BufferGeometry: finite UVs on
 * every referenced vertex and at least one non-singular UV frame for a normal.
 */
function finishFitsMesh(mesh: Mesh, plan: NonNullable<StandardMaterialDescriptor['finish']>): boolean {
	const geometry = mesh.geometry as BufferGeometry;
	const position = geometry.getAttribute('position');
	if (position === undefined) return false;
	const index = geometry.getIndex();
	const total = index === null ? position.count : index.count;
	const start = Math.max(0, geometry.drawRange.start);
	const count = geometry.drawRange.count;
	const end = Number.isFinite(count) ? Math.min(total, start + count) : total;
	const referenced: number[] = [];
	for (let offset = start; offset < end; offset += 1) {
		const vertex = index === null ? offset : index.getX(offset);
		if (!Number.isInteger(vertex) || vertex < 0 || vertex >= position.count) return false;
		referenced.push(vertex);
	}
	// An empty active range contributes no sampling requirement.
	if (referenced.length === 0) return true;

	for (const entry of plan.entries) {
		const attribute = geometry.getAttribute(entry.uvSet === 0 ? 'uv' : 'uv1');
		if (attribute === undefined) return false;
		for (const vertex of referenced) {
			if (finitePair(attribute, vertex) === null) return false;
		}
		if (entry.role !== 'normal') continue;
		let frame = false;
		for (let offset = 0; offset + 2 < referenced.length; offset += 3) {
			const a = referenced[offset]!;
			const b = referenced[offset + 1]!;
			const c = referenced[offset + 2]!;
			const ua = finitePair(attribute, a)!;
			const ub = finitePair(attribute, b)!;
			const uc = finitePair(attribute, c)!;
			const abx = position.getX(b) - position.getX(a);
			const aby = position.getY(b) - position.getY(a);
			const abz = position.getZ(b) - position.getZ(a);
			const acx = position.getX(c) - position.getX(a);
			const acy = position.getY(c) - position.getY(a);
			const acz = position.getZ(c) - position.getZ(a);
			const nx = aby * acz - abz * acy;
			const ny = abz * acx - abx * acz;
			const nz = abx * acy - aby * acx;
			if (Math.hypot(nx, ny, nz) === 0) continue;
			const dux = ub[0] - ua[0];
			const duy = ub[1] - ua[1];
			const dvx = uc[0] - ua[0];
			const dvy = uc[1] - ua[1];
			const lengthU = Math.hypot(dux, duy);
			const lengthV = Math.hypot(dvx, dvy);
			if (!(lengthU > 0) || !(lengthV > 0)) continue;
			if (Math.abs(dux * dvy - duy * dvx) > 1e-6 * lengthU * lengthV) {
				frame = true;
				break;
			}
		}
		if (!frame) return false;
	}
	return true;
}

function bindLook(look: ModelLook): {
	readonly remap: Omit<StandardMaterialDescriptor, 'kind'>;
	readonly maps: MaterialTextureMaps;
	readonly hold: VariantHold | null;
	readonly views: Readonly<Record<string, Texture>> | undefined;
} {
	const base = { ...look.material };
	// A Finish's normal strength and flip bind only with the normal map they scale.
	const { normalScale: _normalScale, ...withoutNormalScale } = base;
	if (base.finish !== undefined) {
		// A sampled legacy model binds identity UV0 and the plan's views. Without
		// a complete view set it keeps the resolved constants, never a half plan.
		if (look.views === undefined || Object.keys(look.views).length === 0) {
			const { finish: _finish, ...constants } = withoutNormalScale;
			return { remap: constants, maps: {}, hold: null, views: undefined };
		}
		return { remap: base, maps: {}, hold: null, views: look.views };
	}
	if (look.texture === null)
		return { remap: withoutNormalScale, maps: {}, hold: null, views: undefined };
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
		return { remap: withoutNormalScale, maps: {}, hold: null, views: undefined };
	}
	const textures: MaterialTextureKeys = keys;
	return {
		remap: { ...(maps.normalMap === undefined ? withoutNormalScale : base), textures },
		maps,
		hold: { seed: source.variantSeed, rx, ry, scope },
		views: undefined
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
		templateMesh: Mesh,
		templateMaterial: Material,
		bound: ReturnType<typeof bindLook> | null,
		wireframe: boolean,
		treatment: 'flat-colour' | 'clay' | undefined
	): MaterialLease {
		// A provisional plan that the arrived mesh cannot actually sample keeps
		// the resolved constants instead of drawing a half-bound surface. This is
		// the per-draw target check the pre-arrival adapter cannot perform.
		if (bound !== null && bound.remap.finish !== undefined && !finishFitsMesh(templateMesh, bound.remap.finish)) {
			const { finish: _finish, ...constants } = bound.remap;
			bound = { remap: constants, maps: {}, hold: null, views: undefined };
		}
		const identity = {
			kind: 'imported' as const,
			asset: options.asset,
			mesh: meshIndex,
			slot,
			wireframe,
			...(treatment === undefined ? {} : { treatment })
		};
		// Natural (treatment absent) is exactly today's key, clone and lease count.
		if (bound === null) return options.store.acquire(identity, undefined, templateMaterial);
		return options.store.acquire(
			{ ...identity, remap: bound.remap },
			bound.maps,
			undefined,
			bound.views
		);
	}

	/**
	 * Acquire the new surfaces, then give back the old ones. Shared materials keep a
	 * lease while the new look takes its own, so nothing is disposed in between.
	 */
	function apply(style: ModelStyle): void {
		applyShadows(style);
		const bound = style.look === null ? null : bindLook(style.look);
		// A remap already carries its Treatment through the resolver.
		const treatment = style.look === null ? style.treatment : undefined;
		const next: SurfaceHold[] = [];
		templateMeshes.forEach((templateMesh, meshIndex) => {
			const drawn = drawnMeshes[meshIndex];
			if (drawn === undefined) return;
			if (Array.isArray(templateMesh.material)) {
				templateMesh.material.forEach((templateMaterial, slot) => {
					next.push({
						mesh: drawn,
						slot,
						lease: surfaceFor(
							meshIndex,
							slot,
							templateMesh,
							templateMaterial,
							bound,
							style.wireframe,
							treatment
						)
					});
				});
				return;
			}
			next.push({
				mesh: drawn,
				slot: -1,
				lease: surfaceFor(
					meshIndex,
					0,
					templateMesh,
					templateMesh.material,
					bound,
					style.wireframe,
					treatment
				)
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
		...(options.treatment === undefined ? {} : { treatment: options.treatment }),
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
