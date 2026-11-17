/**
 * SL2's pure contract: the finite drawn predicate, its depth/extent arithmetic,
 * the camera-side rule, and the cap section's finite clipping.
 */
import { describe, expect, it } from 'vitest';
import {
	clampDrawnDepth,
	drawnFarSideDistance,
	drawnHiddenSide,
	hiddenPiecesOf,
	resolveSlice,
	snapDrawnAngle,
	sliceHides,
	type DrawnResolvedSlice
} from '$lib/authoring/stage/slice/slice-cut';
import { clipChainToExtent, clipLoopsToExtent } from '$lib/authoring/stage/slice/slice-section';
import { subjectWhollyHidden } from '$lib/authoring/stage/slice/slice-ghost';

function resolved(depth = 1, hidden: 'left' | 'right' = 'right'): DrawnResolvedSlice {
	const value = resolveSlice(
		{ kind: 'drawn', start: [0, 0], end: [2, 0], hidden, depthMeters: depth },
		{ sheetHeight: 0, datumMeters: 0 }
	);
	if (value.kind !== 'drawn') throw new Error('expected a drawn reading');
	return value;
}

describe('resolveSlice drawn arm', () => {
	it('resolves the finite segment around its midpoint', () => {
		const cut = resolved(2);
		expect(cut.kind).toBe('drawn');
		expect(cut.origin).toEqual([1, 0, 0]);
		expect(cut.along).toEqual([1, 0, 0]);
		expect(cut.hiddenNormal).toEqual([0, 0, 1]);
		expect(cut.halfLength).toBe(1);
		expect(cut.depthMeters).toBe(2);
		expect(cut.start).toEqual([0, 0, 0]);
		expect(cut.end).toEqual([2, 0, 0]);
	});

	it('normalises a degenerate drag to a zero-extent cut that hides nothing', () => {
		const cut = resolveSlice(
			{ kind: 'drawn', start: [0, 0], end: [0.01, 0], hidden: 'right', depthMeters: 0 },
			{ sheetHeight: 0, datumMeters: 0 }
		);
		if (cut.kind !== 'drawn') throw new Error('expected a drawn reading');
		expect(cut.halfLength).toBe(0);
		expect(cut.depthMeters).toBe(0.1);
		expect(sliceHides(cut, 0, 1, 0.5)).toBe(false);
		expect(hiddenPiecesOf(cut)).toEqual([]);
	});
});

describe('drawn predicate', () => {
	const cut = resolved(1);

	it('hides the whole near side inside the segment, and only beyond the depth behind it', () => {
		expect(sliceHides(cut, 1, 1, 0.5)).toBe(true);
		expect(sliceHides(cut, 1, 1, 0)).toBe(false);
		expect(sliceHides(cut, 1, 1, -0.5)).toBe(false);
		expect(sliceHides(cut, 1, 1, -1)).toBe(false);
		expect(sliceHides(cut, 1, 1, -1.5)).toBe(true);
		expect(sliceHides(cut, 1, -100, 0.5)).toBe(true);
	});

	it('keeps both sides outside the finite extent', () => {
		expect(sliceHides(cut, 2.1, 1, 0.5)).toBe(false);
		expect(sliceHides(cut, -0.1, 1, 0.5)).toBe(false);
		expect(sliceHides(cut, 1, 1, -2)).toBe(true);
	});

	it('Flip removes the other side', () => {
		const flipped = resolved(1, 'left');
		expect(flipped.hiddenNormal).toEqual([0, 0, -1]);
		expect(sliceHides(flipped, 1, 1, -0.5)).toBe(true);
		expect(sliceHides(flipped, 1, 1, 0.5)).toBe(false);
	});
});

describe('drawn depth', () => {
	it('measures the upper clamp on the shown side of the cut', () => {
		const cut = resolved(1);
		expect(
			drawnFarSideDistance(cut, { min: [-1, 0, -2], max: [3, 1, 2] })
		).toBeCloseTo(2, 9);
	});

	it('clamps to [0.1 m, far-side distance]', () => {
		expect(clampDrawnDepth(0, 3)).toBe(0.1);
		expect(clampDrawnDepth(-4, 3)).toBe(0.1);
		expect(clampDrawnDepth(8, 3)).toBe(3);
		expect(clampDrawnDepth(Number.NaN, 3)).toBe(0.1);
	});
});

describe('the hidden side at draw', () => {
	it('uses the Plan right by default', () => {
		expect(drawnHiddenSide({ start: [0, 0], end: [1, 0], eye: [0, 2, 5], datumMeters: 0, reading: 'plan' })).toBe('right');
	});

	it('hides the eye side in 3D and flips when the camera crosses', () => {
		expect(drawnHiddenSide({ start: [0, 0], end: [1, 0], eye: [0, 2, 5], datumMeters: 0, reading: '3d' })).toBe('right');
		expect(drawnHiddenSide({ start: [0, 0], end: [1, 0], eye: [0, 2, -5], datumMeters: 0, reading: '3d' })).toBe('left');
	});
});

describe('segment angle snap', () => {
	it('snaps near-45° directions and keeps the pointer length', () => {
		const length = Math.hypot(2, 0.02);
		const axis = snapDrawnAngle([0, 0], [2, 0.02]);
		expect(axis[0]).toBeCloseTo(length, 9);
		expect(axis[1]).toBe(0);
		const diagonal = snapDrawnAngle([0, 0], [2, 2.05]);
		expect(diagonal[0]).toBeCloseTo(Math.hypot(2, 2.05) / Math.SQRT2, 9);
		expect(diagonal[1]).toBeCloseTo(Math.hypot(2, 2.05) / Math.SQRT2, 9);
	});
});

describe('finite cap clipping', () => {
	const square = {
		role: 'outer' as const,
		points: [
			[-2, -1],
			[2, -1],
			[2, 1],
			[-2, 1]
		] as const,
		edgeIdentities: ['a', 'b', 'c', 'd'],
		signedArea: 8
	};

	it('clips a loop to the segment extent and keeps its edge identities', () => {
		const [clipped] = clipLoopsToExtent([square], -1, 1)!;
		expect(clipped).toBeDefined();
		expect(clipped!.points).toHaveLength(4);
		expect(clipped!.signedArea).toBeCloseTo(4, 9);
		expect(clipped!.edgeIdentities.every((id) => id.length > 0)).toBe(true);
		expect(clipped!.points.every(([u]) => u >= -1 && u <= 1)).toBe(true);
	});

	it('drops a loop wholly outside the extent', () => {
		expect(clipLoopsToExtent([square], 3, 4)).toEqual([]);
	});

	it('clips an open chain to independent runs', () => {
		const chains = clipChainToExtent(
			{ points: [[-2, 0], [2, 0]], edgeIdentities: ['a'] },
			-1,
			1
		);
		expect(chains).toHaveLength(1);
		expect(chains[0]!.points).toEqual([[-1, 0], [1, 0]]);
	});
});

describe('the ghost rule on drawn pieces', () => {
	const cut = resolved(1);
	const triangle = (z: number) => ({
		positions: [0.5, 1, z, 1.5, 1, z, 1, 2, z]
	});

	it('ghosts a subject wholly inside the near piece', () => {
		expect(subjectWhollyHidden(cut, { triangles: [triangle(0.5)] })).toBe(true);
	});

	it('ghosts a subject wholly inside the far slab', () => {
		expect(subjectWhollyHidden(cut, { triangles: [triangle(-2)] })).toBe(true);
	});

	it('does not ghost a subject that crosses the shown band and depth', () => {
		const crossing = {
			positions: [0.5, 1, -2, 1.5, 1, -2, 1, 2, 0.5]
		};
		expect(subjectWhollyHidden(cut, { triangles: [crossing] })).toBe(false);
	});

	it('does not ghost a subject wholly outside the segment extent', () => {
		expect(
			subjectWhollyHidden(cut, {
				triangles: [{ positions: [3, 1, 0.5, 4, 1, 0.5, 3.5, 2, 0.5] }]
			})
		).toBe(false);
	});
});

describe('the ghost rule on drawn pieces: the bounds shortcut is exact', () => {
	const cut = resolved(1);

	it('ghosts a subject split across both hidden pieces, even when its box corners are all shown', () => {
		// One sliver in the near piece (z > 0) and one in the far slab (z < −1), both
		// inside the extent x ∈ [0, 2]. The box spans x ∈ [−1, 3] at its extreme
		// y-less corners, so every corner is outside the extent, and its centre sits in
		// the shown band: the old corner+centre shortcut called it fully shown.
		const near = { positions: [0.9, 1, 0.5, 1.1, 1, 0.5, 1, 2, 0.6] };
		const far = { positions: [0.9, 1, -2, 1.1, 1, -2, 1, 2, -2.1] };
		const bounds = { min: [-1, 1, -2.1] as const, max: [3, 2, 0.6] as const };
		expect(sliceHides(cut, -1, 1, -2.1)).toBe(false);
		expect(sliceHides(cut, 3, 2, 0.6)).toBe(false);
		expect(sliceHides(cut, 1, 1.5, -0.75)).toBe(false);
		expect(subjectWhollyHidden(cut, { triangles: [near, far], bounds })).toBe(true);
	});

	it('still short-cuts a box wholly outside both pieces', () => {
		const bounds = { min: [3, 0, -3] as const, max: [4, 2, 3] as const };
		expect(subjectWhollyHidden(cut, { triangles: [{ positions: [3, 0, 0, 4, 0, 0, 3.5, 2, 0] }], bounds })).toBe(false);
	});
});
