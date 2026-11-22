import { describe, expect, it } from 'vitest';
import {
	TILE_DERIVATIVES,
	tileCropRect,
	tileDerivativeFor
} from '$lib/render/materials/sample-tile-derivatives';

describe('responsive sample-tile derivatives', () => {
	it('derives XS 64, S 112 and M 256 from the one master', () => {
		expect(TILE_DERIVATIVES.map((derivative) => [derivative.id, derivative.edge])).toEqual([
			['xs', 64],
			['s', 112],
			['m', 256]
		]);
	});

	it.each([
		[32, 1, 'xs'],
		[32, 2, 'xs'],
		[44, 1, 'xs'],
		[44, 2, 's'],
		[56, 2, 's'],
		[64, 2, 'm'],
		[40, 3, 'm'],
		[37, 3, 's'],
		[112, 1, 's'],
		[128, 1, 'm'],
		[128, 2, 'm'],
		[300, 2, 'm']
	])('%i CSS px at %ix is %s', (css, ratio, id) => {
		expect(tileDerivativeFor(css, ratio).id).toBe(id);
	});

	it('covers every size up to 128 CSS px on a 2× display (Retina sharpness)', () => {
		for (let css = 8; css <= 128; css += 1) {
			expect(tileDerivativeFor(css, 2).edge, `${css}px`).toBeGreaterThanOrEqual(Math.min(256, css * 2));
		}
	});

	it('covers narrow layouts on a 1× display', () => {
		for (let css = 8; css <= 256; css += 1) {
			expect(tileDerivativeFor(css, 1).edge, `${css}px`).toBeGreaterThanOrEqual(css);
		}
	});

	it('treats an unusable ratio or size as the smallest, never throws', () => {
		expect(tileDerivativeFor(Number.NaN, Number.NaN).id).toBe('xs');
		expect(tileDerivativeFor(0, 0).id).toBe('xs');
		expect(tileDerivativeFor(40, 9).edge).toBe(tileDerivativeFor(40, 3).edge);
	});

	it('crops XS to a tighter central window and keeps S and M whole', () => {
		const [xs, s, m] = TILE_DERIVATIVES;
		expect(tileCropRect(256, xs!)).toEqual([48, 48, 160, 160]);
		expect(tileCropRect(256, s!)).toEqual([0, 0, 256, 256]);
		expect(tileCropRect(256, m!)).toEqual([0, 0, 256, 256]);
	});
});
