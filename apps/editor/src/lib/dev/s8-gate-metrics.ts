/**
 * Pure PR B gate math. The dev route supplies the rendered pixels and the
 * observed adapter; this module only turns them into measurements and verdicts.
 * It is not part of the editor or visitor runtime.
 */
import {
	DataTexture,
	LinearFilter,
	LinearMipmapLinearFilter,
	NoColorSpace,
	RGBAFormat,
	UnsignedByteType
} from 'three';
import type { InspectionFrame } from '$lib/render/materials/inspection';
import { rgba8MipChainBytes } from '$lib/render/resources/finish-views';

export const S8_RESIDENCY_TARGETS_MIB = [128, 192, 256, 384] as const;
export const S8_RESIDENCY_VIEW_SIZE = 1024;
export const S8_RESIDENCY_VIEW_BYTES = rgba8MipChainBytes(
	S8_RESIDENCY_VIEW_SIZE,
	S8_RESIDENCY_VIEW_SIZE
);

/** The plan's transient: one 4096² RGBA8 texture with its **complete** mip chain. */
export const S8_TRANSIENT_SIZE = 4096;
export const S8_TRANSIENT_LEVELS = Math.floor(Math.log2(S8_TRANSIENT_SIZE)) + 1;
export const S8_TRANSIENT_BYTES = rgba8MipChainBytes(S8_TRANSIENT_SIZE, S8_TRANSIENT_SIZE);

/**
 * Build the transient upload. A `DataTexture` defaults to no mipmaps and nearest
 * filtering, which allocates only the 64 MiB base level; the plan's headroom
 * check is the ~85.3 MiB chain, so mip generation and trilinear filtering are
 * explicit here.
 */
export function createResidencyTransient(size = S8_TRANSIENT_SIZE): DataTexture {
	const texture = new DataTexture(
		new Uint8Array(size * size * 4),
		size,
		size,
		RGBAFormat,
		UnsignedByteType
	);
	texture.colorSpace = NoColorSpace;
	texture.generateMipmaps = true;
	texture.minFilter = LinearMipmapLinearFilter;
	texture.magFilter = LinearFilter;
	texture.needsUpdate = true;
	return texture;
}

export function residencyViewsForTarget(
	targetMiB: number,
	viewBytes = S8_RESIDENCY_VIEW_BYTES
): number {
	return Math.floor((targetMiB * 1024 * 1024) / viewBytes);
}

export type HighlightMetric = {
	roughness: number;
	/** Peak luminance decoded from the final 8-bit sRGB frame (saturates at 1). */
	peakLinear: number;
	halfPeakLargestComponent: number;
	/** Subject pixels with a channel saturated at 255 in the final sRGB frame. */
	clippedFraction: number;
	/** Subject pixels with a channel at or above 250; reported, never gated. */
	nearClipFraction?: number;
	subjectPixels: number;
};

/**
 * The plan's highlight is sampled in a **linear** target: peak and connected
 * half-peak area are read from unclipped radiance, while clipping is read from
 * the final sRGB thumbnail. This is that linear reading.
 */
export type LinearHighlightMetric = {
	roughness: number;
	peakLinear: number;
	halfPeakLargestComponent: number;
	/** Subject pixels with a linear channel ≥ 1, i.e. that must clip in sRGB. */
	overOneFraction: number;
	subjectPixels: number;
};

export type HighlightVerdict = {
	peakRatio: number;
	pass: boolean;
	reasons: string[];
};

function srgbToLinear(byte: number): number {
	const value = byte / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function analyzeHighlightFrame(
	frame: Pick<InspectionFrame, 'pixels' | 'width' | 'height'>,
	roughness: number
): HighlightMetric {
	const { pixels, width, height } = frame;
	const subject: boolean[] = new Array(width * height).fill(false);
	const luminance = new Float64Array(width * height);
	let subjectPixels = 0;
	let peak = 0;
	let clipped = 0;
	let nearClip = 0;
	for (let index = 0; index < width * height; index += 1) {
		const offset = index * 4;
		const r = pixels[offset]!;
		const g = pixels[offset + 1]!;
		const b = pixels[offset + 2]!;
		// The opaque reference background is #555. Anti-aliased edge pixels are
		// still subject; only an exact/near-exact background is excluded.
		if (Math.abs(r - 85) <= 2 && Math.abs(g - 85) <= 2 && Math.abs(b - 85) <= 2) continue;
		subject[index] = true;
		subjectPixels += 1;
		const linear =
			0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
		luminance[index] = linear;
		peak = Math.max(peak, linear);
		if (r >= 255 || g >= 255 || b >= 255) clipped += 1;
		if (r >= 250 || g >= 250 || b >= 250) nearClip += 1;
	}

	const largest = largestHalfPeakComponent(subject, luminance, peak, width, height);

	return {
		roughness,
		peakLinear: peak,
		halfPeakLargestComponent: largest,
		clippedFraction: subjectPixels === 0 ? 1 : clipped / subjectPixels,
		nearClipFraction: subjectPixels === 0 ? 1 : nearClip / subjectPixels,
		subjectPixels
	};
}

/**
 * Connected half-peak area, not a raw pixel count: a split reflection must not
 * beat one compact highlight by counting unrelated pixels.
 */
function largestHalfPeakComponent(
	subject: ArrayLike<boolean>,
	luminance: Float64Array,
	peak: number,
	width: number,
	height: number
): number {
	const half = peak * 0.5;
	const halfMask = new Uint8Array(width * height);
	for (let index = 0; index < width * height; index += 1) {
		if (subject[index] && luminance[index]! >= half) halfMask[index] = 1;
	}
	const seen = new Uint8Array(width * height);
	let largest = 0;
	for (let index = 0; index < width * height; index += 1) {
		if (halfMask[index] === 0 || seen[index] === 1) continue;
		let size = 0;
		const stack = [index];
		seen[index] = 1;
		while (stack.length > 0) {
			const current = stack.pop()!;
			size += 1;
			const x = current % width;
			const y = Math.floor(current / width);
			for (const next of [
				x > 0 ? current - 1 : -1,
				x + 1 < width ? current + 1 : -1,
				y > 0 ? current - width : -1,
				y + 1 < height ? current + width : -1
			]) {
				if (next < 0 || halfMask[next] === 0 || seen[next] === 1) continue;
				seen[next] = 1;
				stack.push(next);
			}
		}
		largest = Math.max(largest, size);
	}
	return largest;
}

/**
 * Read a linear RGBA float frame. Subject pixels are those the draw covered
 * (alpha > 0): the gate clears to transparent and removes the scene background
 * for this readback only.
 */
export function analyzeLinearHighlight(
	frame: { readonly pixels: ArrayLike<number>; readonly width: number; readonly height: number },
	roughness: number
): LinearHighlightMetric {
	const { pixels, width, height } = frame;
	const subject: boolean[] = new Array(width * height).fill(false);
	const luminance = new Float64Array(width * height);
	let subjectPixels = 0;
	let peak = 0;
	let overOne = 0;
	for (let index = 0; index < width * height; index += 1) {
		const offset = index * 4;
		if (!(pixels[offset + 3]! > 0)) continue;
		const r = pixels[offset]!;
		const g = pixels[offset + 1]!;
		const b = pixels[offset + 2]!;
		subject[index] = true;
		subjectPixels += 1;
		const value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		luminance[index] = value;
		peak = Math.max(peak, value);
		if (r >= 1 || g >= 1 || b >= 1) overOne += 1;
	}
	return {
		roughness,
		peakLinear: peak,
		halfPeakLargestComponent: largestHalfPeakComponent(subject, luminance, peak, width, height),
		overOneFraction: subjectPixels === 0 ? 1 : overOne / subjectPixels,
		subjectPixels
	};
}

/**
 * The plan's three highlight conditions. Peak contrast and compact area come
 * from the linear reading when supplied (the plan's "linear metal-sphere
 * highlight"); clipping always comes from the final sRGB frame.
 */
export function highlightVerdict(
	lowRoughness: HighlightMetric,
	highRoughness: HighlightMetric,
	linear?: { readonly low: LinearHighlightMetric; readonly high: LinearHighlightMetric }
): HighlightVerdict {
	const low = linear?.low ?? lowRoughness;
	const high = linear?.high ?? highRoughness;
	const peakRatio = low.peakLinear / Math.max(high.peakLinear, Number.EPSILON);
	const reasons: string[] = [];
	if (!(peakRatio >= 1.1)) reasons.push(`peak ratio ${peakRatio.toFixed(3)} < 1.1`);
	if (!(low.halfPeakLargestComponent < high.halfPeakLargestComponent)) {
		reasons.push('roughness 0.2 half-peak component is not smaller');
	}
	if (!(lowRoughness.clippedFraction < 0.01 && highRoughness.clippedFraction < 0.01)) {
		reasons.push('clipped subject pixels are not below 1%');
	}
	return { peakRatio, pass: reasons.length === 0, reasons };
}