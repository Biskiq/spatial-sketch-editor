/**
 * T2 gallery UX recovery §7.1 — Artwork selection is a 6 px stand-off polygon
 * through the projected outer corners, with always-on image-size tags.
 */
import { describe, expect, it } from 'vitest';
import { artworkSelectionGeometry } from '$lib/authoring/artwork/artwork-overlay';

const square = [
	{ x: 100, y: 100 },
	{ x: 100, y: 200 },
	{ x: 200, y: 200 },
	{ x: 200, y: 100 }
];
const sizes = { imageWidthCm: 180, imageHeightCm: 101.3, framedWidthCm: 191.6, framedHeightCm: 113.2 };

describe('Artwork selection polygon', () => {
	it('pushes every corner 6 px outward from the polygon centre', () => {
		const geometry = artworkSelectionGeometry(square, sizes, false);
		expect(geometry.corners).toHaveLength(4);
		expect(geometry.corners[0]!.x).toBeCloseTo(100 - 6 / Math.SQRT2, 6);
		expect(geometry.corners[0]!.y).toBeCloseTo(100 - 6 / Math.SQRT2, 6);
		expect(geometry.corners[2]!.x).toBeCloseTo(200 + 6 / Math.SQRT2, 6);
		expect(geometry.polygon.split(' ')).toHaveLength(8);
	});

	it('keeps both image-size tags on while selected', () => {
		const geometry = artworkSelectionGeometry(square, sizes, false);
		expect(geometry.tags.map((tag) => tag.id)).toEqual(['bottom', 'right']);
		expect(geometry.tags[0]).toMatchObject({ text: '180.0 cm' });
		expect(geometry.tags[1]).toMatchObject({ text: '101.3 cm' });
		expect(geometry.tags[0]!.y).toBeGreaterThan(200 + 6);
		expect(geometry.tags[1]!.x).toBeGreaterThan(200 + 6);
	});

	it('adds the framed reading only during a corner drag', () => {
		const geometry = artworkSelectionGeometry(square, sizes, true);
		expect(geometry.tags).toHaveLength(1);
		expect(geometry.tags[0]!.text).toBe('180.0 × 101.3 cm · framed 191.6 × 113.2');
	});

	it('draws no tags when fewer than four corners project', () => {
		const geometry = artworkSelectionGeometry(square.slice(0, 2), sizes, false);
		expect(geometry.tags).toEqual([]);
		expect(geometry.polygon.length).toBeGreaterThan(0);
	});
});
