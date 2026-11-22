/**
 * T2.S8 F derivation pixel maths. Every transform that decides a shipped pixel
 * lives in `material-pixels.ts`; these pin the behaviour the qualification
 * records rely on: mip-exact halving, normal renormalization, ORM packing, the
 * bounded colour gain and its clipping measure, and the seam statistics.
 */
import { describe, expect, it } from 'vitest';
import {
	applyGain,
	boxHalve,
	detailLoss,
	gainCeiling,
	hexToLinear,
	hueFactor,
	linearToHex,
	linearToSrgb,
	luminanceContrast,
	meanRgb,
	neutralizeLuminance,
	packOrm,
	plane,
	quantize,
	requiredGain,
	seamAgainstFeatures,
	seamRatio,
	srgbToLinear,
	tintFactor,
	type Plane
} from '../../../assets-source/textures/material-pixels';

function filled(width: number, height: number, rgba: (x: number, y: number) => number[]): Plane {
	const p = plane(width, height);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) p.data.set(rgba(x, y), (y * width + x) * 4);
	}
	return p;
}

describe('colour encoding', () => {
	it('round-trips sRGB and hex through linear light', () => {
		for (const v of [0, 0.02, 0.2, 0.5, 0.9, 1]) expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 6);
		expect(linearToHex(hexToLinear('#e8e2d8'))).toBe('#e8e2d8');
		expect(() => hexToLinear('e8e2d8')).toThrow();
	});
});

describe('ladder', () => {
	it('halves by an exact 2x box in linear light', () => {
		const p = filled(2, 2, (x, y) => [x === 0 && y === 0 ? 1 : 0, 0.5, 0.25, 1]);
		const half = boxHalve(p, 'srgb');
		expect([half.width, half.height]).toEqual([1, 1]);
		expect(Array.from(half.data)).toEqual([0.25, 0.5, 0.25, 1]);
		expect(() => boxHalve(plane(3, 2), 'srgb')).toThrow();
	});

	it('renormalizes halved normals to unit length', () => {
		const p = filled(2, 2, (x) => (x === 0 ? [1, 0, 0, 1] : [0, 0, 1, 1]));
		const [nx, ny, nz] = boxHalve(p, 'normal').data;
		expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 6);
		expect(nx).toBeCloseTo(Math.SQRT1_2, 6);
	});

	it('measures detail lost to the next level down', () => {
		const flat = filled(4, 4, () => [0.5, 0.5, 0.5, 1]);
		expect(detailLoss(flat, boxHalve(flat, 'data'), 'data')).toBe(0);
		const checker = filled(4, 4, (x, y) => ((x + y) % 2 === 0 ? [1, 1, 1, 1] : [0, 0, 0, 1]));
		expect(detailLoss(checker, boxHalve(checker, 'data'), 'data')).toBeCloseTo(127.5, 6);
		expect(() => detailLoss(checker, checker, 'data')).toThrow();
	});
});

describe('ORM packing and quantization', () => {
	it('packs occlusion, roughness and the metal constant', () => {
		const rough = filled(1, 1, () => [0.4, 0.4, 0.4, 1]);
		const ao = filled(1, 1, () => [0.8, 0.8, 0.8, 1]);
		const bound = packOrm({ roughness: rough, roughnessChannel: 0, occlusion: ao, occlusionChannel: 0, metal: false });
		expect(Array.from(bound.data)).toEqual([0.800000011920929, 0.4000000059604645, 0, 1]);
		const metal = packOrm({ roughness: rough, roughnessChannel: 0, occlusion: null, occlusionChannel: 0, metal: true });
		expect(Array.from(metal.data).map((v) => Math.round(v * 10) / 10)).toEqual([1, 0.4, 1, 1]);
		expect(() =>
			packOrm({ roughness: rough, roughnessChannel: 0, occlusion: plane(2, 2), occlusionChannel: 0, metal: false })
		).toThrow();
	});

	it('quantizes per domain to opaque RGBA8', () => {
		const n = filled(1, 1, () => [0, 0, 1, 0]);
		expect(Array.from(quantize(n, 'normal'))).toEqual([128, 128, 255, 255]);
		const c = filled(1, 1, () => [srgbToLinear(0.5), 2, -1, 0]);
		expect(Array.from(quantize(c, 'srgb'))).toEqual([128, 255, 0, 255]);
	});
});

describe('recorded colour transforms', () => {
	it('neutralizes to Rec. 709 luminance and keeps contrast', () => {
		const p = filled(2, 1, (x) => (x === 0 ? [0.2, 0.4, 0.6, 1] : [0.1, 0.2, 0.3, 1]));
		const before = luminanceContrast(p);
		neutralizeLuminance(p);
		const [r, g, b] = p.data;
		expect(r).toBeCloseTo(0.2126 * 0.2 + 0.7152 * 0.4 + 0.0722 * 0.6, 6);
		expect([g, b]).toEqual([r, r]);
		expect(luminanceContrast(p)).toBeCloseTo(before, 6);
	});

	it('lifts by one gain with headroom, counting clipped texels', () => {
		expect(requiredGain([0.5, 0.5, 0.5], [0.6, 0.6, 0.6])).toBe(1);
		expect(requiredGain([0.8, 0.4, 0.4], [0.4, 0.4, 0.4])).toBeCloseTo(2 * 1.02, 9);
		const p = filled(4, 1, (x) => [0.1 + x * 0.2, 0.1, 0.1, 1]);
		expect(applyGain(p, 2)).toBe(0.25);
		expect(meanRgb(p)[1]).toBeCloseTo(0.2, 6);
		// Below the clip, a single gain leaves relative contrast unchanged.
		const q = filled(4, 1, (x) => [0.1 + x * 0.1, 0.1, 0.1, 1]);
		const c0 = luminanceContrast(q);
		applyGain(q, 1.5);
		expect(luminanceContrast(q)).toBeCloseTo(c0, 6);
	});

	it('bounds a gain by the brightest-channel quantile', () => {
		const p = filled(10, 1, (x) => [(x + 1) / 20, 0, 0, 1]);
		// 10% clipped → the 9th of ten sorted peaks (0.5) sets the ceiling.
		expect(gainCeiling(p, 0.1)).toBeCloseTo(2, 6);
		const copy = filled(10, 1, (x) => [(x + 1) / 20, 0, 0, 1]);
		expect(applyGain(copy, gainCeiling(p, 0.1))).toBeLessThanOrEqual(0.1);
		expect(gainCeiling(plane(2, 2), 0.1)).toBe(Infinity);
	});

	it('aims a factor at the target, keeping hue when it is out of reach', () => {
		const mean: [number, number, number] = [0.5, 0.5, 0.5];
		expect(tintFactor('#808080', mean)?.linear.every((f) => f <= 1)).toBe(true);
		expect(tintFactor('#ffffff', mean)).toBeNull();
		const factor = hueFactor([0.9, 0.6, 0.3], mean);
		expect(Math.max(...factor)).toBe(1);
		expect(factor[1] / factor[0]).toBeCloseTo(0.6 / 0.9, 9);
	});
});

describe('seam statistics', () => {
	function rgba8(width: number, height: number, value: (x: number, y: number) => number): Uint8Array {
		const out = new Uint8Array(width * height * 4);
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) out.set([value(x, y), value(x, y), value(x, y), 255], (y * width + x) * 4);
		}
		return out;
	}

	it('finds a wrap seam that stands out above the interior', () => {
		const ramp = rgba8(8, 8, (x) => x * 10);
		expect(seamRatio(ramp, 8, 8)).toBeGreaterThan(1);
		expect(seamAgainstFeatures(ramp, 8, 8).x).toBeCloseTo(7, 6);
		expect(seamAgainstFeatures(ramp, 8, 8).y).toBe(0);
	});

	it('accepts a wrap no worse than a feature the material has', () => {
		// A grout line at the edge and one in the middle: the edge is a feature.
		const grout = rgba8(8, 8, (x) => (x === 0 || x === 4 ? 40 : 200));
		expect(seamAgainstFeatures(grout, 8, 8).x).toBeLessThanOrEqual(1);
		expect(seamRatio(rgba8(4, 4, () => 90), 4, 4)).toBe(1);
	});
});
