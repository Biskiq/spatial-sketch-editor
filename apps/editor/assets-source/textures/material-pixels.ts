/**
 * Pure pixel maths for the T2.S8 F curated-material derivation.
 *
 * The codec (`@napi-rs/image`) only decodes and encodes; every transform that
 * decides a pixel lives here so the codec stays swappable and each step is
 * testable. Planes are float RGBA, row-major, values in the domain each step
 * names: linear light for colour, [-1, 1] vectors for normals, raw [0, 1] for
 * data. Curated sources tile, so every filter wraps at the edges.
 */

export type Plane = {
	readonly width: number;
	readonly height: number;
	/** RGBA, `width * height * 4` floats. */
	readonly data: Float32Array;
};

export type PlaneDomain = 'srgb' | 'normal' | 'data';

export function plane(width: number, height: number): Plane {
	return { width, height, data: new Float32Array(width * height * 4) };
}

export function srgbToLinear(value: number): number {
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(value: number): number {
	const v = Math.min(1, Math.max(0, value));
	return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** Codec colour types this module reads (`JsColorType` values). */
const CHANNELS_BY_COLOR_TYPE: Readonly<Record<number, { channels: number; bits: 8 | 16 }>> = {
	0: { channels: 1, bits: 8 },
	1: { channels: 2, bits: 8 },
	2: { channels: 3, bits: 8 },
	3: { channels: 4, bits: 8 },
	4: { channels: 1, bits: 16 },
	5: { channels: 2, bits: 16 },
	6: { channels: 3, bits: 16 },
	7: { channels: 4, bits: 16 }
};

/**
 * Raw codec pixels (native-endian, 8- or 16-bit) to a float plane in the given
 * domain. Grey sources replicate into RGB; alpha is dropped to 1.
 */
export function decodeRaw(
	raw: Uint8Array,
	colorType: number,
	width: number,
	height: number,
	domain: PlaneDomain
): Plane {
	const layout = CHANNELS_BY_COLOR_TYPE[colorType];
	if (layout === undefined) throw new Error(`unsupported colour type ${colorType}`);
	const count = width * height;
	const samples = count * layout.channels;
	let read: (index: number) => number;
	if (layout.bits === 8) {
		if (raw.byteLength !== samples) throw new Error('raw byte length mismatch');
		read = (index) => raw[index] / 255;
	} else {
		if (raw.byteLength !== samples * 2) throw new Error('raw byte length mismatch');
		const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
		read = (index) => view.getUint16(index * 2, true) / 65535;
	}
	const out = plane(width, height);
	const grey = layout.channels < 3;
	for (let p = 0; p < count; p += 1) {
		const base = p * layout.channels;
		for (let c = 0; c < 3; c += 1) {
			const value = read(base + (grey ? 0 : c));
			out.data[p * 4 + c] =
				domain === 'srgb' ? srgbToLinear(value) : domain === 'normal' ? value * 2 - 1 : value;
		}
		out.data[p * 4 + 3] = 1;
	}
	if (domain === 'normal') renormalize(out);
	return out;
}

/** Unit-length normals in place; a degenerate vector becomes +Z. */
export function renormalize(normals: Plane): void {
	const d = normals.data;
	for (let i = 0; i < d.length; i += 4) {
		const length = Math.hypot(d[i], d[i + 1], d[i + 2]);
		if (length < 1e-8) {
			d[i] = 0;
			d[i + 1] = 0;
			d[i + 2] = 1;
		} else {
			d[i] /= length;
			d[i + 1] /= length;
			d[i + 2] /= length;
		}
	}
}

/**
 * Exact 2× box downsample — the GPU mip filter. Colour is averaged in linear
 * light because the plane is already linear; normals are renormalized after.
 */
export function boxHalve(source: Plane, domain: PlaneDomain): Plane {
	if (source.width % 2 !== 0 || source.height % 2 !== 0) {
		throw new Error('box halving needs even dimensions');
	}
	const out = plane(source.width / 2, source.height / 2);
	const s = source.data;
	const w = source.width;
	for (let y = 0; y < out.height; y += 1) {
		for (let x = 0; x < out.width; x += 1) {
			const a = ((2 * y) * w + 2 * x) * 4;
			const b = a + 4;
			const c = a + w * 4;
			const e = c + 4;
			const o = (y * out.width + x) * 4;
			for (let k = 0; k < 4; k += 1) {
				out.data[o + k] = (s[a + k] + s[b + k] + s[c + k] + s[e + k]) / 4;
			}
		}
	}
	if (domain === 'normal') renormalize(out);
	return out;
}

function lanczos3(x: number): number {
	if (x === 0) return 1;
	if (Math.abs(x) >= 3) return 0;
	const px = Math.PI * x;
	return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
}

function resampleAxis(
	source: Plane,
	outWidth: number,
	outHeight: number,
	horizontal: boolean
): Plane {
	const out = plane(outWidth, outHeight);
	const inLength = horizontal ? source.width : source.height;
	const outLength = horizontal ? outWidth : outHeight;
	const scale = inLength / outLength;
	const support = 3 * Math.max(1, scale);
	const filterScale = Math.max(1, scale);
	const lines = horizontal ? outHeight : outWidth;
	for (let o = 0; o < outLength; o += 1) {
		const center = (o + 0.5) * scale - 0.5;
		const first = Math.ceil(center - support);
		const last = Math.floor(center + support);
		const taps: number[] = [];
		const weights: number[] = [];
		let total = 0;
		for (let i = first; i <= last; i += 1) {
			const weight = lanczos3((i - center) / filterScale);
			if (weight === 0) continue;
			taps.push(((i % inLength) + inLength) % inLength);
			weights.push(weight);
			total += weight;
		}
		for (let line = 0; line < lines; line += 1) {
			const target = horizontal ? (line * outWidth + o) * 4 : (o * outWidth + line) * 4;
			for (let k = 0; k < 4; k += 1) {
				let sum = 0;
				for (let t = 0; t < taps.length; t += 1) {
					const index = horizontal
						? (line * source.width + taps[t]) * 4
						: (taps[t] * source.width + line) * 4;
					sum += source.data[index + k] * weights[t];
				}
				out.data[target + k] = sum / total;
			}
		}
	}
	return out;
}

/**
 * Separable Lanczos-3 resample with periodic edges, used only to bring a
 * non-2048² source to 2048². Data values clamp to [0,1]; normals renormalize.
 */
export function lanczosResample(
	source: Plane,
	width: number,
	height: number,
	domain: PlaneDomain
): Plane {
	if (source.width === width && source.height === height) return source;
	const across = resampleAxis(source, width, source.height, true);
	const out = resampleAxis(across, width, height, false);
	if (domain === 'normal') renormalize(out);
	else {
		for (let i = 0; i < out.data.length; i += 1) out.data[i] = Math.max(0, out.data[i]);
		if (domain === 'data') for (let i = 0; i < out.data.length; i += 1) out.data[i] = Math.min(1, out.data[i]);
	}
	return out;
}

/** D4: linear-light Rec. 709 luminance to grey, in place. */
export const NEUTRALIZE_TRANSFORM = 'rec709-linear-luminance-grey/1';
export const REC709 = [0.2126, 0.7152, 0.0722] as const;

export function neutralizeLuminance(linear: Plane): void {
	const d = linear.data;
	for (let i = 0; i < d.length; i += 4) {
		const y = REC709[0] * d[i] + REC709[1] * d[i + 1] + REC709[2] * d[i + 2];
		d[i] = y;
		d[i + 1] = y;
		d[i + 2] = y;
	}
}

/**
 * ORM packing: R occlusion (1 when unbound), G roughness, B metal constant
 * (0 dielectric, 1 metal). Inputs are data planes; only their red channel is
 * read, because the curated grey maps replicate into RGB on decode — except a
 * provider ORM, read channel-wise.
 */
export function packOrm(input: {
	readonly roughness: Plane;
	readonly roughnessChannel: 0 | 1 | 2;
	readonly occlusion: Plane | null;
	readonly occlusionChannel: 0 | 1 | 2;
	readonly metal: boolean;
}): Plane {
	const { roughness, occlusion } = input;
	if (occlusion !== null && (occlusion.width !== roughness.width || occlusion.height !== roughness.height)) {
		throw new Error('ORM inputs differ in size');
	}
	const out = plane(roughness.width, roughness.height);
	for (let i = 0; i < out.data.length; i += 4) {
		out.data[i] = occlusion === null ? 1 : occlusion.data[i + input.occlusionChannel];
		out.data[i + 1] = roughness.data[i + input.roughnessChannel];
		out.data[i + 2] = input.metal ? 1 : 0;
		out.data[i + 3] = 1;
	}
	return out;
}

/** Quantize a plane to opaque RGBA8 for encoding (round half up). */
export function quantize(source: Plane, domain: PlaneDomain): Uint8Array {
	const out = new Uint8Array(source.width * source.height * 4);
	const d = source.data;
	for (let i = 0; i < d.length; i += 4) {
		for (let c = 0; c < 3; c += 1) {
			const v = d[i + c];
			const encoded = domain === 'srgb' ? linearToSrgb(v) : domain === 'normal' ? (v + 1) / 2 : v;
			out[i + c] = Math.round(Math.min(1, Math.max(0, encoded)) * 255);
		}
		out[i + 3] = 255;
	}
	return out;
}

/** Mean of each RGB channel (linear for colour planes). */
export function meanRgb(source: Plane): [number, number, number] {
	const sum = [0, 0, 0];
	const d = source.data;
	for (let i = 0; i < d.length; i += 4) {
		sum[0] += d[i];
		sum[1] += d[i + 1];
		sum[2] += d[i + 2];
	}
	const n = source.width * source.height;
	return [sum[0] / n, sum[1] / n, sum[2] / n];
}

export function hexToLinear(hex: string): [number, number, number] {
	const value = /^#([0-9a-f]{6})$/i.exec(hex);
	if (value === null) throw new Error(`not an sRGB hex: ${hex}`);
	const n = Number.parseInt(value[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => srgbToLinear(c / 255)) as [
		number,
		number,
		number
	];
}

export function linearToHex(rgb: readonly [number, number, number]): string {
	return `#${rgb
		.map((c) => Math.round(linearToSrgb(c) * 255).toString(16).padStart(2, '0'))
		.join('')}`;
}

/**
 * §7 recipe colour: per-channel linear(target) / measured linear mean. Returns
 * `null` when any channel would exceed 1 (the source is too dark).
 */
export function tintFactor(
	targetHex: string,
	measuredLinearMean: readonly [number, number, number]
): { readonly hex: string; readonly linear: [number, number, number] } | null {
	const target = hexToLinear(targetHex);
	const factor = target.map((t, c) => t / measuredLinearMean[c]) as [number, number, number];
	if (factor.some((f) => !(f <= 1))) return null;
	return { hex: linearToHex(factor), linear: factor };
}

/**
 * Seam check against the image's own features: the wrap edge's mean absolute
 * difference (per axis) against the most discontinuous interior line on that
 * axis. Grout, mortar and board joints that the tile edge legitimately cuts
 * through make interior lines just as discontinuous, so a ratio ≤ 1 means the
 * wrap is no worse than a feature the material already has; a true seam stands
 * out above every interior line.
 */
export function seamAgainstFeatures(
	rgba8: Uint8Array,
	width: number,
	height: number
): { readonly x: number; readonly y: number } {
	const at = (x: number, y: number, c: number) => rgba8[(y * width + x) * 4 + c];
	const column = (x0: number, x1: number) => {
		let sum = 0;
		for (let y = 0; y < height; y += 1) for (let c = 0; c < 3; c += 1) sum += Math.abs(at(x1, y, c) - at(x0, y, c));
		return sum / (height * 3);
	};
	const row = (y0: number, y1: number) => {
		let sum = 0;
		for (let x = 0; x < width; x += 1) for (let c = 0; c < 3; c += 1) sum += Math.abs(at(x, y1, c) - at(x, y0, c));
		return sum / (width * 3);
	};
	let worstColumn = 0;
	for (let x = 0; x < width - 1; x += 1) worstColumn = Math.max(worstColumn, column(x, x + 1));
	let worstRow = 0;
	for (let y = 0; y < height - 1; y += 1) worstRow = Math.max(worstRow, row(y, y + 1));
	const ratio = (edge: number, worst: number) => (worst === 0 ? (edge === 0 ? 0 : Infinity) : edge / worst);
	return { x: ratio(column(width - 1, 0), worstColumn), y: ratio(row(height - 1, 0), worstRow) };
}

/**
 * A recorded colour gain (§7 factor ranges): a recipe factor can only lower
 * the value a map supplies, so a source whose linear mean sits below its target
 * is lifted here by one multiplicative gain, which keeps relative albedo
 * contrast. Returns the clipped share the gain causes.
 */
export const COLOR_GAIN_TRANSFORM = 'linear-colour-gain/1';

export function requiredGain(
	targetLinear: readonly [number, number, number],
	measuredLinearMean: readonly [number, number, number],
	headroom = 1.02
): number {
	const need = Math.max(...targetLinear.map((t, c) => t / measuredLinearMean[c]));
	return need <= 1 ? 1 : need * headroom;
}

export function applyGain(linear: Plane, gain: number): number {
	const d = linear.data;
	let clipped = 0;
	for (let i = 0; i < d.length; i += 4) {
		let over = false;
		for (let c = 0; c < 3; c += 1) {
			d[i + c] *= gain;
			if (d[i + c] > 1) over = true;
		}
		if (over) clipped += 1;
	}
	return clipped / (linear.width * linear.height);
}

/**
 * Mean wrap-edge difference against the mean interior neighbour difference
 * (the plan's literal seam statistic, kept as evidence beside
 * `seamAgainstFeatures`).
 */
export function seamRatio(rgba8: Uint8Array, width: number, height: number): number {
	const at = (x: number, y: number, c: number) => rgba8[(y * width + x) * 4 + c];
	let edge = 0;
	let edgeCount = 0;
	for (let y = 0; y < height; y += 1) {
		for (let c = 0; c < 3; c += 1) edge += Math.abs(at(width - 1, y, c) - at(0, y, c));
		edgeCount += 3;
	}
	for (let x = 0; x < width; x += 1) {
		for (let c = 0; c < 3; c += 1) edge += Math.abs(at(x, height - 1, c) - at(x, 0, c));
		edgeCount += 3;
	}
	let inner = 0;
	let innerCount = 0;
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width - 1; x += 1) {
			for (let c = 0; c < 3; c += 1) inner += Math.abs(at(x + 1, y, c) - at(x, y, c));
			innerCount += 3;
		}
	}
	for (let y = 0; y < height - 1; y += 1) {
		for (let x = 0; x < width; x += 1) {
			for (let c = 0; c < 3; c += 1) inner += Math.abs(at(x, y + 1, c) - at(x, y, c));
			innerCount += 3;
		}
	}
	const innerMean = inner / innerCount;
	return innerMean === 0 ? (edge === 0 ? 1 : Infinity) : edge / edgeCount / innerMean;
}

/**
 * Detail lost by dropping one ladder level: RMS difference between a level and
 * the next lower level brought back up by box replication, in 8-bit units. It
 * measures how much high-frequency content the lower level discards — evidence
 * for the next-step-down judgement, not a substitute for it.
 */
export function detailLoss(higher: Plane, lower: Plane, domain: PlaneDomain): number {
	if (higher.width !== lower.width * 2 || higher.height !== lower.height * 2) {
		throw new Error('detail loss compares adjacent ladder levels');
	}
	const encode = (v: number) =>
		domain === 'srgb' ? linearToSrgb(v) : domain === 'normal' ? (v + 1) / 2 : v;
	let sum = 0;
	for (let y = 0; y < higher.height; y += 1) {
		for (let x = 0; x < higher.width; x += 1) {
			const h = (y * higher.width + x) * 4;
			const l = ((y >> 1) * lower.width + (x >> 1)) * 4;
			for (let c = 0; c < 3; c += 1) {
				const diff = (encode(higher.data[h + c]) - encode(lower.data[l + c])) * 255;
				sum += diff * diff;
			}
		}
	}
	return Math.sqrt(sum / (higher.width * higher.height * 3));
}

/**
 * The largest gain that clips at most `maxClippedShare` of texels: the
 * reciprocal of that quantile of each texel's brightest channel. Bounding a
 * brightening gain by it keeps the highlights' variation (principle: preserve
 * texture information rather than force-match a mean).
 */
export function gainCeiling(linear: Plane, maxClippedShare: number): number {
	const n = linear.width * linear.height;
	const peaks = new Float32Array(n);
	for (let p = 0; p < n; p += 1) {
		const i = p * 4;
		peaks[p] = Math.max(linear.data[i], linear.data[i + 1], linear.data[i + 2]);
	}
	peaks.sort();
	const peak = peaks[Math.min(n - 1, Math.floor(n * (1 - maxClippedShare)))];
	return peak <= 0 ? Infinity : 1 / peak;
}

/** Relative luminance variation (standard deviation / mean) of a linear plane. */
export function luminanceContrast(linear: Plane): number {
	let sum = 0;
	let sumSq = 0;
	const n = linear.width * linear.height;
	for (let i = 0; i < linear.data.length; i += 4) {
		const y =
			REC709[0] * Math.min(1, linear.data[i]) +
			REC709[1] * Math.min(1, linear.data[i + 1]) +
			REC709[2] * Math.min(1, linear.data[i + 2]);
		sum += y;
		sumSq += y * y;
	}
	const mean = sum / n;
	return mean === 0 ? 0 : Math.sqrt(Math.max(0, sumSq / n - mean * mean)) / mean;
}

/**
 * A recipe factor (≤ 1 per channel) aiming the measured mean at `target`. When
 * the target is brighter than the source allows, the factor keeps the
 * target's hue at the highest luminance the source supports instead.
 */
export function hueFactor(
	target: readonly [number, number, number],
	measuredLinearMean: readonly [number, number, number]
): [number, number, number] {
	const ratios = target.map((t, c) => t / measuredLinearMean[c]);
	const scale = Math.max(1, ...ratios);
	return ratios.map((r) => r / scale) as [number, number, number];
}
