/**
 * SL1 — when the section is assembled (§6, after the measurement).
 *
 * The eleven-Room measurement (44 Walls, 7,040 candidate triangles, ~30 ms against a
 * 4 ms budget) made "assemble once per animation frame" the wrong rule for a drag.
 * The cut itself is free — it is the GPU's plane array — so the plane and the clipping
 * follow every frame while the section waits for the Sheet to rest.
 *
 * The rule lives in `decideCapAssembly` so it is tested, not asserted about in a
 * Svelte file: a geometry change assembles at once, a moved reading defers, no
 * reading clears, and an unchanged state does nothing.
 */
import { describe, expect, it } from 'vitest';
import { decideCapAssembly } from '$lib/authoring/stage/slice/slice-cap-schedule';

const state = (geometryKey: string, cutKey: string | null) => ({ geometryKey, cutKey });

describe('decideCapAssembly', () => {
	it('assembles on the first reading', () => {
		expect(decideCapAssembly(null, state('g1', '1.2:floor'))).toBe('rebuild');
	});

	it('defers a moved reading on the same geometry', () => {
		expect(decideCapAssembly(state('g1', '1.2:floor'), state('g1', '1.7:floor'))).toBe('defer');
		// A finite depth is part of the reading, not of the geometry.
		expect(decideCapAssembly(state('g1', '1.2:floor'), state('g1', '1.2:0.5'))).toBe('defer');
	});

	it('never defers a geometry or selection change', () => {
		expect(decideCapAssembly(state('g1', '1.2:floor'), state('g2', '1.2:floor'))).toBe('rebuild');
		// The ghost's identity is in the geometry key: a new hidden selection is a rebuild
		// even though the Wall geometry and the cut are untouched.
		expect(decideCapAssembly(state('g1:ghostA', '1.2:floor'), state('g1:ghostB', '1.2:floor'))).toBe(
			'rebuild'
		);
	});

	it('does nothing when neither the reading nor the geometry changed', () => {
		expect(decideCapAssembly(state('g1', '1.2:floor'), state('g1', '1.2:floor'))).toBe('none');
	});

	it('clears when the Slice is put back', () => {
		expect(decideCapAssembly(state('g1', '1.2:floor'), null)).toBe('clear');
	});
});
