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
};

export type BasicMaterialDescriptor = {
	readonly kind: 'basic';
	readonly color: MaterialColor;
	readonly wireframe?: boolean;
	readonly toneMapped?: boolean;
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

export type MaterialDescriptor =
	| StandardMaterialDescriptor
	| BasicMaterialDescriptor
	| ShadowMaterialDescriptor;

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
				`toneMapped=${bool(descriptor.toneMapped, true)}`
			].join('|');
		case 'basic':
			return [
				'basic',
				`color=${canonicalColor(descriptor.color)}`,
				`wireframe=${bool(descriptor.wireframe, false)}`,
				`toneMapped=${bool(descriptor.toneMapped, true)}`
			].join('|');
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
