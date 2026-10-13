import { describe, expect, it } from 'vitest';

import { orientXZ } from '@portfolio/layout-core';
import {
	classifyWallIntersection,
	type TopologySegment
} from '@portfolio/layout-core';
import type { LayoutVec2 } from '@portfolio/layout-core';

function segment(id: string, start: LayoutVec2, end: LayoutVec2): TopologySegment {
	return { id, start, end };
}

describe('orientXZ robust orientation (P23.8 / H3 §4)', () => {
	it('locks the sign convention: positive = c left of a→b', () => {
		const a: LayoutVec2 = [0, 0];
		const b: LayoutVec2 = [1, 0];
		expect(orientXZ(a, b, [0.5, 1])).toBeGreaterThan(0);
		expect(orientXZ(a, b, [0.5, -1])).toBeLessThan(0);
		expect(orientXZ(a, b, [2, 0])).toBe(0);
	});

	it('is stable across point permutations', () => {
		const a: LayoutVec2 = [0, 0];
		const b: LayoutVec2 = [6, 0];
		const c: LayoutVec2 = [3, 2];
		const abc = orientXZ(a, b, c);
		expect(orientXZ(b, c, a)).toBeGreaterThan(0);
		expect(Math.sign(orientXZ(c, a, b))).toBe(Math.sign(abc));
		expect(Math.sign(orientXZ(b, a, c))).toBe(-Math.sign(abc));
	});

	it('survives the near-collinear sweep without epsilon flips (robust-predicates sweep provenance)', () => {
		// Widths well below double-precision determinant noise at this scale.
		const a: LayoutVec2 = [0, 0];
		const b: LayoutVec2 = [128, 0];
		for (let exponent = 1; exponent <= 43; exponent += 1) {
			const y = 2 ** -exponent;
			expect(orientXZ(a, b, [64, y])).toBeGreaterThan(0);
			expect(orientXZ(a, b, [64, -y])).toBeLessThan(0);
		}
	});
});

describe('typed straight-wall intersection classifier (H3 §8)', () => {
	it('classifies disjoint segments as none', () => {
		const a = segment('a', [0, 0], [1, 0]);
		const b = segment('b', [3, 0], [4, 0]);
		expect(classifyWallIntersection(a, b)).toEqual({ kind: 'none' });
	});

	it('reuses an explicit shared junction before any geometry', () => {
		const a = segment('a', [0, 0], [2, 0]);
		const b = segment('b', [2, 0], [2, 4]);
		const result = classifyWallIntersection(a, b, ['j-shared']);
		expect(result).toMatchObject({ kind: 'shared-explicit-junction', junctionId: 'j-shared' });
		if (result.kind !== 'shared-explicit-junction') return;
		expect(result.point).toEqual([2, 0]);
	});

	it('classifies endpoint-to-endpoint touch without shared junction as collinear-endpoint-touch', () => {
		const a = segment('a', [0, 0], [2, 0]);
		const b = segment('b', [2, 0], [4, 0]);
		const result = classifyWallIntersection(a, b);
		expect(result).toMatchObject({ kind: 'collinear-endpoint-touch' });
	});

	it('classifies a T junction as endpoint-on-interior', () => {
		// Stem's start endpoint lies exactly on the host's interior; the stem's
		// other endpoint is strictly on one side of the host line.
		const stem = segment('stem', [1, 0], [1, -3]);
		const host = segment('host', [0, 0], [4, 0]);
		const result = classifyWallIntersection(stem, host);
		expect(result).toMatchObject({
			kind: 'endpoint-on-interior',
			endpointWallId: 'stem',
			interiorWallId: 'host'
		});
		if (result.kind !== 'endpoint-on-interior') return;
		expect(result.point).toEqual([1, 0]);
	});

	it('classifies a proper X crossing with the exact point', () => {
		const a = segment('a', [0, 0], [4, 4]);
		const b = segment('b', [0, 4], [4, 0]);
		const result = classifyWallIntersection(a, b);
		expect(result.kind).toBe('proper-crossing');
		if (result.kind !== 'proper-crossing') return;
		expect(result.point[0]).toBeCloseTo(2, 9);
		expect(result.point[1]).toBeCloseTo(2, 9);
	});

	it('handles the near-parallel large-coordinate crossing deterministically (Flatten issue-99 provenance)', () => {
		const a = segment('a', [1e6, 0], [1e6 + 4, 1]);
		const b = segment('b', [1e6 + 2, -2], [1e6 + 2, 2]);
		const result = classifyWallIntersection(a, b);
		expect(result.kind).toBe('proper-crossing');
		if (result.kind !== 'proper-crossing') return;
		expect(result.point[0]).toBeCloseTo(1e6 + 2, 6);
	});

	it('rejects collinear overlap as an overlap span, not a merge', () => {
		const a = segment('a', [0, 0], [4, 0]);
		const b = segment('b', [1, 0], [6, 0]);
		const result = classifyWallIntersection(a, b);
		expect(result).toMatchObject({ kind: 'collinear-overlap' });
		if (result.kind !== 'collinear-overlap') return;
		expect(result.start[0]).toBeCloseTo(1, 9);
		expect(result.end[0]).toBeCloseTo(4, 9);
	});

	it('keeps a tiny positive collinear gap distinct (Flatten issue-85 provenance)', () => {
		const a = segment('a', [0, 0], [2, 0]);
		const b = segment('b', [2 + 1e-9, 0], [4, 0]);
		const result = classifyWallIntersection(a, b);
		expect(result).toEqual({ kind: 'none' });
	});

	it('never merges distinct junction IDs at the same coordinate (H3 §8 rule 6)', () => {
		// Collinear endpoint touch at an exactly coincident coordinate. With no
		// shared Junction ID supplied, the result is a plain touch — sharing is
		// decided by authored Junction identity, never by coordinate proximity.
		const a = segment('wall-a', [0, 0], [2, 0]);
		const b = segment('wall-b', [2, 0], [4, 0]);
		expect(classifyWallIntersection(a, b)).toEqual({
			kind: 'collinear-endpoint-touch',
			point: [2, 0]
		});
		// The same geometry with an explicit shared Junction reuses it (rule 1).
		const shared = classifyWallIntersection(a, b, ['j-a']);
		expect(shared).toMatchObject({ kind: 'shared-explicit-junction', junctionId: 'j-a' });
	});

	// P23 review round 1 / B2: the pre-fix classifier compared the
	// perpendicular coordinate of a.start vs b.start with exact equality,
	// which only works for axis-aligned walls — a diagonally collinear pair
	// was misread as `intersection_numeric_unstable`.
	it('classifies diagonal collinear overlap (B2 regression)', () => {
		const a = segment('a', [0, 0], [4, 4]);
		const b = segment('b', [1, 1], [5, 5]);
		expect(classifyWallIntersection(a, b)).toEqual({
			kind: 'collinear-overlap',
			start: [1, 1],
			end: [4, 4]
		});
	});

	it('classifies diagonal collinear endpoint touch', () => {
		const a = segment('a', [0, 0], [4, 4]);
		const b = segment('b', [4, 4], [8, 8]);
		expect(classifyWallIntersection(a, b)).toEqual({
			kind: 'collinear-endpoint-touch',
			point: [4, 4]
		});
	});

	it('classifies diagonal collinear disjoint spans as none', () => {
		const a = segment('a', [0, 0], [4, 4]);
		const b = segment('b', [5, 5], [8, 8]);
		expect(classifyWallIntersection(a, b)).toEqual({ kind: 'none' });
	});

	it('classifies reverse-argument T junctions symmetrically', () => {
		const stem = segment('stem', [2, 2], [2, 4]);
		const host = segment('host', [0, 4], [4, 4]);
		const forward = classifyWallIntersection(stem, host);
		const reverse = classifyWallIntersection(host, stem);
		expect(forward).toEqual({
			kind: 'endpoint-on-interior',
			endpointWallId: 'stem',
			interiorWallId: 'host',
			point: [2, 4]
		});
		expect(reverse).toEqual(forward);
	});

	it('classifies a reversed-argument diagonal T with role fidelity', () => {
		const stem = segment('stem', [8, 2], [5, 5]);
		const host = segment('host', [0, 0], [8, 8]);
		const result = classifyWallIntersection(stem, host);
		expect(result).toEqual({
			kind: 'endpoint-on-interior',
			endpointWallId: 'stem',
			interiorWallId: 'host',
			point: [5, 5]
		});
		expect(classifyWallIntersection(host, stem)).toEqual(result);
	});
});
