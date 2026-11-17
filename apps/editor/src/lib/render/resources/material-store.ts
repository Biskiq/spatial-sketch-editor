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
 * Canvases therefore never share a material — WebGL objects cannot be shared
 * across contexts — and no representation constructs one on its own.
 *
 * The store reads the Gate A record; it does not re-decide it. Gate A's
 * accepted pipeline is `NoToneMapping` at exposure 1.0 with sRGB output and an
 * `srgb-linear` working space, measured on the shared `createManagedWebGLRenderer`
 * factory; per-surface parity is Gate B's. Nothing here sets tone mapping, exposure or an output
 * colour space, so a material built by this store renders under exactly the
 * pipeline Gate A measured. `toneMapped` is a per-material opt-out the record
 * permits — Gate A named `MeshLambertMaterial` with no mapper as the artwork
 * baseline and did not forbid untoned surfaces.
 */
import {
	MeshBasicMaterial,
	MeshDepthMaterial,
	MeshDistanceMaterial,
	MeshLambertMaterial,
	MeshStandardMaterial,
	RGBADepthPacking,
	BasicDepthPacking,
	ShadowMaterial,
	Vector2,
	Vector3,
	type Material,
	type Plane,
	type Texture
} from 'three';
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
	const declared: Readonly<Partial<Record<MaterialTextureSlotKey, string>>> | undefined =
		descriptor.kind === 'standard'
			? descriptor.textures
			: descriptor.kind === 'imported'
				? descriptor.remap?.textures
				: descriptor.kind === 'lambert' || descriptor.kind === 'depth' || descriptor.kind === 'distance'
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
		case 'lambert':
			return new MeshLambertMaterial({
				...(descriptor.color === undefined ? {} : { color: descriptor.color }),
				...(descriptor.transparent === undefined ? {} : { transparent: descriptor.transparent }),
				...(descriptor.opacity === undefined ? {} : { opacity: descriptor.opacity }),
				...(descriptor.depthWrite === undefined ? {} : { depthWrite: descriptor.depthWrite }),
				...(descriptor.vertexColors === undefined ? {} : { vertexColors: descriptor.vertexColors }),
				...(descriptor.fog === false ? { fog: false } : {}),
				...(bound === null ? {} : bound)
			});
		case 'depth':
			return new MeshDepthMaterial({
				depthPacking: descriptor.packing === 'rgba' ? RGBADepthPacking : BasicDepthPacking,
				...(descriptor.alphaTest === undefined ? {} : { alphaTest: descriptor.alphaTest }),
				...(bound === null ? {} : bound)
			});
		case 'distance':
			return new MeshDistanceMaterial({
				...(descriptor.alphaTest === undefined ? {} : { alphaTest: descriptor.alphaTest }),
				...(bound === null ? {} : bound)
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

export type MaterialStoreOptions = {
	/**
	 * The Canvas's slice clipping planes, **shared by reference** by every colour
	 * material.
	 *
	 * The array is assigned, never copied: the Stage clip mutates its `Plane`
	 * instances in place for the Canvas's whole life, so a material holding a clone
	 * would stop following the cut. A descriptor with `clip: false` (the environment
	 * ground) gets `null` instead. Depth and distance materials are untouched — they
	 * realize shadows, which are rendered from the unclipped world (`clipShadows`
	 * stays `false`). Absent means no clipping, which is the Preview Canvas.
	 */
	readonly clippingPlanes?: Plane[];
	/**
	 * The drawn Slice's shared uniforms. Colour materials get the finite-segment
	 * discard patch once, at construction; depth/distance/shadow materials never do,
	 * because shadows are rendered from the unclipped world. Grade and other
	 * `clip: false` surfaces stay unpatched too.
	 */
	readonly sliceClip?: SliceClipUniforms;
};

/**
 * The drawn Slice's GPU predicate, installed once per colour material.
 *
 * SL1 realized a Level cut with two native clipping planes. A drawn cut needs a
 * **finite segment** as well: only the points within the segment's planar extent
 * are cut. Three's plane count is constant, so a second clipping architecture would
 * either recompile on every draw or clip the whole infinite plane. This module keeps
 * SL1's two planes and adds one uniform-driven discard:
 *
 * ```
 * s = dot(p - origin, along)
 * b = dot(p - origin, hiddenNormal)
 * hidden = |s| <= halfLength && (b > 0 || b < -depth)
 * ```
 *
 * The patch is installed when the material is constructed, before its first
 * compile. The mode uniform is `0` for Level/off, so drawing, Flip and depth changes
 * only write uniforms and never change the program. `customProgramCacheKey` includes
 * a fixed tag so the program cache cannot confuse a patched material with its
 * unpatched twin.
 *
 * Depth/distance/shadow materials are deliberately not patched: shadows are rendered
 * from the unclipped world and must stay identical (SL1's `clipShadows: false`).
 */

export type ScalarUniform = { value: number };
export type VectorUniform = { value: Vector3 };

/** The uniform object every patched material shares by reference. */
export type SliceClipUniforms = {
	readonly mode: ScalarUniform;
	readonly origin: VectorUniform;
	readonly normal: VectorUniform;
	readonly along: VectorUniform;
	readonly halfLength: ScalarUniform;
	readonly depth: ScalarUniform;
	/**
	 * The X2 cutaway top: a **live** uniform owned by `StageClip`. Every material
	 * outside the cutaway twin set is bound to {@link NEVER_CUT_UNIFORM} instead,
	 * which is why one program serves both and a cut costs no compile.
	 */
	readonly cutawayTopY: ScalarUniform;
};

/** The fixed suffix on every patched program's cache key. */
export const SLICE_CLIP_PROGRAM_KEY = 'biskiq.slice-clip@2';

/**
 * The height a never-cut material discards above: above every Stage point, so the
 * added fragment test is a no-op for anything outside the cutaway twin set.
 */
export const NEVER_CUT_TOP_Y = 1e6;

/**
 * The one constant uniform every non-twin patched material binds **by reference**.
 *
 * It is created once and never written: a normal surface's binding cannot follow a
 * cut because there is nothing to follow, and a twin writes only its own live
 * `cutawayTopY`.
 */
export const NEVER_CUT_UNIFORM: ScalarUniform = Object.freeze({ value: NEVER_CUT_TOP_Y });

export function createSliceClipUniforms(): SliceClipUniforms {
	return {
		mode: { value: 0 },
		origin: { value: new Vector3(0, 0, 0) },
		normal: { value: new Vector3(0, 1, 0) },
		along: { value: new Vector3(1, 0, 0) },
		halfLength: { value: 0 },
		depth: { value: 0.1 },
		cutawayTopY: { value: NEVER_CUT_TOP_Y }
	};
}

/** Write a resolved reading into the shared uniforms. `null`/Level turns the patch off. */
export type SliceClipSource = {
	readonly origin: readonly [number, number, number];
	readonly hiddenNormal: readonly [number, number, number];
	readonly along: readonly [number, number, number];
	readonly halfLength: number;
	readonly depthMeters: number;
} | null;

/** Write a drawn cut into the shared uniforms. `null` turns the patch off. */
export function writeSliceClipUniforms(
	uniforms: SliceClipUniforms,
	source: SliceClipSource
): void {
	if (source === null) {
		uniforms.mode.value = 0;
		uniforms.halfLength.value = 0;
		return;
	}
	uniforms.mode.value = 1;
	uniforms.origin.value.set(source.origin[0], source.origin[1], source.origin[2]);
	uniforms.normal.value.set(
		source.hiddenNormal[0],
		source.hiddenNormal[1],
		source.hiddenNormal[2]
	);
	uniforms.along.value.set(source.along[0], source.along[1], source.along[2]);
	uniforms.halfLength.value = source.halfLength;
	uniforms.depth.value = source.depthMeters;
}

/** A plain snapshot of the values, for the as-built render's `finally`. */
export function snapshotSliceClipUniforms(uniforms: SliceClipUniforms): {
	readonly mode: number;
	readonly origin: [number, number, number];
	readonly normal: [number, number, number];
	readonly along: [number, number, number];
	readonly halfLength: number;
	readonly depth: number;
	readonly cutawayTopY: number;
} {
	return {
		mode: uniforms.mode.value,
		origin: uniforms.origin.value.toArray() as [number, number, number],
		normal: uniforms.normal.value.toArray() as [number, number, number],
		along: uniforms.along.value.toArray() as [number, number, number],
		halfLength: uniforms.halfLength.value,
		depth: uniforms.depth.value,
		cutawayTopY: uniforms.cutawayTopY.value
	};
}

export function restoreSliceClipUniforms(
	uniforms: SliceClipUniforms,
	state: ReturnType<typeof snapshotSliceClipUniforms>
): void {
	uniforms.mode.value = state.mode;
	uniforms.origin.value.fromArray(state.origin);
	uniforms.normal.value.fromArray(state.normal);
	uniforms.along.value.fromArray(state.along);
	uniforms.halfLength.value = state.halfLength;
	uniforms.depth.value = state.depth;
	uniforms.cutawayTopY.value = state.cutawayTopY;
}

/** A patch is installed once; a second store option must not wrap it twice. */
const PATCHED = Symbol('biskiq.slice-clip-patched');

const VERTEX_DECLARATION = 'varying vec3 vSliceWorldPosition;\n';
const FRAGMENT_DECLARATION = [
	'varying vec3 vSliceWorldPosition;',
	'uniform float uSliceClipMode;',
	'uniform vec3 uSliceClipOrigin;',
	'uniform vec3 uSliceClipNormal;',
	'uniform vec3 uSliceClipAlong;',
	'uniform float uSliceClipHalfLength;',
	'uniform float uSliceClipDepth;',
	'uniform float uCutawayTopY;',
	''
].join('\n');

const VERTEX_SAMPLE = `
#include <project_vertex>
vec4 sliceClipWorld = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
sliceClipWorld = batchingMatrix * sliceClipWorld;
#endif
#ifdef USE_INSTANCING
sliceClipWorld = instanceMatrix * sliceClipWorld;
#endif
vSliceWorldPosition = ( modelMatrix * sliceClipWorld ).xyz;
`;

/**
 * The same varying for a shader with no `project_vertex` chunk — `LineMaterial`, the
 * selection and Lift ink. Every Three vertex shader that clips has `mvPosition` in
 * view space where `clipping_planes_vertex` is included (native planes clip from it),
 * so the world point is recovered there. A fat line's `mvPosition` is its segment
 * endpoint, the same approximation Three's own plane clipping makes for it.
 */
const VERTEX_SAMPLE_FROM_VIEW = `
#include <clipping_planes_vertex>
vSliceWorldPosition = ( inverse( viewMatrix ) * vec4( mvPosition.xyz, 1.0 ) ).xyz;
`;

const FRAGMENT_TEST = `
#include <clipping_planes_fragment>
if ( uSliceClipMode > 0.5 ) {
	vec3 sliceClipRel = vSliceWorldPosition - uSliceClipOrigin;
	float sliceClipS = dot( sliceClipRel, uSliceClipAlong );
	if ( abs( sliceClipS ) <= uSliceClipHalfLength ) {
		float sliceClipB = dot( sliceClipRel, uSliceClipNormal );
		if ( sliceClipB > 0.0 || sliceClipB < -uSliceClipDepth ) discard;
	}
}
if ( vSliceWorldPosition.y > uCutawayTopY ) discard;
`;

/**
 * Install the predicate on a colour material, preserving any compile hook it
 * already had (an imported glTF material may carry one).
 *
 * `options.cutaway` selects the **twin** binding: the fragment test reads the
 * StageClip's live `cutawayTopY` instead of the shared never-cut constant. The
 * shader source and cache key are identical either way, so a twin is the same
 * program as its normal sibling — which is what keeps a cut compile-free.
 *
 * Returns `false` for a shader whose chunk layout this patch does not recognize;
 * the material is left untouched rather than half-patched. The store treats that as
 * a diagnostic, not a reason to add a fallback clipping path.
 */
export function applySliceClipShader(
	material: Material,
	uniforms: SliceClipUniforms,
	options: { readonly cutaway?: boolean } = {}
): boolean {
	const target = material as Material & { [PATCHED]?: boolean };
	if (target[PATCHED] === true) return true;
	const baseCompile = material.onBeforeCompile;
	const baseKey = material.customProgramCacheKey();
	const cutawayTop = options.cutaway === true ? uniforms.cutawayTopY : NEVER_CUT_UNIFORM;
	material.onBeforeCompile = function (shader, renderer) {
		baseCompile.call(this, shader, renderer);
		const world = shader.vertexShader.includes('#include <project_vertex>');
		const view = !world && shader.vertexShader.includes('#include <clipping_planes_vertex>');
		if ((!world && !view) || !shader.fragmentShader.includes('#include <clipping_planes_fragment>')) {
			return;
		}
		shader.uniforms.uSliceClipMode = uniforms.mode;
		shader.uniforms.uSliceClipOrigin = uniforms.origin;
		shader.uniforms.uSliceClipNormal = uniforms.normal;
		shader.uniforms.uSliceClipAlong = uniforms.along;
		shader.uniforms.uSliceClipHalfLength = uniforms.halfLength;
		shader.uniforms.uSliceClipDepth = uniforms.depth;
		shader.uniforms.uCutawayTopY = cutawayTop;
		shader.vertexShader =
			VERTEX_DECLARATION +
			(world
				? shader.vertexShader.replace('#include <project_vertex>', VERTEX_SAMPLE)
				: shader.vertexShader.replace('#include <clipping_planes_vertex>', VERTEX_SAMPLE_FROM_VIEW));
		shader.fragmentShader =
			FRAGMENT_DECLARATION +
			shader.fragmentShader.replace('#include <clipping_planes_fragment>', FRAGMENT_TEST);
	};
	material.customProgramCacheKey = function () {
		return `${baseKey}|${SLICE_CLIP_PROGRAM_KEY}`;
	};
	// A store material compiles on its first draw, after this call; no `needsUpdate`
	// is needed, and setting it would only mark a fresh material dirty.
	target[PATCHED] = true;
	return true;
}

/** Whether this material carries the patch (diagnostics/tests). */
export function hasSliceClipShader(material: Material): boolean {
	return (material as Material & { [PATCHED]?: boolean })[PATCHED] === true;
}


/** Whether this descriptor's material takes the Canvas's clipping planes. */
function clipsWithStore(descriptor: MaterialDescriptor): boolean {
	if (descriptor.kind === 'depth' || descriptor.kind === 'distance' || descriptor.kind === 'shadow') return false;
	return !('clip' in descriptor && descriptor.clip === false);
}

export function createMaterialStore(options: MaterialStoreOptions = {}): MaterialStore {
	const entries = new Map<string, Entry>();
	let created = 0;
	let disposedCount = 0;
	let acquired = 0;
	let treated = 0;
	let treatmentSkipped = 0;
	let disposed = false;

	return {
		acquire(descriptor, maps, source) {
			if (disposed) throw new Error('the material store has been disposed');
			const key = materialKey(descriptor);
			let entry = entries.get(key);
			if (entry === undefined) {
				const material = construct(descriptor, maps, source);
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
				if (clips && options.sliceClip !== undefined) {
					applySliceClipShader(material, options.sliceClip, {
						cutaway: 'cutaway' in descriptor && descriptor.cutaway === true
					});
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
			return entries.get(materialKey(descriptor))?.material ?? null;
		},

		stats() {
			return {
				live: entries.size,
				created,
				disposed: disposedCount,
				acquired,
				treated,
				treatmentSkipped
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
