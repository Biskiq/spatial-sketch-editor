import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import {
	acquireEffectiveVariant,
	releaseEffectiveVariant,
	type TextureLoadScope,
	type TextureScopeKey
} from '../materials/texture-cache';
import type { EffectiveSceneMaterial } from '../materials/scene-instance-material';

export type RemapKey = { seed: string; rx: number; ry: number; rot: number; scopeId?: string | null };

/**
 * Replaces every Mesh's material in `scene` with a fresh `MeshStandardMaterial`
 * populated from `effective` and the shared cache. Each fresh material
 * references the same ref-counted texture maps; one acquire per call, one
 * release. The userData['museumEffectiveSeed'] is set for diagnostic.
 *
 * P22.1: accepts an optional release scope so a texture override on a built-in
 * model resolves through the supplied release loader with scoped cache keys.
 * Omit the scope to keep the legacy global-loader behavior.
 */
export function remapModelMaterials(
	scene: Object3D,
	effective: EffectiveSceneMaterial,
	repeat: [number, number],
	scope?: TextureLoadScope | null
): { acquiredKey: RemapKey } {
	const [rx, ry] = repeat;
	const maps = acquireEffectiveVariant(effective, rx, ry, 0, scope ?? null);

	scene.traverse((object) => {
		if (!(object instanceof Mesh)) return;
		const params: ConstructorParameters<typeof MeshStandardMaterial>[0] = {
			color: effective.color,
			roughness: effective.roughness,
			metalness: effective.metalness
		};
		if (maps.map) params.map = maps.map;
		if (maps.normalMap) params.normalMap = maps.normalMap;
		if (maps.roughnessMap) params.roughnessMap = maps.roughnessMap;
		if (maps.aoMap) params.aoMap = maps.aoMap;
		if (maps.metalnessMap) params.metalnessMap = maps.metalnessMap;
		const material = new MeshStandardMaterial(params);
		material.userData['museumEffectiveSeed'] = effective.variantSeed;
		object.material = material;
	});

	return {
		acquiredKey: { seed: effective.variantSeed, rx, ry, rot: 0, scopeId: scope?.scopeId ?? null }
	};
}

export function releaseModelMaterialRemap(
	key: RemapKey,
	scope?: TextureLoadScope | TextureScopeKey | null
): void {
	// Release needs only the cache namespace: prefer the explicit scope, else
	// the scopeId retained on the key. Neither path loads.
	releaseEffectiveVariant(key.seed, key.rx, key.ry, key.rot, scope ?? (key.scopeId ? { scopeId: key.scopeId } : null));
}
