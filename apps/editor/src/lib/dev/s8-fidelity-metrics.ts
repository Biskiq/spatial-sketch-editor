/**
 * Pure oracle math for the PR B linear-target sampling-fidelity chart.
 *
 * The dev gate route renders each chart case into a linear float target and
 * hands the top-first pixels here. Expected values are derived independently of
 * the renderer: sRGB bytes through the IEC 61966-2-1 transfer, raw bytes as
 * `byte/255`, and normal responses from the authored UV basis of the actual
 * mesh. Nothing here imports the editor or visitor runtime.
 */

/** Absolute tolerance the plan fixes for unlit scalar/colour patch interiors. */
export const FIDELITY_UNLIT_TOLERANCE = 1 / 255;

/** A top-first linear float frame (RGBA, row 0 is the top of the image). */
export type LinearFrame = {
	readonly pixels: Float32Array;
	readonly width: number;
	readonly height: number;
};

/** A normalized rectangle `[x0, y0, x1, y1]` in top-first frame coordinates. */
export type PatchRect = readonly [number, number, number, number];

export type FidelityCheck = {
	readonly id: string;
	readonly group: 'colour' | 'raw' | 'orm' | 'ao' | 'normal' | 'uv1' | 'count';
	readonly expected: number | readonly number[] | string;
	readonly observed: number | readonly number[] | string;
	readonly tolerance: number | null;
	readonly pass: boolean;
	readonly note?: string;
};

export function srgbByteToLinear(byte: number): number {
	const value = byte / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Mean RGBA over a patch interior, top-first. */
export function patchMean(frame: LinearFrame, rect: PatchRect): [number, number, number, number] {
	const x0 = Math.max(0, Math.floor(rect[0] * frame.width));
	const y0 = Math.max(0, Math.floor(rect[1] * frame.height));
	const x1 = Math.min(frame.width, Math.ceil(rect[2] * frame.width));
	const y1 = Math.min(frame.height, Math.ceil(rect[3] * frame.height));
	const sum = [0, 0, 0, 0];
	let count = 0;
	for (let y = y0; y < y1; y += 1) {
		for (let x = x0; x < x1; x += 1) {
			const at = (y * frame.width + x) * 4;
			for (let channel = 0; channel < 4; channel += 1) sum[channel]! += frame.pixels[at + channel]!;
			count += 1;
		}
	}
	if (count === 0) throw new Error(`empty patch ${rect.join(',')}`);
	return sum.map((value) => value / count) as [number, number, number, number];
}

/** The largest per-channel absolute deviation of `observed` from `expected`. */
export function maxAbsError(observed: readonly number[], expected: readonly number[]): number {
	let worst = 0;
	for (let index = 0; index < expected.length; index += 1) {
		worst = Math.max(worst, Math.abs((observed[index] ?? Number.NaN) - expected[index]!));
	}
	return Number.isNaN(worst) ? Number.POSITIVE_INFINITY : worst;
}

/** One unlit patch compared channel-wise against an exact expectation. */
export function unlitCheck(
	id: string,
	group: FidelityCheck['group'],
	observed: readonly number[],
	expected: readonly number[],
	tolerance = FIDELITY_UNLIT_TOLERANCE
): FidelityCheck {
	const error = maxAbsError(observed, expected);
	return {
		id,
		group,
		expected: expected.map(round6),
		observed: observed.slice(0, expected.length).map(round6),
		tolerance,
		pass: error <= tolerance
	};
}

/** Rec. 709 luminance of a linear RGB reading. */
export function luminance(rgb: readonly number[]): number {
	return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

/**
 * The tangent-space normal an 8-bit RGB texel encodes, normalized. `convention`
 * `-Y` flips the decoded Y exactly once, as the sampling graph does.
 */
export function decodeNormalTexel(
	rgb: readonly [number, number, number],
	convention: '+Y' | '-Y' = '+Y'
): [number, number, number] {
	const x = (rgb[0] / 255) * 2 - 1;
	let y = (rgb[1] / 255) * 2 - 1;
	const z = (rgb[2] / 255) * 2 - 1;
	if (convention === '-Y') y = -y;
	const length = Math.hypot(x, y, z);
	return [x / length, y / length, z / length];
}

/** Three's `setUvTransform` (pivot ½) on one UV, before any storage-row change. */
export function transformUv(
	uv: readonly [number, number],
	mapping: { readonly repeat: readonly [number, number]; readonly rotation: number; readonly offset: readonly [number, number] }
): [number, number] {
	const cos = Math.cos(mapping.rotation);
	const sin = Math.sin(mapping.rotation);
	const cx = uv[0] - 0.5;
	const cy = uv[1] - 0.5;
	return [
		(cx * cos + cy * sin) * mapping.repeat[0] + 0.5 + mapping.offset[0],
		(-cx * sin + cy * cos) * mapping.repeat[1] + 0.5 + mapping.offset[1]
	];
}

/**
 * The world-space tangent frame of a planar, affine-UV triangle in the authored
 * (transformed, pre-storage) UV basis: T points along increasing u, B along
 * increasing v, both unnormalized directions in the triangle's plane.
 */
export function planarUvFrame(
	positions: readonly (readonly [number, number, number])[],
	uvs: readonly (readonly [number, number])[]
): { tangent: [number, number, number]; bitangent: [number, number, number] } {
	const [p0, p1, p2] = positions as [
		readonly [number, number, number],
		readonly [number, number, number],
		readonly [number, number, number]
	];
	const [t0, t1, t2] = uvs as [readonly [number, number], readonly [number, number], readonly [number, number]];
	const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
	const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
	const du1 = t1[0] - t0[0];
	const dv1 = t1[1] - t0[1];
	const du2 = t2[0] - t0[0];
	const dv2 = t2[1] - t0[1];
	const det = du1 * dv2 - du2 * dv1;
	if (Math.abs(det) < 1e-12) throw new Error('singular UV triangle');
	const tangent = [0, 1, 2].map((i) => (e1[i]! * dv2 - e2[i]! * dv1) / det) as [number, number, number];
	const bitangent = [0, 1, 2].map((i) => (e2[i]! * du1 - e1[i]! * du2) / det) as [number, number, number];
	return { tangent, bitangent };
}

function normalize3(v: readonly number[]): [number, number, number] {
	const length = Math.hypot(v[0]!, v[1]!, v[2]!);
	return [v[0]! / length, v[1]! / length, v[2]! / length];
}

/**
 * The sign of the diffuse response change a tangent-space normal causes under a
 * light, relative to the flat surface normal: +1 brighter, −1 darker. The frame
 * is the authored UV basis; `geometric` is the face normal.
 */
export function expectedNormalResponseSign(
	normal: readonly [number, number, number],
	frame: { tangent: readonly number[]; bitangent: readonly number[] },
	geometric: readonly [number, number, number],
	light: readonly [number, number, number]
): -1 | 0 | 1 {
	const t = normalize3(frame.tangent);
	const b = normalize3(frame.bitangent);
	const l = normalize3(light);
	const mapped = normalize3([0, 1, 2].map((i) => t[i]! * normal[0] + b[i]! * normal[1] + geometric[i]! * normal[2]));
	const flat = geometric[0] * l[0] + geometric[1] * l[1] + geometric[2] * l[2];
	const bumped = Math.max(0, mapped[0] * l[0] + mapped[1] * l[1] + mapped[2] * l[2]);
	const delta = bumped - Math.max(0, flat);
	return Math.abs(delta) < 1e-6 ? 0 : delta > 0 ? 1 : -1;
}

/** A signed response check: the observed luminance delta must share the expected sign. */
export function responseSignCheck(
	id: string,
	group: FidelityCheck['group'],
	centre: number,
	border: number,
	expected: -1 | 0 | 1,
	/** Minimum |delta| (linear luminance) that counts as a response. */
	threshold = 4 / 255
): FidelityCheck {
	const delta = centre - border;
	const observed: -1 | 0 | 1 = Math.abs(delta) < threshold ? 0 : delta > 0 ? 1 : -1;
	return {
		id,
		group,
		expected,
		observed,
		tolerance: threshold,
		pass: observed === expected,
		note: `centre ${round6(centre)} vs border ${round6(border)}`
	};
}

/** A ratio check within a relative tolerance. */
export function ratioCheck(
	id: string,
	group: FidelityCheck['group'],
	numerator: number,
	denominator: number,
	expected: number,
	relativeTolerance: number
): FidelityCheck {
	const observed = denominator === 0 ? Number.POSITIVE_INFINITY : numerator / denominator;
	return {
		id,
		group,
		expected: round6(expected),
		observed: round6(observed),
		tolerance: relativeTolerance,
		pass: Math.abs(observed - expected) <= relativeTolerance * Math.abs(expected),
		note: `${round6(numerator)} / ${round6(denominator)}`
	};
}

/** An exact equality check for counts and labels. */
export function equalCheck(
	id: string,
	group: FidelityCheck['group'],
	observed: number | string,
	expected: number | string,
	note?: string
): FidelityCheck {
	return { id, group, expected, observed, tolerance: null, pass: observed === expected, ...(note ? { note } : {}) };
}

export function fidelityVerdict(checks: readonly FidelityCheck[]): { pass: boolean; failed: string[] } {
	const failed = checks.filter((check) => !check.pass).map((check) => check.id);
	return { pass: checks.length > 0 && failed.length === 0, failed };
}

function round6(value: number): number {
	return Math.round(value * 1e6) / 1e6;
}

type Rgba = readonly [number, number, number, number];

/**
 * The A characterization fixtures the chart reads, as recorded in
 * `tests/lib/render/materials/__fixtures__/s8/fixtures.json` (a unit test pins
 * these values to that manifest). Rects are top-first image pixels.
 */
export const S8_CHART_FIXTURES = {
	swatch: {
		uri: '/s8-fixtures/swatch-rgba.png',
		size: 256,
		quadrants: {
			topLeft: [128, 128, 128, 255],
			topRight: [220, 40, 40, 255],
			bottomLeft: [40, 180, 80, 128],
			bottomRight: [40, 80, 220, 0]
		} satisfies Record<string, Rgba>
	},
	checker: {
		uri: '/s8-fixtures/checker-asymmetric.png',
		size: 256,
		cellPx: 32,
		corners: {
			topLeft: [230, 30, 30, 255],
			topRight: [30, 200, 60, 255],
			bottomLeft: [30, 70, 220, 255],
			bottomRight: [240, 210, 20, 255]
		} satisfies Record<string, Rgba>
	},
	normalPlusY: { uri: '/s8-fixtures/normal-plus-y.png', size: 128, centre: [166, 204, 222] as const, flat: [128, 128, 255] as const, centreRect: [16, 16, 112, 112] as const },
	normalMinusY: { uri: '/s8-fixtures/normal-minus-y.png', size: 128, centre: [166, 51, 222] as const, flat: [128, 128, 255] as const, centreRect: [16, 16, 112, 112] as const },
	orm: { uri: '/s8-fixtures/orm-distinct.png', size: 128, centre: [51, 191, 255, 255] as const, border: [26, 128, 230, 255] as const, centreRect: [16, 16, 112, 112] as const },
	twoUvGlb: { uri: '/s8-oracle/two-uv-glb.glb' }
} as const;

export type ImageCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/**
 * Which image corner a screen point samples, given its mesh UV, the entry's
 * affine mapping and its storage-row origin (`legacy` reads row 1−v, `gltf`
 * reads row v). Repeat wrapping applies.
 */
export function sampledImageCorner(
	uv: readonly [number, number],
	mapping: { readonly repeat: readonly [number, number]; readonly rotation: number; readonly offset: readonly [number, number] },
	origin: 'legacy' | 'gltf'
): ImageCorner {
	const [u, v] = transformUv(uv, mapping);
	const column = u - Math.floor(u);
	const rowRaw = origin === 'legacy' ? 1 - v : v;
	const row = rowRaw - Math.floor(rowRaw);
	const top = row < 0.5;
	const left = column < 0.5;
	return top ? (left ? 'topLeft' : 'topRight') : left ? 'bottomLeft' : 'bottomRight';
}
