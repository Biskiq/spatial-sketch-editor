import { describe, expect, it } from 'vitest';
import {
	S8_RESIDENCY_TARGETS_MIB,
	S8_RESIDENCY_VIEW_BYTES,
	analyzeHighlightFrame,
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
});