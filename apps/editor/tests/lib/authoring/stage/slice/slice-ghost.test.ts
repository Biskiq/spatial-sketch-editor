/**
 * T1 SL1 — when a selected subject becomes a ghost.
 *
 * The failure this suite catches is a subject that **crosses** the Slice with
 * every vertex hidden: a Wall from below the lower bound to above the cut has
 * no visible vertex, yet it plainly crosses the visible band. The exact
 * same-convex-piece rule and its AABB fallback are pinned here; a regression to
 * "every vertex is hidden" makes the first case fail.
 */
import { describe, expect, it } from 'vitest';

import { classifySliceGhost, meshBoundsOf, subjectBoundsOf, type GhostBox, type GhostMeshInput } from '$lib/authoring/stage/slice/slice-ghost';
import { resolveSlice, type ResolvedSlice } from '$lib/authoring/stage/slice/slice-cut';

const BAND: ResolvedSlice = resolveSlice({ kind: 'level', depth: { kind: 'below', meters: 0.5 } }, { sheetHeight: 1.2, datumMeters: 0 });

function box(min: readonly [number, number, number], max: readonly [number, number, number]): GhostMeshInput {
	const [x0, y0, z0] = min;
	const [x1, y1, z1] = max;
	const positions = new Float32Array([
		x0, y0, z0,
		x1, y0, z0,
		x1, y0, z1,
		x0, y0, z1,
		x0, y1, z0,
		x1, y1, z0,
		x1, y1, z1,
		x0, y1, z1
	]);
	const index = new Uint32Array([
		0, 2, 1, 0, 3, 2,
		4, 5, 6, 4, 6, 7,
		0, 1, 5, 0, 5, 4,
		1, 2, 6, 1, 6, 5,
		2, 3, 7, 2, 7, 6,
		3, 0, 4, 3, 4, 7
	]);
	return { positions, index };
}

function quadSpanning(yLow: number, yHigh: number): GhostMeshInput {
	// Two triangles with vertices only at the two ends: no vertex in the band.
	return {
		positions: new Float32Array([0, yLow, 0, 4, yLow, 0, 4, yHigh, 0, 0, yHigh, 0]),
		index: new Uint32Array([0, 1, 2, 0, 2, 3])
	};
}

describe('T1 SL1 — wholly hidden classification', () => {
	it('does not ghost a Wall that crosses the band with vertices only at its ends', () => {
		const verdict = classifySliceGhost(BAND, { meshes: [quadSpanning(0.2, 2.2)] });
		expect(verdict.ghost).toBe(false);
		expect(verdict.reason).toBe('triangles-visible');
	});

	it('ghosts a ceiling light wholly above the cut', () => {
		expect(classifySliceGhost(BAND, { meshes: [box([0, 2, 0], [0.4, 2.2, 0.4])] })).toMatchObject({
			ghost: true,
			reason: 'bounds-hidden'
		});
	});

	it('keeps an object straddling the cut visible', () => {
		const verdict = classifySliceGhost(BAND, { meshes: [box([0, 1.0, 0], [0.4, 1.4, 0.4])] });
		expect(verdict.ghost).toBe(false);
	});

	it('ghosts an object wholly below the lower bound', () => {
		expect(classifySliceGhost(BAND, { meshes: [box([0, 0.1, 0], [0.4, 0.4, 0.4])] })).toMatchObject({
			ghost: true,
			reason: 'bounds-hidden'
		});
	});

	it('keeps a triangle with one vertex above and two below visible', () => {
		const triangle: GhostMeshInput = {
			positions: new Float32Array([0, 0.6, 0, 1, 1.0, 0, 0.5, 1.4, 1])
		};
		expect(classifySliceGhost(BAND, { meshes: [triangle] })).toMatchObject({
			ghost: false,
			reason: 'triangles-visible'
		});
	});

	it('agrees between the AABB fast paths and the exact triangle test', () => {
		const above = box([0, 2, 0], [1, 3, 1]);
		const inside = box([0, 0.8, 0], [1, 1.1, 1]);
		const boundsAbove: GhostBox = { min: [0, 2, 0], max: [1, 3, 1] };
		const boundsInside: GhostBox = { min: [0, 0.8, 0], max: [1, 1.1, 1] };

		// The same subject answered by the box fast path and by triangles.
		expect(subjectBoundsOf({ meshes: [above], bounds: boundsAbove })).toEqual(boundsAbove);
		expect(classifySliceGhost(BAND, { meshes: [above] })).toMatchObject({ ghost: true });
		expect(classifySliceGhost(BAND, { meshes: [above], bounds: boundsAbove })).toMatchObject({
			ghost: true,
			reason: 'bounds-hidden'
		});
		expect(classifySliceGhost(BAND, { meshes: [inside], bounds: boundsInside })).toMatchObject({
			ghost: false,
			reason: 'bounds-visible'
		});
	});

	it('uses the conservative AABB fallback and errs toward hidden', () => {
		const skinned: GhostMeshInput = {
			...box([0, 1.15, 0], [1, 1.25, 1]),
			conservative: true
		};
		// A box straddling the cut cannot be trusted from CPU vertices: ghost it.
		expect(classifySliceGhost(BAND, { meshes: [skinned] })).toMatchObject({
			ghost: true,
			reason: 'conservative-hidden'
		});
		// A visible conservative mesh beside an above-cut one: the subject's own
		// box straddles the cut, so the conservative verdict decides.
		expect(
			classifySliceGhost(BAND, {
				meshes: [
					box([0, 2, 0], [1, 2.5, 1]),
					{ ...box([0, 0.8, 0], [1, 1.0, 1]), conservative: true }
				]
			})
		).toMatchObject({ ghost: false, reason: 'conservative-visible' });
	});

	it('does not ghost a subject with no drawable triangle', () => {
		expect(classifySliceGhost(BAND, { meshes: [] })).toMatchObject({
			ghost: false,
			reason: 'no-drawable-triangle'
		});
		expect(
			classifySliceGhost(BAND, { meshes: [{ positions: new Float32Array([0, 3, 0]) }] })
		).toMatchObject({ ghost: false, reason: 'no-drawable-triangle' });
	});

	it('keeps a subject visible when any of its meshes is visible', () => {
		expect(
			classifySliceGhost(BAND, {
				meshes: [box([0, 2, 0], [1, 2.5, 1]), box([0, 0.8, 0], [1, 1.0, 1])]
			})
		).toMatchObject({ ghost: false });
	});

	it('applies the mesh world matrix before classifying', () => {
		const translated = box([0, 0, 0], [1, 0.2, 1]);
		// Column-major +Y translation of 2 m.
		const matrixWorld = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 0, 1];
		expect(meshBoundsOf({ ...translated, matrixWorld })?.min[1]).toBeCloseTo(2, 12);
		expect(
			classifySliceGhost(BAND, { meshes: [{ ...translated, matrixWorld }] })
		).toMatchObject({ ghost: true, reason: 'bounds-hidden' });
	});
});
