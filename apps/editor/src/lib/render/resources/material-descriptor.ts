/**
 * E6/R2a — the material descriptor: plain data, one canonical key.
 *
 * A descriptor says **what a world surface looks like**, never how to build it.
 * It is the portability seam `renderer-refactor.md` §2.4 names: the material
 * store turns one into a Three material today, and a future node-material
 * backend replaces that construction step and nothing above it.
 *
 * This module is deliberately dependency-free — no Three, no Svelte, no content
 * catalogue, no authored-unit reader. `render-layer-boundary` asserts that, and
 * `material-factory-boundary` asserts the constructors live only in the store.
 *
 * ## The key
 *
 * `materialKey` serialises a descriptor in a fixed field order with every
 * omitted field normalised to the value the constructor would have used. Two
 * things follow, and both are tested:
 *
 * - **Order-independent.** The key is built from named fields in a fixed order,
 *   so two descriptors with the same values in a different property order are
 *   the same key.
 * - **Default-equivalent.** `toneMapped` absent and `toneMapped: true` are the
 *   same key, because they are the same material. A key that told them apart
 *   would hand one look two instances, which is the defect this store removes.
 *
 * Colours are normalised to lowercase `#rrggbb`. A numeric `0xff2fd4` and the
 * string `'#ff2fd4'` produce one key for the same colour. Only those two forms
 * are accepted: every call site in this repository writes one of them, and a
 * silent fallback for a third spelling is how a key stops being a proof.
 */

/** A colour as Three accepts it at the constructor: a packed RGB number or `#rgb`/`#rrggbb`. */
export type MaterialColor = number | string;

/**
 * The texture slots a world surface may bind, in the one order every key uses.
 *
 * This is the same five slots the authored material catalogue names; the union
 * lives here so a descriptor can carry texture identity without importing a
 * content module (this module has no imports at all, by design).
 */
export type MaterialTextureSlotKey =
	| 'map'
	| 'normalMap'
	| 'roughnessMap'
	| 'aoMap'
	| 'metalnessMap';

export const MATERIAL_TEXTURE_SLOTS: readonly MaterialTextureSlotKey[] = [
	'map',
	'normalMap',
	'roughnessMap',
	'aoMap',
	'metalnessMap'
];

/**
 * One texture-variant identity per bound slot. The value is the variant key the
 * texture store issued — plain text, so two looks that bind the same loaded
 * variant produce the same material key.
 */
export type MaterialTextureKeys = Readonly<Partial<Record<MaterialTextureSlotKey, string>>>;

export type StandardMaterialDescriptor = {
	readonly kind: 'standard';
	readonly color: MaterialColor;
	readonly roughness: number;
	readonly metalness: number;
	/** Emitted colour; absent means black, as the constructor does. */
	readonly emissive?: MaterialColor;
	/** How much of `emissive` shows unlit; absent means 1. */
	readonly emissiveIntensity?: number;
	/** Absent means `true`, as Three's default. */
	readonly toneMapped?: boolean;
	/** Absent means `false`, as Three's default. */
	readonly wireframe?: boolean;
	/**
	 * Bound texture variants by slot; absent means an untextured surface. A
	 * descriptor that names a slot is constructed with that slot's maps, so an
	 * untextured acquire can never stand in for a textured key.
	 */
	readonly textures?: MaterialTextureKeys;
};

export type BasicMaterialDescriptor = {
	readonly kind: 'basic';
	readonly color: MaterialColor;
	readonly wireframe?: boolean;
	readonly toneMapped?: boolean;
	/** Absent means `false`: the geometry's colour attribute is ignored. */
	readonly vertexColors?: boolean;
	/** Absent means `true`, as Three's default. */
	readonly depthWrite?: boolean;
};

/**
 * A Lambert surface (E9/R2c). Gate A names `MeshLambertMaterial` as the approved
 * artwork baseline; the environment ground uses it too.
 *
 * `map` is the identity of the one loaded texture the surface binds, never a
 * texture object: an artwork names its decoded image by the texture's own id, so
 * equal images share one material and a replaced source cannot reuse a material
 * that still binds the old texture.
 */
export type LambertMaterialDescriptor = {
	readonly kind: 'lambert';
	/** Absent means white, as the constructor does. */
	readonly color?: MaterialColor;
	readonly map?: string;
	/** Absent means `false`. */
	readonly transparent?: boolean;
	/** Absent means 1. */
	readonly opacity?: number;
	/** Absent means `true`. */
	readonly depthWrite?: boolean;
	/** Absent means `false`. */
	readonly vertexColors?: boolean;
};

/**
 * A shadow-pass override for an alpha-tested surface (E9/R5). `depth` is the
 * directional/spot pass; `distance` is the point-light pass. They exist for one
 * retained portability exception (artwork with transparent texels): see
 * `scene-artwork-representation.ts`.
 */
export type DepthMaterialDescriptor = {
	readonly kind: 'depth';
	readonly map?: string;
	/** Absent means 0. */
	readonly alphaTest?: number;
	/** The depth encoding. Absent means `basic` (Three's default). */
	readonly packing?: 'basic' | 'rgba';
};

export type DistanceMaterialDescriptor = {
	readonly kind: 'distance';
	readonly map?: string;
	/** Absent means 0. */
	readonly alphaTest?: number;
};

/**
 * A shadow-catcher surface. `polygonOffset` is normalised as a boolean: Three
 * only reads the factor and units when it is set, so a descriptor that names
 * them without setting it is the same material as one that omits them.
 */
export type ShadowMaterialDescriptor = {
	readonly kind: 'shadow';
	readonly opacity?: number;
	readonly depthWrite?: boolean;
	readonly polygonOffset?: boolean;
	readonly polygonOffsetFactor?: number;
	readonly polygonOffsetUnits?: number;
};

/**
 * A surface of an imported model (E8/R2c). Its identity is the asset, the mesh and
 * slot it sits on, and the remap it wears: `remap` absent means the asset's own
 * material, cloned once by the store; present means the resolved look, which
 * replaces the imported material on that mesh. N instances of one model therefore
 * hold one material per (mesh, slot, remap) rather than one each.
 */
export type ImportedMaterialDescriptor = {
	readonly kind: 'imported';
	/** The approved asset bytes' identity (the URL the loader was given). */
	readonly asset: string;
	/** The mesh's index in the source hierarchy's depth-first Mesh order. */
	readonly mesh: number;
	/** The material slot on that mesh; `0` for a single material. */
	readonly slot: number;
	/**
	 * Always explicit. A look that names `false` overrides a source whose own material
	 * draws wireframe, so the source's flag never decides identity or appearance.
	 */
	readonly wireframe: boolean;
	/** The resolved look that replaces the imported material, if any. */
	readonly remap?: Omit<StandardMaterialDescriptor, 'kind'>;
};

export type MaterialDescriptor =
	| StandardMaterialDescriptor
	| BasicMaterialDescriptor
	| LambertMaterialDescriptor
	| DepthMaterialDescriptor
	| DistanceMaterialDescriptor
	| ShadowMaterialDescriptor
	| ImportedMaterialDescriptor;

function hex2(value: number): string {
	return value.toString(16).padStart(2, '0');
}

/** `#rrggbb`, lowercase, from the two forms a call site may write. */
export function canonicalColor(color: MaterialColor): string {
	if (typeof color === 'number') {
		if (!Number.isFinite(color) || color < 0 || color > 0xffffff) {
			throw new Error(`material descriptor colour ${color} is not a packed 24-bit RGB value`);
		}
		return `#${hex2((color >> 16) & 0xff)}${hex2((color >> 8) & 0xff)}${hex2(color & 0xff)}`;
	}
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
	if (match === null) {
		throw new Error(`material descriptor colour "${color}" is not #rgb or #rrggbb`);
	}
	const digits = match[1]!.toLowerCase();
	return digits.length === 3 ? `#${digits[0]!}${digits[0]!}${digits[1]!}${digits[1]!}${digits[2]!}${digits[2]!}` : `#${digits}`;
}

/** A number as its canonical key text; `-0` and `0` are the same value to Three. */
function num(value: number): string {
	if (!Number.isFinite(value)) throw new Error(`material descriptor value ${value} is not finite`);
	return String(value === 0 ? 0 : value);
}

/** A bound texture's identity, encoded so it cannot read as a field separator. */
function textureIdentity(map: string | undefined): string {
	return map === undefined ? '-' : encodeURIComponent(map);
}

function bool(value: boolean | undefined, fallback: boolean): string {
	return (value ?? fallback) ? '1' : '0';
}

/**
 * The canonical key for `descriptor`.
 *
 * Shape: `<kind>|field=value|field=value…`, fields always in the same order, so
 * the text is a stable function of the descriptor's *meaning*.
 */
export function materialKey(descriptor: MaterialDescriptor): string {
	switch (descriptor.kind) {
		case 'standard':
			return [
				'standard',
				`color=${canonicalColor(descriptor.color)}`,
				`roughness=${num(descriptor.roughness)}`,
				`metalness=${num(descriptor.metalness)}`,
				`emissive=${canonicalColor(descriptor.emissive ?? 0x000000)}`,
				`emissiveIntensity=${num(descriptor.emissiveIntensity ?? 1)}`,
				`toneMapped=${bool(descriptor.toneMapped, true)}`,
				`wireframe=${bool(descriptor.wireframe, false)}`,
				// Fixed slot order, `-` for an unbound slot: the key is a function of
				// which variants are bound, not of how the record was spelled.
				`textures=${MATERIAL_TEXTURE_SLOTS.map(
					(slot) => `${slot}:${descriptor.textures?.[slot] ?? '-'}`
				).join(';')}`
			].join('|');
		case 'basic':
			return [
				'basic',
				`color=${canonicalColor(descriptor.color)}`,
				`wireframe=${bool(descriptor.wireframe, false)}`,
				`toneMapped=${bool(descriptor.toneMapped, true)}`,
				`vertexColors=${bool(descriptor.vertexColors, false)}`,
				`depthWrite=${bool(descriptor.depthWrite, true)}`
			].join('|');
		case 'lambert':
			return [
				'lambert',
				`color=${canonicalColor(descriptor.color ?? 0xffffff)}`,
				`map=${textureIdentity(descriptor.map)}`,
				`transparent=${bool(descriptor.transparent, false)}`,
				`opacity=${num(descriptor.opacity ?? 1)}`,
				`depthWrite=${bool(descriptor.depthWrite, true)}`,
				`vertexColors=${bool(descriptor.vertexColors, false)}`
			].join('|');
		case 'depth':
			return [
				'depth',
				`map=${textureIdentity(descriptor.map)}`,
				`alphaTest=${num(descriptor.alphaTest ?? 0)}`,
				`packing=${descriptor.packing ?? 'basic'}`
			].join('|');
		case 'distance':
			return [
				'distance',
				`map=${textureIdentity(descriptor.map)}`,
				`alphaTest=${num(descriptor.alphaTest ?? 0)}`
			].join('|');
		case 'imported': {
			// The asset is an approved URL: encoded so no character of it can be
			// mistaken for a field separator, and the remap is nested in brackets.
			const remap =
				descriptor.remap === undefined
					? '-'
					: `[${materialKey({ kind: 'standard', ...descriptor.remap })}]`;
			return [
				'imported',
				`asset=${encodeURIComponent(descriptor.asset)}`,
				`mesh=${num(descriptor.mesh)}`,
				`slot=${num(descriptor.slot)}`,
				`wireframe=${bool(descriptor.wireframe, false)}`,
				`remap=${remap}`
			].join('|');
		}
		case 'shadow': {
			const offset = descriptor.polygonOffset ?? false;
			return [
				'shadow',
				`opacity=${num(descriptor.opacity ?? 1)}`,
				`depthWrite=${bool(descriptor.depthWrite, true)}`,
				`polygonOffset=${bool(offset, false)}`,
				// The factor and units are read only when the offset is on; normalising
				// them to zero keeps an off descriptor one key however it is spelled.
				`polygonOffsetFactor=${num(offset ? (descriptor.polygonOffsetFactor ?? 0) : 0)}`,
				`polygonOffsetUnits=${num(offset ? (descriptor.polygonOffsetUnits ?? 0) : 0)}`
			].join('|');
		}
	}
}
