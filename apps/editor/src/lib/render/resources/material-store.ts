/**
 * E6/R2a — the material store: the one factory for world surfaces.
 *
 * `renderer-refactor.md` §2.4 makes this module the only place a world material
 * is constructed. A descriptor — plain data — is canonicalised to one key, and
 * equal keys share one instance. The store counts references and disposes a
 * material when its last lease is released, so no consumer can free a resource
 * another consumer is still drawing.
 *
 * Ownership is per renderer, as §2.4 requires: the Layout shell creates one
 * store for its Canvas subtree, hands it to the Wall, object and Room
 * representations, and disposes it after them. Two Canvases therefore never
 * share a material — WebGL objects cannot be shared across contexts — and no
 * representation constructs one on its own.
 *
 * The store reads the T2.S0 Gate A record; it does not re-decide it. Gate A's
 * accepted pipeline is `NoToneMapping` at exposure 1.0 with sRGB output and an
 * `srgb-linear` working space, owned by `createManagedWebGLRenderer` (E1 captured
 * that shared factory). Nothing here sets tone mapping, exposure or an output
 * colour space, so a material built by this store renders under exactly the
 * pipeline Gate A measured. `toneMapped` is a per-material opt-out the record
 * permits — Gate A named `MeshLambertMaterial` with no mapper as the artwork
 * baseline and did not forbid untoned surfaces.
 */
import {
	MeshBasicMaterial,
	MeshStandardMaterial,
	ShadowMaterial,
	type Material,
	type Texture
} from 'three';
import {
	MATERIAL_TEXTURE_SLOTS,
	materialKey,
	type ImportedMaterialDescriptor,
	type MaterialDescriptor,
	type MaterialTextureSlotKey
} from './material-descriptor';

/**
 * The loaded variants a textured descriptor binds, by slot.
 *
 * Maps travel beside the descriptor rather than inside it: the descriptor is
 * plain portable data and the key only records the variant identity. The store
 * refuses a key whose declared slots do not all arrive, because a material whose
 * key names a texture and whose instance has none is exactly the silent drift
 * this factory exists to prevent.
 */
export type MaterialTextureMaps = Readonly<Partial<Record<MaterialTextureSlotKey, Texture>>>;

/**
 * One claim on a shared material. `release` is idempotent and, once the last
 * lease is gone, disposes the instance; a consumer that releases cannot free a
 * lease another consumer still holds.
 */
export type MaterialLease = {
	/** The canonical key this lease was taken under. */
	readonly key: string;
	readonly material: Material;
	/** Give the claim back. Safe to call once or many times. */
	release(): void;
};

export type MaterialStoreStats = {
	/** Materials held now (a reference count above zero). */
	readonly live: number;
	/** Materials this store has constructed, monotone. */
	readonly created: number;
	/** Materials this store has disposed, monotone. */
	readonly disposed: number;
	/** Leases taken, monotone. */
	readonly acquired: number;
};

export type MaterialStore = {
	/**
	 * The shared instance for `descriptor`, and a lease on it.
	 *
	 * `maps` supplies the loaded variants for every slot the descriptor names; a
	 * descriptor with no `textures` needs none. Equal descriptors share one
	 * instance, so two surfaces drawing the same look hold two leases on one
	 * material.
	 *
	 * An `imported` descriptor without a `remap` is built from `source`: the store
	 * clones the asset's own material once, the first time the key is acquired, and
	 * owns the clone thereafter. `source` is never retained and never disposed by
	 * the store, so the loader's cached asset stays intact for the next instance.
	 */
	acquire(descriptor: MaterialDescriptor, maps?: MaterialTextureMaps, source?: Material): MaterialLease;
	/** The live instance for `descriptor`, or null. Takes no lease; for reads and tests. */
	peek(descriptor: MaterialDescriptor): Material | null;
	stats(): MaterialStoreStats;
	/** Release everything still held and refuse further acquires. Idempotent. */
	dispose(): void;
};

type Entry = {
	readonly descriptor: MaterialDescriptor;
	readonly material: Material;
	refCount: number;
};

/** The maps a textured descriptor declares, or a refusal naming the missing slot. */
function boundMaps(
	descriptor: MaterialDescriptor,
	maps: MaterialTextureMaps | undefined
): Partial<Record<MaterialTextureSlotKey, Texture>> | null {
	const declared =
		descriptor.kind === 'standard'
			? descriptor.textures
			: descriptor.kind === 'imported'
				? descriptor.remap?.textures
				: undefined;
	if (declared === undefined) return null;
	const bound: Partial<Record<MaterialTextureSlotKey, Texture>> = {};
	for (const slot of MATERIAL_TEXTURE_SLOTS) {
		if (declared[slot] === undefined) continue;
		const map = maps?.[slot];
		if (map === undefined) {
			throw new Error(`material descriptor binds "${slot}" but no texture was supplied`);
		}
		bound[slot] = map;
	}
	return bound;
}

/**
 * An imported surface. A remap is an ordinary standard look (built by the same
 * constructor every other world surface uses); without one the asset's own
 * material is cloned, so the store owns a copy and the loader's source is never
 * the thing this store disposes.
 */
function constructImported(
	descriptor: ImportedMaterialDescriptor,
	maps: MaterialTextureMaps | undefined,
	source: Material | undefined
): Material {
	if (descriptor.remap !== undefined) {
		return construct({ kind: 'standard', ...descriptor.remap, wireframe: descriptor.wireframe }, maps);
	}
	if (source === undefined) {
		throw new Error(
			`imported material ${descriptor.asset} mesh ${descriptor.mesh} slot ${descriptor.slot} needs its source material`
		);
	}
	// The descriptor's wireframe always wins: an explicit false overrides a source
	// whose own material draws wireframe, and the source is never mutated.
	const clone = source.clone();
	if ('wireframe' in clone) (clone as Material & { wireframe: boolean }).wireframe = descriptor.wireframe;
	return clone;
}

function construct(
	descriptor: MaterialDescriptor,
	maps: MaterialTextureMaps | undefined,
	source?: Material
): Material {
	if (descriptor.kind === 'imported') return constructImported(descriptor, maps, source);
	const bound = boundMaps(descriptor, maps);
	switch (descriptor.kind) {
		case 'standard':
			return new MeshStandardMaterial({
				color: descriptor.color,
				roughness: descriptor.roughness,
				metalness: descriptor.metalness,
				// Three's own defaults for the rest: an unset emissive is black and
				// an unset intensity is 1, so passing them only when named keeps the
				// constructed material equal to the descriptor's key.
				...(descriptor.emissive === undefined ? {} : { emissive: descriptor.emissive }),
				...(descriptor.emissiveIntensity === undefined
					? {}
					: { emissiveIntensity: descriptor.emissiveIntensity }),
				...(descriptor.toneMapped === undefined ? {} : { toneMapped: descriptor.toneMapped }),
				...(descriptor.wireframe === undefined ? {} : { wireframe: descriptor.wireframe }),
				...(bound === null ? {} : bound)
			});
		case 'basic':
			return new MeshBasicMaterial({
				color: descriptor.color,
				...(descriptor.wireframe === undefined ? {} : { wireframe: descriptor.wireframe }),
				...(descriptor.toneMapped === undefined ? {} : { toneMapped: descriptor.toneMapped })
			});
		case 'shadow':
			return new ShadowMaterial({
				...(descriptor.opacity === undefined ? {} : { opacity: descriptor.opacity }),
				...(descriptor.depthWrite === undefined ? {} : { depthWrite: descriptor.depthWrite }),
				...(descriptor.polygonOffset === undefined ? {} : { polygonOffset: descriptor.polygonOffset }),
				...(descriptor.polygonOffsetFactor === undefined
					? {}
					: { polygonOffsetFactor: descriptor.polygonOffsetFactor }),
				...(descriptor.polygonOffsetUnits === undefined
					? {}
					: { polygonOffsetUnits: descriptor.polygonOffsetUnits })
			});
	}
}

export function createMaterialStore(): MaterialStore {
	const entries = new Map<string, Entry>();
	let created = 0;
	let disposedCount = 0;
	let acquired = 0;
	let disposed = false;

	return {
		acquire(descriptor, maps, source) {
			if (disposed) throw new Error('the material store has been disposed');
			const key = materialKey(descriptor);
			let entry = entries.get(key);
			if (entry === undefined) {
				entry = { descriptor, material: construct(descriptor, maps, source), refCount: 0 };
				entries.set(key, entry);
				created += 1;
			}
			entry.refCount += 1;
			acquired += 1;
			const held = entry;
			let released = false;
			return {
				key,
				material: held.material,
				release() {
					if (released) return;
					released = true;
					if (disposed) return;
					held.refCount -= 1;
					if (held.refCount > 0) return;
					entries.delete(key);
					held.material.dispose();
					disposedCount += 1;
				}
			};
		},

		peek(descriptor) {
			return entries.get(materialKey(descriptor))?.material ?? null;
		},

		stats() {
			return { live: entries.size, created, disposed: disposedCount, acquired };
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			for (const entry of entries.values()) {
				entry.material.dispose();
				disposedCount += 1;
			}
			entries.clear();
		}
	};
}
