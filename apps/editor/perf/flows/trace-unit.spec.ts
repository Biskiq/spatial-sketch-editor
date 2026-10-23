import { expect, test } from '@playwright/test';
import { decodeGrid, normalizeTraceClock, correlateTraceInputs, compositorEvidenceForImage, type TraceImage } from '../lib/trace-proof';
import type { LedgerRecord } from '../lib/ledger';

test('trace identity rejects corruption and mismatched preview; every input status survives', () => {
	const grid = [0xb17e, 3, 42, 0xb17e ^ 3 ^ 42].flatMap((word) => Array.from({ length: 16 }, (_, bit) => (word >>> (15 - bit)) & 1 ? 0 : 255));
	expect(decodeGrid(grid)).toEqual({ sequence: 3, signature: 42 });
	expect(decodeGrid(grid.map((value, index) => index === 18 ? 255 - value : value))).toBeNull();
	expect(decodeGrid(grid.map((value, index) => index === 18 ? 128 : value))).toBeNull();
	const records: LedgerRecord[] = Array.from({ length: 6 }, (_, index) => ({ kind: 'input', name: 'pointermove', time: index + 1, sequence: index + 1 }));
	records.push({ kind: 'mark', name: 'wall-preview:refused', time: 2, sequence: 2 },
		{ kind: 'install', name: 'wall-preview', time: 3, sequence: 3 },
		{ kind: 'mark', name: 'trace:overlay:3:42', time: 3.1, sequence: 3, detail: { signature: 42 } },
		{ kind: 'mark', name: 'trace:overlay:4:43', time: 4.1, sequence: 4, detail: { signature: 43 } },
		{ kind: 'install', name: 'wall-preview', time: 5, sequence: 5 });
	const image: TraceImage = { index: 0, traceTimeUs: 4000, pageTimeMs: 4, sequence: 3, signature: 42, previewPixelMatches: true, sourceId: null, frameSequence: null, expectedDisplayTime: null, imagePath: 'fixture' };
	expect(correlateTraceInputs(records, [image]).map((row) => row.status)).toEqual([
		'superseded-before-overlay', 'refused', 'trace-image-matched', 'overlay-not-captured', 'installed-not-rendered', 'unresolved'
	]);
	const legacy = correlateTraceInputs(records, [{ ...image, pageTimeMs: null, timingIssue: 'legacy clock unsupported' }])[2]!;
	expect(legacy.status).toBe('trace-image-identity-only');
	expect(legacy.inputToScreenshotEventMs).toBeNull();
	expect(legacy.screenshotEventTimeMs).toBeNull();
	expect(legacy.imageClockReason).toContain('unsupported');
	for (const wrong of [{ ...image, sequence: 4 }, { ...image, signature: 99 }, { ...image, previewPixelMatches: false }, { ...image, pageTimeMs: 2 }]) {
		expect(correlateTraceInputs(records, [wrong]).some((row) => row.frameIndex !== null)).toBe(false);
	}
});

test('trace clock uses two unique anchors and refuses clock drift', () => {
	const events = [{ name: 'a', ts: 1000000 }, { name: 'b', ts: 2000000 }];
	const anchors = [{ name: 'a', pageTimeMs: 10 }, { name: 'b', pageTimeMs: 1010 }];
	expect(normalizeTraceClock(events, anchors).toPageMs(1500000)).toBe(510);
	expect(() => normalizeTraceClock(events, [{ ...anchors[0]!, pageTimeMs: 0 }, anchors[1]!])).toThrow('discrepancy');
	expect(() => normalizeTraceClock([], anchors)).toThrow('Expected one');
});


test('compositor reports require exact source and frame IDs; expected time is never presentation', () => {
	const screenshot = { name: 'Screenshot', ts: 100, args: { source_id: 7, frame_sequence: 9, expected_display_time: 90 } };
	const reports = [
		{ name: 'PipelineReporter', ts: 80, args: { frame_reporter: { frame_source: 7, frame_sequence: 9, state: 'STATE_PRESENTED_ALL', layer_tree_host_id: 2 } } },
		{ name: 'PipelineReporter', ts: 99, args: { frame_reporter: { frame_source: 8, frame_sequence: 9, state: 'STATE_DROPPED' } } },
		{ name: 'PipelineReporter', ts: 100, args: { frame_reporter: { frame_source: 7, frame_sequence: 10, state: 'STATE_DROPPED' } } }
	];
	expect(compositorEvidenceForImage(screenshot, reports).states).toEqual(['STATE_PRESENTED_ALL']);
	expect(compositorEvidenceForImage({ ...screenshot, args: {} }, reports).matchingReports).toEqual([]);
});

test('epoch event timestamps normalize independently from handler time and latest-input age', () => {
	const records: LedgerRecord[] = [
		{ kind: 'input', name: 'pointermove', time: 12, sequence: 1, detail: { eventTimeStamp: 1700000000010, timeOrigin: 1700000000000 } },
		{ kind: 'install', name: 'wall-preview', time: 13, sequence: 1 },
		{ kind: 'mark', name: 'trace:overlay:1:42', time: 14, sequence: 1, detail: { signature: 42 } }
	];
	const image: TraceImage = { index: 0, traceTimeUs: 20000, pageTimeMs: 20, sequence: 1, signature: 42, previewPixelMatches: true, sourceId: 7, frameSequence: 9, expectedDisplayTime: 19, imagePath: 'fixture' };
	const row = correlateTraceInputs(records, [image])[0]!;
	expect(row.inputTimeMs).toBe(10);
	expect(row.inputToScreenshotEventMs).toBe(10);
	expect(row.latestInputAgeAtScreenshotEventMs).toBe(10);
	expect(row.physicalDisplayPresentationMs).toBeNull();
});

import { resolveTracePresentation } from '../lib/trace-presentation';
import type { TraceEvent } from '../lib/trace-proof';

function presentationFixture() {
	const screenshot: TraceEvent = { name: 'Screenshot', ts: 15000, args: { source_id: 7, frame_sequence: 9, expected_display_time: 99999 } };
	const begin: TraceEvent = { name: 'PipelineReporter', cat: 'cc', ph: 'b', ts: 10000, pid: 4, tid: 5, id2: { local: 'span' }, args: {
		frame_reporter: { frame_source: 7, frame_sequence: 9, state: 'STATE_PRESENTED_ALL', layer_tree_host_id: 2 }
	} };
	const end: TraceEvent = { name: 'PipelineReporter', cat: 'cc', ph: 'e', ts: 20000, pid: 4, tid: 6, id2: { local: 'span' } };
	return { screenshot, begin, end };
}

test('trace-reported presentation resolves exact async ID lifetime across threads and ID reuse', () => {
	const { screenshot, begin, end } = presentationFixture();
	const reused = { ...begin, ts: 30000, args: { frame_reporter: { ...(begin.args!.frame_reporter as Record<string, unknown>), frame_sequence: 10 } } };
	const result = resolveTracePresentation(screenshot, [begin, end, reused, { ...end, ts: 40000 }]);
	// Uses exact source/frame + scoped async ID completion, neither screenshot ts
	// nor expected display time, and does not take the reused span's completion.
	expect(result.traceTimeUs).toBe(20000);
	expect(result.end).toBe(end);
	expect(result.layerTreeHostId).toBe(2);
	const complete = resolveTracePresentation(screenshot, [{ ...begin, ph: 'X', dur: 7000 }]);
	expect(complete.traceTimeUs).toBe(17000);
});

test('missing, mismatched and duplicate async completions never create a presentation time', () => {
	const { screenshot, begin, end } = presentationFixture();
	for (const events of [[begin], [begin, { ...end, pid: 99 }], [begin, { ...end, id2: { local: 'other' } }],
		[begin, end, { ...end, ts: 21000 }], [begin, { ...begin, ts: 15000 }, end]]) {
		expect(resolveTracePresentation(screenshot, events).traceTimeUs).toBeNull();
	}
	expect(resolveTracePresentation(screenshot, [begin, end, { ...end, ts: 21000 }]).status).toContain('ambiguous');
	expect(resolveTracePresentation(screenshot, [{ ...begin, ph: 'X', dur: -1 }]).traceTimeUs).toBeNull();
});

test('partial/forked-only, missing host and ambiguous host/full reports are refused', () => {
	const { screenshot, begin, end } = presentationFixture();
	const reporter = begin.args!.frame_reporter as Record<string, unknown>;
	const changed = (fields: Record<string, unknown>) => ({ ...begin, args: { frame_reporter: { ...reporter, ...fields } } });
	for (const events of [
		[changed({ state: 'STATE_PRESENTED_PARTIAL' }), end],
		[changed({ frame_type: 'FORKED' }), end],
		[changed({ layer_tree_host_id: undefined }), end],
		[begin, changed({ layer_tree_host_id: 3 }), end],
		[begin, { ...begin, id2: { local: 'duplicate-all' } }, end],
		[changed({ has_missing_content: true }), end],
		[changed({ frame_source: 8 }), end], [changed({ frame_sequence: 10 }), end]
	]) expect(resolveTracePresentation(screenshot, events).traceTimeUs).toBeNull();
	expect(resolveTracePresentation({ ...screenshot, args: {} }, [begin, end]).traceTimeUs).toBeNull();
});
