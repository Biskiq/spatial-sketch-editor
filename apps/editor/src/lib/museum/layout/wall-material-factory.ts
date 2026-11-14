import { getMaterial } from '$lib/content/materials';
import type { WallMeshMaterialFactory } from '$lib/render/wall-geometry-adapter';
import type { MaterialStore } from '$lib/render/resources/material-store';
import type { StandardMaterialDescriptor } from '$lib/render/resources/material-descriptor';

/**
 * Imperative visitor wall-material factory — the Wall surface's descriptor.
 *
 * Reproduces the `textures="off"` plain-tint wall surface the Layout shell has
 * always drawn: `plaster-warm` roughness/metalness + the room's tint, with no
 * texture maps. Materials are acquired by descriptor from the shared
 * `MaterialStore`, so two surfaces with the same tint share one instance and a
 * compile constructs none.
 *
 * Textures stay off in G4 (pixel parity). Tile repeat is a material-side concern
 * that applies only once textures turn on — the builder emits raw metric UVs and
 * this factory owns no repeat today.
 *
 * The returned `factory` deliberately omits `release` on every resolved
 * material: the leases are owned by this closure, so the adapter must not
 * release a shared entry. `dispose()` gives every lease back when the
 * representation unmounts.
 */
export function createVisitorWallMaterialFactory(
	store: MaterialStore,
	resolveTint: (roomId: string) => string,
	/**
	 * How much of the tint a surface shows unlit, so it holds under dim lights.
	 * Above zero the tint is also left untoned: AgX greys a pale colour.
	 */
	emissiveIntensity = 0
): {
	factory: WallMeshMaterialFactory;
	dispose: () => void;
} {
	const definition = getMaterial('plaster-warm');
	const leases = new Map<string, ReturnType<MaterialStore['acquire']>>();

	function leaseForTint(tint: string) {
		let lease = leases.get(tint);
		if (!lease) {
			const descriptor: StandardMaterialDescriptor = {
				kind: 'standard',
				color: tint,
				roughness: definition.roughness,
				metalness: definition.metalness,
				emissive: tint,
				emissiveIntensity,
				toneMapped: emissiveIntensity === 0
			};
			lease = store.acquire(descriptor);
			leases.set(tint, lease);
		}
		return lease;
	}

	const factory: WallMeshMaterialFactory = (_surfaceKey, mesh) => {
		// No `release` lease: the closure owns these store leases.
		return { material: leaseForTint(resolveTint(mesh.roomId)).material };
	};

	return {
		factory,
		dispose: () => {
			for (const lease of leases.values()) lease.release();
			leases.clear();
		}
	};
}
