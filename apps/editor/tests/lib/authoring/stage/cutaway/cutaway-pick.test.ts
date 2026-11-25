/**
 * X2 §10.1.6 — a cut Wall above its stub is not pickable.
 *
 * The predicate is per object and per point: the same Wall below the stub still
 * selects, an uncut Wall is untouched, and nothing that is not a Wall is hidden
 * (O-1 leaves Scene objects as built).
 */
import { describe, expect, it } from 'vitest';
import { Mesh } from 'three';
import { tagRenderIdentity } from '$lib/render/render-identity';
import { cutawayHides, CUTAWAY_PICK_EPSILON_METERS } from '$lib/authoring/stage/cutaway/cutaway-pick';
import { clipSurfaceToCutaway, type StagePickSurface } from '$lib/authoring/layout/plan-pick-geometry';
import type { ResolvedCutaway } from '$lib/authoring/stage/cutaway/cutaway-resolved';

const cutaway: ResolvedCutaway = { wallIds: new Set(['w1']), stubTopY: 1 };

describe('cutawayHides', () => {
	it('hides a point above the stub on a cut Wall', () => {
		const wall = tagRenderIdentity(new Mesh(), 'wall', 'w1');
		expect(cutawayHides([0, 2, 0], wall, cutaway)).toBe(true);
	});

	it('keeps the stub face and everything below pickable', () => {
		const wall = tagRenderIdentity(new Mesh(), 'wall', 'w1');
		expect(cutawayHides([0, 1, 0], wall, cutaway)).toBe(false);
		expect(cutawayHides([0, 1 + CUTAWAY_PICK_EPSILON_METERS / 2, 0], wall, cutaway)).toBe(false);
		expect(cutawayHides([0, 0.2, 0], wall, cutaway)).toBe(false);
	});

	it('does not touch an uncut Wall, a non-Wall object or no cutaway', () => {
		const uncut = tagRenderIdentity(new Mesh(), 'wall', 'w2');
		const floor = tagRenderIdentity(new Mesh(), 'floor', 'f1');
		expect(cutawayHides([0, 2, 0], uncut, cutaway)).toBe(false);
		expect(cutawayHides([0, 2, 0], floor, cutaway)).toBe(false);
		expect(cutawayHides([0, 2, 0], uncut, null)).toBe(false);
	});
});

describe('clipSurfaceToCutaway', () => {
	const face: StagePickSurface = {
		kind: 'face',
		start: [0, 0],
		end: [3, 0],
		bottomMeters: 0,
		topMeters: 3
	};

	it('shortens only the face of a Wall in the effective cut set', () => {
		expect(clipSurfaceToCutaway(face, cutaway, 'w1')).toEqual([{ ...face, topMeters: 1 }]);
		expect(clipSurfaceToCutaway(face, cutaway, 'w2')).toEqual([face]);
		expect(clipSurfaceToCutaway(face, cutaway, null)).toEqual([face]);
	});

	it('leaves a flat surface to the cut set and the Wall predicate', () => {
		const flat: StagePickSurface = {
			kind: 'flat',
			elevationMeters: 2,
			geometry: { kind: 'polygon', polygon: [[0, 0], [1, 0], [1, 1]] }
		};
		expect(clipSurfaceToCutaway(flat, cutaway, 'w1')).toEqual([flat]);
	});
});
