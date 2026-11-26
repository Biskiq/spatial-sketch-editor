/**
 * R217.S17A — gestures to outlines. The kernel's own validation is the authority;
 * these pin what each conversion hands it.
 */
import { describe, expect, it } from 'vitest';
import {
	freeOutline,
	outlineIssueWords,
	shapeOutline,
	standardOutline,
	validateShapeOutline,
	type ShapeOutlineAnchor
} from '$lib/authoring/adapters/scene/shape/outline';

const corner = (u: number, v: number): readonly ShapeOutlineAnchor[] => [{ u, v, smooth: false }];

describe('Box and Round', () => {
	it('reads the rectangle two corners span, in either drag direction', () => {
		for (const [a, b] of [[{ u: 0, v: 0 }, { u: 2, v: 1 }], [{ u: 2, v: 1 }, { u: 0, v: 0 }]] as const) {
			const result = shapeOutline('box', a, b);
			if (result.kind !== 'outline') throw new Error(result.message);
			expect(result.outline.map(({ u, v }) => [u, v]).sort()).toEqual([[0, 0], [0, 1], [2, 0], [2, 1]]);
			expect(validateShapeOutline(result.outline).kind).toBe('valid');
		}
	});

	it('refuses a drag with no usable size in words', () => {
		const result = shapeOutline('box', { u: 1, v: 1 }, { u: 1, v: 3 });
		expect(result.kind).toBe('refused');
		if (result.kind === 'refused') expect(result.message).toContain('both directions');
	});

	it('makes Round smooth anchors inside the same rectangle', () => {
		const result = shapeOutline('round', { u: 0, v: 0 }, { u: 4, v: 2 });
		if (result.kind !== 'outline') throw new Error(result.message);
		expect(result.outline.every((anchor) => anchor.smooth)).toBe(true);
		expect(Math.max(...result.outline.map((anchor) => anchor.u))).toBeCloseTo(4);
		expect(Math.min(...result.outline.map((anchor) => anchor.v))).toBeCloseTo(0);
	});

	it('centres the standard 1 m outline on the point', () => {
		for (const kind of ['box', 'round'] as const) {
			const result = standardOutline(kind, { u: 3, v: -2 });
			if (result.kind !== 'outline') throw new Error(result.message);
			const us = result.outline.map((anchor) => anchor.u);
			const vs = result.outline.map((anchor) => anchor.v);
			expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(1);
			expect((Math.max(...vs) + Math.min(...vs)) / 2).toBeCloseTo(-2);
		}
	});
});

describe('Free', () => {
	it('keeps clicked corners sharp and canonicalizes a clockwise drawing', () => {
		const result = freeOutline([corner(0, 0), corner(0, 2), corner(2, 2), corner(2, 0)], 0.01);
		if (result.kind !== 'outline') throw new Error(result.message);
		expect(result.outline).toHaveLength(4);
		expect(result.outline.every((anchor) => !anchor.smooth)).toBe(true);
	});

	it('does not refuse three snapped corners on one line, including across the seam', () => {
		const mid = freeOutline([corner(0, 0), corner(1, 0), corner(2, 0), corner(2, 2), corner(0, 2)], 0.01);
		if (mid.kind !== 'outline') throw new Error(mid.message);
		expect(mid.outline).toHaveLength(4);
		const seam = freeOutline([corner(1, 0), corner(2, 0), corner(2, 2), corner(0, 2), corner(0, 0)], 0.01);
		if (seam.kind !== 'outline') throw new Error(seam.message);
		expect(seam.outline).toHaveLength(4);
	});

	it('refuses corners that all lie on one line', () => {
		expect(freeOutline([corner(0, 0), corner(1, 0), corner(2, 0)], 0.01).kind).toBe('refused');
	});

	it('simplifies a drawn run and stays under the anchor cap', () => {
		const run: ShapeOutlineAnchor[] = [];
		for (let index = 0; index < 4000; index += 1) {
			const angle = (Math.PI * 2 * index) / 4000;
			run.push({ u: Math.cos(angle) * 3, v: Math.sin(angle) * 3, smooth: true });
		}
		const result = freeOutline([run], 0.0001);
		if (result.kind !== 'outline') throw new Error(result.message);
		expect(result.outline.length).toBeLessThanOrEqual(256);
		expect(result.outline.every((anchor) => anchor.smooth)).toBe(true);
	});

	it('refuses a self-crossing outline in the kernel words', () => {
		const result = freeOutline([corner(0, 0), corner(2, 2), corner(2, 0), corner(0, 2)], 0.01);
		expect(result.kind).toBe('refused');
		if (result.kind === 'refused' && result.issue !== null) {
			expect(result.message).toBe(outlineIssueWords(result.issue));
		}
	});
});
