/**
 * R217.S30 — stacked zero-width waits stay individually reachable.
 */
import { describe, expect, it } from 'vitest';
import {
	coincidentWaitMarkers,
	locateSegmentAt,
	resolveWaitScrub,
	type WaitMarker
} from '$lib/authoring/experience/timeline-scrub';
import { initialVisitorSurfaceMode } from '$lib/visitor/visitor-entry';

const WAITS: WaitMarker[] = [
	{ id: 'wait-a', left: 40 },
	{ id: 'wait-b', left: 40 },
	{ id: 'wait-c', left: 80 }
];

describe('R217.S30 timeline scrub and visitor entry', () => {
	it('groups coincident waits and cycles each press through them', () => {
		expect(coincidentWaitMarkers(WAITS, 40.4).map((wait) => wait.id)).toEqual(['wait-a', 'wait-b']);
		expect(resolveWaitScrub({ waits: WAITS, fractionPercent: 40, currentSegmentId: null })).toBe('wait-a');
		expect(resolveWaitScrub({ waits: WAITS, fractionPercent: 40, currentSegmentId: 'wait-a' })).toBe('wait-b');
		expect(resolveWaitScrub({ waits: WAITS, fractionPercent: 40, currentSegmentId: 'wait-b' })).toBe('wait-a');
		expect(resolveWaitScrub({ waits: WAITS, fractionPercent: 80, currentSegmentId: 'wait-b' })).toBe('wait-c');
		expect(resolveWaitScrub({ waits: WAITS, fractionPercent: 60, currentSegmentId: null })).toBeNull();
	});

	it('maps a track fraction to the segment under it and that segment’s local fraction', () => {
		const lanes = [
			{ id: 'hold:a', widthFraction: 0.5 },
			{ id: 'travel:a', widthFraction: 0.25 },
			{ id: 'hold:b', widthFraction: 0.25 }
		];
		expect(locateSegmentAt(lanes, 0)).toEqual({ segmentId: 'hold:a', localFraction: 0 });
		expect(locateSegmentAt(lanes, 0.25)).toEqual({ segmentId: 'hold:a', localFraction: 0.5 });
		expect(locateSegmentAt(lanes, 0.5)).toEqual({ segmentId: 'travel:a', localFraction: 0 });
		expect(locateSegmentAt(lanes, 0.625)).toEqual({ segmentId: 'travel:a', localFraction: 0.5 });
		expect(locateSegmentAt(lanes, 1)).toEqual({ segmentId: 'hold:b', localFraction: 1 });
		expect(locateSegmentAt([], 0.3)).toBeNull();
	});

	it('a published route enters the tour without the authoring welcome chooser', () => {
		expect(initialVisitorSurfaceMode('public', 'welcome')).toBe('guided');
		expect(initialVisitorSurfaceMode('public', 'presentation')).toBe('guided');
		expect(initialVisitorSurfaceMode('public', 'free')).toBe('free');
		expect(initialVisitorSurfaceMode('preview', 'welcome')).toBe('welcome');
		expect(initialVisitorSurfaceMode('preview', 'presentation')).toBe('guided');
		// A Guide Card action picks guided explicitly; it must bypass the welcome.
		expect(initialVisitorSurfaceMode('preview', 'guided')).toBe('guided');
	});
});
