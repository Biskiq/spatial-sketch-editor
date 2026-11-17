import { getMaterial } from '$lib/content/materials';
import { applyTreatment } from '$lib/render/materials/treatment';
import type { WallMeshMaterialFactory } from '$lib/render/wall-geometry-adapter';
import type { MaterialStore } from '$lib/render/resources/material-store';
import type {
	MaterialTreatment,
	StandardMaterialDescriptor
} from '$lib/render/resources/material-descriptor';

/**
 * Imperative visitor wall-material factory — the Wall surface's descriptor.
 *
 * Builds the `textures="off"` plain-tint wall surface the Layout shell draws:
 * `plaster-warm` roughness/metalness + the room's tint, with no
 * texture maps. Materials are acquired by descriptor from the shared
 * `MaterialStore`, so two surfaces with the same tint share one instance and a
 * compile constructs none.
 *
 * Wall textures stay off (pixel parity). Tile repeat is a material-side concern
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
	emissiveIntensity = 0,
	/** The World's resolve-time Treatment; Natural is absent and changes nothing. */
	treatment: MaterialTreatment | undefined = undefined,
	/**
	 * Build X2's cutaway twins instead of the normal surface. The descriptor only
	 * carries the flag: the surface, rough/metal/emissive values and lease sharing
	 * are identical, and the store binds the twin to the StageClip's live top.
	 */
	options: { readonly cutaway?: true } = {}
): {
	factory: WallMeshMaterialFactory;
	dispose: () => void;
} {
	const definition = getMaterial('plaster-warm');
	const leases = new Map<string, ReturnType<MaterialStore['acquire']>>();

	function leaseForTint(tint: string) {
		let lease = leases.get(tint);
		if (!lease) {
			const treated = applyTreatment(treatment, {
				color: tint,
				roughness: definition.roughness,
				metalness: definition.metalness,
				slotUris: {},
				normalScale: null
			});
			const descriptor: StandardMaterialDescriptor = {
				kind: 'standard',
				color: treated.color,
				roughness: treated.roughness,
				metalness: treated.metalness,
				emissive: treated.color,
				emissiveIntensity,
				toneMapped: emissiveIntensity === 0,
				...(options.cutaway === true ? { cutaway: true as const } : {})
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
