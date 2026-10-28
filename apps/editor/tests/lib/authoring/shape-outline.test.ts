/**
 * T5.P01.S02 — one stroke, four Shape conversions.
 *
 * The conversions are session arithmetic: only the outline a planner stores is
 * canonical. These tests pin the creator-facing meaning of each kind and the
 * one kernel validation every conversion passes through.
 */
import { describe, expect, it } from 'vitest';
import {
	flipUprightOutline,
	shapeOutline,
	validateShapeOutline,
	SHAPE_KINDS
} from '$lib/authoring/adapters/scene/shape/outline';

describe('T5.P01.S02 — Shape outline conversions', () => {
	it('offers Line, Box, Round and Sketch as conversions of one stroke', () => {
		expect(SHAPE_KINDS.map((kind) => kind.id)).toEqual(['line', 'box', 'round', 'sketch']);
	});

	it('Line keeps every named point as a straight anchor', () => {
		const result = shapeOutline('line', [
			{ u: 0, v: 0 },
			{ u: 2, v: 0 },
			{ u: 2, v: 1 },
			{ u: 0, v: 1 }
		]);
		expect(result.kind).toBe('outline');
		if (result.kind !== 'outline') return;
		expect(result.outline).toHaveLength(4);
		expect(result.outline.every((anchor) => anchor.smooth === false)).toBe(true);
		expect(validateShapeOutline(result.outline).kind).toBe('valid');
	});

	it('Sketch keeps every point but smooths every anchor', () => {
		const result = shapeOutline('sketch', [
			{ u: 0, v: 0 },
			{ u: 2, v: 0 },
			{ u: 2, v: 1 },
			{ u: 0, v: 1 }
		]);
		expect(result.kind).toBe('outline');
		if (result.kind !== 'outline') return;
		expect(result.outline.every((anchor) => anchor.smooth)).toBe(true);
		expect(validateShapeOutline(result.outline).kind).toBe('valid');
	});

	it('Box reads the stroke’s bounding rectangle from two points', () => {
		const result = shapeOutline('box', [
			{ u: 0.5, v: 0.5 },
			{ u: 2.5, v: 1.5 }
		]);
		expect(result.kind).toBe('outline');
		if (result.kind !== 'outline') return;
		expect(result.outline).toHaveLength(4);
		expect(new Set(result.outline.map((anchor) => `${anchor.u}:${anchor.v}`))).toEqual(
			new Set(['0.5:0.5', '2.5:0.5', '2.5:1.5', '0.5:1.5'])
		);
	});

	it('Round reads a smooth ellipse within the stroke bounds', () => {
		const result = shapeOutline('round', [
			{ u: 0, v: 0 },
			{ u: 2, v: 1 }
		]);
		expect(result.kind).toBe('outline');
		if (result.kind !== 'outline') return;
		expect(result.outline.length).toBeGreaterThanOrEqual(8);
		expect(result.outline.every((anchor) => anchor.smooth)).toBe(true);
		expect(Math.min(...result.outline.map((anchor) => anchor.u))).toBeCloseTo(0, 9);
		expect(Math.max(...result.outline.map((anchor) => anchor.u))).toBeCloseTo(2, 9);
		expect(Math.min(...result.outline.map((anchor) => anchor.v))).toBeCloseTo(0, 9);
		expect(Math.max(...result.outline.map((anchor) => anchor.v))).toBeCloseTo(1, 9);
		expect(validateShapeOutline(result.outline).kind).toBe('valid');
	});

	it('canonicalizes a clockwise stroke instead of refusing it', () => {
		const result = shapeOutline('line', [
			{ u: 0, v: 0 },
			{ u: 0, v: 1 },
			{ u: 2, v: 1 },
			{ u: 2, v: 0 }
		]);
		expect(result.kind).toBe('outline');
		if (result.kind !== 'outline') return;
		// The returned order is the canonical one every later read uses, so the
		// outline is valid rather than merely canonicalized for validation.
		expect(validateShapeOutline(result.outline).kind).toBe('valid');
		const area = result.outline.reduce((sum, anchor, index) => {
			const next = result.outline[(index + 1) % result.outline.length]!;
			return sum + (anchor.u * next.v - next.u * anchor.v);
		}, 0);
		expect(area).toBeGreaterThan(0);
	});

	it('refuses a self-intersecting stroke with the kernel’s own reason', () => {
		const result = shapeOutline('line', [
			{ u: 0, v: 0 },
			{ u: 2, v: 2 },
			{ u: 2, v: 0 },
			{ u: 0, v: 2 }
		]);
		expect(result.kind).toBe('refused');
		if (result.kind !== 'refused') return;
		expect(result.issue?.code).toBe('self-intersecting');
		expect(result.message).toContain('crosses itself');
	});

	it('refuses a Line with fewer than three distinct points', () => {
		const result = shapeOutline('line', [
			{ u: 0, v: 0 },
			{ u: 1, v: 0 }
		]);
		expect(result.kind).toBe('refused');
		if (result.kind !== 'refused') return;
		expect(result.message).toContain('at least 3 points');
	});

	it('Flips an upright outline by mirroring U and keeping V', () => {
		expect(
			flipUprightOutline([
				{ u: -0.5, v: 0, smooth: false },
				{ u: 0.5, v: 1, smooth: true }
			])
		).toEqual([
			{ u: 0.5, v: 0, smooth: false },
			{ u: -0.5, v: 1, smooth: true }
		]);
	});
});
