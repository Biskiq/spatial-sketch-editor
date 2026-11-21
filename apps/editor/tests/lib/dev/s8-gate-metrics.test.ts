import { describe, expect, it } from 'vitest';
import { LinearMipmapLinearFilter } from 'three';
import {
	S8_RESIDENCY_TARGETS_MIB,
	S8_RESIDENCY_VIEW_BYTES,
	S8_TRANSIENT_BYTES,
	S8_TRANSIENT_LEVELS,
	createResidencyTransient,
	analyzeHighlightFrame,
	analyzeLinearHighlight,
	highlightVerdict,
	residencyViewsForTarget
} from '$lib/dev/s8-gate-metrics';

function frame(width: number, height: number, pixels: Array<[number, number, number?]>) {
	const bytes = new Uint8Array(width * height * 4);
	for (let index = 0; index < width * height; index += 1) {
		const value = pixels[index] ?? [85, 85, 85];
		bytes[index * 4] = value[0];
		bytes[index * 4 + 1] = value[1];
		bytes[index * 4 + 2] = value[2] ?? value[0];
		bytes[index * 4 + 3] = 255;
	}
	return { pixels: bytes, width, height };
}

describe('S8 gate metrics', () => {
	it('steps the Finish-view staircase from the actual mip-chain byte size', () => {
		expect(S8_RESIDENCY_TARGETS_MIB).toEqual([128, 192, 256, 384]);
		expect(S8_RESIDENCY_TARGETS_MIB.map((target) => residencyViewsForTarget(target))).toEqual([
			24, 36, 48, 72
		]);
		for (const target of S8_RESIDENCY_TARGETS_MIB) {
			expect(residencyViewsForTarget(target) * S8_RESIDENCY_VIEW_BYTES).toBeLessThanOrEqual(
				target * 1024 * 1024
			);
		}
	});

	it('builds the 4096² transient with its complete mip chain (~85.3 MiB)', () => {
		const transient = createResidencyTransient();
		expect(transient.image.width).toBe(4096);
		expect(transient.generateMipmaps).toBe(true);
		expect(transient.minFilter).toBe(LinearMipmapLinearFilter);
		expect(S8_TRANSIENT_LEVELS).toBe(13);
		expect(S8_TRANSIENT_BYTES).toBe(89_478_484);
		expect(S8_TRANSIENT_BYTES / (1024 * 1024)).toBeCloseTo(85.33, 2);
		transient.dispose();
	});

	it('measures linear peak, connected half-peak area and final-sRGB clipping', () => {
		// A 4×2 subject: two adjacent white texels at roughness 0.2, two mid-grey
		// texels at roughness 0.8. Background #555 is excluded from both metrics.
		const low = analyzeHighlightFrame(
			frame(4, 2, [
				[85, 85],
				[255, 255],
				[255, 255],
				[85, 85],
				[85, 85],
				[85, 85],
				[85, 85],
				[85, 85]
			]),
			0.2
		);
		const high = analyzeHighlightFrame(
			frame(4, 2, [
				[85, 85],
				[128, 128],
				[128, 128],
				[85, 85],
				[85, 85],
				[85, 85],
				[85, 85],
				[85, 85]
			]),
			0.8
		);
		expect(low.subjectPixels).toBe(2);
		expect(low.peakLinear).toBe(1);
		expect(low.halfPeakLargestComponent).toBe(2);
		expect(low.clippedFraction).toBe(1);
		expect(high.peakLinear).toBeLessThan(1);
		expect(high.halfPeakLargestComponent).toBe(2);
		expect(high.clippedFraction).toBe(0);
	});

	it('uses only the largest connected half-peak component', () => {
		const split = analyzeHighlightFrame(
			frame(6, 1, [
				[85, 85],
				[255, 255],
				[85, 85],
				[255, 255],
				[255, 255],
				[85, 85]
			]),
			0.2
		);
		expect(split.halfPeakLargestComponent).toBe(2);
	});

	it('passes only when peak contrast, compactness and clipping all hold', () => {
		const low = { rough: 0.2, peak: 1, area: 100, clipped: 0 };
		const high = { rough: 0.8, peak: 0.5, area: 200, clipped: 0 };
		const metric = (value: { rough: number; peak: number; area: number; clipped: number }) => ({
			roughness: value.rough,
			peakLinear: value.peak,
			halfPeakLargestComponent: value.area,
			clippedFraction: value.clipped,
			subjectPixels: 1000
		});
		expect(highlightVerdict(metric(low), metric(high))).toMatchObject({
			peakRatio: 2,
			pass: true,
			reasons: []
		});
		expect(highlightVerdict(metric({ ...low, clipped: 0.02 }), metric(high)).reasons).toContain(
			'clipped subject pixels are not below 1%'
		);
		expect(highlightVerdict(metric({ ...low, area: 200 }), metric(high)).reasons).toContain(
			'roughness 0.2 half-peak component is not smaller'
		);
		expect(highlightVerdict(metric({ ...low, peak: 0.5 }), metric(high)).reasons[0]).toContain(
			'< 1.1'
		);
	});

	it('counts only saturated 255 channels as clipped; 250–254 is near-clip, not clipped', () => {
		const metric = analyzeHighlightFrame(
			frame(3, 1, [
				[255, 200],
				[252, 252],
				[200, 200]
			]),
			0.2
		);
		expect(metric.subjectPixels).toBe(3);
		expect(metric.clippedFraction).toBeCloseTo(1 / 3);
		expect(metric.nearClipFraction).toBeCloseTo(2 / 3);
	});

	it('reads the unclipped linear peak and connected half-peak area from a float frame', () => {
		// Alpha 0 is the cleared background. A peak of 4 has a half-peak of 2, so
		// the 1.5 neighbour is outside the compact core even though both clip.
		const pixels = new Float32Array([
			0, 0, 0, 0,
			4, 4, 4, 1,
			1.5, 1.5, 1.5, 1,
			0.2, 0.2, 0.2, 1
		]);
		const metric = analyzeLinearHighlight({ pixels, width: 4, height: 1 }, 0.2);
		expect(metric.subjectPixels).toBe(3);
		expect(metric.peakLinear).toBeCloseTo(4);
		expect(metric.halfPeakLargestComponent).toBe(1);
		expect(metric.overOneFraction).toBeCloseTo(2 / 3);
	});

	it('takes peak and area from the linear reading but clipping from the sRGB frame', () => {
		const srgb = (clipped: number) => ({
			roughness: 0.2,
			peakLinear: 1,
			halfPeakLargestComponent: 500,
			clippedFraction: clipped,
			subjectPixels: 1000
		});
		const linear = (peak: number, area: number) => ({
			roughness: 0.2,
			peakLinear: peak,
			halfPeakLargestComponent: area,
			overOneFraction: 0,
			subjectPixels: 1000
		});
		// The clipped sRGB readings tie at peak 1 and equal area; the linear
		// readings separate them.
		const pass = highlightVerdict(srgb(0), srgb(0), { low: linear(3, 40), high: linear(1, 300) });
		expect(pass).toMatchObject({ peakRatio: 3, pass: true });
		const clipped = highlightVerdict(srgb(0.05), srgb(0), {
			low: linear(3, 40),
			high: linear(1, 300)
		});
		expect(clipped.pass).toBe(false);
		expect(clipped.reasons).toEqual(['clipped subject pixels are not below 1%']);
	});
});
