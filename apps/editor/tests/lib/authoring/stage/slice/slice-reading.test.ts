/**
 * T1 SL1 — the one live Slice reading.
 *
 * Slice is session state: one reading, four transitions, and nothing else. It
 * must never become a document, a history entry or a persisted value, so the
 * store's exported surface is pinned here exactly as the Lift reading's is.
 */
import { describe, expect, it } from 'vitest';

import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';
import * as sliceModule from '$lib/authoring/stage/slice/slice-reading.svelte';

describe('T1 SL1 — the Slice reading', () => {
	it('starts, replaces, puts back and clears', () => {
		sliceReading.clear();
		expect(sliceReading.isActive()).toBe(false);
		expect(sliceReading.reading).toBeNull();

		sliceReading.level({ kind: 'to-floor' });
		expect(sliceReading.isActive()).toBe(true);
		expect(sliceReading.reading).toEqual({ kind: 'level', depth: { kind: 'to-floor' } });

		sliceReading.level({ kind: 'below', meters: 0.5 });
		expect(sliceReading.reading).toEqual({
			kind: 'level',
			depth: { kind: 'below', meters: 0.5 }
		});

		sliceReading.set({ kind: 'level', depth: { kind: 'to-floor' } });
		expect(sliceReading.reading).toEqual({ kind: 'level', depth: { kind: 'to-floor' } });

		sliceReading.putBack();
		expect(sliceReading.isActive()).toBe(false);
		expect(sliceReading.reading).toBeNull();
	});

	it('offers no second channel to a document, a history or a Camera', () => {
		// A document write, a history participant or a serialization hook would
		// have to appear on this surface, and this line is what refuses it.
		expect(Object.keys(sliceModule).sort()).toEqual(['sliceReading']);
	});
});
