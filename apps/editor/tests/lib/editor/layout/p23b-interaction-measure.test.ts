import { afterEach, describe, expect, it } from 'vitest';
import {
	p23bActivateInteraction,
	p23bAfterInteraction,
	p23bClosePress,
	p23bDeferPress,
	p23bMeasureActiveAdapter,
	p23bMeasureActiveReactive,
	p23bMeasureInteraction,
	p23bOpenPress,
	p23bResolveAwaitingPress,
	p23bResolvePress
} from '$lib/editor/layout/p23b-interaction-measure';

type P23BGlobals = typeof globalThis & {
	__P2311_PERF__?: boolean;
	__P23B_ACTIVE_INTERACTION__?: unknown;
};

const globals = globalThis as P23BGlobals;

// Node has no `requestAnimationFrame`; the press boundaries only need the
// callback to run, so a timeout stands in for the frame.
globalThis.requestAnimationFrame ??= ((callback: FrameRequestCallback) =>
	setTimeout(() => callback(performance.now()), 0) as unknown as number);

afterEach(() => {
	delete globals.__P2311_PERF__;
	delete globals.__P23B_ACTIVE_INTERACTION__;
	for (const entry of performance.getEntriesByType('measure')) {
		if (entry.name.startsWith('p2311:p23b:')) performance.clearMeasures(entry.name);
	}
	for (const entry of performance.getEntriesByType('mark')) {
		if (entry.name.startsWith('p2311:p23b:')) performance.clearMarks(entry.name);
	}
});

describe('P23B interaction measurements', () => {
	it('leaves interaction results and control flow unchanged while disabled', () => {
		globals.__P2311_PERF__ = false;
		let calls = 0;
		const measured = p23bMeasureInteraction('selection', 'input', () => ++calls);
		const adapted = p23bMeasureActiveAdapter(() => ++calls);
		const reactive = p23bMeasureActiveReactive(() => ++calls);
		p23bActivateInteraction('selection');
		p23bAfterInteraction('selection');

		expect([measured, adapted, reactive, calls]).toEqual([1, 2, 3, 3]);
		expect(globals.__P23B_ACTIVE_INTERACTION__).toBeUndefined();
		expect(performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith('p2311:p23b:'))).toEqual([]);
	});

	it('records the synchronous boundary in the existing P23.11 mark namespace when enabled', () => {
		globals.__P2311_PERF__ = true;
		const value = p23bMeasureInteraction('bend-knot-edit', 'reactive', () => 42);
		expect(value).toBe(42);
		expect(performance.getEntriesByName('p2311:p23b:bend-knot-edit:reactive', 'measure')).toHaveLength(1);
	});

	it('names a press that opened no gesture under the path it started as', () => {
		globals.__P2311_PERF__ = true;
		const press = p23bOpenPress('selection', 7);
		p23bClosePress(press);
		p23bResolvePress(press, 'selection');

		expect(performance.getEntriesByName('p2311:p23b:selection:input', 'measure')).toHaveLength(1);
		expect(performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith('p2311:p23b:plan-drag-edit:'))).toEqual([]);
		expect(performance.getEntriesByType('mark').filter((entry) => entry.name.startsWith('p2311:p23b:'))).toEqual([]);
	});

	it('writes nothing for a press that armed a gesture until its release resolves it', () => {
		globals.__P2311_PERF__ = true;
		const press = p23bOpenPress('selection', 11);
		p23bClosePress(press);
		p23bDeferPress(press);

		// A Wall press selects and arms a move, so it stays unnamed until the
		// release says which interaction it became.
		expect(performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith('p2311:p23b:'))).toEqual([]);

		p23bResolveAwaitingPress(12, 'plan-drag-edit');
		expect(performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith('p2311:p23b:'))).toEqual([]);

		p23bResolveAwaitingPress(11, 'plan-drag-edit');
		expect(performance.getEntriesByName('p2311:p23b:plan-drag-edit:input', 'measure')).toHaveLength(1);
		expect(performance.getEntriesByName('p2311:p23b:selection:input', 'measure')).toEqual([]);
	});

	it('leaves the press boundaries unmeasured while disabled', () => {
		globals.__P2311_PERF__ = false;
		const press = p23bOpenPress('selection', 3);
		p23bClosePress(press);
		p23bResolvePress(press, 'selection');

		expect(press).toBeNull();
		expect(performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith('p2311:p23b:'))).toEqual([]);
	});
});
