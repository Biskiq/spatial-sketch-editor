/**
 * The material store: the one factory for world surfaces.
 *
 * The rendering contract makes this module the only place a world material
 * is constructed. A descriptor — plain data — is canonicalised to one key, and
 * equal keys share one instance. The store counts references and disposes a
 * material when its last lease is released, so no consumer can free a resource
 * another consumer is still drawing.
 *
 * Ownership is per renderer, as §2.4 requires: the Canvas host creates one
 * store through `provideRenderResources` (`render-resources.ts`), the Layout and
 * Scene representations lease from it, and the host disposes it after them. Two
 * Canvases therefore never share a material — a material's GPU resources belong
 * to one context — and no representation constructs one on its own.
 *
 * Materials are realized with Three's standard classes. r187's
 * `StandardNodeLibrary` maps each one to its node implementation and copies the
 * supported properties, so a `MeshStandardMaterial`, `MeshLambertMaterial`,
 * `MeshBasicMaterial` or `ShadowMaterial` built here renders on both the native
 * WebGPU and WebGL2 backends without a second factory. Node hooks are attached
 * only where a look needs them (the Stage's clip mask, Artwork's shadow mask).
 *
 * The store reads the Gate A record; it does not re-decide it. Gate A's
 * accepted pipeline is `NoToneMapping` at exposure 1.0 with sRGB output and an
 * `srgb-linear` working space, named by the shared renderer factory; per-surface
 * parity is Gate B's. Nothing here sets tone mapping, exposure or an output
 * colour space, so a material built by this store renders under exactly the
 * pipeline Gate A measured. `toneMapped` is a per-material opt-out the record
 * permits — Gate A named `MeshLambertMaterial` with no mapper as the artwork
 * baseline and did not forbid untoned surfaces.
 */
import {
	MeshBasicMaterial,
	MeshLambertMaterial,
	MeshStandardMaterial,
	ShadowMaterial,
	Vector2,
	type Material,
	type Plane,
	type Texture
} from 'three';
import { reference } from 'three/tsl';
import type { SliceClipMasks } from '$lib/render/clip/slice-clip-mask';
import {
	CLAY_COLOR,
	CLAY_ROUGHNESS,
	FLAT_MIN_ROUGHNESS,
	MATERIAL_TEXTURE_SLOTS,
	materialKey,
	type ImportedMaterialDescriptor,
	type MaterialDescriptor,
	type MaterialTextureSlotKey,
	type MaterialTreatment
} from './material-descriptor';
import {
	createFinishMaterial,
	missingFinishViews,
	type FinishTextureViews
} from './finish-sampling';

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
	/** Imported materials built with a Treatment, monotone. */
	readonly treated: number;
	/** Imported materials left as authored because their class cannot take one. */
	readonly treatmentSkipped: number;
	/** Sampled node materials constructed from a Finish plan, monotone. */
	readonly sampled: number;
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
	acquire(
		descriptor: MaterialDescriptor,
		maps?: MaterialTextureMaps,
		source?: Material,
		/** The GPU views a sampled descriptor's plan names, by view key. */
		views?: FinishTextureViews
	): MaterialLease;
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
/** The GPU views are part of store identity: a scope swap must not reuse old bytes. */
function viewSignature(views: FinishTextureViews | undefined): string {
	if (views === undefined) return '';
	return Object.keys(views)
		.sort()
		.map((key) => `${key}:${views[key].uuid}`)
		.join(',');
}

function boundMaps(
	descriptor: MaterialDescriptor,
	maps: MaterialTextureMaps | undefined
): Partial<Record<MaterialTextureSlotKey, Texture>> | null {
	const declared: Readonly<Partial<Record<MaterialTextureSlotKey, string>>> | undefined =
		descriptor.kind === 'standard'
			? descriptor.textures
			: descriptor.kind === 'imported'
				? descriptor.remap?.textures
				: descriptor.kind === 'lambert'
					? descriptor.map === undefined
						? undefined
						: { map: descriptor.map }
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
	source: Material | undefined,
	views: FinishTextureViews | undefined
): Material {
	if (descriptor.remap !== undefined) {
		return construct(
			{ kind: 'standard', ...descriptor.remap, wireframe: descriptor.wireframe },
			maps,
			undefined,
			views
		);
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

/**
 * Tune one cloned imported material for a Treatment, in place. Only the fields a
 * stylised surface owns change: colour, roughness, metalness and, when it cannot
 * carry alpha, the base colour map. Transparency, opacity, alpha test, side,
 * depth flags, vertex colours, other maps and skinning survive untouched, so an
 * alpha-masked silhouette is exactly as authored.
 *
 * A material class that has no colour (Shader, RawShader, Normal, Matcap) is
 * unsupported and left as authored; the store counts it.
 */
/** Appearance maps a neutral Treatment suppresses. Geometry and alpha maps are not here. */
const APPEARANCE_MAPS = [
	'normalMap',
	'bumpMap',
	'roughnessMap',
	'metalnessMap',
	'aoMap',
	'emissiveMap',
	'lightMap',
	'specularMap',
	'specularColorMap',
	'specularIntensityMap',
	'clearcoatMap',
	'clearcoatNormalMap',
	'clearcoatRoughnessMap',
	'sheenColorMap',
	'sheenRoughnessMap',
	'transmissionMap',
	'thicknessMap',
	'iridescenceMap',
	'iridescenceThicknessMap',
	'anisotropyMap'
] as const;

function tuneImported(material: Material, treatment: MaterialTreatment): boolean {
	if (!('color' in material)) return false;
	const target = material as Material & {
		color: { set(value: string): void };
		roughness?: number;
		metalness?: number;
		map?: Texture | null;
		alphaMap?: Texture | null;
		alphaTest?: number;
		transparent?: boolean;
		emissive?: { set(value: number): void };
		emissiveIntensity?: number;
	};
	if (treatment === 'clay') {
		target.color.set(CLAY_COLOR);
		if (typeof target.roughness === 'number') target.roughness = CLAY_ROUGHNESS;
	} else if (typeof target.roughness === 'number') {
		target.roughness = Math.max(target.roughness, FLAT_MIN_ROUGHNESS);
	}
	if (typeof target.metalness === 'number') target.metalness = 0;
	if (target.emissive !== undefined) target.emissive.set(0x000000);
	if (typeof target.emissiveIntensity === 'number') target.emissiveIntensity = 0;

	// A stylised surface is not a textured one. Only maps that carry geometry or
	// alpha survive: displacement moves the silhouette, alphaMap and a base colour
	// map that carries alphaTest/transparency keep the mask. Everything else is an
	// appearance channel this Treatment replaces.
	for (const key of APPEARANCE_MAPS) {
		if (key in target) (target as unknown as Record<string, unknown>)[key] = null;
	}
	if (
		target.map !== undefined &&
		target.map !== null &&
		(target.alphaTest ?? 0) === 0 &&
		target.transparent !== true
	) {
		target.map = null;
	}
	return true;
}

function construct(
	descriptor: MaterialDescriptor,
	maps: MaterialTextureMaps | undefined,
	source?: Material,
	views?: FinishTextureViews
): Material {
	if (descriptor.kind === 'imported') return constructImported(descriptor, maps, source, views);
	const bound = boundMaps(descriptor, maps);
	switch (descriptor.kind) {
		case 'standard':
			if (descriptor.finish !== undefined) {
				// The sampled path: one node material reads the plan's views. The stock
				// map slots stay empty, so no second multiply or decode can occur.
				const missing = missingFinishViews(descriptor, views);
				if (missing.length > 0) {
					throw new Error(
						`material descriptor names finish view(s) without one: ${missing.join(', ')}`
					);
				}
				if (views === undefined) {
					throw new Error('a sampled finish descriptor needs its GPU views');
				}
				return createFinishMaterial(descriptor, views);
			}
			return new MeshStandardMaterial({
				color: descriptor.color,
				...(descriptor.polygonOffset ? {
					polygonOffset: true,
					polygonOffsetFactor: descriptor.polygonOffset[0],
					polygonOffsetUnits: descriptor.polygonOffset[1]
				} : {}),
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
				...(descriptor.normalScale === undefined
					? {}
					: { normalScale: new Vector2(descriptor.normalScale[0], descriptor.normalScale[1]) }),
				...(bound === null ? {} : bound)
			});
		case 'basic':
			return new MeshBasicMaterial({
				color: descriptor.color,
				...(descriptor.wireframe === undefined ? {} : { wireframe: descriptor.wireframe }),
				...(descriptor.toneMapped === undefined ? {} : { toneMapped: descriptor.toneMapped }),
				...(descriptor.vertexColors === undefined ? {} : { vertexColors: descriptor.vertexColors }),
				...(descriptor.depthWrite === undefined ? {} : { depthWrite: descriptor.depthWrite })
			});
		case 'lambert': {
			const material = new MeshLambertMaterial({
				...(descriptor.color === undefined ? {} : { color: descriptor.color }),
				...(descriptor.transparent === undefined ? {} : { transparent: descriptor.transparent }),
				...(descriptor.opacity === undefined ? {} : { opacity: descriptor.opacity }),
				...(descriptor.depthWrite === undefined ? {} : { depthWrite: descriptor.depthWrite }),
				...(descriptor.vertexColors === undefined ? {} : { vertexColors: descriptor.vertexColors }),
				...(descriptor.fog === false ? { fog: false } : {}),
				...(bound === null ? {} : bound)
			});
			if (descriptor.shadowAlpha !== undefined) {
				// The shadow-pass mask reads the material's own map, exactly as r187's
				// own shadow path does, so the silhouette follows the bound texture without
				// a second material or a custom depth/distance attachment.
				// The reference node's shader type is a texture; its `.a` channel is the
				// map's alpha, exactly as r187's own shadow path reads it.
				const mapReference = reference('map', 'texture', material) as unknown as {
					a: { greaterThan(value: number): unknown };
				};
				(material as Material & { maskShadowNode?: unknown }).maskShadowNode =
					mapReference.a.greaterThan(descriptor.shadowAlpha);
			}
			return material;
		}
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

export type MaterialStoreOptions = {
	/**
	 * The Canvas's slice clipping planes, **shared by reference** by every colour
	 * material.
	 *
	 * The array is assigned, never copied: the Stage clip mutates its `Plane`
	 * instances in place for the Canvas's whole life, so a material holding a clone
	 * would stop following the cut. A descriptor with `clip: false` (the environment
	 * ground) gets `null` instead. Absent means no clipping, which is the Visitor
	 * Preview Canvas.
	 */
	readonly clippingPlanes?: Plane[];
	/**
	 * The Stage's one TSL clip predicate, supplied by `StageClip`.
	 *
	 * A colour material receives the mask once, at construction, as `maskNode` plus
	 * its pass-through shadow mask; shadow-only and `clip: false` surfaces never get
	 * one, because shadows are rendered from the unclipped world and the environment
	 * ground is not part of the cut. The Visitor Preview passes nothing, so its
	 * materials carry no clip graph at all.
	 */
	readonly clipMasks?: MaterialClipMasks;
};

/** The masks one material carries, by cutaway binding. */
export type MaterialClipMasks = (cutaway: boolean) => SliceClipMasks | null;

/** Whether this descriptor's material takes the Canvas's clipping planes. */
function clipsWithStore(descriptor: MaterialDescriptor): boolean {
	// Shadow-only surfaces realize the shadow catcher; they are never part of the
	// clipped world.
	if (descriptor.kind === 'shadow') return false;
	return !('clip' in descriptor && descriptor.clip === false);
}

export function createMaterialStore(options: MaterialStoreOptions = {}): MaterialStore {
	const entries = new Map<string, Entry>();
	let created = 0;
	let disposedCount = 0;
	let acquired = 0;
	let treated = 0;
	let treatmentSkipped = 0;
	let sampled = 0;
	let disposed = false;

	return {
		acquire(descriptor, maps, source, views) {
			if (disposed) throw new Error('the material store has been disposed');
			const canonical = materialKey(descriptor);
			const key =
				descriptor.kind === 'standard' && descriptor.finish !== undefined
					? `${canonical}|views=${viewSignature(views)}`
					: canonical;
			let entry = entries.get(key);
			if (entry === undefined) {
				const material = construct(descriptor, maps, source, views);
				if (descriptor.kind === 'standard' && descriptor.finish !== undefined) sampled += 1;
				if (
					descriptor.kind === 'imported' &&
					descriptor.remap === undefined &&
					descriptor.treatment !== undefined
				) {
					if (tuneImported(material, descriptor.treatment)) treated += 1;
					else treatmentSkipped += 1;
				}
				// **After** any `source.clone()`: `Material.copy` clones each plane into a
				// new array, so a material cloned by the imported path would otherwise
				// keep a detached copy that never follows the cut.
				const clips = clipsWithStore(descriptor);
				if (options.clippingPlanes !== undefined) {
					material.clippingPlanes = clips ? options.clippingPlanes : null;
				}
				if (clips && options.clipMasks !== undefined) {
					const masks = options.clipMasks('cutaway' in descriptor && descriptor.cutaway === true);
					if (masks !== null) {
						// One node graph per material, shared with every equal look. The
						// renderer reads it as the colour-pass predicate and uses the
						// pass-through mask during a shadow pass, so shadows stay unclipped.
						const target = material as Material & { maskNode?: unknown; maskShadowNode?: unknown };
						target.maskNode = masks.colour;
						target.maskShadowNode = masks.shadow;
					}
				}
				entry = { descriptor, material, refCount: 0 };
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
			const canonical = materialKey(descriptor);
			const exact = entries.get(canonical);
			if (exact !== undefined) return exact.material;
			if (descriptor.kind === 'standard' && descriptor.finish !== undefined) {
				const prefix = `${canonical}|views=`;
				for (const [key, entry] of entries) if (key.startsWith(prefix)) return entry.material;
			}
			return null;
		},

		stats() {
			return {
				live: entries.size,
				created,
				disposed: disposedCount,
				acquired,
				treated,
				treatmentSkipped,
				sampled
			};
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
