import type { MaterialStore, MaterialTextureMaps } from '$lib/render/resources/material-store';
import type { TextureLoadScope } from '$lib/render/resources/texture-store';
import {
	acquireEffectiveVariant,
	effectiveTextureVariantKey,
	loadEffectiveTextures,
	releaseEffectiveVariant
} from '$lib/render/resources/texture-store';
import type { MaterialTextureSlotKey } from '$lib/render/resources/material-descriptor';
import type { Material } from 'three';
import type { SceneSurfaceLook, SceneSurfaceLookResolver, SceneSurfaceRef } from './surface-look';

type SurfaceLook = SceneSurfaceLook & {
	loaded: boolean;
};
type Variant = {
	readonly seed: string;
	readonly rx: number;
	readonly ry: number;
	readonly rotation: number;
	readonly offset: readonly [number, number];
	readonly scope: TextureLoadScope | null;
	readonly maps: MaterialTextureMaps;
};

/** Lease Scene-resolved floor/lid looks through the Canvas material store. */
export function createRoomSurfaceMaterials(input: {
	readonly store: MaterialStore;
	readonly scope: TextureLoadScope | null;
	readonly onMaterialChange: () => void;
	readonly resolveSurfaceLook?: SceneSurfaceLookResolver;
}): { materialFor(surface: SceneSurfaceRef): Material | null; materialKeys(): readonly string[]; dispose(): void } {
	const leases = new Map<string, ReturnType<MaterialStore['acquire']>>();
	const variants = new Map<string, Variant>();
	const looks = new Map<string, SurfaceLook>();
	let disposed = false;

	function lookFor(surface: SceneSurfaceRef): SurfaceLook | null {
		const resolved = input.resolveSurfaceLook?.(surface) ?? null;
		if (resolved === null) return null;
		const key = JSON.stringify([resolved.material, resolved.textures]);
		const existing = looks.get(key);
		if (existing !== undefined) return existing;
		const look: SurfaceLook = { ...resolved, loaded: resolved.textures === null };
		looks.set(key, look);
		if (look.textures !== null) {
			void loadEffectiveTextures(look.textures, input.scope).then((result) => {
				if (disposed || result.status === 'failed' || result.status === 'fallback') return;
				look.loaded = true;
				input.onMaterialChange();
			});
		}
		return look;
	}

	function descriptorFor(look: SurfaceLook): { descriptor: typeof look.material; maps?: MaterialTextureMaps } {
		const texture = look.textures;
		if (texture === null || !look.loaded) return { descriptor: look.material };
		const key = effectiveTextureVariantKey(
			texture.variantSeed, texture.repeat[0], texture.repeat[1], texture.rotation, input.scope, texture.offset
		);
		let variant = variants.get(key);
		if (variant === undefined) {
			const maps = acquireEffectiveVariant(
				texture, texture.repeat[0], texture.repeat[1], texture.rotation, input.scope, texture.offset
			) as MaterialTextureMaps;
			variant = {
				seed: texture.variantSeed, rx: texture.repeat[0], ry: texture.repeat[1],
				rotation: texture.rotation, offset: texture.offset, scope: input.scope, maps
			};
			variants.set(key, variant);
		}
		const textures: Partial<Record<MaterialTextureSlotKey, string>> = {};
		for (const slot of Object.keys(variant.maps) as MaterialTextureSlotKey[]) textures[slot] = key;
		return Object.keys(textures).length === 0
			? { descriptor: look.material }
			: { descriptor: { ...look.material, textures }, maps: variant.maps };
	}

	return {
		materialFor(surface) {
			const look = lookFor(surface);
			if (look === null) return null;
			const resolved = descriptorFor(look);
			const key = JSON.stringify(resolved.descriptor);
			let lease = leases.get(key);
			if (lease === undefined) {
				lease = input.store.acquire(resolved.descriptor, resolved.maps);
				leases.set(key, lease);
			}
			return lease.material;
		},
		materialKeys() {
			return [...leases.values()].map((lease) => lease.key);
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			for (const lease of leases.values()) lease.release();
			for (const variant of variants.values()) {
				releaseEffectiveVariant(variant.seed, variant.rx, variant.ry, variant.rotation, variant.scope, variant.offset);
			}
			leases.clear();
			variants.clear();
			looks.clear();
		}
	};
}
