/**
 * Pure PR B gate math. The dev route supplies the rendered pixels and the
 * observed adapter; this module only turns them into measurements and verdicts.
 * It is not part of the editor or visitor runtime.
 */
import type { InspectionFrame } from '$lib/render/materials/inspection';
import { rgba8MipChainBytes } from '$lib/render/resources/finish-views';

export const S8_RESIDENCY_TARGETS_MIB = [128, 192, 256, 384] as const;
export const S8_RESIDENCY_VIEW_SIZE = 1024;
export const S8_RESIDENCY_VIEW_BYTES = rgba8MipChainBytes(
	S8_RESIDENCY_VIEW_SIZE,
	S8_RESIDENCY_VIEW_SIZE
);

export function residencyViewsForTarget(
	targetMiB: number,
	viewBytes = S8_RESIDENCY_VIEW_BYTES
): number {
	return Math.floor((targetMiB * 1024 * 1024) / viewBytes);
}

export type HighlightMetric = {
	roughness: number;
	peakLinear: number;
	halfPeakLargestComponent: number;
	clippedFraction: number;
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
		if (r >= 250 || g >= 250 || b >= 250) clipped += 1;
	}

	const half = peak * 0.5;
	const halfMask = new Uint8Array(width * height);
	for (let index = 0; index < width * height; index += 1) {
		if (subject[index] && luminance[index]! >= half) halfMask[index] = 1;
	}
	// Connected half-peak area, not a raw pixel count: a split reflection must
	// not beat one compact highlight by counting unrelated pixels.
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

	return {
		roughness,
		peakLinear: peak,
		halfPeakLargestComponent: largest,
		clippedFraction: subjectPixels === 0 ? 1 : clipped / subjectPixels,
		subjectPixels
	};
}

export function highlightVerdict(
	lowRoughness: HighlightMetric,
	highRoughness: HighlightMetric
): HighlightVerdict {
	const peakRatio = lowRoughness.peakLinear / Math.max(highRoughness.peakLinear, Number.EPSILON);
	const reasons: string[] = [];
	if (!(peakRatio >= 1.1)) reasons.push(`peak ratio ${peakRatio.toFixed(3)} < 1.1`);
	if (!(lowRoughness.halfPeakLargestComponent < highRoughness.halfPeakLargestComponent)) {
		reasons.push('roughness 0.2 half-peak component is not smaller');
	}
	if (!(lowRoughness.clippedFraction < 0.01 && highRoughness.clippedFraction < 0.01)) {
		reasons.push('clipped subject pixels are not below 1%');
	}
	return { peakRatio, pass: reasons.length === 0, reasons };
}